# Pagina unificată e-Factura (`/efactura`)

Implementare: 2026-05-19. Vezi și [docs/efactura.md](efactura.md) pentru flow-ul ANAF de bază.

## Context

Pagina veche `/efactura-primite` afișa o listă plată de carduri, fără modal de detalii, fără PDF, fără tracking citit/necitit, și nu acoperea facturile trimise (vizibile doar din AdminV2). Înlocuită cu o pagină de tip CRM e-Factura: sidebar stânga, tabele paginate cu TanStack Table, modal cu detalii complete parsate din UBL, printare PDF, auto mark-as-read.

## Rute

```
/efactura                  → redirect /efactura/primite
/efactura/primite          → lista facturi primite din SPV
/efactura/trimise          → lista EFacturaRecord direction=sent (toate statusurile)
/efactura-primite          → redirect /efactura/primite (compat link-uri vechi)
```

Toate sunt admin-only (același gate ca rute vechi). NavBar-ul afișează butonul „e-Factura" → `/efactura/primite`.

## Structură frontend

```
frontend/src/
├── pages/efactura/
│   ├── EFacturaLayout.tsx        — wrapper cu header (selector companie, sync) + sidebar + <Outlet>
│   ├── CompanyContext.tsx        — context partajat: companyId, companies, unreadCount, refresh
│   ├── EFacturaReceived.tsx      — tabel TanStack pentru facturi primite
│   └── EFacturaSent.tsx          — tabel TanStack pentru facturi trimise
├── components/efactura/
│   └── InvoiceDetailsModal.tsx   — modal dual-mode (received/sent), auto mark-read
└── utils/pdf/
    └── invoiceReceived.ts        — generator PDF A4 din InvoiceDetailsReceived
```

Sidebar-ul: 2 link-uri (Primite cu badge unread, Trimise) + bloc info despre sync. Selector companie persistat în `localStorage.efactura_company_id`.

## Endpoint-uri backend noi

Toate sub `/api/efactura/companies/{cid}` (admin guard prin `_require_company_access`):

| Metodă | Path | Răspuns | Notes |
|---|---|---|---|
| GET | `/received` | `PaginatedReceivedOut` | params: `page`, `page_size`, `search`, `is_read`, `date_from`, `date_to`. Include `unread_count`. |
| GET | `/records` | `PaginatedRecordsOut` | similar, filtrabil pe `status`. |
| GET | `/received/{rid}/details` | `InvoiceDetailsOutSchema` | auto-download ZIP de la ANAF dacă lipsește, parsează UBL. |
| POST | `/received/{rid}/mark-read` | `MarkReadOut` | idempotent. |
| GET | `/received/{rid}/xml` | `application/xml` | extrage XML-ul de factură din ZIP, returnează ca attachment. |

Vechile endpoint-uri `/received` și `/records` au fost extinse (acum răspund cu obiect paginat, nu listă plată). Consumeri admin existenți (`EFacturaSection.tsx`) adaptați defensiv (`Array.isArray ? : items`).

## Parser UBL primite

[backend/app/efactura/received_parser.py](../backend/app/efactura/received_parser.py)

```python
def extract_invoice_xml_from_zip(zip_bytes) -> bytes:
    # skip semnatura_*.xml, returnează primul XML cu root Invoice/CreditNote
def parse_ubl_invoice(xml_bytes) -> InvoiceDetailsOut
```

Extrage din UBL 2.1 / CIUS-RO:
- `cbc:ID`, `cbc:IssueDate`, `cbc:DueDate`, `cbc:DocumentCurrencyCode`, `cbc:InvoiceTypeCode`
- `AccountingSupplierParty` / `AccountingCustomerParty` — nume, CUI, registration, adresă, contact
- `PaymentMeans/PayeeFinancialAccount/cbc:ID` → IBAN; `PaymentTerms/cbc:Note`
- `InvoiceLine` / `CreditNoteLine` — descriere, cantitate+UM, preț unit, total net, TVA %
- `TaxTotal/TaxSubtotal` — breakdown TVA
- `LegalMonetaryTotal` — total fără TVA, cu TVA, de plată

Root local-name detectat prin `etree.QName(root).localname` pentru a alege calea Invoice vs CreditNote. Sumele convertite în `Decimal` apoi serializate ca string.

## Auto-download + cache S3

`service.ensure_received_downloaded(db, idx)`:
1. Dacă există `response_zip_s3_key` valid → citește din S3 (`_load_zip_from_s3`).
2. Altfel → `AnafEFacturaClient.download_response(id_solicitare)`, salvează în S3 la cheia `efactura/companies/{cid}/received/{year}/{rid}.zip`, setează `downloaded=True`.
3. Retry forțat dacă S3 key existent dar fișierul lipsește.

S3 client reutilizat din `app.utils.storage._s3_client` (același helper folosit pentru `_archive_zip_to_s3` la sent).

## Migrare DB

`backend/alembic/versions/ef15_received_is_read.py`:

```sql
ALTER TABLE efactura_received_index
  ADD COLUMN is_read BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN read_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX ix_efactura_received_read ON efactura_received_index(company_id, is_read);
```

Aplicare: `alembic upgrade head`.

## Modal — flow citire

1. Click pe rând în tabel → `setSelected(row)` deschide modal.
2. `createEffect` declanșează `load()` care apelează `/received/{id}/details`.
3. Server descarcă/parsează → returnează `InvoiceDetailsOut`.
4. La success: fire-and-forget `POST /mark-read`; callback `onMarkedRead(id)` patch-uiește rândul local (`is_read=true`) fără refetch. Decrementează `unreadCount` în context.
5. UI arată skeleton + „Descărcăm factura de la ANAF…" pe perioada loading-ului.

Modal NU se închide la click pe overlay (preferință user, în [feedback_modal_behavior](.)). Doar prin buton X, Escape sau „Închide".

## Sugestii contextuale

Modal afișează un bloc „Sugestii acțiuni" generat din detalii:
- Scadență trecută → ⚠️ + zile rămase negative
- Scadență ≤ 5 zile → ⏰ alertă
- IBAN prezent → instrucțiune plată
- Tip `CreditNote` → notă explicativă
- Linii goale → atenționare

Pure client-side, fără cerere extra.

## Butoane disabled (placeholders)

În modal sunt prezente vizual dar `disabled` cu `title="În curând"`:
- 💰 Marchează plata (necesită tracking pl plăți în viitor)
- ⏰ Reminder scadență (necesită scheduler email)
- 📊 Export contabilitate (necesită mapper SAGA/Conta)

Funcționale acum: 📄 Descarcă XML, 🖨️ Printează PDF, ✓ Mark-as-read (automat la deschidere).

## Generator PDF

[frontend/src/utils/pdf/invoiceReceived.ts](../frontend/src/utils/pdf/invoiceReceived.ts)

Font Noto Sans Ro (`unitsPerEm=1000`, diacritice corecte) — vezi [feedback_jspdf_font_upem](.). Asset Vite (`src/assets/fonts/NotoSans-Ro.ttf`) cu hash automat pentru cache busting. A4 portret, margini 20mm. Structură: header → emitent/beneficiar → detalii plată → tabel linii (jspdf-autotable) → breakdown TVA → totaluri → footer.

Filename: `factura_primita_{invoice_number}.pdf`.

## Riscuri identificate

1. **UBL namespace Invoice vs CreditNote** — root namespace diferit; `cac`/`cbc` comune. Rezolvat prin detect `localname`.
2. **ZIP-ul ANAF** conține factura + semnatura xades — filtru pe nume + verificare root.
3. **Filtru `data_creare`** — câmp string (`YYYYMMDDhhmm`); comparat prin `func.substr(..., 1, 8)`.
4. **Rate-limit ANAF** la `/descarcare` — surface 429; UI afișează eroarea cu buton „Reîncearcă".
5. **S3 cache miss** — dacă `downloaded=True` dar fișierul lipsește, retry transparent.
6. **Auto mark-read fail** — fire-and-forget, nu blocheze UI; eroare silent (rar).

## Verificare end-to-end

1. `cd backend && alembic upgrade head` — aplică migrarea.
2. Pornește backend (Docker sau local cu `uvicorn`) + frontend (`npm run dev`).
3. Navighează la `/efactura`:
   - Redirect la `/efactura/primite`. Sidebar arată unread count.
   - Click pe factură necitită → modal cu loading → detalii complete; după închidere rândul devine normal (font, indicator).
   - „Printează PDF" → PDF corect cu diacritice.
   - „Descarcă XML" → atașament .xml.
   - Tab „Trimise" → tabel cu statusuri color-coded (accepted=verde, rejected=roșu, in_prelucrare=amber).
   - Search + paginație + filtre pe ambele tab-uri.
4. Edge cases:
   - Factură fără ZIP descărcat → auto-download la deschidere modal.
   - CreditNote → parsare corectă (root local-name).
   - Companie deconectată ANAF → 401 cu mesaj clar din UI.

## Fișiere modificate / create

**Modificate**:
- [backend/app/efactura/router.py](../backend/app/efactura/router.py)
- [backend/app/efactura/service.py](../backend/app/efactura/service.py)
- [backend/app/efactura/schemas.py](../backend/app/efactura/schemas.py)
- [backend/app/efactura/models.py](../backend/app/efactura/models.py)
- [frontend/src/App.tsx](../frontend/src/App.tsx)
- [frontend/src/components/NavBar.tsx](../frontend/src/components/NavBar.tsx)
- [frontend/src/pages/adminv2/EFacturaSection.tsx](../frontend/src/pages/adminv2/EFacturaSection.tsx) — adaptare consumeri paginate

**Create**:
- [backend/alembic/versions/ef15_received_is_read.py](../backend/alembic/versions/ef15_received_is_read.py)
- [backend/app/efactura/received_parser.py](../backend/app/efactura/received_parser.py)
- [frontend/src/pages/efactura/EFacturaLayout.tsx](../frontend/src/pages/efactura/EFacturaLayout.tsx)
- [frontend/src/pages/efactura/EFacturaReceived.tsx](../frontend/src/pages/efactura/EFacturaReceived.tsx)
- [frontend/src/pages/efactura/EFacturaSent.tsx](../frontend/src/pages/efactura/EFacturaSent.tsx)
- [frontend/src/pages/efactura/CompanyContext.tsx](../frontend/src/pages/efactura/CompanyContext.tsx)
- [frontend/src/components/efactura/InvoiceDetailsModal.tsx](../frontend/src/components/efactura/InvoiceDetailsModal.tsx)
- [frontend/src/utils/pdf/invoiceReceived.ts](../frontend/src/utils/pdf/invoiceReceived.ts)

Pagina veche [frontend/src/pages/EFacturaPrimite.tsx](../frontend/src/pages/EFacturaPrimite.tsx) e dereferențiată; se va șterge după smoke-test în producție.

## Iterații viitoare propuse

- Tracking plăți: tabel `efactura_received_payments` (paid_at, paid_amount, paid_note, payment_method) + buton funcțional „Marchează plata".
- Reminder scadență: scheduler nou care trimite email cu 3/1 zile înainte; reutilizează `deadline_alert_email`.
- Export contabilitate: CSV cu coloane standard (SAGA, ContaB) + selecție bulk din tabel.
- Filtre date pe ambele tab-uri (`date_from`/`date_to` deja suportate în backend, dar nu expuse în UI).
- Sortare coloane via TanStack `getSortedRowModel` (deja importat, dar disable).
- Bulk actions: select multiple → marchează toate ca citite, export selecție.
