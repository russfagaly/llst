from sqlalchemy.orm import Session
from typing import List, Optional
from backend import models, schemas

# Document CRUD operations
def create_document(db: Session, filename: str, file_path: str) -> models.Document:
    """Create a new document record"""
    db_document = models.Document(filename=filename, file_path=file_path)
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
