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
Internet (port 80)
      │
   Traefik
   /      \
  /        \
Frontend  Backend ──── PostgreSQL
(nginx)  (uvicorn)    (rețea internă)
           :8000          :5432
```

- Rețeaua `web`: Traefik + Frontend + Backend
- Rețeaua `internal`: Backend + PostgreSQL (izolată, neaccesibilă din exterior)
- PostgreSQL NU expune portul 5432 în afară
- Backend NU expune portul 8000 direct — doar prin Traefik

**Rutare Traefik:**
- `http://46.224.120.225/` → Frontend (nginx, fișiere statice)
- `http://46.224.120.225/api/*` → Backend (FastAPI pe port 8000)

> **Notă importantă:** FastAPI are deja prefix-ul `/api` în toate rutele sale
> (`/api/auth`, `/api/items`, etc.), deci Traefik **nu face strip** la prefix.
> Calea completă este forwardată ca atare.

**SSE (Server-Sent Events):**
Traefik este configurat cu `flushinterval=-1` pe serviciul backend pentru
a nu buffera răspunsurile streaming de la `/api/receipts/events`.

---

## Mai târziu: Adăugare domeniu + HTTPS cu Let's Encrypt

### 1. Actualizează `.env`

```bash
SERVER_IP=berlinstar.ro   # sau domeniu.tău.ro
```

Asigură-te că DNS-ul domeniului pointează la IP-ul serverului înainte de continuare.

### 2. Decomentează configurarea HTTPS în `docker-compose.yml`

```yaml
traefik:
  command:
    # ... păstrează ce există și adaugă:
    - "--entrypoints.websecure.address=:443"
    - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
    - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
    - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
  ports:
    - "443:443"
  volumes:
    - "letsencrypt:/letsencrypt"
```

### 3. Adaugă labels HTTPS la frontend și backend

```yaml
# Frontend
- "traefik.http.routers.frontend-secure.rule=Host(`berlinstar.ro`)"
- "traefik.http.routers.frontend-secure.entrypoints=websecure"
- "traefik.http.routers.frontend-secure.tls.certresolver=letsencrypt"
# Redirect HTTP → HTTPS
- "traefik.http.routers.frontend.middlewares=redirect-to-https"
- "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
```

```yaml
# Backend
- "traefik.http.routers.backend-secure.rule=Host(`berlinstar.ro`) && PathPrefix(`/api`)"
- "traefik.http.routers.backend-secure.entrypoints=websecure"
- "traefik.http.routers.backend-secure.tls.certresolver=letsencrypt"
```

### 4. Decomentează volumul `letsencrypt:` la finalul fișierului

```yaml
volumes:
  postgres_data:
  letsencrypt:
```

### 5. Actualizează CORS_ORIGINS

```bash
# în .env
CORS_ORIGINS=https://berlinstar.ro
```

### 6. Restart

```bash
docker compose up -d --build
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
