# Audit BerlinStar — 2026-09-03 (sinteza)

Cinci audituri independente, rapoartele detaliate (cu file:line, severitate, efort S/M/L) sunt in acest director:

| Raport | Nota | Fisier |
|---|---|---|
| Arhitectura backend | 6/10 | backend-arch.md |
| Performanta & baza de date | 6.5/10 | backend-perf-db.md |
| Arhitectura frontend | 5/10 | frontend-arch.md |
| Responsive & performanta runtime FE | 6.5/10 (mobil 6, tableta 6, desktop 8) | frontend-responsive.md |
| Infra / deploy / ops | 5.5/10 | infra-ops.md |

**Media: ~6/10.** Fundatia tehnica e buna (async corect, izolare tenant prin dependencies, sesiuni in DB, SSE fara conexiune DB tinuta, Caddy TLS, CSP strict, migratii automate). Problemele sunt de disciplina: secrete si dump-uri in git, zero CI/teste automate, logica de business in routere, pagini FE monolitice, abstractii construite dar neadoptate, si cateva race-conditions fiscale.

## Critice (de facut acum)

1. **18 dump-uri de productie in git** (`deploy/backup_Productie_*.sql|.sqlplus`, pana la 83 MB). `.gitignore` acopera `*.sql` dar nu `.sqlplus`, iar fisierele erau deja tracked. Contin clienti, angajati, bonuri. Plus parola sudo QA in clar in `QA.md:19`. Fix: `git rm --cached`, `git filter-repo`, force-push, re-clone pe servere, rotire parola.
2. **`SECRET_KEY` cu fallback literal** (`backend/app/config.py:5`) — semneaza JWT, OAuth ANAF, tokenuri asistent. Deschis din mai. Fix: fail-fast la pornire daca lipseste.
3. **Numerotare facturi/devize/chitante fara lock si fara unique** (`routers/receipts.py:862-888`, `models/receipt.py:55-56`). Doua cereri concurente pot emite acelasi numar de factura. Fix: `UPDATE registers SET nr = nr + 1 ... RETURNING` + unique partial pe `(account_id, serie, nr)`.
4. **Fara backup automat / offsite** — doar `pg_dump` manual documentat, restore testat o singura data. Fix: cron zilnic `pg_dump -Fc` -> S3 Hetzner existent, retentie 7/4/6, test restore lunar.

## High

- **Stoc read-modify-write in Python** (`services/stock.py:134,173,205,238`) + get-or-create fara `ON CONFLICT` -> lost update. Tranzitiile de plata neidempotente (`receipts.py:605-646`) pot scadea stocul de doua ori. Fix: `UPDATE ... SET qty = qty + :d`, `with_for_update` pe bon la orice mutatie.
- **Un singur worker, tot in memorie** (`deploy/entrypoint.sh:18`): broadcaster SSE, slowapi, login-throttle, 2 instante APScheduler. Blocheaza scalarea orizontala. bcrypt sincron pe event loop la login ingheata POS-ul. Fix: `asyncio.to_thread` pt bcrypt (S); Redis pub/sub + rate-limit, scheduler in container separat (M) -> `-w 2-4`; pgbouncer cand creste numarul de workeri.
- **Logica de business in routere**: doar 9/42 routere folosesc un service; `receipts.py` 1.085 linii, `reports.py` 1.937 linii cu 49 modele Pydantic inline si 33 query-uri raw. `_require_super_admin` definit in `routers/admin.py` si importat de 7 module. Fara repository layer.
- **Zero CI, zero lint, teste manuale**: fara `.github/`, fara pytest (harness custom pe SQLite care sare tabelele JSONB), fara ESLint/Prettier/Vitest in FE. Singura poarta e `tsc -b`. Logica fiscala din `utils/generateDocuments.ts` (2.277 linii, 24 `any`) netestata.
- **FE monolitic**: `Rapoarte.tsx` 3.843 linii, `HotelAnvelope.tsx` 3.156 (59 signals, 388 `style=` inline), `ShoppingList.tsx` 2.265; `global.css` 7.779 linii / 130 KB incarcat pe orice ruta; 2.337 atribute `style=` inline; 25 `!important`; ~92 clase moarte.
- **Abstractii construite, neadoptate**: `createForm` si `useAction` 0 utilizari; `Modal.tsx` (focus-trap, Escape, `role=dialog`) folosit in 12 locuri vs 55 overlay-uri scrise manual; 291 signals de loading, 202 `setError`, 78 try/catch re-implementate per pagina. Doar `notify()` a prins.
- **Fara API layer tipat**: 248 `apiFetch` in 45 fisiere, 133 URL-uri literale in pagini, 322 tipuri scrise de mana, `Client` duplicat cu drift (`types/client.ts` vs `Clienti.tsx`). SSE trimite JWT in query string.
- **Responsive**: 11 breakpoint-uri distincte (480…1200), `isMobile` duplicat in 6 fisiere cu praguri diferite; cautari server la fiecare keystroke fara debounce/abort in 4 ecrane; zero virtualizare (HotelAnvelope `limit=500`); 6 `<table>` fara wrapper de scroll; navbar sticky fara `safe-area-inset-top` in PWA. `logo.png` 793 KB incarcat pe orice pagina si folosit ca favicon.
- **Hardening**: HSTS comentat (`nginx.conf:46`), Caddy `:80` fara redirect, fara `.dockerignore` (venv, dump-uri, `backend/.env`, chei SSH in build context), containere root, `requirements.txt` doar `>=`, zero Sentry/metrici/uptime, log Docker fara rotire.

## Medium (selectie)

- N+1 in `_resolve_item_link` per linie de bon; lipsa index `items(account_id,name)`; `ilike '%q%'` fara pg_trgm; cursor gresit la clienti (`clienti.py:37-38` vs `:62`); liste fara limit (`leaves.py`, `programare.py`); rapoarte cu `(created_at AT TIME ZONE ...)::date` non-sargabil -> seq-scan; fara retentie pe `user_sessions`, `email_logs`, `stock_movements`.
- Config imprastiat in `os.getenv` cu defaulturi de prod hardcodate; `GlobalSettings` singleton reimplementat 7 ori; `programare.py` 0/5 `response_model`; `TaskRun` in `efactura/models.py`.
- a11y: 90 `aria-*` in 47k linii, `<html lang="en">`, reduced-motion doar pe logo.
- Shell-ul FE (`Protected` + NavBar + `/api/auth/me`) se remonteaza la fiecare navigare; `AdminV2` 196 KB si `Configurari` 125 KB importa toate sectiunile static.

## Plan de actiune propus

**Sprint 0 — securitate & date (1-2 zile, toate S):** scoate dump-urile si parolele din git + filter-repo; fail-fast `SECRET_KEY`; backup zilnic in S3; unique + `UPDATE ... RETURNING` pe numerotare; `UPDATE` atomic pe stoc; `with_for_update` pe bon; `.dockerignore`; HSTS + redirect; `asyncio.to_thread` bcrypt.

**Sprint 1 — plasa de siguranta (M):** GitHub Actions cu ruff + pytest (httpx AsyncClient + Postgres testcontainer) + `alembic check` + tsc + ESLint(+solid) + Prettier + Vitest pe utils/pdf/api/permissions/cart + docker build tag=SHA; Sentry/GlitchTip + uptime pe `/api/health`; pin requirements; log rotation.

**Sprint 2 — quick wins FE (S):** logo WebP per utilizare; debounce 300 ms + AbortController (pattern existent in `Clienti.tsx:145-150`); `.table-wrap` pe tabelele neprotejate; `100dvh` + `safe-area-inset`; `lang="ro"`; indexuri lipsa si limit obligatoriu pe liste.

**Sprint 3+ — structura pentru extensibilitate (M-L, incremental, per modul):**
- Backend: `dependencies.py` primeste `_require_super_admin`, un singur `get_global_settings()`, `pydantic-settings`; extrage `receipts_service`, `leaves_service`, `schemas/reports.py`; mixin-uri Tenant/Timestamp/SoftDelete; CRUD router factory pentru cele ~15 nomenclatoare aproape identice.
- Frontend: tipuri generate din OpenAPI (`openapi-typescript`) + `src/api/<entitate>.ts`, fara URL-uri in pagini; `createListResource` (sau solid-query) + adopta `useAction`/`createForm`, incepand cu cele 14 panouri Configurari; `TanStackTable` generic + column factories; `Modal.tsx` peste tot; `createMediaQuery` cu 3-4 breakpoint-uri canonice; `routes.ts` unic + layout parent + `lazy()` per sectiune admin/config/rapoarte; sparge `global.css` per feature.
- Scalare: Redis (pub/sub, rate-limit, throttle) -> `-w 2-4`, scheduler separat, pgbouncer, `statement_timeout` + `pg_stat_statements`, joburi de retentie.

## Status fata de rapoartele din mai 2026

Rezolvate: parole admin hardcodate, boto3 blocant, SSE cu sesiune DB, pagination hook/component, ErrorBoundary, run-all auth. Inca deschise: `SECRET_KEY` fallback, chei S3 in `.env.example`, backup automat, OAuth nonce, `limit=200` in Configurari, guard pe `/adminv2`. "CIUS-RO 1.0.1 -> 1.0.9 BLOCKER" e probabil fals-pozitiv (1.0.1 e CustomizationID oficial ANAF), de confirmat.

Neverificat (fara acces ssh/DB): configuratia reala de pe servere, `deploy-qa.sh`, comportamentul `X-Forwarded-For` la runtime, estimarea de acoperire a testelor (10-15%).
