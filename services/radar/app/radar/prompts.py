"""Prompturi și scheme JSON pentru Radar AI: market research + suport de decizie."""
from __future__ import annotations

import json
from datetime import date

from .types import KINDS, BusinessContext

MAX_DIGEST_CHARS = 150_000
MAX_PREVIOUS_CHARS = 6_000

_KIND_LABEL = {
    "youtube": "canal YouTube urmărit",
    "company": "firmă concurentă (date ANAF)",
    "website": "site web urmărit",
    "gbusiness": "profil Google Business (recenzii)",
}
_KIND_SECTION = {
    "youtube": "youtube",
    "company": "companies",
    "website": "websites",
    "gbusiness": "reviews",
}


def _dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def _clip(text: str, limit: int) -> str:
    text = text or ""
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n[...trunchiat, {len(text) - limit} caractere omise]"


def _str(desc: str, **extra) -> dict:
    return {"type": "string", "description": desc, **extra}


def _nstr(desc: str) -> dict:
    return {"type": ["string", "null"], "description": desc}


def _num(desc: str) -> dict:
    return {"type": ["number", "null"], "description": desc}


def _nint(desc: str) -> dict:
    return {"type": ["integer", "null"], "description": desc}


def _int(desc: str, **extra) -> dict:
    return {"type": "integer", "description": desc, **extra}


def _bool(desc: str) -> dict:
    return {"type": "boolean", "description": desc}


def _arr(desc: str, items: dict) -> dict:
    return {"type": "array", "description": desc, "items": items}


def _obj(desc: str, props: dict) -> dict:
    return {
        "type": "object",
        "description": desc,
        "properties": props,
        "required": list(props),
        "additionalProperties": False,
    }


def _root(desc: str, props: dict) -> dict:
    schema = _obj(desc, props)
    schema["$schema"] = "http://json-schema.org/draft-07/schema#"
    return schema


def _source_refs() -> dict:
    return _arr(
        "Lista de snapshot_id (numere întregi) care susțin afirmația; goală doar dacă afirmația vine din contextul firmei clientului.",
        _int("Identificatorul snapshot-ului citat."),
    )


DIGEST_SCHEMAS: dict[str, dict] = {
    "youtube": _root(
        "Analiza unui videoclip de pe un canal YouTube urmărit.",
        {
            "video_title": _str("Titlul videoclipului, exact cum apare în payload."),
            "url": _str("Adresa completă a videoclipului."),
            "published_at": _str("Data publicării în format ISO 8601, copiată din payload."),
            "summary": _str("Rezumat de 3-6 fraze: despre ce s-a discutat concret, cu detalii utile (utilaje, servicii, prețuri, cifre, metode de lucru)."),
            "achievements": _arr(
                "Realizări sau anunțuri concrete prezentate (investiții, deschideri, certificări, volume, premii). Listă goală dacă nu există.",
                _str("O realizare, formulată scurt și factual."),
            ),
            "selling": _bool("true dacă videoclipul promovează sau vinde ceva (produs, serviciu, curs, abonament, utilaj)."),
            "selling_what": _nstr("Ce anume se vinde și la ce preț, dacă e menționat; null când selling este false."),
            "call_to_action": _nstr("Îndemnul la acțiune sau decizia pe care o împinge autorul către spectator; null dacă nu există."),
            "sentiment": _str("Tonul general al conținutului.", enum=["positive", "negative", "neutral"]),
            "relevance": _int("Relevanța pentru afacerea clientului și pentru Focus: 0 = irelevant, 100 = direct acționabil.", minimum=0, maximum=100),
        },
    ),
    "company": _root(
        "Analiza financiară și de poziționare a unei firme concurente, pe baza datelor ANAF.",
        {
            "cui": _int("Codul unic de înregistrare al firmei analizate."),
            "name": _str("Denumirea firmei, exact ca în payload."),
            "vat_payer": {"type": ["boolean", "null"], "description": "true dacă firma este plătitoare de TVA, null dacă nu reiese din date."},
            "status": _str("Starea firmei la ANAF (activă, inactivă, radiată etc.); șir gol dacă lipsește."),
            "financials": _arr(
                "Serie de indicatori pe ani, ordonată crescător după an; doar valori prezente în payload, fără estimări.",
                _obj(
                    "Indicatorii unui an fiscal.",
                    {
                        "year": _int("Anul fiscal."),
                        "turnover": _num("Cifra de afaceri în lei; null dacă lipsește."),
                        "profit": _num("Profitul net în lei (valoare negativă = pierdere); null dacă lipsește."),
                        "employees": _nint("Numărul mediu de salariați; null dacă lipsește."),
                    },
                ),
            ),
            "trend": _str("Direcția generală a afacerii pe baza cifrelor disponibile; unknown dacă sunt sub doi ani de date.", enum=["up", "down", "flat", "unknown"]),
            "commentary": _str("4-8 fraze: ce arată cifrele (variații în procente calculate din date), ce înseamnă pentru clientul nostru (scara concurentului, capacitatea de investiție, presiunea pe preț) și ce rămâne de urmărit."),
        },
    ),
    "website": _root(
        "Analiza unei pagini web urmărite, axată pe noutăți față de ce e obișnuit în domeniu.",
        {
            "url": _str("Adresa paginii analizate."),
            "title": _str("Titlul paginii."),
            "novelties": _arr(
                "Noutățile identificate pe pagină; listă goală dacă pagina nu conține nimic nou sau relevant.",
                _obj(
                    "O noutate identificată pe pagină.",
                    {
                        "title": _str("Numele noutății, scurt (maximum 8 cuvinte)."),
                        "description": _str("2-4 fraze: ce este, ce rezolvă, ce înseamnă pentru clientul nostru; prețurile se citează doar dacă apar pe pagină."),
                        "image_url": _nstr("URL de imagine ales STRICT din lista images a payload-ului, doar dacă ilustrează clar această noutate; altfel null."),
                        "link": _nstr("Link către pagina detaliată, ales din linkurile payload-ului; dacă nu există, adresa paginii curente."),
                        "category": _str("Tipul noutății.", enum=["echipament", "serviciu", "tehnologie", "pret", "altceva"]),
                    },
                ),
            ),
            "commentary": _str("3-6 fraze: ce semnal de piață dă pagina (poziționare, prețuri, țintă), ce merită copiat și ce nu."),
        },
    ),
    "gbusiness": _root(
        "Analiza vocii clienților dintr-un profil Google Business.",
        {
            "name": _str("Denumirea afacerii, ca în payload."),
            "rating": _num("Nota medie afișată; null dacă lipsește."),
            "reviews_count": _nint("Numărul total de recenzii raportat de Google; null dacă lipsește."),
            "themes": _arr(
                "Temele recurente din recenziile primite, ordonate după frecvență.",
                _obj(
                    "O temă desprinsă din recenzii.",
                    {
                        "theme": _str("Tema, în 2-5 cuvinte (ex. timp de așteptare, preț, amabilitate)."),
                        "sentiment": _str("Tonul dominant al temei.", enum=["positive", "negative", "neutral"]),
                        "count": _int("Câte dintre recenziile primite ating tema; numărate, nu estimate.", minimum=0),
                        "example": _str("Un citat scurt din recenzii care ilustrează tema."),
                    },
                ),
            ),
            "praise": _arr("Ce laudă clienții, ca puncte scurte.", _str("Un motiv de laudă.")),
            "complaints": _arr("De ce se plâng clienții, ca puncte scurte.", _str("O reclamație.")),
            "commentary": _str("4-7 fraze cu două părți explicite: „De copiat:” comportamentele care aduc laude și „De evitat:” greșelile care aduc reclamații, raportate la afacerea clientului. Menționează că Google returnează maximum 5 recenzii, deci eșantionul e mic."),
        },
    ),
}

REPORT_SCHEMA: dict = _root(
    "Raport Radar AI v1, fără secțiunile pe surse (acelea sunt completate de aplicație).",
    {
        "version": _int("Versiunea formatului de raport; mereu 1.", enum=[1]),
        "generated_at": _str("Data și ora generării raportului, ISO 8601."),
        "period": _obj(
            "Perioada acoperită de raport.",
            {
                "from": _str("Data de început, format YYYY-MM-DD."),
                "to": _str("Data de sfârșit, format YYYY-MM-DD."),
            },
        ),
        "title": _str("Titlu scurt (maximum 70 de caractere) care spune concluzia principală a perioadei."),
        "executive_summary": _str("Markdown, maximum 10 rânduri: ce s-a întâmplat relevant, ce înseamnă pentru firmă, ce urmează. Fără jargon."),
        "key_signals": _arr(
            "Semnalele importante din perioadă, ordonate după impact; maximum 8.",
            _obj(
                "Un semnal de piață observat.",
                {
                    "title": _str("Semnalul în maximum 10 cuvinte."),
                    "insight": _str("2-4 fraze: întâi observația cu dovadă, apoi interpretarea marcată ca atare."),
                    "impact": _str("Cât de mult contează pentru afacerea clientului.", enum=["high", "medium", "low"]),
                    "sentiment": _str("Semnalul este oportunitate (positive), amenințare (negative) sau neutru.", enum=["positive", "negative", "neutral"]),
                    "source_refs": _source_refs(),
                },
            ),
        ),
        "recommendations": _arr(
            "Acțiuni concrete recomandate, ordonate după prioritate; maximum 6.",
            _obj(
                "O recomandare cu justificare și acțiune.",
                {
                    "title": _str("Recomandarea în maximum 10 cuvinte."),
                    "rationale": _str("De ce, pe baza dovezilor din perioadă; 2-4 fraze."),
                    "action": _str("Ce face concret patronul: pași, cine, în cât timp, ce cost aproximativ dacă reiese din date."),
                    "priority": _int("Prioritatea, 1 = cea mai mare.", minimum=1, maximum=5),
                    "horizon": _str("Când se face.", enum=["acum", "30_zile", "trimestru"]),
                    "confidence": _str("Câtă încredere ai în recomandare, după calitatea dovezilor.", enum=["high", "medium", "low"]),
                    "source_refs": _source_refs(),
                },
            ),
        ),
        "decision_frame": _obj(
            "Cadrul pentru cea mai importantă decizie a perioadei.",
            {
                "question": _str("Decizia formulată ca întrebare, cu opțiuni clare."),
                "options": _arr(
                    "Opțiunile reale, inclusiv varianta „nu facem nimic acum”; 2-4 opțiuni.",
                    _obj(
                        "O opțiune de decizie.",
                        {
                            "option": _str("Opțiunea, formulată scurt."),
                            "pros": _arr("Argumente pentru.", _str("Un argument pro.")),
                            "cons": _arr("Argumente împotrivă.", _str("Un argument contra.")),
                            "evidence": _arr("Dovezile care susțin evaluarea, fiecare cu referință la snapshot (ex. „snapshot 42: preț afișat 250 lei”).", _str("O dovadă cu sursa ei.")),
                        },
                    ),
                ),
                "recommended": _str("Opțiunea recomandată, motivul în 1-2 fraze și, explicit, ce informație nouă te-ar face să te răzgândești."),
                "risks": _arr(
                    "Pre-mortem: presupunând că peste 3 luni decizia a eșuat, care au fost cauzele și cum se pot preveni.",
                    _str("Un risc și măsura de reducere."),
                ),
            },
        ),
        "history_delta": _str("Ce s-a schimbat față de raportul precedent: semnale noi, semnale dispărute, recomandări rămase deschise. Dacă nu există raport precedent, exact textul „Primul raport.”"),
        "data_gaps": _arr(
            "Ce nu s-a putut verifica: surse fără date, informații lipsă, limitări de eșantion. Listă goală doar dacă nu există nicio limitare.",
            _str("O limitare, formulată clar."),
        ),
    },
)


def _ctx_block(ctx: BusinessContext) -> str:
    parts = [f"Nume cont: {ctx.account_name or 'necunoscut'}"]
    if ctx.business_context:
        parts.append(f"Descrierea afacerii:\n{_clip(ctx.business_context, 4000)}")
    if ctx.companies:
        parts.append("Firmele clientului: " + _clip(_dumps(ctx.companies[:5]), 2000))
    if ctx.items:
        parts.append("Produse și servicii oferite (eșantion): " + _clip(_dumps(ctx.items[:60]), 4000))
    if len(parts) == 1:
        parts.append("Descrierea afacerii nu este completată; deduci profilul din surse și notezi lipsa în data_gaps.")
    return "\n".join(parts)


def _focus_block(focus: str) -> str:
    focus = (focus or "").strip()
    if not focus:
        return "Focus: nedefinit. Aplici lentilele standard: concurență, preț, cerere, tehnologie, vocea clientului."
    return f"Focus cerut de client (prioritar în analiză):\n{_clip(focus, 2000)}"


def system_prompt(ctx: BusinessContext) -> str:
    """Prompt de sistem cachebil: rolul analistului, lentilele de lucru și regulile de stil."""
    return f"""Ești analist senior de market research și suport de decizie pentru afaceri mici de servicii din România: vulcanizări, service auto, magazine de piese, hotel de anvelope. Scrii pentru patronul firmei, nu pentru un consiliu de administrație.

# Clientul tău
{_ctx_block(ctx)}

# Reguli de rigoare
- Orice afirmație se sprijină pe datele primite. Nu inventezi cifre, prețuri, date calendaristice sau nume.
- Ce nu reiese din date scrii „necunoscut” și adaugi limitarea în data_gaps.
- Separi observația (ce apare în sursă) de interpretare (ce crezi că înseamnă); interpretarea o marchezi: „probabil”, „sugerează”, „ipoteză”.
- Procentele și diferențele le calculezi doar din cifrele primite și arăți baza calculului.
- Un singur semnal nu este tendință. Nu generalizezi de la un caz.
- Citezi sursele prin snapshot_id, în source_refs și în evidence.

# Lentile de market research
- Mișcări ale concurenței: servicii noi, investiții, extinderi, angajări, campanii.
- Semnale de preț: prețuri afișate, promoții, pachete, indicii de scumpire sau ieftinire.
- Semnale de cerere: sezonalitate, aglomerație, timpi de așteptare, ce cer clienții.
- Adopție de tehnologie: utilaje, software, digitalizare, canale online.
- Vocea clientului: recenzii, laude, reclamații, teme repetate.
- Comportamente de copiat versus anti-tipare: ce face concurența bine și ce greșește vizibil.

# Lentile de decizie
- Formulezi opțiuni reale, inclusiv „nu facem nimic acum”, fiecare cu pro, contra și dovezi.
- Prioritate 1-5 (1 = cea mai mare), orizont acum | 30_zile | trimestru.
- Încredere high/medium/low după cantitatea și calitatea dovezilor, nu după cât de atrăgătoare e ideea.
- Pre-mortem: presupui că peste 3 luni decizia a eșuat și scrii cauzele ca riscuri, cu măsuri de prevenire.
- Spui explicit ce informație nouă te-ar face să te răzgândești.
- Recomandările sunt la scara unei firme mici: buget mic, 1-10 oameni, de făcut în zile sau săptămâni.

# Stil
- Limba română cu diacritice. Fraze scurte. Cuvinte simple, fără jargon de consultanță și fără anglicisme inutile.
- Concret: cifre, nume, acțiuni. Fără umplutură și fără complimente.
- Răspunzi exclusiv cu un obiect JSON valid conform schemei cerute, fără text înainte sau după, fără blocuri ``` și fără comentarii, cu excepția sarcinilor unde ți se cere explicit text simplu."""


def context_prompt(companies: list[dict], items: list[dict]) -> str:
    """Cere o descriere în proză a afacerii clientului, pornind de la firme și nomenclator."""
    comp = _clip(_dumps([
        {k: c.get(k) for k in ("name", "cui", "address", "description", "website") if c.get(k)}
        for c in (companies or [])[:10]
    ]), 6000)
    prod = _clip(_dumps([
        {k: it.get(k) for k in ("name", "description", "price", "unit") if it.get(k) not in (None, "")}
        for it in (items or [])[:150]
    ]), 12000)
    return f"""Scrie descrierea afacerii acestui client, ca punct de plecare pentru analizele de piață.

# Firmele clientului
{comp or "(fără date)"}

# Produse și servicii din nomenclator (eșantion)
{prod or "(fără date)"}

# Ce trebuie să conțină descrierea
1. Ce vinde efectiv: serviciile și produsele principale, deduse din nomenclator.
2. Cui vinde: tipul de client, zona geografică dacă reiese din adresă.
3. Poziționare: gama de prețuri, nivelul de specializare, ce pare să fie punctul forte.
4. Cine sunt, probabil, concurenții: tipul de firmă, nu nume inventate.
5. Pârghiile de decizie: ce influențează cel mai mult veniturile (preț, volum, sezon, capacitate, servicii noi).
6. Ce nu reiese din date și ar trebui completat manual de patron.

# Reguli
- 6-12 rânduri, proză continuă, fără liste și fără titluri.
- Doar ce reiese din date; ce e deducție marchezi cu „probabil”. Nu inventezi cifră de afaceri, angajați sau clienți.
- Limba română cu diacritice, fraze scurte, ton neutru.
- Răspunzi doar cu textul descrierii, fără JSON și fără introduceri.
"""


def _shape_payload(kind: str, payload: dict) -> dict:
    p = dict(payload or {})
    if kind == "youtube":
        if p.get("transcript"):
            p["transcript"] = _clip(str(p["transcript"]), 24000)
        if p.get("description"):
            p["description"] = _clip(str(p["description"]), 4000)
    elif kind == "company":
        company = {k: v for k, v in dict(p.get("company") or {}).items() if k != "raw"}
        bilant = [{k: v for k, v in dict(b or {}).items() if k != "raw"} for b in (p.get("bilant") or [])]
        p = {"company": company, "bilant": bilant}
    elif kind == "website":
        p["text"] = _clip(str(p.get("text") or ""), 16000)
        p["images"] = [{"src": i.get("src"), "alt": i.get("alt", "")} for i in (p.get("images") or [])[:40]]
        p["links"] = (p.get("links") or [])[:30]
    elif kind == "gbusiness":
        reviews = []
        for r in (p.get("reviews") or [])[:10]:
            r = dict(r)
            r["text"] = _clip(str(r.get("text") or ""), 1500)
            reviews.append(r)
        p["reviews"] = reviews
    return p


_DIGEST_TASK = {
    "youtube": """Analizează videoclipul de mai jos.
- summary: despre ce s-a discutat concret, cu detaliile utile unui patron (utilaje, servicii, prețuri, cifre, metode de lucru). Folosește transcriptul dacă există; dacă lipsește, spune asta în summary și fii prudent.
- achievements: realizări sau anunțuri verificabile din conținut.
- selling, selling_what, call_to_action: dacă se promovează ceva și ce decizie e împinsă către spectator.
- sentiment: tonul general.
- relevance: 0-100, cât de util e conținutul pentru afacerea clientului și pentru Focus (0-20 divertisment fără legătură, 40-60 context de domeniu, 80-100 direct acționabil).""",
    "company": """Analizează firma concurentă de mai jos, pe baza datelor ANAF.
- financials: doar anii și valorile prezente în date, ordonate crescător.
- trend: direcția care rezultă din cifre; unknown dacă ai sub doi ani de date.
- commentary: ce arată cifrele (variații în procente calculate din date), ce înseamnă pentru clientul nostru (scara concurentului față de el, capacitatea de investiție, presiunea pe preț, cifra de afaceri pe angajat dacă ai datele) și ce rămâne de urmărit. Bilanțurile ANAF au întârziere de aproximativ un an; menționează asta dacă influențează concluzia.""",
    "website": """Analizează pagina de mai jos și extrage NOUTĂȚILE: echipamente noi, servicii noi, tehnologii, prețuri afișate, promoții, extinderi.
- Nu raporta ca noutate ce e banal pentru domeniu (program, contact, „calitate și seriozitate”).
- image_url: alege exclusiv din lista images a payload-ului și doar când imaginea are legătură clară cu noutatea (alt sau nume de fișier potrivit); altfel null. Nu construi și nu ghici adrese de imagini.
- link: alege din linkurile payload-ului pagina care detaliază noutatea; dacă nu există, folosește adresa paginii curente.
- commentary: ce semnal de piață dă pagina și ce merită copiat sau evitat.""",
    "gbusiness": """Analizează recenziile de mai jos: este vocea clientului.
- themes: teme recurente, cu numărul real de recenzii care le ating și un citat scurt.
- praise și complaints: puncte scurte, formulate din ce scriu clienții, nu din presupuneri.
- commentary: secțiunea „De copiat:” (comportamentele care produc laude) și „De evitat:” (greșelile care produc reclamații), raportate la afacerea clientului. Google returnează maximum 5 recenzii, deci eșantionul e mic și trebuie spus.""",
}


def digest_prompt(kind: str, ctx: BusinessContext, payload: dict, focus: str) -> str:
    """Construiește promptul de analiză pentru un singur element colectat."""
    if kind not in KINDS or kind not in DIGEST_SCHEMAS:
        raise ValueError(f"kind necunoscut: {kind}")
    return f"""Sarcină: analizezi un element dintr-o sursă de tip {_KIND_LABEL[kind]}. Rezultatul intră în secțiunea „{_KIND_SECTION[kind]}” a raportului.

# Clientul
{_ctx_block(ctx)}

# {_focus_block(focus)}

# Ce ai de făcut
{_DIGEST_TASK[kind]}

# Date colectate (payload)
{_clip(_dumps(_shape_payload(kind, payload)), 60000)}

# Schema răspunsului (JSON Schema draft-07)
{_dumps(DIGEST_SCHEMAS[kind])}

Răspunde exclusiv cu un obiect JSON valid conform schemei, cu toate câmpurile prezente, fără câmpuri în plus și fără text în afara JSON-ului. Câmpurile pe care datele nu le susțin primesc null, șir gol sau listă goală, niciodată valori inventate. Limba română cu diacritice."""


def _compact_digest(d: dict) -> dict:
    keep = ("snapshot_id", "kind", "source_label")
    out = {k: d.get(k) for k in keep if k in d}
    kind = d.get("kind")
    if kind == "youtube":
        fields = ("video_title", "url", "published_at", "summary", "achievements", "selling", "selling_what", "call_to_action", "sentiment", "relevance")
    elif kind == "company":
        fields = ("cui", "name", "status", "financials", "trend", "commentary")
    elif kind == "website":
        fields = ("url", "title", "novelties", "commentary")
    elif kind == "gbusiness":
        fields = ("name", "rating", "reviews_count", "themes", "praise", "complaints", "commentary")
    else:
        fields = tuple(k for k in d if k not in keep)
    for f in fields:
        v = d.get(f)
        if isinstance(v, str):
            v = _clip(v, 900)
        elif isinstance(v, list):
            v = v[:6]
        out[f] = v
    return out


def _digests_block(digests: list[dict]) -> str:
    blob = _dumps(digests or [])
    if len(blob) <= MAX_DIGEST_CHARS:
        return blob
    ordered = sorted(digests, key=lambda d: -int(d.get("relevance") or 50))
    return _clip(_dumps([_compact_digest(d) for d in ordered]), MAX_DIGEST_CHARS)


def _previous_block(previous_report: dict | None) -> str:
    if not previous_report:
        return "Nu există raport precedent, deci history_delta trebuie să fie exact „Primul raport.”"
    prev = {
        "title": previous_report.get("title"),
        "period": previous_report.get("period"),
        "executive_summary": _clip(str(previous_report.get("executive_summary") or ""), 1500),
        "key_signals": [{"title": s.get("title"), "impact": s.get("impact")} for s in (previous_report.get("key_signals") or [])[:8]],
        "recommendations": [{"title": r.get("title"), "priority": r.get("priority"), "horizon": r.get("horizon")} for r in (previous_report.get("recommendations") or [])[:6]],
    }
    return _clip(_dumps(prev), MAX_PREVIOUS_CHARS)


def synthesis_prompt(
    ctx: BusinessContext,
    focus: str,
    digests: list[dict],
    previous_report: dict | None,
    period: tuple[date, date],
) -> str:
    """Construiește promptul de sinteză care produce raportul de decizie."""
    start, end = period
    count = len(digests or [])
    return f"""Sarcină: raportul Radar pentru perioada {start.isoformat()} - {end.isoformat()}. Ai {count} analize de element (digest-uri) și, eventual, raportul precedent. Aplicația adaugă separat secțiunile pe surse; tu produci restul raportului.

# Clientul
{_ctx_block(ctx)}

# {_focus_block(focus)}

# Analize per element (fiecare are snapshot_id, kind, source_label)
{_digests_block(digests)}

# Raportul precedent
{_previous_block(previous_report)}

# Cum construiești raportul
1. Grupezi semnalele care se repetă în mai multe surse; ce apare o singură dată e ipoteză, nu tendință.
2. Fiecare semnal și fiecare recomandare citează snapshot_id în source_refs. Fără snapshot_id nu ai dovadă.
3. Treci prin lentilele de market research (concurență, preț, cerere, tehnologie, vocea clientului) și păstrezi doar ce schimbă ceva pentru client.
4. decision_frame: cea mai importantă decizie a perioadei, cu opțiuni reale (inclusiv „nu facem nimic acum”), pro și contra, dovezi cu snapshot_id, opțiunea recomandată, pre-mortem și ce te-ar face să te răzgândești.
5. recommendations: maximum 6, ordonate după priority, cu acțiuni concrete pentru o firmă mică.
6. history_delta: ce e nou, ce a dispărut, ce recomandare veche a rămas deschisă. Dacă nu există raport precedent, exact „Primul raport.”
7. data_gaps: surse fără date, informații lipsă, eșantioane mici (de exemplu maximum 5 recenzii de la Google), perioade neacoperite.
8. generated_at = momentul curent în ISO 8601; period.from = {start.isoformat()}, period.to = {end.isoformat()}; version = 1.
9. Dacă nu ai date suficiente, spui asta în executive_summary și în data_gaps și reduci numărul de recomandări. Nu compensezi lipsa de date cu generalități.

# Schema răspunsului (JSON Schema draft-07)
{_dumps(REPORT_SCHEMA)}

Răspunde exclusiv cu un obiect JSON valid conform schemei, cu toate câmpurile prezente (listele pot fi goale), fără câmpuri în plus și fără text în afara JSON-ului. Limba română cu diacritice, fraze scurte, ton de patron către patron."""
