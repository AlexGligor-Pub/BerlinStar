import boto3
import logging
import os
import uuid
from botocore.client import Config
from fastapi import HTTPException, UploadFile

log = logging.getLogger("berlinstar.storage")


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL", "https://nbg1.your-objectstorage.com"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
    )


def upload_image(account_id: int, folder: str, file_bytes: bytes, content_type: str) -> str:
    bucket     = os.getenv("S3_BUCKET", "professorprimedev")
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    key = f"accounts/{account_id}/{folder}/{uuid.uuid4().hex}.{ext}"
    _s3_client().put_object(Bucket=bucket, Key=key, Body=file_bytes, ContentType=content_type, ACL="public-read")
    return f"{public_url}/{key}"


# backward-compat alias (unused externally but keeps imports clean)
def upload_employee_image(file_bytes: bytes, content_type: str) -> str:
    return upload_image(0, "employees", file_bytes, content_type)


async def validate_image(file: UploadFile, max_mb: int = 5) -> bytes:
    """Valideaza tipul si dimensiunea imaginii, returneaza bytes-ii fisierului."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Fisierul trebuie sa fie o imagine.")
    data = await file.read()
    if len(data) > max_mb * 1024 * 1024:
        raise HTTPException(400, f"Imaginea nu poate depasi {max_mb}MB.")
    return data


def upload_global_image(key: str, file_bytes: bytes, content_type: str) -> str:
    """Upload a system-level image to a fixed S3 key (overwrites, no UUID)."""
    bucket     = os.getenv("S3_BUCKET", "professorprimedev")
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    object_key = f"global/hotel_anvelope/{key}.{ext}"
    _s3_client().put_object(Bucket=bucket, Key=object_key, Body=file_bytes, ContentType=content_type, ACL="public-read")
    return f"{public_url}/{object_key}"


def delete_image_by_url(url: str) -> None:
    """Delete an object from S3 given its full public URL. Silently ignores errors."""
    try:
        public_url = os.getenv("S3_PUBLIC_URL", "").rstrip("/")
        bucket = os.getenv("S3_BUCKET", "professorprimedev")
        if not public_url or not url.startswith(public_url + "/"):
            return
        key = url[len(public_url) + 1:]
        _s3_client().delete_object(Bucket=bucket, Key=key)
    except Exception as exc:
        log.warning("delete_image_by_url failed for %s: %s", url, exc)
