from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class Document(Base):
    """Stores uploaded screenshot/image documents"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    processed = Column(Integer, default=0)  # 0=pending, 1=processing, 2=completed, 3=failed

    # Relationships
    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")

class ExtractedTable(Base):
    """Stores metadata about extracted tables from documents"""
    __tablename__ = "extracted_tables"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    table_number = Column(Integer, nullable=False)  # Table index in the document
    rows = Column(Integer)
    columns = Column(Integer)
    extraction_date = Column(DateTime, default=datetime.utcnow)
    confidence = Column(Float)  # OCR confidence score

    # Relationships
    document = relationship("Document", back_populates="tables")
    cells = relationship("TableCell", back_populates="table", cascade="all, delete-orphan")

class TableCell(Base):
    """Stores individual cell data from extracted tables"""
    __tablename__ = "table_cells"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("extracted_tables.id"), nullable=False)
    row_index = Column(Integer, nullable=False)
    column_index = Column(Integer, nullable=False)
    content = Column(Text)
    confidence = Column(Float)  # Cell-level OCR confidence

    # Relationships
    table = relationship("ExtractedTable", back_populates="cells")
