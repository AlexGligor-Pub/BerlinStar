# BerlinStar — Deployment pe VPS Hetzner (Ubuntu 22.04)

## Configurare inițială: IP direct, HTTP only

### 1. Instalare Docker pe server

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # adaugă userul tău la grupul docker
# Delogare și relogare pentru a aplica grupul
```

### 2. Clone repo pe server

```bash
git clone <repo-url> /opt/berlinstar
cd /opt/berlinstar
```

### 3. Configurare variabile de mediu

```bash
cd deploy
cp .env.example .env
nano .env   # completează POSTGRES_PASSWORD și SECRET_KEY
```

Generare SECRET_KEY sigur:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Modificare CORS în backend (obligatoriu înainte de build)

Editează `backend/app/main.py` și înlocuiește:
```python
allow_origins=["http://localhost:2000"],
```
cu:
```python
allow_origins=[os.getenv("CORS_ORIGINS", "http://localhost:2000")],
```
Și adaugă `import os` dacă nu există.

> **De ce?** CORS blochează requesturile browserului dacă origina nu e în lista permisă.
> `CORS_ORIGINS=http://46.224.120.225` este setat în `.env`.

### 5. Rulare

```bash
cd /opt/berlinstar/deploy
docker compose up -d --build
```

### 6. Verificare

```bash
docker compose ps          # toate serviciile să fie "running"
docker compose logs -f backend   # loguri backend în timp real
docker compose logs -f db        # loguri postgres
```

Testare API:
```bash
curl http://46.224.120.225/health        # → {"status":"ok"}
curl http://46.224.120.225/api/items     # → lista produse (sau 401 dacă auth e required)
```

### 7. Migrații bază de date (Alembic)

La primul deployment sau după schimbări de schema:
```bash
# Rulează alembic din containerul backend
docker compose exec backend alembic upgrade head
```

Dacă vrei să populezi cu date inițiale (seed):
```bash
docker compose exec backend python -m app.seed
```

---

## Arhitectura Docker

```
Internet (80/443)
      │
   Caddy  ── TLS automat (Let's Encrypt)
      │
   Frontend (nginx) ──/api/*──▶ Backend ──┬── PostgreSQL
                                :8000     │   (rețea internă)
                                          │        :5432
```

- Rețeaua `web`: Caddy + Frontend + Backend
- Rețeaua `internal`: Backend + PostgreSQL (izolată, neaccesibilă din exterior)
- Caddy este singurul serviciu care publică porturi către host (80, 443)
- PostgreSQL NU expune portul 5432 în afară
- Backend NU expune portul 8000 direct — doar prin Caddy → nginx

**Rutare:**
- Caddy termină TLS pentru `professorprime.ro` și face reverse-proxy la `frontend:80`
- nginx (containerul `frontend`) servește fișierele statice și dă proxy la
  `/api/*` și `/berlinstar/api/*` către `backend:8000`

> **Notă importantă:** FastAPI are deja prefix-ul `/api` în toate rutele sale
> (`/api/auth`, `/api/items`, etc.), deci nu se face strip la prefix.

**SSE (Server-Sent Events):**
`/api/receipts/events` și `/api/admin/assistant/chats/*/events` au
`proxy_read_timeout 3600s` + `proxy_buffering off` în `nginx.conf`, ca să nu se
bufereze streaming-ul.

---

## Domeniu + HTTPS

Certificatele sunt gestionate automat de Caddy (`deploy/Caddyfile`): adaugi
domeniul ca bloc de site, `reverse_proxy frontend:80`, apoi
`docker compose up -d caddy`. Nu există labels/entrypoints de configurat.

Actualizează și `CORS_ORIGINS` în `.env`:

```bash
CORS_ORIGINS=https://professorprime.ro
```

---

## Operații uzuale

```bash
# Oprire completă
docker compose down

# Oprire cu ștergere date postgres (ATENȚIE!)
docker compose down -v

# Rebuild un singur serviciu
docker compose up -d --build backend

# Intră în containerul backend
docker compose exec backend bash

# Backup bază de date
docker compose exec db pg_dump -U berlinstar berlinstar > backup_$(date +%Y%m%d).sql

# Restore bază de date
cat backup.sql | docker compose exec -T db psql -U berlinstar berlinstar
```

---

