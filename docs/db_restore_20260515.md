# DB Restore — 2026-05-15

Restore al backup-ului de productie intr-o baza paralela `berlinstar_restored` si comutarea aplicatiei pe ea. Baza veche `berlinstar` ramane intacta pentru rollback rapid.

## Context

- **Fisier backup:** `backup_Productie_20260514_205400.sql` (plain SQL, pg_dump 16.13, ~1.4 MB)
- **Owner in dump:** `berlinstar`
- **Versiune alembic in dump:** `b3c4d5e6f7a8` (`add_afiseaza_tehnician_deviz`)
- **Mediu:** Docker / WSL (`deploy/docker-compose.yml`)
- **Container DB:** Postgres 16-alpine, volum `postgres_data`

## Strategie

1. Baza veche `berlinstar` NU este atinsa (raman datele, alembic_version intactum).
2. Se creeaza `berlinstar_restored` din dump.
3. Se ruleaza `alembic upgrade head` pe `berlinstar_restored` pentru a aplica migratiile aparute dupa `b3c4d5e6f7a8`.
4. Se schimba `DATABASE_URL` din `deploy/.env` -> `berlinstar_restored`.
5. Se reporneste containerul backend.

## Pasi executati

```bash
# 1. Copiez backup-ul in containerul db
docker cp backup_Productie_20260514_205400.sql deploy-db-1:/tmp/backup.sql

# 2. Creez baza noua (owner = berlinstar)
docker compose -f deploy/docker-compose.yml exec -T db \
    psql -U berlinstar -d postgres -c \
    "CREATE DATABASE berlinstar_restored OWNER berlinstar;"

# 3. Restore (plain SQL -> psql)
docker compose -f deploy/docker-compose.yml exec -T db \
    psql -U berlinstar -d berlinstar_restored -f /tmp/backup.sql

# 4. Update deploy/.env: DATABASE_URL ... /berlinstar -> /berlinstar_restored

# 5. Alembic upgrade (din containerul backend, dupa restart)
docker compose -f deploy/docker-compose.yml restart backend
docker compose -f deploy/docker-compose.yml exec backend alembic upgrade head
```

## Cum revenim (ROLLBACK)

**Cazul 1 — vrem inapoi pe baza veche imediat:**

In `deploy/.env`, schimba DATABASE_URL inapoi pe `/berlinstar`:

```
DATABASE_URL=postgresql+asyncpg://berlinstar:berlinstar_dev@db:5432/berlinstar
```

Apoi:

```bash
docker compose -f deploy/docker-compose.yml restart backend
```

Baza `berlinstar_restored` ramane in container ca referinta — o poti sterge ulterior:

```bash
docker compose -f deploy/docker-compose.yml exec -T db \
    psql -U berlinstar -d postgres -c "DROP DATABASE berlinstar_restored;"
```

**Cazul 2 — backup-ul restore a esuat la jumatate:**

Sterge baza partial creata si reia:

```bash
docker compose -f deploy/docker-compose.yml exec -T db \
    psql -U berlinstar -d postgres -c "DROP DATABASE IF EXISTS berlinstar_restored;"
```

**Cazul 3 — alembic upgrade a stricat schema:**

Baza veche `berlinstar` este neatinsa — schimba DATABASE_URL inapoi (Cazul 1).

## Update ulterior — backend local + port expus

Pentru ca backendul local (uvicorn din venv) sa ajunga la DB s-au mai facut:

1. **`deploy/docker-compose.override.yml`** — expune `5432:5432` pe host (compose-ul de baza nu publica portul; politica B-05). Override-ul e activ doar daca-l pasezi cu `-f`: `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.override.yml ...`.
2. **`backend/.env`** — `DATABASE_URL` schimbat pe `.../berlinstar_restored` (analog cu `deploy/.env`).
3. **Alembic local** — rulat `alembic upgrade head` din venv (codul curent are 6 migratii mai noi decat imaginea Docker veche): aplicate `zz6ff7gg8hh9 → zz7 → zz8 → zz9 → mr01reports001 → mr02empdaily_loc`. Tabele noi: `report_runs`, `report_employee_daily`, `report_receipts_daily`, `report_receipts_breakdown_daily`.

Rollback pentru backend local: in `backend/.env` decomenteaza linia veche `.../berlinstar`. NU re-downgrade-uiesti migratiile (sunt aditive, nu strica baza veche).

## Note

- Volumul `postgres_data` contine ambele baze (`berlinstar` + `berlinstar_restored`). Nu sterge volumul.
- Migrarea aplicata peste dump (delta dupa `b3c4d5e6f7a8`) include intregul lant pana la `mr02empdaily_loc`. Lista completa: `ls backend/alembic/versions/`.
- Imaginea `deploy-backend` (Docker) e tot cea de 4 zile, fara codul de reports. Pentru a o sincroniza: `docker compose -f deploy/docker-compose.yml build backend` + restart.
