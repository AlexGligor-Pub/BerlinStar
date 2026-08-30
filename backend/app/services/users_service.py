"""Gestionarea utilizatorilor unui cont — logica partajata.

Acelasi cod serveste doua fatade:
  - `/api/users*`                          — adminul contului, pe propriul cont;
  - `/api/admin/accounts/{id}/users*`      — super-adminul de platforma (AdminV2),
                                             pe orice cont.
Ambele apeleaza functiile de aici cu `account_id`-ul potrivit, deci regulile de
business (ultimul admin, unicitate username, revocarea sesiunilor) sunt identice
si nu se pot desincroniza intre cele doua ecrane.
"""
from __future__ import annotations
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.device import Device
from app.models.employee import Employee
from app.models.user import User, UserRole, UserSession
from app.services.auth_service import revoke_all_sessions
from app.utils.security import hash_password

# Sesiunile mai vechi de atat nu se mai considera "dispozitiv logat" in UI, chiar
# daca token-ul ar fi tehnic valid — evitam sa aratam device-uri fantoma.
ACTIVE_SESSION_MAX_IDLE_DAYS = 30


async def _get_user(db: AsyncSession, account_id: int, user_id: int) -> User:
    user = (await db.execute(
        select(User).where(
            User.id == user_id,
            User.account_id == account_id,
            User.is_deleted == False,
        )
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Utilizatorul nu a fost gasit.")
    return user


async def _assert_employee_owned(db: AsyncSession, account_id: int, employee_id: int | None) -> None:
    """Angajatul legat de user trebuie sa fie din acelasi cont.

    FK-ul `users.employee_id -> employees.id` e global, deci fara verificarea
    asta un admin ar putea lega un utilizator de angajatul altei firme — o
    referinta peste granita de tenant, care ar strica si atribuirea „cine a
    facut miscarea" din jurnalul de stoc.
    """
    if employee_id is None:
        return
    owned = (await db.execute(
        select(Employee.id).where(
            Employee.id == employee_id,
            Employee.account_id == account_id,
            Employee.is_deleted == False,
        )
    )).scalar_one_or_none()
    if owned is None:
        raise HTTPException(400, "Angajatul selectat nu exista in acest cont.")


async def _count_active_admins(db: AsyncSession, account_id: int, exclude_user_id: int | None = None) -> int:
    conditions = [
        User.account_id == account_id,
        User.is_deleted == False,
        User.is_active == True,
        User.role == UserRole.ADMIN,
    ]
    if exclude_user_id is not None:
        conditions.append(User.id != exclude_user_id)
    return (await db.execute(select(func.count()).select_from(User).where(*conditions))).scalar_one()


async def _assert_not_last_admin(db: AsyncSession, account_id: int, user: User, action: str) -> None:
    """Un cont trebuie sa rămână mereu cu cel puțin un admin activ, altfel
    nimeni nu mai poate administra utilizatorii (blocaj ireversibil din UI).
    """
    if user.role != UserRole.ADMIN or not user.is_active:
        return
    if await _count_active_admins(db, account_id, exclude_user_id=user.id) == 0:
        raise HTTPException(
            400,
            f"Nu poti {action} ultimul administrator al contului. "
            "Creeaza sau activeaza mai intai un alt administrator.",
        )


async def _assert_username_free(
    db: AsyncSession, account_id: int, username: str, exclude_user_id: int | None = None
) -> None:
    """Username-ul e unic pe cont, printre utilizatorii ACTIVI.

    Indexul unic din DB e partial (`WHERE is_deleted = false`, vezi migrarea
    usr02), tocmai ca un nume sa poata fi refolosit dupa ce omul a plecat din
    firma — „ion" nu trebuie sa devina rezervat pe veci de o stergere.
    """
    conditions = [
        User.account_id == account_id,
        User.username == username,
        User.is_deleted == False,
    ]
    if exclude_user_id is not None:
        conditions.append(User.id != exclude_user_id)
    existing = (await db.execute(select(User.id).where(*conditions))).first()
    if existing is not None:
        raise HTTPException(400, f"Utilizatorul '{username}' exista deja in acest cont.")


async def list_users(db: AsyncSession, account_id: int) -> list[User]:
    # Eager-load sesiuni -> dispozitiv -> locatie: serializarea le acceseaza, iar
    # in context async un lazy-load ar arunca MissingGreenlet.
    return list((await db.execute(
        select(User)
        .options(
            selectinload(User.sessions)
            .selectinload(UserSession.device)
            .selectinload(Device.location)
        )
        .where(User.account_id == account_id, User.is_deleted == False)
        .order_by(User.role, User.username)
    )).scalars().all())


async def create_user(
    db: AsyncSession,
    account_id: int,
    username: str,
    password: str,
    role: UserRole,
    name: str,
    email: str | None = None,
    employee_id: int | None = None,
) -> User:
    username = username.strip()
    if not username:
        raise HTTPException(400, "Utilizatorul este obligatoriu.")
    await _assert_username_free(db, account_id, username)
    await _assert_employee_owned(db, account_id, employee_id)
    user = User(
        account_id=account_id,
        username=username,
        password=hash_password(password),
        role=role,
        name=(name or "").strip() or username,
        email=(email or None),
        employee_id=employee_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(
    db: AsyncSession,
    account_id: int,
    user_id: int,
    patch: dict,
) -> User:
    user = await _get_user(db, account_id, user_id)

    # Retrogradarea sau dezactivarea ultimului admin ar lasa contul fara
    # administrator — verificam inainte de a aplica orice schimbare.
    losing_admin = (
        ("role" in patch and patch["role"] != UserRole.ADMIN)
        or ("is_active" in patch and patch["is_active"] is False)
    )
    if losing_admin:
        action = "dezactiva" if patch.get("is_active") is False else "retrograda"
        await _assert_not_last_admin(db, account_id, user, action)

    if "username" in patch and patch["username"]:
        new_username = patch["username"].strip()
        if new_username != user.username:
            await _assert_username_free(db, account_id, new_username, exclude_user_id=user.id)
            user.username = new_username
    if "name" in patch and patch["name"] is not None:
        user.name = patch["name"].strip() or user.username
    if "email" in patch:
        user.email = patch["email"] or None
    if "role" in patch and patch["role"] is not None:
        user.role = patch["role"]
    if "employee_id" in patch:
        await _assert_employee_owned(db, account_id, patch["employee_id"])
        user.employee_id = patch["employee_id"]
    if "is_active" in patch and patch["is_active"] is not None:
        user.is_active = patch["is_active"]

    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Un user dezactivat nu trebuie sa rămână logat pe dispozitivele lui.
    if patch.get("is_active") is False:
        await revoke_all_sessions(db, user.id)

    await db.refresh(user)
    return user


async def set_password(db: AsyncSession, account_id: int, user_id: int, new_password: str) -> User:
    """Adminul seteaza direct o parola noua (fara sa o stie pe cea veche).

    Toate sesiunile userului se revoca: dupa un reset de parola nu are sens sa
    rămână logat pe dispozitivele vechi.
    """
    user = await _get_user(db, account_id, user_id)
    user.password = hash_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await revoke_all_sessions(db, user.id)
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, account_id: int, user_id: int) -> None:
    user = await _get_user(db, account_id, user_id)
    await _assert_not_last_admin(db, account_id, user, "sterge")
    user.is_deleted = True
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.commit()
    await revoke_all_sessions(db, user.id)


async def list_sessions(db: AsyncSession, account_id: int, user_id: int | None = None) -> list[UserSession]:
    """Sesiunile active (nerevocate, neexpirate) ale contului sau ale unui user."""
    now = datetime.now(timezone.utc)
    conditions = [
        UserSession.account_id == account_id,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now,
    ]
    if user_id is not None:
        conditions.append(UserSession.user_id == user_id)
    return list((await db.execute(
        select(UserSession)
        .options(selectinload(UserSession.device).selectinload(Device.location))
        .where(*conditions)
        .order_by(UserSession.last_seen_at.desc())
    )).scalars().all())


async def revoke_session_by_id(db: AsyncSession, account_id: int, session_id: int) -> None:
    session = (await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.account_id == account_id,
        )
    )).scalar_one_or_none()
    if session is None:
        raise HTTPException(404, "Sesiunea nu a fost gasita.")
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def revoke_user_sessions(db: AsyncSession, account_id: int, user_id: int) -> int:
    user = await _get_user(db, account_id, user_id)
    return await revoke_all_sessions(db, user.id)


# ─── Serializare ──────────────────────────────────────────────────────────────

def _is_session_live(session: UserSession, now: datetime) -> bool:
    return session.revoked_at is None and session.expires_at > now


def serialize_session(session: UserSession, current_jti: str | None = None) -> dict:
    """Sesiune -> dict pentru SessionRead.

    `location_name` vine din dispozitivul inregistrat, cand exista; altfel UI-ul
    cade pe device_name/IP/user-agent.
    """
    location_name = None
    device = getattr(session, "device", None)
    if device is not None:
        location = getattr(device, "location", None)
        location_name = getattr(location, "name", None)
    return {
        "id": session.id,
        "device_id": session.device_id,
        "device_name": session.device_name or (device.name if device is not None else None),
        "ip": session.ip,
        "user_agent": session.user_agent,
        "created_at": session.created_at,
        "last_seen_at": session.last_seen_at,
        "expires_at": session.expires_at,
        "location_name": location_name,
        "is_current": bool(current_jti) and session.jti == current_jti,
    }


def serialize_user(
    user: User,
    current_jti: str | None = None,
    sessions: list[UserSession] | None = None,
) -> dict:
    """User -> dict pentru UserRead, cu doar sesiunile inca active.

    `sessions` se paseaza explicit cand nu vin din relatia eager-loaded (ex. dupa
    create/update). NU atribuim `user.sessions = ...`: in async, scrierea intr-o
    relatie neincarcata declanseaza un lazy-load al valorii vechi (MissingGreenlet).
    """
    now = datetime.now(timezone.utc)
    source = sessions if sessions is not None else (user.sessions or [])
    live = [s for s in source if _is_session_live(s, now)]
    live.sort(key=lambda s: s.last_seen_at, reverse=True)
    return {
        "id": user.id,
        "account_id": user.account_id,
        "username": user.username,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "employee_id": user.employee_id,
        "is_active": user.is_active,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "active_sessions": len(live),
        "sessions": [serialize_session(s, current_jti) for s in live],
    }
