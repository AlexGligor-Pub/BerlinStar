# Pornire BerlinStar

## Ordine recomandata

1. Porneste mai intai **backend-ul**
2. Apoi porneste **frontend-ul**
3. Deschide http://localhost:2000 in browser

---

## Backend — doua moduri de pornire

### Mod 1: Local din WSL cu autoreload (recomandat pentru dezvoltare)

DB-ul ruleaza in Docker, backendul ruleaza local cu `uvicorn --reload`.

**Pasi:**

```bash
# 1. Porneste doar DB-ul in Docker
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/deploy
docker compose up -d db

# 2. Activeaza venv si seteaza DATABASE_URL catre localhost
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/backend
source venv/bin/activate
export DATABASE_URL="postgresql+asyncpg://berlinstar:berlinstar_dev@localhost:5432/berlinstar"

# 3. Aplica migratiile (doar daca sunt schimbari noi)
alembic upgrade heads

# 4. Porneste serverul cu autoreload pe portul 4000
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

**Important:**
- Comanda `uvicorn` trebuie rulata din folderul `backend/`, NU din `backend/app/`
- `venv` trebuie activat altfel `uvicorn` nu e gasit
- In `deploy/.env`, `DATABASE_URL` foloseste hostul `db` (intern Docker). Pentru rulare locala trebuie inlocuit cu `localhost`

**Acces:**
- Backend: http://localhost:4000
- Swagger UI: http://localhost:4000/docs

---

### Mod 2: Totul in Docker

```bash
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/deploy
docker compose up -d --build backend
```

Comanda porneste automat si `db` ca dependinta.

**Comenzi utile:**
```bash
# Vezi log-urile live
docker compose logs -f backend

# Opreste
docker compose stop backend db

# Rebuild fortat (fara cache)
docker compose build --no-cache backend && docker compose up -d backend
```

---

## Frontend (SolidJS)

```bash
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/frontend
npm run dev
```

- Frontend: http://localhost:2000

---

## Prima rulare (doar o data)

### Backend
```bash
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://berlinstar:berlinstar_dev@localhost:5432/berlinstar"
alembic upgrade heads
python -m app.seed
```

### Frontend
```bash
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/frontend
npm install
```

---

## Migratii baza de date

### Genereaza o migrare noua (dupa modificari in modele)
```bash
cd /mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/backend
source venv/bin/activate
export DATABASE_URL="postgresql+asyncpg://berlinstar:berlinstar_dev@localhost:5432/berlinstar"
alembic revision --autogenerate -m "descriere_modificare"
```

### Aplica migrarile existente
```bash
alembic upgrade heads
```

### Rollback o migrare
```bash
alembic downgrade -1
```

### Vezi starea curenta
```bash
alembic current
alembic history
```

---

## Cont implicit dupa seed

| Camp    | Valoare      |
|---------|--------------|
| name    | Administrator |
| username | admin       |
| password | admin (base64: YWRtaW4=) |

---

## Structura API

| Prefix            | Descriere          |
|-------------------|--------------------|
| /api/accounts     | Conturi            |
| /api/themes       | Teme               |
| /api/categories   | Categorii          |
| /api/items        | Produse / Servicii |

### Parametri comuni pentru liste (GET)

| Parametru        | Tip      | Descriere                                      |
|------------------|----------|------------------------------------------------|
| `last_id`        | int      | Cursor pentru pagina urmatoare                 |
| `limit`          | int      | Numar rezultate (default 20, max 100)          |
| `q`              | string   | Cautare text liber (LIKE %q% pe camp name)     |
| `sort`           | string   | Sortare: `name`, `-price`, `-created_at` etc.  |
| `filters`        | JSON     | Filtre exacte: `{"currency":"EUR"}`            |
| `include_deleted`| bool     | Include si inregistrarile sterse (default false)|
