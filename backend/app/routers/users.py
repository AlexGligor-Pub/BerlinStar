"""Gestionarea utilizatorilor contului — accesibila doar rolului `admin`.

Toate endpointurile sunt scoped pe contul userului logat (`ctx.account_id`), deci
un admin nu poate atinge utilizatorii altui cont. Varianta pentru super-adminul
de platforma (orice cont) e in app/routers/admin_users.py si foloseste acelasi
serviciu, ca regulile sa nu se desincronizeze.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_context import AuthContext
from app.database import get_db
from app.dependencies import require_resource
from app.permissions import Resource
from app.rate_limit import limiter
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

# Toate rutele din acest router cer Resource.USERS (adica rolul admin).
_admin_only = Depends(require_resource(Resource.USERS))


@router.get("", response_model=list[UserRead])
async def list_users(ctx: AuthContext = _admin_only, db: AsyncSession = Depends(get_db)):
    users = await svc.list_users(db, ctx.account_id)
    current_jti = ctx.session.jti
    return [svc.serialize_user(u, current_jti) for u in users]


@router.post("", response_model=UserRead, status_code=201)
@limiter.limit("20/minute")
async def create_user(
    request: Request,
    body: UserCreate,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    user = await svc.create_user(
        db,
        account_id=ctx.account_id,
        username=body.username,
        password=body.password,
        role=body.role,
        name=body.name,
        email=body.email,
        employee_id=body.employee_id,
    )
    # Abia creat: fara sesiuni. Pasam explicit ca sa nu atingem relatia ORM.
    return svc.serialize_user(user, sessions=[])


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    body: UserUpdate,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    user = await svc.update_user(db, ctx.account_id, user_id, body.model_dump(exclude_unset=True))
    sessions = await svc.list_sessions(db, ctx.account_id, user_id=user.id)
    current_jti = ctx.session.jti
    return svc.serialize_user(user, current_jti, sessions=sessions)


@router.post("/{user_id}/password", response_model=MessageResponse)
@limiter.limit("20/minute")
async def set_user_password(
    request: Request,
    user_id: int,
    body: UserSetPassword,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    """Adminul seteaza direct parola unui utilizator (nu are nevoie de cea veche).
    Sesiunile userului se inchid, ca sa nu rămână logat cu parola veche."""
    user = await svc.set_password(db, ctx.account_id, user_id, body.new_password)
    return MessageResponse(message=f"Parola pentru '{user.username}' a fost schimbata.")


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    await svc.delete_user(db, ctx.account_id, user_id)


@router.get("/sessions/all", response_model=list[SessionRead])
async def list_all_sessions(ctx: AuthContext = _admin_only, db: AsyncSession = Depends(get_db)):
    """Toate dispozitivele logate din cont, indiferent de user."""
    sessions = await svc.list_sessions(db, ctx.account_id)
    current_jti = ctx.session.jti
    return [svc.serialize_session(s, current_jti) for s in sessions]


@router.get("/{user_id}/sessions", response_model=list[SessionRead])
async def list_user_sessions(
    user_id: int,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    sessions = await svc.list_sessions(db, ctx.account_id, user_id=user_id)
    current_jti = ctx.session.jti
    return [svc.serialize_session(s, current_jti) for s in sessions]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: int,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    """Deconecteaza un dispozitiv anume."""
    await svc.revoke_session_by_id(db, ctx.account_id, session_id)
    return MessageResponse(message="Dispozitivul a fost deconectat.")


@router.delete("/{user_id}/sessions", response_model=MessageResponse)
async def revoke_user_sessions(
    user_id: int,
    ctx: AuthContext = _admin_only,
    db: AsyncSession = Depends(get_db),
):
    """Deconecteaza userul de pe toate dispozitivele."""
    n = await svc.revoke_user_sessions(db, ctx.account_id, user_id)
    return MessageResponse(message=f"{n} dispozitiv(e) deconectate.")
