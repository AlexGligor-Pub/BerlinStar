"""Prompturi și schemă JSON pentru descoperirea concurenților (Radar → tab „Concurenți")."""
from __future__ import annotations

import re
import unicodedata

from .prompts import _arr, _clip, _dumps, _int, _obj, _root, _str

MAX_EXCERPT_CHARS = 1_500
MAX_COMPETITORS_CHARS = 120_000
DEFAULT_RADIUS_KM = 15
WIDE_RADIUS_KM = 25

QUESTION_IDS = ("location", "radius_km", "services", "keywords", "known_competitors", "exclusions")

_QUESTION_TEXT = {
    "location": (
        "În ce localitate sau zonă căutăm concurenții?",
        "Orașul sau comuna de referință; poți adăuga și cartierul (ex. „Timișoara, zona Girocului”).",
        "text",
    ),
    "radius_km": (
        "Pe ce rază, în kilometri, căutăm?",
        "Cât de departe vin clienții la tine: 10-15 km în oraș, 25-40 km în zonă rurală.",
        "number",
    ),
    "services": (
        "Ce servicii și produse vinzi efectiv?",
        "Categorii mari, separate prin virgulă (nu produse individuale); ele decid cu cine te comparăm.",
        "text",
    ),
    "keywords": (
        "Cu ce termeni să căutăm pe Google?",
        "Ce ar tasta un client, separat prin virgulă (ex. „vulcanizare, service anvelope, hotel anvelope”).",
        "text",
    ),
    "known_competitors": (
        "Ce concurenți cunoști deja?",
        "Nume de firme, separate prin virgulă; le verificăm și pe ele. Opțional.",
        "text",
    ),
    "exclusions": (
        "Ce să ignorăm din rezultate?",
        "Ex. francize naționale, magazine online, firme din alt domeniu. Opțional.",
        "text",
    ),
}

_QUESTION_PURPOSE = {
    "location": "punctul de la care se măsoară distanțele și se centrează căutarea pe Google Places",
    "radius_km": "cât de larg se caută; prea mare aduce firme irelevante, prea mic ratează concurenți",
    "services": "lista de servicii pe care se face comparația cu fiecare concurent",
    "keywords": "termenii efectivi de căutare pe Google; de ei depinde calitatea listei de concurenți",
    "known_competitors": "firme pe care clientul le știe deja și care trebuie să apară în listă",
    "exclusions": "ce se elimină din rezultate (francize, magazine online, alt domeniu)",
}

_KEYWORD_RULES: tuple[tuple[str, str], ...] = (
    (r"anvelop|vulcaniz|cauciuc|jant|\broti\b|pana", "vulcanizare, service anvelope, hotel anvelope, echilibrare roți"),
    (r"ulei|filtr|reviz|distributi|curea|ambreiaj|amortiz|frana|frane|bujii|motor", "service auto, schimb ulei, revizie auto"),
    (r"geometri|reglaj|directi|punte", "geometrie roți, reglaj direcție"),
    (r"\bitp\b|inspectie tehnica", "ITP, inspecție tehnică periodică"),
    (r"piesa|piese|magazin|consumabil|acumulator|baterie", "magazin piese auto"),
    (r"spalat|spalator|curatar|detailing|polish|tapiteri", "spălătorie auto, detailing auto"),
    (r"tractar|remorc|asistenta rutiera", "tractări auto, asistență rutieră"),
    (r"parbriz|luneta|geam", "reparații parbrize, montaj parbrize"),
    (r"clima|climatizar|freon|ac auto", "încărcare climatizare auto"),
    (r"diagnoz|diagnostic|electric|instalatie electrica", "diagnoză auto, electrică auto"),
    (r"tinichiger|vopsit|caroseri|polizar", "tinichigerie auto, vopsitorie auto"),
)

_RURAL_RE = re.compile(r"\b(com|comuna|sat|jud)\b")


def _plain(text: str) -> str:
    """Text fără diacritice și cu litere mici, pentru potriviri tolerante."""
    norm = unicodedata.normalize("NFD", str(text or "")).lower()
    return "".join(c for c in norm if not unicodedata.combining(c))


def _names(items: list[dict]) -> list[str]:
    out: list[str] = []
    for it in items or []:
        name = str((it or {}).get("name") or "").strip()
        if name and name not in out:
            out.append(name)
    return out


def _service_list(profile_draft: dict, items: list[dict]) -> list[str]:
    out: list[str] = []
    for name in list(profile_draft.get("services") or []) + _names(items):
        name = str(name or "").strip()
        key = _plain(name)
        if name and key not in {_plain(o) for o in out}:
            out.append(name)
    return out[:15]


def _keywords(profile_draft: dict, items: list[dict]) -> str:
    haystack = _plain(
        " ".join(
            [str(profile_draft.get("activity") or ""), str(profile_draft.get("name") or "")]
            + _service_list(profile_draft, items)
        )
    )
    found: list[str] = []
    for pattern, keywords in _KEYWORD_RULES:
        if re.search(pattern, haystack):
            for kw in keywords.split(", "):
                if kw not in found:
                    found.append(kw)
    if found:
        return ", ".join(found[:8])
    services = _service_list(profile_draft, items)
    if services:
        return ", ".join(services[:5])
    return "service auto, vulcanizare, piese auto"


def _location(profile_draft: dict) -> str:
    city = str(profile_draft.get("city") or "").strip()
    county = str(profile_draft.get("county") or "").strip()
    if city and county:
        return f"{city}, județul {county}"
    return city or county or str(profile_draft.get("address") or "").strip()


def _radius(profile_draft: dict) -> int:
    city = str(profile_draft.get("city") or "").strip()
    if not city:
        return WIDE_RADIUS_KM
    address = _plain(profile_draft.get("address"))
    if _RURAL_RE.search(address.replace(".", " ")) and not re.search(r"\b(mun|municipiu|oras)\b", address.replace(".", " ")):
        return WIDE_RADIUS_KM
    return DEFAULT_RADIUS_KM


def _suggested(profile_draft: dict, items: list[dict]) -> dict:
    return {
        "location": _location(profile_draft),
        "radius_km": _radius(profile_draft),
        "services": ", ".join(_service_list(profile_draft, items)),
        "keywords": _keywords(profile_draft, items),
        "known_competitors": "",
        "exclusions": "magazine online",
    }


def default_questions(profile_draft: dict, items: list[dict]) -> list[dict]:
    """Cele 6 întrebări-prerechizite cu sugestii deduse determinist, fără AI."""
    profile_draft = dict(profile_draft or {})
    suggested = _suggested(profile_draft, items or [])
    out = []
    for qid in QUESTION_IDS:
        question, hint, qtype = _QUESTION_TEXT[qid]
        out.append({"id": qid, "question": question, "hint": hint, "type": qtype, "suggested": suggested[qid]})
    return out


def prepare_prompt(profile_draft: dict, items: list[dict]) -> str:
    """Cere AI-ului activitatea firmei și sugestii mai bune pentru cele 6 întrebări fixe."""
    profile_draft = dict(profile_draft or {})
    draft = {k: profile_draft.get(k) for k in ("name", "cui", "address", "city", "county", "activity") if profile_draft.get(k)}
    purposes = "\n".join(f"- `{qid}`: {_QUESTION_PURPOSE[qid]}" for qid in QUESTION_IDS)
    return f"""Sarcină: pregătești căutarea de concurenți pentru o firmă mică de servicii din România. Nu cauți nimic acum: doar precompletezi formularul pe care patronul îl va corecta în 30 de secunde.

# Firma clientului
{_clip(_dumps(draft), 3000) or "(fără date)"}

# Servicii și produse din nomenclator (eșantion)
{_clip(_dumps(_service_list(profile_draft, items or [])), 4000) or "(fără date)"}

# Sugestiile deterministe de plecare (le poți îmbunătăți, nu le poți înlocui structura)
{_clip(_dumps(default_questions(profile_draft, items or [])), 4000)}

# Cele 6 întrebări au id-uri FIXE: {", ".join(QUESTION_IDS)}
Le returnezi pe toate, în exact această ordine, cu exact aceste id-uri. Nu adaugi, nu redenumești, nu elimini nicio întrebare.
Rolul fiecăreia:
{purposes}

# Ce trebuie să faci
1. `activity`: 1-3 fraze despre ce face efectiv firma, deduse din nomenclator și din adresă; fără cifre inventate.
2. Pentru fiecare întrebare completezi `suggested` cu cea mai bună valoare pentru ACEASTĂ firmă: `location` din adresă, `radius_km` număr întreg (10-15 în oraș, 25-40 în zonă rurală), `services` rezumat în categorii de servicii/produse (3-8, separate prin virgulă, ex. „service auto, vulcanizare, piese auto”), NU produse individuale sau coduri din nomenclator, `keywords` termeni pe care un client i-ar tasta pe Google (3-8, separați prin virgulă, în română, fără nume de firme), `known_competitors` gol dacă nu reiese din date, `exclusions` ce ar aduce zgomot în rezultate.
3. `question` și `hint` le poți reformula ca să fie mai clare pentru un patron, dar rămân scurte; `type` rămâne „text" peste tot, cu excepția `radius_km` care e „number".
4. Nu inventezi nume de concurenți, prețuri sau localități care nu reies din date.

# Formatul răspunsului
Exclusiv un obiect JSON valid, fără text în afara lui și fără blocuri ```:
{{"activity": "…", "questions": [{{"id": "location", "question": "…", "hint": "…", "type": "text", "suggested": "…"}}, … toate cele 6 …]}}

Limba română cu diacritice, fraze scurte, ton de patron către patron."""


_COMPETITOR_FIELDS = (
    "index", "name", "address", "distance_km", "rating", "reviews_count", "types",
    "website", "site_title", "site_excerpt", "youtube_channel", "cui", "anaf_name",
)


def _shape_competitors(competitors: list[dict]) -> str:
    rows = []
    for c in competitors or []:
        row = {k: (c or {}).get(k) for k in _COMPETITOR_FIELDS}
        if row.get("site_excerpt"):
            row["site_excerpt"] = _clip(str(row["site_excerpt"]), MAX_EXCERPT_CHARS)
        rows.append(row)
    blob = _dumps(rows)
    if len(blob) <= MAX_COMPETITORS_CHARS:
        return blob
    for row in rows:
        if row.get("site_excerpt"):
            row["site_excerpt"] = _clip(str(row["site_excerpt"]), 400)
    blob = _dumps(rows)
    if len(blob) <= MAX_COMPETITORS_CHARS:
        return blob
    for row in rows:
        row["site_excerpt"] = ""
    return _clip(_dumps(rows), MAX_COMPETITORS_CHARS)


def analysis_prompt(profile: dict, competitors: list[dict]) -> str:
    """Construiește promptul care evaluează concurenții găsiți și produce sumarul de piață."""
    profile = dict(profile or {})
    client = {
        k: profile.get(k)
        for k in ("name", "cui", "address", "city", "county", "activity", "services", "keywords", "radius_km", "known_competitors", "exclusions")
        if profile.get(k) not in (None, "", [])
    }
    exclusions = profile.get("exclusions") or []
    if isinstance(exclusions, str):
        exclusions = [exclusions]
    exclusions_line = (
        "Excluderi cerute de client (le respecți: firmele care intră în ele primesc relevance sub 20 și le semnalezi în data_gaps): "
        + ", ".join(str(e) for e in exclusions)
        if exclusions
        else "Clientul nu a cerut excluderi."
    )
    return f"""Sarcină: analizezi concurenții găsiți în jurul firmei clientului și produci evaluarea fiecăruia, un sumar de piață și un draft de Focus pentru Radar. Lucrezi exclusiv cu datele de mai jos: nu ai internet, nu ai memorie despre aceste firme.

# Clientul (firma pentru care lucrezi)
{_clip(_dumps(client), 4000) or "(fără date)"}
{exclusions_line}

# Concurenții găsiți (fiecare are un `index`; distance_km e distanța față de client)
{_shape_competitors(competitors)}

# Cum evaluezi fiecare concurent
- `positioning`: 1-2 fraze despre ce pare să fie firma (gamă de servicii, specializare, tip de client), doar din nume, tipuri Google, site și date ANAF.
- `strengths` și `weaknesses`: puncte scurte, fiecare sprijinit pe un fapt din date (notă mare cu multe recenzii, site cu prețuri afișate, lipsa site-ului, puține recenzii, distanță mare, gamă îngustă).
- `threat`: cât de mult îți ia clienți: `high` = același serviciu, aproape, bine cotat; `medium` = suprapunere parțială sau mai departe; `low` = alt profil sau prezență slabă.
- `relevance`: 0-100, cât de mult merită urmărit în Radar (0-20 alt domeniu sau exclus de client, 40-60 concurent secundar, 80-100 concurent direct de urmărit lunar).
- `evidence`: 1-4 dovezi, fiecare citat sau fapt luat exact din datele primite (ex. „rating 4,7 din 320 de recenzii", „site: «hotel de anvelope 150 lei/sezon»"). Fără dovadă nu ai voie să afirmi.
- Returnezi câte un obiect pentru FIECARE index primit, în aceeași ordine, fără index-uri inventate.

# Sumar, findings, Focus
- `market_summary`: markdown, maximum 12 rânduri: densitatea concurenței pe rază (câte firme, cât de aproape), semnalele de preț și de poziționare care reies din site-uri, golurile din piață (servicii pe care nu le oferă nimeni, note slabe, reclamații) și unde poate câștiga clientul.
- `findings`: 3-8 constatări acționabile, fiecare cu `source_refs` = index-urile concurenților din care iese. O constatare fără index e permisă doar dacă vine din profilul clientului.
- `suggested_focus`: text gata de folosit în câmpul „Focus" al Radarului, 4-8 rânduri: cine e clientul și unde, ce servicii vinde, ce decizie are de luat față de acești concurenți și ce anume să urmărească la ei (prețuri afișate, servicii noi, recenzii, investiții). Scris la persoana a doua, ca instrucțiune pentru Radar, cu numele concurenților relevanți.
- `data_gaps`: ce lipsește (firme fără site, fără CUI, fără recenzii, excluderi aplicate, eșantion mic), formulat clar.

# Reguli
- Doar dovezi: nu inventezi prețuri, cifre de afaceri, ani, angajați, servicii sau nume. Ce nu reiese din date e „necunoscut" și intră în `data_gaps`.
- Separi observația de interpretare; interpretarea o marchezi cu „probabil", „sugerează".
- Nu tragi concluzii despre calitatea unei firme din nota Google dacă are sub 10 recenzii; spui că eșantionul e mic.
- Recomandările sunt la scara unei firme mici: buget mic, câțiva oameni, de făcut în zile sau săptămâni.
- Limba română cu diacritice, fraze scurte, cuvinte simple, fără jargon de consultanță.

# Schema răspunsului (JSON Schema draft-07)
{_dumps(DISCOVERY_SCHEMA)}

Răspunde exclusiv cu un obiect JSON valid conform schemei, cu toate câmpurile prezente (listele pot fi goale), fără câmpuri în plus și fără text în afara JSON-ului."""


DISCOVERY_SCHEMA: dict = _root(
    "Analiza concurenților descoperiți în jurul firmei clientului, partea produsă de AI.",
    {
        "competitors": _arr(
            "Câte un obiect pentru fiecare concurent primit, în aceeași ordine și cu același index.",
            _obj(
                "Evaluarea unui concurent, exclusiv pe baza datelor primite.",
                {
                    "index": _int("Index-ul concurentului, copiat exact din lista primită.", minimum=0),
                    "positioning": _str("1-2 fraze despre cum se poziționează firma (gamă, specializare, tip de client), doar din datele primite."),
                    "strengths": _arr(
                        "Punctele tari, ca puncte scurte, fiecare sprijinit pe un fapt din date; listă goală dacă datele nu susțin niciunul.",
                        _str("Un punct tare, formulat scurt."),
                    ),
                    "weaknesses": _arr(
                        "Punctele slabe sau lipsurile vizibile, ca puncte scurte; listă goală dacă datele nu susțin niciunul.",
                        _str("Un punct slab, formulat scurt."),
                    ),
                    "threat": _str(
                        "Cât de mult amenință clientul nostru: high = același serviciu, aproape, bine cotat; medium = suprapunere parțială; low = alt profil sau prezență slabă.",
                        enum=["high", "medium", "low"],
                    ),
                    "relevance": _int(
                        "Cât merită urmărit în Radar: 0-20 alt domeniu sau exclus de client, 40-60 concurent secundar, 80-100 concurent direct.",
                        minimum=0,
                        maximum=100,
                    ),
                    "evidence": _arr(
                        "1-4 dovezi luate exact din datele primite (citate din site, note, număr de recenzii, date ANAF); fără interpretări.",
                        _str("O dovadă, cu faptul sau citatul din care vine."),
                    ),
                },
            ),
        ),
        "market_summary": _str("Markdown, maximum 12 rânduri: densitatea concurenței, semnalele de preț și de poziționare, golurile din piață și unde poate câștiga clientul."),
        "findings": _arr(
            "3-8 constatări acționabile desprinse din lista de concurenți.",
            _obj(
                "O constatare cu impactul și sursele ei.",
                {
                    "title": _str("Constatarea în maximum 10 cuvinte."),
                    "insight": _str("2-4 fraze: întâi observația cu dovadă, apoi ce înseamnă pentru client."),
                    "impact": _str("Cât contează pentru afacerea clientului.", enum=["high", "medium", "low"]),
                    "source_refs": _arr(
                        "Index-urile concurenților care susțin constatarea; goală doar dacă vine din profilul clientului.",
                        _int("Index-ul unui concurent din listă.", minimum=0),
                    ),
                },
            ),
        ),
        "suggested_focus": _str("Draft de Focus pentru Radar, 4-8 rânduri, gata de folosit: cine e clientul, ce vinde, ce decizie are de luat și ce urmărește la acești concurenți."),
        "data_gaps": _arr(
            "Ce nu s-a putut verifica: firme fără site, fără CUI, fără recenzii, excluderi aplicate, eșantioane mici.",
            _str("O limitare, formulată clar."),
        ),
    },
)
