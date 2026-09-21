"""Importul hotelului de anvelope (anvelope depozitate) dintr-un fisier Excel/CSV.

Fisierul are o linie pe anvelopa: Nume, Prenume, Nr. masina, Latime, Inaltime,
Diametru, Marca, Profil, Sarcina, Viteza, DOT, Adancime, Anotimp, Depozitate
(data), Depozit (locul). O *cazare* = liniile cu acelasi client, aceeasi masina
si aceeasi data — de regula 4, dar pot fi 1-8 (roti lipsa, doua seturi). In
sesiunea de import un rand (`ImportRow`) e o cazare, nu o linie din fisier.

Clientul cazarii se cauta in clientii contului:
  1. dupa numarul de masina (garajul clientului si fisa lui) — criteriul principal;
  2. dupa nume + prenume (in orice ordine) — criteriul secundar.

  numar gasit la un singur client                  -> import direct
  numar la mai multi clienti, numele il alege pe unul -> import direct
  numar negasit, numele se potriveste cu un client  -> `name_match`: de confirmat
  numele se potriveste cu mai multi clienti          -> `ambiguous`: alege clientul
  niciun client                                      -> `new_client`: se creeaza
  data depozitarii invalida                          -> `error`
  exista deja cazarea (aceeasi masina, aceeasi data) -> `duplicate`

La import se creeaza: clientul nou (daca e cazul), masina in garajul clientului
(daca nu era), cazarea (loc + data + nr. masina) si anvelopele ei. Locul de
cazare, profilul, codul DOT si dimensiunea se cauta in nomenclatoarele contului
si se adauga daca lipsesc. Marcile sunt globale: una care nu exista se PROPUNE
spre aprobarea platformei si anvelopele se leaga de ea (vezi `Nomenclatoare`).

Tot ce se creeaza se noteaza (`created`), ca importul sa poata fi anulat.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.anvelopa import Anvelopa, TipAnvelopa
from app.models.cazare_anvelope import CazareAnvelopaItem, CazareAnvelope
from app.models.client import Client
from app.models.client_vehicol import ClientVehicol
from app.models.cod_dot_anvelopa import CodDotAnvelopa
from app.models.dimensiune_anvelopa import DimensiuneAnvelopa
from app.models.import_session import ImportRow, ImportSession
from app.models.loc_cazare import LocCazare
from app.models.location import Location
from app.models.marca_anvelopa import MarcaAnvelopa
from app.models.profil_anvelopa import ProfilAnvelopa
from app.models.vehicol import Vehicol
from app.schemas.client import CNP_PLACEHOLDER
from app.services import import_common as common
from app.services.import_common import (
    MAX_FILE_BYTES, ROW_IMPORTED, ROW_PENDING, ROW_REJECTED, ROW_REVERTED, STATE_DONE, STATE_PROCESSING,
    ImportFileError, RowActionError, norm_text,
)
from app.utils.plate import normalize_plate

log = logging.getLogger("berlinstar")

KIND = "hotel"
BATCH_GROUPS = 100
PREVIEW_ROWS = 2000
NAME_PLACEHOLDER = "NECOMPLETAT"
CLIENT_TAG = "[Import hotel anvelope]"

ISSUE_ERROR, ISSUE_DUPLICATE = "error", "duplicate"
ISSUE_NEW_CLIENT, ISSUE_NAME_MATCH, ISSUE_AMBIGUOUS = "new_client", "name_match", "ambiguous"
MODE_EXISTING, MODE_NEW = "existing", "new"
MAX_CANDIDATES = 10


# ─── Coloane ──────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ColumnSpec:
    key: str
    label: str
    required: bool
    description: str
    aliases: tuple[str, ...] = ()


COLUMNS: tuple[ColumnSpec, ...] = (
    ColumnSpec("nume", "Nume", False, "Numele clientului.", ("nume client", "client")),
    ColumnSpec("prenume", "Prenume", False, "Prenumele clientului."),
    ColumnSpec("numar_masina", "Nr. mașină", True,
               "Numărul de înmatriculare — criteriul principal de potrivire a clientului.",
               ("nr masina", "numar masina", "nr inmatriculare", "numar inmatriculare", "masina", "placuta")),
    ColumnSpec("latime", "Lățime", False, "Lățimea anvelopei (ex. 205).", ("latime anvelopa",)),
    ColumnSpec("inaltime", "Înălțime", False, "Înălțimea flancului (ex. 55).", ("inaltime flanc",)),
    ColumnSpec("diametru", "Diametru", False, "Diametrul jantei (ex. 16 sau 16C).", ("janta", "diametru janta")),
    ColumnSpec("dimensiune", "Dimensiune", False,
               "Alternativ la lățime/înălțime/diametru: dimensiunea completă (ex. 205/55 R16).", ("marime",)),
    ColumnSpec("marca", "Marca", False, "Marca anvelopei (se potrivește cu mărcile aprobate).", ("brand",)),
    ColumnSpec("profil", "Profil", False, "Modelul / profilul (ex. PRIMACY 4).", ("model",)),
    ColumnSpec("sarcina", "Sarcina", False, "Indicele de sarcină (ex. 91).", ("indice sarcina",)),
    ColumnSpec("viteza", "Viteza", False, "Indicele de viteză (ex. V).", ("indice viteza",)),
    ColumnSpec("dot", "DOT", False, "Codul DOT (săptămână + an, ex. 2722).", ("cod dot",)),
    ColumnSpec("adancime", "Adâncime", False, "Adâncimea profilului, în mm.", ("adancime profil", "uzura")),
    ColumnSpec("anotimp", "Anotimp", False, "Iarna / Vara / All Season.", ("sezon", "tip anvelopa")),
    ColumnSpec("data", "Depozitate", True, "Data depozitării (ex. 2025/02/12 sau 12.02.2025).",
               ("data", "data depozitare", "data depozitarii", "data checkin", "depozitat")),
    ColumnSpec("depozit", "Depozit", False, "Locul din depozit (ex. C1 DR) — devine loc de cazare.",
               ("loc", "loc cazare", "locatie", "raft")),
    ColumnSpec("telefon", "Telefon", False, "Opțional: telefonul clientului, folosit pentru clienții noi.",
               ("tel", "telefon client")),
)
COLUMN_KEYS = tuple(c.key for c in COLUMNS)

_HEADER_LOOKUP: dict[str, str] = {}
for _c in COLUMNS:
    for _name in (_c.key, _c.label, *_c.aliases):
        _HEADER_LOOKUP[norm_text(_name)] = _c.key

_WINTER_HINTS = ("WINTER", "SNOW", "ALPIN", "BLIZZAK", "ICE", "NORD", "POLAR", "HAKKA", "WINTRAC", "SNOWPROX", "WP5")


# ─── Valori ───────────────────────────────────────────────────────────────────

_JUNK = {"", "X", "XX", "-", "N/A", "#LIPSA", "`"}


def _cell(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    s = str(value).strip().strip("`").strip()
    return None if s.upper() in _JUNK else s


def _int(value: object) -> int | None:
    s = _cell(value)
    m = re.match(r"^\d+", s or "")
    return int(m.group()) if m else None


def _float(value: object) -> float | None:
    s = _cell(value)
    if s is None:
        return None
    try:
        v = float(s.replace(",", "."))
    except ValueError:
        return None
    return v if 0 <= v <= 30 else None


def parse_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = _cell(value)
    if not s:
        return None
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y.%m.%d"):
        try:
            d = datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
        return d if 1990 <= d.year <= 2100 else None
    return None


def plate_keys(raw: str | None) -> list[str]:
    """Cheile de cautare pentru un numar de masina scris liber.

    „VL018215//DJ33DIX" sau „OMODA 5 DJ09DRC" contin mai multe bucati; cautam si
    dupa fiecare bucata care arata a numar (litere + cifre, minim 5 caractere).
    """
    if not raw:
        return []
    keys = [normalize_plate(raw)]
    for token in re.split(r"[^A-Za-z0-9]+", raw):
        t = token.upper()
        if len(t) >= 5 and re.search(r"\d", t) and re.search(r"[A-Z]", t) and t not in keys:
            keys.append(t)
    return [k for k in keys if k]


def dimension_value(lat: object, inalt: object, diam: object, full: object) -> str | None:
    lat_i, inalt_i = _int(lat), _int(inalt)
    diam_s = (_cell(diam) or "").upper().replace("R", "").strip()
    if lat_i and inalt_i and re.fullmatch(r"\d{2}(\.\d)?C?", diam_s):
        return f"{lat_i}/{inalt_i} R{diam_s}"
    return _cell(full)


def dimension_key(value: str) -> str:
    return re.sub(r"[^0-9A-Z]", "", value.upper()).replace("R", "")


def compact_key(value: object) -> str:
    """„C 9" == „C9", „BF GOODRICH" == „BFGoodrich": fara spatii si semne."""
    return norm_text(value).replace(" ", "")


def dot_value(value: object) -> str | None:
    s = _cell(value)
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    if not digits:
        return None
    return digits if 3 <= len(digits) <= 4 else s[:50]


def tire_type(anotimp: object, profil: str | None) -> TipAnvelopa:
    a = norm_text(anotimp)
    if a.startswith("IARN") or a == "WINTER":
        return TipAnvelopa.IARNA
    if a.startswith("VAR") or a == "SUMMER":
        return TipAnvelopa.VARA
    if "ALL" in a or a in ("MS", "4S", "M S"):
        return TipAnvelopa.MS
    if profil and any(h in norm_text(profil).replace(" ", "") for h in _WINTER_HINTS):
        return TipAnvelopa.IARNA
    return TipAnvelopa.ALTELE


# ─── Citirea fisierului ───────────────────────────────────────────────────────

@dataclass
class Group:
    """O cazare din fisier: liniile consecutive sau nu cu aceeasi cheie."""
    rows: list[int]
    nume: str | None
    prenume: str | None
    numar_masina: str
    data_raw: str | None
    data: date | None
    depozit: str | None
    telefon: str | None
    anvelope: list[dict] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)

    @property
    def full_name(self) -> str:
        return " ".join(x for x in (self.nume, self.prenume) if x)


@dataclass
class ParsedFile:
    format: str = ""
    sheet: str | None = None
    columns_recognized: list[str] = field(default_factory=list)
    columns_ignored: list[str] = field(default_factory=list)
    file_warnings: list[str] = field(default_factory=list)
    lines: int = 0
    groups: list[Group] = field(default_factory=list)


def _read_table(raw: bytes) -> tuple[str, str | None, list[tuple[int, list[object]]]]:
    """(format, foaie, [(numar linie, celule)]) — Excel sau CSV."""
    if raw[:4] == b"PK\x03\x04":
        import openpyxl
        try:
            wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        except Exception as exc:  # noqa: BLE001 — orice fisier corupt
            raise ImportFileError(f"Fișierul Excel nu poate fi citit: {exc}") from exc
        # Doar foile VIZIBILE: registrele exportate din aplicatii vechi au adesea o
        # foaie ascunsa cu arhiva, iar importul ei in locul datelor curente ar trece
        # neobservat. Dintre foile potrivite o luam pe cea cu cele mai multe linii.
        best: tuple[int, str, list] | None = None
        hidden: list[str] = []
        for ws in wb.worksheets:
            if getattr(ws, "sheet_state", "visible") != "visible":
                hidden.append(ws.title)
                continue
            lines = [(i, list(r)) for i, r in enumerate(ws.iter_rows(values_only=True), start=1)]
            header = next((cells for _i, cells in lines if any(_cell(c) for c in cells)), None)
            if header and sum(1 for c in header if norm_text(c) in _HEADER_LOOKUP) >= 2:
                if best is None or len(lines) > best[0]:
                    best = (len(lines), ws.title, lines)
        if best is not None:
            return "xlsx", best[1], best[2]
        raise ImportFileError(
            "Nicio foaie vizibilă din fișier nu are antetul așteptat (ex. Nume, Nr. masina, Depozitate)."
            + (f" Foi ascunse, ignorate: {', '.join(hidden)}." if hidden else "")
        )
    for enc in ("utf-8-sig", "cp1250"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("latin-1")
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    delim = max((";", ",", "\t"), key=first.count)
    reader = csv.reader(io.StringIO(text), delimiter=delim)
    return "csv", None, [(i, list(r)) for i, r in enumerate(reader, start=1)]


def _complete_identity(g: "Group", nume: str | None, prenume: str | None, telefon: str | None) -> None:
    """Completeaza clientul cazarii din liniile urmatoare ale aceluiasi set.

    Daca pe liniile aceleiasi masini apar valori diferite, o pastram pe prima si
    o spunem in mesaje — nu ghicim care e proprietarul.
    """
    for camp, value in (("nume", nume), ("prenume", prenume), ("telefon", telefon)):
        current = getattr(g, camp)
        if not value:
            continue
        if not current:
            setattr(g, camp, value)
        elif norm_text(value) != norm_text(current):
            msg = f"Liniile cazării au {camp} diferit („{current}” și „{value}”); se folosește primul."
            if msg not in g.messages:
                g.messages.append(msg)


def parse_file(raw: bytes) -> ParsedFile:
    if len(raw) > MAX_FILE_BYTES:
        raise ImportFileError(f"Fișierul depășește {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    if not raw.strip():
        raise ImportFileError("Fișierul este gol.")
    parsed = ParsedFile()
    parsed.format, parsed.sheet, lines = _read_table(raw)

    header_at = next((n for n, (_i, cells) in enumerate(lines) if any(_cell(c) for c in cells)), None)
    if header_at is None:
        raise ImportFileError("Fișierul nu are rândul de antet.")
    col: dict[str, int] = {}
    for i, name in enumerate(lines[header_at][1]):
        key = _HEADER_LOOKUP.get(norm_text(name))
        if key and key not in col:
            col[key] = i
        elif _cell(name):
            parsed.columns_ignored.append(str(name).strip())
    parsed.columns_recognized = [k for k in COLUMN_KEYS if k in col]
    missing = [c.label for c in COLUMNS if c.required and c.key not in col]
    if missing:
        raise ImportFileError(
            "Lipsesc coloanele obligatorii: " + ", ".join(missing)
            + ". Primul rând trebuie să fie antetul (ex. Nume, Prenume, Nr. masina, ..., Depozitate, Depozit)."
        )
    if parsed.columns_ignored:
        parsed.file_warnings.append("Coloane nerecunoscute, ignorate: " + ", ".join(parsed.columns_ignored))

    get = lambda cells, key: cells[col[key]] if key in col and col[key] < len(cells) else None  # noqa: E731
    by_key: dict[tuple, Group] = {}
    no_plate = 0
    for line_no, cells in lines[header_at + 1:]:
        if not any(_cell(c) for c in cells):
            continue
        parsed.lines += 1
        plate = _cell(get(cells, "numar_masina"))
        if not plate:
            no_plate += 1
            continue
        nume, prenume = _cell(get(cells, "nume")), _cell(get(cells, "prenume"))
        data_cell = get(cells, "data")
        d = parse_date(data_cell)
        data_raw = d.isoformat() if d else _cell(data_cell)
        # Cheia cazarii e MASINA + DATA. Numele NU intra in cheie: in fisierele
        # reale e scris o singura data, pe prima linie a setului, iar daca l-am lua
        # in cheie setul de 4 anvelope s-ar rupe in cazari separate, iar liniile
        # urmatoare ar aparea drept „duplicate" si s-ar pierde la respingere.
        key = (normalize_plate(plate), data_raw)
        g = by_key.get(key)
        if g is None:
            g = Group(
                rows=[], nume=nume, prenume=prenume, numar_masina=plate[:50], data_raw=data_raw, data=d,
                depozit=_cell(get(cells, "depozit")), telefon=_cell(get(cells, "telefon")),
            )
            by_key[key] = g
            parsed.groups.append(g)
        else:
            _complete_identity(g, nume, prenume, _cell(get(cells, "telefon")))
        g.rows.append(line_no)
        depozit = _cell(get(cells, "depozit"))
        if depozit and g.depozit and norm_text(depozit) != norm_text(g.depozit):
            msg = f"Anvelopele sunt în locuri diferite ({g.depozit}, {depozit}); cazarea folosește {g.depozit}."
            if msg not in g.messages:
                g.messages.append(msg)
        g.anvelope.append({
            "rand": line_no,
            "dimensiune": dimension_value(get(cells, "latime"), get(cells, "inaltime"),
                                          get(cells, "diametru"), get(cells, "dimensiune")),
            "marca": _cell(get(cells, "marca")),
            "profil": _cell(get(cells, "profil")),
            "sarcina": _int(get(cells, "sarcina")),
            "viteza": (lambda v: v.upper()[:4] if v and re.fullmatch(r"[A-Za-z]{1,2}", v) else None)(
                _cell(get(cells, "viteza"))),
            "dot": dot_value(get(cells, "dot")),
            "adancime": _float(get(cells, "adancime")),
            "tip": tire_type(get(cells, "anotimp"), _cell(get(cells, "profil"))).value,
        })
    if not parsed.groups:
        raise ImportFileError("Fișierul nu conține nicio anvelopă cu număr de mașină.")
    if no_plate:
        parsed.file_warnings.append(f"{no_plate} rânduri fără număr de mașină au fost ignorate.")
    odd = sum(1 for g in parsed.groups if len(g.anvelope) != 4)
    if odd:
        parsed.file_warnings.append(f"{odd} cazări nu au exact 4 anvelope (se importă cu câte au).")
    return parsed


# ─── Potrivirea clientilor ────────────────────────────────────────────────────

@dataclass
class ClientIndex:
    names: dict[int, str]
    plates: dict[int, set[str]]
    by_plate: dict[str, set[int]]
    by_name: dict[str, set[int]]
    active_stays: set[tuple[str, str]]  # (numar masina normalizat, data) cazari existente

    def candidates(self, ids) -> list[dict]:
        return [
            {"id": cid, "nume": self.names[cid], "masini": sorted(self.plates.get(cid, ()))[:5]}
            for cid in sorted(ids)[:MAX_CANDIDATES] if cid in self.names
        ]


async def load_index(db: AsyncSession, account_id: int) -> ClientIndex:
    """Toti clientii contului, cu masinile lor, intr-un singur drum la baza de date."""
    idx = ClientIndex({}, {}, {}, {}, set())
    for cid, nume, plate in (await db.execute(
        select(Client.id, Client.nume, Client.numar_masina)
        .where(Client.account_id == account_id, Client.is_deleted == False)
    )).all():
        idx.names[cid] = nume
        idx.by_name.setdefault(norm_text(nume), set()).add(cid)
        if plate:
            _index_plate(idx, cid, plate)
    for cid, plate in (await db.execute(
        select(ClientVehicol.client_id, ClientVehicol.numar_masina)
        .where(ClientVehicol.account_id == account_id, ClientVehicol.is_deleted == False)
    )).all():
        if cid in idx.names and plate:
            _index_plate(idx, cid, plate)
    for plate, d in (await db.execute(
        select(CazareAnvelope.numar_masina, CazareAnvelope.data_checkin)
        .where(CazareAnvelope.account_id == account_id, CazareAnvelope.is_deleted == False)
    )).all():
        if plate:
            idx.active_stays.add((normalize_plate(plate), d.isoformat()))
    return idx


def _index_plate(idx: ClientIndex, cid: int, plate: str) -> None:
    for key in plate_keys(plate):
        idx.by_plate.setdefault(key, set()).add(cid)
        idx.plates.setdefault(cid, set()).add(key)


def _name_hits(idx: ClientIndex, nume: str | None, prenume: str | None) -> set[int]:
    forms = {" ".join(x for x in (a, b) if x) for a, b in ((nume, prenume), (prenume, nume))}
    forms = {norm_text(f) for f in forms if f}
    return set().union(*(idx.by_name.get(f, set()) for f in forms)) if forms else set()


@dataclass
class Match:
    issue: str | None
    values: dict
    candidates: list[dict]
    messages: list[str]


def match_group(idx: ClientIndex, g: Group) -> Match:
    values = {
        "client_mode": None, "client_id": None,
        "client_nume": g.full_name or None, "client_telefon": g.telefon,
        "numar_masina": g.numar_masina, "data_checkin": g.data_raw, "loc": g.depozit,
    }
    messages = list(g.messages)
    plate_hits = set().union(*(idx.by_plate.get(k, set()) for k in plate_keys(g.numar_masina)))
    name_hits = _name_hits(idx, g.nume, g.prenume)
    issue: str | None = None
    candidates: list[dict] = []

    chosen: int | None = None
    if len(plate_hits) == 1:
        chosen = next(iter(plate_hits))
        if g.full_name and chosen not in name_hits:
            messages.append(f"Potrivit după număr; numele din fișier „{g.full_name}” diferă de client „{idx.names[chosen]}”.")
    elif len(plate_hits) > 1:
        both = plate_hits & name_hits
        if len(both) == 1:
            chosen = next(iter(both))
        else:
            issue, candidates = ISSUE_AMBIGUOUS, idx.candidates(plate_hits)
            messages.insert(0, f"Numărul {g.numar_masina} apare la {len(plate_hits)} clienți: alege clientul.")
    elif len(name_hits) == 1:
        chosen = next(iter(name_hits))
        issue, candidates = ISSUE_NAME_MATCH, idx.candidates(name_hits)
        messages.insert(0, f"Numărul {g.numar_masina} nu e la niciun client; potrivit după nume cu „{idx.names[chosen]}”. Confirmă.")
    elif len(name_hits) > 1:
        issue, candidates = ISSUE_AMBIGUOUS, idx.candidates(name_hits)
        messages.insert(0, f"„{g.full_name}” se potrivește cu {len(name_hits)} clienți: alege clientul sau creează unul nou.")
    else:
        issue = ISSUE_NEW_CLIENT
        values["client_mode"] = MODE_NEW
        messages.insert(0, "Clientul nu există: se va crea un client nou" + (f" „{g.full_name}”." if g.full_name else " (fără nume în fișier)."))

    if chosen is not None:
        values["client_mode"], values["client_id"] = MODE_EXISTING, chosen
    if g.data is None:
        issue = ISSUE_ERROR
        messages.insert(0, f"Data depozitării lipsește sau e invalidă: „{g.data_raw or ''}”.")
    elif (normalize_plate(g.numar_masina), g.data.isoformat()) in idx.active_stays and issue != ISSUE_ERROR:
        issue = ISSUE_DUPLICATE
        messages.insert(0, f"Există deja o cazare pentru {g.numar_masina} din {g.data.isoformat()}.")
    return Match(issue, values, candidates, messages)


def _original(g: Group, m: Match) -> dict:
    return {
        "nume": g.nume, "prenume": g.prenume, "numar_masina": g.numar_masina,
        "data": g.data_raw, "depozit": g.depozit, "telefon": g.telefon,
        "randuri": g.rows, "anvelope": g.anvelope, "candidates": m.candidates,
        "match_issue": m.issue,
    }


# ─── Verificare (fara scriere) ────────────────────────────────────────────────

async def preview(db: AsyncSession, account_id: int, raw: bytes) -> dict:
    parsed = await asyncio.to_thread(parse_file, raw)
    idx = await load_index(db, account_id)
    nomen = await Nomenclatoare.load(db, account_id)
    counts = {k: 0 for k in ("ok", ISSUE_ERROR, ISSUE_DUPLICATE, ISSUE_NEW_CLIENT, ISSUE_NAME_MATCH, ISSUE_AMBIGUOUS)}
    issues = []
    new_brands: dict[str, int] = {}
    new_locs: set[str] = set()
    tires = 0
    for g in parsed.groups:
        m = match_group(idx, g)
        counts[m.issue or "ok"] += 1
        tires += len(g.anvelope)
        if g.depozit and compact_key(g.depozit) not in nomen.loc and compact_key(g.depozit) not in {
                compact_key(x) for x in new_locs}:
            new_locs.add(g.depozit)
        for a in g.anvelope:
            if nomen.marca_is_new(a["marca"]):
                name = " ".join(a["marca"].split())
                new_brands[name] = new_brands.get(name, 0) + 1
        if m.issue and len(issues) < PREVIEW_ROWS:
            issues.append(_preview_row(g, m, idx))
    return {
        **_file_info(parsed),
        "lines": parsed.lines,
        "cazari": len(parsed.groups),
        "anvelope": tires,
        "to_import": counts["ok"],
        "to_review": len(parsed.groups) - counts["ok"],
        "issues_by_type": {k: v for k, v in counts.items() if k != "ok"},
        "new_locations": sorted(new_locs),
        "new_brands": sorted(new_brands.items(), key=lambda kv: -kv[1]),
        "issues": issues,
    }


def _preview_row(g: Group, m: Match, idx: ClientIndex) -> dict:
    cid = m.values.get("client_id")
    return {
        "row": g.rows[0], "rows": g.rows, "issue": m.issue, "numar_masina": g.numar_masina,
        "nume_fisier": g.full_name or None, "data": g.data_raw, "loc": g.depozit, "anvelope": len(g.anvelope),
        "client": idx.names.get(cid) if cid else None, "candidates": m.candidates, "messages": m.messages,
    }


def _file_info(parsed: ParsedFile) -> dict:
    return {
        "format": parsed.format, "sheet": parsed.sheet,
        "columns_recognized": parsed.columns_recognized, "columns_ignored": parsed.columns_ignored,
        "file_warnings": parsed.file_warnings,
    }


# ─── Nomenclatoare ────────────────────────────────────────────────────────────

class Nomenclatoare:
    """Locurile de cazare, dimensiunile, profilurile si codurile DOT ale contului,
    plus marcile (globale). Cautare dupa cheie normalizata; ce lipseste se creeaza
    si se noteaza in `session.created`, ca importul sa poata fi anulat.

    Marcile sunt altfel decat restul: lista e comuna tuturor conturilor, iar o
    marca noua trece prin aprobarea platformei (vezi routers/marci_anvelope.py).
    Importul nu ocoleste regula — propune marca (status `pending`) si leaga
    anvelopele de ea; pana la aprobare ea nu apare in dropdown-uri, dar numele ei
    se vede pe anvelopa, deci informatia din fisier nu se pierde."""

    def __init__(self, db: AsyncSession, account_id: int):
        self.db, self.account_id = db, account_id
        self.loc: dict[str, int] = {}
        self.dim: dict[str, int] = {}
        self.profil: dict[str, int] = {}
        self.dot: dict[str, int] = {}
        self.marca: dict[str, int] = {}                      # doar aprobate
        self.marca_all: dict[str, tuple[int, str]] = {}      # orice status: (id, status)
        self.created: dict[str, list[int]] = {
            "loc_ids": [], "dimensiune_ids": [], "profil_ids": [], "dot_ids": [],
            "marca_ids": [], "marca_ids_reproposed": [],
        }

    @classmethod
    async def load(cls, db: AsyncSession, account_id: int) -> "Nomenclatoare":
        n = cls(db, account_id)
        for model, attr, target, keyfn in (
            (LocCazare, "nume", n.loc, compact_key),
            (DimensiuneAnvelopa, "valoare", n.dim, dimension_key),
            (ProfilAnvelopa, "valoare", n.profil, norm_text),
            (CodDotAnvelopa, "valoare", n.dot, lambda v: v.strip().upper()),
        ):
            rows = (await db.execute(
                select(model.id, getattr(model, attr))
                .where(model.account_id == account_id, model.is_deleted == False).order_by(model.id)
            )).all()
            for oid, value in rows:
                target.setdefault(keyfn(value), oid)
        for oid, nume, status in (await db.execute(
            select(MarcaAnvelopa.id, MarcaAnvelopa.nume, MarcaAnvelopa.status)
            .where(MarcaAnvelopa.is_deleted == False).order_by(MarcaAnvelopa.id)
        )).all():
            n.marca_all.setdefault(compact_key(nume), (oid, status))
            if status == "approved":
                n.marca.setdefault(compact_key(nume), oid)
        return n

    async def _get(self, model, attr: str, cache: dict, created_key: str, value: str | None, key: str) -> int | None:
        if not value or not key:
            return None
        if key not in cache:
            obj = model(account_id=self.account_id, **{attr: value})
            self.db.add(obj)
            await self.db.flush()
            cache[key] = obj.id
            self.created[created_key].append(obj.id)
        return cache[key]

    async def loc_id(self, value: str | None) -> int | None:
        return await self._get(LocCazare, "nume", self.loc, "loc_ids", (value or "")[:200], compact_key(value))

    async def dim_id(self, value: str | None) -> int | None:
        return await self._get(DimensiuneAnvelopa, "valoare", self.dim, "dimensiune_ids",
                               (value or "")[:100], dimension_key(value or ""))

    async def profil_id(self, value: str | None) -> int | None:
        return await self._get(ProfilAnvelopa, "valoare", self.profil, "profil_ids", (value or "")[:200], norm_text(value))

    async def dot_id(self, value: str | None) -> int | None:
        return await self._get(CodDotAnvelopa, "valoare", self.dot, "dot_ids", (value or "")[:50],
                               (value or "").strip().upper())

    def marca_id(self, value: str | None) -> int | None:
        """Marca APROBATA care se potriveste: exact (fara spatii), apoi prefix unic
        — „LAUFEN" -> Laufenn, „GENERAL" -> General Tire. O greseala de tastare mai
        mare (ex. „HANKKOK") nu se potriveste: nu ghicim marca."""
        key = compact_key(value)
        if not key:
            return None
        if key in self.marca:
            return self.marca[key]
        hits = {oid for name, oid in self.marca.items() if len(key) >= 2 and name.startswith(key)}
        return next(iter(hits)) if len(hits) == 1 else None

    async def ensure_marca(self, value: str | None) -> int | None:
        """Marca de pus pe anvelopa: cea aprobata daca exista, altfel una propusa.

        O marca deja propusa (de oricine) se refoloseste; una respinsa se repropune
        — aceleasi reguli ca la propunerea din aplicatie.
        """
        key = compact_key(value)
        if not key:
            return None
        approved = self.marca_id(value)
        if approved is not None:
            return approved
        nume = " ".join(str(value).split())[:200]
        known = self.marca_all.get(key)
        if known is not None:
            marca = await self.db.get(MarcaAnvelopa, known[0])
        else:
            # Lista de marci e comuna tuturor conturilor si are index unic pe
            # numele scris cu litere mici: intrebam baza inainte de a insera, ca
            # sa nu picam pe o marca aparuta dupa ce am incarcat nomenclatorul.
            marca = (await self.db.execute(
                select(MarcaAnvelopa).where(
                    func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
                    MarcaAnvelopa.is_deleted == False,
                )
            )).scalar_one_or_none()
        if marca is None:
            marca = MarcaAnvelopa(nume=nume, status="pending", proposed_by_account_id=self.account_id)
            try:
                # Savepoint: intre verificare si inserare, alt cont poate propune
                # aceeasi marca (lista e globala, cu index unic pe nume). Fara el,
                # conflictul ar arunca tot lotul de cazari, nu doar marca.
                async with self.db.begin_nested():
                    self.db.add(marca)
                    await self.db.flush()
            except IntegrityError:
                marca = (await self.db.execute(
                    select(MarcaAnvelopa).where(
                        func.lower(func.trim(MarcaAnvelopa.nume)) == nume.lower(),
                        MarcaAnvelopa.is_deleted == False,
                    )
                )).scalar_one()
            else:
                self.created["marca_ids"].append(marca.id)
        elif marca.status == "rejected":
            # Ca la re-propunerea din aplicatie: randul respins redevine propunere.
            # Il notam separat: randul e GLOBAL si exista dinaintea importului, deci
            # la revert trebuie readus la `rejected`, nu sters — stergerea l-ar bloca
            # pentru toate conturile (indexul unic pe nume nu exclude randurile sterse).
            marca.status, marca.proposed_by_account_id = "pending", self.account_id
            marca.rejected_at, marca.updated_at = None, common.now()
            self.created["marca_ids_reproposed"].append(marca.id)
        self.marca_all[key] = (marca.id, marca.status)
        if marca.status == "approved":
            self.marca.setdefault(key, marca.id)
        return marca.id

    def marca_is_new(self, value: str | None) -> bool:
        """Marca ar fi propusa spre aprobare (pentru raportul verificarii)."""
        key = compact_key(value)
        return bool(key) and self.marca_id(value) is None and key not in self.marca_all


# ─── Validarea deciziei pentru un rand ────────────────────────────────────────

def _clean_values(values: dict) -> dict:
    out = {
        "client_mode": values.get("client_mode") if values.get("client_mode") in (MODE_EXISTING, MODE_NEW) else None,
        "client_id": None,
        "client_nume": _cell(values.get("client_nume")),
        "client_telefon": _cell(values.get("client_telefon")),
        "numar_masina": (_cell(values.get("numar_masina")) or "")[:50] or None,
        "data_checkin": _cell(values.get("data_checkin")),
        "loc": _cell(values.get("loc")),
        "confirmed": bool(values.get("confirmed")),
    }
    try:
        out["client_id"] = int(values["client_id"]) if values.get("client_id") not in (None, "") else None
    except (TypeError, ValueError):
        out["client_id"] = None
    return out


async def revalidate(db: AsyncSession, row: ImportRow) -> None:
    """Recalculeaza problema unui rand `pending` pe decizia lui curenta."""
    v = row.values
    messages: list[str] = []
    issue: str | None = None
    d = parse_date(v.get("data_checkin"))
    if d is None:
        issue = ISSUE_ERROR
        messages.append(f"Data depozitării lipsește sau e invalidă: „{v.get('data_checkin') or ''}”.")
    if not v.get("numar_masina"):
        issue = ISSUE_ERROR
        messages.append("Numărul de mașină este obligatoriu.")
    if issue is None:
        if v.get("client_mode") == MODE_EXISTING:
            client = await db.get(Client, v.get("client_id")) if v.get("client_id") else None
            if client is None or client.account_id != row.account_id or client.is_deleted:
                issue = ISSUE_AMBIGUOUS
                messages.append("Alege un client existent sau creează unul nou.")
            elif row.original.get("match_issue") == ISSUE_NAME_MATCH and not v.get("confirmed"):
                issue = ISSUE_NAME_MATCH
                messages.append(f"Potrivit după nume cu „{client.nume}”. Confirmă.")
            else:
                messages.append(f"Client: {client.nume}.")
        elif v.get("client_mode") == MODE_NEW:
            issue = ISSUE_NEW_CLIENT
            messages.append(f"Se va crea clientul nou „{v.get('client_nume') or _placeholder(v)}”.")
        else:
            issue = ISSUE_AMBIGUOUS
            messages.append("Alege clientul (dintre cei propuși sau altul) sau creează unul nou.")
    if issue != ISSUE_ERROR and d is not None:
        exists = await db.scalar(
            select(func.count(CazareAnvelope.id)).where(
                CazareAnvelope.account_id == row.account_id, CazareAnvelope.is_deleted == False,
                CazareAnvelope.data_checkin == d,
                func.upper(func.replace(func.replace(CazareAnvelope.numar_masina, " ", ""), "-", ""))
                == normalize_plate(v.get("numar_masina")),
            )
        )
        if exists:
            issue = ISSUE_DUPLICATE
            messages.insert(0, f"Există deja o cazare pentru {v.get('numar_masina')} din {d.isoformat()}.")
    row.issue, row.messages = issue, messages


def _placeholder(values: dict) -> str:
    return f"{NAME_PLACEHOLDER} ({values.get('numar_masina') or 'fără număr'})"


# ─── Crearea datelor ──────────────────────────────────────────────────────────

class SessionClients:
    """Clientii creati de aceasta sesiune de import, ca sa nu-i cream de doua ori.

    Acelasi om are de obicei mai multe cazari in acelasi fisier (setul de iarna si
    cel de vara, sau doua masini). La rezolvarea in bloc a randurilor „client nou"
    fiecare cazare ar crea cate un client, cu aceeasi masina in doua garaje si cu
    istoricul rupt in doua — daca nu tinem minte ce am creat deja aici.

    Cautam DOAR printre clientii creati de aceasta sesiune: daca utilizatorul a
    ales „client nou" pentru cineva care exista deja in cont, decizia lui ramane.
    """

    def __init__(self, by_key: dict[str, int]):
        self.by_key = by_key

    @classmethod
    async def load(cls, db: AsyncSession, session_id: int) -> "SessionClients":
        rows = (await db.execute(
            select(ImportRow.client_id, ImportRow.created)
            .where(ImportRow.session_id == session_id, ImportRow.status == ROW_IMPORTED)
        )).all()
        ids = [cid for cid, created in rows if cid and (created or {}).get("client_created")]
        index = cls({})
        for chunk in common.chunks(ids):
            for client in (await db.execute(
                select(Client).where(Client.id.in_(chunk), Client.is_deleted == False)
            )).scalars().all():
                index.remember(client)
        return index

    def remember(self, client: Client) -> None:
        for key in plate_keys(client.numar_masina):
            self.by_key.setdefault(f"p:{key}", client.id)
        if client.nume:
            self.by_key.setdefault(f"n:{norm_text(client.nume)}", client.id)

    def find(self, nume: str | None, plate: str | None) -> int | None:
        for key in plate_keys(plate):
            if f"p:{key}" in self.by_key:
                return self.by_key[f"p:{key}"]
        return self.by_key.get(f"n:{norm_text(nume)}") if nume else None


def _plate_to_store(raw: str, known: set[str]) -> tuple[str, str | None]:
    """Numarul care se scrie pe cazare si in garaj, plus nota pentru observatii.

    In fisier apar si valori compuse („VL018215//DJ33DIX", „OMODA 5 DJ09DRC").
    Cautarea stie sa le desfaca (`plate_keys`), dar scrise ca atare ar dubla masina
    in garaj, iar POS-ul nu ar mai gasi-o dupa numarul real. Pastram bucata care
    arata a numar — de preferat cea pe care clientul o are deja — iar sirul
    original ramane in observatiile cazarii.
    """
    keys = plate_keys(raw)
    if len(keys) <= 1:
        return raw, None
    chosen = next((k for k in keys[1:] if k in known), keys[1])
    return chosen, f"Număr în fișier: {raw}."


async def _garage_keys(db: AsyncSession, client: Client) -> set[str]:
    """Toate formele numerelor pe care clientul le are deja (garaj + fisa)."""
    plates = list((await db.execute(
        select(ClientVehicol.numar_masina).where(
            ClientVehicol.client_id == client.id, ClientVehicol.is_deleted == False)
    )).scalars().all()) + [client.numar_masina]
    return {k for p in plates for k in plate_keys(p)}


async def _create_stay(
    db: AsyncSession, nomen: Nomenclatoare, row: ImportRow, values: dict, *, filename: str | None,
    location_id: int | None = None, session_clients: SessionClients | None = None,
) -> tuple[CazareAnvelope, list[Anvelopa], list[ClientVehicol], bool]:
    """Creeaza (fara commit) clientul nou, masina din garaj, cazarea si anvelopele."""
    account_id = row.account_id
    plate_raw = values["numar_masina"]
    client_created = False
    reused = session_clients.find(values.get("client_nume"), plate_raw) if session_clients else None
    if values["client_mode"] == MODE_NEW and reused is None:
        plate, plate_note = _plate_to_store(plate_raw, set())
        nume = values.get("client_nume") or _placeholder(values)
        client = Client(
            account_id=account_id, tip="fizic", nume=nume[:200], cui=CNP_PLACEHOLDER,
            telefon=(values.get("client_telefon") or None), numar_masina=plate,
            comments=f"{CLIENT_TAG} creat din {filename or 'fișier'}"
            + ("" if values.get("client_nume") else "; nume lipsă în fișier"),
        )
        db.add(client)
        await db.flush()
        client_created = True
        known_keys: set[str] = set()  # clientul e nou, deci garajul lui e gol
        if session_clients is not None:
            session_clients.remember(client)
    else:
        client = await db.get(Client, reused if reused is not None else values["client_id"])
        known_keys = await _garage_keys(db, client)
        plate, plate_note = _plate_to_store(plate_raw, known_keys)
        if reused is not None:
            row.messages = [
                *(row.messages or []),
                f"Cazarea a fost pusă pe clientul „{client.nume}”, creat mai devreme în acest import.",
            ]

    vehicole = []
    if normalize_plate(plate) not in known_keys:
        # POS-ul si Receptia cauta masina in garajul clientului: fara randul asta
        # clientul nu ar fi gasit dupa numarul de pe cazare.
        v = ClientVehicol(account_id=account_id, client_id=client.id, numar_masina=plate)
        db.add(v)
        vehicole.append(v)

    original = row.original or {}
    rows = original.get("randuri") or [row.row_number]
    comments = [f"Import hotel anvelope: {filename or 'fișier'}, rândurile {rows[0]}–{rows[-1]}."]
    if plate_note:
        comments.append(plate_note)
    if original.get("depozit") and values.get("loc") and norm_text(original["depozit"]) != norm_text(values["loc"]):
        comments.append(f"Loc în fișier: {original['depozit']}.")
    cazare = CazareAnvelope(
        account_id=account_id, client_id=client.id, loc_cazare_id=await nomen.loc_id(values.get("loc")),
        data_checkin=parse_date(values["data_checkin"]), numar_masina=plate, dep_anvelope=True,
        comments=" ".join(comments), location_id=location_id,
    )
    anvelope = []
    for a in original.get("anvelope", []):
        marca_id = await nomen.ensure_marca(a.get("marca"))
        notes = []
        if a.get("marca") and marca_id is None:
            notes.append(f"Marca din fișier: {a['marca']}.")
        anv = Anvelopa(
            account_id=account_id, client_id=client.id, marca_id=marca_id,
            dimensiune_id=await nomen.dim_id(a.get("dimensiune")), profil_id=await nomen.profil_id(a.get("profil")),
            dot_id=await nomen.dot_id(a.get("dot")), tip=TipAnvelopa(a.get("tip") or TipAnvelopa.ALTELE.value),
            adancime=a.get("adancime"), indice_viteza=a.get("viteza"), indice_sarcina=a.get("sarcina"),
            comments=" ".join(notes) or None,
        )
        db.add(anv)
        anvelope.append(anv)
        cazare.items.append(CazareAnvelopaItem(account_id=account_id, anvelopa=anv))
    db.add(cazare)
    row.client_id = client.id
    return cazare, anvelope, vehicole, client_created


def _record(row: ImportRow, cazare, anvelope, vehicole, client_created: bool, actor: str | None) -> None:
    row.created = {
        "client_created": client_created, "client_id": row.client_id, "cazare_id": cazare.id,
        "anvelopa_ids": [a.id for a in anvelope], "vehicol_ids": [v.id for v in vehicole],
    }
    row.status, row.resolved_by, row.resolved_at = ROW_IMPORTED, actor, common.now()


def _merge_session_created(session: ImportSession, nomen: Nomenclatoare) -> None:
    fresh = {k: v for k, v in nomen.created.items() if v}
    if fresh:
        common.set_created(session, **fresh)
    for v in nomen.created.values():
        v.clear()


# ─── Sesiunea de import ───────────────────────────────────────────────────────

# Importul hotelului lucreaza pe un punct de lucru: pagina Hotel arata doar
# cazarile locatiei statiei curente.
WANTS_LOCATION = True


async def resolve_location(db: AsyncSession, account_id: int, location_id: int | None) -> int | None:
    """Punctul de lucru pe care intra cazarile.

    Cu o locatie aleasa explicit o verificam (sa fie a contului si nestearsa).
    Fara ea, un cont cu un singur punct de lucru nu are ce alege, deci il luam pe
    acela — altfel cazarile ar ramane fara locatie si n-ar aparea in pagina Hotel.
    Cand sunt mai multe, alegerea e a utilizatorului si o cerem.
    """
    locs = (await db.execute(
        select(Location.id).where(Location.account_id == account_id, Location.is_deleted == False)
        .order_by(Location.id)
    )).scalars().all()
    if location_id is not None:
        if location_id not in locs:
            raise ImportFileError("Punctul de lucru ales nu există în acest cont.")
        return location_id
    if len(locs) == 1:
        return locs[0]
    if len(locs) > 1:
        raise ImportFileError("Contul are mai multe puncte de lucru: alege pe care intră cazările.")
    return None


async def start_session(
    db: AsyncSession, account_id: int, raw: bytes, *, filename: str | None, actor: str, force: bool = False,
    location_id: int | None = None,
) -> tuple[ImportSession, ParsedFile]:
    location_id = await resolve_location(db, account_id, location_id)
    parsed = await asyncio.to_thread(parse_file, raw)
    digest = common.file_hash(raw)
    await common.claim_import(db, account_id, KIND, digest, force=force)
    ts = common.now()
    session = ImportSession(
        account_id=account_id, kind=KIND, filename=(filename or "")[:255] or None,
        encoding=parsed.format, delimiter=None,
        columns_recognized=parsed.columns_recognized, file_warnings=parsed.file_warnings,
        total_rows=len(parsed.groups), created_by=actor, created_at=ts, updated_at=ts,
        state=STATE_PROCESSING, processed_rows=0, file_hash=digest, location_id=location_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session, parsed


async def process_session(db: AsyncSession, session_id: int, parsed: ParsedFile) -> ImportSession:
    """Scrie cazarile pe loturi (o tranzactie per lot), cu progres."""
    session = await db.get(ImportSession, session_id)
    account_id, actor, filename = session.account_id, session.created_by, session.filename
    location_id = session.location_id
    try:
        idx = await load_index(db, account_id)
        nomen = await Nomenclatoare.load(db, account_id)
        for start in range(0, len(parsed.groups), BATCH_GROUPS):
            batch = parsed.groups[start:start + BATCH_GROUPS]
            made = []
            for g in batch:
                m = match_group(idx, g)
                row = ImportRow(
                    session_id=session_id, account_id=account_id, row_number=g.rows[0],
                    status=ROW_PENDING if m.issue else ROW_IMPORTED, issue=m.issue,
                    original=_original(g, m), values=m.values, messages=m.messages,
                )
                db.add(row)
                if m.issue is None:
                    made.append((row, *await _create_stay(
                        db, nomen, row, m.values, filename=filename, location_id=location_id)))
                    idx.active_stays.add((normalize_plate(g.numar_masina), g.data.isoformat()))
            await db.flush()
            for row, cazare, anvelope, vehicole, client_created in made:
                _record(row, cazare, anvelope, vehicole, client_created, actor)
            _merge_session_created(session, nomen)
            session.processed_rows = start + len(batch)
            session.updated_at = common.now()
            await db.commit()
            await asyncio.sleep(0)
        session.state, session.updated_at = STATE_DONE, common.now()
        await db.commit()
    except Exception as exc:  # noqa: BLE001 — sesiunea trebuie sa ajunga in `failed`
        session = await common.mark_failed(db, session_id, exc)
    else:
        counts = (await common.session_counts(db, [session_id]))[session_id]
        log.info(
            "import hotel: account=%s user=%s session=%s file=%s imported=%s pending=%s",
            account_id, actor, session_id, filename, counts[ROW_IMPORTED], counts[ROW_PENDING],
        )
    await db.refresh(session)
    return session


def process_in_background(session_id: int, parsed: ParsedFile) -> None:
    common.run_in_background(lambda db: process_session(db, session_id, parsed))


async def create_session(
    db: AsyncSession, account_id: int, raw: bytes, *, filename: str | None, actor: str, force: bool = False,
    location_id: int | None = None,
) -> ImportSession:
    """Pornire + procesare in acelasi apel (teste, scripturi)."""
    session, parsed = await start_session(
        db, account_id, raw, filename=filename, actor=actor, force=force, location_id=location_id)
    return await process_session(db, session.id, parsed)


# ─── Actiuni pe randuri ───────────────────────────────────────────────────────

async def update_row(db: AsyncSession, row: ImportRow, values: dict) -> ImportRow:
    """Salveaza decizia (client, data, loc), fara import. Salvarea confirma
    potrivirea dupa nume."""
    await common.lock_and_require(db, row, ROW_PENDING)
    row.values = {**_clean_values(values), "confirmed": True}
    await revalidate(db, row)
    await common.touch_session(db, row.session_id)
    await db.commit()
    await db.refresh(row)
    return row


async def import_row(
    db: AsyncSession, row: ImportRow, *, values: dict | None, force_duplicate: bool, actor: str,
    nomen: Nomenclatoare | None = None, session_clients: SessionClients | None = None,
) -> ImportRow:
    """Creeaza cazarea dintr-un rand `pending`.

    `nomen` si `session_clients` se pot da din afara cand se importa mai multe
    randuri: altfel s-ar reciti nomenclatoarele contului si clientii sesiunii la
    fiecare rand.
    """
    await common.lock_and_require(db, row, ROW_PENDING)
    if values is not None:
        row.values = _clean_values(values)
    # Importul explicit confirma potrivirea dupa nume.
    row.values = {**row.values, "confirmed": True}
    await revalidate(db, row)
    if row.issue == ISSUE_ERROR:
        await db.commit()
        raise RowActionError(f"Cazarea din rândul {row.row_number} are erori: " + " ".join(row.messages), row)
    if row.issue == ISSUE_AMBIGUOUS:
        await db.commit()
        raise RowActionError(f"Cazarea din rândul {row.row_number}: alege clientul înainte de import.", row)
    if row.issue == ISSUE_DUPLICATE and not force_duplicate:
        await db.commit()
        raise RowActionError(
            f"Cazarea din rândul {row.row_number} pare să existe deja. Confirmă importul dacă e altă cazare.", row
        )
    session = await db.get(ImportSession, row.session_id)
    if nomen is None:
        nomen = await Nomenclatoare.load(db, row.account_id)
    if session_clients is None:
        session_clients = await SessionClients.load(db, row.session_id)
    cazare, anvelope, vehicole, client_created = await _create_stay(
        db, nomen, row, row.values, filename=session.filename, location_id=session.location_id,
        session_clients=session_clients,
    )
    await db.flush()
    _record(row, cazare, anvelope, vehicole, client_created, actor)
    _merge_session_created(session, nomen)
    session.updated_at = common.now()
    await db.commit()
    await db.refresh(row)
    return row


async def import_rows(db: AsyncSession, rows: list[ImportRow], *, force_duplicates: bool, actor: str) -> dict:
    imported, failed = 0, []
    if not rows:
        return {"imported": 0, "failed": []}
    # Nomenclatoarele si clientii creati in aceasta sesiune se citesc o singura
    # data pentru toata operatia, nu pentru fiecare rand.
    nomen = await Nomenclatoare.load(db, rows[0].account_id)
    session_clients = await SessionClients.load(db, rows[0].session_id)
    for row in rows:
        try:
            await import_row(db, row, values=None, force_duplicate=force_duplicates, actor=actor,
                             nomen=nomen, session_clients=session_clients)
            imported += 1
        except RowActionError as exc:
            failed.append({"row_id": row.id, "row": row.row_number, "message": str(exc)})
    return {"imported": imported, "failed": failed}


async def restore_rows(db: AsyncSession, rows: list[ImportRow]) -> int:
    n = 0
    for row in rows:
        if row.status == ROW_REJECTED:
            row.status, row.resolved_by, row.resolved_at = ROW_PENDING, None, None
            await revalidate(db, row)
            n += 1
    if rows:
        await common.touch_session(db, rows[0].session_id)
    await db.commit()
    return n


# ─── Revert ───────────────────────────────────────────────────────────────────

async def revert_session(db: AsyncSession, session: ImportSession, *, actor: str, dry_run: bool) -> dict:
    """Anuleaza importul: sterge (soft delete) cazarile si anvelopele create,
    masinile adaugate in garaj, clientii noi si nomenclatoarele noi.

    Pastram ce s-a schimbat intre timp: cazari scoase din depozit, editate, legate
    de un deviz sau continuate de o cazare noua; clienti noi care au primit intre
    timp devize, programari sau alte cazari; nomenclatoare folosite de alte anvelope.
    """
    rows = (await db.execute(
        select(ImportRow).where(ImportRow.session_id == session.id, ImportRow.status == ROW_IMPORTED)
        .order_by(ImportRow.row_number)
    )).scalars().all()
    rows = [r for r in rows if (r.created or {}).get("cazare_id")]
    cazare_ids = [r.created["cazare_id"] for r in rows]

    cazari = {c.id: c for chunk in common.chunks(cazare_ids) for c in (await db.execute(
        select(CazareAnvelope).where(CazareAnvelope.id.in_(chunk))
    )).scalars().all()}
    successors = {
        ref for chunk in common.chunks(cazare_ids) for ref in (await db.execute(
            select(CazareAnvelope.referinta_cazare_id).where(
                CazareAnvelope.referinta_cazare_id.in_(chunk), CazareAnvelope.is_deleted == False)
        )).scalars().all()
    }

    edited_tires = {
        aid for chunk in common.chunks([a for r in rows for a in r.created.get("anvelopa_ids", [])])
        for aid in (await db.execute(
            select(Anvelopa.id).where(
                Anvelopa.id.in_(chunk), Anvelopa.is_deleted == False, Anvelopa.updated_at.is_not(None))
        )).scalars().all()
    }

    kept: dict[int, str] = {}  # row.id -> motiv
    for r in rows:
        c = cazari.get(r.created["cazare_id"])
        if c is None or c.is_deleted:
            continue  # stearsa deja din aplicatie: nimic de facut
        if c.data_checkout is not None:
            kept[r.id] = "cazarea a fost scoasă din depozit"
        elif c.receipt_id is not None:
            kept[r.id] = "cazarea e legată de un deviz"
        elif c.id in successors:
            kept[r.id] = "cazarea are o cazare ulterioară"
        elif c.updated_at is not None:
            kept[r.id] = "cazarea a fost modificată după import"
        elif edited_tires.intersection(r.created.get("anvelopa_ids", [])):
            kept[r.id] = "o anvelopă a fost modificată după import"

    revert_rows = [r for r in rows if r.id not in kept]
    del_cazari = [r.created["cazare_id"] for r in revert_rows if cazari.get(r.created["cazare_id"]) is not None]
    del_anvelope = [a for r in revert_rows for a in r.created.get("anvelopa_ids", [])]

    new_clients = sorted({r.client_id for r in revert_rows if r.created.get("client_created") and r.client_id})
    # Clientii noi din randurile pastrate raman oricum (au cazarea pastrata).
    new_clients = [c for c in new_clients if c not in {r.client_id for r in rows if r.id in kept}]
    used_clients = await common.clients_in_use(
        db, new_clients, exclude_cazare_ids=set(del_cazari), exclude_anvelopa_ids=set(del_anvelope),
    )
    edited = {
        cid for chunk in common.chunks(new_clients) for cid in (await db.execute(
            select(Client.id).where(Client.id.in_(chunk), Client.updated_at.is_not(None))
        )).scalars().all()
    }
    del_clients = [c for c in new_clients if c not in used_clients and c not in edited]

    # Masinile adaugate in garaj: le scoatem, cu doua exceptii — clientul nou
    # ramane (atunci ramane si masina lui) sau masina a fost folosita pe un deviz.
    kept_new = set(new_clients) - set(del_clients)
    del_vehicole = [v for r in revert_rows if r.client_id not in kept_new for v in r.created.get("vehicol_ids", [])]
    used_veh = {
        vid for chunk in common.chunks(del_vehicole) for vid in (await db.execute(
            select(Vehicol.client_vehicol_id).where(Vehicol.client_vehicol_id.in_(chunk), Vehicol.is_deleted == False)
        )).scalars().all()
    }
    del_vehicole = [v for v in del_vehicole if v not in used_veh]
    names = {
        cid: nume for chunk in common.chunks(new_clients) for cid, nume in (await db.execute(
            select(Client.id, Client.nume).where(Client.id.in_(chunk))
        )).all()
    }

    nomen_plan = await _nomenclator_plan(db, session, set(del_anvelope), set(del_cazari))
    pending = await db.scalar(
        select(func.count(ImportRow.id)).where(ImportRow.session_id == session.id, ImportRow.status == ROW_PENDING)
    )
    by_row = {r.id: r for r in rows}
    summary = {
        "dry_run": dry_run,
        "cazari_deleted": len(del_cazari),
        "cazari_kept": len(kept),
        "anvelope_deleted": len(del_anvelope),
        "vehicole_deleted": len(del_vehicole),
        "clients_deleted": len(del_clients),
        "clients_kept": len(new_clients) - len(del_clients),
        "nomenclatoare_deleted": sum(len(v) for v in nomen_plan.values()),
        "pending_closed": int(pending or 0),
        "kept": [
            {"row": by_row[rid].row_number, "label": by_row[rid].values.get("numar_masina"), "reason": reason}
            for rid, reason in kept.items()
        ][:500] + [
            {"row": None, "label": names.get(cid), "reason": f"client nou păstrat: {used_clients.get(cid, 'modificat după import')}"}
            for cid in new_clients if cid not in del_clients
        ][:500],
    }
    if dry_run:
        return summary

    ts = common.now()
    for model, ids in (
        (CazareAnvelope, del_cazari), (Anvelopa, del_anvelope), (ClientVehicol, del_vehicole), (Client, del_clients),
        (LocCazare, nomen_plan["loc_ids"]), (DimensiuneAnvelopa, nomen_plan["dimensiune_ids"]),
        (ProfilAnvelopa, nomen_plan["profil_ids"]), (CodDotAnvelopa, nomen_plan["dot_ids"]),
        (MarcaAnvelopa, nomen_plan["marca_ids"]),
    ):
        for chunk in common.chunks(ids):
            await db.execute(
                update(model).where(model.id.in_(chunk), model.is_deleted == False).values(is_deleted=True, deleted_at=ts)
            )
    for chunk in common.chunks(nomen_plan["marca_ids_reproposed"]):
        await db.execute(
            update(MarcaAnvelopa)
            .where(MarcaAnvelopa.id.in_(chunk), MarcaAnvelopa.status == "pending")
            .values(status="rejected", rejected_at=ts, updated_at=ts)
        )
    for r in rows:
        if r.id in kept:
            r.messages = [*(r.messages or []), f"Păstrată la anularea importului: {kept[r.id]}."]
        else:
            r.status = ROW_REVERTED
    await common.finish_revert(db, session, actor=actor, ts=ts)
    log.info(
        "import hotel revert: session=%s user=%s cazari=%s anvelope=%s clienti=%s kept=%s",
        session.id, actor, len(del_cazari), len(del_anvelope), len(del_clients), len(kept),
    )
    return summary


async def _nomenclator_plan(
    db: AsyncSession, session: ImportSession, del_anvelope: set[int], del_cazari: set[int],
) -> dict[str, list[int]]:
    """Nomenclatoarele create de sesiune care nu raman folosite dupa revert."""
    created = session.created or {}
    plan = {"loc_ids": [], "dimensiune_ids": [], "profil_ids": [], "dot_ids": [],
            "marca_ids": [], "marca_ids_reproposed": []}
    loc_ids = created.get("loc_ids", [])
    if loc_ids:
        users = (await db.execute(
            select(CazareAnvelope.loc_cazare_id, CazareAnvelope.id).where(
                CazareAnvelope.loc_cazare_id.in_(loc_ids), CazareAnvelope.is_deleted == False)
        )).all()
        busy = {lid for lid, cid in users if cid not in del_cazari}
        plan["loc_ids"] = [i for i in loc_ids if i not in busy]
    # Marcile propuse de import: le retragem doar daca au ramas `pending` (daca
    # platforma le-a aprobat intre timp, sunt ale tuturor conturilor) si nu mai
    # sunt folosite de vreo anvelopa care ramane.
    for key in ("marca_ids", "marca_ids_reproposed"):
        ids = created.get(key, [])
        if not ids:
            continue
        still_pending = {mid for chunk in common.chunks(ids) for mid in (await db.execute(
            select(MarcaAnvelopa.id).where(MarcaAnvelopa.id.in_(chunk), MarcaAnvelopa.status == "pending")
        )).scalars().all()}
        plan[key] = [i for i in ids if i in still_pending]
    for key, column in (("dimensiune_ids", Anvelopa.dimensiune_id), ("profil_ids", Anvelopa.profil_id),
                        ("dot_ids", Anvelopa.dot_id), ("marca_ids", Anvelopa.marca_id),
                        ("marca_ids_reproposed", Anvelopa.marca_id)):
        ids = plan[key] if key.startswith("marca_ids") else created.get(key, [])
        if not ids:
            continue
        busy = set()
        for chunk in common.chunks(ids):
            for value, aid in (await db.execute(
                select(column, Anvelopa.id).where(column.in_(chunk), Anvelopa.is_deleted == False)
            )).all():
                if aid not in del_anvelope:
                    busy.add(value)
        plan[key] = [i for i in ids if i not in busy]
    return plan


# ─── Raport CSV ───────────────────────────────────────────────────────────────

CSV_HEADER = [
    "randuri_fisier", "stare", "problema", "nr_masina", "nume_in_fisier", "client", "client_id",
    "data", "loc", "anvelope", "cazare_id", "client_nou", "detalii",
]


def csv_row(row: ImportRow, client_name: str | None) -> list[str]:
    o, v, created = row.original or {}, row.values or {}, row.created or {}
    randuri = o.get("randuri") or [row.row_number]
    client = client_name or (f"nou: {v.get('client_nume')}" if v.get("client_mode") == MODE_NEW else "")
    return [
        f"{randuri[0]}-{randuri[-1]}" if len(randuri) > 1 else str(randuri[0]),
        row.status, row.issue or "", v.get("numar_masina") or "",
        " ".join(x for x in (o.get("nume"), o.get("prenume")) if x),
        client, str(row.client_id or ""), v.get("data_checkin") or "", v.get("loc") or "",
        str(len(o.get("anvelope") or [])), str(created.get("cazare_id") or ""),
        "da" if created.get("client_created") else "", " ".join(row.messages or []),
    ]


def format_spec() -> dict:
    return {
        "columns": [
            {"key": c.key, "label": c.label, "required": c.required, "description": c.description,
             "aliases": list(c.aliases)}
            for c in COLUMNS
        ],
        "formats": ["xlsx", "csv"],
        "max_file_mb": MAX_FILE_BYTES // (1024 * 1024),
        "name_placeholder": NAME_PLACEHOLDER,
    }
