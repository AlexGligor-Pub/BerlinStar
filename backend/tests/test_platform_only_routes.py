"""Setarile de PLATFORMA nu apartin niciunui client.

`/api/email-settings/*` (SMTP-ul nostru, sabloanele, jurnalul de email al
tuturor conturilor) si scrierile din `/api/global-settings/*` (imaginile comune
din POS / Hotel) lucreaza pe randuri fara `account_id`. Cat timp erau pazite
doar de `get_account_id`, orice utilizator al oricarui cont putea muta host-ul
SMTP pe un server al lui si primea parola la urmatorul email trimis.

Aici verificam doua lucruri: ca handlerele chiar sunt legate de
`get_platform_admin_account` si ca dependinta respinge un admin de client, dar
lasa sa treaca adminul contului de platforma (cel emis de /api/admin/verify).

Rulabil cu pytest sau direct:  python -m tests.test_platform_only_routes  (din backend/)
"""
from __future__ import annotations
import inspect
from datetime import datetime, timedelta, timezone

from app.auth_context import resolve_auth_context
from app.dependencies import (
    PLATFORM_ACCOUNT_USERNAME, get_account_id, get_platform_admin_account,
)
from app.models.email_log import EmailLog
from app.models.global_settings import GlobalSettings
from app.models.user import UserRole, UserSession
from app.routers import email_settings, global_settings
from app.schemas.global_settings import SmtpSettingsPatch
from tests._harness import make_account, make_session, make_user, raises_http, run

GLOBAL_WRITES = (
    global_settings.upload_cazare_image,
    global_settings.upload_scoatere_image,
    global_settings.upload_montare_image,
    global_settings.upload_montare_roti_image,
)
GLOBAL_TENANT_READS = (
    global_settings.get_hotel_images,
    global_settings.get_montare_roti_images,
)


async def _ctx(db, account, username: str, role: UserRole):
    """Context real, rezolvat din DB ca la un request: user + sesiune + cont."""
    user = await make_user(db, account, username, role)
    now = datetime.now(timezone.utc)
    jti = f"jti-{account.id}-{username}"
    # Referinta locala, nu doar db.add(...): recitita din SQLite, sesiunea si-ar
    # pierde tzinfo si comparatia cu `expires_at` ar pica.
    session = UserSession(
        user_id=user.id, account_id=account.id, jti=jti,
        created_at=now, last_seen_at=now, expires_at=now + timedelta(days=30),
    )
    db.add(session)
    await db.commit()
    return await resolve_auth_context(
        request=None, db=db, account_id=account.id, user_id=user.id, jti=jti,
    )


async def _fixture():
    db = await make_session()
    platform = await make_account(db, username=PLATFORM_ACCOUNT_USERNAME, code="admin")
    tenant = await make_account(db, username="firma", code="firma")
    return db, platform, tenant


def _deps_of(fn) -> list:
    """Functiile cerute prin `Depends(...)` in semnatura unui handler."""
    return [
        p.default.dependency
        for p in inspect.signature(fn).parameters.values()
        if hasattr(p.default, "dependency")
    ]


# ─── Legatura handler → dependinta ────────────────────────────────────────────

async def test_email_router_is_gated_by_the_platform_dependency():
    deps = [d.dependency for d in email_settings.router.dependencies]
    assert get_platform_admin_account in deps
    # Regresie: vechiul gate lasa sa treaca orice utilizator autentificat.
    assert get_account_id not in deps


async def test_global_settings_writes_are_gated_by_the_platform_dependency():
    for fn in GLOBAL_WRITES:
        deps = _deps_of(fn)
        assert get_platform_admin_account in deps, fn.__name__
        assert get_account_id not in deps, fn.__name__


async def test_global_settings_reads_stay_open_to_tenants():
    """POS-ul si Hotelul oricarui client citesc imaginile comune."""
    for fn in GLOBAL_TENANT_READS:
        deps = _deps_of(fn)
        assert get_account_id in deps, fn.__name__
        assert get_platform_admin_account not in deps, fn.__name__
    # Proxy-urile de imagine sunt consumate din <img src>, fara Authorization.
    for fn in (global_settings.proxy_hotel_image, global_settings.proxy_montare_roti_image):
        deps = _deps_of(fn)
        assert get_account_id not in deps and get_platform_admin_account not in deps, fn.__name__


# ─── Ce decide dependinta ─────────────────────────────────────────────────────

async def test_tenant_users_are_rejected_whatever_their_role():
    db, _platform, tenant = await _fixture()
    for i, role in enumerate((UserRole.ADMIN, UserRole.MANAGER, UserRole.WORKER)):
        ctx = await _ctx(db, tenant, f"user{i}", role)
        await raises_http(403, get_platform_admin_account(ctx))


async def test_tenant_user_named_admin_is_still_rejected():
    """Conteaza username-ul CONTULUI, nu al utilizatorului din el."""
    db, _platform, tenant = await _fixture()
    ctx = await _ctx(db, tenant, PLATFORM_ACCOUNT_USERNAME, UserRole.ADMIN)
    await raises_http(403, get_platform_admin_account(ctx))


async def test_platform_account_non_admin_is_rejected():
    db, platform, _tenant = await _fixture()
    for i, role in enumerate((UserRole.MANAGER, UserRole.WORKER)):
        ctx = await _ctx(db, platform, f"coleg{i}", role)
        await raises_http(403, get_platform_admin_account(ctx))


async def test_platform_admin_passes_and_can_use_the_email_handlers():
    db, platform, tenant = await _fixture()
    ctx = await _ctx(db, platform, "admin", UserRole.ADMIN)
    account = await get_platform_admin_account(ctx)
    assert account.id == platform.id

    patched = await email_settings.patch_smtp(
        SmtpSettingsPatch(smtp_host="smtp.exemplu.ro", smtp_password="secret"), db=db,
    )
    assert patched.smtp_host == "smtp.exemplu.ro"
    assert patched.smtp_password == ""  # parola nu se intoarce niciodata

    read = await email_settings.get_smtp(db=db)
    assert (read.smtp_host, read.smtp_password) == ("smtp.exemplu.ro", "")
    stored = (await email_settings._get_or_create_global(db)).smtp_password
    assert stored == "secret"

    # Jurnalul e al tuturor conturilor — de aceea ruta e doar a platformei.
    db.add(EmailLog(account_id=tenant.id, to_address="a@firma.ro", subject="Bun venit", status="ok"))
    db.add(EmailLog(account_id=platform.id, to_address="b@noi.ro", subject="Test", status="ok"))
    await db.commit()
    logs = await email_settings.get_logs(account_id=None, limit=100, db=db)
    assert {log.account_id for log in logs} == {tenant.id, platform.id}
    assert await email_settings.get_templates(db=db) == []


class _FakeUpload:
    content_type = "image/png"


async def test_platform_admin_can_replace_a_global_image():
    db, platform, tenant = await _fixture()
    ctx = await _ctx(db, platform, "admin", UserRole.ADMIN)
    admin = await get_platform_admin_account(ctx)

    # Fara S3 in teste: inlocuim validarea si upload-ul, handlerul ramane cel real.
    async def fake_validate(file):
        return b"png"

    async def fake_upload(key, data, content_type, folder="hotel_anvelope"):
        return f"https://s3.test/global/{folder}/{key}.png"

    real = (global_settings.validate_image, global_settings.upload_global_image)
    global_settings.validate_image = fake_validate
    global_settings.upload_global_image = fake_upload
    try:
        out = await global_settings.upload_cazare_image(file=_FakeUpload(), db=db, _admin=admin)
        assert out == {"url": "https://s3.test/global/hotel_anvelope/cazare.png"}
        out = await global_settings.upload_montare_roti_image(
            "rezerva", file=_FakeUpload(), db=db, _admin=admin,
        )
        assert out == {"url": "https://s3.test/global/montare_roti/rezerva.png"}
        await raises_http(400, global_settings.upload_montare_roti_image(
            "inventata", file=_FakeUpload(), db=db, _admin=admin,
        ))
    finally:
        global_settings.validate_image, global_settings.upload_global_image = real

    row = (await db.execute(GlobalSettings.__table__.select())).mappings().one()
    assert row["hotel_cazare_image_path"].endswith("/cazare.png")
    assert row["montare_rezerva_image_path"].endswith("/rezerva.png")

    # Citirea ramane a oricarui cont autentificat.
    seen = await global_settings.get_hotel_images(db=db, _account_id=tenant.id)
    assert seen.hotel_cazare_image_path.endswith("/cazare.png")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de rute exclusiv de platforma trecute.")
