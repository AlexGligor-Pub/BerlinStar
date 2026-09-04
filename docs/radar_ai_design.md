# Radar AI — contract de implementare (branch feat/radar-ai)

Scop: pagina unica `/radar` (admin + manager) unde un client configureaza sursele pe care le urmareste
(canale YouTube, CUI-uri concurenti, site-uri, afaceri Google) + un prompt "Focus". AI-ul colecteaza,
digera fiecare element, apoi sintetizeaza un raport de decizie corelat cu firma clientului. Rapoartele
se pastreaza (istoric), se exporta PDF, iar consumul de tokeni se contorizeaza per cont pentru facturare.

## Acces
- Toate rutele `/api/radar/*` folosesc `Depends(get_settings_account_id)` (admin + manager).
- Rutele `/api/admin/ai-usage*` si cheile API folosesc `get_platform_admin_account` (super-admin, AdminV2).

## Chei si setari globale (`global_settings`, coloane noi)
| coloana | tip | rol |
|---|---|---|
| anthropic_api_key_enc | Text null | cheia Claude, criptata cu `app.efactura.crypto.encrypt` |
| google_places_api_key_enc | Text null | Google Places API (New) |
| ai_model | String(80) null | default `claude-sonnet-5` daca e null |
| ai_price_in_usd_mtok | Numeric(10,4) null | pret input USD / 1M tokeni (default 3.0) |
| ai_price_out_usd_mtok | Numeric(10,4) null | pret output USD / 1M tokeni (default 15.0) |
Expuse in `admin_subscription.py`-style: GET/PUT `/api/admin/ai-settings` cu `*_set: bool` pentru chei
(nu se returneaza niciodata cheia). Frontend: `frontend/src/pages/adminv2/AiSettingsSection.tsx`.

## Tabele (`backend/app/models/radar.py`, migratie down_revision=`sub02checkout`, JSON cu
`JSON().with_variant(JSONB, "postgresql")` ca sa treaca harness-ul SQLite)
- `radar_sources`: id, account_id FK accounts, kind String(20) in {youtube, company, website, gbusiness},
  label String(200), value String(500) (URL canal / CUI / URL site / nume+adresa business),
  meta JSON (rezolvat: channel_id, title, cui, name, place_id, ...), enabled bool default true,
  created_at, last_collected_at null, last_error Text null. Index (account_id, kind).
- `radar_settings`: account_id PK/FK, focus_prompt Text default '', business_context Text default '',
  schedule String(10) default 'off' in {off, weekly, monthly}, updated_at.
- `radar_snapshots`: id, account_id, source_id FK (cascade), run_id FK null, kind, external_id String(300)
  (video_id / `bilant:2024` / `page:<sha1 url>:<yyyy-mm-dd>` / `place:<place_id>:<yyyy-mm-dd>`),
  collected_at, payload JSON (normalizat de collector), digest JSON null (analiza AI per element).
  UNIQUE (source_id, external_id) — nu se re-analizeaza / re-factureaza acelasi element.
- `radar_runs`: id, account_id, status String(10) in {queued, running, done, error}, trigger String(10)
  in {manual, scheduled}, started_at, finished_at null, error Text null, progress JSON
  (`{"step": str, "done": int, "total": int, "log": [str]}`), tokens_in int default 0,
  tokens_out int default 0, cost_usd Numeric(12,6) default 0, title String(300) null,
  period_from Date null, period_to Date null, report JSON null (ReportDoc).
- `ai_usage`: id, account_id, created_at, feature String(50) (`radar.context|radar.digest|radar.synthesis`),
  model String(80), tokens_in, tokens_out, cost_usd Numeric(12,6), run_id int null, meta JSON null.
  Index (account_id, created_at).

## Pachet `backend/app/radar/`
- `types.py` — dataclasses partajate (SCRIS DEJA, nu se modifica fara acord).
- `collectors/{youtube,anaf,website,gplaces}.py` — functii async pure (httpx), fara DB, ridica `CollectorError`.
  Semnaturi in `types.py` docstring-uri + mai jos.
- `prompts.py` — prompturi (expertul de market research / decision making). Semnaturi fixe:
  - `system_prompt(ctx: BusinessContext) -> str`
  - `context_prompt(companies: list[dict], items: list[dict]) -> str`  → text business_context
  - `digest_prompt(kind: str, ctx: BusinessContext, payload: dict, focus: str) -> str` → cere JSON conform `DIGEST_SCHEMAS[kind]`
  - `synthesis_prompt(ctx, focus: str, digests: list[dict], previous_report: dict | None, period: tuple[date, date]) -> str` → JSON `REPORT_SCHEMA`
  - `DIGEST_SCHEMAS: dict[str, dict]`, `REPORT_SCHEMA: dict` (JSON Schema draft-07, documentate)
- `ai.py` — `AIClient(api_key, model, price_in, price_out)`: `async complete(system, user, max_tokens=4096) -> AIResult(text, tokens_in, tokens_out, cost_usd)`;
  `parse_json(text) -> dict` tolerant la ```json fences; `async record_usage(db, account_id, feature, result, run_id=None)`.
  System prompt cu `cache_control: {"type": "ephemeral"}`.
- `engine.py` — `async run_radar(run_id: int) -> None` (deschide propria `AsyncSessionLocal`):
  1. incarca run, settings, surse enabled; 2. per sursa: collect → pentru fiecare element nou
  (external_id absent) creeaza snapshot + digest AI; 3. synthesis cu toate digest-urile din perioada
  (de la ultimul run `done` sau 30 zile) + raportul precedent; 4. salveaza report, tokens, cost, status.
  Progres actualizat in `run.progress` dupa fiecare sursa (commit). Erori per sursa → `source.last_error`
  si continua; eroare fatala → status error. `async build_business_context(db, account_id, ai) -> str`.
- `pdf.py` — `build_report_pdf(run: RadarRun, account_name: str) -> bytes` (reportlab, fonturi cu diacritice —
  vezi ce fonturi exista deja in backend pentru reportlab; imagini descarcate cu httpx, timeout 5s, esec = skip).
- `scheduler.py` — job APScheduler luni 06:00 Europe/Bucharest: pentru conturile cu schedule weekly
  (si prima luni din luna pentru monthly) creeaza run `scheduled` si apeleaza `run_radar`. Inregistrat
  in `main.py` lifespan langa `start_scheduler()`.

## Contracte collectors (toate `async`, httpx.AsyncClient timeout 20s, UA de browser)
- youtube: `resolve_channel(value) -> ChannelInfo` (accepta URL @handle / /channel/UC.. / UC.. direct; parseaza
  `"channelId":"UC..."` si `<title>`); `fetch_recent_videos(channel_id, limit=10) -> list[VideoItem]` (RSS
  `https://www.youtube.com/feeds/videos.xml?channel_id=`); `fetch_transcript(video_id, languages=("ro","en")) -> str | None`
  (`youtube-transcript-api`, rulat in thread `asyncio.to_thread`, None daca lipseste).
- anaf: `fetch_company(cui: int) -> CompanyInfo` (`POST https://webservicesp.anaf.ro/PlatitorTvaWs/api/v9/ws/tva`
  body `[{"cui":..,"data":"YYYY-MM-DD"}]`); `fetch_bilant(cui, year) -> BilantInfo | None`
  (`GET https://webservicesp.anaf.ro/bilant?an=&cui=` → `i:[{indicator, val_indicator, val_den_indicator}]`;
  mapeaza cifra de afaceri, profit/pierdere, nr. mediu salariati, active/datorii dupa `val_den_indicator`).
- website: `fetch_page(url) -> PageInfo` (lxml; text vizibil max 20000 caractere fara script/style/nav/footer;
  imagini absolute cu alt, fara svg/ico/logo/sprite/pixel; linkuri interne cu text; `content_hash`).
- gplaces: `resolve_place(query, api_key) -> PlaceInfo` (`POST https://places.googleapis.com/v1/places:searchText`,
  header `X-Goog-Api-Key`, `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount`);
  `fetch_reviews(place_id, api_key) -> PlaceReviews` (`GET https://places.googleapis.com/v1/places/{id}`
  FieldMask `id,displayName,rating,userRatingCount,reviews`; API-ul da max 5 recenzii — se noteaza in raport).

## API `/api/radar` (schemas in `backend/app/schemas/radar.py`, router `backend/app/routers/radar.py`)
| metoda | ruta | body / raspuns |
|---|---|---|
| GET | /settings | `{focus_prompt, business_context, schedule, ai_configured, places_configured, model}` |
| PUT | /settings | `{focus_prompt?, business_context?, schedule?}` → acelasi |
| POST | /settings/suggest-context | → `{business_context}` (AI din companiile + produsele contului; consuma tokeni) |
| GET | /sources | `RadarSourceOut[]` = `{id, kind, label, value, meta, enabled, created_at, last_collected_at, last_error, snapshots_count}` |
| POST | /sources | `{kind, value, label?}` → rezolva (collector) si salveaza → `RadarSourceOut`; 400 cu mesaj clar daca nu se rezolva |
| PUT | /sources/{id} | `{label?, enabled?}` |
| DELETE | /sources/{id} | 204 |
| GET | /sources/{id}/snapshots?limit=20 | `{id, external_id, collected_at, payload, digest}[]` |
| POST | /runs | → `RadarRunOut` (status queued; 409 daca exista run queued/running; 400 daca AI neconfigurat sau fara surse) |
| GET | /runs?limit=20 | `RadarRunOut[]` fara `report` |
| GET | /runs/{id} | `RadarRunOut` cu `report` |
| GET | /runs/{id}/pdf | `application/pdf`, `Content-Disposition: attachment; filename=radar-<id>.pdf` |
| DELETE | /runs/{id} | 204 |
| GET | /usage?months=6 | `{total_in, total_out, total_cost_usd, by_month:[{month:"YYYY-MM", tokens_in, tokens_out, cost_usd}], by_feature:[{feature,...}]}` |
`RadarRunOut` = `{id, status, trigger, started_at, finished_at, error, progress, tokens_in, tokens_out, cost_usd, title, period_from, period_to, report?}`.
Admin: GET `/api/admin/ai-usage?months=6` → `[{account_id, account_name, tokens_in, tokens_out, cost_usd, runs}]`.

## ReportDoc v1 (`report` JSON; limba romana; toate campurile prezente, liste posibil goale)
```json
{
 "version": 1, "generated_at": "iso", "period": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
 "title": "string scurt",
 "executive_summary": "markdown max 10 randuri",
 "key_signals": [{"title","insight","impact":"high|medium|low","sentiment":"positive|negative|neutral","source_refs":[snapshot_id]}],
 "recommendations": [{"title","rationale","action","priority":1-5,"horizon":"acum|30_zile|trimestru","confidence":"high|medium|low","source_refs":[]}],
 "decision_frame": {"question":"","options":[{"option","pros":[],"cons":[],"evidence":[]}],"recommended":"", "risks":[]},
 "sections": {
   "youtube":  [{"snapshot_id","source_label","video_title","url","published_at","summary","achievements":[],"selling":bool,"selling_what","call_to_action","sentiment","relevance":0-100}],
   "companies":[{"snapshot_id","source_label","cui","name","vat_payer":bool|null,"status","financials":[{"year","turnover","profit","employees"}],"trend":"up|down|flat|unknown","commentary"}],
   "websites": [{"snapshot_id","source_label","url","title","novelties":[{"title","description","image_url","link","category":"echipament|serviciu|tehnologie|pret|altceva"}],"commentary"}],
   "reviews":  [{"snapshot_id","source_label","name","rating","reviews_count","themes":[{"theme","sentiment","count","example"}],"praise":[],"complaints":[],"commentary"}]
 },
 "history_delta": "ce s-a schimbat fata de raportul precedent (sau 'Primul raport.')",
 "data_gaps": ["surse fara date / limitari"]
}
```
Digest per element (`snapshot.digest`) = exact obiectul din `sections.<kind>` fara `snapshot_id`/`source_label`
(adaugate de engine). Sinteza primeste digest-urile si construieste restul.

## Frontend (`frontend/src/pages/Radar.tsx` + `pages/radar/*`, `api/radar.ts`, ruta `/radar` requires `settings`)
O singura pagina, 4 taburi: **Surse** (TanStack Table, filtre pe kind, Modal adaugare cu ghid AI: kind → placeholder
explicativ, rezolvare la salvare), **Focus** (business_context editabil + buton „Genereaza cu AI", focus_prompt cu
exemple, schedule), **Rapoarte** (istoric TanStack Table; buton „Ruleaza acum" cu progres live poll 3s; vizualizare
raport: sumar executiv, semnale cu badge impact/sentiment, recomandari prioritizate, cadrul de decizie, sectiuni
pe surse cu imagini din novelties, delta istoric; buton „Salveaza PDF" → GET /runs/{id}/pdf blob → download),
**Consum AI** (totale + tabel pe luni si pe feature). Nav: „Radar AI". Mobile-first, stil existent (global.css,
componente `components/ui`). Modalele NU se inchid la click pe overlay.
AdminV2: `AiSettingsSection.tsx` (chei + model + preturi) si `AiUsageSection.tsx` (tabel pe conturi) inregistrate in `AdminV2.tsx`.

## Dependinte noi (`backend/requirements.txt`): `anthropic>=0.40`, `youtube-transcript-api>=0.6.2`.
## Teste: `backend/tests/test_radar_*.py` pe harness (`tests._harness`), fara retea (fake httpx/anthropic), rulate cu
`venv/bin/python -m tests.run_all` (vezi cum descopera testele).

## Punere in functiune
1. `pip install -r backend/requirements.txt` (anthropic, youtube-transcript-api) si `alembic upgrade head` (revizia `rad01radar`).
2. AdminV2 → „Radar AI" → „AI Radar": cheia Anthropic (obligatorie), cheia Google Places (doar pentru recenzii),
   modelul (implicit `claude-sonnet-5`) si preturile USD / 1M tokeni folosite la calculul costului.
3. Clientul (admin/manager) intra in „Radar AI": Focus → „Genereaza cu AI" pentru contextul afacerii, scrie ce urmareste,
   adauga surse, apoi „Ruleaza analiza acum". Programarea saptamanala/lunara ruleaza luni 06:00 (Europe/Bucharest).
4. Consumul per cont: tab „Consum AI" (client) si AdminV2 → „Consum AI" (toate conturile) — baza pentru facturare.
Limitari cunoscute: Google Places intoarce max 5 recenzii per afacere; transcriptul YouTube lipseste la unele clipuri
(se foloseste descrierea); PDF-ul are diacritice doar daca exista DejaVuSans (imaginea Docker instaleaza fonts-dejavu-core).
Modelele Claude 5 nu accepta `temperature`, deci apelul nu il trimite.
