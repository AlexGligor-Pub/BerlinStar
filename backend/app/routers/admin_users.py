"""Gestionarea utilizatorilor ORICARUI cont — doar pentru super-adminul de
platforma (AdminV2).

Foloseste acelasi `users_service` ca fatada per-cont (`/api/users`), deci regulile
de business (ultimul admin, unicitate username, revocarea sesiunilor la reset de
parola) sunt garantat identice in ambele ecrane.

Auth: `_require_super_admin` (username == "admin"), la fel ca restul rutelor
/api/admin/*.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.account import Account
from app.rate_limit import limiter
from app.routers.admin import _require_super_admin
from app.schemas.user import (
    MessageResponse,
    SessionRead,
    UserCreate,
    UserRead,
    UserSetPassword,
    UserUpdate,
)
from app.services import users_service as svc

router = APIRouter()

_super_admin = Depends(_require_super_admin)


async def _assert_account_exists(db: AsyncSession, account_id: int) -> Account:
    account = (await db.execute(
        select(Account).where(Account.id == account_id, Account.is_deleted == False)
    )).scalar_one_or_none()
    if account is None:
        raise HTTPException(404, "Contul nu a fost gasit.")
    return account


@router.get("/{account_id}/users", response_model=list[UserRead])
async def list_users(
    account_id: int,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    users = await svc.list_users(db, account_id)
    return [svc.serialize_user(u) for u in users]


@router.post("/{account_id}/users", response_model=UserRead, status_code=201)
@limiter.limit("30/minute")
async def create_user(
    request: Request,
    account_id: int,
    body: UserCreate,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    user = await svc.create_user(
        db,
        account_id=account_id,
        username=body.username,
        password=body.password,
        role=body.role,
        name=body.name,
        email=body.email,
        employee_id=body.employee_id,
    )
    return svc.serialize_user(user, sessions=[])


@router.patch("/{account_id}/users/{user_id}", response_model=UserRead)
async def update_user(
    account_id: int,
    user_id: int,
    body: UserUpdate,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    user = await svc.update_user(db, account_id, user_id, body.model_dump(exclude_unset=True))
    sessions = await svc.list_sessions(db, account_id, user_id=user.id)
    return svc.serialize_user(user, sessions=sessions)


@router.post("/{account_id}/users/{user_id}/password", response_model=MessageResponse)
@limiter.limit("30/minute")
async def set_user_password(
    request: Request,
    account_id: int,
    user_id: int,
    body: UserSetPassword,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    user = await svc.set_password(db, account_id, user_id, body.new_password)
    return MessageResponse(message=f"Parola pentru '{user.username}' a fost schimbata.")


@router.delete("/{account_id}/users/{user_id}", status_code=204)
async def delete_user(
    account_id: int,
    user_id: int,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    await svc.delete_user(db, account_id, user_id)


@router.get("/{account_id}/users/{user_id}/sessions", response_model=list[SessionRead])
async def list_user_sessions(
    account_id: int,
    user_id: int,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    sessions = await svc.list_sessions(db, account_id, user_id=user_id)
    return [svc.serialize_session(s) for s in sessions]


@router.delete("/{account_id}/users/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    account_id: int,
    session_id: int,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    await svc.revoke_session_by_id(db, account_id, session_id)
    return MessageResponse(message="Dispozitivul a fost deconectat.")


@router.delete("/{account_id}/users/{user_id}/sessions", response_model=MessageResponse)
async def revoke_user_sessions(
    account_id: int,
    user_id: int,
    _admin: Account = _super_admin,
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_exists(db, account_id)
    n = await svc.revoke_user_sessions(db, account_id, user_id)
    return MessageResponse(message=f"{n} dispozitiv(e) deconectate.")
