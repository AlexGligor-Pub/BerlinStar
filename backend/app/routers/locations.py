from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_account_id
from app.models.location import Location
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.location import LocationCreate, LocationRead, LocationDetail, IdsBody
from app.schemas.common import Page
from app.utils.paginate import paginate
from app.utils.soft_delete import soft_delete
from app.utils.storage import upload_image as storage_upload_image, delete_image_by_url, validate_image

router = APIRouter()


def _to_detail(loc: Location) -> LocationDetail:
    return LocationDetail(
        id=loc.id,
        name=loc.name,
        description=loc.description,
        disclaimer_id=loc.disclaimer_id,
        register_id=loc.register_id,
        company_id=loc.company_id,
        account_id=loc.account_id,
        created_at=loc.created_at,
        updated_at=loc.updated_at,
        is_deleted=loc.is_deleted,
        image_path=loc.image_path,
        department_ids=[d.id for d in loc.departments],
        employee_ids=[e.id for e in loc.employees],
    )


async def _get_with_relations(db: AsyncSession, location_id: int, account_id: int) -> Location:
    result = await db.execute(
        select(Location)
        .options(selectinload(Location.departments), selectinload(Location.employees))
        .where(Location.id == location_id, Location.account_id == account_id)
    )
    loc = result.scalar_one_or_none()
    if loc is None or loc.is_deleted:
        raise HTTPException(404, "Locația nu a fost găsită.")
    return loc


@router.get("", response_model=Page[LocationDetail])
async def list_locations(
    last_id: int | None = None,
    limit: int = 100,
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    limit = min(limit, 200)
    stmt = (
        select(Location)
        .options(selectinload(Location.departments), selectinload(Location.employees))
        .where(Location.account_id == account_id)
    )
    if not include_deleted:
        stmt = stmt.where(Location.is_deleted == False)
    if last_id is not None:
        stmt = stmt.where(Location.id > last_id)
    if q:
        stmt = stmt.where(Location.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(Location.id).limit(limit + 1)

    return await paginate(db, stmt, limit, transform=_to_detail)


@router.post("", response_model=LocationRead, status_code=201)
async def create_location(
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = Location(
        name=body.name,
        description=body.description,
        disclaimer_id=body.disclaimer_id,
        register_id=body.register_id,
        company_id=body.company_id,
        account_id=account_id,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationDetail)
async def get_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await _get_with_relations(db, location_id, account_id)
    return _to_detail(loc)


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(
    location_id: int,
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = await db.get(Location, location_id)
    if location is None or location.account_id != account_id or location.is_deleted:
        raise HTTPException(404, "Locația nu a fost găsită.")
    location.name = body.name
    location.description = body.description
    location.disclaimer_id = body.disclaimer_id
    location.register_id = body.register_id
    location.company_id = body.company_id
    await db.commit()
    await db.refresh(location)
    return location


@router.post("/{location_id}/image", response_model=LocationRead)
async def upload_location_image(
    location_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = await db.get(Location, location_id)
    if location is None or location.account_id != account_id or location.is_deleted:
        raise HTTPException(404, "Locația nu a fost găsită.")
    data = await validate_image(file)
    old_url = location.image_path
    url = storage_upload_image(account_id, "locations", data, file.content_type)
    location.image_path = url
    await db.commit()
    await db.refresh(location)
    if old_url:
        delete_image_by_url(old_url)
    return location


@router.put("/{location_id}/departments", response_model=LocationDetail)
async def set_location_departments(
    location_id: int,
    body: IdsBody,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await _get_with_relations(db, location_id, account_id)
    departments = (await db.execute(
        select(Department).where(Department.id.in_(body.ids), Department.account_id == account_id)
    )).scalars().all()
    loc.departments = list(departments)
    await db.commit()
    loc = await _get_with_relations(db, location_id, account_id)
    return _to_detail(loc)


@router.put("/{location_id}/employees", response_model=LocationDetail)
async def set_location_employees(
    location_id: int,
    body: IdsBody,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    loc = await _get_with_relations(db, location_id, account_id)
    employees = (await db.execute(
        select(Employee).where(Employee.id.in_(body.ids), Employee.account_id == account_id)
    )).scalars().all()
    loc.employees = list(employees)
    await db.commit()
    loc = await _get_with_relations(db, location_id, account_id)
    return _to_detail(loc)


@router.delete("/{location_id}", status_code=204)
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    account_id: int = Depends(get_account_id),
):
    location = await db.get(Location, location_id)
    if location is None or location.account_id != account_id:
        raise HTTPException(404, "Locația nu a fost găsită.")
    await soft_delete(db, Location, location_id)
