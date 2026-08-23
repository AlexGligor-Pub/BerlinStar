from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_account_id, get_settings_account_id
from app.models.general_settings import GeneralSettings
from app.schemas.general_settings import GeneralSettingsPatch, GeneralSettingsRead

router = APIRouter()


async def _get_or_create(db: AsyncSession, account_id: int) -> GeneralSettings:
    result = await db.execute(
        select(GeneralSettings).where(GeneralSettings.account_id == account_id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = GeneralSettings(account_id=account_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("", response_model=GeneralSettingsRead)
async def get_general_settings(
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    return await _get_or_create(db, account_id)


@router.patch("", response_model=GeneralSettingsRead)
async def patch_general_settings(
    body: GeneralSettingsPatch,
    db: AsyncSession = Depends(get_db),
    # Citirea rămâne deschisa tuturor (setarile controleaza si UI-ul operational,
    # ex. afisarea Hotel Anvelope), dar MODIFICAREA e doar admin + manager.
    account_id: int = Depends(get_settings_account_id),
):
    settings = await _get_or_create(db, account_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(settings, k, v)
    await db.commit()
    await db.refresh(settings)
    return settings
