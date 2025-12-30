from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from pathlib import Path

from backend.database import engine, get_db, Base
from backend import models, schemas, crud
from backend.ocr_processor import OCRProcessor

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(title="OCR Table Extractor", version="1.0.0")

# Create upload directory
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize OCR processor
ocr_processor = OCRProcessor()

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

        # Update status to completed
        crud.update_document_status(db, document_id, 2)

    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        # Update status to failed
        crud.update_document_status(db, document_id, 3)
    finally:
        db.close()

# Routes
@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main HTML page"""
    return FileResponse("templates/index.html")

@app.post("/api/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a screenshot/image for OCR processing"""
    # Validate file type
    allowed_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image file.")

    # Save uploaded file
    file_path = UPLOAD_DIR / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create document record
    document = crud.create_document(db, file.filename, str(file_path))

    # Schedule OCR processing in background
    background_tasks.add_task(process_document_ocr, document.id, str(file_path))

    return document

@app.get("/api/documents", response_model=List[schemas.DocumentResponse])
async def list_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get list of all documents"""
    documents = crud.get_documents(db, skip=skip, limit=limit)
    return documents

@app.get("/api/documents/{document_id}", response_model=schemas.DocumentWithTablesResponse)
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get a specific document with its tables and cells"""
    document = crud.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete a document and its associated data"""
    success = crud.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}

@app.get("/api/tables/{table_id}", response_model=schemas.ExtractedTableResponse)
async def get_table(table_id: int, db: Session = Depends(get_db)):
    """Get a specific table with its cells"""
    table = crud.get_table(db, table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table

@app.delete("/api/tables/{table_id}")
async def delete_table(table_id: int, db: Session = Depends(get_db)):
    """Delete a table and its cells"""
    success = crud.delete_table(db, table_id)
    if not success:
        raise HTTPException(status_code=404, detail="Table not found")
    return {"message": "Table deleted successfully"}

@app.put("/api/cells/{cell_id}", response_model=schemas.TableCellResponse)
async def update_cell(
    cell_id: int,
    cell_update: schemas.TableCellUpdate,
    db: Session = Depends(get_db)
):
    """Update a cell's content"""
    cell = crud.update_cell(db, cell_id, cell_update.content)
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")
    return cell

@app.get("/api/cells/{cell_id}", response_model=schemas.TableCellResponse)
async def get_cell(cell_id: int, db: Session = Depends(get_db)):
    """Get a specific cell"""
    cell = crud.get_cell(db, cell_id)
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")
    return cell

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
