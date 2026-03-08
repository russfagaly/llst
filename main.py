from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import re
import shutil
from datetime import date
from pathlib import Path

from backend.database import engine, get_db, Base
from backend import models, schemas, crud
from backend.ocr_processor import OCRProcessor
from backend.auth import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_superuser,
    has_collection_access
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Baseball Stats OCR Extractor",
    version="2.0.0",
    description="OCR tool for extracting baseball statistics from screenshots with multi-user access control"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve uploaded images (needed for review panel image preview)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Initialize OCR processor
ocr_processor = OCRProcessor()

# ========== FILENAME PARSER ==========

_FILENAME_RE = re.compile(
    r"^(.+?)\s*-\s*(\d{4}\s+\d{2}\s+\d{2})\s*-\s*(.+?)\s*-\s*(\d+)\.\w+$"
)

def parse_filename(filename: str) -> Optional[dict]:
    """
    Parse structured filenames like: Hitting - 2025 03 08 - Brewers - 1.png
    Returns dict with data_type, game_date, team_name, file_number, or None on no match.
    """
    m = _FILENAME_RE.match(filename)
    if not m:
        return None
    data_type, date_str, team_name, file_number = m.groups()
    try:
        year, month, day = date_str.split()
        game_date = date(int(year), int(month), int(day))
    except Exception:
        return None
    return {
        "data_type": data_type.strip(),
        "game_date": game_date,
        "team_name": team_name.strip(),
        "file_number": int(file_number),
    }

# ========== SCHEDULER ==========

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    _scheduler = BackgroundScheduler()

    def _scheduled_backup():
        db = next(get_db())
        try:
            from backend.backup import run_backup
            result = run_backup(db)
            print(f"[scheduler] Backup completed: {result}")
        except Exception as e:
            print(f"[scheduler] Backup error: {e}")
        finally:
            db.close()

    _BACKUP_SCHEDULE = os.getenv("BACKUP_SCHEDULE", "0 2 * * *")
    try:
        minute, hour, day, month, day_of_week = _BACKUP_SCHEDULE.split()
        _scheduler.add_job(
            _scheduled_backup,
            CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=day_of_week),
            id="daily_backup",
            replace_existing=True
        )
    except Exception as e:
        print(f"[scheduler] Invalid BACKUP_SCHEDULE, using default 2 AM: {e}")
        _scheduler.add_job(_scheduled_backup, CronTrigger(hour=2, minute=0),
                           id="daily_backup", replace_existing=True)

    _scheduler.start()
    print("[scheduler] APScheduler started — daily backup scheduled")

except ImportError:
    print("[scheduler] apscheduler not installed — scheduled backups disabled")

# Background task for processing OCR
def process_document_ocr(document_id: int, file_path: str):
    """Background task to process OCR for uploaded document"""
    db = next(get_db())
    try:
        # Update status to processing
        crud.update_document_status(db, document_id, 1)

        # Extract tables from image
        tables_data = ocr_processor.extract_tables_from_image(file_path)

        # Save tables and cells to database
        for table_data in tables_data:
            # Create table record
            db_table = crud.create_table(db, table_data, document_id)

            # Create cell records
            for cell_data in table_data["cells"]:
                crud.create_cell(db, cell_data, db_table.id)

        # Update status to pending_review (4) — awaiting admin approval
        crud.update_document_status(db, document_id, 4)

    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        # Update status to failed
        crud.update_document_status(db, document_id, 3)
    finally:
        db.close()

# ========== AUTHENTICATION ROUTES ==========

@app.post("/api/auth/register", response_model=schemas.UserResponse)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user (public endpoint)"""
    # Check if user already exists
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if crud.get_user_by_username(db, user.username):
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create new user (not a superuser)
    db_user = crud.create_user(db, user, is_superuser=False)
    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Update last login
    crud.update_user_last_login(db, user.id)

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_current_user_info(current_user: models.User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

# ========== USER MANAGEMENT ROUTES (Admin Only) ==========

@app.get("/api/admin/users", response_model=List[schemas.UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """List all users (superuser only)"""
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@app.get("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
async def get_user(
    user_id: int,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Get a specific user (superuser only)"""
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Update a user (superuser only)"""
    user = crud.update_user(db, user_id, user_update)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Delete a user (superuser only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    success = crud.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}

# ========== COLLECTION ROUTES ==========

@app.post("/api/collections", response_model=schemas.CollectionResponse)
async def create_collection(
    collection: schemas.CollectionCreate,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Create a new collection (superuser only)"""
    db_collection = crud.create_collection(db, collection, current_user.id)
    return db_collection

@app.get("/api/collections", response_model=List[schemas.CollectionResponse])
async def list_collections(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all collections the current user has access to"""
    collections = crud.get_user_collections(db, current_user.id)
    return collections

@app.get("/api/collections/{collection_id}", response_model=schemas.CollectionWithUsersResponse)
async def get_collection(
    collection_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific collection"""
    collection = crud.get_collection(db, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Check access
    if not current_user.is_superuser and not has_collection_access(current_user, collection_id):
        raise HTTPException(status_code=403, detail="Access denied to this collection")

    return collection

@app.put("/api/collections/{collection_id}", response_model=schemas.CollectionResponse)
async def update_collection(
    collection_id: int,
    collection_update: schemas.CollectionUpdate,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Update a collection (superuser only)"""
    collection = crud.update_collection(db, collection_id, collection_update)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection

@app.delete("/api/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Delete a collection (superuser only)"""
    success = crud.delete_collection(db, collection_id)
    if not success:
        raise HTTPException(status_code=404, detail="Collection not found")

    return {"message": "Collection deleted successfully"}

# ========== PERMISSION MANAGEMENT ==========

@app.post("/api/admin/permissions/grant")
async def grant_access(
    permission: schemas.UserPermission,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Grant a user access to a collection (superuser only)"""
    success = crud.grant_collection_access(db, permission.user_id, permission.collection_id)
    if not success:
        raise HTTPException(status_code=404, detail="User or collection not found")

    return {"message": "Access granted successfully"}

@app.post("/api/admin/permissions/revoke")
async def revoke_access(
    permission: schemas.UserPermission,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Revoke a user's access to a collection (superuser only)"""
    success = crud.revoke_collection_access(db, permission.user_id, permission.collection_id)
    if not success:
        raise HTTPException(status_code=404, detail="User or collection not found")

    return {"message": "Access revoked successfully"}

# ========== DOCUMENT ROUTES ==========

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main HTML page"""
    return FileResponse("templates/index.html")

@app.post("/api/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    collection_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a screenshot/image for OCR processing"""
    # Check if user has access to the collection
    if not current_user.is_superuser and not has_collection_access(current_user, collection_id):
        raise HTTPException(status_code=403, detail="Access denied to this collection")

    # Validate file type
    allowed_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image file.")

    # Save uploaded file
    file_path = UPLOAD_DIR / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Parse filename metadata
    parsed = parse_filename(file.filename) or {}

    # Create document record
    document = crud.create_document(
        db, file.filename, str(file_path), current_user.id, collection_id,
        data_type=parsed.get("data_type"),
        game_date=parsed.get("game_date"),
        team_name=parsed.get("team_name"),
        file_number=parsed.get("file_number"),
        filename_parsed=bool(parsed)
    )

    # Schedule OCR processing in background
    background_tasks.add_task(process_document_ocr, document.id, str(file_path))

    return document

@app.get("/api/documents", response_model=List[schemas.DocumentResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    collection_id: int = None,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of documents accessible to the user"""
    if collection_id:
        # Check access to specific collection
        if not current_user.is_superuser and not has_collection_access(current_user, collection_id):
            raise HTTPException(status_code=403, detail="Access denied to this collection")
        documents = crud.get_documents_by_collection(db, collection_id, skip, limit)
    else:
        # Get all documents user has access to
        documents = crud.get_user_accessible_documents(db, current_user, skip, limit)

    return documents

@app.get("/api/documents/{document_id}", response_model=schemas.DocumentWithTablesResponse)
async def get_document(
    document_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific document with its tables and cells"""
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if user has access to the document's collection
    if not current_user.is_superuser and not has_collection_access(current_user, document.collection_id):
        raise HTTPException(status_code=403, detail="Access denied to this document")

    return document

@app.delete("/api/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document and its associated data"""
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if user has access to delete (must be uploader or superuser)
    if not current_user.is_superuser and document.uploaded_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = crud.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"message": "Document deleted successfully"}

# ========== TABLE ROUTES ==========

@app.get("/api/tables/{table_id}", response_model=schemas.ExtractedTableResponse)
async def get_table(
    table_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific table with its cells"""
    table = crud.get_table(db, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Check access via document
    document = crud.get_document(db, table.document_id)
    if not current_user.is_superuser and not has_collection_access(current_user, document.collection_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return table

@app.delete("/api/tables/{table_id}")
async def delete_table(
    table_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a table and its cells"""
    table = crud.get_table(db, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Check access via document
    document = crud.get_document(db, table.document_id)
    if not current_user.is_superuser and document.uploaded_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = crud.delete_table(db, table_id)
    if not success:
        raise HTTPException(status_code=404, detail="Table not found")

    return {"message": "Table deleted successfully"}

# ========== CELL ROUTES ==========

@app.put("/api/cells/{cell_id}", response_model=schemas.TableCellResponse)
async def update_cell(
    cell_id: int,
    cell_update: schemas.TableCellUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a cell's content"""
    cell = crud.get_cell(db, cell_id)
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")

    # Check access via table -> document
    table = crud.get_table(db, cell.table_id)
    document = crud.get_document(db, table.document_id)

    if not current_user.is_superuser and not has_collection_access(current_user, document.collection_id):
        raise HTTPException(status_code=403, detail="Access denied")

    cell = crud.update_cell(db, cell_id, cell_update.content)
    return cell

@app.get("/api/cells/{cell_id}", response_model=schemas.TableCellResponse)
async def get_cell(
    cell_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific cell"""
    cell = crud.get_cell(db, cell_id)
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")

    # Check access via table -> document
    table = crud.get_table(db, cell.table_id)
    document = crud.get_document(db, table.document_id)

    if not current_user.is_superuser and not has_collection_access(current_user, document.collection_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return cell

# ========== ADMIN BACKUP ENDPOINTS ==========

@app.post("/api/admin/backup", response_model=schemas.BackupResponse)
async def trigger_backup(
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Trigger a manual database backup (superuser only)"""
    from backend.backup import run_backup
    result = run_backup(db)
    # Fetch and return the saved record
    backups = crud.list_backups(db, limit=1)
    if not backups:
        raise HTTPException(status_code=500, detail="Backup record not found after run")
    return backups[0]

@app.get("/api/admin/backups", response_model=List[schemas.BackupResponse])
async def list_backups(
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """List backup history (superuser only)"""
    return crud.list_backups(db, skip=skip, limit=limit)

# ========== ADMIN REVIEW ENDPOINTS ==========

@app.get("/api/admin/review", response_model=List[schemas.DocumentWithTablesResponse])
async def list_pending_review(
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """List all documents awaiting review (status=4) with tables and cells (superuser only)"""
    return crud.get_documents_pending_review(db)

@app.get("/api/admin/review/{doc_id}", response_model=schemas.DocumentWithTablesResponse)
async def get_review_document(
    doc_id: int,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Get a single pending-review document with image path, tables, and cells (superuser only)"""
    document = crud.get_document(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.processed != 4:
        raise HTTPException(status_code=400, detail="Document is not pending review")
    return document

@app.post("/api/admin/review/{doc_id}/approve")
async def approve_document(
    doc_id: int,
    current_user: models.User = Depends(get_current_superuser),
    db: Session = Depends(get_db)
):
    """Approve a pending-review document — sets status to completed (2) (superuser only)"""
    document = crud.get_document(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.processed != 4:
        raise HTTPException(status_code=400, detail="Document is not pending review")
    crud.approve_document(db, doc_id)
    return {"message": "Document approved and committed"}

# ========== INITIALIZATION ENDPOINT ==========

@app.post("/api/init/create-superuser")
async def create_initial_superuser(
    user: schemas.UserCreate,
    secret: str,
    db: Session = Depends(get_db)
):
    """
    Create the first superuser. This should only be used for initial setup.
    Requires a secret key to prevent unauthorized access.
    """
    INIT_SECRET = os.getenv("INIT_SECRET", "change-this-secret")

    if secret != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    # Check if any superusers exist
    existing_superuser = db.query(models.User).filter(models.User.is_superuser == True).first()
    if existing_superuser:
        raise HTTPException(status_code=400, detail="Superuser already exists")

    # Create superuser
    superuser = crud.create_user(db, user, is_superuser=True)

    return {"message": "Superuser created successfully", "user": superuser.username}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
