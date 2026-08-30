"""Masina salvata pe un deviz ramane ACEEASI masina cand o editezi.

Bug-ul raportat din POS: se salveaza un deviz cu client si masina, apoi se
editeaza masina — iar in fisa clientului apare o masina noua, in loc sa fie
actualizata cea existenta. Cauza: potrivirea se facea pe numarul de
inmatriculare, ca sir exact, iar functia doar insera, niciodata nu actualiza.

Vezi app/routers/receipts.py :: _sync_client_vehicol si migrarea veh02.

Rulabil cu pytest sau direct:  python -m tests.test_client_vehicol_sync
"""
from __future__ import annotations

from app.routers.receipts import _sync_client_vehicol, upsert_vehicol
from app.schemas.vehicol import VehicolCreate
from tests._harness import (
    client_garage, make_account, make_client, make_receipt, make_session,
    run, set_receipt_vehicol,
)


async def _fixture(plate="TM01ABC", **fields):
    db = await make_session()
    acc = await make_account(db)
    client = await make_client(db, acc)
    receipt = await make_receipt(db, acc)
    receipt.client_id = client.id
    vehicol = await set_receipt_vehicol(db, receipt, plate, **fields)
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()
    return db, acc, client, receipt, vehicol


# ─── Cazul raportat ───────────────────────────────────────────────────────────

async def test_first_save_creates_one_car():
    db, acc, client, _r, vehicol = await _fixture("TM01ABC", marca="Dacia")
    garage = await client_garage(db, client)
    assert len(garage) == 1
    assert garage[0].numar_masina == "TM01ABC"
    assert garage[0].marca == "Dacia"
    assert vehicol.client_vehicol_id == garage[0].id


async def test_editing_the_plate_renames_the_same_car():
    """Miezul bug-ului: dupa corectarea numarului trebuie sa ramana o masina."""
    db, acc, client, receipt, _v = await _fixture("TM01ABC", marca="Dacia")
    car_id = (await client_garage(db, client))[0].id

    vehicol = await set_receipt_vehicol(db, receipt, "TM01ABD")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()

    garage = await client_garage(db, client)
    assert len(garage) == 1, f"s-a creat o masina noua: {[c.numar_masina for c in garage]}"
    assert garage[0].id == car_id, "legatura s-a pierdut, masina veche a ramas orfana"
    assert garage[0].numar_masina == "TM01ABD"


async def test_editing_details_updates_the_existing_car():
    """Inainte, cu numarul neschimbat, randul „exista deja" si completarile nu
    ajungeau niciodata in fisa clientului."""
    db, acc, client, receipt, _v = await _fixture("TM01ABC")
    assert (await client_garage(db, client))[0].marca is None

    vehicol = await set_receipt_vehicol(
        db, receipt, "TM01ABC", marca="Dacia", model="Logan", vin="UU1DA0F1234567890",
        an_fabricatie=2018, numar_kilometrii=120_000,
    )
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()

    garage = await client_garage(db, client)
    assert len(garage) == 1
    car = garage[0]
    assert (car.marca, car.model, car.an_fabricatie) == ("Dacia", "Logan", 2018)
    assert car.vin == "UU1DA0F1234567890"
    assert car.numar_kilometrii == 120_000


async def test_the_same_plate_written_differently_is_the_same_car():
    db, acc, client, receipt, _v = await _fixture("TM01ABC")
    for variant in ("TM 01 ABC", "tm-01-abc", "  Tm01Abc "):
        vehicol = await set_receipt_vehicol(db, receipt, variant)
        await _sync_client_vehicol(db, acc.id, client.id, vehicol)
        await db.commit()
        garage = await client_garage(db, client)
        assert len(garage) == 1, f"{variant!r} a creat o masina noua"


async def test_display_keeps_what_the_operator_typed():
    """Normalizarea e cheie de potrivire, nu date: numarul se afiseaza cum a fost
    tastat ultima oara."""
    db, acc, client, receipt, _v = await _fixture("TM01ABC")
    vehicol = await set_receipt_vehicol(db, receipt, "TM 01 ABC")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()
    assert (await client_garage(db, client))[0].numar_masina == "TM 01 ABC"


# ─── Cazuri in care NU trebuie sa redenumim ───────────────────────────────────

async def test_switching_to_another_car_of_the_same_client_attaches_to_it():
    """Bonul a fost mutat pe a doua masina a clientului — asta nu e o corectura
    de tipar, deci prima masina trebuie lasata in pace."""
    db, acc, client, receipt, _v = await _fixture("TM01ABC", marca="Dacia")
    first_id = (await client_garage(db, client))[0].id

    # A doua masina intra in garaj printr-un alt bon.
    other_receipt = await make_receipt(db, acc)
    other_receipt.client_id = client.id
    other = await set_receipt_vehicol(db, other_receipt, "TM99XYZ", marca="Ford")
    await _sync_client_vehicol(db, acc.id, client.id, other)
    await db.commit()
    second_id = (await client_garage(db, client))[1].id

    # Bonul initial e comutat pe a doua masina.
    vehicol = await set_receipt_vehicol(db, receipt, "TM99XYZ")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()

    garage = await client_garage(db, client)
    assert [c.numar_masina for c in garage] == ["TM01ABC", "TM99XYZ"]
    assert garage[0].id == first_id and garage[0].marca == "Dacia"
    assert vehicol.client_vehicol_id == second_id


async def test_moving_the_receipt_to_another_client_does_not_touch_the_first_car():
    db, acc, client, receipt, _v = await _fixture("TM01ABC", marca="Dacia")
    other_client = await make_client(db, acc, "Ionescu Maria")
    await db.commit()

    receipt.client_id = other_client.id
    vehicol = await set_receipt_vehicol(db, receipt, "TM01ABD")
    await _sync_client_vehicol(db, acc.id, other_client.id, vehicol)
    await db.commit()

    first = await client_garage(db, client)
    assert [c.numar_masina for c in first] == ["TM01ABC"], "masina primului client a fost redenumita"
    second = await client_garage(db, other_client)
    assert [c.numar_masina for c in second] == ["TM01ABD"]


async def test_a_deleted_car_is_not_resurrected():
    db, acc, client, receipt, _v = await _fixture("TM01ABC")
    car = (await client_garage(db, client))[0]
    car.is_deleted = True
    await db.commit()

    vehicol = await set_receipt_vehicol(db, receipt, "TM01ABC")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()

    garage = await client_garage(db, client)
    assert len(garage) == 1 and garage[0].id != car.id


# ─── Protectia datelor deja stranse ───────────────────────────────────────────

async def test_a_quick_receipt_does_not_wipe_known_details():
    """Un bon pe care s-a trecut doar numarul nu are voie sa stearga marca si
    VIN-ul adunate anterior in fisa masinii."""
    db, acc, client, receipt, _v = await _fixture(
        "TM01ABC", marca="Dacia", model="Logan", vin="UU1DA0F1234567890",
    )
    vehicol = await set_receipt_vehicol(
        db, receipt, "TM01ABC", marca=None, model=None, vin=None,
    )
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()

    car = (await client_garage(db, client))[0]
    assert (car.marca, car.model, car.vin) == ("Dacia", "Logan", "UU1DA0F1234567890")


async def test_mileage_is_refreshed_on_every_visit():
    db, acc, client, receipt, _v = await _fixture("TM01ABC", numar_kilometrii=100_000)
    vehicol = await set_receipt_vehicol(db, receipt, "TM01ABC", numar_kilometrii=118_500)
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()
    assert (await client_garage(db, client))[0].numar_kilometrii == 118_500


async def test_empty_plate_is_ignored():
    db = await make_session()
    acc = await make_account(db)
    client = await make_client(db, acc)
    receipt = await make_receipt(db, acc)
    receipt.client_id = client.id
    vehicol = await set_receipt_vehicol(db, receipt, "   ")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()
    assert await client_garage(db, client) == []


# ─── Fluxul complet, prin endpoint ────────────────────────────────────────────

async def _put_vehicol(db, acc, receipt, **fields):
    """Apeleaza chiar handler-ul de PUT /receipts/{id}/vehicol, ca sa acoperim si
    ordinea operatiilor din el, nu doar functia de sincronizare."""
    import app.routers.receipts as mod

    # Bonul nu are inregistrare eFactura in test, deci nu e blocat; evitam totusi
    # interogarea, ca sa nu depindem de tabela de eFactura.
    original = mod._assert_not_locked
    async def _noop(*_a, **_kw): return None
    mod._assert_not_locked = _noop
    try:
        return await upsert_vehicol(
            receipt_id=receipt.id, body=VehicolCreate(**fields), db=db, account_id=acc.id,
        )
    finally:
        mod._assert_not_locked = original


async def test_endpoint_edit_keeps_one_car():
    """Regresia raportata, pe drumul real: salvezi devizul, apoi editezi masina."""
    db = await make_session()
    acc = await make_account(db)
    client = await make_client(db, acc)
    receipt = await make_receipt(db, acc)
    receipt.client_id = client.id
    await db.commit()

    await _put_vehicol(db, acc, receipt, numar_masina="TM01ABC", marca="Dacia")
    assert [c.numar_masina for c in await client_garage(db, client)] == ["TM01ABC"]

    v = await _put_vehicol(db, acc, receipt, numar_masina="TM 01 ABD", marca="Dacia", model="Logan")
    garage = await client_garage(db, client)
    assert [c.numar_masina for c in garage] == ["TM 01 ABD"], "masina s-a dublat la editare"
    assert garage[0].model == "Logan"
    assert v.client_vehicol_id == garage[0].id


async def test_endpoint_reuses_a_soft_deleted_snapshot():
    """`vehicole.receipt_id` e unic: un rand sters logic trebuie refolosit, altfel
    a doua salvare pica pe constrangere."""
    db = await make_session()
    acc = await make_account(db)
    receipt = await make_receipt(db, acc)
    await db.commit()

    first = await _put_vehicol(db, acc, receipt, numar_masina="TM01ABC")
    first.is_deleted = True
    await db.commit()

    second = await _put_vehicol(db, acc, receipt, numar_masina="TM99XYZ")
    assert second.id == first.id
    assert second.is_deleted is False
    assert second.numar_masina == "TM99XYZ"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de sincronizare client-vehicul trecute.")
