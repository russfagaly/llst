# Deployment Guide - Supabase + Render

This guide will help you deploy your Baseball Stats OCR application to the cloud using Supabase (database) and Render (application hosting).

## Prerequisites

- GitHub account (for code repository)
- Supabase account (free tier available)
- Render account (free tier available)

## Part 1: Set Up Supabase Database

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `baseball-stats-ocr` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to be provisioned

### 2. Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** (gear icon) → **Database**
2. Scroll down to **Connection string** section
3. Select **URI** tab
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you set earlier
6. **Save this connection string** - you'll need it for Render

### 3. Enable Required PostgreSQL Extensions (Optional)

1. In Supabase dashboard, go to **Database** → **Extensions**
2. Search for and enable:
   - `pg_trgm` (for better text search, if needed)

## Part 2: Deploy to Render

### 1. Prepare Your Repository

1. Make sure all your code is committed and pushed to GitHub
2. Your repository should include:
   - `requirements.txt`
   - `main.py`
   - `render.yaml`
   - All backend files

### 2. Create a Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

### 3. Deploy the Application

#### Option A: Using render.yaml (Recommended)

1. In Render dashboard, click **"New"** → **"Blueprint"**
2. Connect your GitHub repository
3. Render will automatically detect `render.yaml`
4. Click **"Apply"**
5. In the environment variables section, add:
   - `DATABASE_URL`: Paste your Supabase connection string
6. Click **"Create Web Service"**

#### Option B: Manual Setup

1. In Render dashboard, click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `baseball-stats-ocr`
   - **Environment**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `DATABASE_URL`: Your Supabase connection string
   - `SECRET_KEY`: Generate with `openssl rand -hex 32`
   - `INIT_SECRET`: A secret phrase for creating first admin
   - `UPLOAD_DIR`: `./uploads`
5. Click **"Create Web Service"**

### 4. Wait for Deployment

- First deployment takes 3-5 minutes
- Watch the logs for any errors
- Once deployed, you'll get a URL like: `https://baseball-stats-ocr.onrender.com`

## Part 3: Initialize Your Application

### 1. Create Your First Superuser (Admin Account)

Once deployed, you need to create an admin account:

```bash
# Using curl (replace YOUR_RENDER_URL and YOUR_INIT_SECRET)
curl -X POST "https://YOUR_RENDER_URL/api/init/create-superuser" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "username": "admin",
    "password": "YourStrongPassword123!",
    "full_name": "Admin User",
    "secret": "YOUR_INIT_SECRET"
  }'
```

Or use a tool like Postman/Insomnia:
- **URL**: `https://YOUR_RENDER_URL/api/init/create-superuser?secret=YOUR_INIT_SECRET`
- **Method**: POST
- **Body** (JSON):
  ```json
  {
    "email": "your@email.com",
    "username": "admin",
    "password": "YourStrongPassword123!",
    "full_name": "Admin User"
  }
  ```

### 2. Log In

```bash
# Get access token
curl -X POST "https://YOUR_RENDER_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=YourStrongPassword123!"
```

You'll receive a response with an access token:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

Save this token! Use it in the `Authorization` header for all API requests:
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

### 3. Create Your First Collection

```bash
curl -X POST "https://YOUR_RENDER_URL/api/collections" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024 Season Stats",
    "description": "Baseball statistics from 2024 season"
  }'
```

### 4. Invite Users and Grant Access

1. **Users register themselves**:
   ```bash
   curl -X POST "https://YOUR_RENDER_URL/api/auth/register" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "username": "player1",
       "password": "UserPassword123!",
       "full_name": "John Doe"
     }'
   ```

2. **You (admin) grant them access to collections**:
   ```bash
   # First, get the user ID from /api/admin/users
   # Then grant access
   curl -X POST "https://YOUR_RENDER_URL/api/admin/permissions/grant" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": 2,
       "collection_id": 1
     }'
   ```

## Part 4: Using the Application

### API Endpoints

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user info

**Collections:**
- `GET /api/collections` - List your accessible collections
- `POST /api/collections` - Create collection (admin only)

**Documents:**
- `POST /api/upload?collection_id=1` - Upload screenshot
- `GET /api/documents?collection_id=1` - List documents in collection
- `GET /api/documents/{id}` - Get document with tables

**Admin:**
- `GET /api/admin/users` - List all users
- `POST /api/admin/permissions/grant` - Grant collection access
- `POST /api/admin/permissions/revoke` - Revoke collection access

### API Documentation

Visit `https://YOUR_RENDER_URL/docs` for interactive API documentation (Swagger UI).

## Part 5: Monitoring and Maintenance

### View Logs

1. In Render dashboard, go to your web service
2. Click **"Logs"** tab
3. Watch for errors or issues

### Database Management

1. Use Supabase dashboard to:
   - View tables and data
   - Run SQL queries
   - Monitor database usage
2. Go to **Table Editor** to see your data
3. Use **SQL Editor** for advanced queries

### Backups

Supabase free tier includes:
- Automatic daily backups (7 days retention)
- Point-in-time recovery

For production, upgrade to Pro for better backup options.

## Troubleshooting

### Database Connection Issues

1. Check `DATABASE_URL` in Render environment variables
2. Ensure password doesn't have special characters that need URL encoding
3. Verify Supabase project is running (check dashboard)

### Application Won't Start

1. Check Render logs for errors
2. Verify all dependencies in `requirements.txt`
3. Ensure `PORT` environment variable is not set (Render sets this automatically)

### OCR Not Working

1. Check if Tesseract is installed (should be in requirements via pytesseract)
2. For Render, you may need to add a system package:
   - In Render dashboard, add a `render-build.sh` script
   - Install tesseract-ocr via apt

Create `render-build.sh`:
```bash
#!/bin/bash
apt-get update
apt-get install -y tesseract-ocr
pip install -r requirements.txt
```

Update `render.yaml`:
```yaml
buildCommand: ./render-build.sh
```

### File Upload Issues

1. Verify `UPLOAD_DIR` is set correctly
2. Remember: Render's filesystem is ephemeral
3. For production, consider adding cloud storage (S3, Cloudflare R2)

## Security Best Practices

1. **Change default secrets immediately**
   - Generate new `SECRET_KEY`
   - Change `INIT_SECRET` after creating admin

2. **Use strong passwords**
   - Minimum 12 characters
   - Mix of letters, numbers, symbols

3. **Enable HTTPS only** (Render does this by default)

4. **Regularly review user access**
   - Remove inactive users
   - Audit collection permissions

5. **Monitor Supabase logs** for suspicious activity

## Costs

### Free Tier Limits:

**Supabase Free:**
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- Pauses after 1 week of inactivity

**Render Free:**
- 750 hours/month
- Service spins down after 15 min of inactivity
- Spins up on first request (cold start ~30s)

### When to Upgrade:

- More than 500 MB data → Upgrade Supabase ($25/month)
- Need always-on service → Upgrade Render ($7/month)
- More than 1000 users → Consider both upgrades

## Next Steps

1. Build a frontend web interface
2. Add file upload from browser
3. Export tables to CSV/Excel
4. Add email notifications
5. Implement audit logging
6. Add data visualization

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
