# Audit performanta & baza de date — BerlinStar backend

Repo: `/mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar` (branch `feat/utilizatori-roluri`, HEAD `6becd02`).
Metoda: audit static, read-only (fara conexiune la DB, fara rulare). Toate afirmatiile sunt verificate in cod, cu `fisier:linie`; ce nu a putut fi verificat e marcat explicit.

Severitati: **Critical / High / Medium / Low**. Efort: **S** (< 0,5 zi) / **M** (1-2 zile) / **L** (> 2 zile).

---

## 0. Rezumat executiv

Arhitectura de baza e sanatoasa: engine **async** (`asyncpg`), pool configurat cu `pool_pre_ping`, `expire_on_commit=False`, o sesiune per request, rapoarte servite din tabele pre-agregate zilnice reconstruite de un scheduler, SSE fara conexiune DB tinuta deschisa. Commit-urile recente (`6becd02`, `fc92708`) sunt confirmate in cod.

Problemele ramase sunt in principal de **concurenta/integritate** (numerotare facturi fara lock si fara unique, stoc read-modify-write fara lock, tranzitii de plata fara lock), cateva **liste fara limita**, **cursor pagination incorecta la clienti**, o **operatie CPU-blocking pe event loop** (bcrypt la login) si limite structurale de scalare (**1 singur worker gunicorn**, broadcaster/rate-limiter in memorie, joburi grele rulate in procesul web).

**Nota generala: 6,5 / 10.**

---

## 1. Engine / sesiune / configurare

### Verificat (OK)
- Engine async `create_async_engine(..., echo=False, pool_size=10, max_overflow=10, pool_pre_ping=True, pool_recycle=3600, pool_timeout=30)` — `backend/app/database.py:19-29`.
- `async_sessionmaker(expire_on_commit=False)` — `database.py:31-35`; `get_db` = o sesiune per request — `database.py:38-40`.
- SSE **nu** tine conexiune din pool: `get_account_id_from_query` deschide si inchide local sesiunea — `backend/app/dependencies.py:145-150`; stream-ul SSE nu are `Depends(get_db)` — `backend/app/routers/receipts.py:522-573`. Comentariul de la `dependencies.py:129-133` explica corect motivul. Acelasi pattern si la asistent AI — `backend/app/routers/admin_assistant.py:74-94`.
- Health check face `SELECT 1` intr-o sesiune scurta — `backend/app/main.py:172-183` (rulat de Docker la 15s — `deploy/docker-compose.yml:75-82`; cost neglijabil).
- I/O blocant scos din event loop: SMTP prin `run_in_executor` (`backend/app/utils/email_service.py:53-69`), S3 via `asyncio.to_thread` (`backend/app/utils/storage.py:63,109,121`, `backend/app/subscriptions/invoice_service.py:421-422,455,573`), Stripe (`stripe_service.py:202`).
- httpx `AsyncClient` partajat la nivel de aplicatie — `main.py:35-43`.

### Probleme

**[High] Un singur worker gunicorn; broadcaster, rate-limiter si login-throttle sunt in memorie**
`deploy/entrypoint.sh:13-24` (`-w 1`, `--worker-connections 1000`), `backend/app/broadcaster.py:14-65` (dict in-process), `backend/app/rate_limit.py:5-7` (slowapi in-memory), `backend/app/utils/login_throttle.py:41-42` (dict + `threading.Lock`).
Consecinta: intreaga aplicatie (API + SSE + 2 schedulere APScheduler + joburi de rapoarte + bcrypt) ruleaza pe **un singur core**, iar limita `cpus: "4"` din compose (`docker-compose.yml:70-74`) e in mare parte nefolosita. Orice bucla CPU (serializare Pydantic pe liste mari, bcrypt, lxml la eFactura) blocheaza toate cererile.
Fix (M): Redis pentru pub/sub broadcaster + `storage_uri` slowapi + throttle; apoi `-w 2..4`. Pana atunci, cel putin muta CPU-bound in `to_thread` (vezi §4 bcrypt).

**[Medium] Pool 10+10 = 20 conexiuni vs. `max_connections=200` in Postgres si `--worker-connections 1000`**
`database.py:20`, `deploy/docker-compose.yml:99-110`, `entrypoint.sh:20`. Cu 1 worker, max 20 conexiuni simultane; la varf, cererile 21+ asteapta `pool_timeout=30s` si apoi primesc eroare. Postgres e supra-provizionat (200 conexiuni × `work_mem=16MB` potential). Nu e un bug, dar e nealiniat: daca se trece la N workeri, `N × 20` trebuie sa ramana sub `max_connections` — sau se pune **pgbouncer** (transaction pooling) intre ele.
Fix (S): documenteaza si aliniaza; adauga `connect_args={"server_settings": {"application_name": "berlinstar", "statement_timeout": "30000"}}` — in prezent **nu exista** niciun `statement_timeout`/`connect_args` (grep pe `app/` nu returneaza nimic), deci un query scapat de sub control blocheaza o conexiune nelimitat.

**[Low] `RequestLoggingMiddleware` e `BaseHTTPMiddleware`** — `backend/app/middleware.py:65-104`. Adauga overhead per request (un task + wrap al body-ului) si e cunoscut ca problematic cu streaming/`request.is_disconnected()`. Cu fastapi>=0.115 (`requirements.txt:1`) functioneaza, dar un middleware ASGI pur (ca `PathNormalizationMiddleware`, `middleware.py:13-41`) ar fi mai ieftin. Efort S.

**[Low] `autoheal` + `--timeout 600`**: `entrypoint.sh:21` seteaza timeout gunicorn 600s; cu `UvicornWorker` timeout-ul gunicorn e practic heartbeat, deci OK; `timeout_graceful_shutdown=15` in `backend/app/gunicorn_worker.py:23` e corect pentru SSE.

---

## 2. Pattern-uri de interogare

### Verificat (OK)
- Listarea bonurilor: `selectinload` pe items/employee/client (`receipts.py:375-381`) + relatii `lazy="selectin"` in model (`backend/app/models/receipt.py:88-93`) + eFactura incarcat batched cu `IN` (`receipts.py:292-301, 446`). Nu e N+1 (≈5-6 query-uri per pagina, independent de N).
- Cazari: `_load_stmt` cu `selectinload` in adancime (`backend/app/routers/cazare_anvelope.py:126-145`) + `_fetch_successor_map` batched (`:50-66, :192`).
- Stoc batch-uit la vanzare: `_get_or_create_stocks` un singur SELECT `IN` (`backend/app/services/stock.py:36-51`), `cost_map` un singur SELECT (`stock.py:126-128`). Confirmat commit `6becd02`.
- Rapoartele citesc din tabele agregate `report_*_daily` cu filtre `account_id + report_date BETWEEN` (`backend/app/routers/reports.py:100-115, 1105-1121, 1550-1564`) — indexate (`models/report_*_daily.py`).
- Pagination cursor `limit+1` uniform via `utils/paginate.py:9-23` si `apply_sort` cu tiebreaker `id` (`utils/sort.py:90-113`).

### Probleme

**[Medium] N+1 la creare/editare bon: `_resolve_item_link` per linie**
`receipts.py:486-489` (create) si `:740-743` (patch content) apeleaza `_resolve_item_link` in `for it in body.items`, care face un SELECT pe `items` (`receipts.py:77-83`) pentru fiecare linie fara `item_id`/`item_type`. Un bon cu 20 linii = 20 round-trip-uri. Query-ul filtreaza `Item.account_id, Item.name, Item.is_deleted` — **fara index pe `(account_id, name)`** (`models/item.py:21-24` are doar `account_id,is_deleted,id` / `category_id` / `type`).
Fix (S): un singur `SELECT id, type, name FROM items WHERE account_id=:a AND name IN (...) AND is_deleted=false` inainte de bucla + index `(account_id, name) WHERE is_deleted = false`.

**[Medium] Liste fara limita / fara paginare**
- `GET /api/leaves` — `backend/app/routers/leaves.py:308-352`: fara `limit`, fara cursor; `date_from/date_to` optionale; `q` face `ilike` pe `notes` + `EXISTS employees.name ilike`. Creste liniar cu istoricul de concedii al contului.
- `GET /api/programari` — `backend/app/routers/programare.py:74-114`: fara `limit`; daca UI nu trimite `date_from/date_to`, intoarce **toate** programarile contului cu relatii eager.
- `GET /api/stocuri` — `backend/app/routers/stocuri.py:29-72`: toate produsele contului (acceptabil pentru un catalog, dar fara plafon).
- `GET /api/clienti/vehicole-by-plate` — `clienti.py:80-113`: fara limit (filtru pe placuta exacta normalizata; low risk).
- `GET /api/reports/items-catalog` — `reports.py:620-637`: tot catalogul (acceptabil).
Fix (S fiecare): `limit: int = Query(200, le=1000)` + cursor `id`, sau cel putin `date_from/date_to` obligatorii.

**[Medium] Cursor pagination incorect la clienti (cursor pe `id`, ORDER BY `nume`)**
`clienti.py:37-38` (`Client.id > last_id`) vs `clienti.py:62` (`order_by(Client.nume, Client.id)`). Keyset-ul trebuie sa reflecte ordinea: cu ordonare pe nume, `id > last_id` **sare peste** clientii cu id mai mic si nume mai mare si repeta altii. Corectitudine + performanta (Postgres nu poate folosi un index pentru a rezolva ambele).
Fix (S): cursor compus `(nume, id) > (:last_nume, :last_id)` (row comparison) + index `(account_id, nume, id) WHERE is_deleted=false`.

**[Medium] Cautari `ilike '%q%'` fara index trigram**
`receipts.py:389` (titlu), `:393` (`EXISTS receipt_items.name ilike`), `clienti.py:42-43,51,56`, `programare.py:105-110`, `leaves.py:343-347`, `stocuri.py:60`. Toate sunt seq-scan (sau index-scan pe account + filter). Pe `receipts` si `receipt_items` (tabelele mari) costul creste liniar.
Fix (S/M): extensia `pg_trgm` + `CREATE INDEX ... USING gin (titlu gin_trgm_ops)` pe `receipts.titlu`, `receipt_items.name`, `clienti.nume`.

**[Medium] `ORDER BY coalesce(updated_at, created_at) DESC` pe lista de bonuri**
`receipts.py:435-438` (`sort=-activity`, folosit de UI-ul de receptie). Expresia nu e indexata; Postgres trebuie sa citeasca toate bonurile contului care trec de filtre si sa faca top-N sort. Filtrul `unpaid_days` (`:409-431`) combina `OR` intre interval de date si `pay_method IN (...)`, greu de servit de un singur index.
Fix (S): coloana generata / index pe expresie: `CREATE INDEX ix_receipts_account_activity ON receipts (account_id, (COALESCE(updated_at, created_at)) DESC, id DESC) WHERE is_deleted = false;` + index partial `(account_id, created_at) WHERE pay_method IN ('NEPLATIT','PARTIAL') AND is_deleted=false` pentru fereastra "neplatit recent".

**[Medium] `_refresh_accumulations`: `extract(year/month)` non-sargabil + UPDATE per angajat**
`receipts.py:163-190`: filtreaza `extract("year", created_at)` / `extract("month", ...)` (nu foloseste indexul `(account_id, created_at)`), apoi face un `UPDATE employees` **per angajat** in bucla (`:185-190`). Se apeleaza la **fiecare** create/patch/delete/convert (`receipts.py:505, 645, 769, 1008, 1083`). Pe un cont cu multe bonuri, fiecare salvare re-agrega toata luna pentru angajatii de pe bon.
Fix (S): interval `created_at >= first_of_month AND created_at < first_of_next_month`; un singur `UPDATE ... FROM (VALUES ...)`. Alternativ (M): calculeaza `current_target_accumulation` din `report_employee_daily` la citire si renunta la coloana denormalizata.

**[Low] `db.expire_all()` + reload complet dupa commit** — `receipts.py:772-780, 809-818`; `db.refresh` in bucla — `backend/app/routers/montaj_roti.py:248-249` (N refresh-uri dupa un commit; cu `expire_on_commit=False` nu e necesar). Efort S.

**[Low] N+1 in admin: `admin_subscription.py:283-295`** — pentru fiecare cont, 2 SELECT-uri (subscription + last payment). Endpoint de admin, paginat; impact mic. Fix S: `LEFT JOIN LATERAL` sau `selectinload`.

**[Low] `apply_filters` accepta egalitate pe orice coloana a modelului** — `backend/app/utils/filter.py:61-84`. Filtrele pe coloane neindexate se transforma in scan pe `account_id` + filter. Acceptabil in tenant, dar de tinut minte.

**[Low] `add_payment` incarca lista de plati de 3 ori** — `backend/app/services/payments_service.py:165, 168, 192`. Efort S.

---

## 3. Indexuri

### Verificat (OK)
- FK-urile fierbinti sunt indexate dupa `idx01` (`backend/alembic/versions/idx01_fk_hot_indexes.py:20-28`): `receipts(account_id, created_at)`, `receipts.client_id`, `receipts.location_id`, `receipt_items.employee_id/item_id`, `cazari_anvelope.client_id/employee_id`, `programari.client_id`.
- `receipt_items.receipt_id` (`ef13`), indexuri partiale `parent_receipt_id`/`programare_id` (`ef14`, `models/receipt.py:26-33`).
- `user_sessions.jti UNIQUE` (`models/user.py:90`) — critic, folosit la **fiecare** request (`backend/app/auth_context.py:91-101`).
- `stocks UNIQUE(item_id, location_id)` (`models/stock.py:11`) + `(account_id, location_id, item_id)`.
- `stock_movements` pe `(account_id|location_id|item_id, created_at)` + `receipt_id` (`models/stock_movement.py:20-23`).
- Tabelele `report_*_daily` pe `(account_id, report_date)` + dimensiuni.

### Lipsuri

| # | Tabel / coloane | Unde e folosit | Sev | Efort |
|---|---|---|---|---|
| I1 | `receipts (account_id, factura_serie, factura_nr) UNIQUE WHERE factura_nr > 0` (idem `deviz_*`, `chitanta_*`) | numerotare `receipts.py:867-888` | **Critical** (integritate; vezi §4) | S |
| I2 | `items (account_id, name) WHERE is_deleted=false` | `_resolve_item_link` `receipts.py:77-83` | Medium | S |
| I3 | `receipts` expresie `(account_id, COALESCE(updated_at,created_at) DESC)` partial `is_deleted=false` | `receipts.py:435-438` | Medium | S |
| I4 | `receipts (account_id, created_at) WHERE pay_method IN ('NEPLATIT','PARTIAL')` | `receipts.py:409-431` | Medium | S |
| I5 | `receipts (account_id, pay_method, created_at)` sau `(account_id, source, created_at)` | filtre `source`, `pay_method` in lista + builder `WHERE source <> 'fdl'` | Low | S |
| I6 | `efactura_records (receipt_id, direction)` | `receipts.py:295-300, 305-310` la fiecare serializare / lock check | Medium | S |
| I7 | `efactura_records (status)` partial `WHERE status IN ('pending_upload','in_prelucrare')` | joburi `efactura/scheduler.py:120-126, 158-164` | Low | S |
| I8 | `clienti (account_id, nume, id) WHERE is_deleted=false` + trigram pe `nume`, `cui` | `clienti.py:36-62` | Medium | S |
| I9 | `pg_trgm` GIN pe `receipts.titlu`, `receipt_items.name` | `receipts.py:389, 393` | Medium | S |
| I10 | `leaves (account_id, start_date, end_date)` sau GiST `daterange` | `leaves.py:337-340` (`end_date >= :from AND start_date <= :to`) | Low | S |
| I11 | `user_sessions (user_id, expires_at)` / `(expires_at)` | curatare sesiuni expirate (nu exista inca, vezi §7) | Low | S |
| I12 | `receipt_payments (receipt_id, is_deleted, paid_at)` | `payments_service.py:72-81` | Low | S |
| I13 | `email_logs (account_id, sent_at)` | listare istoric email (verifica `email_settings.py`) — *neverificat* | Low | S |

Observatie: **verifica** ca migratiile chiar creeaza `models/efactura/models.py:66-68` indexurile pentru `EFacturaRecord` — grep pe `ef07` nu a fost facut linie cu linie (*neverificat*).

---

## 4. Tranzactii & concurenta

**[Critical] Numerotarea documentelor (deviz/factura/chitanta) nu e serializata si nu are unique**
`receipts.py:862-888`: `register = await db.get(Register, ...)` (fara `with_for_update`), `new_nr = reg_numar + 1`, `setattr(register, ..., new_nr)`, `commit`. Doua cereri concurente pe acelasi registru (2 casieri, dublu-click, retry de retea) citesc acelasi `factura_numar` si emit **acelasi numar de factura** pe doua bonuri. Nu exista `UniqueConstraint` pe `(account_id, factura_serie, factura_nr)` (`models/receipt.py:21-33, 55-56`; `models/register.py:10-12`), deci DB-ul nu opreste duplicatul. Pentru facturi fiscale in RO e o problema legala, nu doar tehnica. Contrast: `oauth_service.py:312` si `invoice_service.py:377` **folosesc** `pg_advisory_xact_lock` / `with_for_update` — pattern-ul exista in proiect, dar nu e aplicat aici.
Fix (S): `UPDATE registers SET factura_numar = factura_numar + 1 WHERE id=:id RETURNING factura_numar` (atomic, fara SELECT prealabil) **si** unique partial din I1 ca plasa de siguranta. Idem pentru `deviz`/`chitanta`/`aviz`.

**[High] Stoc: read-modify-write fara lock (lost update)**
`stock.py:132-135, 171-174, 204-206, 236-239`: `stock.qty = stock.qty - ln.qty` in Python pe rândul incarcat fara `FOR UPDATE`. Doua plati/intrari concurente pe acelasi `(item, location)` pierd una din modificari. `UniqueConstraint` pe `stocks` (`models/stock.py:11`) protejeaza doar impotriva dublarii randului (si `_get_or_create_stock(s)` poate primi `IntegrityError` la insert concurent — `stock.py:29-33, 45-50` — netratat).
Fix (S): `UPDATE stocks SET qty = qty - :d, updated_at = now() WHERE item_id=:i AND location_id=:l` (sau `stock.qty = Stock.qty - ln.qty` ca expresie SQL) + `INSERT ... ON CONFLICT (item_id, location_id) DO UPDATE` pentru get-or-create.

**[High] Tranzitiile de plata nu sunt idempotente/serializate → dubla scadere de stoc**
`receipts.py:605-646`: `receipt = await db.get(Receipt, ...)` fara lock; decizia `old_pay == NEPLATIT and new_pay != NEPLATIT` (`:633`) se ia pe starea din memorie. Doua PATCH-uri concurente „Neplatit→Cash” aplica **ambele** `apply_sale_for_receipt` (stoc scazut de 2 ori, 2 miscari SALE, 2 inregistrari in registrul de plati via `sync_from_status` `:644`). Acelasi tipar la `patch_receipt_content` (`:689-691, 762-763`) si `delete_receipt` (`:1079-1080`), si in `payments_service.add_payment/delete_payment` (`payments_service.py:160-196, 208-227`) unde `receipt.pay_method` e recalculat fara lock pe bon.
Fix (S): incarca bonul cu `select(Receipt).where(...).with_for_update()` la inceputul fiecarei mutatii de stare (pay/content/delete/payments). Cu un singur worker async, ferestrele sunt mici dar reale (fiecare `await` cedeaza controlul).

**[Medium] Joburile eFactura tin o singura sesiune/tranzactie peste HTTP catre ANAF pentru toate inregistrarile**
`backend/app/efactura/scheduler.py:117-150, 154-186, 190-216, 432-470`: `async with AsyncSessionLocal() as db` apoi `for rec in rows: ... await client.upload_invoice/check_status/list_messages` (`efactura/service.py:213-215, 330-331, 366-367`). Sesiunea (si conexiunea din pool) sta ocupata pe durata tuturor apelurilor ANAF (timeout-uri de secunde-zeci de secunde fiecare), iar `commit` per record (`service.py:228, 255, 353, 370`) deschide o noua tranzactie tinuta „idle in transaction” pe urmatorul HTTP. Cu pool de 20, 4 joburi paralele × 1 conexiune e tolerabil azi; la crestere devine o sursa de `pool_timeout`.
Fix (S/M): sesiune scurta per inregistrare (deschide, update, commit, inchide) sau cel putin `await db.commit()` inainte de HTTP si re-`get` dupa.

**[Medium] `bcrypt.checkpw` (12 rounds) rulat sincron pe event loop la login**
`backend/app/services/auth_service.py:67` → `backend/app/utils/security.py:6, 29` (fara `to_thread`/`run_in_executor`). 12 rounds ≈ 200-300 ms CPU; pe unicul worker, **toate** cererile (inclusiv POS-ul) ingheata pe durata fiecarui login sau a fiecarei tentative esuate (throttle-ul de login limiteaza abuzul, dar nu costul unui login legitim). Idem `auth.py:383` (schimbare parola) si `hash_password`.
Fix (S): `await asyncio.to_thread(verify_password, ...)`.

**[Low] `report_runs` lock**: `with_for_update` e luat si eliberat la `commit` (`services/reports/manager.py:183-238`) inainte ca builder-ul sa ruleze; protectia reala e `status='running'` + `STALE_RUNNING_SECONDS` (`:191-217`). Functioneaza (single-writer), dar comentariul „Lock advisory” (`:182`) e inselator. Efort S (doar claritate).

**[Low] `IntegrityError` handler global** exista (`main.py:9`), dar `_get_or_create_stock(s)` si `pg_insert` in `efactura/scheduler.py:462` (are `ON CONFLICT`? — *neverificat* dupa linia 470) ar trebui sa fie explicit idempotente.

---

## 5. Endpoint-uri grele, rapoarte, caching

### Design bun (verificat)
- Rapoartele UI citesc **doar** din `report_*_daily` (`reports.py:100-177, 303-366, 499-560, 875-1014, 1105-1121, 1255-1412, 1550-1708, 1818-1892`) — costul per request e proportional cu `zile × dimensiuni`, nu cu numarul de bonuri.
- Builderii sunt idempotenti `DELETE + INSERT ... SELECT ... GROUP BY` intr-o singura tranzactie (`services/reports/builder.py:26-69, 168-204, 227-281, 301-355, 374-415, 433-463`).
- Scheduler: incremental la 2h in orele de program + refresh nocturn 03:00 (`services/reports/scheduler.py:66-104`), cu stagger 180s intre rapoarte (`:18`), cooldown 5 min la trigger manual (`manager.py:19`).
- Admin `receipts-daily` folosit agregatul (`backend/app/routers/admin.py:273-307`).

### Probleme

**[Medium] Builder-ele filtreaza pe `(created_at AT TIME ZONE 'Europe/Bucharest')::date BETWEEN :s AND :e`**
`builder.py:66, 201, 460` (si probabil restul; `manager.py:91, 102, 107` pentru `MIN`). Expresia nu poate folosi indexul `(account_id, created_at)` / `(account_id, created_at)` din `stock_movements` → **seq scan complet** pe `receipts`, `receipt_items` (JOIN) si `stock_movements` la fiecare rulare (7×/zi + nightly), pe **toate conturile**. Azi e ieftin; la milioane de `receipt_items`/`stock_movements` devine job de minute care concureaza cu POS-ul in orele de program (08-20).
Fix (S): converteste limitele in timestamptz in Python/SQL: `created_at >= (:s::date)::timestamp AT TIME ZONE 'Europe/Bucharest' AND created_at < ((:e::date + 1))::timestamp AT TIME ZONE 'Europe/Bucharest'` — sargabil pe `created_at`. Alternativ index pe expresie (mai putin flexibil).

**[Medium] Joburile grele ruleaza in procesul web (acelasi event loop cu POS-ul)**
`main.py:66-67` porneste ambele schedulere APScheduler in lifespan; `admin_reports.py:78, 141` fac `asyncio.create_task(...)` in worker. Un rebuild nocturn e OK, dar `run_all` incremental la 08/10/.../20 ruleaza in orele de varf; `--max-requests 0` (`entrypoint.sh:23`) evita recyclarea mid-run (bine), dar orice restart al containerului omoara jobul (tratat cu `_recover_stale_running` `scheduler.py:29-53`).
Fix (M): proces separat `scheduler`/`worker` in compose (acelasi imagine, `python -m app.worker`), sau arq/Celery. Elimina si nevoia de `-w 1` pentru scheduler (APScheduler ar rula dublu cu 2 workeri web — **atentie** la scalarea orizontala).

**[Low] Fara cache pe citiri repetitive**: `subscription/me` e poll-at de UI la ~30 min (`middleware.py:58-62`) si face 2 query-uri (`routers/subscription.py:114-115`); `global_settings`, `general_settings`, `disclaimers`, `companies` sunt citite la fiecare afisare de PDF/lista (`receipts.py:856-922`) — 4-5 `db.get` per `assign-number`. Cost mic azi. Fix (S): cache in-proces cu TTL 60s pentru setari per cont (si invalidare la PATCH, ca la `efactura/runtime_config.py:97-233`).

**[Low] Serializare Pydantic dubla**: `_serialize` face `ReceiptRead.model_validate(receipt).model_dump()` apoi re-valideaza in `response_model=ReceiptRead` (`receipts.py:323-350, 453`). Pentru pagini de 50-200 bonuri × N linii = CPU pe unicul core. Fix (S): returneaza obiecte Pydantic direct sau `response_model=None`.

---

## 6. Realtime / SSE

Mecanism: `Broadcaster` in-memory cu o `asyncio.Queue(maxsize=100)` per conexiune (`broadcaster.py:11, 19-22`), evenimente „receipts_changed” fara payload (`:54-57`) → clientul re-fetch-uieste lista. Keepalive la 30s (`receipts.py:557-560`), POS la 5s (`:536`). Nginx: `proxy_buffering off`, `proxy_read_timeout 3600s` pe `/api/receipts/events` (`deploy/nginx.conf:78-101`).

- **OK**: fara conexiune DB pe stream (§1), drop-oldest la coada plina (`broadcaster.py:43-52`), unsubscribe in `finally` (`receipts.py:563-564`).
- **[Medium] Thundering herd**: fiecare `notify` (apelat la orice mutatie de bon: `receipts.py:517, 658, 782, 959, 1010, 1054, 1085`, si din joburi eFactura `efactura/scheduler.py:147, 183`) face **toti** clientii contului sa re-incarce lista completa (`GET /api/receipts?...` cu `limit` + 5-6 query-uri). Cu 20 tablete pe un cont si 1 bon/min = 20 refetch-uri/min × 6 query-uri. Fix (M): trimite `receipt_id` + tip in eveniment si patch-uieste local in UI, sau debounce server-side (coalesce evenimente 300-500ms per cont).
- **[Low] `pos_stream` nu foloseste coada**, doar `is_disconnected()` la 5s (`receipts.py:532-542`) — ok, cost neglijabil.
- **[High, deja mentionat §1]** broadcaster-ul in memorie impune `-w 1`.

---

## 7. Volum de date & retentie

| Tabel | Crestere | Retentie / curatare | Observatie |
|---|---|---|---|
| `receipts`, `receipt_items` | nelimitat (business) | soft-delete (`utils/soft_delete.py`) | Indexurile fierbinti exista; lipsesc I1, I3, I4, I9. `is_deleted` ramane pentru totdeauna in tabel → indexuri partiale `WHERE is_deleted=false` ar reduce marimea. |
| `stock_movements` | nelimitat, 1 rand per linie PRODUS la fiecare plata/anulare/editare (`stock.py:136-150, 175-189`); editarea unui bon platit genereaza SALE_REVERSE + SALE pentru toate liniile (`receipts.py:689-691, 762-763`) | **niciuna** | Cel mai rapid tabel in crestere. Agregatul `report_stock_movements_daily` exista; se poate arhiva/partitiona pe luna dupa 12-24 luni. **Medium**. |
| `receipt_payments` | 1-3 randuri per bon; `sync_from_status` adauga randuri „corectie” la fiecare schimbare de status (`payments_service.py:285-294`) | soft-delete | Low. |
| `user_sessions` | **1 rand per login**, `expires_at = +30 zile` (`auth_service.py:99, 125-135`, `config.py:7`) | **niciuna** (grep `UserSession` + `delete|expires_at <` → 0 rezultate) | Citit la **fiecare request** prin `jti` (unic → OK), dar tabelul creste nelimitat; listarea sesiunilor per user (`users_service.py:238-323`) filtreaza in Python `_is_session_live`. **Medium**: job zilnic `DELETE WHERE expires_at < now() - 7d OR revoked_at < now() - 7d`. |
| `email_logs` | 1 rand per email, cu `body_html` complet (`models/email_log.py:19`, `email_service.py:92`) | **niciuna** | Low/Medium: body-ul HTML umfla tabelul; retentie 90 zile sau `body_html` doar la eroare. |
| `task_runs` (eFactura) | 1 rand per rulare job; 4 joburi la 5/10/30/60 min (`efactura/scheduler.py:711-721`) ≈ **500+ randuri/zi** | cleanup 90 zile la 04:00 (`efactura/scheduler.py:518-538`) | OK. |
| `efactura_received_index` | crestere cu facturile primite | unique `(company_id, id_solicitare)` | OK. |
| `report_*_daily` | `zile × conturi × dimensiuni`; refacut prin DELETE+INSERT → **bloat** pe tabele (7 rescrieri/zi ale zilei curente + nightly pe ~2 luni) | autovacuum | Low: verifica `n_dead_tup`; eventual `autovacuum_vacuum_scale_factor` mai agresiv pe aceste tabele. |
| `logs/` pe disc | `logging_config.py:12-45` are cleanup | OK. |

---

## 8. Recomandari de scalare (prioritizate)

1. **Integritate intai (S, 1 zi)**: numerotare atomica `UPDATE ... RETURNING` + unique partial pe `(account_id, serie, nr)`; `with_for_update` pe bon la mutatiile de plata/continut/stergere; `UPDATE stocks SET qty = qty + :d` in loc de RMW; `ON CONFLICT` la get-or-create stoc.
2. **Indexuri (S, 0,5 zi)**: I1-I4, I6, I8, I9 din §3 + `pg_trgm`. Toate `CREATE INDEX CONCURRENTLY` (Alembic cu `postgresql_concurrently=True`, in afara tranzactiei).
3. **Builder-e sargabile (S)**: rescrie filtrul de perioada pe `created_at` cu limite timestamptz (§5). Reduce seq-scan-urile de 7×/zi pe tabelele mari.
4. **Scoate CPU/IO lung din event loop (S)**: `to_thread` pentru bcrypt; sesiuni scurte in joburile eFactura.
5. **Paginare standard (S/M)**: `limit` obligatoriu (default 100, max 500) pe `leaves`, `programari`, `stocuri`; corecteaza cursorul la `clienti`; un helper comun `keyset(stmt, order_cols, cursor)`.
6. **Multi-worker (M)**: Redis (pub/sub broadcaster, slowapi storage, login throttle) → `-w 2-4`; muta APScheduler intr-un container `worker` separat (altfel joburile ruleaza de N ori). **pgbouncer** in transaction mode intre app si Postgres cand `workers × (pool_size+max_overflow)` depaseste ~100; scade `max_connections` la 100 si creste `work_mem` doar pe sesiunile de rapoarte (`SET LOCAL work_mem`).
7. **Retentie (S)**: joburi zilnice pentru `user_sessions` expirate, `email_logs` > 90 zile (sau fara `body_html`), arhivare `stock_movements` > 24 luni (partitionare pe luna daca depaseste ~10M randuri).
8. **Observabilitate (S)**: `statement_timeout` + `application_name` in `connect_args`; `pg_stat_statements` activat in `docker-compose.yml` (`-c shared_preload_libraries=pg_stat_statements`); log de query-uri lente (`log_min_duration_statement=500`). Fara acestea, urmatorul audit ramane static.
9. **SSE (M)**: evenimente cu `receipt_id` + debounce per cont; reduce refetch-urile in cascada.
10. **Cache usor (S)**: TTL 60s in-proces pentru setari per cont (`general_settings`, `global_settings`, `companies`, `disclaimers`), invalidat la PATCH.

---

## Anexa A — Verificarea commit-urilor recente

| Commit | Afirmatie | Verificat in |
|---|---|---|
| `6becd02` indexuri FK | da | `alembic/versions/idx01_fk_hot_indexes.py:20-28`, `models/receipt.py:22-25` |
| `6becd02` commit unic pe bonuri | da — un singur `commit` per handler (`receipts.py:506, 646, 770, 1084`); `flush`-uri intermediare doar pentru id-uri | `receipts.py` |
| `6becd02` stoc batch-uit | da | `services/stock.py:36-51, 125-131` |
| `fc92708` SSE fara conexiune DB | da | `dependencies.py:123-150`, `receipts.py:522-573` |

## Anexa B — Ce NU a fost verificat (limite ale auditului static)
- Planuri de executie reale, dimensiunea tabelelor, `pg_stat_statements` (nu s-a conectat la DB).
- Continutul migratiilor `ef07` pentru indexurile `EFacturaRecord`.
- Comportamentul UI (daca trimite mereu `date_from/date_to` la `programari`/`leaves`).
- Versiunea exacta Starlette instalata in imagine (pentru `BaseHTTPMiddleware`).
