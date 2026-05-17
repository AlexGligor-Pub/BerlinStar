# Code Review — Implementări ultimele 4 zile (2026-05-14 → 2026-05-17)

## Context

Code review expert al implementărilor făcute pe branch-ul `AddVulcanizareAlex` în ultimele 4 zile (40 commits, ~47.500 inserții, ~5.800 ștergeri pe 212 fișiere). Focus principal pe **integrarea RO e-Factura ANAF end-to-end** (commit-urile `d541c79`, `ea9930f`, `56ff54a` — ~5970 linii nou-adăugate de cod backend + frontend), cu acoperire secundară pe:
- Script de import legacy BerlinV3 SQL Server → PostgreSQL (`3ccc3a5`, `fbc04cf`, `3b06969`)
- Sistem rapoarte cu scheduler + endpoint nou `run-all` (`bbcd47e`, `5b9ab19` + 8 commit-uri de extensie)
- Refactor major (split AdminV2 / Configurari / Rapoarte în submodule — `7d9d104`, ~13.7k linii reorganizate)

Code review-ul s-a făcut cu 3 agenți Explore în paralel pe 3 arii (backend eFactura, frontend eFactura, import + rapoarte), plus verificare manuală în cod pentru toate descoperirile cu severitate `BLOCKER`/`CRITICAL` (filtrare halucinații agent).

## Sumar pe severitate (după verificare în cod)

| Severitate | eFactura backend | eFactura frontend | Import legacy + rapoarte | TOTAL |
|---|---|---|---|---|
| **BLOCKER** | 2 | 0 | 1 | **3** |
| **CRITICAL** | 6 | 1 | 3 | **10** |
| **HIGH** | 8 | 4 | 4 | **16** |
| **MEDIUM** | 6 | 5 | 3 | **14** |
| **LOW** | 2 | 1 | 0 | **3** |
| **TOTAL** | **24** | **11** | **11** | **46** |

> Notă metodologică: am eliminat ~10 finding-uri propuse de agenți care s-au dovedit false după verificare în cod (e.g., agent backend a raportat "missing NOT NULL" pe coloane care erau de fapt `nullable=False`; agent backend a propus "SQL injection via status_filter" și apoi s-a auto-corectat — am scos ambele).

---

## TOP 10 — Cele mai urgente fix-uri

Ordinea de execuție recomandată (impact × ușurință):

1. **BLOCKER — CIUS-RO version 1.0.1 (corect: 1.0.9)** [backend/app/efactura/mapping.py:28](backend/app/efactura/mapping.py#L28)
2. **BLOCKER — Template UBL fără `ProfileID` și fără `TaxPointDate`** [backend/app/efactura/templates/ubl_invoice_2_1.xml.j2](backend/app/efactura/templates/ubl_invoice_2_1.xml.j2)
3. **BLOCKER — Endpoint `POST /admin/reports/run-all` fără verificare admin** [backend/app/routers/admin_reports.py:101-149](backend/app/routers/admin_reports.py#L101-L149)
4. **CRITICAL — OAuth state JWT generează `nonce` dar nu îl validează la callback** [backend/app/efactura/oauth_service.py:48-67](backend/app/efactura/oauth_service.py#L48-L67)
5. **CRITICAL — Token refresh fără `SELECT ... FOR UPDATE` (race condition)** [backend/app/efactura/oauth_service.py:255-270](backend/app/efactura/oauth_service.py#L255-L270)
6. **CRITICAL — Idempotency key absent pe `POST /receipts/{id}/upload`** [backend/app/efactura/router.py:493-526](backend/app/efactura/router.py#L493-L526)
7. **CRITICAL — Scheduler rapoarte fără `max_instances=1`** [backend/app/services/reports/scheduler.py:35-48](backend/app/services/reports/scheduler.py#L35-L48)
8. **CRITICAL — Script import legacy: phase-uri fără tranzacție atomică** [backend/scripts/import_legacy_vulcanizare.py:624-660](backend/scripts/import_legacy_vulcanizare.py#L624-L660)
9. **CRITICAL — Duplicare CompanyEditor între `EFacturaSection` (admin) și `EFacturaPanel` (user)** [frontend/src/pages/adminv2/EFacturaSection.tsx:638-900](frontend/src/pages/adminv2/EFacturaSection.tsx#L638-L900) + [frontend/src/pages/configurari/EFacturaPanel.tsx:174-469](frontend/src/pages/configurari/EFacturaPanel.tsx#L174-L469)
10. **CRITICAL — `window.location.href = d.authorize_url` fără whitelist domeniu** [frontend/src/pages/configurari/EFacturaPanel.tsx:241-242](frontend/src/pages/configurari/EFacturaPanel.tsx#L241-L242) + [frontend/src/pages/adminv2/EFacturaSection.tsx:701-702](frontend/src/pages/adminv2/EFacturaSection.tsx#L701-L702)

---

## 1. Conformitate ANAF / UBL 2.1 / CIUS-RO 1.0.9

### 1.1 [BLOCKER] CIUS-RO version 1.0.1 — toate facturile vor fi respinse
**Fișier:** [backend/app/efactura/mapping.py:27-28](backend/app/efactura/mapping.py#L27-L28)
```python
CIUS_RO_CUSTOMIZATION_ID = (
    "urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1"
)
```
Documentația proprie ([docs/efactura.md:135](docs/efactura.md#L135)) menționează `CIUS-RO:1.0.9`, dar codul real este 1.0.1. ANAF respinge la Schematron toate factura cu versiune neactualizată.
**Fix:** schimbă în `1.0.9` și extrage într-un `const` reusabil + adăugă test snapshot pe XML-ul generat.

### 1.2 [BLOCKER] Template UBL fără `cbc:ProfileID` și `cbc:TaxPointDate`
**Fișier:** [backend/app/efactura/templates/ubl_invoice_2_1.xml.j2](backend/app/efactura/templates/ubl_invoice_2_1.xml.j2)
Template-ul are doar `<cbc:CustomizationID>` apoi `<cbc:ID>`. Pentru CIUS-RO conform EN 16931:
- `<cbc:ProfileID>` este obligatoriu (de regulă `urn:cen.eu:en16931:2017`).
- `<cbc:TaxPointDate>` (sau invariant: `InvoicePeriod`) este cerut de Schematron când există TVA.

**Fix:**
```xml
<cbc:CustomizationID>{{ payload.customization_id }}</cbc:CustomizationID>
<cbc:ProfileID>urn:cen.eu:en16931:2017</cbc:ProfileID>
<cbc:ID>{{ payload.invoice_number | e }}</cbc:ID>
<cbc:IssueDate>{{ payload.issue_date.isoformat() }}</cbc:IssueDate>
{%- if payload.tax_point_date %}
<cbc:TaxPointDate>{{ payload.tax_point_date.isoformat() }}</cbc:TaxPointDate>
{%- endif %}
```
Și adăugă `tax_point_date: date | None` în `InvoicePayload` din [mapping.py](backend/app/efactura/mapping.py).

### 1.3 [HIGH] Currency hardcoded `RON` fără validare
**Fișier:** [backend/app/efactura/mapping.py:473](backend/app/efactura/mapping.py#L473)
ANAF acceptă **doar RON** în SPV pentru entități rezidente. Codul face fallback la "RON" dacă lipsește, dar nu rejectează alte valori (USD, EUR), care vor trece la upload și vor fi respinse la procesare.
**Fix:** validare `if currency != "RON": errors.append(...)` în `_validate_payload`.

### 1.4 [HIGH] `InvoiceTypeCode 751` nu e valid în CIUS-RO
**Fișier:** [backend/app/efactura/schemas.py:39](backend/app/efactura/schemas.py#L39)
CIUS-RO permite doar `380` (factură), `381` (credit note), `384` (corrected invoice), `389` (self-billed). `751` (auto-invoice for VAT) e UBL generic, nu CIUS-RO. Verifică cu ANAF; în caz contrar elimină din `allowed`.

### 1.5 [MEDIUM] `_resolve_unit_code` cade silent pe `C62` pentru unități necunoscute
**Fișier:** [backend/app/efactura/mapping.py:44-59](backend/app/efactura/mapping.py#L44-L59)
Dacă un item are `unit="kit"` (sau orice altceva neprezent în mapping), codul tratează ca `C62` (piese). Conform UNECE Rec 20 ar fi greșit semantic. Fix: log `WARNING` și raise `AnafValidationError` cu mesaj clar, ca user-ul să corecteze în Item înainte de upload.

### 1.6 [MEDIUM] Format sume cu `'%.2f'` în Jinja
**Fișier:** [backend/app/efactura/templates/ubl_invoice_2_1.xml.j2](backend/app/efactura/templates/ubl_invoice_2_1.xml.j2)
Toate sumele se formatează cu `'%.2f'`. Dacă upstream-ul nu garantează `Decimal` cu quantize 2 (există `_q2` în mapping, e ok), e bine. Atenție însă: când upstream-ul ajunge să schimbe TVA în percentaj fracționar (e.g., 19.5%) și rounding-ul devine ambiguu (BANKERS vs HALF_UP), facturile la scară mare vor avea micro-diferențe între `TaxAmount` și `sum(LineTaxAmount)`, ceea ce trântește Schematron-ul. Recomandare: documentează explicit `ROUND_HALF_UP` în `_q2` și adaugă test pe rounding de 0.005.

---

## 2. Securitate

### 2.1 [BLOCKER] `POST /admin/reports/run-all` accesibil oricărui user logat
**Fișier:** [backend/app/routers/admin_reports.py:101-149](backend/app/routers/admin_reports.py#L101-L149)
Endpoint-ul declanșează rebuild-ul *tuturor* rapoartelor pe interval arbitrar (`period_start..period_end`), bypass-uind cooldown-ul. Are doar `Depends(get_account_id)` (autentificare), fără verificare admin. Orice user logat poate triggerui rebuild masiv → DoS (rate limit 3/min e simbolic pentru un job care durează minute pe DB).
**Fix:** adaugă `Depends(require_admin)` sau echivalent (`_require_super_admin` din eFactura admin router este modelul corect). Adaugă audit log pe trigger cu `account_id` și parametri.

### 2.2 [CRITICAL] OAuth state JWT — `nonce` generat dar nevalidat
**Fișier:** [backend/app/efactura/oauth_service.py:48-67](backend/app/efactura/oauth_service.py#L48-L67)
`_encode_state` pune `nonce: secrets.token_urlsafe(16)` în JWT. `_decode_state` decodează JWT-ul, citește `cid`, dar **nu compară nonce-ul cu nimic** (nu e stocat server-side). Asta înseamnă că orice JWT semnat cu același `SECRET_KEY` (orice user logat poate genera unul) e acceptat la callback. Singura protecție rămasă e `iat`/`exp` (10 min), care nu împiedică replay în fereastră.
**Fix:** stochează nonce într-o tabelă tranzitorie (`oauth_states(state_id, nonce, company_id, expires_at)`) sau în Redis. Pe callback, single-use lookup + delete. Alternativ, leagă state-ul de `session_id` user.

### 2.3 [CRITICAL] Token refresh fără pessimistic lock
**Fișier:** [backend/app/efactura/oauth_service.py:255-270](backend/app/efactura/oauth_service.py#L255-L270)
`get_valid_access_token` citește tokenul, vede `seconds_left < 300`, cheamă `_refresh_token`. Două requesturi concurrente (e.g., scheduler upload + user manual upload) → 2 refresh în paralel cu același `refresh_token`. ANAF rotește refresh-token la fiecare schimb, deci al doilea va primi `invalid_grant` și *invalidează tokenul valid*. Companii cu activitate ridicată vor sări periodic la disconnect și vor cere reconnect cu USB.
**Fix:**
```python
token = (await db.execute(
    select(AnafToken).where(AnafToken.company_id == company_id).with_for_update()
)).scalar_one_or_none()
```
și asigură o tranzacție explicită (`async with db.begin():`). Sau folosește un `asyncio.Lock` per `company_id` în-process *plus* DB lock pentru multi-worker.

### 2.4 [CRITICAL] Idempotency key absent pe `/upload`
**Fișier:** [backend/app/efactura/router.py:493-526](backend/app/efactura/router.py#L493-L526)
Dublu-click pe "Trimite la ANAF" poate crea 2 `EFacturaRecord` pentru același `receipt_id` și trimite XML-ul de 2 ori. ANAF poate accepta ambele (mesaje cu `index_incarcare` diferite) → factură duplicat în SPV, conflict legal.
**Fix:** unique constraint pe `(receipt_id, status NOT IN ('error','rejected'))` *ȘI* check explicit la enter: `if existing_active_record(receipt_id): return existing`. Alternativ, antet `Idempotency-Key` standard (RFC 7807-style) cu tabelă scurtă de cache.

### 2.5 [CRITICAL] Cheia Fernet — fallback silent la ENV poate decripta cu cheia greșită
**Fișier:** [backend/app/efactura/crypto.py:34-39](backend/app/efactura/crypto.py#L34-L39)
Cache + fallback `os.getenv("ANAF_FERNET_KEY")` fără verificare că e cea curentă din DB. La deploy cu multi-pod, dacă DB-ul a fost rotit dar `.env` nu, decryption va eșua intermitent (uneori cu cheia veche, uneori cu cea nouă, în funcție de ce e cache-uit).
**Fix:** elimină fallback la env în cod de runtime — env-ul trebuie folosit doar la *seed* inițial. La fiecare `get_cipher()`, dacă cache-ul e invalid, re-citește din DB. Versionează cheia (`fernet_key_version`) pentru rotation graceful.

### 2.6 [CRITICAL] `window.location.href = d.authorize_url` fără whitelist
**Fișier:** [frontend/src/pages/configurari/EFacturaPanel.tsx:241-242](frontend/src/pages/configurari/EFacturaPanel.tsx#L241-L242) + [frontend/src/pages/adminv2/EFacturaSection.tsx:701-702](frontend/src/pages/adminv2/EFacturaSection.tsx#L701-L702)
Răspunsul de la `/connect` e folosit direct ca redirect. În scenariul unei vulnerabilități upstream (SSRF / compromise DB / inject prin Configurări) atacatorul poate seta `anaf_auth_url` la un host arbitrar și fura codul OAuth.
**Fix:**
```typescript
const ALLOWED = ["logincert.anaf.ro", "anaf.ro"];
function safeRedirect(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED.some(d => u.hostname === d || u.hostname.endsWith("." + d));
  } catch { return false; }
}
```

### 2.7 [HIGH] `SECRET_KEY` neverificat la pornire
**Fișier:** [backend/app/efactura/oauth_service.py:27](backend/app/efactura/oauth_service.py#L27) (sursa: `app.config`)
State JWT-urile (mecanismul anti-CSRF) și access JWT-urile aplicației partajează `SECRET_KEY`. Dacă în dev e un default scurt, întregul flux OAuth devine forgeable. Necesar un assert la startup: `len(SECRET_KEY) >= 32`.

### 2.8 [HIGH] Leak token în loguri de la ANAF
**Fișier:** [backend/app/efactura/oauth_service.py:152, 232](backend/app/efactura/oauth_service.py#L152)
`log.error("... body=%s", resp.text[:500])` poate include token în răspunsuri de eroare. Adaugă `_sanitize_error()` care strip-ează `Bearer …` și paramii `access_token=…`/`refresh_token=…`.

### 2.9 [HIGH] FK `AnafToken.company_id ON DELETE CASCADE`
**Fișier:** [backend/app/efactura/models.py:27,51](backend/app/efactura/models.py#L27)
Ștergerea (hard delete) a unei companii curăță token-ul, pierzând orice audit trail. eFactura are obligație de retenție 10 ani. **Fix:** schimbă la `ON DELETE SET NULL` (sau interzice hard-delete pe companii cu tokens prin business rule) și marchează cu `is_deleted` boolean.

### 2.10 [HIGH] IDOR risc pe `/api/admin/efactura/companies`
**Fișier:** [backend/app/efactura/router_admin.py:102-139](backend/app/efactura/router_admin.py#L102-L139)
Listă globală de companii fără filter pe `account_id`. Protejat de `_require_super_admin`, dar fără defense-in-depth (audit log pe access, alertă pe call rate atypic).

---

## 3. Concurrency / Resiliency

### 3.1 [BLOCKER] Scheduler rapoarte fără `max_instances=1`
**Fișier:** [backend/app/services/reports/scheduler.py:35-48](backend/app/services/reports/scheduler.py#L35-L48)
Job `reports_business_hours_incremental` are `coalesce=True, misfire_grace_time=600`, dar lipsește `max_instances=1`. Default APScheduler e `max_instances=1` *per nume* dar **doar la nivel de scheduler instance**; cu multiple workeri uvicorn nu protejează nimic. La rebuild masiv care durează > 2h, două trigger-uri consecutive se suprapun → UPDATE-uri pe `report_runs` concurente, posibil lost-update.
**Fix:** adaugă `max_instances=1` și — pentru multi-worker — un advisory lock Postgres (`SELECT pg_try_advisory_lock(...)`).

### 3.2 [CRITICAL] `run_all` și manager `report_runs` re-deschid sesiuni (lock released)
**Fișier:** [backend/app/services/reports/manager.py:174-225](backend/app/services/reports/manager.py#L174-L225)
`with_for_update()` lockează în sesiunea 1, dar builder-ul deschide `AsyncSessionLocal()` nou → lock-ul e eliberat înainte de UPDATE-ul de status final. Fereastra de race condition e exact perioada builder-ului (poate fi minute).
**Fix:** ține un advisory lock pe `(report_type)` pe toată durata run-ului (nu pe rândul DB).

### 3.3 [HIGH] Race condition `poll_status` (scheduler + manual)
**Fișier:** [backend/app/efactura/service.py:186-218](backend/app/efactura/service.py#L186-L218)
Scenariu: scheduler citește `in_prelucrare`, user click "Verifică status". Ambele primesc răspuns de la ANAF, ambele scriu peste status. Dacă ANAF își schimbă stare între cele 2 apeluri, ultima scriere câștigă chiar dacă e stale.
**Fix:** `select … with_for_update()` la fiecare poll + check că `updated_at` n-a crescut între read și write.

### 3.4 [HIGH] Lipsă exponential backoff pe `AnafRateLimited`
**Fișier:** [backend/app/efactura/anaf_client.py:74,109](backend/app/efactura/anaf_client.py#L74)
Codul ridică `AnafRateLimited` la 429, dar service-ul nu programează retry cu backoff exponential (există `attempts` și `next_retry_at` pe model, dar logica de planificare nu pare să țină cont de retry-after-ul ANAF). Pentru `/descarcare` (10/zi/mesaj), un retry agresiv poate triggerui blocare aplicație.
**Fix:** parse header `Retry-After` și setează `next_retry_at = now + max(retry_after, 2**attempt * 30)`.

### 3.5 [MEDIUM] `coalesce=True` pe jobs lungi maschează lag
**Fișier:** [backend/app/efactura/scheduler.py](backend/app/efactura/scheduler.py)
`coalesce=True` pe `efactura_poll_status` (10 min) e ok dacă jobul durează < 10 min. Dar dacă o instanță durează 25 min (rate limit + retry), următoarele 2 trigger-uri sunt coalesced — în consecință, nu există acoperire de aproape o oră pentru poll. Monitorizează durata și alertează când > 60% din interval.

---

## 4. Bugs concrete în cod

### 4.1 [HIGH] `_normalize_license_plate` — `.replace("", "")` no-op
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py:170-181](backend/scripts/import_legacy_vulcanizare.py#L170-L181)
```python
candidate = s.strip().replace(" ", "").upper()
if LICENSE_PLATE_RE.match(candidate.replace("", "")):  # ← no-op!
    return candidate
```
`str.replace("", "")` *NU* face nimic (replace pe empty string = string original). Probabil intenția era `replace(" ", "")` repetată — dar e deja făcută în linia anterioară. Logica de fallback e confuză și plates valide cu spații sunt parțial gestionate, parțial nu.
**Fix:**
```python
def _normalize_license_plate(s: str | None) -> str | None:
    if not s: return None
    candidate = s.strip().upper().replace(" ", "").replace("-", "")
    return candidate if LICENSE_PLATE_RE.match(candidate) else None
```

### 4.2 [HIGH] Timezone-aware vs naive pe `expires_at`
**Fișier:** [backend/app/efactura/oauth_service.py:264-265](backend/app/efactura/oauth_service.py#L264-L265)
Codul are workaround `if expires_at.tzinfo is None: expires_at = expires_at.replace(tzinfo=timezone.utc)`. Workaround-ul e un semn că schema migrate fără `DateTime(timezone=True)` pe `anaf_tokens.expires_at`. Verifică [ef06_create_anaf_tokens.py](backend/alembic/versions/ef06_create_anaf_tokens.py) și fix-ează la sursă — adaugă migrare `ALTER COLUMN expires_at TYPE TIMESTAMP WITH TIME ZONE`.

### 4.3 [HIGH] Import legacy timezone fallback UTC
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py:234,260,277,...](backend/scripts/import_legacy_vulcanizare.py#L234)
`_aware()` attach `ROMANIA_TZ` la datetimes naive, dar pe NULL face fallback la `datetime.now(timezone.utc)`. Rezultat: bonuri create la 23:00 Europe/Bucharest stocate cu data UTC (azi 21:00) sunt categorizate diferit la daily rollup vs. cele cu data Bucharest. **Fix:** `datetime.now(ROMANIA_TZ)`.

### 4.4 [MEDIUM] `_archive_xml_to_s3` swallow exception
**Fișier:** [backend/app/efactura/service.py:240-263](backend/app/efactura/service.py#L240-L263)
Pe fail S3, returnează `""` și log warning. Record-ul e marcat ca uploaded la ANAF dar fără XML arhivat — încălcare obligație 10 ani retention. **Fix:** persistă XML inline (`anaf_records.xml_content`) ca fallback când S3 nu răspunde.

### 4.5 [MEDIUM] CUI normalization inconsistentă
**Fișier:** [backend/app/efactura/mapping.py:163](backend/app/efactura/mapping.py#L163) + [backend/app/efactura/anaf_client.py:46](backend/app/efactura/anaf_client.py#L46)
`mapping.py` adaugă prefix "RO" dacă lipsește; `anaf_client.py` îl elimină. Extrage în [backend/app/utils/cui.py](backend/app/utils/cui.py) cele 2 funcții (`with_ro_prefix`, `without_ro_prefix`) și folosește-le peste tot.

### 4.6 [MEDIUM] Parser MSSQL fără limită pe buffer multi-linie
**Fișier:** [backend/scripts/_mssql_dump_parser.py:154-184](backend/scripts/_mssql_dump_parser.py#L154-L184)
Dacă quote-ul de închidere lipsește, buffer-ul crește la dimensiunea fișierului. Pe dump-uri legacy corupte → OOM. **Fix:** `MAX_STATEMENT_SIZE = 10 * 1024 * 1024` cu raise.

### 4.7 [MEDIUM] `--log-level` neverificat
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py:672-676](backend/scripts/import_legacy_vulcanizare.py#L672-L676)
`logging.basicConfig(level=args.log_level)` crash dacă utilizatorul scrie `--log-level INVALID`. **Fix:** `choices=["DEBUG","INFO","WARNING","ERROR","CRITICAL"]`.

---

## 5. Architecture / Clean code

### 5.1 [CRITICAL] Duplicare masivă `CompanyEditor` admin ↔ user
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:638-900](frontend/src/pages/adminv2/EFacturaSection.tsx#L638-L900) + [frontend/src/pages/configurari/EFacturaPanel.tsx:174-469](frontend/src/pages/configurari/EFacturaPanel.tsx#L174-L469)
~300 linii quasi-identice (state, save, disconnect, test-conn). Singurele diferențe: endpoint base + flag `validate_schematron` (doar la admin). Maintenance: orice modificare trebuie aplicată în 2 locuri, risc divergence.
**Fix:** extrage `frontend/src/components/efactura/CompanyEditorForm.tsx` cu props `isAdmin`, `endpointBase`, `showSchematron`. Refactor-ul reduce ~250 LOC și deduplică logica de error handling.

### 5.2 [HIGH] Magic strings pentru status workflow
**Fișier:** [backend/app/efactura/service.py:140,173,200-214](backend/app/efactura/service.py#L140)
Status-uri ca `"pending_upload"`, `"in_prelucrare"`, `"in prelucrare"` (cu spațiu!), `"accepted"` apar ca string-uri raw în zeci de locuri. Risk de typo (deja vizibil: `"in_prelucrare"` vs `"in prelucrare"`).
**Fix:** `class EFacturaStatus(str, Enum)` în [models.py](backend/app/efactura/models.py) sau `schemas.py`.

### 5.3 [HIGH] Lipsă composite index pe `(company_id, status)`
**Fișier:** [backend/app/efactura/models.py:67-71](backend/app/efactura/models.py#L67-L71)
Query frecvent: `WHERE company_id = ? AND status = ?`. Singular indexes pe `status` și `company_id` nu sunt optime. **Fix:** adaugă `Index("ix_efactura_company_status", "company_id", "status")`.

### 5.4 [HIGH] Polling cu `setTimeout` fără cleanup în SolidJS
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:1215](frontend/src/pages/adminv2/EFacturaSection.tsx#L1215)
`setTimeout(() => void load(), 2500)` nu e înregistrat în `onCleanup`. Dacă user navighează imediat → callback rulează după unmount, eventual cu state stale.
**Fix:** ține `timeoutId` într-un signal și cleanup în `onCleanup`.

### 5.5 [HIGH] Lipsă loading state pe `loadDashboard` și `syncNow`
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:78-103,1215](frontend/src/pages/adminv2/EFacturaSection.tsx#L78)
UX: user nu primește feedback. Cu rețea slabă pare "blocat". Pattern-ul corect e deja folosit în `loadCompanies` (`setLoading(true)/finally`); aplică peste tot.

### 5.6 [HIGH] Test connection endpoint diferă între admin (`/refresh`) și user (`/test-connection`)
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:727-742](frontend/src/pages/adminv2/EFacturaSection.tsx#L727-L742) vs [frontend/src/pages/configurari/EFacturaPanel.tsx:266-280](frontend/src/pages/configurari/EFacturaPanel.tsx#L266-L280)
Inconsistență backend (două endpointuri pentru același test). Unifică pe backend, frontend folosește același helper.

### 5.7 [HIGH] Import legacy: faze fără tranzacție atomică
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py:624-660](backend/scripts/import_legacy_vulcanizare.py#L624-L660)
`run()` face `session.commit()` după fiecare fază (1-5). Fail în fază 4 lasă cont parțial cu companii/clienți/produse dar fără bonuri → manual cleanup obligatoriu. **Fix:** wrap totul într-o tranzacție outer cu savepoints (`begin_nested`) pentru debugging.

### 5.8 [HIGH] Lipsă tests pentru module noi
- `backend/app/efactura/` — 14 fișiere, **0 teste**. Mapping (493 LOC) e candidate ideal pentru golden snapshot tests pe XML-ul generat.
- `backend/app/services/reports/` — manager + builder + scheduler, **0 teste**.
- Script import legacy — **0 teste** (deși fezabil cu fixture-uri SQL dump mici).

**Recomandare:** prioritizează `test_mapping.py` cu un Receipt complet → XML diff vs. fixture. Plus snapshot la fiecare versiune CIUS-RO.

### 5.9 [MEDIUM] `Record<string, unknown>` excesiv în frontend
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:249](frontend/src/pages/adminv2/EFacturaSection.tsx#L249)
PATCH body tipuit ca `Record<string, unknown>` pierde compile-time check pe câmpuri. Extrage `types/efactura.ts` cu `GlobalSettingsPatch`, `CompanySettingsPatch`, `ConnectResponse`.

### 5.10 [MEDIUM] `confirm()` browser dialog pentru acțiuni distructive
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx:280-307](frontend/src/pages/adminv2/EFacturaSection.tsx#L280-L307)
Regenerarea cheii Fernet folosește `window.confirm()` — UX inconsistent cu restul aplicației, nu e mobile-friendly. Există deja `frontend/src/components/ui/ConfirmDialog.tsx` adăugat în `c310c8b` — folosește-l.

### 5.11 [MEDIUM] Timezone hardcoded `"Europe/Bucharest"` în multiple fișiere
**Fișier:** [backend/app/efactura/scheduler.py:38](backend/app/efactura/scheduler.py#L38), [backend/app/services/reports/scheduler.py](backend/app/services/reports/scheduler.py), [backend/scripts/import_legacy_vulcanizare.py](backend/scripts/import_legacy_vulcanizare.py)
Extrage `BUCHAREST_TZ` într-un singur loc (`app/config.py` sau `app/utils/tz.py`) și importă peste tot. Util pentru testing și pentru deploy în altă regiune (Republica Moldova etc.).

### 5.12 [MEDIUM] Mobile responsive borderline pe `EFacturaSection`
**Fișier:** [frontend/src/pages/adminv2/EFacturaSection.tsx](frontend/src/pages/adminv2/EFacturaSection.tsx)
Aplicația țintește mobile-first. Grid `repeat(auto-fit,minmax(260px,1fr))` e ok, dar tabelele de Records/Audit/Received nu sunt TanStack Table și se sparg pe <480px. Refactor la `@tanstack/solid-table` cu coloane condiționale per breakpoint.

### 5.13 [LOW] `ResponseZIP` salvat plaintext în S3
**Fișier:** [backend/app/efactura/service.py:230](backend/app/efactura/service.py#L230)
ZIP-urile cu sigiliul ANAF se salvează unencrypted. Adaugă SSE-S3 sau client-side encryption (overhead minor).

---

## 6. Persistență / Migrations

### 6.1 [HIGH] Migrările ef01–ef10 sunt 10 fișiere separate (în loc de 1-2 logice)
**Fișier:** [backend/alembic/versions/ef01_*.py..ef10_*.py](backend/alembic/versions/)
Fiecare migrație e auto-conținută, dar șirul de FK-uri și defaults face debug-ul greoi când o singură feature trebuie rollback-uită. **Recomandare:** pe viitor, grupează modificările coerente într-un singur revision (e.g., toate adăugările la `receipts` și `receipt_items` într-o singură migrare ef01).

### 6.2 [HIGH] Migrare `mr07stoc001_add_stocuri.py` + `mr06merge001_merge_dept_and_programari_heads.py` indică head-uri concurente
**Fișier:** [backend/alembic/versions/](backend/alembic/versions/)
Au fost necesare 2 merge migrations în 4 zile — semn că team-ul lucrează pe branch-uri paralele fără coordonare alembic. **Recomandare:** un pre-commit hook care rulează `alembic heads` și fail-ează dacă > 1.

### 6.3 [MEDIUM] Lipsă constraint UNIQUE pe `efactura_records` per receipt activ
**Fișier:** [backend/app/efactura/models.py](backend/app/efactura/models.py)
Cum am menționat la 2.4, nu există protecție DB-level împotriva dublelor uploaduri concurente. Adaugă partial unique index: `CREATE UNIQUE INDEX ux_efactura_active_per_receipt ON efactura_records(receipt_id) WHERE status NOT IN ('error','rejected')`.

### 6.4 [MEDIUM] `app.log` în repo
**Fișier:** [backend/logs/app.log](backend/logs/app.log)
La majoritatea commit-urilor există modificări pe `app.log` (10k+ linii). E în repo prin design (am observat în `c0652b4` etc.), dar adăugă noise enorm la diff și `git log --stat` devine inutil. **Recomandare:** mută în `.gitignore` (la fel ca `work/` în `a2686a5`).

---

## 7. Importuri legacy (Vulcanizare)

### 7.1 [CRITICAL] Lipsă validare CUI/CIF, telefon, email
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py:214-223,409-446](backend/scripts/import_legacy_vulcanizare.py#L214-L223)
`cui=cif[:50]` stochează orice string, `_str_or_none(row.get("Phone"))` nu validează. Pentru companii fără CUI (clienți persoane fizice istorice) → fallback la `0`, ceea ce înseamnă că *toți* clienții fără CUI ajung pe același row la dedup. **Fix:** validatori dedicați + log linie cu raison de skip.

### 7.2 [HIGH] CLI defaults hardcoded (path-uri Windows)
**Fișier:** [backend/scripts/import_legacy_vulcanizare.py](backend/scripts/import_legacy_vulcanizare.py)
Verifică dacă path-urile default sunt Windows-specific (e.g., `C:\\...`). Scriptul ar trebui rulabil din Docker — toate path-urile prin `--input` cu validare.

### 7.3 [HIGH] Performanță: N+1 pe insert
Inserțiile par rând-cu-rând. La 100k+ legacy receipts, runtime-ul crește dramatic. **Fix:** `bulk_insert_mappings` pe batch-uri de 1000.

### 7.4 [HIGH] `--dry-run` nu testează commits-urile
Verifică în cod: dry-run trebuie să folosească `session.flush()` + `session.rollback()` ca să detecteze constraint violations *înainte* de a face import-ul real.

---

## 8. Aspecte pozitive (worth keeping)

- **Arhitectura modulară eFactura** (`crypto/runtime_config/oauth_service/anaf_client/mapping/xml_builder/service/scheduler/router`) e clean separation of concerns, bine numită, fiecare modul are responsabilitate clară.
- **Documentația [docs/efactura.md](docs/efactura.md)** e excelentă — arhitectură, flow OAuth+USB, table layout, rate limits ANAF, securitate. Servește ca onboarding pentru orice dev nou.
- **Parser MSSQL** are handling corect pentru `N'...'` multi-linie, escape `''`, CAST expressions, NULL — partea hard a fost făcută bine.
- **Idempotency report builders** prin `DELETE + INSERT fresh` pe perioada calculată — pattern simplu și corect.
- **`coalesce=True` + `misfire_grace_time=600`** pe scheduler reports — sound defaults.
- **Refactor `7d9d104`** (split AdminV2 / Configurari / Rapoarte) — bine făcut, reduce god-components mari (1856 LOC → submodule sub 500 LOC). Pattern de urmărit pentru viitoarele pagini.
- **Rate limit `3/minute`** pe trigger admin reports — bun reflex, deși insuficient ca apărare unică (vezi 2.1).
- **Componente UI partajate** (`ui/Modal.tsx`, `ui/Button.tsx`, `data/DataTable.tsx` din `c310c8b`) — există deja, doar nefolosite consistent în EFactura panels.

---

## 9. Roadmap recomandat (priorizat)

**Săptămâna 1 (urgent — productivă nu lucrează altfel):**
- 1.1 + 1.2 — CIUS-RO 1.0.9 + ProfileID + TaxPointDate (1 zi)
- 2.1 — admin guard pe `/admin/reports/run-all` (1h)
- 2.4 — idempotency `/upload` cu DB constraint (3-4h)
- 2.6 — whitelist redirect ANAF în frontend (2h)
- 4.1 — fix `_normalize_license_plate` (15 min)

**Săptămâna 2 (consolidare securitate):**
- 2.2 — nonce server-side pentru state OAuth (4h)
- 2.3 — pessimistic lock pe token refresh (3h)
- 2.5 — eliminare fallback env Fernet + versionare (4h)
- 2.7-2.10 — sanitize logs, FK cascade, SECRET_KEY assert, audit log admin (1 zi)

**Săptămâna 3 (clean architecture):**
- 5.1 — extract `CompanyEditorForm` reusabil (1 zi)
- 5.2 — Enum pentru status (3h)
- 5.7 — tranzacție atomică în script import (4h)
- 7.1 — validatori CUI/email/phone (3h)
- 5.8 — kickstart `test_mapping.py` cu fixture golden (1 zi)

**Săptămâna 4 (UX & maintenance):**
- 5.4, 5.5, 5.10 — UX feedback consistent, cleanup signals, ConfirmDialog reuse (1 zi)
- 5.11 — extragere `BUCHAREST_TZ` în config (1h)
- 5.12 — TanStack Table pe tabelele eFactura (1 zi)
- 6.3 — partial unique index pe records active (30 min)

---

## 10. Critical files de modificat

Backend eFactura:
- [backend/app/efactura/mapping.py](backend/app/efactura/mapping.py) — CustomizationID, currency validate, tax point date, CUI normalize
- [backend/app/efactura/templates/ubl_invoice_2_1.xml.j2](backend/app/efactura/templates/ubl_invoice_2_1.xml.j2) — ProfileID, TaxPointDate
- [backend/app/efactura/oauth_service.py](backend/app/efactura/oauth_service.py) — nonce, refresh lock, sanitize log
- [backend/app/efactura/router.py](backend/app/efactura/router.py) — idempotency `/upload`
- [backend/app/efactura/models.py](backend/app/efactura/models.py) — composite index, FK strategy, Enum status
- [backend/app/efactura/crypto.py](backend/app/efactura/crypto.py) — eliminare fallback env

Backend rapoarte:
- [backend/app/routers/admin_reports.py](backend/app/routers/admin_reports.py) — `require_admin` pe `run-all`
- [backend/app/services/reports/scheduler.py](backend/app/services/reports/scheduler.py) — `max_instances=1` + advisory lock
- [backend/app/services/reports/manager.py](backend/app/services/reports/manager.py) — re-lock strategy

Backend import:
- [backend/scripts/import_legacy_vulcanizare.py](backend/scripts/import_legacy_vulcanizare.py) — outer transaction, validators, license plate fix, log-level choices, BUCHAREST_TZ

Frontend:
- [frontend/src/pages/adminv2/EFacturaSection.tsx](frontend/src/pages/adminv2/EFacturaSection.tsx) — refactor cu `CompanyEditorForm`, loading states, cleanup setTimeout, ConfirmDialog
- [frontend/src/pages/configurari/EFacturaPanel.tsx](frontend/src/pages/configurari/EFacturaPanel.tsx) — refactor cu `CompanyEditorForm`, whitelist redirect

Nou de creat:
- [frontend/src/components/efactura/CompanyEditorForm.tsx](frontend/src/components/efactura/CompanyEditorForm.tsx) — component reusabil
- [frontend/src/types/efactura.ts](frontend/src/types/efactura.ts) — types pentru API contract
- [backend/app/utils/cui.py](backend/app/utils/cui.py) — `with_ro_prefix` / `without_ro_prefix`
- [backend/app/utils/tz.py](backend/app/utils/tz.py) — `BUCHAREST_TZ` single source
- [backend/tests/efactura/test_mapping.py](backend/tests/efactura/test_mapping.py) — golden snapshot UBL

---

## 11. Verificare end-to-end

După aplicarea fix-urilor BLOCKER + TOP 5 CRITICAL:

1. **XML generat valid**: rulează `POST /api/efactura/receipts/{id}/validate` pe un receipt complet → verifică în răspuns că `<cbc:CustomizationID>` are `1.0.9` și că `<cbc:ProfileID>` + `<cbc:TaxPointDate>` apar. Validează cu validator-ul ANAF (`https://www.anaf.ro/uploadxmi/`).

2. **OAuth state nu mai e replayabil**: declanșează `/connect` în 2 tab-uri, copiază state JWT din primul în URL-ul callback din al doilea — trebuie să eșueze cu `AnafAuthError`.

3. **Idempotency upload**: din UI dublu-click rapid pe "Trimite la ANAF" → verifică în DB că există exact 1 record activ per `receipt_id`.

4. **Admin guard reports**: cu un user non-admin (cont test), încearcă `curl -X POST /api/admin/reports/run-all` → trebuie 403.

5. **Token refresh sub concurență**: forțează expiry token (`UPDATE anaf_tokens SET expires_at = now() + interval '2 min'`), declanșează manual 2 uploads paralel din UI pe receipturi diferite → verifică în log că `_refresh_token` rulează exact o dată.

6. **Scheduler reports**: simulează rebuild lung (`period_start` cu 60+ zile), declanșează a doua oară imediat → al doilea trigger trebuie să aștepte primul (sau să fie respins de advisory lock).

7. **License plate import**: rulează `import_legacy_vulcanizare.py --dry-run` pe fixture cu plates `"B 123 ABC"`, `"HD12FAA"`, `"INVALID"` → primele 2 normalizate corect, ultima skipped cu log.

8. **UI mobile**: deschide DevTools → 375x667, navighează la Configurări → eFactura → testează că butoanele se wrap corect, modalele nu cad în off-screen.

---

## 12. Recomandări procese (în afara codului)

- **Code review obligatoriu** pe PR-uri pe `master` (chiar cu un singur developer — pentru self-review structurat după 24h).
- **`alembic heads` în pre-commit** — împiedică al treilea merge-migration în 2 săptămâni.
- **Adoptă `ruff` + `mypy --strict` pe `app/efactura/`** — modulul e suficient de matur pentru type strictness.
- **Configurează `pytest --cov` cu prag minim 60% pe `app/efactura/`** — momentan e 0%.
- **Documentează în [docs/efactura.md](docs/efactura.md) procesul de rotation Fernet key** — există suport în cod dar runbook lipsește.
