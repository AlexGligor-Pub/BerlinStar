"""Masina de stari a unei facturi trimise la ANAF: o factura nu pleaca de doua ori.

  - preluarea pentru trimitere e atomica: request-ul si job-ul nu pot trimite amandoi
  - /retry e permis doar din starile in care retrimiterea e corecta (altfel 409)
  - timeout / 5xx = rezultat necunoscut: nu se retrimite automat
  - trimiterile abandonate nu raman agatate pe „pending"
  - /validate raspunde cu rezultatul real al validarii
  - firma din XML e aceeasi cu cea a seriei de pe factura
  - token ANAF expirat = 409, nu 401 (frontend-ul deconecteaza la orice 401)

ANAF e inlocuit cu un client fals: niciun test nu iese in retea.

Rulabil cu pytest sau direct:  python -m tests.test_efactura_flux_stari  (din backend/)
"""
from __future__ import annotations
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import select, update

# Harness-ul importa `app.main`; fara el, `app.efactura.models` intra intr-un
# import circular cu `app.models`.
from tests._harness import (
    add_line, make_account, make_client, make_receipt, make_session, make_user, raises_http, run,
)
import app.efactura.router as ef
import app.efactura.scheduler as sched
import app.efactura.service as svc
from app.auth_context import AuthContext
from app.efactura.exceptions import (
    AnafConfigError, AnafRateLimited, AnafTokenExpired, AnafUploadError, AnafValidationError,
    EFacturaError,
)
from app.efactura.models import AnafSettings, AnafToken, EFacturaRecord
from app.models.company import Company
from app.models.location import Location
from app.models.receipt import Receipt
from app.models.register import Register
from app.models.user import UserRole

NO_CLIENT = "Clientul facturii lipseste."


# ─── Fixture ──────────────────────────────────────────────────────────────────

async def _fixture(status: str | None = None, *, factura_nr: int = 1, **rec_kw):
    """Cont cu o firma, un client si un bon facturat; optional un record de trimitere.

    Se incheie cu `expunge_all`: handlerele si serviciul isi incarca singure
    randurile, ca in productie (relatiile `selectin` se populeaza la SELECT).
    """
    db = await make_session()
    acc = await make_account(db)
    comp = Company(account_id=acc.id, name="Firma SRL", cui=111)
    db.add(comp)
    await db.flush()
    db.add(AnafSettings(company_id=comp.id))
    client = await make_client(db, acc)
    receipt = await make_receipt(
        db, acc, client_id=client.id,
        factura_serie="F" if factura_nr else "", factura_nr=factura_nr,
    )
    if status is not None:
        db.add(EFacturaRecord(
            company_id=comp.id, receipt_id=receipt.id, cui="111", direction="sent",
            status=status, invoice_issue_date=date(2026, 9, 1),
            deadline_transmit=date(2026, 9, 8), **rec_kw,
        ))
    await db.commit()
    db.expunge_all()
    return db, acc, comp.id, receipt.id


async def _receipt(db, receipt_id: int) -> Receipt:
    return (await db.execute(select(Receipt).where(Receipt.id == receipt_id))).scalar_one()


async def _rec(db) -> EFacturaRecord:
    """Singurul record din baza, recitit (UPDATE-urile conditionate ocolesc ORM-ul)."""
    return (
        await db.execute(select(EFacturaRecord).execution_options(populate_existing=True))
    ).scalar_one()


async def _age(db, **delta) -> None:
    """Imbatraneste record-ul: muta `last_attempt_at` in trecut."""
    await db.execute(
        update(EFacturaRecord).values(
            last_attempt_at=datetime.now(timezone.utc) - timedelta(**delta)
        )
    )
    await db.commit()


def _ago(**delta) -> datetime:
    return datetime.now(timezone.utc) - timedelta(**delta)


async def _ctx(db, account) -> AuthContext:
    user = await make_user(db, account, f"{account.username}-admin", UserRole.ADMIN)
    return AuthContext(user=user, session=None, account=account)


async def _raises(exc_type, coro):
    try:
        await coro
    except exc_type as exc:
        return exc
    raise AssertionError(f"astept {exc_type.__name__}, dar apelul a reusit")


@contextmanager
def _patched(obj, **attrs):
    old = {k: getattr(obj, k) for k in attrs}
    for k, v in attrs.items():
        setattr(obj, k, v)
    try:
        yield
    finally:
        for k, v in old.items():
            setattr(obj, k, v)


# ─── ANAF fals ────────────────────────────────────────────────────────────────

class _Payload:
    invoice_type_code = "380"
    invoice_number = "F1"
    issues: list[str] = []


class _FakeAnaf:
    """Numara POST-urile catre ANAF. `error` = exceptia ridicata de POST;
    `during` = ce se intampla „in timpul" primului POST (alt declansator)."""

    def __init__(self, error: Exception | None = None, token_error: Exception | None = None):
        self.uploads: list[str] = []
        self.error = error
        self.token_error = token_error
        self.during = None


@contextmanager
def _anaf(fake: _FakeAnaf):
    """Inlocuieste tot ce ar iesi din proces: token, S3 si clientul HTTP ANAF."""
    async def _token(_db, _company_id):
        if fake.token_error is not None:
            raise fake.token_error
        return "tok"

    async def _archive(_account_id, _invoice_number, _xml):
        return "cheie-s3"

    class _Client:
        def __init__(self, access_token, cui, use_test=False):
            pass

        async def upload_invoice(self, xml, standard="UBL", extern=False):
            fake.uploads.append(xml)
            if fake.during is not None:
                during, fake.during = fake.during, None
                await during()
            if fake.error is not None:
                raise fake.error
            return {"index_incarcare": 42, "data_creare": "202609011200"}

    with _patched(
        svc,
        build_invoice_payload=lambda receipt, company, client, **_kw: _Payload(),
        build_xml=lambda payload: "<Invoice/>",
        AnafEFacturaClient=_Client,
        _archive_xml_to_s3=_archive,
    ), _patched(svc.oauth_service, get_valid_access_token=_token):
        yield


@contextmanager
def _job_session(db):
    """Job-ul isi deschide singur sesiunea; in test primeste baza testului."""
    class _Ctx:
        async def __aenter__(self):
            return db

        async def __aexit__(self, *_exc):
            return False

    with _patched(sched, AsyncSessionLocal=lambda: _Ctx()):
        yield


@contextmanager
def _no_background(spawned: list):
    """Rutele /upload si /retry pornesc un task in fundal; aici doar il numaram."""
    class _Broadcaster:
        def notify(self, _account_id) -> None:
            pass

    with _patched(svc, upload_to_anaf_async=lambda *args: args), \
            _patched(ef, _spawn_bg=spawned.append, broadcaster=_Broadcaster()):
        yield


# ─── Preluare atomica: un singur upload ───────────────────────────────────────

async def test_double_trigger_uploads_exactly_once():
    db, _, _, receipt_id = await _fixture()
    receipt = await _receipt(db, receipt_id)
    await svc.mark_pending_upload(db, receipt)
    fake = _FakeAnaf()
    refused: list[str] = []

    async def _second_trigger():
        # Cat timp primul POST e in curs: job-ul ruleaza (record-ul e destul de
        # vechi ca sa-l ia) si un al doilea task incearca aceeasi factura.
        await _age(db, minutes=5)
        with _job_session(db):
            await sched.job_upload_pending()
        exc = await _raises(svc.UploadNotClaimed, svc.prepare_and_upload(db, receipt))
        refused.append(str(exc))
        mid = await _rec(db)
        assert (mid.status, mid.anaf_stare) == ("pending_upload", svc.STARE_UPLOADING)

    fake.during = _second_trigger
    with _anaf(fake):
        rec = await svc.prepare_and_upload(db, receipt)
        assert (rec.status, rec.index_incarcare, rec.upload_attempts) == ("in_prelucrare", 42, 1)
        # Dupa trimitere, nici job-ul, nici un alt task nu o mai iau.
        await _age(db, hours=1)
        with _job_session(db):
            await sched.job_upload_pending()
        await _raises(svc.UploadNotClaimed, svc.prepare_and_upload(db, receipt))
    assert len(fake.uploads) == 1, fake.uploads
    assert len(refused) == 1
    rec = await _rec(db)
    assert (rec.status, rec.index_incarcare) == ("in_prelucrare", 42)


async def test_job_leaves_fresh_queue_to_the_request_task_and_sends_orphans_once():
    db, _, _, receipt_id = await _fixture()
    await svc.mark_pending_upload(db, await _receipt(db, receipt_id))
    fake = _FakeAnaf()
    with _anaf(fake), _job_session(db):
        # Abia pusa in coada: task-ul din request e pe drum, job-ul nu se baga.
        await sched.job_upload_pending()
        assert fake.uploads == []
        assert (await _rec(db)).status == "pending_upload"
        # Ramasa in coada (task pierdut la o repornire): job-ul o trimite, o data.
        await _age(db, minutes=5)
        await sched.job_upload_pending()
        await sched.job_upload_pending()
    assert len(fake.uploads) == 1
    rec = await _rec(db)
    assert (rec.status, rec.anaf_stare, rec.index_incarcare) == ("in_prelucrare", "in prelucrare", 42)


async def test_mark_pending_upload_refuses_states_already_in_flux():
    for status, kw in (
        ("accepted", {"index_incarcare": 7}),
        ("in_prelucrare", {"index_incarcare": 7}),
        ("pending_upload", {"anaf_stare": svc.STARE_QUEUED}),
        ("pending_upload", {"anaf_stare": svc.STARE_UPLOADING}),
    ):
        db, _, _, receipt_id = await _fixture(status, **kw)
        await _raises(svc.EFacturaStateError, svc.mark_pending_upload(db, await _receipt(db, receipt_id)))
        rec = await _rec(db)
        assert (rec.status, rec.index_incarcare) == (status, kw.get("index_incarcare")), status


# ─── /retry si /upload ────────────────────────────────────────────────────────

async def test_retry_on_sent_record_is_409_and_sends_nothing():
    for status, kw in (
        ("accepted", {"index_incarcare": 7}),
        ("in_prelucrare", {"index_incarcare": 7}),
        ("pending_upload", {"anaf_stare": svc.STARE_QUEUED}),
        ("pending_upload", {"anaf_stare": svc.STARE_UPLOADING}),
    ):
        db, acc, _, receipt_id = await _fixture(status, **kw)
        spawned: list = []
        with _no_background(spawned):
            await raises_http(409, ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db))
        assert spawned == [], status
        rec = await _rec(db)
        # Index-ul primei transmiteri ramane: fara el nu mai poate fi urmarita.
        assert (rec.status, rec.index_incarcare) == (status, kw.get("index_incarcare")), status


async def test_retry_is_allowed_where_a_resend_is_correct():
    for status, kw in (
        ("error", {}),
        ("error", {"anaf_stare": svc.STARE_UNKNOWN}),
        ("rejected", {"index_incarcare": 7, "download_id": 9}),
        ("draft", {}),
        ("in_prelucrare", {}),  # fara index: record blocat de versiunile vechi
    ):
        db, acc, _, receipt_id = await _fixture(status, **kw)
        spawned: list = []
        with _no_background(spawned):
            rec = await ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
            assert (rec.status, rec.anaf_stare) == ("pending_upload", svc.STARE_QUEUED), status
            # Dublu-click: al doilea request gaseste factura deja in coada.
            await raises_http(409, ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db))
        assert spawned == [(receipt_id, acc.id)], status


async def test_retry_needs_an_invoice_number_and_a_live_receipt():
    db, acc, _, receipt_id = await _fixture("error", factura_nr=0)
    spawned: list = []
    with _no_background(spawned):
        await raises_http(400, ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db))
    db, acc, _, receipt_id = await _fixture("error")
    await db.execute(update(Receipt).values(is_deleted=True))
    await db.commit()
    with _no_background(spawned):
        await raises_http(404, ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db))
    assert spawned == []


async def test_upload_twice_queues_once():
    db, acc, _, receipt_id = await _fixture()
    spawned: list = []
    with _no_background(spawned):
        rec = await ef.upload_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
        assert (rec.status, rec.anaf_stare) == ("pending_upload", svc.STARE_QUEUED)
        await raises_http(409, ef.upload_receipt(receipt_id=receipt_id, account_id=acc.id, db=db))
    assert spawned == [(receipt_id, acc.id)]


# ─── Rezultat necunoscut ──────────────────────────────────────────────────────

async def test_timeout_is_unknown_outcome_and_is_never_resent_automatically():
    for error in (
        httpx.ReadTimeout("timeout"),
        httpx.RemoteProtocolError("conexiune inchisa"),
        EFacturaError("ANAF server error HTTP 502: bad gateway"),
        AnafUploadError("HTTP 200 fara index_incarcare", raw={"http_status": 200, "body": "?"}),
    ):
        db, _, _, receipt_id = await _fixture()
        receipt = await _receipt(db, receipt_id)
        await svc.mark_pending_upload(db, receipt)
        fake = _FakeAnaf(error=error)
        with _anaf(fake):
            await _raises(svc.UploadOutcomeUnknown, svc.prepare_and_upload(db, receipt))
            rec = await _rec(db)
            assert (rec.status, rec.anaf_stare, rec.index_incarcare) == ("error", svc.STARE_UNKNOWN, None), error
            assert rec.anaf_error_message.startswith("Rezultat necunoscut"), rec.anaf_error_message
            # Oricat ar trece, job-ul nu o retrimite: decide operatorul.
            await _age(db, hours=3)
            with _job_session(db):
                await sched.job_upload_pending()
                await sched.job_upload_pending()
            await _raises(svc.UploadNotClaimed, svc.prepare_and_upload(db, receipt))
        assert len(fake.uploads) == 1, error
        rec = await _rec(db)
        assert (rec.status, rec.anaf_stare) == ("error", svc.STARE_UNKNOWN), error


async def test_unknown_outcome_can_be_resent_manually():
    db, acc, _, receipt_id = await _fixture()
    receipt = await _receipt(db, receipt_id)
    await svc.mark_pending_upload(db, receipt)
    fake = _FakeAnaf(error=httpx.ReadTimeout("timeout"))
    spawned: list = []
    with _anaf(fake):
        await _raises(svc.UploadOutcomeUnknown, svc.prepare_and_upload(db, receipt))
        with _no_background(spawned):
            await ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
        fake.error = None
        rec = await svc.prepare_and_upload(db, receipt)
    assert spawned == [(receipt_id, acc.id)]
    assert len(fake.uploads) == 2
    assert (rec.status, rec.index_incarcare, rec.anaf_error_message) == ("in_prelucrare", 42, None)


async def test_failures_before_anything_is_sent_are_plain_retriable_errors():
    cases = (
        (_FakeAnaf(error=httpx.ConnectError("refuzat")), EFacturaError, 1, "Nimic nu a fost transmis"),
        (_FakeAnaf(error=AnafRateLimited("429")), AnafRateLimited, 1, "Nimic nu a fost transmis"),
        (_FakeAnaf(token_error=AnafTokenExpired("Refresh token expirat.")), AnafTokenExpired, 0, "Refresh token expirat."),
        (_FakeAnaf(token_error=httpx.ReadTimeout("timeout")), httpx.ReadTimeout, 0, "Nu am putut obtine tokenul ANAF"),
    )
    for fake, exc_type, uploads, message in cases:
        db, _, _, receipt_id = await _fixture()
        receipt = await _receipt(db, receipt_id)
        await svc.mark_pending_upload(db, receipt)
        with _anaf(fake):
            await _raises(exc_type, svc.prepare_and_upload(db, receipt))
        rec = await _rec(db)
        # 'error' fara index si fara „necunoscut": bonul redevine editabil.
        assert (rec.status, rec.anaf_stare, rec.index_incarcare) == ("error", None, None), message
        assert message in rec.anaf_error_message, rec.anaf_error_message
        assert len(fake.uploads) == uploads, message


async def test_explicit_anaf_refusal_stays_a_plain_error():
    xml_refusal = '<header ExecutionStatus="1"><Errors errorMessage="Nu aveti drept in SPV"/></header>'
    for raw in (
        {"eroare": "CIF invalid"},
        # Refuzul obisnuit: HTTP 200 cu XML de eroare (corp neparsabil ca JSON).
        {"http_status": 200, "body": xml_refusal},
        {"http_status": 400, "body": "Bad Request"},
        # Corpul JSON al gateway-ului la 4xx, fara `http_status`.
        {"status": 400, "error": "Bad Request", "message": "Parametrul cif lipseste"},
    ):
        db, _, _, receipt_id = await _fixture()
        receipt = await _receipt(db, receipt_id)
        await svc.mark_pending_upload(db, receipt)
        fake = _FakeAnaf(error=AnafUploadError("CIF invalid", raw=raw))
        with _anaf(fake):
            await _raises(AnafUploadError, svc.prepare_and_upload(db, receipt))
        rec = await _rec(db)
        assert (rec.status, rec.anaf_stare, rec.anaf_error_message) == ("error", "nok", "CIF invalid"), raw
        assert rec.index_incarcare is None, raw


async def test_resend_drops_the_index_of_the_superseded_upload():
    """Respinsa (index 7) -> retrimisa -> esec: record-ul nu ramane cu indexul vechi,
    care ar bloca bonul la editare si ar ascunde „Trimite in SPV"."""
    def _invalid(*_a, **_kw):
        raise AnafValidationError([NO_CLIENT])

    old = {"index_incarcare": 7, "download_id": 9, "response_zip_s3_key": "zip-vechi"}
    cases = (
        (_FakeAnaf(), _invalid, AnafValidationError, "error", None),
        (_FakeAnaf(error=httpx.ReadTimeout("timeout")), None, svc.UploadOutcomeUnknown, "error", svc.STARE_UNKNOWN),
        (_FakeAnaf(), None, None, "in_prelucrare", "in prelucrare"),
    )
    for fake, build, exc_type, status, stare in cases:
        db, acc, _, receipt_id = await _fixture("rejected", anaf_stare="nok", **old)
        spawned: list = []
        with _no_background(spawned):
            await ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
        receipt = await _receipt(db, receipt_id)
        with _anaf(fake):
            if exc_type is None:
                await svc.prepare_and_upload(db, receipt)
            else:
                with _patched(svc, **({"build_invoice_payload": build} if build else {})):
                    await _raises(exc_type, svc.prepare_and_upload(db, receipt))
        rec = await _rec(db)
        assert (rec.status, rec.anaf_stare) == (status, stare), exc_type
        assert rec.index_incarcare == (42 if exc_type is None else None), exc_type
        # Raspunsul incarcarii respinse nu mai tine locul raspunsului celei noi.
        assert (rec.download_id, rec.response_zip_s3_key) == (None, None), exc_type


async def test_abandoned_resend_does_not_keep_the_old_index():
    db, acc, _, receipt_id = await _fixture("rejected", index_incarcare=7, download_id=9)
    spawned: list = []
    with _no_background(spawned):
        await ef.retry_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
    await _age(db, hours=1)
    assert await svc.expire_stuck_uploads(db) == 1
    rec = await _rec(db)
    assert (rec.status, rec.index_incarcare, rec.anaf_error_message) == ("error", None, svc.MSG_NOT_STARTED)


# ─── Trimiteri abandonate ─────────────────────────────────────────────────────

async def test_job_expires_abandoned_claims_without_resending():
    cases = (
        # preluata, apoi procesul a murit in timpul POST-ului
        ({"anaf_stare": svc.STARE_UPLOADING, "last_attempt_at": _ago(hours=1)}, "error", svc.STARE_UNKNOWN),
        # ramasa 'pending_upload' de la versiunea veche (fara sub-stare)
        ({"upload_attempts": 3, "last_attempt_at": _ago(days=2)}, "error", svc.STARE_UNKNOWN),
        ({"anaf_stare": "nok", "last_attempt_at": _ago(hours=1)}, "error", svc.STARE_UNKNOWN),
        # preluata de curand: trimiterea e in curs, nu ne atingem
        ({"anaf_stare": svc.STARE_UPLOADING, "last_attempt_at": _ago(minutes=1)}, "pending_upload", svc.STARE_UPLOADING),
    )
    for kw, status, stare in cases:
        db, _, _, _ = await _fixture("pending_upload", **kw)
        fake = _FakeAnaf()
        with _anaf(fake), _job_session(db):
            await sched.job_upload_pending()
        rec = await _rec(db)
        assert (rec.status, rec.anaf_stare) == (status, stare), kw
        assert fake.uploads == [], kw
        if status == "error":
            assert rec.anaf_error_message == svc.MSG_UNKNOWN


async def test_expire_tells_never_started_from_unknown():
    db, _, comp_id, _ = await _fixture(
        "pending_upload", anaf_stare=svc.STARE_QUEUED, last_attempt_at=_ago(hours=1),
    )
    assert await svc.expire_stuck_uploads(db, company_id=comp_id + 1) == 0
    assert await svc.expire_stuck_uploads(db, company_id=comp_id) == 1
    rec = await _rec(db)
    assert (rec.status, rec.anaf_stare, rec.anaf_error_message) == ("error", None, svc.MSG_NOT_STARTED)
    assert await svc.expire_stuck_uploads(db) == 0


async def test_status_and_list_resolve_abandoned_uploads_without_the_scheduler():
    db, acc, comp_id, receipt_id = await _fixture(
        "pending_upload", anaf_stare=svc.STARE_UPLOADING, last_attempt_at=_ago(hours=1),
    )
    ctx = await _ctx(db, acc)
    got = await ef.get_receipt_status(receipt_id, ctx=ctx, db=db)
    assert (got.status, got.anaf_stare) == ("error", svc.STARE_UNKNOWN)

    db, acc, comp_id, receipt_id = await _fixture(
        "pending_upload", anaf_stare=svc.STARE_UPLOADING, last_attempt_at=_ago(minutes=1),
    )
    ctx = await _ctx(db, acc)
    got = await ef.get_receipt_status(receipt_id, ctx=ctx, db=db)
    assert got.status == "pending_upload"

    db, acc, comp_id, receipt_id = await _fixture(
        "pending_upload", anaf_stare=svc.STARE_QUEUED, last_attempt_at=_ago(hours=1),
    )
    ctx = await _ctx(db, acc)
    page = await ef.list_company_records(
        company_id=comp_id, account_id=acc.id, ctx=ctx, page=1, page_size=25,
        status_filter=None, search=None, date_from=None, date_to=None, db=db,
    )
    assert [(r.status, r.anaf_error_message) for r in page.items] == [("error", svc.MSG_NOT_STARTED)]


# ─── /validate ────────────────────────────────────────────────────────────────

async def test_validate_returns_false_for_an_invalid_receipt():
    """Cu validarea reala din mapping: bon fara client si fara numar de factura."""
    db = await make_session()
    acc = await make_account(db)
    db.add(Company(
        account_id=acc.id, name="Firma SRL", cui=111,
        address="Str. Test 1", city="Cluj-Napoca", county_code="CJ",
    ))
    receipt = await make_receipt(db, acc)
    await add_line(db, receipt, "Manopera", "100.00")
    await db.commit()
    db.expunge_all()
    res = await ef.validate_receipt(receipt_id=receipt.id, account_id=acc.id, db=db)
    assert res.is_valid is False
    errors = [e.message for e in res.errors]
    assert NO_CLIENT in errors, errors
    assert all(e.severity == "error" for e in res.errors)
    # Erorile nu mai apar si ca avertismente.
    assert not set(errors) & {w.message for w in res.warnings}


async def test_validate_separates_errors_from_warnings():
    db, acc, _, receipt_id = await _fixture()

    def _invalid(receipt, company, client, *, raise_on_error=True, **_kw):
        if raise_on_error:
            raise AnafValidationError([NO_CLIENT])
        payload = _Payload()
        payload.issues = [NO_CLIENT, "IBAN lipsa"]
        return payload

    with _patched(ef, build_invoice_payload=_invalid):
        res = await ef.validate_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
    assert res.is_valid is False
    assert [(e.message, e.severity) for e in res.errors] == [(NO_CLIENT, "error")]
    assert [(w.message, w.severity) for w in res.warnings] == [("IBAN lipsa", "warning")]

    def _valid(receipt, company, client, **_kw):
        payload = _Payload()
        payload.issues = ["IBAN lipsa"]
        return payload

    with _patched(ef, build_invoice_payload=_valid):
        res = await ef.validate_receipt(receipt_id=receipt_id, account_id=acc.id, db=db)
    assert res.is_valid is True and res.errors == []
    assert [w.message for w in res.warnings] == ["IBAN lipsa"]


# ─── Firma emitenta: aceeasi cu seria facturii ────────────────────────────────

async def _two_companies(db):
    """Doua firme ale aceluiasi cont, fiecare cu locatia si registrul (seria) ei."""
    acc = await make_account(db)
    out = []
    for name, cui, serie in (("Firma A", 111, "AA"), ("Firma B", 222, "BB")):
        comp = Company(account_id=acc.id, name=name, cui=cui)
        reg = Register(account_id=acc.id, name=f"Registru {serie}", factura_serie=serie)
        db.add_all([comp, reg])
        await db.flush()
        loc = Location(account_id=acc.id, name=f"Punct {serie}", company_id=comp.id, register_id=reg.id)
        db.add(loc)
        await db.flush()
        out.append((comp, loc))
    return acc, out


async def test_supplier_follows_the_invoice_series():
    db = await make_session()
    acc, ((comp_a, loc_a), (comp_b, _loc_b)) = await _two_companies(db)

    async def _supplier(**kw):
        receipt = await make_receipt(db, acc, **kw)
        company, problem = await svc.resolve_supplier(db, receipt)
        assert problem is None
        return company.id

    # Bonul locatiei A, facturat de pe un device al locatiei B: seria si PDF-ul sunt
    # ale firmei B, deci si XML-ul.
    assert await _supplier(location_id=loc_a.id, factura_serie="BB", factura_nr=1) == comp_b.id
    # Bon fara locatie: inainte pleca pe prima firma a contului.
    assert await _supplier(factura_serie="BB", factura_nr=2) == comp_b.id
    # Cazul obisnuit si cele in care seria nu spune nimic raman ca inainte.
    assert await _supplier(location_id=loc_a.id, factura_serie="AA", factura_nr=3) == comp_a.id
    assert await _supplier(location_id=loc_a.id, factura_serie="VECHE", factura_nr=4) == comp_a.id
    assert await _supplier(location_id=loc_a.id) == comp_a.id
    assert await _supplier() == comp_a.id


async def test_ambiguous_supplier_blocks_sending_with_a_clear_message():
    db = await make_session()
    acc, ((_comp_a, loc_a), (_comp_b, _loc_b)) = await _two_companies(db)
    # A treia firma foloseste aceeasi serie ca B: seria nu mai arata un singur emitent.
    comp_c = Company(account_id=acc.id, name="Firma C", cui=333)
    reg_c = Register(account_id=acc.id, name="Registru C", factura_serie="BB")
    db.add_all([comp_c, reg_c])
    await db.flush()
    db.add(Location(account_id=acc.id, name="Punct C", company_id=comp_c.id, register_id=reg_c.id))
    client = await make_client(db, acc)
    created = await make_receipt(
        db, acc, client_id=client.id, location_id=loc_a.id, factura_serie="BB", factura_nr=1,
    )
    await db.commit()
    db.expunge_all()
    receipt = await _receipt(db, created.id)

    _company, problem = await svc.resolve_supplier(db, receipt)
    assert problem is not None and "BB" in problem
    exc = await _raises(AnafConfigError, svc.mark_pending_upload(db, receipt))
    assert str(exc) == problem
    with _patched(ef, build_invoice_payload=lambda *_a, **_kw: _Payload()):
        res = await ef.validate_receipt(receipt_id=receipt.id, account_id=acc.id, db=db)
    assert res.is_valid is False and [e.message for e in res.errors] == [problem]
    spawned: list = []
    with _no_background(spawned):
        detail = await raises_http(400, ef.upload_receipt(receipt_id=receipt.id, account_id=acc.id, db=db))
    assert detail == problem and spawned == []


# ─── Token ANAF expirat: 409, nu 401 ──────────────────────────────────────────

async def test_expired_anaf_token_is_409_not_401():
    db, acc, comp_id, _ = await _fixture()
    db.add(AnafToken(
        company_id=comp_id, cui="111", access_token_enc="x", refresh_token_enc="x",
        expires_at=_ago(days=1),
    ))
    await db.commit()
    ctx = await _ctx(db, acc)

    async def _expired(_db, _company_id):
        raise AnafTokenExpired("Refresh token expirat sau invalid.")

    args = dict(company_id=comp_id, account_id=acc.id, ctx=ctx, db=db)
    with _patched(ef.oauth_service, get_valid_access_token=_expired):
        for handler in (ef.refresh_company_token, ef.sync_received_for_company, ef.sync_sent_for_company):
            detail = await raises_http(409, handler(**args))
            assert detail == "Token expirat. Reconnect cu USB necesar.", handler.__name__


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_")]

if __name__ == "__main__":
    for t in TESTS:
        run(t())
    print(f"OK — {len(TESTS)} scenarii flux stari eFactura trecute.")
