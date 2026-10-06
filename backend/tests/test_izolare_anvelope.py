"""Izolare intre conturi la anvelope: client_id si nomenclatoarele (dimensiune,
profil, cod DOT) primite de la client trebuie sa apartina contului apelantului.

Rulabil cu pytest sau direct:  python -m tests.test_izolare_anvelope  (din backend/)
"""
from __future__ import annotations

from app.models.anvelopa import Anvelopa
from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.profil_anvelopa import ProfilAnvelopa
from app.routers.anvelope import create_anvelopa, get_anvelopa, list_anvelope, update_anvelopa
from app.schemas.anvelopa import AnvelopaCreate, AnvelopaUpdate
from tests._harness import make_account, make_client, make_session, raises_http, run

FIELDS = ("dimensiune_id", "profil_id", "dot_id")
MODELS = {"dimensiune_id": DimensiuneAnvelopa, "profil_id": ProfilAnvelopa, "dot_id": CodDotAnvelopa}


async def _nomenclator(db, account, valoare: str) -> dict:
    """Cate un rand din fiecare nomenclator, pe contul dat: {camp: rand}."""
    rows = {field: model(account_id=account.id, valoare=valoare) for field, model in MODELS.items()}
    db.add_all(rows.values())
    await db.flush()
    return rows


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    client = await make_client(db, acc)
    foreign_client = await make_client(db, other, "Strain Secret")
    own = await _nomenclator(db, acc, "propriu")
    own2 = await _nomenclator(db, acc, "propriu2")
    foreign = await _nomenclator(db, other, "strain")
    await db.commit()
    return db, acc, other, client, foreign_client, own, own2, foreign


async def _count(db, acc) -> int:
    page = await list_anvelope(client_id=None, last_id=None, limit=200, db=db, account_id=acc.id)
    return len(page.items)


async def test_create_with_own_ids_works():
    db, acc, _, client, _, own, *_ = await _fixture()
    body = AnvelopaCreate(client_id=client.id, **{f: own[f].id for f in FIELDS})
    a = await create_anvelopa(body, db=db, account_id=acc.id)
    assert a["client_id"] == client.id
    assert [a[f] for f in FIELDS] == [own[f].id for f in FIELDS]
    assert (a["dimensiune_valoare"], a["profil_valoare"], a["dot_valoare"]) == ("propriu",) * 3


async def test_create_without_ids_is_allowed():
    db, acc, *_ = await _fixture()
    a = await create_anvelopa(AnvelopaCreate(), db=db, account_id=acc.id)
    assert a["client_id"] is None and all(a[f] is None for f in FIELDS)


async def test_create_rejects_foreign_or_missing_or_deleted_client():
    db, acc, _, client, foreign_client, *_ = await _fixture()
    strain = await raises_http(400, create_anvelopa(AnvelopaCreate(client_id=foreign_client.id), db=db, account_id=acc.id))
    lipsa = await raises_http(400, create_anvelopa(AnvelopaCreate(client_id=99999), db=db, account_id=acc.id))
    assert strain == lipsa
    client.is_deleted = True
    await db.commit()
    await raises_http(400, create_anvelopa(AnvelopaCreate(client_id=client.id), db=db, account_id=acc.id))
    assert await _count(db, acc) == 0


async def test_create_rejects_foreign_or_missing_nomenclator():
    db, acc, _, _, _, _, _, foreign = await _fixture()
    for f in FIELDS:
        strain = await raises_http(400, create_anvelopa(AnvelopaCreate(**{f: foreign[f].id}), db=db, account_id=acc.id))
        lipsa = await raises_http(400, create_anvelopa(AnvelopaCreate(**{f: 99999}), db=db, account_id=acc.id))
        assert strain == lipsa
    assert await _count(db, acc) == 0


async def test_create_accepts_own_deleted_nomenclator_but_not_foreign_deleted():
    """„Copy" si sugestia din montaj retrimit id-uri de nomenclator sterse intre
    timp din contul propriu: salvarea trebuie sa mearga. Un rand sters al altui
    cont ramane refuzat."""
    db, acc, _, _, _, own, _, foreign = await _fixture()
    for f in FIELDS:
        own[f].is_deleted = True
        foreign[f].is_deleted = True
    await db.commit()
    a = await create_anvelopa(AnvelopaCreate(**{f: own[f].id for f in FIELDS}), db=db, account_id=acc.id)
    assert [a[f] for f in FIELDS] == [own[f].id for f in FIELDS]
    for f in FIELDS:
        await raises_http(400, create_anvelopa(AnvelopaCreate(**{f: foreign[f].id}), db=db, account_id=acc.id))
    assert await _count(db, acc) == 1


async def test_patch_with_own_ids_works_and_can_clear():
    db, acc, _, _, _, own, own2, _ = await _fixture()
    a = await create_anvelopa(AnvelopaCreate(**{f: own[f].id for f in FIELDS}), db=db, account_id=acc.id)
    a = await update_anvelopa(a["id"], AnvelopaUpdate(**{f: own2[f].id for f in FIELDS}), db=db, account_id=acc.id)
    assert [a[f] for f in FIELDS] == [own2[f].id for f in FIELDS]
    a = await update_anvelopa(a["id"], AnvelopaUpdate(**{f: None for f in FIELDS}), db=db, account_id=acc.id)
    assert all(a[f] is None for f in FIELDS)


async def test_patch_rejects_foreign_or_missing_and_keeps_previous():
    db, acc, _, _, _, own, _, foreign = await _fixture()
    a = await create_anvelopa(AnvelopaCreate(**{f: own[f].id for f in FIELDS}), db=db, account_id=acc.id)
    for f in FIELDS:
        strain = await raises_http(400, update_anvelopa(
            a["id"], AnvelopaUpdate(comments="x", **{f: foreign[f].id}), db=db, account_id=acc.id))
        lipsa = await raises_http(400, update_anvelopa(
            a["id"], AnvelopaUpdate(comments="x", **{f: 99999}), db=db, account_id=acc.id))
        assert strain == lipsa
    got = await get_anvelopa(a["id"], db=db, account_id=acc.id)
    assert [got[f] for f in FIELDS] == [own[f].id for f in FIELDS]
    assert got["comments"] is None
    assert (got["dimensiune_valoare"], got["profil_valoare"], got["dot_valoare"]) == ("propriu",) * 3


async def test_patch_unchanged_legacy_ids_still_work():
    """Anvelopa veche, legata de nomenclatoare sterse intre timp: editarea care
    retrimite aceleasi id-uri nu are voie sa pice."""
    db, acc, _, _, _, own, own2, _ = await _fixture()
    a = await create_anvelopa(AnvelopaCreate(**{f: own[f].id for f in FIELDS}), db=db, account_id=acc.id)
    for f in FIELDS:
        own[f].is_deleted = True
    await db.commit()
    same = {f: own[f].id for f in FIELDS}
    a = await update_anvelopa(a["id"], AnvelopaUpdate(comments="uzata", **same), db=db, account_id=acc.id)
    assert a["comments"] == "uzata"
    assert [a[f] for f in FIELDS] == [own[f].id for f in FIELDS]
    # campuri netrimise deloc: nicio verificare
    a = await update_anvelopa(a["id"], AnvelopaUpdate(adancime=5.5), db=db, account_id=acc.id)
    assert a["adancime"] == 5.5
    # o valoare NOUA, stearsa, dar din contul propriu: acceptata, ca la creare
    own2["dimensiune_id"].is_deleted = True
    await db.commit()
    a = await update_anvelopa(
        a["id"], AnvelopaUpdate(dimensiune_id=own2["dimensiune_id"].id), db=db, account_id=acc.id)
    assert a["dimensiune_id"] == own2["dimensiune_id"].id


async def test_legacy_foreign_nomenclator_is_rendered_blank():
    """Anvelopa salvata inainte de verificari, legata de nomenclatoarele altui
    cont: id-urile raman, valorile celuilalt cont nu se afiseaza, iar editarea
    care retrimite aceleasi id-uri merge."""
    db, acc, _, _, _, _, _, foreign = await _fixture()
    ids = {f: foreign[f].id for f in FIELDS}
    veche = Anvelopa(account_id=acc.id, **ids)
    db.add(veche)
    await db.commit()
    anv_id = veche.id

    def _check(a: dict) -> None:
        assert [a[f] for f in FIELDS] == [ids[f] for f in FIELDS]
        assert (a["dimensiune_valoare"], a["profil_valoare"], a["dot_valoare"]) == (None, None, None)

    _check(await get_anvelopa(anv_id, db=db, account_id=acc.id))
    page = await list_anvelope(client_id=None, last_id=None, limit=200, db=db, account_id=acc.id)
    _check(next(i for i in page.items if i["id"] == anv_id))
    a = await update_anvelopa(anv_id, AnvelopaUpdate(comments="uzata", **ids), db=db, account_id=acc.id)
    assert a["comments"] == "uzata"
    _check(a)


async def test_patch_foreign_anvelopa_is_404():
    db, acc, other, _, _, own, *_ = await _fixture()
    a = await create_anvelopa(AnvelopaCreate(), db=db, account_id=other.id)
    await raises_http(404, update_anvelopa(
        a["id"], AnvelopaUpdate(dimensiune_id=own["dimensiune_id"].id), db=db, account_id=acc.id))


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii izolare anvelope trecute.")
