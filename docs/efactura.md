# RO e-Factura ANAF — notițe importante

## Obligație legală
- OUG 120/2021 — toate facturile B2B/B2C/B2G se transmit electronic prin SPV ANAF.
- Termen: max **5 zile lucrătoare** de la emitere.
- Amenzi per factură netransmise: 1.000–10.000 lei (categorie contribuabil).

## Arhitectură

```
Receipt (BerlinStar) → mapping.py → UBL 2.1 XML → ANAF /upload → /stareMesaj → /descarcare
                                ↑                                  ↑
                       AnafSettings per CUI            APScheduler jobs (poll, upload, sync)
                       (client_id, secret, redirect)
```

Trei nivele de configurare:
1. **Global** — `efactura_global_settings` (singleton): Fernet key, URL-uri ANAF, scheduler on/off → `AdminV2 → eFactura → Configurare globală`
2. **Per-companie** — `anaf_settings` (per CUI): OAuth credentials, sandbox/prod, payment terms → `Configurări → eFactura ANAF` (user) sau `AdminV2 → eFactura → Companii` (admin)
3. **Per-cont** — companiile sunt linkate de account_id, deci accesul user se face automat

## OAuth + USB (flow autentificare)

**90 de zile valabilitate** pentru `refresh_token`. La expirare e nevoie de USB:

```
[User cu USB plugat]
      │ click "Conectează la ANAF"
      ▼
[Browser] → ANAF SPV (logincert.anaf.ro)
      │     middleware Windows citește certificat USB
      │     (CertSign / DigiSign / TransSped / AlfaSign)
      │     user introduce PIN-ul USB-ului
      ▼ ANAF redirect cu ?code=...&state=<JWT>
[BerlinStar /api/efactura/callback]
      │ POST /token (server-to-server, fără USB)
      ▼
[anaf_tokens] (criptat Fernet, expires_at = now + 90 zile)
```

**Server-ul NU atinge USB-ul niciodată** — totul se întâmplă în browser-ul user-ului.
Refresh-ul automat în background folosește doar `refresh_token` (fără USB).

## Tabele DB

| Tabel | Rol |
|---|---|
| `efactura_global_settings` | Singleton — Fernet key, URL-uri ANAF, scheduler flag |
| `anaf_settings` | Per company_id — OAuth credentials, sandbox/prod, behavior |
| `anaf_tokens` | Per company_id — access/refresh tokens criptați Fernet |
| `efactura_records` | State machine: draft → pending_upload → in_prelucrare → accepted/rejected |
| `efactura_received_index` | Cache facturi primite din SPV (`/listaMesajeFactura?filtru=P`) |

Coloane noi pe tabele existente:
- `receipts`: currency, due_date, invoice_type_code (380/381/386/751), tax_exclusive_total, tax_total, is_extern, parent_receipt_id
- `receipt_items`: vat_category (S/Z/E/O/K/G/L/M/AE), vat_percent, unit_code (UNECE Rec 20), tax_exemption_reason
- `companies`: email, legal_form, street, city, county_code (RO-B etc.), country_code
- `clienti`: street, city, county_code, country_code, postal_code

## Endpoint-uri API

### User (filtrate pe `account_id` din JWT)
- `GET /api/efactura/my-companies` — lista companiilor user-ului + status OAuth
- `GET/PATCH /api/efactura/companies/{id}/settings`
- `POST /api/efactura/companies/{id}/connect` — returnează `authorize_url` ANAF
- `GET /api/efactura/callback` — primește `?code&state`, salvează tokeni
- `POST /api/efactura/companies/{id}/disconnect`
- `POST /api/efactura/companies/{id}/test-connection`
- `POST /api/efactura/receipts/{id}/validate` — pre-upload check fără transmitere
- `GET /api/efactura/receipts/{id}/xml` — preview UBL
- `POST /api/efactura/receipts/{id}/upload`
- `POST /api/efactura/receipts/{id}/retry`
- `GET /api/efactura/receipts/{id}/status` (cu auto-poll dacă `in_prelucrare`)
- `GET /api/efactura/receipts/{id}/download` — ZIP răspuns ANAF
- `GET /api/efactura/companies/{id}/records?status=...`
- `GET /api/efactura/companies/{id}/audit` — receipts cu câmpuri lipsă pentru eFactura
- `GET /api/efactura/companies/{id}/received` — facturi primite (cache)
- `GET /api/efactura/companies/{id}/pending-deadlines?days_ahead=5`

### Admin (super admin via `_require_super_admin`)
- `GET /api/admin/efactura/global` — config global
- `PATCH /api/admin/efactura/global` — `fernet_key="AUTO"` regenerează cheia
- `POST /api/admin/efactura/global/test-setup` — verifică Fernet + ping URLs ANAF + scheduler
- `GET /api/admin/efactura/companies` — toate companiile cu status
- `GET/PATCH /api/admin/efactura/companies/{id}/settings`
- `POST /api/admin/efactura/companies/{id}/test-connection`
- `GET /api/admin/efactura/dashboard` — counters pe status + connected_companies
- `GET /api/admin/efactura/jobs` + `POST /api/admin/efactura/jobs/{name}/trigger`

## Scheduler (APScheduler — `efactura_global_settings.scheduler_enabled`)

| Job | Interval | Acțiune |
|---|---|---|
| `efactura_upload_pending` | 5 min | Upload facturi `status=pending_upload` (max 3 attempts) |
| `efactura_poll_status` | 10 min | `GET /stareMesaj` pentru `in_prelucrare` |
| `efactura_download_responses` | 30 min | Descarcă ZIP-uri pentru `accepted`/`rejected` → S3 |
| `efactura_deadline_alert` | zilnic 08:00 | Email SMTP cu facturi cu deadline <= 2 zile lucrătoare |
| `efactura_token_expiry_alert` | zilnic 09:00 | Email SMTP cu tokeni care expiră în <14 zile (necesită USB) |
| `efactura_sync_received` | 60 min | `GET /listaMesajeFactura?filtru=P` → upsert în received_index |

Timezone: `Europe/Bucharest`. Toate au `coalesce=True, max_instances=1`.

## Configurare la primul start

1. `alembic upgrade head` aplică ef01 → ef10 (creează tabele + singleton + populare defaults)
2. Backend pornește → `runtime_config.ensure_initialized()` în lifespan:
   - Verifică rândul singleton (id=1) cu defaults pentru URL-uri ANAF
   - **Auto-generează Fernet key** dacă lipsește (idempotent, persistat în DB)
3. Admin loghează la `AdminV2 → eFactura → Configurare globală`:
   - Vede toate URL-urile populate cu valorile oficiale ANAF
   - Apasă "Testează configurarea" → verifică conectivitate
   - Toggle scheduler dacă vrea în background
4. User (sau admin) loghează la `Configurări → eFactura ANAF`:
   - Pentru fiecare companie, completează `client_id`, `client_secret`, `redirect_uri` (primite la `anaf.ro/InregOauge`)
   - Toggle Sandbox/Producție
   - Apasă "Conectează la ANAF" cu USB-ul plugat

## URL-uri oficiale ANAF (valori default DB)

| Endpoint | URL |
|---|---|
| OAuth Authorize | `https://logincert.anaf.ro/anaf-oauth2/v1/authorize` |
| OAuth Token | `https://logincert.anaf.ro/anaf-oauth2/v1/token` |
| API Sandbox | `https://api.anaf.ro/test/FCTEL/rest` |
| API Producție | `https://api.anaf.ro/prod/FCTEL/rest` |
| Validator XML | `https://www.anaf.ro/uploadxmi/` |
| Înregistrare OAuth | `https://www.anaf.ro/InregOauth` |

Înregistrarea OAuth durează **5–10 zile lucrătoare** la ANAF — nu este instant.

## Maparea Receipt → UBL 2.1 (CIUS-RO 1.0.9)

### CustomizationID (obligatoriu)
```
urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1
```

### Payment means code (ISO 4461) — mapare din `Receipt.pay_method`
- CASH → 10
- CARD → 48
- OP → 30 (transfer)
- NEPLATIT, PARTIAL → 30

### Unit codes (UNECE Rec 20) — fallback din `unit` text
- buc, pc → C62
- kg → KGM
- l → LTR
- m → MTR
- ore → HUR
- (default fallback C62)

### TVA category — `S` (standard), `Z` (zero), `E` (exempt), `O` (outside), `AE` (reverse charge)
### TVA percent — 0 / 5 / 9 / 19 (toate cotele RO valide; default din `company.tva_percentage` dacă item nu are)

## Limite ANAF (atenție la rate limiting)

| Endpoint | Limită |
|---|---|
| Toate | 1.000 apeluri/minut |
| `/upload` | nelimitat |
| `/stare` per mesaj | 100/zi |
| `/lista` simplă | 1.500/zi/CUI |
| `/lista` paginat | 100.000/zi/CUI |
| `/descarcare` per mesaj | 10/zi |

Depășiri repetate → blocare aplicație. Toate apelurile au exponential backoff.

## Securitate

- Tokenii OAuth se stochează **criptat Fernet** în DB (`anaf_tokens.access_token_enc`, `refresh_token_enc`).
- Cheia Fernet este în `efactura_global_settings.fernet_key` (auto-generată la primul start).
- Schimbarea cheii Fernet face inutile toți tokenii existenți — companiile vor trebui să se reconecteze cu USB.
- `state` JWT (10 min validitate) protejează `/callback` împotriva CSRF.
- Acces user este filtrat după `account_id` — fiecare user vede doar companiile proprii.
- Acces admin (super admin: username="admin") via `_require_super_admin`.

## Arhivare (10 ani — cerință legală)

- XML emise: `accounts/{account_id}/efactura/sent/{year}/{factura_nr}.xml`
- ZIP-uri răspuns ANAF (cu sigiliu electronic): `efactura/companies/{company_id}/responses/{year}/{record_id}.zip`
- Storage: S3 (Hetzner Object Storage)

## Module backend

```
backend/app/efactura/
├── crypto.py             # Fernet helpers + module-level cache
├── runtime_config.py     # singleton config + ensure_initialized()
├── models.py             # 5 tabele eFactura
├── schemas.py            # Pydantic API contracts
├── exceptions.py         # AnafConfigError, AnafTokenExpired, AnafValidationError etc.
├── oauth_service.py      # Authorization Code Grant + auto-refresh
├── anaf_client.py        # httpx async wrapper pentru endpoint-urile ANAF
├── mapping.py            # Receipt → InvoicePayload + 10 categorii validări
├── xml_builder.py        # Jinja2 render UBL 2.1
├── xml_validator.py      # Schematron CIUS-RO opțional
├── service.py            # Orchestrator prepare_and_upload, poll_status, download
├── scheduler.py          # APScheduler jobs (6) + email alerts SMTP
├── router.py             # /api/efactura/* (user)
├── router_admin.py       # /api/admin/efactura/* (admin)
└── templates/
    └── ubl_invoice_2_1.xml.j2
```

## Resurse oficiale

- [Pagina tehnică MF](https://mfinante.gov.ro/web/efactura/informatii-tehnice)
- [API eFactura PDF](https://mfinante.gov.ro/static/10/eFactura/prezentare%20api%20efactura.pdf)
- [Procedură înregistrare OAuth](https://static.anaf.ro/static/10/Anaf/Informatii_R/API/Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf)
- [Validator XML online](https://www.anaf.ro/uploadxmi/)
- [Coduri UNECE Rec 20](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNECERec20/)
- [Coduri payment means (UNCL4461)](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL4461/)
