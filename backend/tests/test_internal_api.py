"""API intern pentru serviciul Radar AI: token de serviciu, context de business, chei AI.

Rulabil direct: python -m tests.test_internal_api
"""
from __future__ import annotations

from decimal import Decimal

from cryptography.fernet import Fernet

from app.config import RADAR_SHARED_SECRET
from app.efactura.crypto import encrypt, set_fernet_key
from app.models.company import Company
from app.models.global_settings import GlobalSettings
from app.routers import internal_api
from tests._harness import make_account, make_item, make_session, raises_http, run


async def test_service_token_guard():
    await internal_api.require_service_token(RADAR_SHARED_SECRET)
    await raises_http(401, internal_api.require_service_token(None))
    await raises_http(401, internal_api.require_service_token(""))
    await raises_http(401, internal_api.require_service_token("altceva"))
    await raises_http(401, internal_api.require_service_token("secret-cu-diacritice-ăî"))


async def test_business_context_shape():
    db = await make_session()
    acc = await make_account(db, "atelier")
    db.add(Company(
        account_id=acc.id, cui=12345678, name="Atelier SRL", address="Str. Lunga 4, Timisoara",
        website="https://atelier.ro", description="Service auto", street="Str. Lunga 4",
        city="Timisoara", county_code="TM",
    ))
    db.add(Company(
        account_id=acc.id, cui=999, name="Firma stearsa", is_deleted=True,
    ))
    await make_item(db, acc, "Schimb ulei", "120.00")
    await db.commit()

    out = await internal_api.get_business_context(account_id=acc.id, db=db)

    assert out["account_name"] == acc.name
    assert set(out.keys()) == {"account_name", "companies", "items"}
    assert len(out["companies"]) == 1, out["companies"]
    comp = out["companies"][0]
    assert set(comp.keys()) == {
        "id", "cui", "name", "address", "website", "description", "street", "city", "county_code",
    }
    assert comp["cui"] == 12345678 and comp["name"] == "Atelier SRL"
    assert comp["city"] == "Timisoara" and comp["county_code"] == "TM"
    assert out["items"] == [{"name": "Schimb ulei", "type": "Produs", "price": 120.0, "unit": "buc"}]


async def test_business_context_missing_account_is_404():
    db = await make_session()
    await raises_http(404, internal_api.get_business_context(account_id=4242, db=db))


async def test_ai_config_returns_decrypted_keys():
    set_fernet_key(Fernet.generate_key().decode())
    db = await make_session()
    db.add(GlobalSettings(
        anthropic_api_key_enc=encrypt("sk-secret"),
        google_places_api_key_enc=encrypt("places-secret"),
        ai_model="claude-test",
        ai_price_in_usd_mtok=Decimal("3.0000"),
        ai_price_out_usd_mtok=Decimal("15.0000"),
    ))
    await db.commit()

    out = await internal_api.get_ai_config(db=db)

    assert out == {
        "api_key": "sk-secret",
        "places_key": "places-secret",
        "model": "claude-test",
        "price_in": 3.0,
        "price_out": 15.0,
    }


def main() -> None:
    run(test_service_token_guard())
    run(test_business_context_shape())
    run(test_business_context_missing_account_is_404())
    run(test_ai_config_returns_decrypted_keys())
    print("OK test_internal_api")


if __name__ == "__main__":
    main()
