# API Quick Start Guide

This guide shows you how to use the Baseball Stats OCR API with example requests.

## Base URL

- **Local**: `http://localhost:8000`
- **Production**: `https://your-app.onrender.com`

## Authentication

All endpoints except `/api/auth/register` and `/api/auth/login` require authentication.

### Get an Access Token

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your_username&password=your_password"
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Use the Token

Include the token in the `Authorization` header for all requests:

```bash
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## Common Workflows

### 1. First-Time Setup (Admin)

#### Step 1: Create Superuser (One-time only)

```bash
curl -X POST "http://localhost:8000/api/init/create-superuser?secret=your-init-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin",
    "password": "SecurePassword123!",
    "full_name": "Admin User"
  }'
```

#### Step 2: Login as Admin

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type": application/x-www-form-urlencoded" \
  -d "username=admin&password=SecurePassword123!"
```

Save the `access_token` from the response!

#### Step 3: Create Collections

```bash
curl -X POST "http://localhost:8000/api/collections" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024 Season Stats",
    "description": "Baseball statistics from the 2024 season"
  }'
```

**Response:**
```json
{
  "name": "2024 Season Stats",
  "description": "Baseball statistics from the 2024 season",
  "id": 1,
  "created_by_id": 1,
  "created_date": "2024-01-15T10:30:00"
}
```

### 2. User Registration and Access (Regular Users)

#### Step 1: User Registers

```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "username": "player1",
    "password": "UserPassword123!",
    "full_name": "John Player"
  }'
```

#### Step 2: Admin Grants Collection Access

```bash
# Admin needs to grant access
curl -X POST "http://localhost:8000/api/admin/permissions/grant" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "collection_id": 1
  }'
```

### 3. Upload and Process Baseball Stats

#### Upload a Screenshot

```bash
curl -X POST "http://localhost:8000/api/upload?collection_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/baseball_stats.png"
```

**Response:**
```json
{
  "filename": "baseball_stats.png",
  "id": 1,
  "upload_date": "2024-01-15T11:00:00",
  "processed": 0,
  "uploaded_by_id": 2,
  "collection_id": 1
}
```

**Processing Status:**
- `0` = Pending
- `1` = Processing
- `2` = Completed
- `3` = Failed

#### Check Processing Status

```bash
curl -X GET "http://localhost:8000/api/documents/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### View Extracted Tables

Once `processed` is `2`, you can view the extracted tables:

```bash
curl -X GET "http://localhost:8000/api/documents/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "filename": "baseball_stats.png",
  "id": 1,
  "upload_date": "2024-01-15T11:00:00",
  "processed": 2,
  "uploaded_by_id": 2,
  "collection_id": 1,
  "collection": {
    "name": "2024 Season Stats",
    "description": "Baseball statistics from the 2024 season",
    "id": 1
  },
  "tables": [
    {
      "table_number": 0,
      "rows": 10,
      "columns": 5,
      "confidence": 0.92,
      "id": 1,
      "document_id": 1,
      "extraction_date": "2024-01-15T11:01:30",
      "cells": [
        {
          "row_index": 0,
          "column_index": 0,
          "content": "Player Name",
          "confidence": 0.95,
          "id": 1,
          "table_id": 1
        },
        {
          "row_index": 0,
          "column_index": 1,
          "content": "Batting Avg",
          "confidence": 0.93,
          "id": 2,
          "table_id": 1
        }
      ]
    }
  ]
}
```

### 4. Edit Extracted Data

#### Update a Cell

```bash
curl -X PUT "http://localhost:8000/api/cells/2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Batting Average"
  }'
```

### 5. Admin: Manage Users and Permissions

#### List All Users

```bash
curl -X GET "http://localhost:8000/api/admin/users" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### View User Details

```bash
curl -X GET "http://localhost:8000/api/admin/users/2" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Update User

```bash
curl -X PUT "http://localhost:8000/api/admin/users/2" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

#### Grant Collection Access

```bash
curl -X POST "http://localhost:8000/api/admin/permissions/grant" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "collection_id": 1
  }'
```

#### Revoke Collection Access

```bash
curl -X POST "http://localhost:8000/api/admin/permissions/revoke" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "collection_id": 1
  }'
```

### 6. Manage Collections

#### List Your Collections

```bash
curl -X GET "http://localhost:8000/api/collections" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Collection Details (with authorized users)

```bash
curl -X GET "http://localhost:8000/api/collections/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create Collection (Admin only)

```bash
curl -X POST "http://localhost:8000/api/collections" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2023 Historical Stats",
    "description": "Historical baseball data"
  }'
```

#### Update Collection (Admin only)

```bash
curl -X PUT "http://localhost:8000/api/collections/1" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description"
  }'
```

#### Delete Collection (Admin only)

```bash
curl -X DELETE "http://localhost:8000/api/collections/1" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 7. Manage Documents

#### List Documents in a Collection

```bash
curl -X GET "http://localhost:8000/api/documents?collection_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### List All Your Accessible Documents

```bash
curl -X GET "http://localhost:8000/api/documents" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Delete Document (Owner or Admin)

```bash
curl -X DELETE "http://localhost:8000/api/documents/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8. Manage Tables

#### Get Table Details

```bash
curl -X GET "http://localhost:8000/api/tables/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Delete Table (Owner or Admin)

```bash
curl -X DELETE "http://localhost:8000/api/tables/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Interactive API Documentation

Visit these URLs in your browser for interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```
**Solution**: Check your access token is valid and not expired.

### 403 Forbidden
```json
{
  "detail": "Access denied to this collection"
}
```
**Solution**: You don't have permission. Admin needs to grant access.

### 404 Not Found
```json
{
  "detail": "Document not found"
}
```
**Solution**: Resource doesn't exist or was deleted.

### 400 Bad Request
```json
{
  "detail": "Email already registered"
}
```
**Solution**: Fix the request based on error message.

## Testing with Postman

1. Import the collection:
   - Create a new request
   - Add environment variable `base_url` = `http://localhost:8000`
   - Add environment variable `token` for storing access token

2. Set up authorization:
   - Type: Bearer Token
   - Token: `{{token}}`

3. After login, save the token:
   - In Tests tab:
     ```javascript
     pm.environment.set("token", pm.response.json().access_token);
     ```

## Python Example

```python
import requests

# Base URL
BASE_URL = "http://localhost:8000"

# 1. Login
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    data={"username": "admin", "password": "password123"}
)
token = response.json()["access_token"]

# 2. Set up headers
headers = {"Authorization": f"Bearer {token}"}

# 3. Create a collection
response = requests.post(
    f"{BASE_URL}/api/collections",
    headers=headers,
    json={"name": "2024 Stats", "description": "Season stats"}
)
collection = response.json()

# 4. Upload a file
with open("baseball_stats.png", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/api/upload",
        headers=headers,
        params={"collection_id": collection["id"]},
        files={"file": f}
    )
document = response.json()

# 5. Check status
import time
while True:
    response = requests.get(
        f"{BASE_URL}/api/documents/{document['id']}",
        headers=headers
    )
    doc = response.json()
    if doc["processed"] == 2:  # Completed
        print("Processing complete!")
        print(f"Extracted {len(doc['tables'])} tables")
        break
    elif doc["processed"] == 3:  # Failed
        print("Processing failed")
        break
    time.sleep(2)

# 6. View extracted data
for table in doc["tables"]:
    print(f"\nTable {table['table_number']}: {table['rows']}x{table['columns']}")
    for cell in table["cells"]:
        print(f"  [{cell['row_index']},{cell['column_index']}]: {cell['content']}")
```

## Need Help?

- Check `/docs` for full API specification
- Review error messages carefully
- Verify your access token hasn't expired (tokens last 7 days)
- Ensure you have the right permissions for the collection
