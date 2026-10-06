import asyncio
import boto3
import logging
import os
import re
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


# Folderele in care `upload_image` pune imaginile unui cont. Bucket-ul e comun
# cu arhiva eFactura (accounts/{id}/efactura/...), facturile de abonament si
# imaginile globale, deci orice alta cheie e in afara acestui modul.
_IMAGE_FOLDERS = (
    "items",
    "departments",
    "employees",
    "locations",
    "companies/logos",
    "companies/backgrounds",
    "accounts/avatars",
)
_IMAGE_NAME_RE = re.compile(r"[A-Za-z0-9_-]+\.[A-Za-z0-9]+")


def own_image_key(url: str | None, account_id: int | None) -> str | None:
    """Cheia S3 a unei imagini, doar daca URL-ul e in bucket-ul nostru si sub
    accounts/{account_id}/<folder de imagini>/. Altfel None: URL extern, cale
    locala veche, fisierul altui cont sau un obiect care nu e imagine."""
    if not url or not isinstance(url, str):
        return None
    if not isinstance(account_id, int) or isinstance(account_id, bool):
        return None
    public_url = os.getenv("S3_PUBLIC_URL", "https://professorprimedev.nbg1.your-objectstorage.com").rstrip("/")
    if not public_url or not url.startswith(public_url + "/"):
        return None
    key = url[len(public_url) + 1:]
    for folder in _IMAGE_FOLDERS:
        prefix = f"accounts/{account_id}/{folder}/"
        if key.startswith(prefix) and _IMAGE_NAME_RE.fullmatch(key[len(prefix):]):
            return key
    return None


def check_image_ref(value: str | None, current: str | None, account_id: int) -> None:
    """Valideaza un camp de imagine venit in body (image_path, logo_path...).

    Imaginile se schimba prin endpoint-urile de upload; din body acceptam doar
    golirea, valoarea deja salvata (formularele o trimit inapoi, inclusiv in
    formate vechi) sau un URL din folderele de imagini ale contului. Orice
    altceva ar permite afisarea, si la urmatorul upload stergerea, fisierului
    altui cont.
    """
    if value is None or not value.strip() or value == current:
        return
    if own_image_key(value, account_id) is None:
        raise HTTPException(400, "Adresa imaginii nu este permisa. Incarca imaginea din aplicatie.")


async def delete_image_by_url(url: str, account_id: int | None = None) -> None:
    """Sterge din S3 imaginea de la URL-ul public dat, doar daca e a contului.

    Nu arunca niciodata: un refuz sau o eroare S3 se logheaza si atat, ca sa
    nu stricam salvarea care tocmai a reusit. Fara `account_id` nu stergem
    nimic (nu avem cum verifica al cui e fisierul).
    """
    try:
        # Fara S3_PUBLIC_URL configurat nu stergem nimic (comportamentul de pana acum).
        if not url or not os.getenv("S3_PUBLIC_URL", "").strip():
            return
        key = own_image_key(url, account_id)
        if key is None:
            log.warning("delete_image_by_url: refuzat pentru contul %s: %s", account_id, url)
            return
        bucket = os.getenv("S3_BUCKET", "professorprimedev")
        await asyncio.to_thread(_delete_object_sync, bucket, key)
    except Exception as exc:
        log.error("delete_image_by_url failed for %s: %s", url, exc)
