"""Importuri de date din fisiere (Configurări › Import).

Tot ce se importa aici intra DOAR in contul celui autentificat. Rolul cerut
depinde de tipul importului (`KINDS`): clientii doar adminul contului, hotelul
de anvelope adminul si managerul. Logica sta in serviciul fiecarui tip
(app/services/client_import.py, hotel_import.py); infrastructura comuna de
sesiuni in app/services/import_common.py.

  GET  /{kind}/format                      specificatia fisierului
  POST /{kind}                             dry_run=true: verificare; false: porneste importul (202)
  GET  /pending                            ce asteapta o decizie, pe tipuri (indicatorul din meniu)
  GET  /sessions?kind=                     istoricul sesiunilor
  GET  /sessions/{id}                      o sesiune, cu contoarele ei
  GET  /sessions/{id}/rows                 randurile, filtrate dupa stare / problema
  PATCH /sessions/{id}/rows/{row_id}       salveaza completarile (fara import)
  POST /sessions/{id}/rows/{row_id}/import completeaza si importa un rand
  POST /sessions/{id}/rows/import          importa mai multe randuri
  POST /sessions/{id}/rows/reject          respinge randuri (sau toate cele ramase)
  POST /sessions/{id}/rows/restore         readuce randuri respinse in lista de rezolvat
  POST /sessions/{id}/revert               anuleaza importul (dry_run=true: doar ce s-ar sterge)
  GET  /sessions/{id}/export               raportul CSV: ce s-a importat si ce nu
"""
from __future__ import annotations

import csv
import io
import logging
import re
import unicodedata
from datetime import datetime
from types import ModuleType
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_context import AuthContext
from app.database import get_db
from app.dependencies import require_resource
from app.models.client import Client
from app.models.import_session import ImportRow, ImportSession
from app.permissions import Resource
from app.services import client_import, hotel_import
from app.services import import_common as common

log = logging.getLogger("berlinstar")

router = APIRouter()

# Tipul de import -> (serviciul lui, resursa ceruta). Toate rutele cer cel putin
# SETTINGS (admin + manager, ca Configurari); tipurile mai sensibile cer mai mult.
KINDS: dict[str, tuple[ModuleType, Resource]] = {
    client_import.KIND: (client_import, Resource.USERS),
    hotel_import.KIND: (hotel_import, Resource.SETTINGS),
}
_settings = require_resource(Resource.SETTINGS)

# Cate randuri citim odata cand trimitem raportul CSV.
EXPORT_BATCH = 2000


# ─── Scheme ───────────────────────────────────────────────────────────────────

class RowValues(BaseModel):
    values: dict[str, Any]


class RowImportBody(BaseModel):
    values: dict[str, Any] | None = None
    force_duplicate: bool = False


class RowsSelection(BaseModel):
    # Postgres accepta cel mult 32.767 de parametri intr-o interogare; trimitem
    # id-urile in loturi, iar pentru „tot ce a ramas" exista `all_pending`.
    row_ids: list[int] = Field(default_factory=list, max_length=20_000)
    # Pentru „respinge / importa tot ce a ramas" fara sa trimitem mii de id-uri;
    # `issue` restrange la o categorie (ex. toate cazarile cu client nou).
    all_pending: bool = False
    issue: str | None = None
    force_duplicates: bool = False


class RevertBody(BaseModel):
    dry_run: bool = True


# Raspunsurile sunt declarate ca modele, nu ca dict-uri libere: din ele se
# genereaza schema OpenAPI din care frontend-ul isi ia tipurile.

class SessionOut(BaseModel):
    id: int
    kind: str
    filename: str | None
    encoding: str | None
    delimiter: str | None
    columns_recognized: list[str]
    file_warnings: list[str]
    total_rows: int
    created_by: str | None
    created_at: datetime
    updated_at: datetime | None
    imported: int
    pending: int
    rejected: int
    reverted: int
    status: str
    state: str
    processed_rows: int
    error: str | None
    reverted_by: str | None
    reverted_at: datetime | None


class RowOut(BaseModel):
    id: int
    row: int
    status: str
    issue: str | None
    values: dict[str, Any]
    original: dict[str, Any]
    messages: list[str]
    client_id: int | None
    created: dict[str, Any] | None
    client_nume: str | None = None
    resolved_by: str | None
    resolved_at: datetime | None


class SessionsPage(BaseModel):
    items: list[SessionOut]
    total: int


class RowsPage(BaseModel):
    items: list[RowOut]
    total: int
    pending_by_issue: dict[str, int]


class KindPending(BaseModel):
    sessions: int
    rows: int


class FailedRow(BaseModel):
    row_id: int
    row: int
    message: str


class BulkImportOut(BaseModel):
    imported: int
    failed: list[FailedRow]


class RejectOut(BaseModel):
    rejected: int


class RestoreOut(BaseModel):
    restored: int


class KeptItem(BaseModel):
    row: int | None
    label: str | None
    reason: str


class RevertOut(BaseModel):
    dry_run: bool
    pending_closed: int
    clients_deleted: int
    clients_kept: int
    cazari_deleted: int | None = None
    cazari_kept: int | None = None
    anvelope_deleted: int | None = None
    vehicole_deleted: int | None = None
    nomenclatoare_deleted: int | None = None
    kept: list[KeptItem]


class ConflictOut(BaseModel):
    detail: str
    session_id: int | None = None
    reason: str | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _service(ctx: AuthContext, kind: str) -> ModuleType:
    if kind not in KINDS:
        raise HTTPException(404, "Tip de import necunoscut.")
    module, resource = KINDS[kind]
    if not ctx.can(resource):
        raise HTTPException(403, "Nu ai acces la acest tip de import.")
    return module


def _session_out(s: ImportSession, counts: dict[str, int]) -> dict:
    stale = common.is_stale(s)
    return {
        "id": s.id,
        "kind": s.kind,
        "filename": s.filename,
        "encoding": s.encoding,
        "delimiter": s.delimiter,
        "columns_recognized": s.columns_recognized or [],
        "file_warnings": s.file_warnings or [],
        "total_rows": s.total_rows,
        "created_by": s.created_by,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
        "imported": counts.get(common.ROW_IMPORTED, 0),
        "pending": counts.get(common.ROW_PENDING, 0),
        "rejected": counts.get(common.ROW_REJECTED, 0),
        "reverted": counts.get(common.ROW_REVERTED, 0),
        "status": "necesita_actiuni" if counts.get(common.ROW_PENDING, 0) else "finalizata",
        # Procesarea in fundal: processing | done | failed | reverted (+ progres si eroare).
        "state": common.effective_state(s),
        "processed_rows": s.processed_rows,
        "error": s.error if s.state == common.STATE_FAILED else (
            "Procesarea s-a întrerupt (serverul a fost repornit)." if stale else None
        ),
        "reverted_by": s.reverted_by,
        "reverted_at": s.reverted_at,
    }


def _row_out(r: ImportRow) -> dict:
    return {
        "id": r.id,
        "row": r.row_number,
        "status": r.status,
        "issue": r.issue,
        "values": r.values,
        "original": r.original,
        "messages": r.messages or [],
        "client_id": r.client_id,
        "created": r.created,
        "resolved_by": r.resolved_by,
        "resolved_at": r.resolved_at,
    }


async def _get_session(
    db: AsyncSession, ctx: AuthContext, session_id: int, *, ready: bool = False,
) -> tuple[ImportSession, ModuleType]:
    """`ready=True` pentru actiuni pe randuri: cat timp sesiunea se proceseaza,
    randurile ei inca se scriu; o sesiune anulata nu mai accepta actiuni."""
    s = await db.get(ImportSession, session_id)
    if s is None or s.account_id != ctx.account_id:
        raise HTTPException(404, "Sesiunea de import nu a fost găsită.")
    module = _service(ctx, s.kind)
    if ready:
        state = common.effective_state(s)
        if state == common.STATE_PROCESSING:
            raise HTTPException(409, "Sesiunea încă se procesează. Așteaptă să se termine.")
        if state == common.STATE_REVERTED:
            raise HTTPException(409, "Importul a fost anulat; sesiunea nu mai acceptă modificări.")
    return s, module


# Excel executa o celula care incepe cu =, +, - sau @. Fisierul importat vine din
# afara firmei, iar raportul e facut anume ca sa fie deschis in Excel (BOM + „;"),
# deci neutralizam celulele in loc sa rulam ce a scris altcineva in fisier.
_CSV_RISKY = ("=", "+", "-", "@", "\t", "\r")


def _csv_cell(value: object) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in _CSV_RISKY else text


def _attachment(filename: str) -> str:
    """Antet `Content-Disposition` valid pentru un nume venit din fisierul incarcat.

    Antetele HTTP se codeaza latin-1, deci „Cazări hotel.xlsx" ar rupe raspunsul cu
    500; iar ghilimelele din nume ar permite alegerea altui nume la salvare. Trimitem
    o varianta ASCII curata si numele adevarat in `filename*` (RFC 5987).
    """
    ascii_name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", ascii_name).strip("._") or "raport.csv"
    return f"attachment; filename=\"{safe[:100]}\"; filename*=UTF-8''{quote(filename)}"


async def _client_names(db: AsyncSession, account_id: int, rows: list[ImportRow]) -> dict[int, str]:
    """Numele clientilor potriviti sau alesi, ca listele si raportul sa nu arate id-uri."""
    ids = {cid for r in rows for cid in (r.client_id, (r.values or {}).get("client_id")) if isinstance(cid, int)}
    if not ids:
        return {}
    return dict((await db.execute(
        select(Client.id, Client.nume).where(Client.id.in_(ids), Client.account_id == account_id)
    )).all())


async def _get_row(db: AsyncSession, session: ImportSession, row_id: int) -> ImportRow:
    r = await db.get(ImportRow, row_id)
    if r is None or r.session_id != session.id:
        raise HTTPException(404, "Rândul nu a fost găsit.")
    return r


async def _selected_rows(db: AsyncSession, session: ImportSession, body: RowsSelection, status: str) -> list[ImportRow]:
    base = select(ImportRow).where(ImportRow.session_id == session.id, ImportRow.status == status)
    if body.all_pending:
        if body.issue:
            base = base.where(ImportRow.issue == body.issue)
        stmts = [base]
    else:
        if not body.row_ids:
            raise HTTPException(422, "Nu ai selectat niciun rând.")
        # Un `IN (...)` cu zeci de mii de id-uri depaseste limita de parametri a
        # driverului, deci interogam pe loturi.
        stmts = [base.where(ImportRow.id.in_(chunk)) for chunk in common.chunks(body.row_ids, 5_000)]
    # FOR UPDATE: o a doua cerere identica (dublu click) asteapta commit-ul primei
    # si nu mai gaseste randurile in starea ceruta.
    rows: list[ImportRow] = []
    for stmt in stmts:
        rows.extend((await db.execute(stmt.order_by(ImportRow.row_number).with_for_update())).scalars().all())
    return rows


# ─── Fisier ───────────────────────────────────────────────────────────────────

@router.get("/pending", response_model=dict[str, KindPending])
async def pending_actions(db: AsyncSession = Depends(get_db), ctx: AuthContext = Depends(_settings)):
    kinds = tuple(k for k, (_m, res) in KINDS.items() if ctx.can(res))
    return await common.pending_summary(db, ctx.account_id, kinds)


@router.get("/{kind}/format")
async def import_format(kind: str, ctx: AuthContext = Depends(_settings)):
    """Specificatia fisierului — frontend-ul isi deseneaza documentatia din ea."""
    return _service(ctx, kind).format_spec()


@router.post("/{kind}", responses={
    202: {"model": SessionOut, "description": "Importul a pornit; progresul se vede pe GET /sessions/{id}."},
    409: {"model": ConflictOut, "description": "Alt import e în curs sau fișierul a mai fost importat."},
})
async def import_file(
    kind: str,
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    force: bool = Form(False),
    # Doar importurile legate de un punct de lucru o folosesc (vezi WANTS_LOCATION).
    location_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    """dry_run=true: verificare (sincron, nu scrie nimic).
    dry_run=false: creeaza sesiunea si raspunde imediat (202); randurile se
    proceseaza in fundal — frontend-ul urmareste progresul pe GET /sessions/{id}.
    `force=true` importa si un fisier deja importat."""
    svc = _service(ctx, kind)
    actor = ctx.user.username
    raw = await file.read(common.MAX_FILE_BYTES + 1)
    try:
        if dry_run:
            return await svc.preview(db, ctx.account_id, raw)
        extra = {"location_id": location_id} if getattr(svc, "WANTS_LOCATION", False) else {}
        session, parsed = await svc.start_session(
            db, ctx.account_id, raw, filename=file.filename, actor=actor, force=force, **extra,
        )
    except common.ImportFileError as exc:
        raise HTTPException(422, str(exc)) from exc
    except common.ImportConflictError as exc:
        return JSONResponse(
            status_code=409,
            content={"detail": str(exc), "session_id": exc.session_id, "reason": exc.reason},
        )

    log.info(
        "import %s pornit: account=%s user=%s session=%s file=%s rows=%s",
        kind, ctx.account_id, actor, session.id, file.filename, session.total_rows,
    )
    svc.process_in_background(session.id, parsed)
    return JSONResponse(status_code=202, content=jsonable_encoder(_session_out(session, {})))


# ─── Sesiuni ──────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=SessionsPage)
async def list_sessions(
    kind: str = client_import.KIND,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    _service(ctx, kind)
    limit = max(1, min(limit, 200))
    base = select(ImportSession).where(ImportSession.account_id == ctx.account_id, ImportSession.kind == kind)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    sessions = (await db.execute(
        base.order_by(ImportSession.id.desc()).offset(max(0, offset)).limit(limit)
    )).scalars().all()
    counts = await common.session_counts(db, [s.id for s in sessions])
    return {"items": [_session_out(s, counts[s.id]) for s in sessions], "total": int(total or 0)}


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db), ctx: AuthContext = Depends(_settings)):
    s, _svc = await _get_session(db, ctx, session_id)
    counts = (await common.session_counts(db, [s.id]))[s.id]
    return _session_out(s, counts)


@router.get("/sessions/{session_id}/rows", response_model=RowsPage)
async def list_rows(
    session_id: int,
    status: str | None = None,
    issue: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, _svc = await _get_session(db, ctx, session_id)
    stmt = select(ImportRow).where(ImportRow.session_id == s.id)
    if status:
        stmt = stmt.where(ImportRow.status == status)
    if issue:
        stmt = stmt.where(ImportRow.issue == issue)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    limit = max(1, min(limit, 500))
    rows = (await db.execute(
        stmt.order_by(ImportRow.row_number).offset(max(0, offset)).limit(limit)
    )).scalars().all()
    by_issue = dict((await db.execute(
        select(ImportRow.issue, func.count(ImportRow.id))
        .where(ImportRow.session_id == s.id, ImportRow.status == common.ROW_PENDING)
        .group_by(ImportRow.issue)
    )).all())
    names = await _client_names(db, ctx.account_id, rows)
    items = []
    for r in rows:
        out = _row_out(r)
        cid = r.client_id or (r.values or {}).get("client_id")
        out["client_nume"] = names.get(cid) if isinstance(cid, int) else None
        items.append(out)
    return {
        "items": items,
        "total": int(total or 0),
        "pending_by_issue": {k or "ok": int(v) for k, v in by_issue.items()},
    }


@router.get("/sessions/{session_id}/export")
async def export_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    """Raportul complet al sesiunii, ca CSV: fiecare rand din fisier cu ce s-a
    intamplat cu el (importat, de rezolvat, respins, anulat) si de ce."""
    s, svc = await _get_session(db, ctx, session_id)
    account_id, sid, kind = ctx.account_id, s.id, s.kind
    name = (s.filename or f"import_{s.id}").rsplit(".", 1)[0]

    async def _csv_stream():
        """Randurile se citesc si se trimit pe loturi.

        O sesiune poate avea sute de mii de randuri, fiecare cu doua documente JSON;
        construit intreg in memorie, raportul ar putea depasi memoria procesului —
        care serveste, cu un singur worker, toti utilizatorii. Generatorul isi
        deschide propria sesiune de baza de date, fiindca ruleaza dupa ce
        dependintele request-ului s-au inchis.
        """
        from app.database import AsyncSessionLocal

        def _line(cells) -> str:
            buf = io.StringIO()
            # Terminatorul implicit al modulului csv e CRLF, cum vrea Excel.
            csv.writer(buf, delimiter=";").writerow(cells)
            return buf.getvalue()

        # BOM: Excel pe Windows deschide fisierul direct, cu diacritice corecte.
        yield chr(0xFEFF) + _line(svc.CSV_HEADER)
        last_id = 0
        async with AsyncSessionLocal() as stream_db:
            while True:
                rows = (await stream_db.execute(
                    select(ImportRow)
                    .where(ImportRow.session_id == sid, ImportRow.id > last_id)
                    .order_by(ImportRow.id).limit(EXPORT_BATCH)
                )).scalars().all()
                if not rows:
                    return
                last_id = rows[-1].id
                names = await _client_names(stream_db, account_id, rows)
                out = []
                for r in rows:
                    cid = r.client_id or (r.values or {}).get("client_id")
                    client = names.get(cid) if isinstance(cid, int) else None
                    out.append(_line([_csv_cell(c) for c in svc.csv_row(r, client)]))
                yield "".join(out)

    return StreamingResponse(
        _csv_stream(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": _attachment(f"raport_{kind}_{sid}_{name}.csv")},
    )


# ─── Actiuni pe randuri ───────────────────────────────────────────────────────

@router.patch("/sessions/{session_id}/rows/{row_id}", response_model=RowOut,
              responses={409: {"model": ConflictOut}})
async def update_row(
    session_id: int,
    row_id: int,
    body: RowValues,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, svc = await _get_session(db, ctx, session_id, ready=True)
    row = await _get_row(db, s, row_id)
    try:
        return _row_out(await svc.update_row(db, row, body.values))
    except common.RowActionError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/sessions/{session_id}/rows/{row_id}/import", response_model=RowOut,
             responses={409: {"model": ConflictOut, "description": "Rândul nu poate fi importat încă."}})
async def import_one_row(
    session_id: int,
    row_id: int,
    body: RowImportBody,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, svc = await _get_session(db, ctx, session_id, ready=True)
    row = await _get_row(db, s, row_id)
    try:
        row = await svc.import_row(
            db, row, values=body.values, force_duplicate=body.force_duplicate, actor=ctx.user.username,
        )
    except common.RowActionError as exc:
        # 409 cu randul actualizat (mesaje, problema), ca formularul sa arate de ce;
        # `detail` ramane text, ca la orice alta eroare citita de frontend.
        return JSONResponse(
            status_code=409,
            content={"detail": str(exc), "row": jsonable_encoder(_row_out(exc.row))},
        )
    return _row_out(row)


@router.post("/sessions/{session_id}/rows/import", response_model=BulkImportOut)
async def import_many_rows(
    session_id: int,
    body: RowsSelection,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, svc = await _get_session(db, ctx, session_id, ready=True)
    rows = await _selected_rows(db, s, body, common.ROW_PENDING)
    return await svc.import_rows(db, rows, force_duplicates=body.force_duplicates, actor=ctx.user.username)


@router.post("/sessions/{session_id}/rows/reject", response_model=RejectOut)
async def reject_rows(
    session_id: int,
    body: RowsSelection,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, _svc = await _get_session(db, ctx, session_id, ready=True)
    rows = await _selected_rows(db, s, body, common.ROW_PENDING)
    return {"rejected": await common.reject_rows(db, rows, actor=ctx.user.username)}


@router.post("/sessions/{session_id}/rows/restore", response_model=RestoreOut)
async def restore_rows(
    session_id: int,
    body: RowsSelection,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    s, svc = await _get_session(db, ctx, session_id, ready=True)
    if body.all_pending:
        raise HTTPException(422, "Selectează rândurile respinse pe care vrei să le readuci.")
    rows = await _selected_rows(db, s, body, common.ROW_REJECTED)
    return {"restored": await svc.restore_rows(db, rows)}


# ─── Revert ───────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/revert", response_model=RevertOut)
async def revert_session(
    session_id: int,
    body: RevertBody,
    db: AsyncSession = Depends(get_db),
    ctx: AuthContext = Depends(_settings),
):
    """Anuleaza importul. `dry_run=true` (implicit) intoarce doar ce s-ar sterge si
    ce s-ar pastra; `dry_run=false` executa. Sesiunea e blocata pe durata anularii,
    deci doua anulari simultane nu se suprapun."""
    s, svc = await _get_session(db, ctx, session_id, ready=True)
    if not body.dry_run:
        # Blocam sesiunea: a doua cerere (dublu click) asteapta si apoi vede `reverted`.
        await db.refresh(s, with_for_update=True)
        if s.state == common.STATE_REVERTED:
            raise HTTPException(409, "Importul a fost deja anulat.")
    summary = await svc.revert_session(db, s, actor=ctx.user.username, dry_run=body.dry_run)
    return summary
