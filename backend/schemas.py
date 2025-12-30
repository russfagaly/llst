from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Document schemas
class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    file_path: str

class DocumentResponse(DocumentBase):
    id: int
    upload_date: datetime
    processed: int

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

class DocumentWithTablesResponse(DocumentResponse):
    tables: List[ExtractedTableResponse] = []

    class Config:
        from_attributes = True
