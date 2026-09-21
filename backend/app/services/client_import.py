"""Importul de clienti dintr-un fisier CSV, facut de administratorul contului.

Fluxul:
  1. *Verificare* (`preview`) — citeste si valideaza fisierul, nu scrie nimic.
  2. *Import* (`start_session` + `process_session`) — creeaza o sesiune de import
     si o proceseaza in fundal, pe loturi, cu progres: randurile curate devin
     clienti, iar cele cu probleme raman in sesiune ca `pending`. Un singur
     import pe cont la un moment dat; acelasi fisier nu se importa de doua ori
     fara confirmare.
  3. *Rezolvare* — pentru fiecare rand `pending` administratorul completeaza ce
     lipseste si il importa (`import_row`), sau il respinge (`reject_rows`).
     Sesiunea ramane in istoric; cat timp are randuri `pending` „necesita actiuni".

Specificatia coloanelor (`COLUMNS`) e singura sursa de adevar: din ea se
recunoaste antetul si tot din ea isi deseneaza frontend-ul documentatia
formatului si formularul de completare. O coloana noua se adauga aici.

Date lipsa — regula, ca sistemul sa stie mereu ce a primit si ce a completat:
  * celula goala sau marcajul explicit `#LIPSA` (si `-`, `N/A`) = valoare lipsa;
  * un rand caruia ii lipseste o valoare OBLIGATORIE (inclusiv cand toata
    coloana lipseste din fisier) NU se importa automat: ajunge in lista de
    rezolvat, cu valoarea-marcaj propusa `nume` = „NECOMPLETAT (rând N)".
    Utilizatorul o poate corecta sau accepta;
  * `tip` e optional: lipsa lui inseamna persoana fizica, ca in formularul
    de client — nu e o problema de rezolvat;
  * un client importat cu valori-marcaj primeste in `comments` eticheta
    `[Import CSV] Date lipsă: ...`, deci poate fi gasit si completat ulterior;
  * CNP-ul lipsa al unei persoane fizice devine 13 zerouri — comportamentul
    normal al aplicatiei (vezi schemas/client.py), nu o problema de rezolvat.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.import_session import ImportRow, ImportSession
from app.schemas.client import CNP_PLACEHOLDER, ClientCreate
from app.services import import_common as common
# Re-exportate: fac parte din interfata importului de clienti (router, teste).
from app.services.import_common import (  # noqa: F401
    BATCH_ROWS, MAX_FILE_BYTES, ROW_IMPORTED, ROW_PENDING, ROW_REJECTED, ROW_REVERTED,
    STALE_AFTER, STATE_DONE, STATE_FAILED, STATE_PROCESSING, STATE_REVERTED,
    ImportConflictError, ImportFileError, RowActionError, effective_state, file_hash, is_stale,
    now as _now, reject_rows, session_counts,
)

KIND = "clienti"
PREVIEW_ROWS = 200

# Valori care inseamna explicit „nu stiu" — tratate ca o celula goala.
MISSING_MARKERS = ("#LIPSA", "-", "N/A")
NAME_PLACEHOLDER = "NECOMPLETAT"
MISSING_TAG = "[Import CSV] Date lipsă:"

ISSUE_ERROR, ISSUE_MISSING, ISSUE_DUPLICATE = "error", "missing", "duplicate"

log = logging.getLogger("berlinstar")


@dataclass(frozen=True)
class ColumnSpec:
    key: str
    label: str
    required: bool
    description: str
    example: str
    aliases: tuple[str, ...] = ()
    if_missing: str | None = None  # ce face sistemul cand valoarea lipseste


COLUMNS: tuple[ColumnSpec, ...] = (
    ColumnSpec(
        "nume", "Nume", True,
        "Numele persoanei fizice sau denumirea firmei. Max. 200 caractere.",
        "Popescu Ion",
        aliases=("name", "nume client", "denumire", "client", "nume si prenume", "nume prenume"),
        if_missing=f"Rândul ajunge în lista de rezolvat, cu numele propus „{NAME_PLACEHOLDER} (rând N)”.",
    ),
    ColumnSpec(
        "tip", "Tip", False,
        "fizic sau juridic (acceptă și PF / PJ, F / J, persoana fizica / juridica).",
        "fizic",
        aliases=("tip client", "tip persoana", "persoana", "type"),
        if_missing="Clientul este considerat persoană fizică (fizic).",
    ),
    ColumnSpec(
        "cui", "CUI / CNP", False,
        "Pentru juridic: CUI-ul firmei (ex. RO12345678). Pentru fizic: CNP-ul, exact 13 cifre.",
        "1850101123456",
        aliases=("cnp", "cui cnp", "cod fiscal", "cif", "cod unic"),
        if_missing="Fizic: se pune CNP-ul placeholder 0000000000000 (ca în formularul de client). Juridic: rămâne gol.",
    ),
    ColumnSpec(
        "reprezentant", "Reprezentant", False,
        "Persoana de contact (doar pentru juridic). Max. 200 caractere.",
        "",
        aliases=("persoana contact", "contact", "reprezentant legal"),
    ),
    ColumnSpec(
        "telefon", "Telefon", False,
        "Unul sau mai multe numere, despărțite prin virgulă (ex. 0722123456, 0256123456). Max. 50 caractere în total.",
        "0722123456",
        aliases=("tel", "phone", "mobil", "nr telefon", "numar telefon"),
    ),
    ColumnSpec(
        "email", "Email", False, "Adresă de e-mail. Max. 255 caractere.", "ion.popescu@exemplu.ro",
        aliases=("e-mail", "mail", "adresa email"),
    ),
    ColumnSpec(
        "adresa", "Adresă", False, "Adresa completă, pe un singur rând.", "Str. Florilor 10, Timișoara",
        aliases=("address", "adresa completa", "domiciliu", "sediu"),
    ),
    ColumnSpec(
        "numar_masina", "Număr mașină", False,
        "Numărul de înmatriculare. Mașina este adăugată și în garajul clientului. Max. 50 caractere.",
        "TM01ABC",
        aliases=("numar masina", "nr masina", "nr inmatriculare", "numar inmatriculare", "placuta", "masina"),
    ),
    ColumnSpec(
        "description", "Descriere", False, "Descriere liberă.", "",
        aliases=("descriere",),
    ),
    ColumnSpec(
        "comments", "Observații", False, "Observații interne.", "Client fidel",
        aliases=("observatii", "comentarii", "mentiuni", "note"),
    ),
)

COLUMN_KEYS = tuple(c.key for c in COLUMNS)
_REQUIRED_KEYS = tuple(c.key for c in COLUMNS if c.required)
_FIELD_LABELS = {c.key: c.label for c in COLUMNS}


def _norm_header(value: str) -> str:
    """„Număr mașină" / „NUMAR_MASINA" / „nr. mașină" -> cheie comparabila."""
    s = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


_HEADER_LOOKUP: dict[str, str] = {}
for _c in COLUMNS:
    for _name in (_c.key, _c.label, *_c.aliases):
        _HEADER_LOOKUP[_norm_header(_name)] = _c.key

_TIP_VALUES = {
    "fizic": "fizic", "fizica": "fizic", "f": "fizic", "pf": "fizic",
    "persoana fizica": "fizic", "persoana fizic": "fizic",
    "juridic": "juridic", "juridica": "juridic", "j": "juridic", "pj": "juridic",
    "persoana juridica": "juridic", "firma": "juridic", "companie": "juridic",
}


# ─── Validarea unui rand ──────────────────────────────────────────────────────

@dataclass
class Validation:
    """Rezultatul validarii valorilor unui rand, fara acces la baza de date."""
    status: str                     # ok | missing | error
    data: dict | None               # datele clientului, gata de inserat (None la eroare)
    messages: list[str] = field(default_factory=list)


def clean_value(value: object) -> str | None:
    if value is None:
        return None
    v = str(value).strip()
    if not v or v.upper() in MISSING_MARKERS:
        return None
    return v


_PHONE_CHARS = re.compile(r"^[\d\s+\-.()]+$")


def _normalize_phones(value: str) -> tuple[str | None, list[str]]:
    """„0722 111 222,0733444555" -> „0722 111 222, 0733444555".

    Intoarce si bucatile care nu arata a numar de telefon, ca randul sa ajunga
    in lista de rezolvat in loc sa salvam text oarecare in campul de telefon.
    """
    parts = [p.strip() for p in value.split(",") if p.strip()]
    bad = [p for p in parts if not _PHONE_CHARS.match(p) or not 4 <= len(re.sub(r"\D", "", p)) <= 15]
    return (", ".join(parts) or None), bad


def _looks_like_cnp(value: str | None) -> bool:
    return bool(value) and bool(re.fullmatch(r"\d{13}", re.sub(r"[\s.\-]", "", value)))


def validate_values(row_no: int, raw_values: dict) -> Validation:
    """Valideaza valorile unui rand (din fisier sau editate de utilizator).

    `raw_values` ramane neatins: in sesiune pastram ce a scris omul, iar
    valorile-marcaj si eticheta din observatii se aplica doar datelor inserate.
    """
    values = {k: clean_value(raw_values.get(k)) for k in COLUMN_KEYS}
    messages: list[str] = []
    filled: list[str] = []

    tip_raw = values["tip"]
    if tip_raw is not None:
        tip = _TIP_VALUES.get(_norm_header(tip_raw))
        if tip is None:
            return Validation("error", None, [f"Tip necunoscut „{tip_raw}”: folosește fizic sau juridic."])
    else:
        tip = "fizic"  # implicit, ca in formularul de client
    values["tip"] = tip

    if values["nume"] is None:
        values["nume"] = f"{NAME_PLACEHOLDER} (rând {row_no})"
        filled.append("nume")
        messages.append(f"Nume lipsă: propus „{values['nume']}”.")

    if values["cui"] is None:
        if tip == "fizic":
            messages.append("CNP lipsă: se folosește placeholder-ul 0000000000000.")
        else:
            messages.append("CUI lipsă pentru persoană juridică (necesar la e-Factura).")

    if values["telefon"]:
        values["telefon"], bad_phones = _normalize_phones(values["telefon"])
        if bad_phones:
            return Validation("error", None, [
                f"Telefon invalid: „{b}”. Mai multe numere se despart prin virgulă." for b in bad_phones
            ])

    if filled:
        tag = f"{MISSING_TAG} {', '.join(filled)}"
        values["comments"] = f"{values['comments']}\n{tag}" if values["comments"] else tag

    try:
        client = ClientCreate(**values)
    except ValidationError as exc:
        errors = [_format_validation_error(e) for e in exc.errors()]
        # Cazul tipic: o firma fara coloana `tip` e tratata ca persoana fizica, iar
        # CUI-ul ei pica validarea de CNP. Spunem explicit ce e de facut.
        if tip_raw is None and values["cui"] and not _looks_like_cnp(values["cui"]):
            errors.append("Tipul lipsește, deci clientul este tratat ca persoană fizică; dacă este firmă, setează tipul „juridic”.")
        return Validation("error", None, errors)

    return Validation("missing" if filled else "ok", client.model_dump(), messages)


def _format_validation_error(err: dict) -> str:
    loc = err.get("loc") or ()
    label = _FIELD_LABELS.get(str(loc[0]), str(loc[0])) if loc else ""
    msg = str(err.get("msg", "valoare invalidă")).removeprefix("Value error, ")
    if err.get("type") == "string_too_long":
        msg = f"prea lung (max. {err.get('ctx', {}).get('max_length')} caractere)"
    return f"{label}: {msg}" if label else msg


# ─── Duplicate ────────────────────────────────────────────────────────────────

def _dup_keys_name_phone(nume: str | None, telefon: str | None) -> list[tuple[str, str]]:
    """O cheie pentru fiecare numar de telefon al clientului: acelasi nume si
    oricare numar comun inseamna ca pare acelasi client."""
    if not nume:
        return []
    keys = []
    for part in (telefon or "").split(","):
        digits = re.sub(r"\D", "", part)
        if digits:
            keys.append((nume.strip().lower(), digits))
    return keys


def _cui_core(cui: str | None) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", cui or "").upper().removeprefix("RO")


def _dup_key_cui(tip: str, cui: str | None) -> str | None:
    if not cui or cui == CNP_PLACEHOLDER or not _cui_core(cui):
        return None
    return f"{tip}:{_cui_core(cui)}"


def _dup_message(existing: str) -> str:
    return f"Pare să existe deja: {existing} (același CUI/CNP sau același nume și telefon)."


async def find_duplicate(db: AsyncSession, account_id: int, data: dict) -> Client | None:
    """Clientul existent din cont care pare sa fie acelasi cu `data`."""
    cui_key = _dup_key_cui(data["tip"], data.get("cui"))
    if cui_key:
        candidates = (await db.execute(
            select(Client).where(
                Client.account_id == account_id, Client.is_deleted == False,
                Client.cui.ilike(f"%{_cui_core(data['cui'])}%"),
            )
        )).scalars().all()
        for c in candidates:
            if _dup_key_cui(c.tip, c.cui) == cui_key:
                return c
    np_keys = set(_dup_keys_name_phone(data["nume"], data.get("telefon")))
    if np_keys:
        candidates = (await db.execute(
            select(Client).where(
                Client.account_id == account_id, Client.is_deleted == False,
                func.lower(Client.nume) == data["nume"].strip().lower(), Client.telefon.is_not(None),
            )
        )).scalars().all()
        for c in candidates:
            if np_keys & set(_dup_keys_name_phone(c.nume, c.telefon)):
                return c
    return None


# ─── Citirea fisierului ───────────────────────────────────────────────────────

@dataclass
class ParsedRow:
    row: int
    values: dict                    # valorile din fisier, curatate
    validation: Validation
    duplicate_of: str | None = None


@dataclass
class ParsedFile:
    encoding: str = ""
    delimiter: str = ""
    columns_recognized: list[str] = field(default_factory=list)
    columns_missing: list[str] = field(default_factory=list)
    columns_ignored: list[str] = field(default_factory=list)
    file_warnings: list[str] = field(default_factory=list)
    rows: list[ParsedRow] = field(default_factory=list)


def _decode(raw: bytes) -> tuple[str, str]:
    # Excel pe Windows in romana salveaza „CSV" in cp1250; „CSV UTF-8" are BOM.
    for enc in ("utf-8-sig", "cp1250"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1"), "latin-1"


def _detect_delimiter(text: str) -> str:
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    counts = {d: first.count(d) for d in (";", ",", "\t", "|")}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def parse_file(raw: bytes) -> ParsedFile:
    """Transforma fisierul in randuri validate, fara acces la baza de date."""
    if len(raw) > MAX_FILE_BYTES:
        raise ImportFileError(f"Fișierul depășește {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    parsed = ParsedFile()
    text, parsed.encoding = _decode(raw)
    if not text.strip():
        raise ImportFileError("Fișierul este gol.")
    parsed.delimiter = _detect_delimiter(text)

    reader = csv.reader(io.StringIO(text), delimiter=parsed.delimiter)
    header: list[str] | None = None
    for line in reader:
        if any(c.strip() for c in line):
            header = line
            break
    if header is None:
        raise ImportFileError("Fișierul nu are rândul de antet.")

    col_index: dict[str, int] = {}
    for i, name in enumerate(header):
        key = _HEADER_LOOKUP.get(_norm_header(name))
        if key and key not in col_index:
            col_index[key] = i
        elif name.strip():
            parsed.columns_ignored.append(name.strip())
    if not col_index:
        raise ImportFileError(
            "Niciun antet recunoscut. Primul rând trebuie să conțină numele coloanelor "
            "(ex. nume;tip;cui;telefon). Descarcă modelul CSV pentru formatul corect."
        )
    parsed.columns_recognized = [k for k in COLUMN_KEYS if k in col_index]
    parsed.columns_missing = [k for k in COLUMN_KEYS if k not in col_index]
    for key in _REQUIRED_KEYS:
        if key not in col_index:
            parsed.file_warnings.append(
                f"Coloana obligatorie „{_FIELD_LABELS[key]}” lipsește din fișier: "
                "toate rândurile ajung în lista de rezolvat, cu valori propuse."
            )
    if parsed.columns_ignored:
        parsed.file_warnings.append("Coloane nerecunoscute, ignorate: " + ", ".join(parsed.columns_ignored))

    for line in reader:
        row_no = reader.line_num
        if not any(c.strip() for c in line):
            continue
        values = {
            k: clean_value(line[i]) if i < len(line) else None
            for k, i in col_index.items()
        }
        values = {k: values.get(k) for k in COLUMN_KEYS}
        if any(c.strip() for c in line[len(header):]):
            validation = Validation("error", None, [
                f"Rândul are {len(line)} coloane, dar antetul are {len(header)}: valorile s-ar decala. "
                "Dacă un câmp conține virgulă (ex. mai multe telefoane), pune-l între ghilimele "
                "sau folosește ; ca separator."
            ])
        else:
            validation = validate_values(row_no, values)
        parsed.rows.append(ParsedRow(row_no, values, validation))
    if not parsed.rows:
        raise ImportFileError("Fișierul are doar antetul, fără niciun client.")
    return parsed


async def _mark_duplicates(db: AsyncSession, account_id: int, parsed: ParsedFile) -> None:
    """Marcheaza duplicatele fata de cont si in interiorul fisierului.

    Un singur SELECT pentru tot contul, nu unul per rand: un fisier are pana la
    10.000 de randuri.
    """
    existing = (await db.execute(
        select(Client.tip, Client.cui, Client.nume, Client.telefon)
        .where(Client.account_id == account_id, Client.is_deleted == False)
    )).all()
    seen: dict[object, str] = {}
    for tip, cui, nume, tel in existing:
        for key in (_dup_key_cui(tip, cui), *_dup_keys_name_phone(nume, tel)):
            if key:
                seen.setdefault(key, f"clientul „{nume}”")
    for r in parsed.rows:
        data = r.validation.data
        if data is None:
            continue
        keys = [k for k in (_dup_key_cui(data["tip"], data.get("cui")),
                            *_dup_keys_name_phone(data["nume"], data.get("telefon"))) if k]
        hit = next((seen[k] for k in keys if k in seen), None)
        if hit:
            r.duplicate_of = hit
            continue
        for k in keys:
            seen[k] = f"rândul {r.row} din fișier"


def _row_state(p: ParsedRow) -> tuple[str | None, list[str]]:
    """(issue, mesaje) pentru un rand parsat; issue None = se importa direct."""
    v = p.validation
    if v.status == "error":
        return ISSUE_ERROR, v.messages
    if p.duplicate_of:
        return ISSUE_DUPLICATE, [_dup_message(p.duplicate_of), *v.messages]
    if v.status == "missing":
        return ISSUE_MISSING, v.messages
    return None, v.messages


# ─── Verificare (fara scriere) ────────────────────────────────────────────────

async def preview(db: AsyncSession, account_id: int, raw: bytes) -> dict:
    parsed = await asyncio.to_thread(parse_file, raw)
    await _mark_duplicates(db, account_id, parsed)
    counts = {"ok": 0, ISSUE_ERROR: 0, ISSUE_MISSING: 0, ISSUE_DUPLICATE: 0}
    rows = []
    for p in parsed.rows:
        issue, messages = _row_state(p)
        counts[issue or "ok"] += 1
        rows.append({"row": p.row, "issue": issue, "values": p.values, "messages": messages})
    return {
        **_file_info(parsed),
        "total_rows": len(parsed.rows),
        "to_import": counts["ok"],
        "to_review": counts[ISSUE_ERROR] + counts[ISSUE_MISSING] + counts[ISSUE_DUPLICATE],
        "errors": counts[ISSUE_ERROR],
        "missing": counts[ISSUE_MISSING],
        "duplicates": counts[ISSUE_DUPLICATE],
        "issues": [r for r in rows if r["issue"]][:2000],
        "preview": rows[:PREVIEW_ROWS],
    }


def _file_info(parsed: ParsedFile) -> dict:
    return {
        "encoding": parsed.encoding,
        "delimiter": parsed.delimiter,
        "columns_recognized": parsed.columns_recognized,
        "columns_missing": parsed.columns_missing,
        "columns_ignored": parsed.columns_ignored,
        "file_warnings": parsed.file_warnings,
    }


# ─── Sesiunea de import ───────────────────────────────────────────────────────

def _new_client(account_id: int, data: dict) -> Client:
    return Client(**data, account_id=account_id, created_at=_now())


async def _add_plates(db: AsyncSession, account_id: int, clients: list[Client]) -> None:
    # Clientii sunt noi, deci garajul lor e gol: placuta de pe fisa devine direct
    # rand in `client_vehicole` (aceeasi regula ca _sync_client_plate_to_garage),
    # fara o interogare per client.
    await db.flush()
    for client in clients:
        plate = (client.numar_masina or "").strip()
        if plate:
            db.add(ClientVehicol(account_id=account_id, client_id=client.id, numar_masina=plate))


async def start_session(
    db: AsyncSession, account_id: int, raw: bytes, *, filename: str | None, actor: str, force: bool = False,
) -> tuple[ImportSession, ParsedFile]:
    """Valideaza fisierul si creeaza sesiunea in starea `processing`.

    Randurile se scriu dupa aceea, in `process_session` (in fundal, din router).
    Erorile de fisier ies imediat, inainte sa existe vreo sesiune.
    """
    if len(raw) > MAX_FILE_BYTES:
        raise ImportFileError(f"Fișierul depășește {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    # Parsarea e CPU pur (mii de randuri validate cu pydantic): intr-un thread,
    # ca sa nu blocheze celelalte request-uri ale aplicatiei.
    parsed = await asyncio.to_thread(parse_file, raw)
    digest = file_hash(raw)
    await common.claim_import(db, account_id, KIND, digest, force=force)

    ts = _now()
    session = ImportSession(
        account_id=account_id, kind=KIND, filename=(filename or "")[:255] or None,
        encoding=parsed.encoding, delimiter=parsed.delimiter,
        columns_recognized=parsed.columns_recognized, file_warnings=parsed.file_warnings,
        total_rows=len(parsed.rows), created_by=actor, created_at=ts, updated_at=ts,
        state=STATE_PROCESSING, processed_rows=0, file_hash=digest,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session, parsed


async def process_session(db: AsyncSession, session_id: int, parsed: ParsedFile) -> ImportSession:
    """Scrie randurile sesiunii pe loturi; fiecare lot e o tranzactie.

    Dupa fiecare lot actualizam `processed_rows` (bara de progres). Daca ceva
    pica la mijloc, loturile deja scrise raman (clientii lor exista), iar sesiunea
    trece in `failed` cu mesajul erorii.
    """
    session = await db.get(ImportSession, session_id)
    account_id, actor = session.account_id, session.created_by
    try:
        await _mark_duplicates(db, account_id, parsed)
        for start in range(0, len(parsed.rows), BATCH_ROWS):
            batch = parsed.rows[start:start + BATCH_ROWS]
            pairs: list[tuple[ImportRow, Client]] = []
            for p in batch:
                issue, messages = _row_state(p)
                row = ImportRow(
                    session_id=session_id, account_id=account_id, row_number=p.row,
                    status=ROW_PENDING if issue else ROW_IMPORTED, issue=issue,
                    original=p.values, values=p.values, messages=messages,
                )
                db.add(row)
                if issue is None:
                    pairs.append((row, _new_client(account_id, p.validation.data)))
            for _row, client in pairs:
                db.add(client)
            await _add_plates(db, account_id, [c for _r, c in pairs])
            ts = _now()
            for row, client in pairs:
                row.client_id = client.id
                row.created = {"client_created": True}
                row.resolved_by, row.resolved_at = actor, ts
            session.processed_rows = start + len(batch)
            session.updated_at = ts
            await db.commit()
            await asyncio.sleep(0)  # lasa si alte request-uri sa ruleze intre loturi
        session.state, session.updated_at = STATE_DONE, _now()
        await db.commit()
    except Exception as exc:  # noqa: BLE001 — sesiunea trebuie sa ajunga in `failed`
        session = await common.mark_failed(db, session_id, exc)
    else:
        counts = (await session_counts(db, [session_id]))[session_id]
        log.info(
            "import clienti: account=%s user=%s session=%s file=%s imported=%s pending=%s",
            account_id, actor, session_id, session.filename, counts[ROW_IMPORTED], counts[ROW_PENDING],
        )
    await db.refresh(session)
    return session


def process_in_background(session_id: int, parsed: ParsedFile) -> None:
    common.run_in_background(lambda db: process_session(db, session_id, parsed))


async def create_session(
    db: AsyncSession, account_id: int, raw: bytes, *, filename: str | None, actor: str, force: bool = False,
) -> ImportSession:
    """Pornire + procesare in acelasi apel (teste, scripturi)."""
    session, parsed = await start_session(db, account_id, raw, filename=filename, actor=actor, force=force)
    return await process_session(db, session.id, parsed)


async def pending_summary(db: AsyncSession, account_id: int) -> dict:
    """Ce asteapta o decizie in contul curent — pentru indicatorul din meniu."""
    return (await common.pending_summary(db, account_id, (KIND,)))[KIND]


# ─── Actiuni pe randuri ───────────────────────────────────────────────────────

async def _revalidate(db: AsyncSession, row: ImportRow) -> Validation:
    """Recalculeaza problema unui rand `pending` pe valorile lui curente."""
    v = validate_values(row.row_number, row.values)
    if v.status == "error":
        row.issue, row.messages = ISSUE_ERROR, v.messages
        return v
    dup = await find_duplicate(db, row.account_id, v.data)
    if dup is not None:
        row.issue, row.messages = ISSUE_DUPLICATE, [_dup_message(f"clientul „{dup.nume}”"), *v.messages]
    else:
        row.issue, row.messages = (ISSUE_MISSING if v.status == "missing" else None), v.messages
    return v


def _editable(values: dict) -> dict:
    return {k: clean_value(values.get(k)) for k in COLUMN_KEYS}


async def update_row(db: AsyncSession, row: ImportRow, values: dict) -> ImportRow:
    """Salveaza completarile, fara import. Randul ramane `pending`."""
    await common.lock_and_require(db, row, ROW_PENDING)
    row.values = _editable(values)
    await _revalidate(db, row)
    if row.issue is None:
        row.messages = [*row.messages, "Rândul este complet și poate fi importat."]
    await common.touch_session(db, row.session_id)
    await db.commit()
    await db.refresh(row)
    return row


async def import_row(
    db: AsyncSession, row: ImportRow, *, values: dict | None, force_duplicate: bool, actor: str,
) -> ImportRow:
    """Creeaza clientul dintr-un rand `pending`.

    Valorile-marcaj sunt acceptate (utilizatorul a ales explicit sa importe);
    datele invalide si duplicatele neconfirmate nu.
    """
    await common.lock_and_require(db, row, ROW_PENDING)
    if values is not None:
        row.values = _editable(values)
    v = await _revalidate(db, row)
    if row.issue == ISSUE_ERROR:
        await db.commit()
        raise RowActionError(f"Rândul {row.row_number} are încă erori: " + " ".join(row.messages), row)
    if row.issue == ISSUE_DUPLICATE and not force_duplicate:
        await db.commit()
        raise RowActionError(
            f"Rândul {row.row_number} pare duplicat. Confirmă importul dacă este alt client.", row
        )

    client = _new_client(row.account_id, v.data)
    db.add(client)
    await _add_plates(db, row.account_id, [client])
    row.client_id = client.id
    row.created = {"client_created": True}
    row.status, row.resolved_by, row.resolved_at = ROW_IMPORTED, actor, _now()
    await common.touch_session(db, row.session_id)
    await db.commit()
    await db.refresh(row)
    return row


async def import_rows(
    db: AsyncSession, rows: list[ImportRow], *, force_duplicates: bool, actor: str,
) -> dict:
    imported, failed = 0, []
    for row in rows:
        try:
            await import_row(db, row, values=None, force_duplicate=force_duplicates, actor=actor)
            imported += 1
        except RowActionError as exc:
            failed.append({"row_id": row.id, "row": row.row_number, "message": str(exc)})
    return {"imported": imported, "failed": failed}


async def restore_rows(db: AsyncSession, rows: list[ImportRow]) -> int:
    """Readuce randuri respinse in lista de rezolvat (decizie revocata)."""
    n = 0
    for row in rows:
        if row.status == ROW_REJECTED:
            row.status, row.resolved_by, row.resolved_at = ROW_PENDING, None, None
            await _revalidate(db, row)
            n += 1
    if rows:
        await common.touch_session(db, rows[0].session_id)
    await db.commit()
    return n


# ─── Revert ───────────────────────────────────────────────────────────────────

async def revert_session(db: AsyncSession, session: ImportSession, *, actor: str, dry_run: bool) -> dict:
    """Anuleaza importul: sterge (soft delete) clientii creati de sesiune.

    Pastram clientii folositi intre timp (devize, cazari, programari, anvelope)
    sau modificati dupa import — stergerea lor ar pierde date introduse de oameni.
    Randurile inca `pending` se inchid (respinse), ca sesiunea sa nu mai ceara actiuni.
    """
    rows = (await db.execute(
        select(ImportRow).where(ImportRow.session_id == session.id, ImportRow.status == ROW_IMPORTED)
    )).scalars().all()
    by_client = {r.client_id: r for r in rows if r.client_id}
    clients = (await db.execute(
        select(Client).where(Client.id.in_(list(by_client)), Client.is_deleted == False)
    )).scalars().all() if by_client else []
    used = await common.clients_in_use(db, [c.id for c in clients])
    kept: dict[int, str] = {}
    for c in clients:
        if c.id in used:
            kept[c.id] = used[c.id]
        elif c.updated_at is not None:
            kept[c.id] = "modificat după import"
    delete_ids = [c.id for c in clients if c.id not in kept]
    pending = await db.scalar(
        select(func.count(ImportRow.id)).where(ImportRow.session_id == session.id, ImportRow.status == ROW_PENDING)
    )
    names = {c.id: c.nume for c in clients}
    summary = {
        "dry_run": dry_run,
        "clients_deleted": len(delete_ids),
        "clients_kept": len(kept),
        "pending_closed": int(pending or 0),
        "kept": [
            {"row": by_client[cid].row_number, "label": names[cid], "reason": reason}
            for cid, reason in list(kept.items())[:500]
        ],
    }
    if dry_run:
        return summary

    ts = _now()
    for chunk in common.chunks(delete_ids):
        await db.execute(update(Client).where(Client.id.in_(chunk)).values(is_deleted=True, deleted_at=ts))
        await db.execute(
            update(ClientVehicol).where(ClientVehicol.client_id.in_(chunk), ClientVehicol.is_deleted == False)
            .values(is_deleted=True, deleted_at=ts)
        )
    deleted = set(delete_ids)
    for r in rows:
        if r.client_id in deleted:
            r.status = ROW_REVERTED
        elif r.client_id in kept:
            r.messages = [*(r.messages or []), f"Păstrat la anularea importului: {kept[r.client_id]}."]
    await common.finish_revert(db, session, actor=actor, ts=ts)
    log.info(
        "import clienti revert: session=%s user=%s deleted=%s kept=%s",
        session.id, actor, len(delete_ids), len(kept),
    )
    return summary


# ─── Raport CSV ───────────────────────────────────────────────────────────────

CSV_HEADER = ["rand_fisier", "stare", "problema", *COLUMN_KEYS, "client_id", "detalii"]


def csv_row(row: ImportRow, client_name: str | None) -> list[str]:
    v = row.values or {}
    return [
        str(row.row_number), row.status, row.issue or "",
        *[v.get(k) or "" for k in COLUMN_KEYS],
        str(row.client_id or ""), " ".join(row.messages or []),
    ]


def format_spec() -> dict:
    return {
        "columns": [
            {
                "key": c.key, "label": c.label, "required": c.required,
                "description": c.description, "example": c.example,
                "aliases": list(c.aliases), "if_missing": c.if_missing,
            }
            for c in COLUMNS
        ],
        "missing_markers": list(MISSING_MARKERS),
        "name_placeholder": NAME_PLACEHOLDER,
        "missing_tag": MISSING_TAG,
        "cnp_placeholder": CNP_PLACEHOLDER,
        "max_file_mb": MAX_FILE_BYTES // (1024 * 1024),
        "max_rows": None,
        "delimiters": [";", ",", "TAB", "|"],
        "encodings": ["UTF-8", "Windows-1250"],
    }
