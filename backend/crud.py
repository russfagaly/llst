from sqlalchemy.orm import Session
from typing import List, Optional
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime

# User CRUD operations
def create_user(db: Session, user: schemas.UserCreate, is_superuser: bool = False) -> models.User:
    """Create a new user"""
    db_user = models.User(
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        hashed_password=get_password_hash(user.password),
        is_superuser=is_superuser
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: int) -> Optional[models.User]:
    """Get a user by ID"""
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """Get a user by email"""
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    """Get a user by username"""
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]:
    """Get all users"""
    return db.query(models.User).offset(skip).limit(limit).all()

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate) -> Optional[models.User]:
    """Update a user"""
    db_user = get_user(db, user_id)
    if db_user:
        update_data = user_update.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        for field, value in update_data.items():
            setattr(db_user, field, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def update_user_last_login(db: Session, user_id: int) -> Optional[models.User]:
    """Update user's last login timestamp"""
    db_user = get_user(db, user_id)
    if db_user:
        db_user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int) -> bool:
    """Delete a user"""
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False

# Collection CRUD operations
def create_collection(db: Session, collection: schemas.CollectionCreate, created_by_id: int) -> models.Collection:
    """Create a new collection"""
    db_collection = models.Collection(
        name=collection.name,
        description=collection.description,
        created_by_id=created_by_id
    )
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection

def get_collection(db: Session, collection_id: int) -> Optional[models.Collection]:
    """Get a collection by ID"""
    return db.query(models.Collection).filter(models.Collection.id == collection_id).first()

def get_collections(db: Session, skip: int = 0, limit: int = 100) -> List[models.Collection]:
    """Get all collections"""
    return db.query(models.Collection).offset(skip).limit(limit).all()

def get_user_collections(db: Session, user_id: int) -> List[models.Collection]:
    """Get all collections a user has access to"""
    user = get_user(db, user_id)
    if not user:
        return []
    if user.is_superuser:
        return get_collections(db)
    return user.allowed_collections

def update_collection(db: Session, collection_id: int, collection_update: schemas.CollectionUpdate) -> Optional[models.Collection]:
    """Update a collection"""
    db_collection = get_collection(db, collection_id)
    if db_collection:
        update_data = collection_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_collection, field, value)
        db.commit()
        db.refresh(db_collection)
    return db_collection

def delete_collection(db: Session, collection_id: int) -> bool:
    """Delete a collection"""
    db_collection = get_collection(db, collection_id)
    if db_collection:
        db.delete(db_collection)
        db.commit()
        return True
    return False

def grant_collection_access(db: Session, user_id: int, collection_id: int) -> bool:
    """Grant a user access to a collection"""
    user = get_user(db, user_id)
    collection = get_collection(db, collection_id)
    if user and collection:
        if collection not in user.allowed_collections:
            user.allowed_collections.append(collection)
            db.commit()
        return True
    return False

def revoke_collection_access(db: Session, user_id: int, collection_id: int) -> bool:
    """Revoke a user's access to a collection"""
    user = get_user(db, user_id)
    collection = get_collection(db, collection_id)
    if user and collection:
        if collection in user.allowed_collections:
            user.allowed_collections.remove(collection)
            db.commit()
        return True
    return False

# Document CRUD operations
def create_document(db: Session, filename: str, file_path: str, uploaded_by_id: int, collection_id: int,
                    data_type: str = None, game_date=None, team_name: str = None,
                    file_number: int = None, filename_parsed: bool = False) -> models.Document:
    """Create a new document record"""
    db_document = models.Document(
        filename=filename,
        file_path=file_path,
        uploaded_by_id=uploaded_by_id,
        collection_id=collection_id,
        data_type=data_type,
        game_date=game_date,
        team_name=team_name,
        file_number=file_number,
        filename_parsed=filename_parsed
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def get_document(db: Session, document_id: int) -> Optional[models.Document]:
    """Get a document by ID"""
    return db.query(models.Document).filter(models.Document.id == document_id).first()

def get_documents(db: Session, skip: int = 0, limit: int = 100) -> List[models.Document]:
    """Get all documents"""
    return db.query(models.Document).offset(skip).limit(limit).all()

def get_documents_by_collection(db: Session, collection_id: int, skip: int = 0, limit: int = 100,
                                 include_pending_review: bool = False) -> List[models.Document]:
    """Get all documents in a collection"""
    q = db.query(models.Document).filter(models.Document.collection_id == collection_id)
    if not include_pending_review:
        q = q.filter(models.Document.processed != 4)
    return q.offset(skip).limit(limit).all()

def get_user_accessible_documents(db: Session, user: models.User, skip: int = 0, limit: int = 100) -> List[models.Document]:
    """Get all documents the user has access to. Superusers see all; regular users skip pending_review."""
    if user.is_superuser:
        return get_documents(db, skip, limit)

    collection_ids = [c.id for c in user.allowed_collections]
    return db.query(models.Document).filter(
        models.Document.collection_id.in_(collection_ids),
        models.Document.processed != 4
    ).offset(skip).limit(limit).all()

def get_documents_pending_review(db: Session) -> List[models.Document]:
    """Get all documents awaiting admin review (status=4)"""
    return db.query(models.Document).filter(models.Document.processed == 4).all()

def approve_document(db: Session, document_id: int) -> Optional[models.Document]:
    """Set document status to completed (2), making it visible to regular users"""
    return update_document_status(db, document_id, 2)

def update_document_status(db: Session, document_id: int, status: int) -> Optional[models.Document]:
    """Update document processing status"""
    db_document = get_document(db, document_id)
    if db_document:
        db_document.processed = status
        db.commit()
        db.refresh(db_document)
    return db_document

def delete_document(db: Session, document_id: int) -> bool:
    """Delete a document and its associated tables"""
    db_document = get_document(db, document_id)
    if db_document:
        db.delete(db_document)
        db.commit()
        return True
    return False

# Table CRUD operations
def create_table(db: Session, table_data: dict, document_id: int) -> models.ExtractedTable:
    """Create a new extracted table"""
    db_table = models.ExtractedTable(
        document_id=document_id,
        table_number=table_data["table_number"],
        rows=table_data["rows"],
        columns=table_data["columns"],
        confidence=table_data["confidence"]
    )
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
    return db_table

def get_table(db: Session, table_id: int) -> Optional[models.ExtractedTable]:
    """Get a table by ID"""
    return db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()

def get_tables_by_document(db: Session, document_id: int) -> List[models.ExtractedTable]:
    """Get all tables for a document"""
    return db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == document_id).all()

def delete_table(db: Session, table_id: int) -> bool:
    """Delete a table and its cells"""
    db_table = get_table(db, table_id)
    if db_table:
        db.delete(db_table)
        db.commit()
        return True
    return False

# Cell CRUD operations
def create_cell(db: Session, cell_data: dict, table_id: int) -> models.TableCell:
    """Create a new table cell"""
    db_cell = models.TableCell(
        table_id=table_id,
        row_index=cell_data["row_index"],
        column_index=cell_data["column_index"],
        content=cell_data["content"],
        confidence=cell_data.get("confidence")
    )
    db.add(db_cell)
    db.commit()
    db.refresh(db_cell)
    return db_cell

def get_cell(db: Session, cell_id: int) -> Optional[models.TableCell]:
    """Get a cell by ID"""
    return db.query(models.TableCell).filter(models.TableCell.id == cell_id).first()

def get_cells_by_table(db: Session, table_id: int) -> List[models.TableCell]:
    """Get all cells for a table"""
    return db.query(models.TableCell).filter(models.TableCell.table_id == table_id).all()

def update_cell(db: Session, cell_id: int, content: str) -> Optional[models.TableCell]:
    """Update cell content"""
    db_cell = get_cell(db, cell_id)
    if db_cell:
        db_cell.content = content
        db.commit()
        db.refresh(db_cell)
    return db_cell

def delete_cell(db: Session, cell_id: int) -> bool:
    """Delete a cell"""
    db_cell = get_cell(db, cell_id)
    if db_cell:
        db.delete(db_cell)
        db.commit()
        return True
    return False

# Backup CRUD operations
def create_backup_record(db: Session, filename: str, local_path: str = None, s3_key: str = None,
                         s3_bucket: str = None, size_bytes: int = None, status: str = "success",
                         error_message: str = None) -> models.Backup:
    """Create a backup history record"""
    db_backup = models.Backup(
        filename=filename,
        local_path=local_path,
        s3_key=s3_key,
        s3_bucket=s3_bucket,
        size_bytes=size_bytes,
        status=status,
        error_message=error_message
    )
    db.add(db_backup)
    db.commit()
    db.refresh(db_backup)
    return db_backup

def list_backups(db: Session, skip: int = 0, limit: int = 50) -> List[models.Backup]:
    """List backup history, most recent first"""
    return db.query(models.Backup).order_by(models.Backup.created_at.desc()).offset(skip).limit(limit).all()
