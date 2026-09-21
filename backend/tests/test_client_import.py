"""Importul de clienti din CSV (Configurări › Import › Clienți).

Vezi app/services/client_import.py. Acoperim: recunoasterea antetului, datele
lipsa, erorile, duplicatele, verificarea fara scriere, sesiunea de import cu
randurile de rezolvat (completare, import, respingere, readucere) si izolarea
pe cont.

Rulabil cu pytest sau direct:  python -m tests.test_client_import
"""
from __future__ import annotations

from sqlalchemy import select

from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.import_session import ImportRow
from app.schemas.client import CNP_PLACEHOLDER
from app.services import client_import as svc
from tests._harness import make_account, make_client, make_session, run


def _csv(text: str, enc: str = "utf-8") -> bytes:
    return text.strip("\n").encode(enc)


async def _clients(db, acc):
    return (await db.execute(
        select(Client).where(Client.account_id == acc.id).order_by(Client.id)
    )).scalars().all()


async def _rows(db, session):
    return (await db.execute(
        select(ImportRow).where(ImportRow.session_id == session.id).order_by(ImportRow.row_number)
    )).scalars().all()


async def _import(db, acc, text: str, enc: str = "utf-8"):
    session = await svc.create_session(db, acc.id, _csv(text, enc), filename="a.csv", actor="admin")
    return session, await _rows(db, session)


# ─── Fisierul ─────────────────────────────────────────────────────────────────

async def test_clean_rows_are_imported_directly_with_romanian_headers():
    db = await make_session()
    acc = await make_account(db)
    session, rows = await _import(db, acc,
        "Nume;Tip;CUI / CNP;Telefon;Număr mașină\n"
        "Popescu Ion;fizic;1850101123456;0722111222;TM01ABC\n"
        "Auto SRL;PJ;RO123456;0256000000;\n"
        "Maria;fizic;;;\n"                     # CNP lipsa = placeholder normal, nu problema
    )
    assert session.delimiter == ";" and session.total_rows == 3
    assert [r.status for r in rows] == ["imported"] * 3
    clients = await _clients(db, acc)
    assert [(c.nume, c.tip, c.cui) for c in clients] == [
        ("Popescu Ion", "fizic", "1850101123456"),
        ("Auto SRL", "juridic", "RO123456"),
        ("Maria", "fizic", CNP_PLACEHOLDER),
    ]
    assert all(r.client_id and r.resolved_by == "admin" for r in rows)
    garage = (await db.execute(select(ClientVehicol))).scalars().all()
    assert [(g.client_id, g.numar_masina) for g in garage] == [(clients[0].id, "TM01ABC")]


async def test_preview_writes_nothing():
    db = await make_session()
    acc = await make_account(db)
    rep = await svc.preview(db, acc.id, _csv("nume,tip,telefon\nIon,fizic,0722\n,fizic,\n"))
    assert (rep["to_import"], rep["to_review"], rep["missing"]) == (1, 1, 1)
    assert await _clients(db, acc) == []
    assert (await db.execute(select(ImportRow))).scalars().all() == []


async def test_unreadable_files_raise():
    db = await make_session()
    acc = await make_account(db)
    for raw in (b"", b"coloana1;coloana2\n1;2\n", b"nume\n"):
        try:
            await svc.preview(db, acc.id, raw)
        except svc.ImportFileError:
            continue
        raise AssertionError(f"trebuia respins: {raw!r}")


async def test_cp1250_file_from_excel():
    db = await make_session()
    acc = await make_account(db)
    session, _rows_ = await _import(db, acc, "nume;tip;adresa\nŞtefan;fizic;Piaţa Unirii\n", "cp1250")
    assert session.encoding == "cp1250"
    assert (await _clients(db, acc))[0].nume == "Ştefan"


# ─── Randurile cu probleme ajung in lista de rezolvat ─────────────────────────

async def test_problem_rows_stay_pending_with_their_issue():
    db = await make_session()
    acc = await make_account(db)
    existing = await make_client(db, acc, nume="Vechi")
    existing.tip, existing.cui = "juridic", "RO123"
    await db.commit()
    _s, rows = await _import(db, acc,
        "nume;tip;cui;telefon\n"
        "Bun;fizic;1850101123456;\n"
        ";fizic;;0722\n"                      # nume lipsa
        "Rau;altceva;;\n"                     # tip invalid
        "Rau cnp;fizic;123;\n"                # CNP invalid
        "Alt nume;juridic;123;\n"             # duplicat cu clientul existent (RO123)
        "Ion;fizic;;0722 111 222\n"
        "ion;fizic;;0722111222\n"             # duplicat in fisier
    )
    assert [(r.status, r.issue) for r in rows] == [
        ("imported", None),
        ("pending", "missing"),
        ("pending", "error"),
        ("pending", "error"),
        ("pending", "duplicate"),
        ("imported", None),
        ("pending", "duplicate"),
    ]
    assert "NECOMPLETAT (rând 3)" in rows[1].messages[0]
    assert "Tip necunoscut" in rows[2].messages[0]
    assert "CNP invalid" in rows[3].messages[0]
    assert "Vechi" in rows[4].messages[0] and "rândul 7" in rows[6].messages[0]
    assert len(await _clients(db, acc)) == 3  # Vechi + Bun + Ion
    assert await svc.pending_summary(db, acc.id) == {"sessions": 1, "rows": 5}


async def test_missing_tip_defaults_to_fizic():
    """`tip` e optional: fara el clientul e persoana fizica, importat direct."""
    db = await make_session()
    acc = await make_account(db)
    session, rows = await _import(db, acc, "nume;cui\nIon;\nPopescu;1850101123456\nFirma SRL;RO123\n")
    assert not any("Tip" in w for w in session.file_warnings)
    assert [(r.status, r.issue) for r in rows] == [
        ("imported", None), ("imported", None), ("pending", "error"),
    ]
    assert [c.tip for c in await _clients(db, acc)] == ["fizic", "fizic"]
    assert "juridic" in rows[2].messages[-1]


async def test_multiple_phones_separated_by_comma():
    db = await make_session()
    acc = await make_account(db)
    _s, rows = await _import(db, acc, "nume;telefon\nIon;0722 111 222,0733444555\nAna;0722111000, abc\n")
    assert [(r.status, r.issue) for r in rows] == [("imported", None), ("pending", "error")]
    assert (await _clients(db, acc))[0].telefon == "0722 111 222, 0733444555"
    assert "Telefon invalid: „abc”" in rows[1].messages[0]

    # Acelasi nume si oricare dintre numere = posibil duplicat.
    _s, rows = await _import(db, acc, "nume;telefon\nion;0733-444-555\n")
    assert rows[0].issue == "duplicate"


async def test_unquoted_commas_in_comma_separated_file_are_caught():
    db = await make_session()
    acc = await make_account(db)
    _s, rows = await _import(db, acc,
        "nume,telefon,email\n"
        "Mara,0722111222,0733444555,m@x.ro\n"      # fara ghilimele: coloanele s-ar decala
        'Dan,"0722999888, 0744555666",d@x.ro\n'
    )
    assert [(r.status, r.issue) for r in rows] == [("pending", "error"), ("imported", None)]
    assert "ghilimele" in rows[0].messages[0]
    dan = (await _clients(db, acc))[0]
    assert (dan.telefon, dan.email) == ("0722999888, 0744555666", "d@x.ro")


async def test_whole_missing_mandatory_column_sends_rows_to_review():
    db = await make_session()
    acc = await make_account(db)
    session, rows = await _import(db, acc, "telefon;email\n0722111222;a@b.ro\n")
    assert any("Nume" in w for w in session.file_warnings)
    assert [(r.status, r.issue) for r in rows] == [("pending", "missing")]
    assert rows[0].original == rows[0].values and rows[0].values["nume"] is None


# ─── Actiunile utilizatorului ─────────────────────────────────────────────────

async def test_complete_missing_value_then_import():
    db = await make_session()
    acc = await make_account(db)
    _s, rows = await _import(db, acc, "nume;tip;telefon\n;fizic;0722\n")
    row = rows[0]

    row = await svc.update_row(db, row, {**row.values, "nume": "Georgescu Ana"})
    assert row.status == "pending" and row.issue is None  # complet, dar inca neimportat
    assert await _clients(db, acc) == []

    row = await svc.import_row(db, row, values=None, force_duplicate=False, actor="admin")
    assert row.status == "imported"
    c = (await _clients(db, acc))[0]
    assert (c.nume, c.comments, row.client_id) == ("Georgescu Ana", None, c.id)
    assert row.original["nume"] is None  # ce a venit din fisier ramane in istoric


async def test_import_with_placeholders_tags_the_client():
    db = await make_session()
    acc = await make_account(db)
    _s, rows = await _import(db, acc, "nume;tip;observatii\n;#LIPSA;client vechi\n")
    await svc.import_row(db, rows[0], values=None, force_duplicate=False, actor="admin")
    c = (await _clients(db, acc))[0]
    assert c.nume == "NECOMPLETAT (rând 2)" and c.tip == "fizic"
    assert c.comments == f"client vechi\n{svc.MISSING_TAG} nume"


async def test_error_row_cannot_be_imported_until_fixed():
    db = await make_session()
    acc = await make_account(db)
    _s, rows = await _import(db, acc, "nume;tip;cnp\nIon;fizic;123\n")
    row = rows[0]
    try:
        await svc.import_row(db, row, values=None, force_duplicate=False, actor="admin")
        raise AssertionError("un rand cu erori nu trebuie importat")
    except svc.RowActionError:
        pass
    assert row.status == "pending" and await _clients(db, acc) == []
    row = await svc.import_row(db, row, values={**row.values, "cui": "1850101123456"}, force_duplicate=False, actor="admin")
    assert row.status == "imported"


async def test_duplicate_needs_confirmation():
    db = await make_session()
    acc = await make_account(db)
    await make_client(db, acc, nume="Ion")
    (await _clients(db, acc))[0].telefon = "0722"
    await db.commit()
    _s, rows = await _import(db, acc, "nume;tip;telefon\nIon;fizic;0722\n")
    assert rows[0].issue == "duplicate"
    try:
        await svc.import_row(db, rows[0], values=None, force_duplicate=False, actor="admin")
        raise AssertionError("duplicatul trebuie confirmat")
    except svc.RowActionError:
        pass
    await svc.import_row(db, rows[0], values=None, force_duplicate=True, actor="admin")
    assert len(await _clients(db, acc)) == 2


async def test_reject_restore_and_bulk_import():
    db = await make_session()
    acc = await make_account(db)
    session, rows = await _import(db, acc, "nume;tip\n;fizic\n;fizic\n;juridic\n")
    assert await svc.reject_rows(db, rows[:2], actor="admin") == 2
    assert [r.status for r in await _rows(db, session)] == ["rejected", "rejected", "pending"]
    assert rows[0].resolved_by == "admin"

    assert await svc.restore_rows(db, [rows[1]]) == 1
    pending = [r for r in await _rows(db, session) if r.status == "pending"]
    result = await svc.import_rows(db, pending, force_duplicates=False, actor="admin")
    assert result == {"imported": 2, "failed": []}
    counts = (await svc.session_counts(db, [session.id]))[session.id]
    assert counts == {"imported": 2, "pending": 0, "rejected": 1, "reverted": 0}
    assert await svc.pending_summary(db, acc.id) == {"sessions": 0, "rows": 0}

    try:
        await svc.reject_rows(db, [rows[0]], actor="admin")  # deja respins: nu se schimba nimic
        await svc.import_row(db, rows[0], values=None, force_duplicate=False, actor="admin")
        raise AssertionError("un rand respins nu se importa fara sa fie readus")
    except svc.RowActionError:
        pass


async def test_other_accounts_do_not_count_as_duplicates():
    db = await make_session()
    other = await make_account(db, "alta", "alta")
    mine = await make_account(db)
    c = await make_client(db, other, nume="X")
    c.tip, c.cui = "juridic", "RO1"
    await db.commit()
    _s, rows = await _import(db, mine, "nume;tip;cui\nX;juridic;RO1\n")
    assert rows[0].status == "imported"
    assert [x.account_id for x in await _clients(db, mine)] == [mine.id]
    assert await svc.pending_summary(db, other.id) == {"sessions": 0, "rows": 0}


# ─── Import asincron si protectia la dublu click ──────────────────────────────

async def test_same_file_is_not_imported_twice_without_confirmation():
    db = await make_session()
    acc_id = (await make_account(db)).id  # conflictul face rollback, care expira obiectele
    raw = _csv("nume;telefon\nIon;0722111222\n")
    first_id = (await svc.create_session(db, acc_id, raw, filename="a.csv", actor="admin")).id
    try:
        await svc.start_session(db, acc_id, raw, filename="a.csv", actor="admin")
        raise AssertionError("acelasi fisier trebuia oprit")
    except svc.ImportConflictError as exc:
        assert (exc.reason, exc.session_id) == ("same_file", first_id)
    again = await svc.create_session(db, acc_id, raw, filename="a.csv", actor="admin", force=True)
    assert again.id != first_id and again.state == "done"


async def test_only_one_import_in_progress_per_account_and_stale_ones_fail():
    from datetime import timedelta
    db = await make_session()
    acc_id = (await make_account(db)).id  # conflictul face rollback, care expira obiectele
    running, _parsed = await svc.start_session(db, acc_id, _csv("nume\nIon\n"), filename="a.csv", actor="admin")
    assert running.state == "processing"
    try:
        await svc.start_session(db, acc_id, _csv("nume\nAna\n"), filename="b.csv", actor="admin")
        raise AssertionError("al doilea import simultan trebuia oprit")
    except svc.ImportConflictError as exc:
        assert exc.reason == "in_progress"

    # Procesul a murit (restart): fara semn de viata, sesiunea nu mai blocheaza.
    await db.refresh(running)
    running.updated_at = svc._now() - svc.STALE_AFTER - timedelta(seconds=1)
    await db.commit()
    await db.refresh(running)
    assert svc.effective_state(running) == "failed"
    other, _p = await svc.start_session(db, acc_id, _csv("nume\nAna\n"), filename="b.csv", actor="admin")
    await db.refresh(running)
    assert running.state == "failed" and "repornit" in running.error
    assert other.state == "processing"


async def test_background_processing_reports_progress_in_batches():
    db = await make_session()
    acc = await make_account(db)
    old = svc.BATCH_ROWS
    svc.BATCH_ROWS = 2
    try:
        raw = _csv("nume;telefon\n" + "".join(f"Client {i};07220000{i:02d}\n" for i in range(5)))
        session, parsed = await svc.start_session(db, acc.id, raw, filename="a.csv", actor="admin")
        assert (session.state, session.processed_rows, session.total_rows) == ("processing", 0, 5)
        assert await _clients(db, acc) == []  # nimic scris inainte de procesare
        session = await svc.process_session(db, session.id, parsed)
    finally:
        svc.BATCH_ROWS = old
    assert (session.state, session.processed_rows) == ("done", 5)
    assert len(await _clients(db, acc)) == 5


# ─── Revert ───────────────────────────────────────────────────────────────────

async def test_revert_deletes_created_clients_but_keeps_used_ones():
    from tests._harness import make_receipt
    db = await make_session()
    acc = await make_account(db)
    acc_id = acc.id
    raw = _csv("nume;telefon;numar_masina\nIon;0722111222;TM01AAA\nAna;0733111222;\n;0744555666;\n")
    session = await svc.create_session(db, acc_id, raw, filename="a.csv", actor="admin")
    ion, ana = await _clients(db, acc)
    receipt = await make_receipt(db, acc)
    receipt.client_id = ana.id  # Ana a primit un deviz dupa import
    await db.commit()

    preview = await svc.revert_session(db, session, actor="admin", dry_run=True)
    assert (preview["clients_deleted"], preview["clients_kept"], preview["pending_closed"]) == (1, 1, 1)
    assert preview["kept"][0]["reason"] == "are devize"
    assert all(not c.is_deleted for c in await _clients(db, acc))  # verificarea nu schimba nimic

    await svc.revert_session(db, session, actor="admin", dry_run=False)
    await db.refresh(ion); await db.refresh(ana); await db.refresh(session)
    assert (ion.is_deleted, ana.is_deleted) == (True, False)
    garage = (await db.execute(select(ClientVehicol).where(ClientVehicol.client_id == ion.id))).scalars().all()
    assert garage and all(v.is_deleted for v in garage)
    assert (session.state, session.reverted_by) == ("reverted", "admin")
    assert [r.status for r in await _rows(db, session)] == ["reverted", "imported", "rejected"]

    # Dupa revert, acelasi fisier se poate importa din nou fara confirmare.
    again = await svc.create_session(db, acc_id, raw, filename="a.csv", actor="admin")
    assert again.state == "done"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii de import clienti trecute.")
