"""Infrastructura comuna a importurilor din fisiere (clienti, hotel anvelope).

Un import = o *sesiune* (`ImportSession`) cu *randurile* ei (`ImportRow`).
Ce e specific fiecarui tip (cum se citeste fisierul, ce inseamna un rand, ce
se creeaza la import) sta in modulul lui; aici e doar ce e identic:

  * starea sesiunii (processing -> done | failed | reverted) si detectarea
    sesiunilor ramase `processing` dupa un restart;
  * pornirea serializata pe cont (dublu click, doua tab-uri) si oprirea
    aceluiasi fisier incarcat de doua ori;
  * rularea procesarii in fundal;
  * contoarele, indicatorul de „actiuni in asteptare" si actiunile pe randuri
    care nu depind de tip (respingere).
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_session import ImportRow, ImportSession

log = logging.getLogger("berlinstar")

# Fisierul se citeste intreg in memorie si se parseaza in obiecte Python, iar
# backend-ul ruleaza cu un singur worker: o limita de sute de MB ar insemna cateva
# GB de RAM si aplicatia blocata pentru toata lumea. 50 MB inseamna sute de mii de
# randuri CSV — practic fara limita pentru fisierele reale. Aceeasi valoare in
# nginx, pe /api/import/.
MAX_FILE_BYTES = 50 * 1024 * 1024

# Starea randurilor (vezi app/models/import_session.py).
ROW_IMPORTED, ROW_PENDING, ROW_REJECTED, ROW_REVERTED = "imported", "pending", "rejected", "reverted"

# Starea procesarii sesiunii.
STATE_PROCESSING, STATE_DONE, STATE_FAILED, STATE_REVERTED = "processing", "done", "failed", "reverted"
BATCH_ROWS = 500
# Pe durata procesarii `updated_at` se actualizeaza la fiecare lot (secunde);
# cinci minute fara semn de viata inseamna ca procesul a murit.
STALE_AFTER = timedelta(minutes=5)
_LOCK_NAMESPACE = 734_000_000  # pg_advisory_xact_lock(namespace + account_id)


class ImportFileError(ValueError):
    """Fisierul nu poate fi citit deloc (format, lipsa antet, gol)."""


class ImportConflictError(ValueError):
    """Importul nu porneste: altul e deja in curs sau fisierul a fost deja importat."""

    def __init__(self, message: str, session_id: int, reason: str):
        super().__init__(message)
        self.session_id = session_id
        self.reason = reason  # in_progress | same_file


class RowActionError(ValueError):
    """Actiunea ceruta pe un rand nu se poate face (ex. date inca invalide)."""

    def __init__(self, message: str, row: ImportRow):
        super().__init__(message)
        self.row = row


def now() -> datetime:
    return datetime.now(timezone.utc)


def file_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def norm_text(value: object) -> str:
    """„Ștefan-Ion  POPESCU" -> „STEFAN ION POPESCU": cheie de comparatie."""
    s = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


def _aware(dt: datetime | None) -> datetime | None:
    # SQLite (testele, dev) intoarce datetime-uri fara fus orar.
    return dt.replace(tzinfo=timezone.utc) if dt is not None and dt.tzinfo is None else dt


def is_stale(session: ImportSession) -> bool:
    """O sesiune `processing` fara semn de viata recent a murit cu procesul."""
    if session.state != STATE_PROCESSING:
        return False
    last = _aware(session.updated_at) or _aware(session.created_at)
    return last is not None and now() - last > STALE_AFTER


def effective_state(session: ImportSession) -> str:
    return STATE_FAILED if is_stale(session) else session.state


async def _lock_account_imports(db: AsyncSession, account_id: int) -> None:
    """Serializeaza pornirea importurilor pe cont (doua click-uri in aceeasi
    milisecunda). Lock tranzactional: se elibereaza la commit."""
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_NAMESPACE + account_id})


async def claim_import(db: AsyncSession, account_id: int, kind: str, digest: str, *, force: bool) -> None:
    """Verifica, sub lock, ca importul poate porni. Ramane in tranzactie: apelantul
    adauga sesiunea noua si face commit (care elibereaza lock-ul).

    Un singur import in curs pe cont (indiferent de tip: amandoua scriu clienti);
    acelasi fisier al aceluiasi tip nu se importa de doua ori fara `force`.
    """
    await _lock_account_imports(db, account_id)
    running = (await db.execute(
        select(ImportSession).where(
            ImportSession.account_id == account_id, ImportSession.state == STATE_PROCESSING,
        ).order_by(ImportSession.id.desc())
    )).scalars().all()
    for s in running:
        if is_stale(s):
            s.state = STATE_FAILED
            s.error = f"Procesarea s-a întrerupt după {s.processed_rows} rânduri (serverul a fost repornit)."
        else:
            sid = s.id  # dupa rollback obiectul e expirat
            await db.rollback()
            raise ImportConflictError(
                f"Un import este deja în curs (sesiunea #{sid}). Așteaptă să se termine.", sid, "in_progress",
            )
    if not force:
        same = (await db.execute(
            select(ImportSession).where(
                ImportSession.account_id == account_id, ImportSession.kind == kind,
                ImportSession.file_hash == digest,
                ImportSession.state != STATE_REVERTED,
            ).order_by(ImportSession.id.desc()).limit(1)
        )).scalar_one_or_none()
        partial = False
        if same is not None and same.state == STATE_FAILED:
            # O sesiune esuata a scris deja loturile de dinaintea erorii. Daca n-a
            # apucat sa scrie nimic, reincarcarea aceluiasi fisier e curata; daca a
            # scris, cerem confirmare, altfel datele s-ar dubla in tacere.
            written = await db.scalar(
                select(func.count(ImportRow.id))
                .where(ImportRow.session_id == same.id, ImportRow.status == ROW_IMPORTED)
            )
            partial = bool(written)
            if not partial:
                same = None
        if same is not None:
            sid = same.id
            await db.rollback()
            raise ImportConflictError(
                f"Acest fișier a fost importat parțial (sesiunea #{sid} s-a oprit cu eroare); "
                "importă din nou doar dacă vrei peste ce s-a scris deja."
                if partial else f"Acest fișier a fost deja importat (sesiunea #{sid}).",
                sid, "same_file",
            )


async def mark_failed(db: AsyncSession, session_id: int, exc: BaseException) -> ImportSession:
    log.exception("import: sesiunea %s a esuat", session_id)
    await db.rollback()
    session = await db.get(ImportSession, session_id)
    session.state, session.updated_at = STATE_FAILED, now()
    session.error = f"Importul s-a oprit după {session.processed_rows} rânduri: {exc}"[:1000]
    await db.commit()
    return session


# Referinte tari la job-urile din fundal: fara ele, asyncio le poate colecta
# (garbage collector) inainte sa se termine.
_BACKGROUND_JOBS: set[asyncio.Task] = set()


def run_in_background(job: Callable[[AsyncSession], Awaitable[object]]) -> None:
    """Ruleaza `job(db)` in acelasi proces, cu sesiunea lui de baza de date.

    Backend-ul ruleaza cu un singur worker (vezi deploy/entrypoint.sh), iar o
    sesiune ramasa `processing` dupa un restart e detectata prin `is_stale`.
    """
    from app.database import AsyncSessionLocal

    async def _job() -> None:
        async with AsyncSessionLocal() as db:
            await job(db)

    task = asyncio.create_task(_job())
    _BACKGROUND_JOBS.add(task)
    task.add_done_callback(_BACKGROUND_JOBS.discard)


async def session_counts(db: AsyncSession, session_ids: list[int]) -> dict[int, dict[str, int]]:
    out = {sid: {ROW_IMPORTED: 0, ROW_PENDING: 0, ROW_REJECTED: 0, ROW_REVERTED: 0} for sid in session_ids}
    if not session_ids:
        return out
    rows = (await db.execute(
        select(ImportRow.session_id, ImportRow.status, func.count(ImportRow.id))
        .where(ImportRow.session_id.in_(session_ids))
        .group_by(ImportRow.session_id, ImportRow.status)
    )).all()
    for sid, status, n in rows:
        out[sid][status] = int(n)
    return out


async def pending_summary(db: AsyncSession, account_id: int, kinds: tuple[str, ...]) -> dict:
    """Ce asteapta o decizie in contul curent, pe tipuri de import."""
    rows = (await db.execute(
        select(ImportSession.kind, ImportRow.session_id, func.count(ImportRow.id))
        .join(ImportSession, ImportSession.id == ImportRow.session_id)
        .where(
            ImportRow.account_id == account_id, ImportRow.status == ROW_PENDING,
            ImportSession.kind.in_(kinds),
        )
        .group_by(ImportSession.kind, ImportRow.session_id)
    )).all()
    out = {k: {"sessions": 0, "rows": 0} for k in kinds}
    for kind, _sid, n in rows:
        out[kind]["sessions"] += 1
        out[kind]["rows"] += int(n)
    return out


async def touch_session(db: AsyncSession, session_id: int) -> None:
    session = await db.get(ImportSession, session_id)
    if session is not None:
        session.updated_at = now()


async def lock_and_require(db: AsyncSession, row: ImportRow, *allowed: str) -> None:
    """Blocheaza randul (SELECT ... FOR UPDATE) si verifica starea lui PROASPATA.

    Doua cereri simultane pe acelasi rand (dublu click, doua tab-uri) se
    serializeaza aici: a doua asteapta commit-ul primei si vede ca randul nu mai
    e `pending`, deci nu mai creeaza inca o data aceleasi date.
    """
    await db.refresh(row, with_for_update=True)
    if row.status not in allowed:
        raise RowActionError(f"Rândul {row.row_number} nu mai este în lista de rezolvat.", row)


async def reject_rows(db: AsyncSession, rows: list[ImportRow], *, actor: str) -> int:
    ts, n = now(), 0
    for row in rows:
        if row.status == ROW_PENDING:
            row.status, row.resolved_by, row.resolved_at = ROW_REJECTED, actor, ts
            n += 1
    if rows:
        await touch_session(db, rows[0].session_id)
    await db.commit()
    return n


def set_created(obj: ImportRow | ImportSession, **items) -> None:
    """Adauga in `created` (JSON) ce a creat importul, pentru revert.
    Reatribuim dict-ul: modificarea pe loc a unui JSON nu e detectata de ORM."""
    data = dict(obj.created or {})
    for key, value in items.items():
        if isinstance(value, list):
            data[key] = [*data.get(key, []), *value]
        else:
            data[key] = value
    obj.created = data


# ─── Revert ───────────────────────────────────────────────────────────────────

def chunks(ids: list[int], size: int = 1000):
    """Liste de id-uri pe bucati, pentru `IN (...)` pe mii de randuri."""
    for i in range(0, len(ids), size):
        yield ids[i:i + size]


async def clients_in_use(
    db: AsyncSession,
    client_ids: list[int],
    *,
    exclude_cazare_ids: set[int] = frozenset(),
    exclude_anvelopa_ids: set[int] = frozenset(),
) -> dict[int, str]:
    """Clientii (dintre `client_ids`) care au date legate de ei in afara importului.

    Intoarce {client_id: motiv}. La revertul unui import de hotel excludem
    cazarile si anvelopele create chiar de acel import — acelea se sterg odata
    cu clientul.
    """
    from app.models.anvelopa import Anvelopa
    from app.models.cazare_anvelope import CazareAnvelope
    from app.models.programare import Programare
    from app.models.receipt import Receipt

    checks = (
        (Receipt, "are devize", set()),
        (CazareAnvelope, "are cazări la hotel", exclude_cazare_ids),
        (Programare, "are programări", set()),
        (Anvelopa, "are anvelope", exclude_anvelopa_ids),
    )
    used: dict[int, str] = {}
    for chunk in chunks(list(client_ids)):
        for model, reason, excluded in checks:
            stmt = select(model.client_id, model.id).where(model.client_id.in_(chunk), model.is_deleted == False)
            for cid, oid in (await db.execute(stmt)).all():
                if oid not in excluded:
                    used.setdefault(cid, reason)
    return used


async def finish_revert(db: AsyncSession, session: ImportSession, *, actor: str, ts: datetime) -> None:
    """Inchide sesiunea anulata: randurile inca `pending` devin respinse, iar
    sesiunea trece in `reverted` (ramane in istoric, cu cine si cand)."""
    await db.execute(
        update(ImportRow)
        .where(ImportRow.session_id == session.id, ImportRow.status == ROW_PENDING)
        .values(status=ROW_REJECTED, resolved_by=actor, resolved_at=ts)
    )
    session.state, session.reverted_by, session.reverted_at, session.updated_at = STATE_REVERTED, actor, ts, ts
    await db.commit()
