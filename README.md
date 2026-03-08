# Baseball Stats OCR Extractor

A powerful multi-user web application for extracting baseball statistics from screenshots using OCR technology. Features role-based access control, collection management, and cloud deployment support.

Perfect for teams that need to digitize baseball statistics from images, PDFs, or screenshots with controlled access to different datasets.

## Features

### Core Functionality
- **Intelligent OCR Processing**: Automatically extract tables from screenshots using Tesseract OCR + img2table
- **Table Structure Recognition**: Detect and preserve table structure (rows, columns, cells)
- **Editable Database**: Store and edit extracted data in PostgreSQL
- **Confidence Scores**: View OCR accuracy metrics for quality assessment
- **Background Processing**: Asynchronous OCR processing with status tracking

### Multi-User & Security
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Superuser (admin) and regular user roles
- **Collection Management**: Organize documents into collections (e.g., "2024 Season", "Player Stats")
- **Granular Permissions**: Admin controls which users can access which collections
- **Secure Passwords**: Bcrypt password hashing

### Cloud-Ready
- **Supabase Integration**: Hosted PostgreSQL database
- **Render Deployment**: One-click deploy to Render.com
- **Environment Configuration**: Easy setup with environment variables
- **Production-Ready**: CORS, security headers, and best practices built-in

## Quick Start

### Option 1: Cloud Deployment (Recommended)

Deploy to the cloud in minutes:

1. **Set up Supabase** (free PostgreSQL database)
2. **Deploy to Render** (free hosting)
3. **Create admin account**
4. **Start uploading!**

👉 **[Follow the Deployment Guide](DEPLOYMENT.md)**

### Option 2: Local Development

```bash
# 1. Clone and setup
git clone <your-repo-url>
cd mess_around
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up local PostgreSQL
# (See detailed instructions below)

# 4. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 5. Run the application
python main.py

# 6. Visit http://localhost:8000/docs for API documentation
```

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL (Supabase or self-hosted)
- **Authentication**: JWT with python-jose
- **OCR Engine**: Tesseract OCR + img2table
- **ORM**: SQLAlchemy
- **Deployment**: Render.com (or any Python hosting)

## Architecture

```
├── backend/
│   ├── __init__.py
│   ├── auth.py           # JWT authentication & authorization
│   ├── crud.py           # Database operations
│   ├── database.py       # Database configuration
│   ├── models.py         # SQLAlchemy models
│   ├── ocr_processor.py  # OCR and table extraction
│   └── schemas.py        # Pydantic schemas
├── static/               # Frontend assets (CSS, JS)
├── templates/            # HTML templates
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── render.yaml          # Render deployment config
├── render-build.sh      # Build script for Render
└── DEPLOYMENT.md        # Cloud deployment guide
```

## Database Schema

### Core Tables

**users** - User accounts and authentication
- Stores email, username, hashed password
- `is_superuser` flag for admin privileges
- Tracks last login and account status

**collections** - Groupings of related documents
- Organize by season, team, player, etc.
- Admin-created and managed
- Example: "2024 Season Stats", "Historical Data"

**documents** - Uploaded screenshot files
- Links to uploader and collection
- Processing status tracking
- File path and metadata

**extracted_tables** - Metadata about detected tables
- Rows, columns, confidence score
- Links to source document

**table_cells** - Individual cell data
- Row/column position
- Extracted text content
- Per-cell confidence score

**user_collection_permissions** - Access control
- Many-to-many relationship
- Admin grants users access to specific collections

## User Roles & Permissions

### Superuser (Admin)
- Create/manage collections
- Grant/revoke user access to collections
- View all documents and data
- Manage user accounts
- Upload to any collection

### Regular User
- Register own account
- Access only assigned collections
- Upload documents to authorized collections
- Edit data in authorized collections
- Cannot see other collections

## API Overview

### Authentication
```bash
POST /api/auth/register          # Register new user
POST /api/auth/login             # Login (get JWT token)
GET  /api/auth/me                # Get current user info
```

### Collections (User: view assigned, Admin: full CRUD)
```bash
GET    /api/collections          # List accessible collections
POST   /api/collections          # Create collection (admin)
GET    /api/collections/{id}     # View collection details
PUT    /api/collections/{id}     # Update collection (admin)
DELETE /api/collections/{id}     # Delete collection (admin)
```

### Documents
```bash
POST   /api/upload               # Upload screenshot for OCR
GET    /api/documents            # List accessible documents
GET    /api/documents/{id}       # Get document with tables
DELETE /api/documents/{id}       # Delete document (owner/admin)
```

### Tables & Cells
```bash
GET    /api/tables/{id}          # Get table details
PUT    /api/cells/{id}           # Update cell content
DELETE /api/tables/{id}          # Delete table
```

### Admin
```bash
GET    /api/admin/users          # List all users
PUT    /api/admin/users/{id}     # Update user
DELETE /api/admin/users/{id}     # Delete user
POST   /api/admin/permissions/grant   # Grant collection access
POST   /api/admin/permissions/revoke  # Revoke collection access
```

👉 **[View Full API Documentation](API_GUIDE.md)**

## Local Development Setup

### Prerequisites

1. **Python 3.11+**
2. **PostgreSQL 12+**
3. **Tesseract OCR**

### Install Tesseract

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y tesseract-ocr libtesseract-dev
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
Download from [Tesseract GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

### Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download from [PostgreSQL.org](https://www.postgresql.org/download/)

### Set Up Local Database

```bash
# Access PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE baseball_ocr;
CREATE USER ocr_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE baseball_ocr TO ocr_user;
\q
```

### Configure Application

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

Update `.env`:
```env
DATABASE_URL=postgresql://ocr_user:secure_password@localhost:5432/baseball_ocr
SECRET_KEY=<generate with: openssl rand -hex 32>
INIT_SECRET=<choose a secret for first-time setup>
UPLOAD_DIR=./uploads
```

### Run the Application

```bash
# Activate virtual environment
source venv/bin/activate

# Run server
python main.py

# Or with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- **API Docs**: http://localhost:8000/docs
- **App**: http://localhost:8000

### Create First Admin User

```bash
curl -X POST "http://localhost:8000/api/init/create-superuser?secret=YOUR_INIT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin",
    "password": "SecurePassword123!",
    "full_name": "Admin User"
  }'
```

## Usage Example

### 1. Admin Creates Collection

```python
import requests

# Login as admin
resp = requests.post("http://localhost:8000/api/auth/login",
    data={"username": "admin", "password": "SecurePassword123!"})
admin_token = resp.json()["access_token"]

headers = {"Authorization": f"Bearer {admin_token}"}

# Create collection
resp = requests.post("http://localhost:8000/api/collections",
    headers=headers,
    json={"name": "2024 Season Stats", "description": "Current season"})
collection = resp.json()
```

### 2. User Registers

```python
# User registers
requests.post("http://localhost:8000/api/auth/register",
    json={
        "email": "coach@example.com",
        "username": "coach1",
        "password": "Password123!",
        "full_name": "Coach Smith"
    })
```

### 3. Admin Grants Access

```python
# Admin grants user access to collection
requests.post("http://localhost:8000/api/admin/permissions/grant",
    headers=headers,
    json={"user_id": 2, "collection_id": 1})
```

### 4. User Uploads & Extracts Stats

```python
# User logs in
resp = requests.post("http://localhost:8000/api/auth/login",
    data={"username": "coach1", "password": "Password123!"})
user_token = resp.json()["access_token"]

user_headers = {"Authorization": f"Bearer {user_token}"}

# Upload screenshot
with open("batting_stats.png", "rb") as f:
    resp = requests.post("http://localhost:8000/api/upload",
        headers=user_headers,
        params={"collection_id": 1},
        files={"file": f})

doc_id = resp.json()["id"]

# Wait for processing, then get results
resp = requests.get(f"http://localhost:8000/api/documents/{doc_id}",
    headers=user_headers)

document = resp.json()
for table in document["tables"]:
    print(f"Table {table['table_number']}: {table['rows']}x{table['columns']}")
    for cell in table["cells"][:5]:  # First 5 cells
        print(f"  [{cell['row_index']}, {cell['column_index']}]: {cell['content']}")
```

## Deployment

### Cloud Deployment (Supabase + Render)

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete step-by-step instructions.

**Quick Summary:**
1. Create Supabase project → Get DATABASE_URL
2. Push code to GitHub
3. Connect Render to GitHub repo
4. Set environment variables in Render
5. Deploy!

Free tier includes:
- Supabase: 500MB database, 1GB files
- Render: 750 hours/month

### Other Deployment Options

- **AWS**: EC2 + RDS PostgreSQL
- **Google Cloud**: Cloud Run + Cloud SQL
- **DigitalOcean**: App Platform + Managed PostgreSQL
- **Heroku**: Heroku + Heroku Postgres
- **Self-hosted**: Any VPS with Docker

## Troubleshooting

### Tesseract Not Found
```bash
# Linux: Install with apt
sudo apt-get install tesseract-ocr

# Verify installation
tesseract --version
```

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U ocr_user -d baseball_ocr
```

### Poor OCR Results
- Use high-resolution images (300 DPI minimum)
- Ensure good contrast
- Avoid blurry or skewed images
- Use clear fonts (sans-serif works best)

### Token Expired
- Tokens last 7 days by default
- Login again to get a new token
- Adjust `ACCESS_TOKEN_EXPIRE_MINUTES` in `backend/auth.py`

## Roadmap

- [ ] Web-based admin dashboard UI
- [ ] Export tables to CSV/Excel
- [ ] Batch upload multiple images
- [ ] Image preprocessing (rotate, crop, enhance)
- [ ] Support for additional languages
- [ ] Data visualization charts
- [ ] Audit logging
- [ ] Email notifications
- [ ] Mobile app
- [ ] Cloud storage integration (S3, R2)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - See LICENSE file

## Support

- **Documentation**: Check `/docs` endpoint for API reference
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **API Guide**: See [API_GUIDE.md](API_GUIDE.md)
- **Issues**: Open an issue on GitHub

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - Open source OCR engine
- [img2table](https://github.com/xavctn/img2table) - Table detection library
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [Render](https://render.com/) - Cloud application platform

---

Made with ❤️ for baseball fans and data enthusiasts
