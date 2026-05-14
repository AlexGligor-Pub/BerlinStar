import asyncio
import boto3
import logging
import os
import uuid
from botocore.client import Config
from fastapi import HTTPException, UploadFile

log = logging.getLogger("berlinstar.storage")

# Whitelist explicit de MIME types acceptate pentru imagini (nu acceptam SVG = risc XSS)
_ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}

# Magic bytes pentru sniff la nivel de continut (nu doar pe header-ul client-ului)
_MAGIC_PREFIXES = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),  # WEBP: RIFF....WEBP
)


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL", "https://nbg1.your-objectstorage.com"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
    )


def _sniff_mime(data: bytes) -> str | None:
    for prefix, mime in _MAGIC_PREFIXES:
        if data.startswith(prefix):
            if mime == "image/webp" and not (len(data) >= 12 and data[8:12] == b"WEBP"):
                continue
            return mime
    return None


def _put_object_sync(bucket: str, key: str, body: bytes, content_type: str) -> None:
    _s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
        ACL="public-read",
    )


def _delete_object_sync(bucket: str, key: str) -> None:
    _s3_client().delete_object(Bucket=bucket, Key=key)


async def upload_image(account_id: int, folder: str, file_bytes: bytes, content_type: str) -> str:
    bucket     = os.getenv("S3_BUCKET", "professorprimedev")
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    key = f"accounts/{account_id}/{folder}/{uuid.uuid4().hex}.{ext}"
    await asyncio.to_thread(_put_object_sync, bucket, key, file_bytes, content_type)
    return f"{public_url}/{key}"


# backward-compat alias (unused externally but keeps imports clean)
async def upload_employee_image(file_bytes: bytes, content_type: str) -> str:
    return await upload_image(0, "employees", file_bytes, content_type)


async def validate_image(file: UploadFile, max_mb: int = 5) -> bytes:
    """Valideaza tipul si dimensiunea imaginii, returneaza bytes-ii fisierului.

    - Limita marime aplicata in timpul citirii (nu citim mai mult de max_mb).
    - Sniff la magic bytes (nu trust pe content_type client-supplied).
    - SVG explicit interzis (vector XSS pe domeniu propriu).
    """
    declared = (file.content_type or "").lower()
    if declared not in _ALLOWED_IMAGE_MIMES:
        raise HTTPException(400, "Tip de fisier nepermis. Acceptam doar JPEG/PNG/WEBP/GIF.")

    max_bytes = max_mb * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(400, f"Imaginea nu poate depasi {max_mb}MB.")
        chunks.append(chunk)
    data = b"".join(chunks)

    sniffed = _sniff_mime(data)
    if sniffed is None or sniffed not in _ALLOWED_IMAGE_MIMES:
        raise HTTPException(400, "Continutul fisierului nu este o imagine valida.")
    return data


async def upload_global_image(key: str, file_bytes: bytes, content_type: str, folder: str = "hotel_anvelope") -> str:
    """Upload a system-level image to a fixed S3 key (overwrites, no UUID)."""
    bucket     = os.getenv("S3_BUCKET", "professorprimedev")
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    object_key = f"global/{folder}/{key}.{ext}"
    await asyncio.to_thread(_put_object_sync, bucket, object_key, file_bytes, content_type)
    return f"{public_url}/{object_key}"


async def delete_image_by_url(url: str) -> None:
    """Delete an object from S3 given its full public URL."""
    try:
        public_url = os.getenv("S3_PUBLIC_URL", "").rstrip("/")
        bucket = os.getenv("S3_BUCKET", "professorprimedev")
        if not public_url or not url.startswith(public_url + "/"):
            return
        key = url[len(public_url) + 1:]
        await asyncio.to_thread(_delete_object_sync, bucket, key)
    except Exception as exc:
        log.error("delete_image_by_url failed for %s: %s", url, exc)
