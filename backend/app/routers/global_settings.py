from __future__ import annotations
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.global_settings import GlobalSettings
from app.schemas.global_settings import GlobalSettingsRead
from app.utils.storage import validate_image, upload_global_image

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
async def get_hotel_images(db: AsyncSession = Depends(get_db)):
    return await _get_or_create(db)


@router.post("/hotel-cazare-image")
async def upload_cazare_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
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
):
    data = await validate_image(file)
    url = upload_global_image("montare", data, file.content_type)
    settings = await _get_or_create(db)
    settings.hotel_montare_image_path = url
    await db.commit()
    return {"url": url}


@router.get("/hotel-anvelope/image/{key}")
async def proxy_hotel_image(key: str, db: AsyncSession = Depends(get_db)):
    """Proxy o imagine din S3 cu Content-Type corect, evitand CORS browser-side."""
    if key not in {"cazare", "scoatere", "montare"}:
        raise HTTPException(404, "Cheie invalida")
    settings = await _get_or_create(db)
    url = getattr(settings, f"hotel_{key}_image_path", None)
    if not url:
        raise HTTPException(404, "Imagine neconfigurata")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
        if res.status_code != 200:
            raise HTTPException(502, "Eroare la descarcare imagine")
        content_type = res.headers.get("content-type", "image/png")
        return Response(content=res.content, media_type=content_type, headers={"Cache-Control": "public, max-age=300"})
    except httpx.HTTPError:
        raise HTTPException(502, "Eroare retea la descarcare imagine")
