# OCR Table Extractor

A powerful web-based OCR tool that extracts tables from screenshots and builds an editable database from the results. Built with FastAPI, PostgreSQL, and Tesseract OCR.

## Features

- **Upload Screenshots**: Drag & drop or click to upload image files (PNG, JPG, JPEG, BMP, TIFF)
- **Automatic Table Detection**: Intelligent detection and extraction of tables from images
- **OCR Processing**: Extract text from tables using Tesseract OCR with img2table
- **Editable Database**: Store extracted data in PostgreSQL with full CRUD capabilities
- **Web-based Editor**: Edit extracted table data directly in your browser
- **Real-time Updates**: Monitor processing status with auto-refresh
- **Confidence Scores**: See OCR confidence levels for quality assessment

## Tech Stack

- **Backend**: FastAPI (Python 3.8+)
- **Database**: PostgreSQL
- **OCR Engine**: Tesseract + img2table
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **ORM**: SQLAlchemy

## Prerequisites

1. **Python 3.8+**
2. **PostgreSQL** (version 12 or higher)
3. **Tesseract OCR** installed on your system

### Installing Tesseract

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
sudo apt-get install libtesseract-dev
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
Download the installer from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

### Installing PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download the installer from [PostgreSQL.org](https://www.postgresql.org/download/windows/)

## Installation

1. **Clone the repository:**
```bash
cd /path/to/mess_around
```

2. **Create a virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Set up PostgreSQL database:**
```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE ocr_database;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ocr_database TO your_user;
\q
```

5. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and update the database connection string:
```
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/ocr_database
UPLOAD_DIR=./uploads
```

6. **Create necessary directories:**
```bash
mkdir -p uploads
```

## Usage

1. **Start the application:**
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. **Access the web interface:**
Open your browser and navigate to:
```
http://localhost:8000
```

3. **Upload and process images:**
   - Click the upload box or drag & drop an image containing tables
   - Click "Upload & Process" to start OCR extraction
   - Wait for processing to complete (status will update automatically)
   - Click "View Tables" to see extracted tables
   - Click on a table to edit its contents

## API Documentation

Once the server is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Main Endpoints

#### Upload Document
```http
POST /api/upload
Content-Type: multipart/form-data

file: <image file>
```

#### List Documents
```http
GET /api/documents?skip=0&limit=100
```

#### Get Document with Tables
```http
GET /api/documents/{document_id}
```

#### Update Cell Content
```http
PUT /api/cells/{cell_id}
Content-Type: application/json

{
  "content": "Updated text"
}
```

#### Delete Document
```http
DELETE /api/documents/{document_id}
```

## Project Structure

```
mess_around/
├── backend/
│   ├── __init__.py
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── crud.py              # CRUD operations
│   └── ocr_processor.py     # OCR and table extraction
├── static/
│   ├── styles.css           # CSS styles
│   └── app.js               # Frontend JavaScript
├── templates/
│   └── index.html           # Main HTML page
├── uploads/                 # Uploaded files directory
├── main.py                  # FastAPI application
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables
└── README.md               # This file
```

## Database Schema

### Tables

**documents**
- `id`: Primary key
- `filename`: Original filename
- `file_path`: Path to uploaded file
- `upload_date`: Upload timestamp
- `processed`: Status (0=pending, 1=processing, 2=completed, 3=failed)

**extracted_tables**
- `id`: Primary key
- `document_id`: Foreign key to documents
- `table_number`: Table index in document
- `rows`: Number of rows
- `columns`: Number of columns
- `extraction_date`: Extraction timestamp
- `confidence`: OCR confidence score

**table_cells**
- `id`: Primary key
- `table_id`: Foreign key to extracted_tables
- `row_index`: Row position
- `column_index`: Column position
- `content`: Cell text content
- `confidence`: Cell-level confidence

## Troubleshooting

### Tesseract Not Found
If you get an error about Tesseract not being found:
```python
# Add to your environment or code
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract'  # Linux/Mac
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows
```

### Database Connection Issues
- Ensure PostgreSQL is running: `sudo service postgresql status`
- Check your DATABASE_URL in `.env`
- Verify user permissions in PostgreSQL

### Poor OCR Results
- Use high-resolution images (300 DPI or higher)
- Ensure good contrast between text and background
- Avoid skewed or rotated images
- Use clear, sans-serif fonts when possible

## Future Enhancements

- [ ] Support for multiple languages
- [ ] Batch processing of multiple images
- [ ] Export tables to CSV/Excel
- [ ] Image preprocessing options (rotate, crop, enhance)
- [ ] Table merge and split functionality
- [ ] OCR model selection (Tesseract vs. EasyOCR vs. PaddleOCR)
- [ ] User authentication and multi-user support
- [ ] Cloud storage integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - OCR engine
- [img2table](https://github.com/xavctn/img2table) - Table detection
- [SQLAlchemy](https://www.sqlalchemy.org/) - SQL toolkit and ORM
