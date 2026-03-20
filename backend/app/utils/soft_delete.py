from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException


async def soft_delete(db: AsyncSession, model, record_id: int) -> None:
    """Soft delete uniform: seteaza is_deleted=True si deleted_at=now()."""
    record = await db.get(model, record_id)
    if record is None or record.is_deleted:
        raise HTTPException(status_code=404, detail="Inregistrarea nu a fost gasita.")
    record.is_deleted = True
    record.deleted_at = datetime.now(timezone.utc)
    await db.commit()
