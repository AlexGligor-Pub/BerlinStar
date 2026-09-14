"""Cautarea dupa numarul de inmatriculare gaseste clientul, indiferent unde e placuta.

Bug-ul raportat din POS: tastezi numarul, clientul exista in Clienti, dar POS-ul
nu il identifica. Cauza: placuta se tine in doua locuri — coloana veche
`clienti.numar_masina` (scrisa de formularul de client nou) si tabela
`client_vehicole` (scrisa la salvarea unui deviz) — iar `/vehicole-by-plate`
citea doar garajul. Pe Cont Demo: 661 de clienti cu placuta, 14 randuri in garaj.

Doua remedii, amandoua acoperite aici:
  1. cautarea se uita si in coloana veche (clientii vechi devin gasibili);
  2. la creare/editare de client, placuta ajunge si in garaj (decalajul nu se reface).

Vezi app/routers/clienti.py :: search_vehicole_by_plate, _sync_client_plate_to_garage.

Rulabil cu pytest sau direct:  python -m tests.test_client_plate_lookup
"""
from __future__ import annotations

from app.routers.clienti import create_client, search_vehicole_by_plate, update_client
from app.schemas.client import ClientCreate
from tests._harness import (
    client_garage, make_account, make_client, make_receipt, make_session,
    run, set_receipt_vehicol,
)


async def _lookup(db, acc, plate: str):
    return await search_vehicole_by_plate(q_masina=plate, db=db, account_id=acc.id)


async def _client_with_plate_on_record(db, acc, plate: str, nume="Popescu Ion"):
    """Clientul „vechi": placuta doar pe fisa lui, niciun rand in garaj."""
    client = await make_client(db, acc, nume)
    client.numar_masina = plate
    await db.commit()
    return client


async def _client_with_car_in_garage(db, acc, plate: str, nume="Ionescu Maria"):
    """Clientul care a trecut prin POS: masina ajunge in garaj de pe deviz."""
    from app.routers.receipts import _sync_client_vehicol

    client = await make_client(db, acc, nume)
    receipt = await make_receipt(db, acc)
    receipt.client_id = client.id
    vehicol = await set_receipt_vehicol(db, receipt, plate, marca="Dacia")
    await _sync_client_vehicol(db, acc.id, client.id, vehicol)
    await db.commit()
    return client


# ─── Cazul raportat ───────────────────────────────────────────────────────────

async def test_plate_only_on_the_client_record_is_found():
    """Miezul bug-ului: clientul creat din formular, fara sa fi trecut prin POS."""
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_plate_on_record(db, acc, "DJ-44-TIH", "Anamaria Gheorghiu")

    found = await _lookup(db, acc, "DJ-44-TIH")
    assert len(found) == 1, "clientul cu placuta pe fisa nu a fost gasit"
    assert found[0].client.id == client.id
    assert found[0].client.nume == "Anamaria Gheorghiu"
    assert found[0].vehicol.numar_masina == "DJ-44-TIH"


async def test_plate_only_on_the_client_record_matches_normalized():
    """Placuta se tasteaza in trei feluri; potrivirea e pe forma canonica."""
    db = await make_session()
    acc = await make_account(db)
    await _client_with_plate_on_record(db, acc, "TM-01-ABC")

    for variant in ("TM01ABC", "TM 01 ABC", "tm-01-abc", "  Tm01Abc  "):
        found = await _lookup(db, acc, variant)
        assert len(found) == 1, f"{variant!r} nu a gasit clientul"


async def test_display_keeps_the_plate_as_stored():
    """Normalizarea e cheie de potrivire, nu date."""
    db = await make_session()
    acc = await make_account(db)
    await _client_with_plate_on_record(db, acc, "TM 01 ABC")
    found = await _lookup(db, acc, "tm01abc")
    assert found[0].vehicol.numar_masina == "TM 01 ABC"


# ─── Ce functiona deja nu se strica ───────────────────────────────────────────

async def test_car_in_the_garage_is_still_found():
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_car_in_garage(db, acc, "TM99XYZ")

    found = await _lookup(db, acc, "TM99XYZ")
    assert len(found) == 1
    assert found[0].client.id == client.id
    assert found[0].vehicol.marca == "Dacia", "detaliile masinii din garaj s-au pierdut"
    assert found[0].vehicol.id != 0, "masina reala din garaj trebuie sa aiba id-ul ei"


async def test_the_same_plate_is_not_returned_twice():
    """Clientul are placuta si pe fisa si in garaj — un singur rezultat."""
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_car_in_garage(db, acc, "TM01ABC")
    client.numar_masina = "TM 01 ABC"  # aceeasi masina, scrisa altfel
    await db.commit()

    found = await _lookup(db, acc, "TM01ABC")
    assert len(found) == 1, f"rezultat dublat: {[f.vehicol.numar_masina for f in found]}"
    assert found[0].vehicol.marca == "Dacia", "s-a intors randul sintetic, nu masina reala"


async def test_two_different_clients_on_the_same_plate_both_come_back():
    """POS-ul deschide modalul de alegere; are nevoie de ambii."""
    db = await make_session()
    acc = await make_account(db)
    await _client_with_car_in_garage(db, acc, "TM01ABC", "Cu garaj")
    await _client_with_plate_on_record(db, acc, "TM01ABC", "Fara garaj")

    found = await _lookup(db, acc, "TM01ABC")
    assert sorted(f.client.nume for f in found) == ["Cu garaj", "Fara garaj"]


# ─── Limite ───────────────────────────────────────────────────────────────────

async def test_an_unknown_plate_finds_nothing():
    db = await make_session()
    acc = await make_account(db)
    await _client_with_plate_on_record(db, acc, "TM01ABC")
    assert await _lookup(db, acc, "B99ZZZ") == []


async def test_an_empty_plate_finds_nothing():
    """Altfel `replace()` pe coloana ar potrivi clientii fara placuta."""
    db = await make_session()
    acc = await make_account(db)
    await make_client(db, acc)
    await db.commit()
    for blank in ("", "   ", "-", " - "):
        assert await _lookup(db, acc, blank) == [], f"{blank!r} a intors rezultate"


async def test_a_deleted_client_is_not_returned():
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_plate_on_record(db, acc, "TM01ABC")
    client.is_deleted = True
    await db.commit()
    assert await _lookup(db, acc, "TM01ABC") == []


async def test_another_account_does_not_leak():
    db = await make_session()
    mine = await make_account(db, "firma")
    theirs = await make_account(db, "alta", code="alta")
    await _client_with_plate_on_record(db, theirs, "TM01ABC", "Clientul altcuiva")

    assert await _lookup(db, mine, "TM01ABC") == []


# ─── Remediul 2: placuta ajunge si in garaj ───────────────────────────────────

async def test_creating_a_client_with_a_plate_fills_the_garage():
    """Fara asta, fiecare client nou reface decalajul."""
    db = await make_session()
    acc = await make_account(db)

    client = await create_client(
        body=ClientCreate(nume="Popescu Ion", numar_masina="TM01ABC"),
        db=db, account_id=acc.id,
    )

    garage = await client_garage(db, client)
    assert [c.numar_masina for c in garage] == ["TM01ABC"]
    assert garage[0].account_id == acc.id


async def test_creating_a_client_without_a_plate_adds_no_car():
    db = await make_session()
    acc = await make_account(db)
    client = await create_client(
        body=ClientCreate(nume="Fara masina"), db=db, account_id=acc.id,
    )
    assert await client_garage(db, client) == []


async def test_creating_a_client_with_a_blank_plate_adds_no_car():
    db = await make_session()
    acc = await make_account(db)
    client = await create_client(
        body=ClientCreate(nume="Spatii", numar_masina="   "), db=db, account_id=acc.id,
    )
    assert await client_garage(db, client) == []


async def test_editing_an_old_client_backfills_the_garage():
    """Clientii vechi se repara pe masura ce sunt atinsi."""
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_plate_on_record(db, acc, "TM01ABC")
    assert await client_garage(db, client) == []

    await update_client(
        client_id=client.id,
        body=ClientCreate(nume=client.nume, numar_masina="TM01ABC"),
        db=db, account_id=acc.id,
    )
    assert [c.numar_masina for c in await client_garage(db, client)] == ["TM01ABC"]


async def test_editing_repeatedly_does_not_pile_up_cars():
    db = await make_session()
    acc = await make_account(db)
    client = await create_client(
        body=ClientCreate(nume="Popescu Ion", numar_masina="TM01ABC"),
        db=db, account_id=acc.id,
    )
    for plate in ("TM01ABC", "TM 01 ABC", "tm-01-abc"):
        await update_client(
            client_id=client.id,
            body=ClientCreate(nume="Popescu Ion", numar_masina=plate),
            db=db, account_id=acc.id,
        )
    garage = await client_garage(db, client)
    assert len(garage) == 1, f"masina s-a dublat: {[c.numar_masina for c in garage]}"


async def test_changing_the_plate_keeps_the_old_car():
    """Nu putem deosebi corectia de tipar de „clientul are alta masina", deci nu
    redenumim: un rand in plus il sterge operatorul, km/VIN suprascrise nu."""
    db = await make_session()
    acc = await make_account(db)
    client = await _client_with_car_in_garage(db, acc, "TM01ABC")

    await update_client(
        client_id=client.id,
        body=ClientCreate(nume=client.nume, numar_masina="TM99XYZ"),
        db=db, account_id=acc.id,
    )

    garage = await client_garage(db, client)
    assert [c.numar_masina for c in garage] == ["TM01ABC", "TM99XYZ"]
    assert garage[0].marca == "Dacia", "masina veche a fost rescrisa"


async def test_a_new_client_is_found_by_plate_end_to_end():
    """Drumul complet al bug-ului raportat: creezi clientul, apoi POS-ul il gaseste."""
    db = await make_session()
    acc = await make_account(db)
    created = await create_client(
        body=ClientCreate(nume="Popescu Ion", numar_masina="TM-01-ABC"),
        db=db, account_id=acc.id,
    )

    found = await _lookup(db, acc, "tm 01 abc")
    assert len(found) == 1
    assert found[0].client.id == created.id
    assert found[0].vehicol.id != 0, "trebuie sa fie masina reala din garaj"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de cautare dupa placuta trecute.")
