# Audit infrastructura, deploy, observabilitate si securitate operationala — BerlinStar

Data: 2026-09-03. Branch auditat: `feat/utilizatori-roluri`. Mod: read-only, fara ssh/docker.
Repo: `/mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar` (toate caile de mai jos sunt relative la root).

Legenda severitate: **Critical / High / Medium / Low**. Efort: **S** (<1/2 zi) / **M** (1-3 zile) / **L** (>3 zile).

---

## 0. Rezumat executiv

Stack-ul e surprinzator de matur pentru un proiect de dimensiunea asta: Caddy cu TLS automat, nginx cu CSP/headers, healthchecks + autoheal, migratii automate la boot, rate limiting pe endpoint si throttle pe credential, uploads pe S3. Problemele mari sunt **operationale**, nu arhitecturale:

1. **Dump-uri de productie (PII, hash-uri parole, ~700 MB) sunt commit-uite in git** (`deploy/backup_Productie_*.sql|.sqlplus`, 18 fisiere tracked).
2. **Parola sudo a serverului QA e in clar intr-un fisier tracked** (`QA.md:19`).
3. **Nu exista backup automatizat** (nici cron, nici container, nici retentie) — doar comenzi manuale `pg_dump` in README.
4. **Nu exista CI/CD** (fara `.github/`, fara lint, fara pytest; testele ruleaza doar manual).
5. **Containerele ruleaza ca root, fara `.dockerignore`, fara rotire a log-urilor Docker**; backend-ul e legat de 1 worker prin stare in-memory (SSE, rate-limit, throttle, APScheduler).

Nota generala: **5.5 / 10**.

---

## 1. Docker

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Backend image | single-stage `python:3.11-slim`, `pip install -r requirements.txt`, `COPY backend/ .` | `deploy/backend.Dockerfile:1-17` |
| Frontend image | multi-stage corect: `node:20-alpine` build → `nginx:alpine`; copiaza allowlist din `Site/` (nu tot folderul, evita expunerea de dump-uri) | `deploy/frontend.Dockerfile:1-39`, comentariu `:28-33` |
| Non-root user | **Nu** — niciun `USER` in niciun Dockerfile; gunicorn si nginx ruleaza ca root | `deploy/backend.Dockerfile`, `deploy/frontend.Dockerfile` |
| `.dockerignore` | **Nu exista** (nici root, nici `deploy/`, `backend/`, `frontend/`). Build context = repo root (`context: ..`) ⇒ trimite la daemon `backend/venv`, `frontend/node_modules`, `frontend/dist`, ~700 MB dump-uri, `QA_ENV/` (chei SSH), `ServerDotEnvFile` | `deploy/docker-compose.yml:25-27, 53-55` |
| Healthchecks | da, pentru toate 3 serviciile app: backend `GET /api/health` (15s/6 retries/start 45s), frontend `wget /`, db `pg_isready` | `docker-compose.yml:46-50, 75-82, 116-120` |
| Autoheal | `willfarrell/autoheal:1.2.0` pinned, pe label, cu `docker.sock:ro` | `docker-compose.yml:130-146` |
| Restart policy | `unless-stopped` pe toate | `docker-compose.yml:20, 39, 67, 96, 133` |
| Resource limits | backend 4 CPU / 4 GB; db 2 CPU / 8 GB; frontend/caddy/autoheal **fara limite** | `docker-compose.yml:70-74, 111-115` |
| Postgres tuning | `shared_buffers=2GB`, `effective_cache_size=6GB`, `max_connections=200` — coerent cu limita de 8 GB | `docker-compose.yml:99-110` |
| DB expusa pe host | **Nu** in prod (doar retea `internal`); **DA** in QA (`5432:5432`) si in `docker-compose.override.yml` (dev) | `docker-compose.yml:84-95`; `docker-compose.qa.yml:18-20`; `docker-compose.override.yml:2-4` |
| Retele | `web` (caddy+frontend+backend) si `internal` (backend+db) — segmentare corecta | `docker-compose.yml:148-150` |
| Porturi publicate | doar Caddy 80/443 in prod | `docker-compose.yml:8-10, 30-33` |
| Migratii | `entrypoint.sh` asteapta DB-ul, ruleaza `alembic upgrade head`, apoi porneste gunicorn cu **`-w 1`** (explicit, din cauza broadcaster-ului in-memory) | `deploy/entrypoint.sh:4-25` |
| Gunicorn | `--timeout 600`, `--graceful-timeout 30`, `--preload`, worker custom cu `timeout_graceful_shutdown=15` pentru a nu bloca pe SSE | `entrypoint.sh:16-25`, `backend/app/gunicorn_worker.py:19-24` |
| Log driver | **Nicio sectiune `logging:`** in compose ⇒ json-file fara `max-size`/`max-file`; gunicorn access log + middleware de request logging scriu ambele pe stdout ⇒ log-urile Docker cresc nelimitat | `docker-compose.yml` (absent), `entrypoint.sh:25`, `backend/app/middleware.py:65-136` |
| Log fisier in container | `RotatingFileHandler` in `LOG_DIR=logs` (relativ la `/app`) — **nu e volum**, se pierde la recreare container; util doar local | `backend/app/logging_config.py:43-54` |

### Constatari

- **[High] Build context = repo root fara `.dockerignore`** (`docker-compose.yml:25-27, 53-55`). Pe langa lentoare, orice `COPY backend/ .` aduce in imagine `backend/venv/`, `backend/logs/app.log` (500 KB local), `backend/berlinstar.db`, `backend/.env` (exista local, contine `SECRET_KEY`). `backend/.env` ajunge in imaginea de productie. Efort: **S**.
- **[Medium] Containere root** (`backend.Dockerfile`, `frontend.Dockerfile`). Efort: **S** (`nginx-unprivileged` sau `USER` + `adduser`; pentru backend `USER app` dupa `pip install`).
- **[Medium] Fara rotire log Docker** — pe un VPS cu disc mic, json-file nelimitat + acces log dublu duce la disc plin. Efort: **S** (`logging: driver: json-file, options: {max-size: 50m, max-file: "5"}` sau `x-logging` anchor).
- **[Medium] Migratii automate la fiecare boot, fara backup prealabil si fara plan de rollback** (`entrypoint.sh:9-10`). O migratie esuata ⇒ container in restart loop, iar autoheal nu ajuta. Efort: **M** (pas de deploy explicit: `pg_dump` → `alembic upgrade` → rollout; sau `alembic check` in CI).
- **[Low] Backend Dockerfile fara pin de digest/versiune minora** (`python:3.11-slim`, `nginx:alpine`, `node:20-alpine`, `caddy:2-alpine`, `postgres:16-alpine`). Doar autoheal e pinned. Efort: **S**.
- **[Low] Healthcheck backend returneaza 200 chiar si cu `db: error`** (`backend/app/main.py:172-183`) — statusul e "degraded" dar HTTP 200, deci autoheal nu va reactiona la pierderea DB (poate fi intentionat; documentati). Efort: **S**.

---

## 2. Nginx / reverse proxy / TLS

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Edge TLS | Caddy 2, Let's Encrypt automat pentru `professorprime.ro` + redirect `www` | `deploy/Caddyfile:4-15` |
| Fallback HTTP | bloc `:80 { reverse_proxy frontend:80 }` — serveste aplicatia in **clar pe HTTP** pentru acces pe IP/Host necunoscut | `Caddyfile:17-21` |
| HSTS | **comentat** | `deploy/nginx.conf:45-46` |
| Security headers | X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP per sectiune (`script-src 'self'` pentru `/berlinstar`; `'unsafe-inline'` pe marketing) | `nginx.conf:11-14, 40-44` |
| CSP `connect-src 'self'` | OK pentru API same-origin; Stripe.js probabil are nevoie de `https://js.stripe.com` in `script-src`/`frame-src` (neverificat daca checkout-ul e redirect sau embedded) | `nginx.conf:13` |
| gzip | on, comp 6, min 1024, tipuri complete; **fara brotli** (nginx:alpine nu il include) | `nginx.conf:25-35` |
| Cache | HTML `expires -1`; assets `expires 1y` (fara `immutable` — fara `add_header` ca sa nu strice headerele de securitate) | `nginx.conf:152-161` |
| Body size | 10 MB global; 500 MB pe endpoint-ul de legacy import cu `proxy_request_buffering off` | `nginx.conf:20, 50-75` |
| SSE | `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 3600s`, HTTP/1.1 + `Connection ""` — corect, pe 4 location-uri (receipts + assistant, cu si fara prefix) | `nginx.conf:77-127` |
| Timeouts API | 60s standard, 600s pe import | `nginx.conf:137, 149, 59, 73` |
| Keepalive upstream | `keepalive 64` | `nginx.conf:1-6` |
| Rate limit la edge | **niciun `limit_req`/`limit_conn`** | `nginx.conf` (grep=0) |
| `/docs`, `/redoc`, `/openapi.json` | nu sunt proxy-ate (doar `/api/` si `/berlinstar/api/`), deci **nu sunt expuse public**; in container raman active (`FastAPI()` fara `docs_url=None`) | `nginx.conf:130-150`, `backend/app/main.py:77-81` |
| Duplicare config | fiecare location exista de doua ori (cu/fara `/berlinstar`) — 4 blocuri SSE identice | `nginx.conf:50-150` |

### Constatari

- **[High] HSTS dezactivat + fallback HTTP pe `:80` fara redirect** (`nginx.conf:46`, `Caddyfile:19-21`). Un client care intra pe `http://` primeste aplicatia si trimite token-ul Bearer in clar. Efort: **S** (in Caddy: `header Strict-Transport-Security "max-age=31536000; includeSubDomains"` pe blocul domeniului; inlocuiti `:80` cu `redir https://professorprime.ro{uri}` dupa migrarea DNS).
- **[Medium] Fara rate-limit la edge** — tot rate-limiting-ul e in proces (slowapi in-memory). Efort: **S** (`limit_req_zone` pe `/api/auth/` si `/api/admin/verify`).
- **[Low] Caddy nu adauga niciun header; totul depinde de nginx** — OK cat timp Caddy doar proxy-eaza. Efort: —.
- **[Low] Duplicare location-uri** — risc de drift intre variantele cu/fara prefix. Efort: **S** (un `location ~ ^(/berlinstar)?/api/...` cu `rewrite`).

---

## 3. Config & secrete

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Settings | `os.getenv` dispersat: `backend/app/config.py` (SECRET_KEY, ASSISTANT_*), `main.py:92-96` (CORS_ORIGINS, ALLOWED_HOSTS), `logging_config.py`, `utils/storage.py` (S3_*), `routers/admin.py` (ADMIN_PASSWORD_1/2), `efactura/*` (ANAF_*). Fara pydantic-settings / validare la boot | vezi lista din sectiunea "env vars" |
| Default SECRET_KEY | **`"schimba-asta-in-productie"`** — aplicatia porneste cu cheie JWT cunoscuta daca env-ul lipseste | `backend/app/config.py:5` |
| JWT | HS256, **expirare 30 zile**; sesiunile sunt totusi validate in DB (`expires_at`, `jti`) | `config.py:6-7`, `backend/app/auth_context.py:126` |
| CORS | refuza explicit `*` cu credentials; default `http://localhost:2000` | `main.py:92-94` |
| TrustedHost | default `*` (dezactivat efectiv); `ALLOWED_HOSTS` nu apare in niciun `.env`/`.env.example` din `deploy/` | `main.py:96-102` |
| `.env.example` incomplet | contine doar `POSTGRES_*`, `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`. Lipsesc `ADMIN_PASSWORD_1/2`, `S3_*`, `ALLOWED_HOSTS`, `PUBLIC_BASE_URL`, `LOG_LEVEL`, `ASSISTANT_*` (sunt documentate doar in `doc/DEV_SETUP.md:20-32`) | `deploy/.env.example` |
| Secrete tracked in git | `deploy/.env`, `.env.prod`, `.env.qa`, `backend/.env`, `ServerDotEnvFile`, `QA_ENV/` — **NU** sunt tracked (verificat cu `git ls-files`); `.gitignore` le acopera (`.gitignore:30-33, 51-58`) | `git ls-files` |
| Chei existente in `.env`-uri locale (doar nume) | `deploy/.env`: POSTGRES_USER/PASSWORD/DB, DATABASE_URL, SECRET_KEY, CORS_ORIGINS, VITE_BASE_PATH; `.env.prod` + PUBLIC_BASE_URL; `.env.qa` + ASSISTANT_ENABLED/BRIDGE_URL/BRIDGE_SECRET; `ServerDotEnvFile`: SERVER_IP + aceleasi + FRONTEND_PORT. Toate au `SECRET_KEY` de 64 caractere (hex 32 bytes) — nu default | `grep -oE '^[A-Z_]+='` |
| **Dump-uri de productie in git** | **18 fisiere tracked**: `deploy/backup_Productie_2026*.sql` (7) si `*.sqlplus` (11), pana la 82.8 MB fiecare (blob in HEAD verificat: `deploy/backup_Productie_20260623_192741.sqlplus` = 82 823 077 bytes). Dump-ul contine `COPY public.accounts`, `clienti`, `employees`, `receipts`, `companies` etc. (verificat pe cel mai mic). `.gitignore:15-16` ignora `*.sql` dar (a) fisierele erau deja tracked, (b) **extensia `.sqlplus` nu e acoperita** | `git ls-files`, `.gitignore:15-16` |
| Istoric dump-uri | 18 commit-uri dedicate, `eb1eb47` 2026-03-28 "Production Backup" ... `62e5071` 2026-06-23 "backup 23 iun" — **git e folosit ca sistem de backup**; `.git` = 162 MB | `git log --diff-filter=A -- 'deploy/backup_Productie_*'` |
| Dump la root | `backup_Productie_20260514_205400.sql` (1.4 MB) si `ServerDotEnvFile` la root — **untracked** (ignorate), dar prezente pe disc si in build context | `ls` root |
| Chei SSH QA | `QA_ENV/id_ed25519_siemens` (+ .pub) pe disc, gitignored, dar in build context Docker | `.gitignore:55`, `ls QA_ENV` |
| Parola sudo QA in clar | `QA.md:19`: "Parolă consolă / sudo | `alexgligor`" — **fisier tracked** | `QA.md:19`, `git ls-files QA.md` |
| Admin verify | parole din env `ADMIN_PASSWORD_1/2`, comparate cu `hmac.compare_digest`, `3/minute`; `doc/DEV_SETUP.md:25` mentioneaza ca parolele vechi au fost in git history (BLOCKER B-02 din review-ul anterior) — rotatia e neverificata | `backend/app/routers/admin.py:55-66`, `doc/DEV_SETUP.md:25-28` |
| Seed default | `admin/admin` in `seed.py` — nu ruleaza din entrypoint, doar manual | `backend/app/seed.py:213-220`, `doc/pornire.md:130-137` |
| Agent-bridge | `bypassPermissions` default, bind `0.0.0.0:8765`, auth doar cu shared secret; README cere "NU porni pe Prod fara review". Memoria de proiect indica ca ruleaza si pe prod ca root cu `IS_SANDBOX=1` (**neverificat in repo**) | `ops/agent-bridge/bridge.py:38, 68`, `berlinstar-agent-bridge.service:18`, `ops/agent-bridge/README.md:7-9` |
| PAT GitHub / API key in clar pe server | documentat ca atare | `QA.md:98, 139, 154, 182` |

### Constatari

- **[Critical] Dump-uri de productie cu PII si hash-uri de parole in git** (18 fisiere, ~700 MB). Oricine are acces la repo-ul GitHub are baza de clienti. Remediere: `git rm --cached deploy/backup_Productie_*`; adaugati `*.sqlplus` si `backup_*` in `.gitignore`; **rescrieti istoricul** (`git filter-repo --path-glob 'deploy/backup_Productie_*' --invert-paths`) si force-push + re-clone pe QA/prod; considerati incidentul de date ca atare (GDPR). Efort: **M**.
- **[Critical] Parola sudo QA in `QA.md:19` (tracked)**. Schimbati parola, scoateti din fisier, curatati istoricul. Efort: **S**.
- **[High] Default `SECRET_KEY` cunoscut** (`config.py:5`). Ar trebui `RuntimeError` la boot daca lipseste sau e defaultul (cum se face deja pentru `CORS_ORIGINS='*'` in `main.py:93-94`). Efort: **S**.
- **[High] `.env.example` nu documenteaza variabilele necesare** (`ADMIN_PASSWORD_*`, `S3_*`, `ALLOWED_HOSTS`, `ASSISTANT_*`), deci un deploy nou pe baza README-ului porneste cu upload-uri S3 nefunctionale si admin verify dezactivat. Efort: **S**.
- **[Medium] Fara validare centralizata a config-ului** — recomand `pydantic-settings` cu un singur `Settings` si fail-fast. Efort: **M**.
- **[Medium] Token JWT de 30 zile** (`config.py:7`) — compensat partial de sesiuni in DB; recomand 8-12h + refresh sau revocare la schimbare parola (neverificat). Efort: **M**.
- **[Medium] Agent-bridge cu `bypassPermissions` pe `0.0.0.0`** — daca ruleaza pe prod (memoria proiectului spune da), e RCE-as-a-feature protejat de un singur secret. Legati pe `127.0.0.1`/IP docker bridge, firewall, `acceptEdits` in loc de bypass. Efort: **S**.
- **[Low] `deploy/README.md` e invechit** (Traefik, IP direct HTTP, "modifica CORS in main.py") — compose-ul actual foloseste Caddy. Efort: **S**.

---

## 4. Observabilitate

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Format log | text neformatat `%(asctime)s [%(levelname)] %(name)s: %(message)s` — **nu JSON/structurat** | `backend/app/logging_config.py:31-34` |
| Request logging | middleware propriu: `→`/`←` per request cu `rid`, ip, status, ms; `X-Request-Id` in raspuns; paths silent/quiet pentru health/SSE/polling | `backend/app/middleware.py:49-136` |
| Dublare | gunicorn `--access-logfile -` **plus** middleware ⇒ fiecare request logat de doua ori pe stdout | `entrypoint.sh:25`, `middleware.py:83, 125` |
| Rotire fisier | 1 MB × 100 fisiere + stergere >7 zile — dar pe disc efemer de container | `logging_config.py:7-9, 43-54` |
| Nivel | `LOG_LEVEL` env, default INFO; zgomot sqlalchemy/apscheduler/boto redus | `logging_config.py:28-29, 58-70` |
| Error tracking | **fara Sentry/echivalent** (grep `sentry` = 0 in `backend/app`) | — |
| Metrici | **fara Prometheus/StatsD/OpenTelemetry** (grep = 0) | — |
| Health | `GET /api/health` cu `SELECT 1`; raspunde 200 si pe `degraded` | `main.py:172-183` |
| Uptime extern | **nimic in repo** (fara Uptime Kuma/healthchecks.io/Better Stack) | — |
| Alerting | **nimic**; autoheal restarteaza silentios | `docker-compose.yml:130-146` |
| Erori neprinse | 500 generic + log cu `exc_info`; `IntegrityError`→409, `OperationalError`→503 | `middleware.py:90-105`, `main.py:116-125` |

### Constatari

- **[High] Zero error tracking si zero alertare** — un 500 in productie e vizibil doar daca cineva citeste `docker logs`. Efort: **S** (Sentry SDK FastAPI + DSN in env; GlitchTip self-hosted daca vreti sa evitati SaaS).
- **[Medium] Fara monitorizare externa de uptime** pe `https://professorprime.ro/berlinstar/api/health`. Efort: **S** (healthchecks.io/UptimeRobot gratuit, sau Uptime Kuma pe QA).
- **[Medium] Log-uri nestructurate + dublate** — greu de agregat; `rid` nu se propaga in log-urile de business. Efort: **M** (`python-json-logger` sau structlog; `--access-logfile /dev/null` sau eliminati middleware-ul de acces; contextvar cu `rid`).
- **[Low] Fara metrici** (latenta, rata erori, conexiuni SSE, pool DB). Efort: **M** (`prometheus-fastapi-instrumentator` + node_exporter; sau Grafana Cloud free tier).

---

## 5. Backup & operatiuni DB

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Backup automat | **inexistent** — niciun serviciu in compose, niciun cron/script in `deploy/`, `ops/`, `backend/scripts/` (scripturile de acolo sunt importuri legacy) | `ls deploy ops backend/scripts` |
| Procedura manuala | `docker compose exec db pg_dump ... > backup_$(date).sql` / `cat backup.sql | psql` | `deploy/README.md:200-204`, `QA.md:81-86` |
| Restore testat | **da**, o data, documentat pas cu pas (in DB paralela, cu rollback) — bun | `docs/db_restore_20260515.md:21-77` |
| Retentie / offsite | dump-urile sunt tinute **in repo git** (vezi §3) si pe laptop; niciun offsite (S3-ul exista deja pentru imagini/facturi) | `deploy/backup_Productie_*` |
| Format | plain SQL (`pg_dump` text) — restore lent la 80 MB+, fara paralelism; nu e `-Fc` | `docs/db_restore_20260515.md:7` |
| PITR / WAL archiving | nu | `docker-compose.yml:99-110` |
| Volum DB | `postgres_data` named volume local; comanda `down -v` documentata ca periculoasa | `docker-compose.yml:93, 153`, `README.md:191-192` |

### Constatari

- **[Critical] Fara backup automat, fara retentie, fara offsite.** Un `docker compose down -v` gresit, un disc defect sau un `alembic upgrade` prost ⇒ pierdere de date de la ultimul dump manual. Efort: **S-M**: container `prodrigestivill/postgres-backup-local` (pinned) sau cron pe host: `pg_dump -Fc` zilnic → `aws s3 cp` in bucketul Hetzner existent, retentie 7 zilnice / 4 saptamanale / 6 lunare, verificare `pg_restore --list` lunara. Documentati RPO/RTO tinta.
- **[Medium] Dump-uri pe laptopul dev + in repo** in loc de storage controlat. Efort: **S** (mutati in S3 cu bucket privat, stergeti local).

---

## 6. CI/CD

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Pipeline | **niciunul**: fara `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `Makefile` | `ls` |
| Teste backend | 9 fisiere in `backend/tests/`, runner propriu `python -m tests.run_all` (fara pytest, ruleaza pe SQLite `BERLINSTAR_DEV_SQLITE=1`); rulare manuala "inainte de commit" | `backend/tests/run_all.py:1-19` |
| Lint / format | **nimic**: fara `pyproject.toml`/`ruff.toml`, fara ESLint/Prettier; frontend are doar `tsc -b` in `npm run build` | `frontend/package.json:8` |
| Teste frontend | **niciun** test runner (vitest absent din `devDependencies`) | `frontend/package.json:23-29` |
| Deploy QA | script pe server `~/berlinstar/deploy-qa.sh` (**nu e in repo**): `git pull --ff-only` → `cp .env.qa .env` → `up -d --build` → wait healthy | `QA.md:117-129` |
| Deploy prod | doar `docker compose up -d --build` manual din `deploy/README.md:50-52` (README invechit, mentioneaza Traefik) | `deploy/README.md:48-52, 84-112` |
| Rollback | **nedocumentat**; imaginile nu sunt taguite (build local pe server ⇒ nu exista un `image:tag` anterior de care sa te intorci); DB rollback = `alembic downgrade -1` manual | `doc/pornire.md:117-120` |
| Branching | QA urmareste `Main6Iun`; `master` "e vechi"; branch curent `feat/utilizatori-roluri` — sursa de adevar neclara | `QA.md:97, 183` |
| Build reproductibil | frontend `npm ci` + lockfile OK; backend `>=` fara lockfile (vezi §8) | `frontend.Dockerfile:8`, `backend/requirements.txt` |

### Constatari

- **[High] Fara CI**: nu exista niciun gate automat intre commit si prod. Efort: **M** (GitHub Actions: `ruff check` + `python -m tests.run_all` + `tsc -b && vite build` + `docker build` pe PR; optional Trivy pe imagini).
- **[High] Fara rollback story**: imaginile se construiesc pe server fara tag ⇒ singura optiune e `git checkout` + rebuild (minute). Efort: **M** (build in CI → push in GHCR cu tag = SHA; compose pe server foloseste `image: ghcr.io/...:${TAG}`; rollback = schimbi `TAG` + `up -d`).
- **[Medium] `deploy-qa.sh` traieste doar pe server**, nu e versionat. Efort: **S** (aduceti-l in `deploy/`).
- **[Medium] `deploy/README.md` descrie o arhitectura care nu mai exista (Traefik)** — periculos la un deploy nou. Efort: **S**.
- **[Low] Fara lint/format** — Efort: **S** (ruff + prettier/eslint minimal).

---

## 7. Scalabilitate

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Topologie | single-host Hetzner, un container per rol, `gunicorn -w 1` explicit | `entrypoint.sh:13-18` |
| Stare in-memory (blocheaza >1 worker/replica) | (1) `Broadcaster` SSE — dict de cozi per account; (2) slowapi in-memory (`storage_uri` absent); (3) `login_throttle` in memoria procesului; (4) APScheduler in-process pentru rapoarte si eFactura (2 replici ⇒ joburi duble); (5) `_CHATS` dict in agent-bridge | `backend/app/broadcaster.py:14-65`; `rate_limit.py:5-7`; `utils/login_throttle.py:14-17`; `main.py:66-67`; `ops/agent-bridge/bridge.py:106` |
| Sesiuni | in DB (`expires_at`, `jti`) — **stateless OK** | `auth_context.py:126` |
| Fisiere | imagini/facturi/eFactura pe **S3 (Hetzner Object Storage)** — stateless OK; legacy import scrie in `tempfile` local, apoi proceseaza — OK | `utils/storage.py:24-31`, `routers/admin_legacy_import.py:104-135` |
| SSE | conexiuni lungi (1h timeout nginx) pe un singur worker async; `worker-connections 1000` | `nginx.conf:87`, `entrypoint.sh:20` |
| DB | fara pooler (PgBouncer); `max_connections=200`, pool SQLAlchemy default | `docker-compose.yml:101` |
| HTTP client | `httpx.AsyncClient` partajat — bun | `main.py:35-42` |

### Constatari

- **[Medium] Backend-ul e blocat la 1 proces** de 4 componente in-memory. Pentru ~200 utilizatori e acceptabil si documentat onest in cod. Cand va trebui al doilea worker/replica: Redis (pub/sub pentru broadcaster, `storage_uri=redis://` pentru slowapi, chei pentru throttle) + scheduler cu lock (APScheduler cu `SQLAlchemyJobStore` + un singur "leader", sau mutati job-urile intr-un container separat `scheduler`). Efort: **L**.
- **[Low] Fara PgBouncer** — irelevant la 1 worker; devine relevant odata cu replicile. Efort: **S**.
- **[Low] `--timeout 600` + 1 worker**: un request sincron blocant (ex. import legacy CPU-bound, reportlab) blocheaza tot event-loop-ul; importul foloseste deja streaming, dar orice cod sync greu in handler async blocheaza toti userii. Efort: **M** (`run_in_threadpool` unde e cazul; sau `-w 2` dupa Redis).

---

## 8. Securitate operationala

### Verificat

| Aspect | Constatare | Referinta |
|---|---|---|
| Rate limiting | slowapi global `60/minute` per IP + limite per endpoint: login `30/minute`, reset `5/hour`, admin verify `3/minute`, upload `5/minute` etc. (19 decoratori) | `rate_limit.py:7`, `routers/auth.py:94,167,296,327,374,398`, `routers/admin.py:62,135,174,198` |
| IP real | `get_remote_address` — fara `ProxyHeadersMiddleware`/`--forwarded-allow-ips` in gunicorn ⇒ **toate request-urile par sa vina de la IP-ul nginx**, deci limita per-IP e de fapt globala pentru toti utilizatorii (un atacator poate DoS-ui login-ul tuturor cu 30 req/min; invers, limita per atacator nu exista) — **inferat din config, neverificat la runtime** | `rate_limit.py:7`, `entrypoint.sh:16-25` (fara `--forwarded-allow-ips`), `nginx.conf:135-136` (seteaza X-Forwarded-For) |
| Brute-force | throttle per (firma, user): 8 esecuri / 15 min ⇒ lockout 5 min, cap 10 000 intrari — design bun si testat (`test_login_throttle.py`) | `utils/login_throttle.py:26-32`, `backend/tests/test_login_throttle.py` |
| Parole | bcrypt | `requirements.txt:16`, `seed.py:216` |
| Upload | whitelist MIME + magic bytes, SVG refuzat, S3 | `utils/storage.py:11-21` |
| Pinning backend | `requirements.txt` **doar `>=`** (24 pachete), fara lockfile/hash ⇒ build nereproductibil, upgrade-uri majore surpriza | `backend/requirements.txt:1-24` |
| Pinning frontend | `^` ranges dar `package-lock.json` + `npm ci` ⇒ reproductibil | `frontend/package.json`, `frontend.Dockerfile:8` |
| Dependabot/Renovate/audit | nimic (`.github/` absent); fara `pip-audit`/`npm audit` in vreun script | — |
| Docs endpoints | active in container (`/docs`, `/redoc`, `/openapi.json`), **neexpuse** prin nginx (doar `/api/`) | `main.py:77-81`, `nginx.conf:130-150` |
| Header sensibile | `Authorization: Bearer` din store-ul frontend (persistenta neverificata) | `frontend/src/utils/api.ts:61-62` |
| DB in QA expusa pe LAN | `5432:5432` + parola QA = cea din `.env.qa`; QA.md cere port-forward doar pe 80 | `docker-compose.qa.yml:18-20`, `QA.md:42-43` |
| Secrete pe servere | PAT GitHub in `~/.git-credentials`, `ANTHROPIC_API_KEY` in `~/.bashrc` (documentat) | `QA.md:98, 139, 154, 182` |
| Postgres image | `postgres:16-alpine` fara minor pin; `POSTGRES_PASSWORD` prin env (nu secret file) | `docker-compose.yml:85-89` |

### Constatari

- **[High] Rate-limit si throttle pe IP probabil ineficiente in spatele nginx** (toti utilizatorii = IP-ul containerului frontend). Efort: **S**: gunicorn `--forwarded-allow-ips='*'` (sau IP-ul retelei `web`) ca uvicorn sa rescrie `client` din `X-Forwarded-For`; sau `key_func` custom care citeste `X-Real-IP`. Verificati apoi in log (`ip=` din `middleware.py:83`).
- **[High] `requirements.txt` fara pin** (`>=`). Efort: **S** (`pip-compile` → `requirements.lock` cu hash-uri; Dockerfile instaleaza din lock).
- **[Medium] Fara scanare de dependinte / imagini** — Efort: **S** (Dependabot yaml + `pip-audit`/`npm audit` in CI + Trivy).
- **[Medium] Postgres expus pe LAN in QA** cu parola in fisier — Efort: **S** (`127.0.0.1:5432:5432`).
- **[Low] Dezactivati `/docs` in prod** ca defense-in-depth (`docs_url=None if not DEBUG`). Efort: **S**.

---

## 9. Tabel consolidat (prioritate)

| # | Sev. | Constatare | Referinta | Efort |
|---|---|---|---|---|
| 1 | Critical | 18 dump-uri de productie (PII, hash-uri) in git; `.sqlplus` neacoperit de `.gitignore` | `deploy/backup_Productie_*`, `.gitignore:15-16` | M |
| 2 | Critical | Parola sudo QA in clar in fisier tracked | `QA.md:19` | S |
| 3 | Critical | Fara backup automat / retentie / offsite | `deploy/README.md:200-204` | S-M |
| 4 | High | Fara CI, fara lint, teste rulate manual; fara rollback (imagini netaguite) | `backend/tests/run_all.py`, `QA.md:117-129` | M |
| 5 | High | HSTS comentat + fallback HTTP `:80` fara redirect | `nginx.conf:46`, `Caddyfile:19-21` | S |
| 6 | High | Default `SECRET_KEY` cunoscut, fara fail-fast | `backend/app/config.py:5` | S |
| 7 | High | Fara error tracking / alertare / uptime | — | S |
| 8 | High | Build context = repo root fara `.dockerignore` (venv, dump-uri, `backend/.env`, chei SSH in context) | `docker-compose.yml:25-27,53-55` | S |
| 9 | High | Rate-limit per IP vede doar IP-ul nginx (fara forwarded-allow-ips) — inferat | `rate_limit.py:7`, `entrypoint.sh:16-25` | S |
| 10 | High | `requirements.txt` nepinuit | `backend/requirements.txt` | S |
| 11 | High | `.env.example` incomplet (ADMIN_PASSWORD_*, S3_*, ALLOWED_HOSTS, ASSISTANT_*) | `deploy/.env.example` | S |
| 12 | Medium | Containere root; fara rotire log Docker; imagini fara pin | Dockerfiles, `docker-compose.yml` | S |
| 13 | Medium | Migratii automate la boot fara backup prealabil | `entrypoint.sh:9-10` | M |
| 14 | Medium | Agent-bridge `bypassPermissions` pe `0.0.0.0:8765` | `ops/agent-bridge/bridge.py:38`, `.service:18` | S |
| 15 | Medium | Log nestructurat + dublat; fara metrici | `logging_config.py`, `entrypoint.sh:25` | M |
| 16 | Medium | 1 worker impus de stare in-memory (SSE, slowapi, throttle, APScheduler) | `broadcaster.py`, `rate_limit.py`, `login_throttle.py`, `main.py:66-67` | L |
| 17 | Medium | `deploy/README.md` invechit (Traefik); `deploy-qa.sh` neversionat | `deploy/README.md:84-112`, `QA.md:121` | S |
| 18 | Medium | JWT 30 zile | `config.py:7` | M |
| 19 | Medium | Postgres pe `0.0.0.0:5432` in QA/override | `docker-compose.qa.yml:18-20` | S |
| 20 | Low | `/api/health` 200 pe degraded; `/docs` activ in container; fara `limit_req` nginx; duplicare location-uri | `main.py:172-183`, `nginx.conf` | S |

---

## 10. Plan recomandat (ordine)

**Saptamana 1 (S):** rotire parola QA + curatare `QA.md`; `git rm --cached` dump-uri + `.gitignore` (`*.sqlplus`, `backup_*`) + `git filter-repo` + force-push + re-clone servere; `.dockerignore`; fail-fast pe `SECRET_KEY`; HSTS + redirect HTTP in Caddy; `--forwarded-allow-ips`; `logging:` cu rotire in compose; `.env.example` complet; pin `requirements`.

**Saptamana 2 (S-M):** backup zilnic `pg_dump -Fc` → S3 cu retentie + test restore lunar documentat; Sentry (sau GlitchTip) + uptime monitor extern pe `/api/health`; `USER` non-root in Dockerfiles.

**Luna 1 (M):** GitHub Actions (ruff, tests, tsc, docker build, Trivy) → push GHCR tag=SHA; compose cu `image:` + `TAG`; procedura de rollback scrisa; `deploy-qa.sh`/`deploy-prod.sh` in repo; rescriere `deploy/README.md`.

**Cand creste incarcarea (L):** Redis pentru broadcaster/slowapi/throttle, scheduler separat, `-w 2+`, PgBouncer.

---

## Anexa — ce NU s-a putut verifica (read-only, fara ssh)

- Configuratia reala de pe prod/QA (fisierele `.env` de pe server, `deploy-qa.sh`, firewall ufw, ce ruleaza agent-bridge pe prod, rotirea parolelor B-02/B-03 din review-ul anterior).
- Daca `X-Forwarded-For` e efectiv ignorat de uvicorn in productie (inferat din lipsa `--forwarded-allow-ips` si `key_func=get_remote_address`).
- Persistenta token-ului in frontend (localStorage vs memorie).
