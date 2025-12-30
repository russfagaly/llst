from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_date: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# Collection schemas
class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionResponse(CollectionBase):
    id: int
    created_by_id: Optional[int]
    created_date: datetime

    class Config:
        from_attributes = True

class CollectionWithUsersResponse(CollectionResponse):
    authorized_users: List[UserResponse] = []

    class Config:
        from_attributes = True

class UserPermission(BaseModel):
    user_id: int
    collection_id: int

# Document schemas
class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    file_path: str
    collection_id: int

class DocumentResponse(DocumentBase):
    id: int
    upload_date: datetime
    processed: int
    uploaded_by_id: int
    collection_id: int

    class Config:
        from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    collection: Optional[CollectionResponse] = None

    class Config:
        from_attributes = True

# Table Cell schemas
class TableCellBase(BaseModel):
    row_index: int
    column_index: int
    content: Optional[str] = None
    confidence: Optional[float] = None

class TableCellCreate(TableCellBase):
    table_id: int

class TableCellUpdate(BaseModel):
    content: Optional[str] = None

class TableCellResponse(TableCellBase):
    id: int
    table_id: int

    class Config:
        from_attributes = True

# Extracted Table schemas
class ExtractedTableBase(BaseModel):
    table_number: int
    rows: Optional[int] = None
    columns: Optional[int] = None
    confidence: Optional[float] = None

class ExtractedTableCreate(ExtractedTableBase):
    document_id: int

class ExtractedTableResponse(ExtractedTableBase):
    id: int
    document_id: int
    extraction_date: datetime
    cells: List[TableCellResponse] = []

    class Config:
        from_attributes = True

class DocumentWithTablesResponse(DocumentDetailResponse):
    tables: List[ExtractedTableResponse] = []

    class Config:
        from_attributes = True
