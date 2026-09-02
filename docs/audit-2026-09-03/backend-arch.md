# Audit arhitectura backend — BerlinStar (FastAPI + SQLAlchemy 2 async + Alembic + PostgreSQL)

Data: 2026-09-03. Branch: `feat/utilizatori-roluri` (338 commits, ultimul 2026-09-02).
Mod: READ-ONLY, fiecare constatare citata `fisier:linie` si verificata prin citire. Ce nu am putut verifica e marcat explicit **[neverificat]**.

Dimensiuni: `backend/app` = **27.656 linii** Python; **286 rute** HTTP in 42 routere + 2 routere eFactura; **45 modele** ORM (+7 in `efactura/models.py`); **115 migratii** Alembic; **9 fisiere de test** (1.729 linii).

Nota generala: **6/10** — fundatie async solida si securitate de sesiune bine gandita, dar logica de business traieste in routere, nu exista strat de servicii/repository consistent, testarea e artizanala (fara pytest, fara CI) si mai multe constatari "BLOCKER" din raportul din mai 2026 sunt inca deschise.

---

## 0. Statusul constatarilor din rapoartele anterioare

| Constatare veche | Status azi | Dovada |
|---|---|---|
| B-01 `SECRET_KEY` cu fallback literal | **DESCHIS** | `backend/app/config.py:5` — `os.getenv("SECRET_KEY", "schimba-asta-in-productie")`; folosit la `dependencies.py:20`, `efactura/oauth_service.py:79,84`, `routers/admin_assistant.py:71,83` |
| B-02 parole admin hardcodate | REZOLVAT | `routers/admin.py:31-39` (env vars obligatorii, `RuntimeError` daca lipsesc), `hmac.compare_digest` la `admin.py:57-60` |
| B-03 chei S3 reale in `.env.example` | **DESCHIS** | `deploy/.env.example:23-24` contine `S3_ACCESS_KEY=KW1B8X...` / `S3_SECRET_KEY=nWo1l...`; fisierul e tracked (`git ls-files`) |
| B-05 Postgres 5432 publicat | REZOLVAT | `deploy/docker-compose.yml:90` — comentariu explicit, fara `ports:` pe db |
| B-07 backup-uri SQL in repo | **DESCHIS** | `git ls-files` listeaza `deploy/backup_Productie_*.sql` / `.sqlplus` (date de productie + hash-uri parole in git) |
| CR-3 `/admin/reports/run-all` fara admin | REZOLVAT | `routers/admin_reports.py:25` — `APIRouter(dependencies=[Depends(_require_super_admin)])` |
| CR-4 OAuth state: nonce generat dar nevalidat | **DESCHIS** | `efactura/oauth_service.py:76` genereaza `nonce`; `_decode_state` (`:82-84`) doar decodeaza JWT, nu compara nonce-ul. State-ul e semnat, deci riscul e limitat la replay al propriului state **[impact neverificat]** |
| CR-7 scheduler rapoarte fara `max_instances=1` | **PARTIAL** | `services/reports/scheduler.py:71-83, 92-104` — nu exista `max_instances`; exista in schimb guard in DB (`services/reports/manager.py:182-199`, status `running` + stale 30 min) |
| CR-6 idempotenta upload eFactura | PARTIAL | `efactura/router.py:542-546` verifica `existing.status in ("pending_upload","accepted","rejected")`; fara `with_for_update` (grep gol) — race teoretica la dublu-click **[neverificat]** |
| BLOCKER CIUS-RO 1.0.1 → 1.0.9 | **PROBABIL FALS POZITIV** | `efactura/mapping.py:29` are `CIUS-RO:1.0.1`. Din cunostintele mele, CustomizationID-ul oficial ANAF este chiar `...CIUS-RO:1.0.1` (1.0.9 e versiunea schematron-ului, nu a ID-ului). Recomand confirmare cu documentatia ANAF inainte de orice schimbare **[neverificat online]** |
| legacy `base64` fallback la parole | DESCHIS (tranzitoriu, acceptabil) | `utils/security.py:32-33`; re-hash la login in `services/auth_service.py:78` |
| boto3 sync blocheaza event-loop | REZOLVAT | `utils/storage.py:63,109,121` — `asyncio.to_thread(...)` |
| SSE tine conexiune DB | REZOLVAT | `dependencies.py:123-150` deschide sesiune locala, nu `Depends(get_db)` |

---

## 1. Layering: routere / servicii / repository / modele / scheme

### 1.1 [High] Logica de business traieste in routere; stratul de servicii e exceptia, nu regula
- Doar **9 din 42** routere importa ceva din `app.services` (`grep -l 'from app.services' app/routers/*.py`); 33 nu importa nimic.
- `routers/receipts.py` (1.085 linii) contine 13 functii private de domeniu inainte de prima ruta: garda de pret pe rol `_assert_may_change_prices` (`:104-162`), recalcul acumulari angajati `_refresh_accumulations` (`:163-196`), sincronizarea garajului clientului `_sync_client_vehicol` (`:197-283`), lock eFactura `_assert_not_locked` (`:313-322`), serializare manuala `_serialize` (`:323-357`). `create_receipt` (`:454-522`) face validare, insert parinte+linii, recalcul acumulari, commit, reload, broadcast — toate in handler.
- `routers/leaves.py` (596 linii): 6 `db.commit()`, 0 import de servicii; calculul zilelor lucratoare e in router (`leaves.py:19` importa util, dar orchestrarea e in handler).
- `routers/reports.py` (1.937 linii): **49 clase Pydantic** definite inline in router (`grep -c 'class .*(BaseModel)'`) si **33 apeluri `text(...)`** cu SQL brut, unele construite cu f-string (`reports.py:101,118,150` — doar `loc_filter` e interpolat, un literal fix; parametrii sunt bind-uiti, deci NU e SQL injection, dar e un anti-pattern fragil).
- Nu exista strat repository: query-urile SQLAlchemy sunt scrise direct in handler (ex. `departments.py:39-52`, `admin_users.py:37-42`).
- Serviciile care exista sunt bine facute si arata directia corecta: `services/users_service.py` (folosit de `routers/users.py` si `routers/admin_users.py` — regulile nu se desincronizeaza), `services/payments_service.py`, `services/stock.py`, `services/auth_service.py`.

**Impact:** testarea logicii de bon/concedii cere HTTP sau importul handler-ului; reutilizarea din scheduler/CLI e imposibila fara duplicare; fisierele mari devin puncte de conflict la merge.
**Recomandare (M-L):** extrage `services/receipts_service.py` (price guard, vehicol sync, accumulations), `services/leaves_service.py`, `services/reports_queries.py` + `schemas/reports.py`. Regula de echipa: un handler = validare input + apel serviciu + serializare.

### 1.2 [High] Cuplaj intre routere (routere care importa din alte routere)
- `_require_super_admin` e definit in `routers/admin.py:109` si importat de 7 module: `admin_legacy_import.py:21`, `admin_marci_anvelope.py:12`, `admin_subscription.py:28`, `admin_assistant.py:38`, `admin_users.py:20`, `admin_reports.py:10`, `efactura/router_admin.py:46`. Un pachet de domeniu (`efactura`) depinde de un router.
- `routers/receipt_payments.py:22` importa `_assert_not_locked` din `routers/receipts.py` (functie "privata" cu underscore).
**Recomandare (S):** muta `_require_super_admin` in `app/dependencies.py` (langa `get_platform_admin_account`, care face deja 90% din treaba — `dependencies.py:185-196`), `_assert_not_locked` intr-un serviciu eFactura.

### 1.3 [Medium] Duplicare: singleton `GlobalSettings` re-implementat de 7 ori
`select(GlobalSettings).limit(1)` (uneori cu create-if-missing, uneori fara) apare in `routers/accounts.py:60`, `routers/auth.py:152`, `routers/email_settings.py:25`, `routers/global_settings.py:21`, `subscriptions/settings.py:25`, `efactura/scheduler.py:95`, `utils/email_service.py:77`. Exista deja `subscriptions/settings.py:24 get_or_create_global_settings` — ar trebui sa fie unicul punct.
**Recomandare (S):** `services/global_settings.py` cu o singura functie + cache scurt.

### 1.4 [Medium] Tabele de infrastructura in pachetul de domeniu eFactura
`TaskRun` si `ScheduledJobOverride` (`efactura/models.py:150-207`) sunt generice (folosite si de scheduler-ul de rapoarte prin `models/__init__.py:42`), dar `app.models` importa din `app.efactura` — inversiune de dependenta: nucleul depinde de un modul de feature.
**Recomandare (S):** muta-le in `models/task_run.py`.

### 1.5 Fisiere mari (top)
`routers/reports.py` 1.937 · `efactura/router.py` 1.248 · `services/demo_seeder/seeder.py` 1.153 · `routers/receipts.py` 1.085 · `efactura/scheduler.py` 876 · `efactura/router_admin.py` 775 · `efactura/mapping.py` 752 · `routers/leaves.py` 596. Prag rezonabil pentru un router: ~300 linii.

---

## 2. Dependency injection, sesiune DB, config

### 2.1 [Low] Sesiunea DB — corect
`database.py:38-40` `get_db` yield simplu; pool `pool_size=10, max_overflow=10, pool_pre_ping, pool_recycle=3600` (`database.py:19-23`); `expire_on_commit=False` (`:32`). Commit-ul e explicit in handler (fara auto-commit/rollback in `get_db`) — acceptabil, dar un handler care ridica exceptie dupa `flush()` lasa rollback-ul pe seama `__aexit__`. OK.

### 2.2 [Medium] Configuratia e imprastiata, fara schema
- `os.getenv` direct in `config.py`, `database.py:9`, `main.py:86-96`, `rate_limit.py`, `utils/storage.py:26-30,57-58,98-99,116-117` (default-uri de bucket/URL de productie hardcodate: `"professorprimedev"`), `routers/admin.py:33-34`, `efactura/runtime_config.py` (fallback env).
- `load_dotenv()` apelat in doua locuri (`main.py:15`, `database.py:5`).
- Nu exista `pydantic-settings`; nu exista validare la boot a variabilelor obligatorii (exceptie: `DATABASE_URL` in `database.py:10-17` si parolele admin in `admin.py:35-39`).
**Recomandare (M):** `app/settings.py` cu `BaseSettings` (SECRET_KEY min 32 chars, S3_*, CORS, ALLOWED_HOSTS, TOKEN_EXPIRE) — o singura sursa, esueaza rapid.

### 2.3 [Critical] `SECRET_KEY` cu fallback public (deschis din mai)
`config.py:5`. Semneaza JWT-urile de autentificare, state-ul OAuth ANAF si token-urile asistentului. Un container pornit fara `.env` emite token-uri forjabile de oricine citeste repo-ul.
**Recomandare (S):** `SECRET_KEY = os.environ["SECRET_KEY"]` + `assert len(...) >= 32` (sau prin `BaseSettings`).

### 2.4 [Medium] Stare in memoria procesului → plafon la 1 worker
`broadcaster.py` (SSE), `rate_limit.py:7` (slowapi in-memory), `utils/login_throttle.py` (docstring recunoaste limitarea), cache-ul `efactura/runtime_config`. `deploy/entrypoint.sh:16-19` hardcodeaza `-w 1`. Scalarea orizontala sau zero-downtime deploy (2 replici) e blocata pana la Redis.
**Recomandare (M):** Redis pentru limiter + throttle + pub/sub SSE; e o schimbare izolata (3 module).

---

## 3. Autentificare, roluri, consistenta permisiunilor

### 3.1 Puncte forte (verificate)
- JWT + **sesiuni revocabile** cu `jti` obligatoriu (`auth_context.py:88-127`, `models/user.py:80-119`): dezactivare user / deconectare dispozitiv au efect imediat. Un singur SELECT cu join pe drumul fericit (`auth_context.py:91-101`).
- Matrice de permisiuni centralizata (`permissions.py:31-37`), `require_resource()` generic (`dependencies.py:65-80`), izolare multi-tenant prin `get_account_id` care trece prin `get_auth_context` (`dependencies.py:110-120`).
- **Test de politica pe rute** (`tests/test_route_authorization.py`) — introspecteaza aplicatia reala si compara dependintele fiecarei rute cu politica declarata. Excelent, rar vazut.
- Super-admin de platforma cu dubla conditie (`dependencies.py:185-196`).
- Rate limiting pe login (`routers/auth.py:94`), throttle pe credential (`utils/login_throttle.py`), bcrypt 12 runde (`utils/security.py:6`).

### 3.2 Constatari
- **[Medium]** Toate cele 286 rute au un gate de autentificare in afara celor declarate public (verificat prin scanare awk + citirea celor 7 rute semnalate: `admin.py:136-138,175-177`, `admin_assistant.py:109-112`, `admin_legacy_import.py:75-82`, `efactura/router_admin.py:289-291` — toate au `Depends(_require_super_admin)`). Webhook Stripe autentificat prin semnatura (`subscription_webhook.py:47-51`). Consistenta e insa **prin conventie + test**, nu prin design: doar 3 routere folosesc `APIRouter(dependencies=[...])` (`accounts.py:26`, `admin_reports.py:25`, `email_settings.py:21`); restul repeta `Depends(...)` pe fiecare handler.
- **[Medium]** `TOKEN_EXPIRE_DAYS = 30` (`config.py:7`, `auth_service.py:99`) fara refresh; atenuat de revocabilitate, dar un token furat traieste 30 zile.
- **[Low]** Rolurile sunt un enum fix (`models/user.py:21-23`); adaugarea unei resurse = editare `permissions.py` + oglinda frontend. Bine pentru dimensiunea actuala.
- **[Low]** `_require_super_admin` dubleaza `get_platform_admin_account` (vezi 1.2).

---

## 4. Erori, validare, response models, conventii API

- **[Medium] Response models inconsistente:** `routers/programare.py` are 5 rute si **0** `response_model` (`programare.py:74-179`); `global_settings.py` 2/8; `montaj_roti.py` 2/4; `factura_rapida.py` 0/1. Contractul OpenAPI e incomplet exact unde frontend-ul consuma dict-uri libere.
- **[Medium] Paginare mixta:** cursor `Page[T]` (`schemas/common.py:8-10`, `utils/paginate.py`) pe nomenclatoare vs. `list[UserRead]` fara paginare (`users.py:33`) vs. rapoarte cu obiecte agregate. `limit` e clampat manual `min(limit, 100)` in fiecare handler (`departments.py:38,161`) in loc de `Query(le=100)`.
- **[Low] Fara versionare API** (`/api/...`, `main.py:128-169`). Acceptabil pentru un SPA intern cu deploy cuplat; de notat daca apar clienti externi (ANAF/Stripe sunt webhook-uri inbound, nu consumatori).
- **[Low] Erori:** `HTTPException(4xx, "text romanesc")` peste tot; fara cod de eroare masinal (`{"detail": "..."}`). Handler global `IntegrityError→409` generic (`main.py:116-119`) mascheaza care constrangere a picat; `OperationalError→503` ok; 500 prin middleware cu `X-Request-Id` (`middleware.py:90-105`) — bun.
- **[Low] Validare Pydantic:** buna pe bon (`schemas/receipt.py:23-59` — `decimal_places`, `ge`, `max_length`), `from_attributes` in 32/35 scheme. `include_deleted: bool` e acceptat de orice rol pe listari (`departments.py:33,43`).
- **[Low] 63 `except Exception`** in `app/` (majoritatea logate; `subscription_webhook.py:69-72` inghite intentionat, documentat).
- **[Low]** `updated_at` setat manual in fiecare handler (`departments.py:92,110`); **0** `onupdate` in modele (`grep -rc onupdate app/models`).

---

## 5. Modelul de domeniu

- **Puncte forte:** SQLAlchemy 2.0 `Mapped[]` peste tot; `MetaData(naming_convention=...)` (`models/base.py:4-13`); `DateTime(timezone=True)` consecvent; indexuri compuse gandite pentru tenant (`receipt.py:22-33`, `user.py:38-47` index unic partial pe soft-delete); `Numeric` pentru bani (13x `Numeric(10,2)`, 14x `Numeric(14,2)`); enum-uri native PG (`pay_method`, `user_role`, `item_type`, `payment_method`, ...); `ondelete` declarat pe FK-uri.
- **[Medium] Fara mixin-uri:** `id/account_id/created_at/updated_at/is_deleted/deleted_at` copiate in ~30 modele (`account.py:16-23`, `receipt.py:36-51`, `user.py:50-73`...). Un `TenantMixin` + `TimestampMixin` + `SoftDeleteMixin` ar elimina ~150 linii si ar face `soft_delete()` (`utils/soft_delete.py:7-14`) tipabil.
- **[Medium] Multi-tenancy prin disciplina, nu prin mecanism:** fiecare query adauga manual `.where(X.account_id == account_id)`; o omisiune = scurgere intre conturi. `ReceiptItem.account_id` e **nullable** (`receipt.py:110-112`) — coloana de tenant ar trebui `NOT NULL`. Nu exista RLS PostgreSQL, nici query-loader cu filtru implicit.
- **[Low] Soft-delete neuniform:** absent pe `device`, `stock`, `stock_movement`, `report_*`, `email_log`, `general_settings` (tabelul din sectiunea "models audit fields"). Justificabil pentru jurnale/agregate; `device` merita revizuit.
- **[Low] Import-uri circulare rezolvate cu import la finalul fisierului** (`receipt.py:142-146`, `user.py:122`) — functioneaza, dar fragil la reordonare.
- **[Low]** `Float` in 8 coloane (`grep -rho Float app/models`) — **[neverificat]** daca vreuna e monetara.
- **[Low]** `Account.reports_password` exista in DB dar nu e mapat (`account.py:29-30`) — drift intentionat, documentat; de curatat prin migratie.
- `lazy="selectin"` pe `Receipt.receipt_items/client/vehicol` (`receipt.py:87-91`) — evita N+1 la listare, dar incarca mereu 3 colectii chiar si pe `PATCH` simple.

---

## 6. Background, SSE, joburi, fisiere, PDF

- **SSE:** `broadcaster.py` — cozi bounded (100) cu drop-oldest (`:43-52`), per-account, unsubscribe in `finally`; worker gunicorn custom cu `timeout_graceful_shutdown=15` (`gunicorn_worker.py:19-24`) ca sa nu blocheze restart-ul — problema reala rezolvata elegant. Limita: in-memory, 1 worker.
- **Scheduler:** doua instante APScheduler separate (`services/reports/scheduler.py`, `efactura/scheduler.py:1-50`), pornite in `lifespan` (`main.py:66-72`). eFactura are `max_instances=1, coalesce=True` (`efactura/scheduler.py:773-774,873`); rapoartele **nu** (`reports/scheduler.py:71-83,92-104`), compensat de guard-ul din `manager.py:182-199`. Cu 2 replici ambele scheduler-e ar rula in paralel — inca un motiv pentru `-w 1`.
- **[Medium]** Nu exista coada de joburi (Celery/arq/Dramatiq): `register` trimite email prin `BackgroundTasks` (`auth.py:168`), upload eFactura e "asincron in background" (`efactura/router.py:508-512`) — task-uri in-process, pierdute la restart.
- **Fisiere:** S3 Hetzner via boto3 in `asyncio.to_thread` (`storage.py:63`), validare MIME prin magic bytes + limita 5MB (`storage.py:71-97`), `ACL="public-read"` (`storage.py:46`) — imaginile sunt publice prin URL neghicibil (uuid). Default-uri de productie hardcodate in cod (`storage.py:57-58`).
- **Email:** SMTP blocant in `run_in_executor` (`utils/email_service.py:52-69`) — corect.
- **PDF:** doar facturile de abonament, cu `reportlab` (`subscriptions/invoice_service.py`, 587 linii); documentele fiscale (deviz/factura/chitanta) se genereaza in frontend (jsPDF, conform memoriei proiectului) — backend-ul nu are sursa de adevar pentru PDF-ul fiscal.
- **Logging:** structurat cu request-id, rotire fisier (`logging_config.py:47`), niveluri per path (`middleware.py:49-62`) — bun; nu e JSON (greu de agregat).

---

## 7. Teste si CI

- **[High] Fara CI:** nu exista `.github/` (verificat `ls ../.github` → inexistent), nici alt pipeline in repo. Testele ruleaza manual: `venv/bin/python -m tests.run_all` (`tests/run_all.py:3`).
- **[High] Fara pytest** — harness propriu (`tests/_harness.py:8-10` recunoaste: "repo-ul nu il are instalat"). `requirements.txt` nu contine pytest/pytest-asyncio/httpx-test.
- **Acoperire:** 9 fisiere, 1.729 linii pentru 27.6k LOC (~6% raport linii; estimare acoperire functionala **[neverificat, estimat] 10-15%**, concentrata pe auth/permisiuni/plati/pret). Zone fara niciun test: rapoarte (1.937 + 480 + 322 linii), eFactura (exceptie `test_efactura_sector.py`, 104 linii), concedii, hotel anvelope, stocuri, programari, import legacy.
- **[Medium] Testele ruleaza pe SQLite** cu tabelele JSONB sarite (`_harness.py:36-58`) — DDL-ul de productie, enum-urile PG, indexurile partiale si `ANY(:loc_ids)` din rapoarte nu sunt exercitate.
- **Bun:** `test_route_authorization.py` (politica pe rute, vezi 3.1), `test_receipt_price_guard.py`, `test_payments_register.py` testeaza logica de business reala.
**Recomandare (M):** `pytest` + `pytest-asyncio` + `httpx.AsyncClient(app=...)`; fixture Postgres prin `testcontainers` sau `docker compose` de test; GitHub Actions cu `alembic upgrade head` + teste + `alembic check` la fiecare PR.

---

## 8. Alembic

- **115 migratii**, un singur head (`venv/bin/alembic heads` → `idx01fkhot (head)`), **6 noduri de merge** (istoric de branch-uri paralele: `b2c3d4e5f6a8`, `h9i0j1k2l3m4`, `mr06merge001`, `mrg01`, plus `5e6f7a8b9c0d`, `mr01reports001` cu doi parinti).
- **Denumire inconsistenta a reviziilor:** hex-uri Alembic (`cd40edc7cc5f`), pseudo-hex secventiale (`a1b2c3d4e5f6`, `zz7gg8hh9ii0`), prefixe semantice (`ef01..ef17`, `mr01..mr09`, `usr01`, `fdl_001`). Functioneaza, dar `revision` de tip `ef17rawresp` vs `idx01fkhot` face istoricul greu de urmarit.
- **206 `op.execute(...)`** in 115 fisiere (`marci_global_001` singur are 34; `leaves_001` 14) — migratii de date/enum-uri scrise in SQL brut, netestate automat. Doua migratii au inversat enum-ul `pay_method` (`e4f5a6b7c8d9_fix_pay_method_enum_values.py` apoi `f5a6b7c8d9e0_revert_...`) — semn de experiment in productie.
- **83 fisiere contin `drop_column`/`drop_table`** (in `upgrade` sau `downgrade`); 4 merge-uri cu `downgrade: pass` (normal).
- **[Medium] Consistenta modele ↔ migratii [neverificat]:** necesita `alembic check` pe o baza reala; nu am DB in acest audit. Indicii de drift: `accounts.reports_password` exista in DB dar nu in model (`account.py:29-30`).
- **[Medium] Migratia ruleaza la pornirea containerului** (`deploy/entrypoint.sh:10` `alembic upgrade head` inainte de gunicorn). Cu o singura replica e ok; cu doua ar fi race. Fara pas de backup pre-migrare in entrypoint.
- `alembic.ini:3` are `sqlalchemy.url = sqlite+aiosqlite:///./berlinstar.db` (suprascris de `DATABASE_URL` in `env.py:20`) — un `alembic upgrade` rulat fara env creeaza silentios un SQLite local.
- `render_as_batch=True` (`env.py:29,39`) mentinut pentru SQLite — pe Postgres e inutil si poate schimba modul in care se genereaza ALTER-urile.

---

## 9. Scalabilitate si "cat costa o functionalitate noua"

**Adaugarea unei entitati CRUD noi azi** (dedus din pattern-ul `departments.py`, 175 linii):
1. `models/x.py` (copiaza 6 coloane standard manual) + adaugare in `models/__init__.py` (import + `__all__`, `__init__.py:1-45`);
2. `schemas/x.py` (Create/Update/Read cu `from_attributes`);
3. `routers/x.py` — copy-paste al celor 8 handler-e din `departments.py` (list cu cursor/filters/sort/q, create, get, put, patch, image, delete, sub-lista), ~170 linii, incluzand clamp `limit`, filtru `account_id`, `is_deleted`, `updated_at` manual;
4. `main.py:25` (import) + `include_router` (`main.py:128-169`);
5. politica in `tests/test_route_authorization.py` (altfel testul pica — bun);
6. migratie Alembic scrisa manual (autogenerate posibil, dar nefolosit consecvent judecand dupa `op.execute`-uri);
7. frontend.

Estimare: ~400 linii backend, din care ~250 boilerplate identic. **Coeficient de duplicare ridicat, dar previzibil** — un dezvoltator nou intelege pattern-ul in 30 minute. Riscul e la entitatile cu reguli (bon, concedii, hotel): acolo nu exista loc "natural" pentru logica, deci ajunge in router.

**Hotspot-uri de cuplaj:**
- `routers/receipts.py` — atins de plati (`receipt_payments.py:22`), stocuri (`services/stock.py:114,153`), eFactura (`receipts.py:284-322`), rapoarte (report_* citesc `receipts`/`receipt_items`), SSE. Orice schimbare pe bon are 5 vecini.
- `routers/admin.py` — hub de dependinte pentru 7 module (1.2).
- `GlobalSettings` — 7 puncte de acces (1.3).
- `main.py:25` — import pe o singura linie de 40 module; orice router nou = conflict de merge garantat pe linia respectiva.

**Plafoane de scalare:** 1 worker (stare in-memory, doua scheduler-e), pool 10+10 conexiuni (`database.py:20`), `--timeout 600` gunicorn (`entrypoint.sh:20`). Pentru ~200 utilizatori concurenti e suficient (concluzie identica cu raportul din mai); pentru multi-replica sau >1k utilizatori e nevoie de Redis + separarea scheduler-ului intr-un proces dedicat.

---

## 10. Sinteza constatarilor (dupa severitate)

| # | Sev. | Constatare | Locatie | Efort |
|---|---|---|---|---|
| 1 | **Critical** | `SECRET_KEY` fallback literal (deschis din mai) | `config.py:5` | S |
| 2 | **Critical** | Chei S3 reale in fisier tracked + dump-uri SQL de productie in git | `deploy/.env.example:23-24`, `deploy/backup_Productie_*` | S (+ rotire chei, filter-repo) |
| 3 | High | Logica de business in routere; 33/42 routere fara servicii; `receipts.py`/`leaves.py`/`reports.py` | §1.1 | L |
| 4 | High | Fara CI, fara pytest, ~10-15% acoperire, teste pe SQLite | §7 | M |
| 5 | High | Routere care importa din routere (`_require_super_admin` x7, `_assert_not_locked`) | §1.2 | S |
| 6 | Medium | Config imprastiat, fara schema/validare la boot | §2.2 | M |
| 7 | Medium | Stare in-memory → plafon 1 worker (broadcaster, limiter, throttle, scheduler-e) | §2.4 | M |
| 8 | Medium | Multi-tenancy prin disciplina; `ReceiptItem.account_id` nullable; fara mixin-uri | §5 | M |
| 9 | Medium | Response models lipsa (programare 0/5, global_settings 2/8), paginare mixta | §4 | S |
| 10 | Medium | 49 scheme Pydantic + 33 SQL brut in `routers/reports.py` | §1.1 | M |
| 11 | Medium | `GlobalSettings` singleton duplicat x7 | §1.3 | S |
| 12 | Medium | `TaskRun`/`ScheduledJobOverride` in pachetul eFactura | §1.4 | S |
| 13 | Medium | Scheduler rapoarte fara `max_instances=1`; migratie la boot fara lock/backup | §6, §8 | S |
| 14 | Medium | Alembic: 206 `op.execute`, denumiri inconsistente, drift neverificat | §8 | M |
| 15 | Low | `TOKEN_EXPIRE_DAYS=30` fara refresh; nonce OAuth nevalidat; legacy base64 | §3.2, §0 | S |
| 16 | Low | `updated_at` manual (0 `onupdate`), `include_deleted` pentru orice rol, `except Exception` x63 | §4 | S |

## 11. Recomandari prioritare

1. **(S, azi)** Elimina fallback-ul `SECRET_KEY`, roteste cheile S3, scoate `.env.example` cu valori reale si dump-urile SQL din git (`git filter-repo`), adauga `deploy/backup_*` in `.gitignore`.
2. **(M, sprint 1)** `pytest` + `httpx.AsyncClient` + Postgres de test (testcontainers) + GitHub Actions cu `alembic upgrade head && alembic check && pytest`. Pastreaza `test_route_authorization.py` ca gate obligatoriu.
3. **(S→M, sprint 1-2)** Curatare de cuplaj: muta `_require_super_admin` in `dependencies.py`, `TaskRun` in `models/`, un singur `get_global_settings()`; `APIRouter(dependencies=[...])` ca default pe toate routerele admin.
4. **(L, incremental)** Strat de servicii pentru bon/concedii/rapoarte: incepe cu `receipts_service.py` (price guard, vehicol sync, accumulations — deja functii pure, doar de mutat), apoi `schemas/reports.py` + `services/reports/queries.py`. Introdu `TenantMixin/TimestampMixin/SoftDeleteMixin` si un `crud_router(model, schemas, policy)` generic pentru nomenclatoare (ar inlocui ~15 routere aproape identice).
5. **(M, cand apare nevoia de a doua replica)** Redis pentru slowapi + login throttle + pub/sub SSE; scheduler-ele intr-un proces `worker` separat in compose; `pydantic-settings` cu fail-fast.

**Nota: 6/10.** Securitatea sesiunilor, izolarea tenant-ului la nivel de dependinte si igiena async sunt peste medie; arhitectura in straturi, testarea si disciplina de config sunt sub medie pentru un produs fiscal in productie.
