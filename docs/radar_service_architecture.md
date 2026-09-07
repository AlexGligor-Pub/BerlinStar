# Radar AI ca serviciu separat — decizie de arhitectură (ADR)

Stare: acceptat. Înlocuiește implementarea „în monolit” din `docs/radar_ai_design.md`
(care rămâne valabilă pentru domeniu, prompturi, ReportDoc, colectori).

Echipa de arhitecți a lucrat pe trei axe (granițe/simplitate, robustețe/job-uri
asincrone, scalabilitate/deploy). Mai jos sunt deciziile consolidate; unde au fost
dezacorduri, e notat ce s-a ales și de ce.

## 1. Ce se extrage

Tot domeniul Radar AI (nu doar „Descoperire concurenți”): engine, discovery,
colectori, client Anthropic, contor de tokeni, PDF, prompturi, scheduler.
Discovery folosește 3 din 4 colectori + clientul AI + setările și scrie în
`radar_sources`/`radar_settings` la import — separarea doar a discovery-ului ar
duplica ~1100 linii și ar scrie în tabele deținute de alt serviciu.

Rămân în monolit: autentificare/JWT/roluri, Account/Company/Item, AdminV2 (UI
chei + `global_settings` + Fernet), abonamente, frontend-ul, routere subțiri de
proxy.

## 2. Topologie

```
browser ──/api/radar/*──▶ backend (monolit, rețele web+internal)
                              │ proxy generic, X-Service-Token + X-Account-Id
                              ▼
                          radar (API, rețea internal, fără port publicat)
                          radar-worker (aceeași imagine, `python -m app.worker`)
                              │ SELECT ... FOR UPDATE SKIP LOCKED
                              ▼
                          Postgres (aceeași instanță), schema `radar`
radar ──GET /api/internal/business-context, /api/internal/ai-config──▶ backend
```

- Frontend-ul nu se schimbă (excepție: `prepare` devine asincron, §6).
- Serviciul nu e accesibil din Caddy/frontend; singura intrare e monolitul.
- Backend-ul NU are `depends_on: radar`: dacă radar e jos, restul aplicației merge,
  iar `/api/radar/*` răspunde 503 „Serviciul Radar AI nu este disponibil momentan.
  Încearcă din nou în câteva minute.”

## 3. Date

Decizie: aceeași bază Postgres, schema dedicată `radar`, FĂRĂ chei străine către
`public.*`. (`account_id`, `company_id` sunt int indexați.)

- De ce nu bază separată (propunerea A): ar sparge backup-ul atomic (`pg_dump`
  unic) și ar cere `CREATE DATABASE` la bootstrap pe volumul existent.
- De ce nu FK-uri cross-schema (propunerea C): migrațiile serviciului ar depinde
  de tabelele monolitului; fără FK, mutarea pe o instanță separată e doar o
  schimbare de DSN. Rândurile orfane după ștergerea unui cont sunt inofensive;
  monolitul poate apela `DELETE /v1/internal/accounts/{id}` (nu se face acum).
- Tabele (toate în schema `radar`): `radar_sources`, `radar_settings`,
  `radar_snapshots`, `radar_runs`, `radar_discoveries`, `ai_usage`, + noi `radar_jobs`,
  `radar_worker_heartbeat`.
- Alembic propriu al serviciului: `version_table_schema="radar"`,
  `include_schemas=True`, filtru `include_object` doar pe schema `radar`,
  revizie inițială `r001_initial` (`down_revision=None`). Reviziile `rad01radar`
  și `rad02discovery` dispar din monolit (nu au ajuns niciodată pe master/prod —
  verificat: `git ls-tree master -- backend/alembic/versions` nu le conține).
- Entrypoint-ul serviciului: `CREATE SCHEMA IF NOT EXISTS radar` + `alembic upgrade head`.
- Contextul de business (nume cont, firme, eșantion nomenclator) NU se citește
  din `public.*`: serviciul îl trage prin HTTP din monolit la începutul job-ului
  și îl persistă în `radar_jobs.payload` (un run/discovery nu se corupe dacă
  monolitul repornește la mijloc).

## 4. Autentificare între servicii

- Secret comun `RADAR_SHARED_SECRET` (în `deploy/.env`, generat cu
  `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`), trimis ca
  header `X-Service-Token`, verificat cu `hmac.compare_digest` în ambele sensuri.
- Monolitul e singurul care mapează JWT → `account_id` și pune `X-Account-Id`.
  Serviciul filtrează totul după acest header și nu acceptă `account_id` din body/path.
- `/v1/internal/*` cere doar token-ul (AdminV2, scheduler).
- Dev local: dacă `RADAR_SERVICE_URL` e localhost, secretul implicit e `dev-secret`;
  altfel lipsa lui oprește pornirea.

## 5. Chei AI (Anthropic, Google Places)

Decizie: rămân gestionate în AdminV2 (monolit, `global_settings`, Fernet). Serviciul
le trage din `GET /api/internal/ai-config` și le ține în memorie 60 s.

- Respins env vars (propunerea C): ar elimina funcția din AdminV2 și ar cere
  restart la rotație.
- Respins „monolitul trimite cheia per request”: scheduler-ul de luni 06:00 nu are
  request; pull-ul acoperă și acest caz.
- Cheile circulă doar pe rețeaua internă docker; nu se loghează niciodată.

## 6. Job-uri asincrone

Decizie: Postgres ca coadă (`radar_jobs`, `FOR UPDATE SKIP LOCKED`), un proces
worker în container separat din aceeași imagine. Fără Redis/Celery. Worker-ul are
două benzi (fiecare cu concurență 1): „grea” (`radar_run`, `discovery`) și „ușoară”
(`discovery_prepare`), ca pregătirea de câteva secunde să nu aștepte după o analiză
de minute.

`radar_jobs`: `id, kind ('radar_run'|'discovery'|'discovery_prepare'), account_id,
target_id (run/discovery id, nullable), idempotency_key UNIQUE, status
('queued'|'running'|'done'|'failed'), attempts, max_attempts, payload JSONB,
result JSONB, error, lease_until, scheduled_for, created_at, started_at, finished_at`.
Index unic parțial `(account_id, kind) WHERE status IN ('queued','running')` —
închide cursa actuală în care două POST-uri simultane trec ambele de verificarea 409.

- Claim: `UPDATE radar_jobs SET status='running', attempts=attempts+1,
  lease_until=now()+interval '5 minutes' WHERE id = (SELECT id FROM radar_jobs WHERE
  status='queued' AND kind = ANY(:kinds) AND (scheduled_for IS NULL OR
  scheduled_for<=now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`.
  Lease-ul se reînnoiește de un ticker de 30 s al job-ului (acoperă și apelurile AI
  lungi, fără progres). Worker-ul scrie o bătaie de inimă în `radar_worker_heartbeat`
  (un rând), citită de `/ready`.
- Recuperare după restart: la pornire și la fiecare 60 s, `running` cu
  `lease_until < now()` → `queued` dacă `attempts < max_attempts`, altfel `failed`
  cu mesaj „Analiza a fost întreruptă de o repornire a serviciului. Încearcă din nou.”
  `radar_run` max_attempts=2 (re-colectarea e ieftină: snapshot-urile existente se
  sar; la retry se re-digestă snapshot-urile cu `digest IS NULL`),
  `discovery`/`discovery_prepare` max_attempts=1.
- SIGTERM: worker-ul nu mai ia job-uri, termină pasul curent, pune job-ul înapoi
  în `queued` fără a consuma o încercare, ieșire. `stop_grace_period: 60s`.
- Idempotență: monolitul trimite `Idempotency-Key` (manual:
  `radar:{account}:manual:{uuid client}`; programat: `radar:{account}:{YYYY-MM-DD}`);
  `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` → la conflict se întoarce
  job-ul existent cu 200.
- Timeout per job (`asyncio.wait_for`): radar_run 20 min, discovery 15 min,
  discovery_prepare 5 min. Per pas rămân cele existente (site 15 s, Anthropic 180 s).
- Buget: `RADAR_MAX_RUN_COST_USD` (implicit 3.0) verificat înaintea fiecărui apel AI
  → run-ul se încheie `done` cu `partial=true` și mesaj explicit. Azi nu există nicio
  limită.
- Progresul rămâne pe `radar_runs.progress` / `radar_discoveries.progress` (contractul
  UI nu se schimbă), scris în tranzacție scurtă proprie, max 1/s.
- `prepare` (30–180 s, azi sincron, peste `proxy_read_timeout 60s` din nginx → poate
  da 504) devine job `discovery_prepare`: `POST /discovery/prepare` → 202
  `{job_id, status}`; `GET /discovery/prepare/{job_id}` → `{job_id, status, error,
  result: PrepareOut|null}`. Frontend-ul face poll la 2 s.
- `suggest-context` rămâne sincron (prompt scurt); proxy-ul lui are read timeout 200 s.

## 7. Scheduler

În procesul worker (o singură replică). APScheduler, luni 06:00 Europe/Bucharest,
tick-ul doar ENQUEUE-uiește job-uri cu cheia `radar:{account}:{data}` sub
`pg_try_advisory_xact_lock(hashtext('radar_scheduler'))` (se eliberează la commit). Catch-up la pornire pentru
sloturi ratate în ultimele 48 h. Nu mai rulează run-uri inline.

## 8. Contract API

Serviciul (`http://radar:8000`), toate `/v1/*` cer `X-Service-Token` + `X-Account-Id`:

| Metodă | Cale | Notă |
|---|---|---|
| GET/PUT | /v1/settings | |
| POST | /v1/settings/suggest-context | sincron (AI) |
| GET/POST | /v1/sources; PUT/DELETE /v1/sources/{id}; GET /v1/sources/{id}/snapshots | |
| POST | /v1/runs | creează RadarRun `queued` + job; 201; header `Idempotency-Key` |
| GET | /v1/runs, /v1/runs/{id}, /v1/runs/{id}/pdf; DELETE /v1/runs/{id} | |
| POST | /v1/discovery/prepare | 202 `{job_id,status}` |
| GET | /v1/discovery/prepare/{job_id} | `{job_id,status,error,result}` |
| POST | /v1/discovery | creează RadarDiscovery `queued` + job; 201 |
| GET | /v1/discovery, /v1/discovery/{id}; POST …/{id}/import, …/{id}/use-focus; DELETE …/{id} | |
| GET | /v1/usage?months=N | |
| GET | /v1/internal/usage?months=N | toate conturile (AdminV2); doar token |
| GET | /v1/internal/jobs?status&kind&limit | listare job-uri (admin) |
| GET | /health | liveness, fără DB |
| GET | /ready | `SELECT 1` + heartbeat worker < 90 s |

Corpurile rămân cele din `backend/app/schemas/radar.py` (se mută verbatim).

Monolit, pentru serviciu (doar `X-Service-Token`):

- `GET /api/internal/business-context?account_id=` →
  `{account_name, companies:[{id,cui,name,address,website,description}],
  items:[{name,type,price,unit}]}` (exact ce citesc azi `_account_snapshot` și
  `build_profile_draft`).
- `GET /api/internal/ai-config` → `{api_key, places_key, model, price_in, price_out}`
  (decriptate).

Proxy în monolit (`backend/app/radar_client.py`): un `httpx.AsyncClient` comun
(keep-alive), `Timeout(connect=5, read=30, write=10)`; `read=200` doar pentru
`suggest-context`; PDF-ul e transmis ca stream. Erorile de conexiune/timeout →
503 cu mesajul din §2. Routerele `/api/radar` și `/api/radar/discovery` devin
pass-through generic (metodă, query, body, status, content-type), păstrând
dependency-urile de auth existente. `GET /api/admin/ai-usage` → `/v1/internal/usage`
+ join cu numele conturilor în monolit; `ai-settings` rămâne local.

## 9. Layout cod

```
services/radar/
  app/
    main.py            FastAPI, lifespan (fără scheduler), /health, /ready
    config.py          env: RADAR_DATABASE_URL, RADAR_SHARED_SECRET, MONOLITH_URL, RADAR_MAX_RUN_COST_USD, RADAR_LOG_LEVEL
    database.py        engine + AsyncSessionLocal (search_path=radar)
    auth.py            require_service_token, require_account (X-Account-Id)
    monolith.py        client HTTP: business_context(account_id), ai_config() cu cache 60 s
    models/            radar.py (schema="radar", fără FK către public) + jobs.py
    schemas/           radar.py (mutat), jobs.py
    routers/           settings.py, sources.py, runs.py, discovery.py, usage.py, internal.py
    radar/             engine.py, discovery.py, prompts.py, discovery_prompts.py, ai.py, pdf.py, types.py, collectors/
    jobs/              queue.py (enqueue/claim/complete/recover), worker.py (loop + SIGTERM), scheduler.py
    worker.py          `python -m app.worker`
  alembic/, alembic.ini, requirements.txt, .env.example
  tests/               run_all.py + _harness.py (copiate), test_radar_engine.py, test_radar_discovery.py, test_jobs.py
deploy/radar.Dockerfile, deploy/radar-entrypoint.sh
```

Se mută verbatim: colectori, prompturi, types, pdf, schemas, corpul routerelor.
Se rescriu: `_account_snapshot`/`build_profile_draft` (citesc din payload-ul
job-ului, nu din ORM), `settings.py` (devine `monolith.ai_config()`), pornirea
job-urilor (enqueue în loc de `asyncio.create_task`), scheduler-ul (enqueue-only).
Se șterg din monolit: `app/radar/`, `models/radar.py`, `schemas/radar.py`,
`routers/radar.py`+`radar_discovery.py` (înlocuite cu proxy), reviziile rad01/rad02,
dependențele `anthropic`, `youtube-transcript-api`, `reportlab` din requirements
(după verificare că nu le folosește altcineva), `tests/test_radar_*`.

## 10. Deploy

- `deploy/radar.Dockerfile`: python:3.11-slim, `fonts-dejavu-core`, user non-root
  10001, requirements proprii (fastapi, uvicorn, sqlalchemy, asyncpg, alembic,
  pydantic, httpx, lxml, youtube-transcript-api, reportlab, anthropic, apscheduler,
  python-dotenv).
- compose: `radar` (API, `uvicorn app.main:app --host 0.0.0.0 --port 8000`) și
  `radar-worker` (`python -m app.worker`, fără `container_name` ca să poată fi
  scalat), ambele doar pe `internal`, `env_file: .env`, `depends_on: db healthy`,
  `restart: unless-stopped`, `autoheal`, limite 1 CPU / 1 GB, healthcheck pe
  `/health` (API) și pe heartbeat (worker). Backend primește `RADAR_SERVICE_URL=http://radar:8000`.
- Env serviciu: `RADAR_DATABASE_URL` (același DSN ca `DATABASE_URL`), `RADAR_SHARED_SECRET`,
  `MONOLITH_URL=http://backend:8000`, `RADAR_MAX_RUN_COST_USD`, `TZ=Europe/Bucharest`.
- Dev local: `services/radar/.env` cu DSN către `berlinstar-dev-db` (:5434);
  `scripts/dev-radar.sh` pornește uvicorn pe :4100 și worker-ul; monolitul folosește
  implicit `http://localhost:4100`.
- Rollout prod (nu există tabele radar): `.env` → `up -d --build radar radar-worker`
  → verificare `/health` din backend → `up -d --build backend frontend`. Rollback:
  imagine anterioară pentru backend; schema `radar` rămâne, invizibilă vechiului cod.
- Baza de dev (avea tabelele radar în `public` la `rad02discovery`): s-a făcut doar
  `UPDATE alembic_version SET version_num='sub02checkout'`; tabelele vechi din `public`
  au rămas pe loc (invizibile monolitului, conțin doar teste) și pot fi șterse manual
  cu `DROP TABLE public.radar_sources, public.radar_settings, public.radar_snapshots,
  public.radar_runs, public.radar_discoveries, public.ai_usage`.
- Atenție (pre-existent, nu ține de Radar): pe `master` graful alembic are 3 head-uri;
  `alembic upgrade head` din entrypoint cere o revizie de merge înainte de deploy.

## 11. Ce NU facem acum (YAGNI)

Broker de mesaje, Redis, Celery; a doua instanță Postgres; mTLS/JWT între servicii;
webhook-uri/SSE pentru progres; gRPC/codegen; tracing distribuit; anulare job din
UI; cap lunar pe cont; replici multiple de worker; Kubernetes.
