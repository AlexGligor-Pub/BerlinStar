"""Izolare intre conturi: helperul comun care verifica id-urile primite de la client.

Rulabil cu pytest sau direct:  python -m tests.test_ownership_helper  (din backend/)
"""
from __future__ import annotations

from app.models.client import Client
from app.models.employee import Employee
from app.models.marca_anvelopa import MarcaAnvelopa
from app.models.receipt import ReceiptItem
from app.utils.ownership import assert_all_owned, assert_owned
from tests._harness import (
    add_line, make_account, make_client, make_employee, make_receipt, make_session,
    raises_http, run,
)


async def _fixture():
    db = await make_session()
    acc = await make_account(db)
    other = await make_account(db, username="alta", code="alta")
    emp = await make_employee(db, acc, "Ion")
    emp2 = await make_employee(db, acc, "Maria")
    foreign = await make_employee(db, other, "Strain")
    await db.commit()
    return db, acc, other, emp, emp2, foreign


async def test_own_row_passes():
    db, acc, other, emp, _, foreign = await _fixture()
    await assert_owned(db, Employee, emp.id, acc.id, what="Angajatul")
    await assert_owned(db, Employee, foreign.id, other.id, what="Angajatul")


async def test_foreign_and_missing_give_the_same_400():
    db, acc, _, _, _, foreign = await _fixture()
    d_foreign = await raises_http(400, assert_owned(db, Employee, foreign.id, acc.id, what="Angajatul"))
    d_missing = await raises_http(400, assert_owned(db, Employee, 99999, acc.id, what="Angajatul"))
    # Acelasi raspuns: altfel s-ar putea afla ce id-uri exista in alte conturi.
    assert d_foreign == d_missing == "Angajatul nu exista."


async def test_soft_deleted_row_raises_unless_allowed():
    db, acc, _, emp, *_ = await _fixture()
    emp.is_deleted = True
    await db.commit()
    detail = await raises_http(400, assert_owned(db, Employee, emp.id, acc.id, what="Angajatul"))
    assert detail == "Angajatul nu exista."
    await assert_owned(db, Employee, emp.id, acc.id, what="Angajatul", allow_deleted=True)


async def test_allow_deleted_does_not_open_other_accounts():
    db, acc, _, _, _, foreign = await _fixture()
    foreign.is_deleted = True
    await db.commit()
    await raises_http(
        400, assert_owned(db, Employee, foreign.id, acc.id, what="Angajatul", allow_deleted=True)
    )
    await raises_http(
        400, assert_all_owned(db, Employee, [foreign.id], acc.id, what="Angajatii", allow_deleted=True)
    )


async def test_none_and_empty_are_noops():
    db, acc, *_ = await _fixture()
    await assert_owned(db, Employee, None, acc.id, what="Angajatul")
    await assert_all_owned(db, Employee, [], acc.id, what="Angajatii")
    await assert_all_owned(db, Employee, None, acc.id, what="Angajatii")
    await assert_all_owned(db, Employee, [None], acc.id, what="Angajatii")


async def test_list_all_own_passes_with_duplicates():
    db, acc, _, emp, emp2, _ = await _fixture()
    await assert_all_owned(db, Employee, [emp.id, emp2.id, emp.id, None], acc.id, what="Angajatii")
    await assert_all_owned(db, Employee, (i for i in (emp.id, emp2.id)), acc.id, what="Angajatii")


async def test_list_with_one_foreign_or_missing_id_raises():
    db, acc, _, emp, emp2, foreign = await _fixture()
    d_foreign = await raises_http(
        400, assert_all_owned(db, Employee, [emp.id, foreign.id, emp2.id], acc.id, what="Angajatii")
    )
    d_missing = await raises_http(
        400, assert_all_owned(db, Employee, [emp.id, 99999], acc.id, what="Angajatii")
    )
    assert d_foreign == d_missing == "Angajatii nu exista."


async def test_list_with_one_deleted_id_raises_unless_allowed():
    db, acc, _, emp, emp2, _ = await _fixture()
    emp2.is_deleted = True
    await db.commit()
    await raises_http(400, assert_all_owned(db, Employee, [emp.id, emp2.id], acc.id, what="Angajatii"))
    await assert_all_owned(db, Employee, [emp.id, emp2.id], acc.id, what="Angajatii", allow_deleted=True)


async def test_same_id_in_another_table_does_not_pass():
    """Verificarea e pe tabelul cerut: un client strain nu trece doar pentru ca
    exista un angajat propriu cu acelasi id numeric."""
    db, acc, other, emp, *_ = await _fixture()
    mine = await make_client(db, acc)
    theirs = await make_client(db, other, "Strain SRL")
    await db.commit()
    await assert_owned(db, Client, mine.id, acc.id, what="Clientul")
    detail = await raises_http(400, assert_owned(db, Client, theirs.id, acc.id, what="Clientul"))
    assert detail == "Clientul nu exista."
    assert emp.id is not None


async def test_model_without_is_deleted_checks_only_the_account():
    db, acc, other, *_ = await _fixture()
    receipt = await make_receipt(db, acc)
    line = await add_line(db, receipt, "Manopera", "50.00")
    line.account_id = acc.id
    await db.commit()
    await assert_owned(db, ReceiptItem, line.id, acc.id, what="Linia")
    await assert_all_owned(db, ReceiptItem, [line.id], acc.id, what="Liniile")
    await raises_http(400, assert_owned(db, ReceiptItem, line.id, other.id, what="Linia"))
    await raises_http(400, assert_all_owned(db, ReceiptItem, [line.id], other.id, what="Liniile"))


async def test_global_table_is_a_programming_error():
    """Un tabel fara account_id nu poate fi „al contului": helperul refuza in loc
    sa lase verificarea sa treaca in tacere."""
    db, acc, *_ = await _fixture()
    for call in (
        assert_owned(db, MarcaAnvelopa, 1, acc.id, what="Marca"),
        assert_all_owned(db, MarcaAnvelopa, [1], acc.id, what="Marcile"),
    ):
        try:
            await call
        except TypeError:
            continue
        raise AssertionError("astept TypeError pentru un model fara account_id")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de verificare a apartenentei trecute.")
