# Pornire BerlinStar

## Ordine recomandata

1. Porneste mai intai **backend-ul**
2. Apoi porneste **frontend-ul**
3. Deschide http://localhost:2000 in browser

---

## Backend (FastAPI)

```bash
cd c:\Berlin\BerlinStar\backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 4000
```

- Backend: http://localhost:4000
- Swagger UI: http://localhost:4000/docs

---

## Frontend (SolidJS)

```bash
cd c:\Berlin\BerlinStar\frontend
npm run dev
```

- Frontend: http://localhost:2000

---

## Prima rulare (doar o data)

### Backend
```bash
cd c:\Berlin\BerlinStar\backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
py -m app.seed
```

### Frontend
```bash
cd c:\Berlin\BerlinStar\frontend
npm install
```

---

## Migratii baza de date

### Genereaza o migrare noua (dupa modificari in modele)
```bash
cd c:\Berlin\BerlinStar\backend
.venv\Scripts\activate
alembic revision --autogenerate -m "descriere_modificare"
```

### Aplica migrarile existente
```bash
alembic upgrade head
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

## Reset complet baza de date

Foloseste cand schema s-a schimbat incompatibil (ex: coloane NOT NULL adaugate).

> **Atentie:** Se pierd toate datele. Seed-ul le recreaza demo.

```bash
cd c:\Berlin\BerlinStar\backend
.venv\Scripts\activate

rem Opreste serverul uvicorn inainte!
del berlinstar.db

alembic upgrade head
py -m app.seed
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
