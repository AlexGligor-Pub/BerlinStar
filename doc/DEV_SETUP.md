# Dev Setup — BerlinStar

Note operaționale după batch-ul de fix-uri din `architecture_review_report.md`.
Aici sunt listate **toate** variabilele de env nou necesare, dependențele Python
adăugate și erorile tipice la pornire + remediile lor.

## Variabile de env obligatorii (backend)

Pune-le în `backend/.env` (sau în `deploy/.env` pentru Docker).

```dotenv
# Postgres (sau SQLite via BERLINSTAR_DEV_SQLITE — vezi mai jos)
DATABASE_URL=postgresql+asyncpg://user:parola@localhost:5432/berlinstar

# JWT signing key (32+ char). Fara fallback de cod.
SECRET_KEY=<32+ char random hex>

# CORS (lista CSV, fara wildcard *)
CORS_ORIGINS=http://localhost:2000,http://localhost:8080

# Trusted hosts (Host header injection guard) — default "*", restrange in prod
ALLOWED_HOSTS=localhost,127.0.0.1

# Admin verify (POST /api/admin/verify)
# Issue: marcate ca BLOCKER B-02 in architecture_review_report.md (parole din git history).
# Genereaza valori noi pentru productie.
ADMIN_PASSWORD_1=<rotate-me>
ADMIN_PASSWORD_2=<rotate-me>

# S3 / Hetzner Object Storage (rotate keys — BLOCKER B-03)
S3_ENDPOINT_URL=https://nbg1.your-objectstorage.com
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY=<rotate-me>
S3_SECRET_KEY=<rotate-me>
S3_PUBLIC_URL=https://<bucket>.<endpoint>
```

### Fallback SQLite în dev

`backend/app/database.py` nu mai are fallback automat la SQLite. Dacă vrei să
pornești fără Postgres:

```dotenv
BERLINSTAR_DEV_SQLITE=1
```

(și omite `DATABASE_URL` sau setează-l explicit la `sqlite+aiosqlite:///./berlinstar.db`)

Cu `BERLINSTAR_DEV_SQLITE=1`, `ADMIN_PASSWORD_*` devin opționale.

## Dependențe Python adăugate

Sunt în `backend/requirements.txt`:

- `email-validator>=2.2.0` — pentru `EmailStr` (Pydantic email field)
- `slowapi>=0.1.9` — rate limiting pe endpointurile de auth/admin

Instalare în venv-ul local:

```bash
backend/venv/bin/pip install -r backend/requirements.txt
```

Sau ad-hoc:

```bash
backend/venv/bin/pip install "slowapi>=0.1.9" "email-validator>=2.2.0"
```

## Erori tipice la pornire & remedii

### 1. `ModuleNotFoundError: No module named 'slowapi'`

Lipsește pachetul în venv.

```bash
backend/venv/bin/pip install -r backend/requirements.txt
```

### 2. `ModuleNotFoundError: No module named 'email_validator'`

Idem — instalează `requirements.txt`.

### 3. `RuntimeError: ADMIN_PASSWORD_1 si ADMIN_PASSWORD_2 sunt obligatorii.`

Adaugă în `backend/.env`:

```dotenv
ADMIN_PASSWORD_1=<value>
ADMIN_PASSWORD_2=<value>
```

Pentru bypass în dev (când nu te interesează `/api/admin/verify`):

```dotenv
BERLINSTAR_DEV_SQLITE=1
```

### 4. `RuntimeError: DATABASE_URL este obligatoriu.`

Setează `DATABASE_URL` în `.env` sau `BERLINSTAR_DEV_SQLITE=1`.

### 5. `RuntimeError: CORS_ORIGINS='*' is not allowed with allow_credentials=True.`

`CORSMiddleware` cu `allow_credentials=True` refuză wildcard. Listează explicit
originile (CSV):

```dotenv
CORS_ORIGINS=http://localhost:2000,http://localhost:8080
```

### 6. `429 Too Many Requests` la login/register

Rate limiter activ:
- `/api/auth/login`, `/api/auth/token` — 5/min per IP
- `/api/auth/register` — 5/h per IP
- `/api/admin/verify` — 3/min per IP
- global default — 60/min per IP

În dev, restart-ul procesului resetează counterele (storage in-memory).

## Pornire backend dev

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

## Pornire frontend dev

```bash
cd frontend
npm install
npm run dev
```

Vite dev server pe `http://localhost:2000`, proxy `/api` → `http://localhost:4000`.

## Verificări post-fix

### Type-check frontend

```bash
cd frontend
./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
```

### Sintaxă Python backend

```bash
python3 -m py_compile backend/app/main.py
```

## Modificări structurale relevante pentru migrare

1. **`backend/app/routers/admin.py`** — parolele citite din env. La prima
   pornire fără ele, procesul moare cu mesaj clar. Rotește-le pe prod (sunt în
   git history).

2. **`backend/app/utils/storage.py`** — `upload_image` / `upload_global_image` /
   `delete_image_by_url` sunt acum `async`. Toți callerii din routere folosesc
   `await`. Dacă adaugi un caller nou, NU uita `await`.

3. **`backend/app/broadcaster.py`** — `notify()` / `notify_pos_count()` sunt
   sync (nu mai await-ezi). Receipts router actualizat.

4. **`backend/app/dependencies.py`** — există acum și `get_current_account` care
   încarcă obiectul `Account` și verifică `is_deleted`. Folosește-l acolo unde
   ai nevoie de Account (nu doar de id).

5. **Gunicorn workers = 1** (`deploy/entrypoint.sh`) — broadcaster-ul SSE e
   in-memory; cu workers > 1 evenimentele nu se propagă între procese. Migrare
   la Redis pub/sub e necesară dacă vrei să scalezi.

6. **PostgreSQL nu mai e publicat la host** (`deploy/docker-compose.yml`). Pentru
   acces ad-hoc: `docker compose exec db psql -U $POSTGRES_USER`.

## Acțiuni manuale rămase (din raport)

Vezi `architecture_review_report.md` secțiunea BLOCKERs:

- B-01: rotește `SECRET_KEY` în prod
- B-02: rotește `ADMIN_PASSWORD_1`/`_2` (au fost în git history)
- B-03: rotește cheile S3, scrub-uie `deploy/.env.example` din git history (`git filter-repo`)
- B-04: migrare JWT la cookie httpOnly (necesită schimbare client + server)
- B-07: cron `pg_dump` + sync off-host
- C-01: certificat TLS la edge (Let's Encrypt / upstream Rockhost)
- C-05: data migration peste hash-urile base64 legacy (`utils/security.py:29`)
