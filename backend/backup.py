"""Database backup module: pg_dump, S3 upload, local retention cleanup."""
import os
import subprocess
import glob as glob_module
from datetime import datetime, timedelta
from pathlib import Path

BACKUP_LOCAL_DIR = Path(os.getenv("BACKUP_LOCAL_DIR", "./backups"))
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
AWS_S3_REGION = os.getenv("AWS_S3_REGION", "us-east-1")
DATABASE_URL = os.getenv("DATABASE_URL", "")


def run_backup(db) -> dict:
    """
    Run a full database backup:
    1. pg_dump to local file
    2. Upload to S3 (if configured)
    3. Delete local files older than retention days
    4. Record result in DB

    Returns a dict with backup details.
    """
    from backend import crud

    BACKUP_LOCAL_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"{timestamp}.dump"
    local_path = BACKUP_LOCAL_DIR / filename

    size_bytes = None
    s3_key = None
    s3_bucket = None
    status = "failed"
    error_message = None

    try:
        # 1. pg_dump
        result = subprocess.run(
            ["pg_dump", DATABASE_URL, "-Fc", "-f", str(local_path)],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {result.stderr}")

        size_bytes = local_path.stat().st_size

        # 2. Upload to S3 (optional — only if bucket is configured)
        if AWS_S3_BUCKET:
            try:
                import boto3
                s3_key = f"backups/{filename}"
                s3_bucket = AWS_S3_BUCKET
                s3 = boto3.client("s3", region_name=AWS_S3_REGION)
                s3.upload_file(str(local_path), s3_bucket, s3_key)
            except Exception as s3_err:
                # S3 failure is non-fatal — we still have the local backup
                print(f"[backup] S3 upload failed (local backup preserved): {s3_err}")
                s3_key = None
                s3_bucket = None

        # 3. Clean up old local files
        _cleanup_old_backups()

        status = "success"

    except Exception as e:
        error_message = str(e)
        print(f"[backup] Backup failed: {e}")

    # 4. Record in DB
    record = crud.create_backup_record(
        db=db,
        filename=filename,
        local_path=str(local_path) if local_path.exists() else None,
        s3_key=s3_key,
        s3_bucket=s3_bucket,
        size_bytes=size_bytes,
        status=status,
        error_message=error_message
    )

    return {
        "id": record.id,
        "filename": filename,
        "status": status,
        "size_bytes": size_bytes,
        "s3_key": s3_key,
        "error_message": error_message
    }


def _cleanup_old_backups():
    """Delete local backup files older than BACKUP_RETENTION_DAYS."""
    cutoff = datetime.utcnow() - timedelta(days=BACKUP_RETENTION_DAYS)
    for path in BACKUP_LOCAL_DIR.glob("*.dump"):
        try:
            mtime = datetime.utcfromtimestamp(path.stat().st_mtime)
            if mtime < cutoff:
                path.unlink()
                print(f"[backup] Deleted old backup: {path.name}")
        except Exception as e:
            print(f"[backup] Failed to delete {path}: {e}")
