# Architecture Review Report
**Project:** BerlinStar — POS / Tire Hotel / Wheel Mounting platform
**Date:** 2026-05-14
**Target load:** 200 concurrent users
**Overall status:** 🔴 NOT READY FOR DEPLOY

> **Overall status rules:**
> - 🔴 NOT READY — any BLOCKER finding is open
> - 🟡 CONDITIONAL — no BLOCKERs, but at least one CRITICAL or HIGH finding is open
> - 🟢 READY — no BLOCKERs, no CRITICALs, HIGHs are documented with a fix plan

---

## Executive Summary

The BerlinStar stack is functionally rich (FastAPI + SolidJS + PostgreSQL 16, Docker-Compose deployment, SSE broadcaster, S3 image storage) and well-organized at the macro level (domain-split routers, ORM/schema separation, Alembic async migrations, strict TS). However, the audit surfaced **7 deploy-blocking issues**, concentrated in secrets management and auth surface: hardcoded admin passwords in `routers/admin.py`, a fallback `SECRET_KEY` literal in `config.py`, real-looking Hetzner S3 credentials committed in `deploy/.env.example`, JWT stored in `localStorage` (XSS = full takeover), PostgreSQL port `5432` published to the host, an unprotected `/adminv2` SPA route, and the complete absence of an automated backup mechanism (last manual dump is 15 days old).

Beyond the blockers, **11 critical** items must be resolved before go-live: no TLS termination, no security headers, no rate limiting on auth endpoints, permissive CORS with credentials, a legacy `base64`-as-password fallback in `verify_password`, sync `boto3` calls blocking the asyncio event loop on every image upload, a wasted double-query in `list_anvelope`, no global 401 handling on the frontend, login redirect that loses the originally requested URL, PDF generation freezing the UI on `POS`/`HotelAnvelope`, and Romanian diacritics ASCII-transliterated on the three core fiscal documents (Deviz / Factură / Chitanță).

The codebase otherwise demonstrates good async hygiene (SQLAlchemy `await`, httpx, SMTP offloaded to executor), correct SSE disconnect cleanup with no DB sessions held across long-lived streams, proper Vite code-splitting for `jspdf`/`qrcode`, and a clean Alembic async setup. Persistent Postgres volume, healthcheck-gated `depends_on`, and aggressive static-asset caching in Nginx are all correctly configured.

**Recommendation:** Do not ship. Block deploy on the 7 BLOCKERs, fix the 11 CRITICALs before go-live, schedule the 26 HIGHs for the current sprint. With those addressed, the stack is fit for purpose at the 200-user target without horizontal scaling or PgBouncer.

---

## 🚨 Blockers — Must fix before any deployment

> These findings prevent deployment. The build must not go to production until all items in this section are resolved.

### B-01 — JWT `SECRET_KEY` has insecure default fallback
- **Agent:** Security / Code Quality
- **Location:** [backend/app/config.py:5](backend/app/config.py#L5)
- **Issue:** `SECRET_KEY = os.getenv("SECRET_KEY", "schimba-asta-in-productie")` silently falls back to a publicly-known string if the env var is missing. Any container where `.env` fails to load (typo, mount issue, stale image) signs tokens with that key. Anyone reading the repo can mint admin JWTs.
- **Recommendation:** Remove the fallback. `SECRET_KEY = os.environ["SECRET_KEY"]` raises `KeyError` immediately. Add length assertion (`assert len(SECRET_KEY) >= 32`). Apply same pattern to `DATABASE_URL`.

### B-02 — Hardcoded admin passwords compiled into source
- **Agent:** Security / Code Quality
- **Location:** [backend/app/routers/admin.py:15-16](backend/app/routers/admin.py#L15-L16) (`_PASSWORD_1 = "alexgligor"`, `_PASSWORD_2 = "ADASTools1"`)
- **Issue:** Two plaintext passwords compiled into the image. `POST /api/admin/verify` mints a 30-day JWT for the `admin` account on a successful match. Anyone with repo read access (or a leaked image) has permanent admin access. Comparison uses `!=` (timing-attack vulnerable as a secondary concern).
- **Recommendation:** Move to env vars (`ADMIN_PASSWORD_1`, `ADMIN_PASSWORD_2`), compare with `hmac.compare_digest`. Better: delete the dual-password gate entirely and rely on a single admin account with hashed password + 2FA. Rotate these values immediately — they are in git history.

### B-03 — Real S3 production credentials in tracked `.env.example`; secrets committed across `deploy/.env` and `backend/.env`
- **Agent:** Security / UX
- **Location:** [deploy/.env.example:17-18](deploy/.env.example#L17-L18) (`S3_ACCESS_KEY=KW1B8XLFY71MTLI11OSN`, `S3_SECRET_KEY=nWo1lQFFwpxtQJZ78srP4LgHnHoG26QCrirhnO3l`); also `deploy/.env`, `deploy/.env.dev`, `deploy/.env.prod`, `backend/.env`
- **Issue:** `deploy/.env.example` is tracked in git and contains what look like real Hetzner Object Storage production credentials. `SECRET_KEY=e59aecb03f1e8e46e8eaf8d09de2ab535bee31e9f44bdcb3b93bc11ee11a9e60` is duplicated across `deploy/.env` and `backend/.env`.
- **Recommendation:** (1) Rotate the Hetzner S3 access key/secret immediately. (2) Rotate `SECRET_KEY` and DB password. (3) Replace `deploy/.env.example` with placeholder strings only (`S3_ACCESS_KEY=__REPLACE_ME__`). (4) Add `.env*` (except `.env.example`) to `.gitignore`. (5) Run `git filter-repo`/BFG to scrub the secret from history, then force-push (coordinate with team).

### B-04 — JWT stored in `localStorage` (XSS = full account takeover)
- **Agent:** Security / Code Quality
- **Location:** [frontend/src/store/authStore.ts:12-32](frontend/src/store/authStore.ts#L12-L32) (persisted via `localStorage.setItem`); read at [frontend/src/utils/api.ts:10](frontend/src/utils/api.ts#L10)
- **Issue:** Tokens are kept in `localStorage` and attached to every request as `Authorization: Bearer …`. Any XSS — unsafe `innerHTML`, malicious third-party library, unsanitised user-supplied string rendered as HTML — exfiltrates the JWT. Combined with `TOKEN_EXPIRE_DAYS=30` and no refresh/rotation, this is a long-lived bearer token in the most XSS-exposed location possible.
- **Recommendation:** Move to `HttpOnly; Secure; SameSite=Lax` cookie set by `POST /api/auth/login`. Frontend stops sending `Authorization` header; backend reads cookie in `dependencies.py`. Add a CSRF token for state-changing requests (double-submit cookie pattern). Minimum interim mitigation: shorten `TOKEN_EXPIRE_DAYS` to 1 and add a refresh endpoint.

### B-05 — PostgreSQL port 5432 published to the host
- **Agent:** Security / Performance
- **Location:** [deploy/docker-compose.yml:40-41](deploy/docker-compose.yml#L40-L41)
- **Issue:** `ports: - "5432:5432"` exposes Postgres on the host's external interface. On any cloud VM without an external firewall (Hetzner default = no firewall), Postgres is directly reachable from the internet. Combined with the leaked `berlinstar_dev` password in committed examples this is a full database-takeover vector.
- **Recommendation:** Remove the `ports:` block from the `db` service entirely — backend already reaches it via the `internal` Docker network. If host-side access is required for backups, bind to `127.0.0.1:5432:5432`.

### B-06 — `/adminv2` route is publicly accessible (bypasses `<Protected>` / JWT)
- **Agent:** UX
- **Location:** [frontend/src/App.tsx:63](frontend/src/App.tsx#L63)
- **Issue:** Every other route is wrapped in `<Protected>`, but line 63 declares `<Route path="/adminv2" component={AdminV2} />` directly. Anonymous users can hit the URL. AdminV2 has its own password gate using a `localStorage` token, but the route itself ignores `auth.token` / `trialExpired()`.
- **Recommendation:** Wrap AdminV2 in `<Protected>` (or check `auth.token` and `trialExpired()` and `Navigate href="/no-access"`).

### B-07 — No automated backup mechanism; last manual dump is 15 days old
- **Agent:** Performance
- **Location:** `deploy/backup_Productie_*.sql` — seven manual dumps spanning 2026-03-28 → 2026-04-29; no backups since
- **Issue:** No `cron`/`systemd`/script invocation of `pg_dump` anywhere in the repo. SQL files have manual timestamps with irregular gaps. **15 days** without a fresh backup, no off-host storage — data-loss blocker for a POS system. SQL backups are also committed to the repo (PII + password hashes exposure).
- **Recommendation:** (1) Add a host cron / sidecar service running daily `pg_dump -F c` → `/var/backups/berlinstar/db_$(date +%Y%m%d).dump`. (2) Sync to off-host Hetzner Object Storage (`S3_BUCKET` already provisioned). (3) Retention: 14 daily + 12 monthly. (4) Test restore quarterly. (5) Drop SQL backups from the git repo and add `deploy/backup_*.sql` to `.gitignore`.

---

## 🔴 Critical — Fix before go-live

> No deployment blocker, but these must be resolved before the application is exposed to real users.

### C-01 — No HTTPS / TLS at the edge; no HSTS
- **Agent:** Security
- **Location:** [deploy/nginx.conf:8](deploy/nginx.conf#L8) (only `listen 80;`)
- **Issue:** Nginx listens on plain HTTP only. Credentials, JWT bearer tokens, uploaded images, customer PII all transit in clear text.
- **Recommendation:** Terminate TLS at Nginx (`listen 443 ssl http2;`) with Let's Encrypt, or rely on a documented upstream Traefik/Rockhost terminator. Add a `listen 80` block 301-redirecting to HTTPS. Add `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`.

### C-02 — No security headers at Nginx
- **Agent:** Security
- **Location:** [deploy/nginx.conf](deploy/nginx.conf) (entire file)
- **Issue:** None of `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` are set. Combined with JWT-in-localStorage, an XSS or clickjacking has zero defence in depth.
- **Recommendation:** Inside `server { ... }` add:
  ```
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
  add_header Content-Security-Policy "default-src 'self'; img-src 'self' https://*.your-objectstorage.com data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
  ```
  Tune CSP after 24h of `Content-Security-Policy-Report-Only`.

### C-03 — No rate limiting on login / register / admin verify
- **Agent:** Security
- **Location:** [backend/app/routers/auth.py:55,97,121](backend/app/routers/auth.py), [backend/app/routers/admin.py:31](backend/app/routers/admin.py#L31); no `slowapi`/`limiter` anywhere
- **Issue:** `/api/auth/login`, `/api/auth/register`, `/api/auth/token`, `/api/admin/verify` accept unlimited attempts. Bcrypt + 6-char minimum + no limiter = trivial brute-force vector and a CPU-bound DoS. The register error `409 "deja folosit"` also enumerates usernames.
- **Recommendation:** Add `slowapi`. `@limiter.limit("5/minute")` on login/register/token, `@limiter.limit("3/minute")` on admin/verify, global default `60/minute` per IP. Add Nginx `limit_req_zone` for `/api/auth/`. Normalize the register response so it does not disclose user existence.

### C-04 — CORS allows credentials with permissive methods/headers
- **Agent:** Security
- **Location:** [backend/app/main.py:35-41](backend/app/main.py#L35-L41)
- **Issue:** `allow_credentials=True` combined with `allow_methods=["*"]` and `allow_headers=["*"]`. Any future widening of `CORS_ORIGINS` becomes catastrophic. Current dev value (`http://localhost`, `http://IP_SERVER_TAU`) is HTTP and easily hijacked.
- **Recommendation:** Whitelist methods (`["GET","POST","PUT","PATCH","DELETE"]`) and headers (`["Authorization","Content-Type"]`). Validate `CORS_ORIGINS` at startup — reject `*` and bare hostnames. Move to `https://…` only once cookies replace `localStorage`.

### C-05 — Legacy base64 password "hash" still accepted
- **Agent:** Security
- **Location:** [backend/app/utils/security.py:29-30](backend/app/utils/security.py#L29-L30)
- **Issue:** `verify_password` falls back to comparing `base64(plain)` against the stored value when it isn't a bcrypt hash. Any legacy account has its password effectively in plaintext in the DB.
- **Recommendation:** Run a one-off migration: wrap any non-`$2`-prefixed stored value in bcrypt and force a password reset on next login. Remove the legacy branch after migration. Audit and reset visibly sensitive accounts now.

### C-06 — `list_anvelope` issues 2 full queries per request, discarding the first
- **Agent:** Code Quality
- **Location:** [backend/app/routers/anvelope.py:55-69](backend/app/routers/anvelope.py#L55-L69)
- **Type:** BUG
- **Issue:** Lines 46-55 build and execute `stmt`, assigning to `rows`; lines 59-69 build `stmt2` and overwrite `rows`. The first query is pure waste — every list request hits the DB twice. At 200 concurrent users this doubles load on this endpoint.
- **Recommendation:** Delete lines 46-55. Move `selectinload(...)` onto the original `stmt`. Add `from sqlalchemy.orm import selectinload` once at top of file.

### C-07 — Sync `boto3` S3 calls inside async endpoints (blocks event loop)
- **Agent:** Code Quality
- **Location:** [backend/app/utils/storage.py:21-67](backend/app/utils/storage.py#L21-L67) (`put_object`/`delete_object` are synchronous); called from [items.py:145](backend/app/routers/items.py#L145), [companies.py:139,161](backend/app/routers/companies.py), [departments.py:125](backend/app/routers/departments.py#L125), [employees.py:100](backend/app/routers/employees.py#L100), [locations.py:139](backend/app/routers/locations.py#L139), [global_settings.py:46,60,74,99](backend/app/routers/global_settings.py)
- **Type:** BUG
- **Issue:** Every image upload blocks the asyncio loop for the duration of the S3 PUT (network round-trip, seconds). With 200 concurrent users a few simultaneous uploads freeze the entire API.
- **Recommendation:** Wrap with `await asyncio.to_thread(_s3_client().put_object, ...)` (5-line patch), or switch to `aioboto3`/`aiobotocore`.

### C-08 — No global 401 handling; expired JWT silently swallows requests
- **Agent:** UX
- **Location:** [frontend/src/utils/api.ts:5-14](frontend/src/utils/api.ts#L5-L14)
- **Issue:** `apiFetch` never inspects response status. Zero `401` handling exists in the codebase. When the JWT expires, stores silently catch errors and either leave stale data or show generic "Eroare la încărcare". User remains "logged in" but nothing works.
- **Recommendation:** In `apiFetch`, on `res.status === 401` call `logout()` and redirect to `/login`. Dispatch a custom event so the UI can show "Sesiunea a expirat".

### C-09 — Login redirect does not preserve the originally requested URL
- **Agent:** UX
- **Location:** [frontend/src/App.tsx:30](frontend/src/App.tsx#L30) (`<Show when={auth.token} fallback={<Login />}>`); [frontend/src/pages/Login.tsx:47](frontend/src/pages/Login.tsx#L47) (`navigate("/")`)
- **Issue:** Opening `/clienti` while logged out renders Login inline; on success the user is navigated to `/`, losing their target.
- **Recommendation:** Capture `useLocation()` in `Protected`, pass `?from=` query, after login `navigate(searchParams.from ?? "/")`.

### C-10 — Heavy PDF generation runs on main thread; loaders missing on POS & HotelAnvelope
- **Agent:** UX
- **Location:** [frontend/src/utils/generateDocuments.ts](frontend/src/utils/generateDocuments.ts) (2204 lines); call sites in [HotelAnvelope.tsx:364,366,379,479,481,486,1044,1183](frontend/src/pages/HotelAnvelope.tsx), [Reception.tsx:481-540](frontend/src/pages/Reception.tsx#L481-L540)
- **Issue:** `generateDevizPlusOperatii` merges Deviz + MontajRoti + multiple Cazare sections — for a customer with 4 wheels + 2 hotel transactions this loads NotoSans-Ro (≥50KB base64), 4 wheel photos, hotel photos, generates a QR code, runs jsPDF synchronously. Reception has per-button loaders; HotelAnvelope has none — buttons remain clickable and main-thread blocking can exceed 2-3 s on a tablet.
- **Recommendation:** (a) Add `pdfLoading` signal in HotelAnvelope; disable buttons during generation; show toast. (b) Consider Web Worker for the heaviest `generateDevizPlusOperatii` path. (c) Preload `NotoSans-Ro.ttf` at app boot.

### C-11 — Romanian diacritics ASCII-transliterated on Deviz/Factură/Chitanță
- **Agent:** UX
- **Location:** [frontend/src/utils/generateDocuments.ts:53-60](frontend/src/utils/generateDocuments.ts#L53-L60) (`ro()` strips diacritics); [:590, :711, :760](frontend/src/utils/generateDocuments.ts) (`generateDeviz`, `generateFactura`, `generateChitanta` — none call `registerRoFont`)
- **Issue:** Only longer documents register NotoSans-Ro. The three **core fiscal documents** — DEVIZ, FACTURĂ, CHITANȚĂ — fall back to Helvetica and strip diacritics. Unprofessional on a Romanian fiscal document and may violate ANAF presentation expectations.
- **Recommendation:** In each of the three: `const fontB64 = await loadRoFontBase64(); if (fontB64) registerRoFont(doc, fontB64);` and use `setFont("NotoSans", ...)` + `makeT(true)`. Same pattern that `generateMontajRoti` already uses (lines 2032-2033).

---

## 🟠 High — Fix in current sprint

### H-01 — JWT lifetime 30 days, no refresh/rotation, no revocation
- **Agent:** Security
- **Location:** [backend/app/config.py:7](backend/app/config.py#L7) (`TOKEN_EXPIRE_DAYS: int = 30`); issued at [backend/app/routers/auth.py:49-51](backend/app/routers/auth.py#L49-L51), [backend/app/routers/admin.py:42-44](backend/app/routers/admin.py#L42-L44)
- **Issue:** A 30-day bearer token cannot be invalidated server-side (no JTI/denylist), no refresh token, no rotation, no `iat`/`nbf` claims, no `aud`/`iss`.
- **Recommendation:** Access token 15-30 min, refresh token (opaque, hashed in DB, `expires_at`, `revoked_at`), rotation on each refresh, `/logout` revokes the refresh token. Add `iat`, `iss="berlinstar"`, `aud="berlinstar-web"` and verify.

### H-02 — Bcrypt cost factor not pinned; 6-char minimum password length
- **Agent:** Security
- **Location:** [backend/app/utils/security.py:8](backend/app/utils/security.py#L8) (`bcrypt.gensalt()`), [auth.py:69](backend/app/routers/auth.py#L69)
- **Issue:** `bcrypt.gensalt()` with no argument depends on library defaults; if it changes, hashes weaken silently. 6-char minimum is too short (~10 min/password on commodity GPUs).
- **Recommendation:** `bcrypt.gensalt(rounds=12)` explicit. Bump minimum to 10 chars + top-1000 common password block.

### H-03 — File-upload MIME validation trusts client `content_type`
- **Agent:** Security
- **Location:** [backend/app/utils/storage.py:36-43](backend/app/utils/storage.py#L36-L43); used by companies, items, employees, locations, departments, global_settings routers
- **Issue:** `validate_image` only checks `file.content_type.startswith("image/")`. The attacker controls that header — `.exe` or `.svg` containing JS can be uploaded with `Content-Type: image/png`. Files land on S3 with `ACL=public-read` and are served from the same domain → XSS via SVG.
- **Recommendation:** Sniff bytes (`python-magic`/`filetype`/magic-number check). Reject `image/svg+xml`. Derive extension from sniffed type. Add `X-Content-Type-Options: nosniff` on responses, or proxy S3 with `Content-Disposition: attachment` for non-image types.

### H-04 — Nginx `client_max_body_size 20m` not enforced in FastAPI; full-body read into memory
- **Agent:** Security
- **Location:** [deploy/nginx.conf:10](deploy/nginx.conf#L10); [backend/app/utils/storage.py:36-43](backend/app/utils/storage.py#L36-L43)
- **Issue:** Nginx caps at 20 MB but `validate_image` enforces 5 MB only AFTER `await file.read()` (full body in RAM). Non-image endpoints have no application-layer limit. At 200 users, parallel max-size uploads saturate backend memory.
- **Recommendation:** Stream-read with bail-out at `max_mb`. Lower Nginx `client_max_body_size` to ~8m. Per-IP rate-limit on upload endpoints.

### H-05 — S3 objects uploaded with `ACL=public-read`; user content world-readable
- **Agent:** Security
- **Location:** [backend/app/utils/storage.py:27,53](backend/app/utils/storage.py)
- **Issue:** Every uploaded image (employee photo, company logo, item picture, tyre-storage photo) is publicly accessible at a guessable-prefix URL. PII (employee photos, vehicle plates on tyre-storage images) is exposed.
- **Recommendation:** Bucket policy private. Upload `ACL=private`. Serve via `generate_presigned_url` (TTL ~1 h) from `GET /api/images/{key}` that checks `account_id` ownership. Migrate existing keys via background job.

### H-06 — `_decode_token` swallows all exceptions; no `sub`/account validity check
- **Agent:** Security
- **Location:** [backend/app/dependencies.py:11-18](backend/app/dependencies.py#L11-L18)
- **Issue:** `except Exception` masks DB/network/parse errors as "Token invalid", hiding bugs. No check that `payload["sub"]` corresponds to an existing, non-deleted, non-locked account. Deleted users keep working tokens for 30 days.
- **Recommendation:** Narrow except to `jwt.PyJWTError, KeyError, ValueError`. Load `Account` by id in the dependency, check `is_deleted is False` / `is_locked`. Cache 30s to avoid one DB query per request.

### H-07 — JWT accepted as URL query parameter (logged everywhere)
- **Agent:** Security
- **Location:** [backend/app/dependencies.py:25-26](backend/app/dependencies.py#L25-L26)
- **Issue:** `?token=…` will be logged by Nginx access logs, request middleware, browser history, referers, and any CDN/WAF. Token-leak pattern.
- **Recommendation:** Restrict to SSE only. Issue a separate single-use 60s ticket via `/api/sse/ticket`. Scrub `token` from Nginx logs (`log_format` with sanitised `$request_uri`). Add `Referrer-Policy: no-referrer` for SSE responses.

### H-08 — `register` endpoint allows arbitrary account creation (spam / DB-bloat / enumeration)
- **Agent:** Security
- **Location:** [backend/app/routers/auth.py:97-118](backend/app/routers/auth.py#L97-L118)
- **Issue:** Anyone can hit `POST /api/auth/register`, creating any number of `is_locked=True` accounts, each triggering a background SMTP send. `409 "deja folosit"` enumerates emails. `email` is plain `str | None` with no format validation.
- **Recommendation:** IP rate-limit (`5/hour`). `email: EmailStr | None`. Return generic `200 "if eligible, you will receive an email"` regardless. Consider captcha or invitation-token flow.

### H-09 — Gunicorn missing `--max-requests` / `--max-requests-jitter` / `--preload`
- **Agent:** Performance
- **Location:** [deploy/entrypoint.sh:13-19](deploy/entrypoint.sh#L13-L19)
- **Issue:** Workers accumulate memory over days; no preload means each of 4 workers re-imports the FastAPI app (~150 MB × 4 RSS uncopied-on-write); `--graceful-timeout` not set.
- **Recommendation:** Append `--max-requests 2000 --max-requests-jitter 200 --graceful-timeout 30 --preload`. Keep `-w 4`.

### H-10 — Nginx gzip is NOT enabled
- **Agent:** Performance
- **Location:** [deploy/nginx.conf](deploy/nginx.conf)
- **Issue:** No `gzip on`, no `gzip_types`. JS/CSS/JSON go uncompressed — triples wire payload and TTFB on first load.
- **Recommendation:** Inside `server { }`:
  ```
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_comp_level 6;
  gzip_proxied any;
  gzip_types text/plain text/css text/xml text/javascript
             application/javascript application/x-javascript
             application/json application/xml application/xml+rss
             application/atom+xml image/svg+xml font/ttf font/otf
             application/font-woff application/font-woff2;
  ```
  Do not gzip SSE — keep `proxy_buffering off` blocks intact.

### H-11 — Nginx `keepalive_timeout` not set; `ip_hash` redundant
- **Agent:** Performance
- **Location:** [deploy/nginx.conf:2,7-12](deploy/nginx.conf)
- **Issue:** No `keepalive_timeout`/`keepalive_requests` at server level. Under 200 SSE clients the keepalive pool can exhaust. `ip_hash` with a single upstream is a no-op.
- **Recommendation:** Add `keepalive_timeout 65; keepalive_requests 1000;` at server level and `keepalive_requests 1000; keepalive_timeout 60s;` in upstream block. Remove the `ip_hash` directive.

### H-12 — `proxy_read_timeout 3600s` blanket on all `/api/` routes
- **Agent:** Performance
- **Location:** [deploy/nginx.conf:23,37](deploy/nginx.conf)
- **Issue:** A stuck backend worker holding a regular API request ties up an Nginx worker connection for 1 hour. Required for SSE; 60s is plenty elsewhere.
- **Recommendation:** Split SSE into its own location (`location = /api/receipts/events { proxy_read_timeout 3600s; ... }`). Let other `/api/` use `proxy_read_timeout 60s;`.

### H-13 — No backend healthcheck (and no frontend healthcheck)
- **Agent:** Performance
- **Location:** [deploy/docker-compose.yml:15-32, 3-13](deploy/docker-compose.yml)
- **Issue:** Only `db` has a healthcheck. Backend exposes `/api/health` but Docker can't restart a deadlocked uvicorn worker. Frontend has no `depends_on` on backend.
- **Recommendation:**
  ```yaml
  backend:
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health',timeout=3).status==200 else 1)\""]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
  frontend:
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost/ >/dev/null || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
  ```

### H-14 — `_serialize_anvelopa` chained N+1 risk in `cazare_anvelope`
- **Agent:** Code Quality
- **Location:** [backend/app/routers/cazare_anvelope.py:60-110, 113-135](backend/app/routers/cazare_anvelope.py)
- **Type:** BUG (N+1)
- **Issue:** `_load_stmt` chains `selectinload` 6 times for the same `items.anvelopa` path; relationships on `Anvelopa.marca/dimensiune/profil` use default `lazy="select"`. SQLAlchemy collapses duplicates today but it is fragile. If a future `referinta_cazare.items` path misses one chain, you fall off the greenlet cliff.
- **Recommendation:** Refactor: single `selectinload(CazareAnvelope.items).selectinload(CazareAnvelopaItem.anvelopa).options(selectinload(Anvelopa.marca), selectinload(Anvelopa.dimensiune), selectinload(Anvelopa.profil))`. Or set `lazy="selectin"` on `Anvelopa.marca/dimensiune/profil`.

### H-15 — `Receipt.list_receipts` silently returns empty `cazari_anvelope` (wrong lazy-load)
- **Agent:** Code Quality
- **Location:** [backend/app/routers/receipts.py:131-176](backend/app/routers/receipts.py#L131-L176); [backend/app/models/receipt.py:57-61](backend/app/models/receipt.py#L57-L61)
- **Type:** BUG
- **Issue:** `cazari_anvelope` uses `lazy="noload"`. `_serialize` reads `receipt.cazari_anvelope`, returning empty list silently — contradicts serializer intent. `get_receipt` is correct (uses `selectinload(Receipt.cazari_anvelope)`).
- **Recommendation:** Either add `selectinload(Receipt.cazari_anvelope)` in `list_receipts` (line 134) or document that cazari are intentionally hidden in list view. Set `Receipt.client/.vehicol` to `lazy="raise"` to surface future regressions in tests.

### H-16 — No global FastAPI `@app.exception_handler`
- **Agent:** Code Quality
- **Location:** [backend/app/main.py](backend/app/main.py)
- **Type:** BUG
- **Issue:** Generic 500s are handled by middleware (good), but `IntegrityError`/`OperationalError`/SQLAlchemy errors bubble through with stack traces in logs and no normalized client shape. No `IntegrityError → 409` / `OperationalError → 503` translation.
- **Recommendation:**
  ```python
  @app.exception_handler(IntegrityError)
  async def integrity(_req, exc):
      return JSONResponse({"detail": "Conflict."}, status_code=409)
  @app.exception_handler(OperationalError)
  async def db_down(_req, exc):
      return JSONResponse({"detail": "Serviciu temporar indisponibil."}, status_code=503)
  ```
  Expose `X-Request-Id` on all responses, not only 500.

### H-17 — `Broadcaster` is single-process only
- **Agent:** Code Quality
- **Location:** [backend/app/broadcaster.py:1-41](backend/app/broadcaster.py#L1-L41)
- **Type:** BUG
- **Issue:** State (`_listeners`, `_pos_count`) is in-memory in one Python process. With gunicorn `-w >1`, a receipt change committed on worker A does not notify SSE listeners on worker B. Users on different workers see stale data.
- **Recommendation:** Either (a) lock to `--workers 1` with sufficient `--limit-concurrency` and document the constraint (acceptable for ~200 users on one beefy box); or (b) replace with Redis pub/sub (`redis.asyncio.from_url(...).pubsub()`).

### H-18 — 422 Pydantic validation errors render as `[object Object]` / raw arrays
- **Agent:** UX
- **Location:** [AdminV2.tsx:629,695,1089,1111,1143,1164,1634](frontend/src/pages/AdminV2.tsx), [HotelAnvelope.tsx:865,896,983,1006,1036,1156](frontend/src/pages/HotelAnvelope.tsx), [Login.tsx:88](frontend/src/pages/Login.tsx#L88), [Reception.tsx:527](frontend/src/pages/Reception.tsx#L527), [ShoppingList.tsx:235,378](frontend/src/components/ShoppingList.tsx)
- **Issue:** Pattern `setError(d.detail ?? "Eroare ...")` everywhere. FastAPI 422 returns `detail: [{loc, msg, type}, ...]` (an array). Rendering produces `[object Object]`.
- **Recommendation:** Centralize a helper `parseApiError(detail): string` in `utils/api.ts` handling both string and array forms (`${e.loc.at(-1)}: ${e.msg}`). Optionally return `Record<field, message>` for field-level highlighting.

### H-19 — Raw `window.alert()` used for critical user feedback
- **Agent:** UX
- **Location:** [Reception.tsx:517,527,536](frontend/src/pages/Reception.tsx)
- **Issue:** Three native `alert(...)` calls in the PDF/document-download flow. Jarring, blocks the tab, unprofessional, flaky in iPad PWA mode. Inconsistent with the rest of the app's inline `.cfg-error` / `.login-error`.
- **Recommendation:** Replace with in-page toast/banner or local `setDocError(msg)` signal rendered inline.

### H-20 — Login error message masks 422 / 429 / 500
- **Agent:** UX
- **Location:** [frontend/src/pages/Login.tsx:48-50](frontend/src/pages/Login.tsx#L48-L50)
- **Issue:** Any non-2xx is shown as "Utilizator sau parola incorecta." Hides backend lockouts, validation, maintenance.
- **Recommendation:** Branch by status: `401/403 → "Utilizator sau parolă incorectă."`; `429 → "Prea multe încercări..."`; `≥500 → "Server indisponibil."`.

### H-21 — No `<Suspense>` / `createResource`; loading states inconsistent or missing
- **Agent:** UX
- **Location:** Only [HealthCheck.tsx:1,16](frontend/src/pages/HealthCheck.tsx) uses `createResource`. All other pages use `createSignal(loading=true)` + `onMount`; POS shows no loading state at all.
- **Issue:** POS [:79-84](frontend/src/pages/POS.tsx#L79-L84) fires parallel loaders but renders empty grid (no spinner/skeleton). Clienti shows text only — no `.skeleton`/`.spinner` class exists in `global.css`.
- **Recommendation:** Add minimal `.skeleton-card` CSS shimmer. Render N=6-12 skeletons in POS product grid until `products().length > 0`. Same for Clienti rows.

### H-22 — Clienti re-fetches on every keystroke (no debounce)
- **Agent:** UX
- **Location:** [frontend/src/pages/Clienti.tsx:405,412](frontend/src/pages/Clienti.tsx)
- **Issue:** Each character triggers `GET /api/clienti?limit=200&q=...`. 200 cashiers × 5-char queries = 1000 unnecessary requests.
- **Recommendation:** 250 ms debounce via `setTimeout(load, 250)`, clear on next keystroke.

### H-23 — Touch targets below 44 × 44 px on critical actions
- **Agent:** UX
- **Location:** Global `.btn-sm` at [global.css:193-196](frontend/src/styles/global.css#L193-L196) (~22 px tall), `.btn-icon:200` (~32 px); used in Clienti destructive `Șterge` and `✕` close buttons (POS:376, Clienti:494, NavBar:213)
- **Issue:** Tablet POS deployment with cashiers — misfires on destructive actions.
- **Recommendation:** `.btn-sm` `min-height: 36px`; `.btn-icon` `min-width:40px; min-height:40px`. Wrap destructive actions in larger hit-area variants.

### H-24 — Form inputs in Clienti / Configurari / HotelAnvelope have no `<label>` (placeholders only)
- **Agent:** UX
- **Location:** [Clienti.tsx:324-339, 357, 380-390](frontend/src/pages/Clienti.tsx); [Configurari.tsx](frontend/src/pages/Configurari.tsx); [HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx)
- **Issue:** Placeholders disappear on input; screen readers cannot announce field purpose; autofill cannot match. Login/AdminV2 use proper labels — inconsistent.
- **Recommendation:** Add `<label class="form-label" for="...">` for each input. Keep placeholders as hint only.

### H-25 — `:focus` removes outline without replacing with visible focus ring
- **Agent:** UX
- **Location:** [global.css:225-230, :922-923, :988-989, :1860-1861](frontend/src/styles/global.css)
- **Issue:** Keyboard navigation broken — only a 1 px border-color change indicates focus. Fails WCAG 1.4.11. No `:focus-visible` rule anywhere.
- **Recommendation:** Global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Remove blanket `outline:none` on inputs.

### H-26 — Data tables not wrapped for horizontal scroll on mobile
- **Agent:** UX
- **Location:** [AdminV2.tsx:1448](frontend/src/pages/AdminV2.tsx#L1448), [HotelAnvelope.tsx:2141,2393,2531](frontend/src/pages/HotelAnvelope.tsx)
- **Issue:** Inline `<table>` overflows viewport on 375 px; page-shell `overflow-x:hidden` truncates them.
- **Recommendation:** `.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}` utility class. Wrap each `<table>` in it.

---

## 🟡 Medium — Fix in next sprint

### M-01 — `filter` parameter accepts arbitrary JSON, no value validation
- **Agent:** Security
- **Location:** [backend/app/utils/filter.py:18-32](backend/app/utils/filter.py#L18-L32)
- **Issue:** Field names whitelisted (good) but values pass through untyped. Large JSON not capped → DoS. `password`/`is_deleted` columns could be filtered via `?filters={"password":"$2b$…"}`.
- **Recommendation:** Cap `filters_json` length to 2 KB. Reject non-scalar values. Explicit per-endpoint field whitelist.

### M-02 — No `TrustedHostMiddleware`; Host header injection
- **Agent:** Security
- **Location:** [backend/app/main.py](backend/app/main.py)
- **Issue:** `proxy_set_header Host $host;` in Nginx forwards attacker `Host: evil.com`. Can poison reset links / cache keys / absolute URLs.
- **Recommendation:** `app.add_middleware(TrustedHostMiddleware, allowed_hosts=os.getenv("ALLOWED_HOSTS","localhost").split(","))`. Pin Nginx `proxy_set_header Host` to canonical domain.

### M-03 — JWT decoder swallows all exceptions; combined with middleware masks bug-detection
- **Agent:** Security
- **Location:** [backend/app/middleware.py:30-45](backend/app/middleware.py#L30-L45); [backend/app/dependencies.py:17-18](backend/app/dependencies.py#L17-L18)
- **Issue:** `except Exception:` in JWT decode maps DB/network/KeyError to "Token invalid", masking real bugs.
- **Recommendation:** Narrow except to `jwt.PyJWTError, KeyError, ValueError`. Let everything else bubble to the middleware (which logs with `exc_info`).

### M-04 — `RegisterRequest.email` typed as `str | None`, no validation; SMTP injection vector
- **Agent:** Security
- **Location:** [backend/app/routers/auth.py:70](backend/app/routers/auth.py#L70)
- **Issue:** Any string accepted, including CRLF for SMTP-injection when passed to `_send_client_nou`.
- **Recommendation:** `email: EmailStr | None`. Reject `\r`/`\n` before passing to SMTP.

### M-05 — `email_settings` / `global_settings` authorization audit needed
- **Agent:** Security
- **Location:** [backend/app/routers/email_settings.py:41,56](backend/app/routers/email_settings.py)
- **Issue:** Response correctly scrubs `smtp_password`, but the update path needs explicit verification that no authenticated user can rewrite another tenant's SMTP credentials. `global_settings` should require super-admin.
- **Recommendation:** Audit every endpoint — depend on `get_account_id` AND `require_admin`, or scope updates to `WHERE account_id = current_account_id`.

### M-06 — Frontend `Content-Type: application/json` always set, breaks FormData
- **Agent:** Security
- **Location:** [frontend/src/utils/api.ts:6-9](frontend/src/utils/api.ts#L6-L9)
- **Issue:** Unconditional header. If a caller passes FormData, browser cannot set multipart boundary — request breaks. Future maintainers will bypass `apiFetch` for uploads, losing centralized auth attachment.
- **Recommendation:** Only set `Content-Type` when `options.body` is a string. Omit for FormData so the browser sets it correctly.

### M-07 — `DATABASE_URL` silently falls back to SQLite if env missing
- **Agent:** Performance
- **Location:** [backend/app/database.py:8](backend/app/database.py#L8)
- **Issue:** If `.env` is not mounted, backend silently runs against in-container SQLite, accepting writes that vanish on container restart.
- **Recommendation:**
  ```python
  DATABASE_URL = os.getenv("DATABASE_URL")
  if not DATABASE_URL:
      raise RuntimeError("DATABASE_URL is required")
  ```
  Gate dev fallback behind an explicit `BERLINSTAR_DEV_SQLITE=1` opt-in.

### M-08 — asyncpg pool overflow tuning
- **Agent:** Performance
- **Location:** [backend/app/database.py:10-14](backend/app/database.py#L10-L14)
- **Issue:** Current `pool_size=10, max_overflow=20` × 4 workers = 120 connections, fits under `max_connections=200`. Leaves limited headroom for backups/admin sessions.
- **Recommendation:** Reduce `max_overflow` to 10 (ceiling 80). Add `pool_timeout=30` so deadlock surfaces fast.

### M-09 — No Vite `manualChunks`; routes statically imported (not `lazy()`)
- **Agent:** Performance
- **Location:** [frontend/vite.config.ts:1-13](frontend/vite.config.ts#L1-L13); [frontend/src/App.tsx:8-18](frontend/src/App.tsx#L8-L18)
- **Issue:** All pages (POS, Reception, Configurari, Rapoarte, Clienti, HotelAnvelope, Programari, AdminV2) ship in one chunk on first paint. No vendor split — tiny app changes bust vendor cache.
- **Recommendation:** Use `lazy(() => import(...))` for routes. Add:
  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: { "solid-vendor": ["solid-js", "@solidjs/router"] },
      },
    },
    chunkSizeWarningLimit: 300,
  }
  ```

### M-10 — Alembic migration `drop_column casier` is destructive without backup step
- **Agent:** Code Quality
- **Location:** [backend/alembic/versions/j1k2l3m4n5o6_drop_casier_from_receipts.py:17](backend/alembic/versions/j1k2l3m4n5o6_drop_casier_from_receipts.py#L17)
- **Type:** PATTERN
- **Issue:** `op.drop_column('receipts', 'casier')` destroys data on upgrade; `downgrade()` recreates NOT NULL with `''` default, losing originals.
- **Recommendation:** For destructive prod migrations, copy data to backup table first, or two-step deploy (deploy code that ignores column → run migration). Add `# noqa: DESTRUCTIVE` marker convention.

### M-11 — `programare` list endpoint loads all rows then filters in Python
- **Agent:** Code Quality
- **Location:** [backend/app/routers/programare.py:104-114](backend/app/routers/programare.py#L104-L114)
- **Type:** BUG
- **Issue:** `q_lower in p.titlu.lower()` — no SQL push-down, no cursor pagination. Memory + DB hot-path at scale.
- **Recommendation:** Push search to SQL: `stmt.where(or_(Programare.titlu.ilike(f"%{q}%"), Programare.client.has(Client.nume.ilike(f"%{q}%"))))`. Add `limit/last_id` cursor pagination.

### M-12 — `productsStore`/`receiptsStore` swallow errors and serve stale cross-account cache
- **Agent:** Code Quality
- **Location:** [frontend/src/store/productsStore.ts:28-51](frontend/src/store/productsStore.ts#L28-L51), [frontend/src/store/receiptsStore.ts:139-141](frontend/src/store/receiptsStore.ts#L139-L141)
- **Type:** PATTERN
- **Issue:** On 401/500/timeout, catch-all sets `isOffline(true)` but never invalidates `bs_products_cache_v2`. A logged-out user opening POS sees the previous account's products from localStorage.
- **Recommendation:** On 401 clear caches and `logout()`. Namespace cache keys by `account_id`.

### M-13 — Heavy `: any` usage in PDF generation and admin
- **Agent:** Code Quality
- **Location:** [generateDocuments.ts](frontend/src/utils/generateDocuments.ts) (25 `any`), [Configurari.tsx](frontend/src/pages/Configurari.tsx) (15), [HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx) (10), [generateReceiptPdf.ts](frontend/src/utils/generateReceiptPdf.ts) (6), [hotelAnvelopeStore.ts](frontend/src/store/hotelAnvelopeStore.ts) (6), [Programari.tsx](frontend/src/pages/Programari.tsx) (5)
- **Type:** PATTERN
- **Issue:** PDF helpers type every jsPDF doc as `any` (defeats strict mode). API mappers (`mapFromApi(r: any)`) cast wire shapes with zero validation.
- **Recommendation:** Import `jsPDF` type. Define narrow `ApiReceipt` etc. DTOs mirroring FastAPI schemas. Replace `catch (e: any)` with `catch (e: unknown)` + narrow. Optional: zod at the network boundary.

### M-14 — `httpx.AsyncClient` instantiated per request
- **Agent:** Code Quality
- **Location:** [companies.py:68](backend/app/routers/companies.py#L68), [global_settings.py:122,150](backend/app/routers/global_settings.py)
- **Type:** PATTERN
- **Issue:** New connection pool per call — TCP handshake overhead on every POS Montare Roti modal open.
- **Recommendation:** Module-level `httpx.AsyncClient(timeout=10.0)` per backend process; lifecycle managed in FastAPI `lifespan`.

### M-15 — Broadcaster unbounded queue per listener
- **Agent:** Code Quality
- **Location:** [backend/app/broadcaster.py:12-14,31-33](backend/app/broadcaster.py)
- **Type:** BUG
- **Issue:** `asyncio.Queue()` no `maxsize`. Slow SSE consumer + busy POS day → unbounded RAM growth.
- **Recommendation:** `asyncio.Queue(maxsize=100)`. In `notify`, drop-oldest on full:
  ```python
  if q.full():
      try: q.get_nowait()
      except: pass
  q.put_nowait({"type": "receipts_changed"})
  ```

### M-16 — `notify` is `async` and `await`s `q.put` — couples writers to slowest SSE consumer
- **Agent:** Code Quality
- **Location:** [backend/app/broadcaster.py:31-38](backend/app/broadcaster.py#L31-L38)
- **Type:** PATTERN
- **Issue:** After applying maxsize fix, writers would block on full queues — POST/PATCH requests stall on slow listeners.
- **Recommendation:** Use `q.put_nowait` with drop-oldest. Make `notify` synchronous.

### M-17 — `--text-muted` palette fails WCAG AA on small text
- **Agent:** UX
- **Location:** [global.css:8, :25, :55](frontend/src/styles/global.css); usage at `.product-card-per:793`, `.login-powered:314 (0.6rem)`, `:1238 (0.68rem)`
- **Issue:** `#6c757d` on `#f8f9fa` is borderline (~4.5:1) and fails on `#ffffff` surface for 12 px. Many hints use `text-muted` + `font-size: 0.6–0.75rem` — 9.6 px at 0.6rem.
- **Recommendation:** Bump muted-on-light to `#5a6268`. Never combine `--text-muted` with `<0.75rem`.

### M-18 — Auth `createEffect` writes localStorage on every reactive read
- **Agent:** UX
- **Location:** [frontend/src/store/authStore.ts:25-32](frontend/src/store/authStore.ts#L25-L32)
- **Issue:** Every reactive read of `auth.user/token/isLocked/lockedAt` (very frequent: NavBar trial banner, many `Show when={auth.token}`) triggers a sync localStorage write — blocks main thread.
- **Recommendation:** Drop `createEffect`. Set localStorage only in `login()`/`logout()`.

### M-19 — `apiFetch` has no `try/catch`; network errors uncaught in many stores
- **Agent:** UX
- **Location:** [frontend/src/utils/api.ts:5-14](frontend/src/utils/api.ts#L5-L14)
- **Issue:** `cartStore`, `posHotelStore`, `resumeStore`, `themeStore` call `apiFetch` without `.catch` — silently broken offline.
- **Recommendation:** Return structured `{ ok, data, error }` from `apiFetch`, or document that all call sites must `.catch`.

### M-20 — `logout()` calls `localStorage.clear()` (wipes more than auth)
- **Agent:** UX
- **Location:** [frontend/src/store/authStore.ts:41](frontend/src/store/authStore.ts#L41)
- **Issue:** Clears product cache, employee view mode, cart, device, theme, AdminV2 token. Next user starts with cold cache and lost theme on a shared POS.
- **Recommendation:** Remove only `bs_auth` and AdminV2 token keys, not `clear()`.

### M-21 — Global click listener mounted on every NavBar render
- **Agent:** UX
- **Location:** [frontend/src/components/NavBar.tsx:78-79](frontend/src/components/NavBar.tsx#L78-L79)
- **Issue:** Runs on every click in the app; adds touch latency on mobile.
- **Recommendation:** Use `pointerdown`; gate with `if (!open()) return;`.

### M-22 — In-flight fetches not aborted on unmount
- **Agent:** UX
- **Location:** [Clienti.tsx:121](frontend/src/pages/Clienti.tsx#L121), [Rapoarte.tsx:110-119](frontend/src/pages/Rapoarte.tsx#L110-L119), AdminV2 lists
- **Issue:** Quick navigation races resolved fetches into unmounted components; subsequent loads can be clobbered.
- **Recommendation:** Pass `AbortSignal` from `onCleanup` to every heavy `apiFetch`.

### M-23 — SSE EventSource singletons stored as module state
- **Agent:** Code Quality
- **Location:** [frontend/src/store/receiptsStore.ts:309-318](frontend/src/store/receiptsStore.ts#L309-L318)
- **Type:** PATTERN
- **Issue:** Resource leak risk across SPA hot-reloads / multiple tabs.
- **Recommendation:** Verify all callers of `connectSSE` also call `disconnectSSE` on route change (`onCleanup`).

### M-24 — POS SSE reconnect not exponential (5s fixed)
- **Agent:** Code Quality
- **Location:** [frontend/src/store/receiptsStore.ts:326-332,365-372](frontend/src/store/receiptsStore.ts)
- **Type:** PATTERN
- **Issue:** Under outage with 200 users → thundering herd every 5 seconds.
- **Recommendation:** Exponential backoff with jitter: `min(60_000, 1000 * 2 ** attempt) + Math.random()*1000`. Reset on `onopen`.

---

## 🟢 Low — Nice to have

### L-01 — PostgreSQL backups committed to repo (PII / password hashes exposure)
- **Agent:** Security
- **Location:** `deploy/backup_Productie_*.sql` (seven files, 28 Mar – 29 Apr 2026)
- **Issue:** Real user data, password hashes (some legacy = base64), customer PII, vehicle plates. Anyone with repo access has a copy of the DB.
- **Recommendation:** `git filter-repo` to scrub, force-push, rotate all passwords and S3 keys. Add `deploy/backup_*.sql` to `.gitignore`. Move backups to private S3 with lifecycle expiry.

### L-02 — Logging convention not codified (auth fields could leak in logs)
- **Agent:** Security
- **Location:** [backend/app/logging_config.py](backend/app/logging_config.py), [backend/app/middleware.py](backend/app/middleware.py)
- **Issue:** No filter scrubs `Authorization` / `token=` from logs. A future log statement on `body.username` would land in plaintext logs.
- **Recommendation:** Document convention. Add logging filter for `Authorization` header values and `token=` query parameter.

### L-03 — `OAuth2PasswordBearer` token endpoint hidden but functional
- **Agent:** Security
- **Location:** [backend/app/routers/auth.py:121](backend/app/routers/auth.py#L121) (`include_in_schema=False`)
- **Issue:** Duplicate login surface to rate-limit and confuses log analytics.
- **Recommendation:** Either remove (Swagger Authorize rarely needed in prod) or rate-limit identically to `/login`.

### L-04 — `delete_image_by_url` silently swallows S3 errors
- **Agent:** Security
- **Location:** [backend/app/utils/storage.py:57-67](backend/app/utils/storage.py#L57-L67)
- **Issue:** Orphaned objects accumulate; GDPR concern when delete fails.
- **Recommendation:** Log at `error`, enqueue retry, track orphan-cleanup metrics.

### L-05 — Entrypoint Python `pg_isready` wait loop is redundant
- **Agent:** Performance
- **Location:** [deploy/entrypoint.sh:5-7](deploy/entrypoint.sh#L5-L7)
- **Issue:** `depends_on: condition: service_healthy` already gates startup; Python interpreter spin-up each iteration is slow.
- **Recommendation:** Remove the loop; trust compose healthcheck. Or `until pg_isready -h db -U "$POSTGRES_USER"; do sleep 1; done` (needs `postgresql-client`).

### L-06 — Alembic `upgrade heads` (plural) on every container start
- **Agent:** Performance
- **Location:** [deploy/entrypoint.sh:10](deploy/entrypoint.sh#L10)
- **Issue:** Plural is footgun if a feature branch accidentally creates a divergent revision.
- **Recommendation:** `alembic upgrade head` (singular) unless multiple branches are documented.

### L-07 — Postgres memory tuning conservative vs allocated 8G
- **Agent:** Performance
- **Location:** [deploy/docker-compose.yml:48-56, 57-61](deploy/docker-compose.yml)
- **Issue:** All reasonable for 200 users. Could reduce checkpoint frequency under POS write spikes.
- **Recommendation:** `-c max_wal_size=2GB -c min_wal_size=512MB`.

### L-08 — Broadcaster dict keys never cleaned when empty
- **Agent:** Performance
- **Location:** [backend/app/broadcaster.py:8-9, 16-19](backend/app/broadcaster.py)
- **Issue:** `_listeners` / `_pos_count` keys for `account_id` never popped when empty. Bounded by tenant count — negligible.
- **Recommendation:**
  ```python
  def unsubscribe(self, account_id, q):
      listeners = self._listeners.get(account_id, [])
      if q in listeners: listeners.remove(q)
      if not listeners: self._listeners.pop(account_id, None)
  ```

### L-09 — Frontend port 8080:80 exposed; TLS terminator not documented
- **Agent:** Performance
- **Location:** [deploy/docker-compose.yml:9-10](deploy/docker-compose.yml#L9-L10)
- **Issue:** README mentions Rockhost upstream stripping `/berlinstar/`, but TLS terminator + HSTS responsibility is not documented.
- **Recommendation:** Document the TLS terminator in `deploy/README.md`. Confirm `secure`+`SameSite=Lax` on auth cookies (after cookie migration).

### L-10 — Some endpoints lack explicit `response_model`
- **Agent:** Code Quality
- **Location:** [programare.py:73,117,137,149](backend/app/routers/programare.py), [companies.py:60](backend/app/routers/companies.py#L60), [email_settings.py:68,121](backend/app/routers/email_settings.py), [global_settings.py:39-99,106,132](backend/app/routers/global_settings.py)
- **Type:** PATTERN
- **Issue:** FastAPI honours Python return annotations but lacks OpenAPI/Swagger types and response validation/filtering.
- **Recommendation:** Add `response_model=...` on programare endpoints; create `UrlResponse` schema for upload endpoints.

### L-11 — `render_as_batch=True` is a SQLite-only flag retained in Alembic env
- **Agent:** Code Quality
- **Location:** [backend/alembic/env.py:30,39](backend/alembic/env.py)
- **Type:** PATTERN
- **Issue:** Signals codebase still supports SQLite (also in `database.py` fallback). For prod, SQLite must not be picked.
- **Recommendation:** Assert `DATABASE_URL.startswith("postgresql")` when `ENV=production`. Keep `render_as_batch=True` only when offline.

### L-12 — README missing at repo root and `/backend`; `/frontend/README.md` is boilerplate
- **Agent:** UX
- **Location:** Missing `/README.md`, `/backend/README.md`. Present: `/frontend/README.md` (generic Solid scaffold); `/deploy/README.md` useful; `/doc/pornire.md` exists.
- **Issue:** No description of architecture, trial system, admin protection, or document-numbering flow.
- **Recommendation:** Add `/README.md` (architecture + quickstart), `/backend/README.md` (Alembic, FastAPI routes, .env keys), beef up `frontend/README.md`.

### L-13 — `.env.example` missing in `/backend` and `/frontend`
- **Agent:** UX
- **Location:** Only `/deploy/.env.example` exists.
- **Issue:** Local-dev mode (uvicorn + vite) is the documented mode but has no `.env.example` for it. The deploy `DATABASE_URL=...@db:5432` is wrong for native dev.
- **Recommendation:** Add `/backend/.env.example` (`localhost:5432`, placeholders) and `/frontend/.env.example` (`VITE_BASE_PATH=/`).

### L-14 — POS deviz modal refetches 200 receipts every open
- **Agent:** UX
- **Location:** [frontend/src/pages/POS.tsx:386-405](frontend/src/pages/POS.tsx#L386-L405)
- **Issue:** `loadReceipts(undefined, undefined, 200)` on every modal open — 200 users × frequent opens = 40k receipts/min of network.
- **Recommendation:** Cache for ~10 s in `receiptsStore` or skip refetch if last load < 10 s ago.

### L-15 — NavBar admin-visibility modal closes on overlay click (contradicts project convention)
- **Agent:** UX
- **Location:** [frontend/src/components/NavBar.tsx:209](frontend/src/components/NavBar.tsx#L209) (`<div class="sl-modal-overlay" onClick={() => setShowAdminModal(false)}>`)
- **Issue:** Per project convention (memory), modals should not close on overlay click — only POS deviz modal and Clienti DeleteModal correctly enforce this.
- **Recommendation:** Remove `onClick` from `.sl-modal-overlay` in NavBar.

### L-16 — `aria-label` missing on most icon-only buttons
- **Agent:** UX
- **Location:** Only 6 `aria-label` instances in the entire frontend. Missing on `✕` close buttons (POS.tsx:376, Clienti.tsx:494, many modals).
- **Recommendation:** Add `aria-label="Închide"` to every `✕` button. Grep-and-edit pass.

### L-17 — QR code regenerated on every PDF render
- **Agent:** UX
- **Location:** [generateDocuments.ts:549-556](frontend/src/utils/generateDocuments.ts#L549-L556)
- **Issue:** Footer regenerates QR for `company.website` every call; `generateDevizPlusOperatii` calls N sub-generators that each regenerate it.
- **Recommendation:** Memoize in module-level `Map<string, string>` keyed by URL.

### L-18 — POS SSE reconnect on `CLOSED` works but lacks backoff (also noted M-24 for emphasis)
- **Agent:** Code Quality
- **Note:** Cross-reference with M-24. Listed once as M-24.

### L-19 — Sample of small low-priority polish items already captured in OK section as `confirmation`-style findings (see Verified OK).

---

## ✅ Verified OK

> Items explicitly checked and found correctly configured.

| # | Component | Agent | Note |
|---|-----------|-------|------|
| 1 | Persistent Postgres volume | Performance | `postgres_data` named volume mounted at `/var/lib/postgresql/data` (`docker-compose.yml:43,72-73`) |
| 2 | DB healthcheck via `pg_isready` | Performance | Interval 5s, retries 10; `depends_on: condition: service_healthy` correctly used (`docker-compose.yml:62-66`) |
| 3 | Static asset cache headers | Performance | `expires 1y; Cache-Control: public, immutable` + `access_log off` for static; HTML no-cache (`nginx.conf:46-51,41-44`) |
| 4 | Vite base-path handling for `/berlinstar/` | Performance | `VITE_BASE_PATH` build arg → Dockerfile → Vite + nginx alias + try_files (`vite.config.ts:5`, `frontend.Dockerfile:14-15`, `nginx.conf:54-57`) |
| 5 | jsPDF / jspdf-autotable / qrcode dynamic-imported | Performance | Code-split — only load when user generates a PDF (`generateDocuments.ts:438-443,549-552`; `generateReceiptPdf.ts:263-264`) |
| 6 | SSE disconnect cleanup; no DB session held across stream | Performance / Code Quality | `try/finally` calls `pos_disconnect`/`unsubscribe`; no `get_db` injected into SSE handler (`receipts.py:237-247,255-269`) |
| 7 | SSE Nginx config | Performance | `proxy_buffering off; proxy_cache off; proxy_read_timeout 3600s` (`nginx.conf:21-23,35-37`) |
| 8 | `client_max_body_size 20m` | Performance | Appropriate for image uploads (`nginx.conf:10`) |
| 9 | Resource limits realistic | Performance | Backend 4 CPU / 4G RAM, DB 2 CPU / 8G RAM — fits a single beefy node |
| 10 | `engine.dispose()` on shutdown | Performance | Graceful pool teardown in FastAPI `lifespan` (`main.py:25`) |
| 11 | DI for auth consistent across routers | Code Quality | Every router uses `Depends(get_account_id)` + `Depends(get_db)`; JWT decoded once per request via `OAuth2PasswordBearer` |
| 12 | Alembic `env.py` correctly uses async engine | Code Quality | `create_async_engine(DATABASE_URL) + connection.run_sync(do_run_migrations)` — canonical (`env.py:45-49`) |
| 13 | Recent migrations clean, additive, reversible | Code Quality | Sampled `zz8hh9ii0jj1_add_cuplu_strangere_*`, `zz9ii0jj1kk2_add_montare_roti_images.py` — schema-additive only, nullable, reversible |
| 14 | 500 path does not leak stack to client | Code Quality | Middleware returns `{"detail": "Eroare internă..."}`; stack logged only (`middleware.py:41-45`) |
| 15 | 422 responses use Pydantic default | Code Quality | Structured detail array (caveat: frontend renders it poorly — see H-18) |
| 16 | No infinite reactive loops in stores | Code Quality | `createEffect`s read/write only localStorage (not their own driving signal) (`authStore.ts`, `cartStore.ts`, `themeStore.ts`) |
| 17 | TypeScript `strict: true` enabled | Code Quality | + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` (`tsconfig.app.json:21-26`) |
| 18 | SMTP send offloaded via executor | Code Quality | `loop.run_in_executor(None, _smtp_send, ...)` (`email_service.py:66-73`) |
| 19 | Outbound HTTP uses `httpx.AsyncClient` (no `requests` import) | Code Quality | (`companies.py:68`, `global_settings.py:122,150`) |
| 20 | All DB queries use `await db.execute`/`get`/`commit` | Code Quality | Sampled auth, clienti, receipts, anvelope, cazare_anvelope, montaj_roti, programare |
| 21 | Pydantic schemas mirror ORM cleanly; ORM never returned directly | Code Quality | `*Read` schemas use `from_attributes=True`; complex serializers return dicts (`_serialize`) |

---

## Risk Matrix

| ID | Title | Severity | Agent | Deploy risk | Status |
|----|-------|----------|-------|-------------|--------|
| B-01 | JWT `SECRET_KEY` insecure default fallback | BLOCKER | Security / Code Quality | blocks deploy | ❌ Open |
| B-02 | Hardcoded admin passwords | BLOCKER | Security / Code Quality | blocks deploy | ❌ Open |
| B-03 | Real S3 secrets in `.env.example`; `.env` files committed | BLOCKER | Security / UX | blocks deploy | ❌ Open |
| B-04 | JWT in `localStorage` (XSS = takeover) | BLOCKER | Security / Code Quality | blocks deploy | ❌ Open |
| B-05 | PostgreSQL port 5432 published to host | BLOCKER | Security / Performance | blocks deploy | ❌ Open |
| B-06 | `/adminv2` route bypasses Protected/JWT | BLOCKER | UX | blocks deploy | ❌ Open |
| B-07 | No automated backups; last dump 15 days old | BLOCKER | Performance | blocks deploy | ❌ Open |
| C-01 | No HTTPS / TLS at the edge | CRITICAL | Security | before go-live | ❌ Open |
| C-02 | No security headers at Nginx | CRITICAL | Security | before go-live | ❌ Open |
| C-03 | No rate limiting on auth endpoints | CRITICAL | Security | before go-live | ❌ Open |
| C-04 | CORS allow_credentials + wildcard methods/headers | CRITICAL | Security | before go-live | ❌ Open |
| C-05 | Legacy base64 "hash" still accepted | CRITICAL | Security | before go-live | ❌ Open |
| C-06 | `list_anvelope` double-query waste | CRITICAL | Code Quality | before go-live | ❌ Open |
| C-07 | Sync boto3 blocks asyncio loop | CRITICAL | Code Quality | before go-live | ❌ Open |
| C-08 | No global 401 handling in frontend | CRITICAL | UX | before go-live | ❌ Open |
| C-09 | Login redirect loses requested URL | CRITICAL | UX | before go-live | ❌ Open |
| C-10 | PDF generation freezes UI in HotelAnvelope/POS | CRITICAL | UX | before go-live | ❌ Open |
| C-11 | Diacritics ASCII-stripped on Deviz/Factură/Chitanță | CRITICAL | UX | before go-live | ❌ Open |
| H-01 | JWT 30 days, no refresh/rotation | HIGH | Security | current sprint | ❌ Open |
| H-02 | Bcrypt cost not pinned; 6-char password min | HIGH | Security | current sprint | ❌ Open |
| H-03 | File-upload MIME trusts client | HIGH | Security | current sprint | ❌ Open |
| H-04 | Nginx 20m size limit not enforced in FastAPI | HIGH | Security | current sprint | ❌ Open |
| H-05 | S3 ACL=public-read; PII world-readable | HIGH | Security | current sprint | ❌ Open |
| H-06 | JWT decode swallows all exceptions; no account validity check | HIGH | Security | current sprint | ❌ Open |
| H-07 | JWT in URL query parameter | HIGH | Security | current sprint | ❌ Open |
| H-08 | `register` endpoint abuse vector | HIGH | Security | current sprint | ❌ Open |
| H-09 | Gunicorn missing `--max-requests`/`--preload` | HIGH | Performance | next sprint | ❌ Open |
| H-10 | Nginx gzip not enabled | HIGH | Performance | before go-live | ❌ Open |
| H-11 | Nginx `keepalive_timeout` missing; `ip_hash` redundant | HIGH | Performance | next sprint | ❌ Open |
| H-12 | `proxy_read_timeout 3600s` blanket on `/api/` | HIGH | Performance | next sprint | ❌ Open |
| H-13 | No backend / frontend healthcheck | HIGH | Performance | before go-live | ❌ Open |
| H-14 | `_serialize_anvelopa` chained N+1 risk | HIGH | Code Quality | next sprint | ❌ Open |
| H-15 | `Receipt.list_receipts` silently empty `cazari_anvelope` | HIGH | Code Quality | next sprint | ❌ Open |
| H-16 | No global FastAPI `@app.exception_handler` | HIGH | Code Quality | before go-live | ❌ Open |
| H-17 | Broadcaster single-process only | HIGH | Code Quality | before go-live | ❌ Open |
| H-18 | 422 errors render as `[object Object]` | HIGH | UX | current sprint | ❌ Open |
| H-19 | Raw `window.alert()` for critical feedback | HIGH | UX | current sprint | ❌ Open |
| H-20 | Login error message masks 422/429/500 | HIGH | UX | current sprint | ❌ Open |
| H-21 | No Suspense / skeletons; inconsistent loading | HIGH | UX | current sprint | ❌ Open |
| H-22 | Clienti search not debounced (keystroke storms) | HIGH | UX | current sprint | ❌ Open |
| H-23 | Touch targets <44 px on critical actions | HIGH | UX | current sprint | ❌ Open |
| H-24 | Form inputs missing `<label>` (Clienti/Configurari/HotelAnvelope) | HIGH | UX | current sprint | ❌ Open |
| H-25 | No visible `:focus-visible` ring | HIGH | UX | current sprint | ❌ Open |
| H-26 | Data tables not wrapped for horizontal scroll | HIGH | UX | current sprint | ❌ Open |
| M-01 | `filter` parameter no value validation / size cap | MEDIUM | Security | next sprint | ❌ Open |
| M-02 | No `TrustedHostMiddleware` | MEDIUM | Security | next sprint | ❌ Open |
| M-03 | Generic 500 + JWT swallow masks bug-detection | MEDIUM | Security | next sprint | ❌ Open |
| M-04 | `email` is `str | None`, SMTP-injection risk | MEDIUM | Security | next sprint | ❌ Open |
| M-05 | `email_settings`/`global_settings` authorization audit | MEDIUM | Security | next sprint | ❌ Open |
| M-06 | `Content-Type: application/json` always set | MEDIUM | Security | next sprint | ❌ Open |
| M-07 | SQLite fallback when `DATABASE_URL` missing | MEDIUM | Performance | before go-live | ❌ Open |
| M-08 | asyncpg pool overflow tuning | MEDIUM | Performance | next sprint | ❌ Open |
| M-09 | No Vite manualChunks; routes not `lazy()` | MEDIUM | Performance | next sprint | ❌ Open |
| M-10 | Destructive `drop_column casier` migration | MEDIUM | Code Quality | post-mortem | ❌ Open |
| M-11 | `programare` in-process post-filtering | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-12 | Stores serve stale cross-account cache on 401 | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-13 | Heavy `: any` usage in PDF/admin | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-14 | `httpx.AsyncClient` per request | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-15 | Broadcaster unbounded queue per listener | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-16 | `notify` awaits `q.put` — couples writers to slow consumer | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-17 | `--text-muted` fails WCAG AA on small text | MEDIUM | UX | next sprint | ❌ Open |
| M-18 | Auth `createEffect` writes localStorage on every read | MEDIUM | UX | next sprint | ❌ Open |
| M-19 | `apiFetch` has no try/catch; stores break offline | MEDIUM | UX | next sprint | ❌ Open |
| M-20 | `logout()` calls `localStorage.clear()` | MEDIUM | UX | next sprint | ❌ Open |
| M-21 | Global click listener; touch latency | MEDIUM | UX | next sprint | ❌ Open |
| M-22 | Fetches not aborted on unmount | MEDIUM | UX | next sprint | ❌ Open |
| M-23 | SSE singletons stored as module state | MEDIUM | Code Quality | next sprint | ❌ Open |
| M-24 | POS SSE reconnect not exponential | MEDIUM | Code Quality | next sprint | ❌ Open |
| L-01 | DB backups committed to repo (PII) | LOW | Security | before go-live | ❌ Open |
| L-02 | Logging convention not codified | LOW | Security | nice to have | ❌ Open |
| L-03 | Hidden `/auth/token` endpoint duplicate of `/login` | LOW | Security | nice to have | ❌ Open |
| L-04 | `delete_image_by_url` swallows errors | LOW | Security | nice to have | ❌ Open |
| L-05 | Entrypoint Python `pg_isready` wait loop redundant | LOW | Performance | nice to have | ❌ Open |
| L-06 | Alembic `upgrade heads` (plural) on every start | LOW | Performance | nice to have | ❌ Open |
| L-07 | Postgres `max_wal_size` not tuned | LOW | Performance | nice to have | ❌ Open |
| L-08 | Broadcaster dict keys never popped when empty | LOW | Performance | nice to have | ❌ Open |
| L-09 | TLS terminator not documented | LOW | Performance | nice to have | ❌ Open |
| L-10 | Some endpoints lack explicit `response_model` | LOW | Code Quality | next sprint | ❌ Open |
| L-11 | `render_as_batch=True` SQLite-only flag in env.py | LOW | Code Quality | next sprint | ❌ Open |
| L-12 | README missing at root and `/backend` | LOW | UX | nice to have | ❌ Open |
| L-13 | `.env.example` missing in `/backend` and `/frontend` | LOW | UX | nice to have | ❌ Open |
| L-14 | POS deviz modal refetches 200 receipts on open | LOW | UX | nice to have | ❌ Open |
| L-15 | NavBar admin modal closes on overlay (convention violation) | LOW | UX | nice to have | ❌ Open |
| L-16 | `aria-label` missing on `✕` close buttons | LOW | UX | nice to have | ❌ Open |
| L-17 | QR regenerated on every PDF render | LOW | UX | nice to have | ❌ Open |

---

## Action Plan

### Before deployment (BLOCKERs)
1. Remove `SECRET_KEY` fallback; require at startup — `backend/app/config.py:5` — Agent: Security
2. Move admin passwords to env vars or delete the dual-password gate — `backend/app/routers/admin.py:15-16` — Agent: Security
3. Rotate Hetzner S3 keys; scrub from `deploy/.env.example` (and git history); fix `.gitignore` — `deploy/.env.example` + `.env*` — Agent: Security
4. Move JWT from `localStorage` to httpOnly cookie (or shorten to 1 day + refresh as interim) — `frontend/src/store/authStore.ts`, `backend/app/dependencies.py` — Agent: Security
5. Remove `ports: 5432:5432` from db service in `docker-compose.yml` — Agent: Security
6. Wrap `/adminv2` route in `<Protected>` — `frontend/src/App.tsx:63` — Agent: UX
7. Add automated `pg_dump` cron + off-host (Hetzner S3) sync; remove SQL backups from repo — Agent: Performance

### Before go-live (CRITICALs)
1. Terminate TLS at Nginx (or document upstream Traefik/Rockhost terminator) + HSTS — `deploy/nginx.conf` — Agent: Security
2. Add 5 security headers to Nginx — `deploy/nginx.conf` — Agent: Security
3. Add `slowapi` rate limiting on `/auth/login`, `/auth/register`, `/auth/token`, `/admin/verify` — Agent: Security
4. Tighten CORS — whitelist methods/headers; validate `CORS_ORIGINS` at startup — `backend/app/main.py:35-41` — Agent: Security
5. Migrate legacy base64 password rows; remove fallback branch — `backend/app/utils/security.py:29-30` — Agent: Security
6. Delete double-query in `list_anvelope`; move `selectinload` to original `stmt` — `backend/app/routers/anvelope.py:55-69` — Agent: Code Quality
7. Wrap `boto3.put_object`/`delete_object` in `asyncio.to_thread` (or migrate to `aioboto3`) — `backend/app/utils/storage.py` — Agent: Code Quality
8. Add 401 interceptor in `apiFetch` → logout + redirect — `frontend/src/utils/api.ts` — Agent: UX
9. Preserve requested URL across login (`?from=` query) — `frontend/src/App.tsx`, `Login.tsx` — Agent: UX
10. Add `pdfLoading` signal + disabled buttons in HotelAnvelope; preload NotoSans-Ro at app boot — `frontend/src/utils/generateDocuments.ts`, `HotelAnvelope.tsx` — Agent: UX
11. Register NotoSans-Ro font in `generateDeviz`/`generateFactura`/`generateChitanta` — `frontend/src/utils/generateDocuments.ts:590,711,760` — Agent: UX

### Current sprint (HIGHs)
1. JWT refresh token rotation + access TTL 15-30 min + `iat`/`iss`/`aud` claims — `backend/app/config.py`, `auth.py`, `dependencies.py` — Agent: Security
2. Pin `bcrypt.gensalt(rounds=12)`; bump password min to 10 + common-pw blocklist — Agent: Security
3. Sniff upload bytes (magic numbers / `python-magic`); reject SVG — `backend/app/utils/storage.py` — Agent: Security
4. Stream-read uploads with size bail-out; lower Nginx `client_max_body_size` to 8m — Agent: Security
5. S3 bucket private; `ACL=private`; serve via presigned URL — `backend/app/utils/storage.py` — Agent: Security
6. Narrow JWT-decode except; load Account in dependency; check `is_deleted`/`is_locked` — `backend/app/dependencies.py` — Agent: Security
7. Replace `?token=` query auth with single-use SSE ticket — `backend/app/dependencies.py:25-26` — Agent: Security
8. Rate-limit `register`; normalize duplicate-username response — Agent: Security
9. Add Nginx gzip with `gzip_types` — `deploy/nginx.conf` — Agent: Performance
10. Add backend/frontend healthchecks + frontend depends_on backend — `deploy/docker-compose.yml` — Agent: Performance
11. Add global FastAPI exception handlers (IntegrityError → 409, OperationalError → 503) — `backend/app/main.py` — Agent: Code Quality
12. Lock broadcaster to `--workers 1` and document, or migrate to Redis pub/sub — `backend/app/broadcaster.py` — Agent: Code Quality
13. Centralize Pydantic-422 parser in `apiFetch`; field-level error mapping — Agent: UX
14. Replace `alert()` in Reception with inline error — Agent: UX
15. Branch login errors by status code — `Login.tsx:48-50` — Agent: UX
16. Add `.skeleton-card` + render skeletons in POS/Clienti — Agent: UX
17. Debounce Clienti search 250ms — Agent: UX
18. Bump `.btn-sm`/`.btn-icon` touch targets to ≥36/40 px — Agent: UX
19. Add `<label>` to all inputs in Clienti/Configurari/HotelAnvelope — Agent: UX
20. Add global `:focus-visible` rule; remove blanket `outline:none` — Agent: UX
21. Add `.table-wrap` utility class to all `<table>` elements — Agent: UX
22. Append `--max-requests 2000 --max-requests-jitter 200 --graceful-timeout 30 --preload` to Gunicorn — `deploy/entrypoint.sh` — Agent: Performance
23. Add Nginx `keepalive_timeout 65;` `keepalive_requests 1000;`; remove `ip_hash` — Agent: Performance
24. Split SSE location with `proxy_read_timeout 3600s`; rest of `/api/` at 60s — Agent: Performance
25. Refactor `_serialize_anvelopa` selectinload chain or set `lazy="selectin"` on Anvelopa relations — Agent: Code Quality
26. Add `selectinload(Receipt.cazari_anvelope)` to `list_receipts` — Agent: Code Quality

### Next sprint (MEDIUMs)
1. Cap `filter` JSON size + per-endpoint field whitelist — `backend/app/utils/filter.py` — Agent: Security
2. Add `TrustedHostMiddleware` — `backend/app/main.py` — Agent: Security
3. Narrow JWT-decode except to `jwt.PyJWTError, KeyError, ValueError` — Agent: Security
4. `email: EmailStr | None` + CRLF reject — `backend/app/routers/auth.py:70` — Agent: Security
5. Audit `email_settings`/`global_settings` authorization — Agent: Security
6. Conditional `Content-Type` in `apiFetch` — Agent: Security
7. Fail-fast on missing `DATABASE_URL` — `backend/app/database.py:8` — Agent: Performance
8. Tune asyncpg pool: `max_overflow=10`, `pool_timeout=30` — Agent: Performance
9. Add Vite `manualChunks` for solid-vendor; convert routes to `lazy()` — Agent: Performance
10. Document destructive-migration convention; runbook for `casier` drop — Agent: Code Quality
11. Push `programare` search to SQL + cursor pagination — Agent: Code Quality
12. Namespace localStorage cache keys by `account_id`; clear on 401 — Agent: Code Quality
13. Type jsPDF helpers; replace heavy `any` with narrow DTOs/zod — Agent: Code Quality
14. Module-level `httpx.AsyncClient` lifecycle in FastAPI lifespan — Agent: Code Quality
15. Broadcaster `Queue(maxsize=100)` with drop-oldest semantics; sync `notify` — Agent: Code Quality
16. Bump `--text-muted` light variant; never combine with <0.75rem — Agent: UX
17. Drop authStore `createEffect`; set localStorage only in login/logout — Agent: UX
18. Structured return type for `apiFetch` (`{ ok, data, error }`) — Agent: UX
19. Replace `localStorage.clear()` in logout with key-specific removal — Agent: UX
20. NavBar listener → `pointerdown`; gate `if (!open()) return;` — Agent: UX
21. Pass `AbortSignal` from `onCleanup` to heavy `apiFetch` calls — Agent: UX
22. Exponential backoff + jitter on SSE reconnect — Agent: Code Quality

### Nice-to-have (LOWs)
- `git filter-repo` SQL backups; rotate keys; gitignore `deploy/backup_*.sql`
- Codify logging filter for `Authorization`/`token=`
- Remove or rate-limit hidden `/auth/token` endpoint
- Log `delete_image_by_url` errors + retry queue
- Replace Python `pg_isready` loop with shell `pg_isready`
- `alembic upgrade head` (singular)
- Postgres `max_wal_size=2GB; min_wal_size=512MB`
- Pop empty broadcaster dict keys in `unsubscribe`
- Document TLS terminator in `deploy/README.md`
- Add `response_model=` on programare/upload endpoints
- Assert prod `DATABASE_URL.startswith("postgresql")`
- Write `/README.md` + `/backend/README.md`; beef up `/frontend/README.md`
- Add `/backend/.env.example` + `/frontend/.env.example`
- Cache receipts in `receiptsStore` (10s freshness window)
- Remove overlay-click handler from NavBar admin modal
- Add `aria-label="Închide"` to all `✕` buttons
- Memoize QR per website URL

---

## Finding counts

| Severity | Count |
|----------|-------|
| 🚨 BLOCKER | 7 |
| 🔴 CRITICAL | 11 |
| 🟠 HIGH | 26 |
| 🟡 MEDIUM | 24 |
| 🟢 LOW | 17 |
| ✅ OK | 21 |
| **Total findings** | **106** |

---

*Report generated by architecture review agents (Security, Performance & Infrastructure, Code Quality & Architecture, UX & Usability). All findings are based on static analysis and configuration review of the BerlinStar repository at branch `14MAI2026_RefactorCode`, commit `6a38e0f`, on 2026-05-14.*
