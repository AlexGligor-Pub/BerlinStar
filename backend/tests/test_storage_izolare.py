"""Imaginile din bucket-ul S3 comun: un cont nu poate sterge sau afisa fisierele altuia.

Fara apeluri S3 reale: `_delete_object_sync` e inlocuit cu un colector.

Rulabil cu pytest sau direct:  python -m tests.test_storage_izolare  (din backend/)
"""
from __future__ import annotations
import os

from app.models.company import Company
from app.routers.companies import update_company
from app.routers.items import patch_item
from app.schemas.company import CompanyUpdate
from app.schemas.item import ItemUpdate
from app.utils import storage
from app.utils.storage import check_image_ref, delete_image_by_url, own_image_key
from tests._harness import make_account, make_item, make_session, raises_http, run

PUB = "https://bucket.test.example"


def _url(key: str) -> str:
    return f"{PUB}/{key}"


class _FakeS3:
    """Seteaza S3_PUBLIC_URL si aduna cheile care ar fi fost sterse din S3."""

    def __enter__(self) -> list[tuple[str, str]]:
        self._env = os.environ.get("S3_PUBLIC_URL")
        self._orig = storage._delete_object_sync
        deleted: list[tuple[str, str]] = []
        os.environ["S3_PUBLIC_URL"] = PUB
        storage._delete_object_sync = lambda bucket, key: deleted.append((bucket, key))
        return deleted

    def __exit__(self, *exc) -> None:
        storage._delete_object_sync = self._orig
        if self._env is None:
            os.environ.pop("S3_PUBLIC_URL", None)
        else:
            os.environ["S3_PUBLIC_URL"] = self._env


async def test_own_image_key_accepts_only_own_image_folders():
    with _FakeS3():
        assert own_image_key(_url("accounts/6/items/abc123.jpg"), 6) == "accounts/6/items/abc123.jpg"
        assert own_image_key(_url("accounts/6/companies/logos/a.png"), 6) == "accounts/6/companies/logos/a.png"
        assert own_image_key(_url("accounts/6/accounts/avatars/a.webp"), 6) == "accounts/6/accounts/avatars/a.webp"
        # alt cont, inclusiv un id care incepe cu aceleasi cifre
        assert own_image_key(_url("accounts/7/items/abc123.jpg"), 6) is None
        assert own_image_key(_url("accounts/60/items/abc123.jpg"), 6) is None
        # fisiere din acelasi bucket care nu sunt imagini (nici macar ale contului)
        assert own_image_key(_url("accounts/6/efactura/sent/2026/FACT0012.xml"), 6) is None
        assert own_image_key(_url("efactura/companies/3/responses/2026/9.zip"), 6) is None
        assert own_image_key(_url("subscription/6/12_PP0001.pdf"), 6) is None
        assert own_image_key(_url("global/hotel_anvelope/cazare.png"), 6) is None
        # iesire din folder / subfoldere / query
        assert own_image_key(_url("accounts/6/items/../../7/items/a.jpg"), 6) is None
        assert own_image_key(_url("accounts/6/items/sub/a.jpg"), 6) is None
        assert own_image_key(_url("accounts/6/items/a.jpg?x=1"), 6) is None
        # in afara bucket-ului, formate vechi, valori goale
        assert own_image_key("https://alt-host.example/accounts/6/items/a.jpg", 6) is None
        assert own_image_key("/uploads/items/a.jpg", 6) is None
        assert own_image_key("", 6) is None
        assert own_image_key(None, 6) is None
        assert own_image_key(_url("accounts/6/items/a.jpg"), None) is None


async def test_delete_removes_own_image():
    with _FakeS3() as deleted:
        await delete_image_by_url(_url("accounts/6/items/abc123.jpg"), 6)
        assert [k for _, k in deleted] == ["accounts/6/items/abc123.jpg"]


async def test_delete_refuses_other_account_and_non_image_keys():
    with _FakeS3() as deleted:
        await delete_image_by_url(_url("accounts/7/items/abc123.jpg"), 6)
        await delete_image_by_url(_url("accounts/7/efactura/sent/2026/FACT0012.xml"), 6)
        await delete_image_by_url(_url("accounts/6/efactura/sent/2026/FACT0012.xml"), 6)
        await delete_image_by_url(_url("global/hotel_anvelope/cazare.png"), 6)
        await delete_image_by_url(_url("subscription/7/12_PP0001.pdf"), 6)
        # fara cont nu se sterge nimic
        await delete_image_by_url(_url("accounts/6/items/abc123.jpg"))
        assert deleted == []


async def test_delete_ignores_urls_outside_bucket():
    with _FakeS3() as deleted:
        await delete_image_by_url("https://alt-host.example/accounts/6/items/a.jpg", 6)
        await delete_image_by_url("/uploads/items/a.jpg", 6)
        await delete_image_by_url("", 6)
        assert deleted == []


async def test_delete_never_raises_when_s3_fails():
    with _FakeS3():
        def _boom(bucket, key):
            raise RuntimeError("S3 indisponibil")
        storage._delete_object_sync = _boom
        await delete_image_by_url(_url("accounts/6/items/abc123.jpg"), 6)


async def test_check_image_ref_rules():
    with _FakeS3():
        strain = _url("accounts/7/items/a.jpg")
        # golire, valoare neschimbata (inclusiv format vechi), URL propriu
        check_image_ref(None, strain, 6)
        check_image_ref("", strain, 6)
        check_image_ref("  ", None, 6)
        check_image_ref("/uploads/items/vechi.jpg", "/uploads/items/vechi.jpg", 6)
        check_image_ref("https://vechi.example/x.png", "https://vechi.example/x.png", 6)
        check_image_ref(_url("accounts/6/items/a.jpg"), None, 6)
        for bad in (strain, _url("accounts/6/efactura/sent/2026/F1.xml"),
                    "https://alt-host.example/x.png", "/uploads/items/altul.jpg"):
            try:
                check_image_ref(bad, None, 6)
            except Exception as exc:
                assert getattr(exc, "status_code", None) == 400, exc
            else:
                raise AssertionError(f"astept 400 pentru {bad}")


async def test_patch_item_rejects_foreign_image_and_keeps_legacy_value():
    with _FakeS3():
        db = await make_session()
        acc = await make_account(db)
        other = await make_account(db, username="alta", code="alta")
        item = await make_item(db, acc, "Ulei", "10.00")
        item.image_path = "/uploads/items/vechi.jpg"
        await db.commit()
        strain = _url(f"accounts/{other.id}/efactura/sent/2026/FACT0012.xml")
        await raises_http(400, patch_item(item.id, ItemUpdate(image_path=strain), db=db, account_id=acc.id))
        assert item.image_path == "/uploads/items/vechi.jpg"
        # formularul care trimite inapoi valoarea veche salveaza in continuare
        out = await patch_item(
            item.id, ItemUpdate(name="Ulei 5W30", image_path="/uploads/items/vechi.jpg"),
            db=db, account_id=acc.id,
        )
        assert (out.name, out.image_path) == ("Ulei 5W30", "/uploads/items/vechi.jpg")
        # fara image_path in body ramane neatinsa; golirea e permisa
        out = await patch_item(item.id, ItemUpdate(name="Ulei"), db=db, account_id=acc.id)
        assert out.image_path == "/uploads/items/vechi.jpg"
        out = await patch_item(item.id, ItemUpdate(image_path=None), db=db, account_id=acc.id)
        assert out.image_path is None


async def test_update_company_rejects_foreign_logo_and_accepts_echo():
    with _FakeS3():
        db = await make_session()
        acc = await make_account(db)
        other = await make_account(db, username="alta", code="alta")
        logo = _url(f"accounts/{acc.id}/companies/logos/logo.png")
        company = Company(account_id=acc.id, cui=123456, name="Firma SRL", logo_path=logo)
        db.add(company)
        await db.commit()
        strain = _url(f"accounts/{other.id}/companies/logos/logo.png")
        await raises_http(400, update_company(company.id, CompanyUpdate(logo_path=strain), db=db, account_id=acc.id))
        await raises_http(
            400, update_company(company.id, CompanyUpdate(background_path=strain), db=db, account_id=acc.id),
        )
        # CompaniiPanel trimite inapoi logo_path-ul salvat la fiecare editare
        out = await update_company(
            company.id, CompanyUpdate(name="Firma Noua SRL", logo_path=logo, background_path=None),
            db=db, account_id=acc.id,
        )
        assert (out.name, out.logo_path, out.background_path) == ("Firma Noua SRL", logo, None)


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare stocare imagini trecute.")
