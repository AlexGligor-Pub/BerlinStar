"""Izolare intre conturi la montajul de roti: bonul si nomenclatoarele din body.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_montaj_roti  (din backend/)
"""
from __future__ import annotations

from sqlalchemy import select

from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.montaj_rota import MontajRota
from app.models.profil_anvelopa import ProfilAnvelopa
from app.routers.montaj_roti import bulk_upsert, list_montaj_roti
from app.schemas.montaj_rota import MontajRotaCreate, MontajRotiBulkUpsert
from tests._harness import make_account, make_receipt, make_session, raises_http, run


async def _nom(db, model, account, valoare):
    row = model(account_id=account.id, valoare=valoare)
    db.add(row)
    await db.flush()
    return row


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    own = {
        "receipt": await make_receipt(db, acc),
        "dim": await _nom(db, DimensiuneAnvelopa, acc, "205/55 R16"),
        "prof": await _nom(db, ProfilAnvelopa, acc, "Alpin 6"),
        "dot": await _nom(db, CodDotAnvelopa, acc, "1224"),
    }
    foreign = {
        "receipt": await make_receipt(db, other),
        "dim": await _nom(db, DimensiuneAnvelopa, other, "STRAIN-DIM"),
        "prof": await _nom(db, ProfilAnvelopa, other, "STRAIN-PROF"),
        "dot": await _nom(db, CodDotAnvelopa, other, "STRAIN-DOT"),
    }
    await db.commit()
    return db, acc, other, own, foreign


def _body(receipt_id: int, *items: dict) -> MontajRotiBulkUpsert:
    return MontajRotiBulkUpsert(
        receipt_id=receipt_id, items=[MontajRotaCreate(**it) for it in items]
    )


async def _rows(db) -> list[MontajRota]:
    return list((await db.execute(select(MontajRota).order_by(MontajRota.id))).scalars().all())


async def test_own_ids_are_stored_and_resolved():
    db, acc, _, own, _ = await _fixture()
    out = await bulk_upsert(
        _body(own["receipt"].id, dict(
            dimensiune_id=own["dim"].id, profil_id=own["prof"].id, dot_id=own["dot"].id,
        )),
        db=db, account_id=acc.id,
    )
    assert len(out) == 1
    assert out[0]["receipt_id"] == own["receipt"].id
    assert (out[0]["dimensiune_valoare"], out[0]["profil_valoare"], out[0]["dot_valoare"]) == (
        "205/55 R16", "Alpin 6", "1224",
    )
    listed = await list_montaj_roti(receipt_id=own["receipt"].id, db=db, account_id=acc.id)
    assert [r["id"] for r in listed] == [out[0]["id"]]


async def test_items_without_nomenclature_are_allowed():
    db, acc, _, own, _ = await _fixture()
    out = await bulk_upsert(_body(own["receipt"].id, {}, {}), db=db, account_id=acc.id)
    assert len(out) == 2
    assert out[0]["dimensiune_id"] is None and out[0]["dimensiune_valoare"] is None


async def test_foreign_missing_or_deleted_receipt_is_rejected_with_same_answer():
    db, acc, other, own, foreign = await _fixture()
    d_foreign = await raises_http(400, bulk_upsert(_body(foreign["receipt"].id, {}), db=db, account_id=acc.id))
    d_missing = await raises_http(400, bulk_upsert(_body(99999, {}), db=db, account_id=acc.id))
    own["receipt"].is_deleted = True
    await db.commit()
    d_deleted = await raises_http(400, bulk_upsert(_body(own["receipt"].id, {}), db=db, account_id=acc.id))
    assert d_foreign == d_missing == d_deleted
    assert await _rows(db) == []
    # Proprietarul bonului il poate folosi in continuare.
    out = await bulk_upsert(_body(foreign["receipt"].id, {}), db=db, account_id=other.id)
    assert len(out) == 1


async def test_foreign_or_missing_nomenclature_is_rejected_and_nothing_changes():
    db, acc, _, own, foreign = await _fixture()
    first = await bulk_upsert(
        _body(own["receipt"].id, dict(dimensiune_id=own["dim"].id)), db=db, account_id=acc.id,
    )
    for field, key in (("dimensiune_id", "dim"), ("profil_id", "prof"), ("dot_id", "dot")):
        d_foreign = await raises_http(400, bulk_upsert(
            _body(own["receipt"].id, {}, {field: foreign[key].id}), db=db, account_id=acc.id,
        ))
        d_missing = await raises_http(400, bulk_upsert(
            _body(own["receipt"].id, {field: 99999}), db=db, account_id=acc.id,
        ))
        assert d_foreign == d_missing
    # Nimic salvat si rotile existente nu au fost sterse de cererea respinsa.
    rows = await _rows(db)
    assert [(r.id, r.is_deleted, r.dimensiune_id) for r in rows] == [
        (first[0]["id"], False, own["dim"].id),
    ]


async def test_resave_replaces_rows_and_keeps_own_ids_working():
    db, acc, _, own, _ = await _fixture()
    item = dict(dimensiune_id=own["dim"].id, profil_id=own["prof"].id, dot_id=own["dot"].id)
    first = await bulk_upsert(_body(own["receipt"].id, item), db=db, account_id=acc.id)
    second = await bulk_upsert(_body(own["receipt"].id, item, item), db=db, account_id=acc.id)
    assert len(second) == 2
    listed = await list_montaj_roti(receipt_id=own["receipt"].id, db=db, account_id=acc.id)
    assert [r["id"] for r in listed] == [r["id"] for r in second]
    assert first[0]["id"] not in [r["id"] for r in listed]


async def test_soft_deleted_own_nomenclature_is_still_accepted():
    db, acc, _, own, _ = await _fixture()
    own["dim"].is_deleted = True
    await db.commit()
    out = await bulk_upsert(
        _body(own["receipt"].id, dict(dimensiune_id=own["dim"].id)), db=db, account_id=acc.id,
    )
    assert out[0]["dimensiune_id"] == own["dim"].id
    assert out[0]["dimensiune_valoare"] == "205/55 R16"


async def test_unchanged_legacy_ids_on_the_receipt_still_save():
    db, acc, _, own, foreign = await _fixture()
    # Rand vechi, scris inainte de verificare: arata spre nomenclatoare straine.
    db.add(MontajRota(
        account_id=acc.id, receipt_id=own["receipt"].id,
        dimensiune_id=foreign["dim"].id, profil_id=foreign["prof"].id, dot_id=foreign["dot"].id,
    ))
    await db.commit()
    out = await bulk_upsert(
        _body(
            own["receipt"].id,
            dict(dimensiune_id=foreign["dim"].id, profil_id=foreign["prof"].id, dot_id=foreign["dot"].id),
            dict(dimensiune_id=own["dim"].id),
        ),
        db=db, account_id=acc.id,
    )
    assert [r["dimensiune_id"] for r in out] == [foreign["dim"].id, own["dim"].id]
    # Valoarea straina nu e niciodata intoarsa.
    assert out[0]["dimensiune_valoare"] is None
    assert out[0]["profil_valoare"] is None and out[0]["dot_valoare"] is None
    assert out[1]["dimensiune_valoare"] == "205/55 R16"


async def test_legacy_id_does_not_unlock_other_fields_or_other_receipts():
    db, acc, _, own, foreign = await _fixture()
    db.add(MontajRota(
        account_id=acc.id, receipt_id=own["receipt"].id, dimensiune_id=foreign["dim"].id,
    ))
    receipt2 = await make_receipt(db, acc)
    await db.commit()
    # Pe alt bon al aceluiasi cont, id-ul strain e unul nou → respins.
    await raises_http(400, bulk_upsert(
        _body(receipt2.id, dict(dimensiune_id=foreign["dim"].id)), db=db, account_id=acc.id,
    ))
    # Pe acelasi bon, doar campul deja salvat e scutit, nu si celelalte.
    await raises_http(400, bulk_upsert(
        _body(own["receipt"].id, dict(dimensiune_id=foreign["dim"].id, profil_id=foreign["prof"].id)),
        db=db, account_id=acc.id,
    ))
    rows = await _rows(db)
    assert len(rows) == 1 and rows[0].is_deleted is False


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare montaj roti trecute.")
