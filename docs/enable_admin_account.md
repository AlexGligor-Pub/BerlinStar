# Enable admin account

Cand backend-ul raspunde `Contul administrator nu este configurat.` la `POST /api/admin/verify`, lipseste din tabela `accounts` un rand cu `username='admin'` si `is_deleted=false`. Codul: [backend/app/routers/admin.py:59-60](../backend/app/routers/admin.py#L59-L60).

Coloana `password` din DB e doar placeholder — endpoint-ul `/admin/verify` verifica parolele din env vars `ADMIN_PASSWORD_1` / `ADMIN_PASSWORD_2`, nu hash-ul din DB.

## Comanda

Inlocuieste `<DB_NAME>` cu numele bazei (`berlinstar`, `berlinstar_restored`, etc.):

```bash
docker exec deploy-db-1 psql -U berlinstar -d <DB_NAME> -c \
  "INSERT INTO accounts (name, username, password, is_deleted, is_locked, created_at) \
   VALUES ('Administrator', 'admin', '\$2b\$12\$E1PkcnaFKSoAG.wvQiHwDeX.14nOlL/Jgdys8WkLG3Kqsl6Sg4X2S', false, false, now()) \
   RETURNING id, username, name;"
```

Exemple:

```bash
# Pe baza restaurata
docker exec deploy-db-1 psql -U berlinstar -d berlinstar_restored -c \
  "INSERT INTO accounts (name, username, password, is_deleted, is_locked, created_at) \
   VALUES ('Administrator', 'admin', '\$2b\$12\$E1PkcnaFKSoAG.wvQiHwDeX.14nOlL/Jgdys8WkLG3Kqsl6Sg4X2S', false, false, now()) \
   RETURNING id, username, name;"
```

## Verificare

```bash
docker exec deploy-db-1 psql -U berlinstar -d <DB_NAME> -c \
  "SELECT id, username, name, is_deleted FROM accounts WHERE username='admin';"
```

Trebuie sa apara un rand cu `is_deleted = f`.

## Daca admin exista dar e soft-deleted

```bash
docker exec deploy-db-1 psql -U berlinstar -d <DB_NAME> -c \
  "UPDATE accounts SET is_deleted=false WHERE username='admin';"
```

## Parole de login (UI admin)

Cele 2 parole cerute la `/api/admin/verify` se citesc din env vars (NU din DB):

- `ADMIN_PASSWORD_1` (default in [backend/.env](../backend/.env): `alexgligor`)
- `ADMIN_PASSWORD_2` (default in [backend/.env](../backend/.env): `ADASTools1`)

Pentru rotire: schimbi valorile in `backend/.env` (uvicorn local) sau `deploy/.env` (Docker) si repornesti backend-ul.

## Note pe productie

Pe productie, parolele admin DEV de mai sus NU functioneaza — sunt suprascrise de env-ul real. Vezi BLOCKER B-02 in [architecture_review_report.md](../architecture_review_report.md).
