"""AdminV2 > eFactura > Status transmiteri: super-adminul platformei poate verifica
statusul si descarca ZIP-ul pentru bonul oricarui cont, iar un cont obisnuit
ramane izolat (404 pe bonul altui cont).

Super-admin = contul de platforma SI rolul `admin`: un worker/manager din contul
de platforma ramane izolat la fel ca orice alt tenant.

Rulabil cu pytest sau direct:  python -m tests.test_efactura_admin_status  (din backend/)
"""
from __future__ import annotations
from datetime import date

from app.auth_context import AuthContext
from app.efactura import router as efactura_router
from app.efactura.models import AnafSettings, EFacturaRecord
from app.efactura.router import download_response_zip, get_receipt_status
from app.models.company import Company
from app.models.user import UserRole
from tests._harness import make_account, make_receipt, make_session, make_user, raises_http, run

NO_RECEIPT = "Receipt-ul nu exista."


async def _fixture(download_id: int | None = 555):
    db = await make_session()
    admin = await make_account(db, username="admin", code="admin")
    owner = await make_account(db, username="firma", code="firma")
    other = await make_account(db, username="alta", code="alta")
    company = Company(account_id=owner.id, cui=12345678, name="Firma SRL")
    db.add(company)
    await db.flush()
    receipt = await make_receipt(db, owner)
    rec = EFacturaRecord(
        company_id=company.id,
        receipt_id=receipt.id,
        cui="12345678",
        direction="sent",
        status="accepted",
        index_incarcare=777,
        download_id=download_id,
        invoice_issue_date=date(2026, 9, 1),
        deadline_transmit=date(2026, 9, 6),
    )
    db.add(rec)
    await db.flush()
    return db, admin, owner, other, receipt, rec


async def _ctx(db, account, role: UserRole = UserRole.ADMIN) -> AuthContext:
    """Contextul unui utilizator cu rolul dat din `account`. Handlerele sunt apelate
    direct, deci il construim de mana; `session` nu e citita de aceste rute."""
    user = await make_user(db, account, f"{account.username}-{role.value}", role)
    return AuthContext(user=user, session=None, account=account)


async def test_status_owner_sees_own_receipt():
    db, _, owner, _, receipt, rec = await _fixture()
    got = await get_receipt_status(receipt.id, ctx=await _ctx(db, owner), db=db)
    assert got.id == rec.id


async def test_status_platform_admin_sees_client_receipt():
    db, admin, _, _, receipt, rec = await _fixture()
    got = await get_receipt_status(receipt.id, ctx=await _ctx(db, admin), db=db)
    assert (got.id, got.status) == (rec.id, "accepted")


async def test_status_other_account_gets_404():
    db, _, _, other, receipt, _ = await _fixture()
    detail = await raises_http(404, get_receipt_status(receipt.id, ctx=await _ctx(db, other), db=db))
    assert detail == NO_RECEIPT


async def test_status_missing_receipt_is_404_even_for_admin():
    db, admin, *_ = await _fixture()
    detail = await raises_http(404, get_receipt_status(99999, ctx=await _ctx(db, admin), db=db))
    assert detail == NO_RECEIPT


async def test_status_owner_worker_sees_own_receipt():
    # Rutele pe bon raman operationale: casierul isi vede propriul bon.
    db, _, owner, _, receipt, rec = await _fixture()
    got = await get_receipt_status(receipt.id, ctx=await _ctx(db, owner, UserRole.WORKER), db=db)
    assert got.id == rec.id


async def test_status_platform_worker_gets_404():
    db, admin, _, _, receipt, _ = await _fixture()
    ctx = await _ctx(db, admin, UserRole.WORKER)
    detail = await raises_http(404, get_receipt_status(receipt.id, ctx=ctx, db=db))
    assert detail == NO_RECEIPT


async def test_status_platform_manager_gets_404():
    db, admin, _, _, receipt, _ = await _fixture()
    ctx = await _ctx(db, admin, UserRole.MANAGER)
    detail = await raises_http(404, get_receipt_status(receipt.id, ctx=ctx, db=db))
    assert detail == NO_RECEIPT


async def test_status_other_account_admin_role_gets_404():
    # Rolul `admin` intr-un cont obisnuit nu ridica filtrul pe cont.
    db, _, _, other, receipt, _ = await _fixture()
    ctx = await _ctx(db, other, UserRole.ADMIN)
    detail = await raises_http(404, get_receipt_status(receipt.id, ctx=ctx, db=db))
    assert detail == NO_RECEIPT


async def test_download_platform_worker_gets_404():
    db, admin, _, _, receipt, _ = await _fixture()
    ctx = await _ctx(db, admin, UserRole.WORKER)
    detail = await raises_http(404, download_response_zip(receipt.id, ctx=ctx, db=db))
    assert detail == NO_RECEIPT


async def test_download_other_account_gets_404():
    db, _, _, other, receipt, _ = await _fixture()
    detail = await raises_http(404, download_response_zip(receipt.id, ctx=await _ctx(db, other), db=db))
    assert detail == NO_RECEIPT


async def test_download_platform_admin_passes_tenant_check():
    # Fara download_id handlerul se opreste inainte de ANAF, dar cu alt mesaj
    # decat cel de izolare: dovada ca adminul a trecut de filtrul pe cont.
    db, admin, _, _, receipt, _ = await _fixture(download_id=None)
    detail = await raises_http(404, download_response_zip(receipt.id, ctx=await _ctx(db, admin), db=db))
    assert detail != NO_RECEIPT


async def test_download_platform_admin_gets_client_zip():
    db, admin, _, _, receipt, rec = await _fixture()
    db.add(AnafSettings(company_id=rec.company_id, use_test_env=True))
    await db.flush()

    seen: dict = {}

    async def fake_token(_db, company_id):
        seen["company_id"] = company_id
        return "tok"

    class FakeClient:
        def __init__(self, access_token, cui, use_test=False):
            seen["cui"] = cui

        async def download_response(self, download_id):
            seen["download_id"] = download_id
            return b"PK-zip"

    orig_token = efactura_router.oauth_service.get_valid_access_token
    orig_client = efactura_router.AnafEFacturaClient
    efactura_router.oauth_service.get_valid_access_token = fake_token
    efactura_router.AnafEFacturaClient = FakeClient
    try:
        resp = await download_response_zip(receipt.id, ctx=await _ctx(db, admin), db=db)
    finally:
        efactura_router.oauth_service.get_valid_access_token = orig_token
        efactura_router.AnafEFacturaClient = orig_client

    assert resp.media_type == "application/zip"
    assert "anaf_response_777.zip" in resp.headers["content-disposition"]
    assert seen == {"company_id": rec.company_id, "cui": "12345678", "download_id": 555}


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii eFactura admin status/download trecute.")
