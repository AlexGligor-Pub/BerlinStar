from __future__ import annotations
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id
from app.models.global_settings import GlobalSettings
from app.schemas.global_settings import GlobalSettingsRead, MontareRotiImagesRead
from app.utils.storage import validate_image, upload_global_image


_MONTARE_POZITII = {"stanga_fata", "dreapta_fata", "stanga_spate", "dreapta_spate", "rezerva", "nespecificat"}

router = APIRouter()


async def _get_or_create(db: AsyncSession) -> GlobalSettings:
    result = await db.execute(select(GlobalSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = GlobalSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("/hotel-anvelope", response_model=GlobalSettingsRead)
async def get_hotel_images(
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    return await _get_or_create(db)


@router.post("/hotel-cazare-image")
async def upload_cazare_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    data = await validate_image(file)
    url = upload_global_image("cazare", data, file.content_type)
    settings = await _get_or_create(db)
    settings.hotel_cazare_image_path = url
    await db.commit()
    return {"url": url}


@router.post("/hotel-scoatere-image")
async def upload_scoatere_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    data = await validate_image(file)
    url = upload_global_image("scoatere", data, file.content_type)
    settings = await _get_or_create(db)
    settings.hotel_scoatere_image_path = url
    await db.commit()
    return {"url": url}


@router.post("/hotel-montare-image")
async def upload_montare_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    data = await validate_image(file)
    url = upload_global_image("montare", data, file.content_type)
    settings = await _get_or_create(db)
    settings.hotel_montare_image_path = url
    await db.commit()
    return {"url": url}


@router.get("/montare-roti", response_model=MontareRotiImagesRead)
async def get_montare_roti_images(
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    return await _get_or_create(db)


@router.post("/montare-roti-image/{pozitie}")
async def upload_montare_roti_image(
    pozitie: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _account_id: int = Depends(get_account_id),
):
    if pozitie not in _MONTARE_POZITII:
        raise HTTPException(400, "Pozitie invalida")
    data = await validate_image(file)
    url = upload_global_image(pozitie, data, file.content_type, folder="montare_roti")
    settings = await _get_or_create(db)
    setattr(settings, f"montare_{pozitie}_image_path", url)
    await db.commit()
    return {"url": url}


@router.get("/montare-roti/image/{pozitie}")
async def proxy_montare_roti_image(pozitie: str, db: AsyncSession = Depends(get_db)):
    """Proxy o imagine de pozitie montare-roti din S3 cu Content-Type corect.

    Public: este consumat din <img src> in modalul "Montare Roti" din POS, fara header
    Authorization. URL-ul din DB este setat doar din endpoint-urile POST autentificate.
    """
    if pozitie not in _MONTARE_POZITII:
        raise HTTPException(404, "Pozitie invalida")
    settings = await _get_or_create(db)
    url = getattr(settings, f"montare_{pozitie}_image_path", None)
    if not url:
        raise HTTPException(404, "Imagine neconfigurata")
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(502, "URL imagine invalid")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
        if res.status_code != 200:
            raise HTTPException(502, "Eroare la descarcare imagine")
        content_type = res.headers.get("content-type", "image/png")
        return Response(content=res.content, media_type=content_type, headers={"Cache-Control": "public, max-age=300"})
    except httpx.HTTPError:
        raise HTTPException(502, "Eroare retea la descarcare imagine")


@router.get("/hotel-anvelope/image/{key}")
async def proxy_hotel_image(key: str, db: AsyncSession = Depends(get_db)):
    """Proxy o imagine din S3 cu Content-Type corect, evitand CORS browser-side.

    Public: este consumat din <img src> in PDF-uri si UI, fara header Authorization.
    URL-ul din DB este setat doar din endpoint-urile POST autentificate (controleaza key-ul
    S3 catre bucket-ul cunoscut), deci nu accepta URL-uri arbitrare. Ca defense-in-depth,
    schema este restrictionata la http/https.
    """
    if key not in {"cazare", "scoatere", "montare"}:
        raise HTTPException(404, "Cheie invalida")
    settings = await _get_or_create(db)
    url = getattr(settings, f"hotel_{key}_image_path", None)
    if not url:
        raise HTTPException(404, "Imagine neconfigurata")
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(502, "URL imagine invalid")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
        if res.status_code != 200:
            raise HTTPException(502, "Eroare la descarcare imagine")
        content_type = res.headers.get("content-type", "image/png")
        return Response(content=res.content, media_type=content_type, headers={"Cache-Control": "public, max-age=300"})
    except httpx.HTTPError:
        raise HTTPException(502, "Eroare retea la descarcare imagine")
