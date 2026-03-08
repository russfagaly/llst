from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, Boolean, Table, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

# Association table for user-collection permissions
user_collection_permissions = Table(
    'user_collection_permissions',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('collection_id', Integer, ForeignKey('collections.id'), primary_key=True),
    Column('granted_date', DateTime, default=datetime.utcnow)
)

class User(Base):
    """Stores user accounts and authentication data"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_date = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    # Relationships
    uploaded_documents = relationship("Document", back_populates="uploaded_by_user")
    allowed_collections = relationship("Collection", secondary=user_collection_permissions, back_populates="authorized_users")

class Collection(Base):
    """Stores collections/groups of documents (e.g., baseball stats categories)"""
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_date = Column(DateTime, default=datetime.utcnow)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    documents = relationship("Document", back_populates="collection", cascade="all, delete-orphan")
    authorized_users = relationship("User", secondary=user_collection_permissions, back_populates="allowed_collections")

class Document(Base):
    """Stores uploaded screenshot/image documents"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    processed = Column(Integer, default=0)  # 0=pending, 1=processing, 2=completed, 3=failed, 4=pending_review
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False)

    # Filename metadata (parsed from structured filenames)
    data_type = Column(String(100))       # e.g. "Hitting", "Pitching"
    game_date = Column(Date)              # parsed from filename
    team_name = Column(String(100))       # e.g. "Brewers"
    file_number = Column(Integer)         # sequence number from filename
    filename_parsed = Column(Boolean, default=False)

    # Relationships
    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")
    uploaded_by_user = relationship("User", back_populates="uploaded_documents")
    collection = relationship("Collection", back_populates="documents")

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

class Backup(Base):
    """Tracks database backup history"""
    __tablename__ = "backups"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    local_path = Column(String(512))
    s3_key = Column(String(512))
    s3_bucket = Column(String(255))
    size_bytes = Column(Integer)
    status = Column(String(20), nullable=False)  # "success" or "failed"
    error_message = Column(Text)
