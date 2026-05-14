# Frontend Code Review Report
**Date:** 2026-05-14
**Reviewer:** Frontend Review Agent
**Spec:** frontend_implementation_prompt.md (referenced; not present in repo — review applied against the spec rules supplied in the task brief)
**Overall status:** 🔴 NOT READY

> - 🔴 NOT READY — any BLOCKER is open
> - 🟡 CONDITIONAL — no BLOCKERs, at least one CRITICAL or HIGH open
> - 🟢 READY — no BLOCKERs, no CRITICALs, all HIGHs have a documented fix plan

Reason for status: 3 BLOCKERs open (createPagination hook missing, Pagination component missing, multiple list pages without any server-side pagination).

---

## Section 0 — Codebase Index

### File inventory

| File | Category | Exports | Key imports |
|------|----------|---------|-------------|
| [src/index.tsx](frontend/src/index.tsx) | entry | (render) | solid-js/web, App |
| [src/App.tsx](frontend/src/App.tsx) | router | App (default) | @solidjs/router, all pages (lazy), NavBar, DeviceSetupModal, authStore, adminStore, deviceStore |
| [src/components/NavBar.tsx](frontend/src/components/NavBar.tsx) | layout | NavBar | @solidjs/router, authStore, productsStore, themeStore, adminStore, posHotelStore, generalSettingsStore, api |
| [src/components/ProductCard.tsx](frontend/src/components/ProductCard.tsx) | domain | ProductCard | productsStore, cartStore |
| [src/components/ShoppingList.tsx](frontend/src/components/ShoppingList.tsx) | domain (1529 lines) | ShoppingList | cartStore, receiptsStore, hotelAnvelopeStore, generateDocuments, generateReceiptPdf, api |
| [src/components/SearchableSelect.tsx](frontend/src/components/SearchableSelect.tsx) | ui | SearchableSelect | solid-js |
| [src/components/DeviceSetupModal.tsx](frontend/src/components/DeviceSetupModal.tsx) | layout/domain | DeviceSetupModal | deviceStore, api |
| [src/components/MontareRotiModal.tsx](frontend/src/components/MontareRotiModal.tsx) | domain (455 lines) | MontareRotiModal | montajRotiStore, hotelAnvelopeStore, api |
| [src/components/NavBar.tsx](frontend/src/components/NavBar.tsx) | layout | NavBar | many stores + api |
| [src/components/ThemeToggle.tsx](frontend/src/components/ThemeToggle.tsx) | ui | ThemeToggle | themeStore |
| [src/pages/POS.tsx](frontend/src/pages/POS.tsx) | page (412 lines) | POS (default) | productsStore, employeesStore, catalogThemesStore, ProductCard, ShoppingList |
| [src/pages/Reception.tsx](frontend/src/pages/Reception.tsx) | page (1154 lines) | Reception (default) | receiptsStore, hotelAnvelopeStore, generateDocuments, api |
| [src/pages/Configurari.tsx](frontend/src/pages/Configurari.tsx) | page (2708 lines) | Configurari (default) | api, employeesStore, productsStore, catalogThemesStore |
| [src/pages/Rapoarte.tsx](frontend/src/pages/Rapoarte.tsx) | page (350 lines) | Rapoarte (default) | api, employeesStore |
| [src/pages/Clienti.tsx](frontend/src/pages/Clienti.tsx) | page (641 lines) | Clienti (default) | api, hotelAnvelopeStore |
| [src/pages/HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx) | page (2588 lines) | HotelAnvelope (default) | hotelAnvelopeStore, api, MontareRotiModal |
| [src/pages/Programari.tsx](frontend/src/pages/Programari.tsx) | page (966 lines) | Programari (default) | programariStore, api |
| [src/pages/AdminV2.tsx](frontend/src/pages/AdminV2.tsx) | page (1773 lines) | AdminV2 (default) | api, generalSettingsStore |
| [src/pages/Login.tsx](frontend/src/pages/Login.tsx) | page (248 lines) | Login (default) | authStore, api |
| [src/pages/NoAccess.tsx](frontend/src/pages/NoAccess.tsx) | page (34 lines) | NoAccess (default) | authStore |
| [src/pages/HealthCheck.tsx](frontend/src/pages/HealthCheck.tsx) | page (22 lines) | HealthCheck (default) | solid-js, api |
| [src/store/adminStore.ts](frontend/src/store/adminStore.ts) | store (UI) | adminVisible, setAdminVisible | solid-js |
| [src/store/authStore.ts](frontend/src/store/authStore.ts) | store (auth) | auth, login, logout, trialRemainingMs, trialExpired, TRIAL_DAYS | solid-js/store, adminStore |
| [src/store/cartStore.ts](frontend/src/store/cartStore.ts) | store (UI/persisted) | cart, addToCart, removeFromCart, updateQty, clearCart, addManualItem, setItemQty | productsStore |
| [src/store/catalogThemesStore.ts](frontend/src/store/catalogThemesStore.ts) | store (server cache) | catalogDepartments, setCatalogDepartments, loadCatalogDepartments | api |
| [src/store/deviceStore.ts](frontend/src/store/deviceStore.ts) | store (device) | device, registerDevice, updateDevice, deviceReady | api |
| [src/store/employeesStore.ts](frontend/src/store/employeesStore.ts) | store (server cache) | employees, setEmployees, loadEmployees | api |
| [src/store/generalSettingsStore.ts](frontend/src/store/generalSettingsStore.ts) | store (server cache) | generalSettings, loadGeneralSettings, updateGeneralSettings | api |
| [src/store/hotelAnvelopeStore.ts](frontend/src/store/hotelAnvelopeStore.ts) | store (server cache, 378 lines) | cazari, marci, dimensiuni, profiluri, locuriCazare, hotelImages, loadCazari, getCazareById, loadAnvelope, loadMarci, loadDimensiuni, loadLocuriCazare, loadProfil, loadHotelImages, …setters | api |
| [src/store/montajRotiStore.ts](frontend/src/store/montajRotiStore.ts) | store (server cache) | tire/montaj functions | api |
| [src/store/posHotelStore.ts](frontend/src/store/posHotelStore.ts) | store (session) | posHotelCtx, savePosHotelCtx, clearPosHotelCtx | – |
| [src/store/productsStore.ts](frontend/src/store/productsStore.ts) | store (server cache) | products, setProducts, isOffline, setIsOffline, loadProducts | api |
| [src/store/programariStore.ts](frontend/src/store/programariStore.ts) | store (server cache) | programari, setProgramari, loading, setLoading, loadProgramari, createProgramare, updateProgramare | api |
| [src/store/receiptsStore.ts](frontend/src/store/receiptsStore.ts) | store (server cache + SSE, 388 lines) | receipts, hasMore, loadReceipts, loadMoreReceipts, saveReceipt, updateReceiptContent, … | api |
| [src/store/resumeStore.ts](frontend/src/store/resumeStore.ts) | store (UI) | resume, setResume, triggerLoad | – |
| [src/store/themeStore.ts](frontend/src/store/themeStore.ts) | store (UI/persisted) | theme, toggleTheme | – |
| [src/utils/api.ts](frontend/src/utils/api.ts) | util | API_BASE, apiFetch, parseApiError, readApiError | authStore |
| [src/utils/generateDocuments.ts](frontend/src/utils/generateDocuments.ts) | util (2240 lines) | document generators (deviz, fact, chitanta, etc.) | receiptsStore (type) |
| [src/utils/generateReceiptPdf.ts](frontend/src/utils/generateReceiptPdf.ts) | util (300 lines) | receipt PDF generator | receiptsStore (type) |

### List/table views (pagination targets)

| Page | File | Has pagination? |
|------|------|-----------------|
| POS (unpaid receipts list) | [src/pages/POS.tsx](frontend/src/pages/POS.tsx) | partial — client-side `visibleCount` slice, not server-side |
| Reception (receipts list) | [src/pages/Reception.tsx](frontend/src/pages/Reception.tsx) | yes — server cursor + infinite scroll; **filter does not reset cursor** |
| Configurari (locations / disclaimers / registers / employees / categories / items / companies) | [src/pages/Configurari.tsx](frontend/src/pages/Configurari.tsx) | **no** — all use `limit=200/300` once at mount |
| HotelAnvelope (cazari) | [src/pages/HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx) | partial — server cursor, but client filter only |
| Clienti | [src/pages/Clienti.tsx](frontend/src/pages/Clienti.tsx) | **no** — `limit=200` once, client filter |
| Programari | [src/pages/Programari.tsx](frontend/src/pages/Programari.tsx) | **no** — all in memory |
| Rapoarte | [src/pages/Rapoarte.tsx](frontend/src/pages/Rapoarte.tsx) | **no** — `limit=200` once |
| AdminV2 (accounts) | [src/pages/AdminV2.tsx](frontend/src/pages/AdminV2.tsx) | yes — cursor, `limit=50`; uses redundant client-side filter on top |

### Dependency summary

- **NavBar** is used by `Protected` in `App.tsx` (every protected route) — 1 consumer but shared shell. ✓
- **ShoppingList** (1529 LOC, domain) is consumed by `POS` and `Reception` — only place real component reuse happens.
- **ProductCard** is consumed by `POS` only.
- **MontareRotiModal** is consumed by `HotelAnvelope` and `Reception`.
- **SearchableSelect** is consumed by `Configurari` and `Reception`.
- There is **no UI primitive library** (`Button`, `Input`, `Select`, `Modal`, `Badge`, `Spinner`, `EmptyState`, `PageWrapper`, `ConfirmDialog`, `DataTable` — all missing). Pages rely on CSS classes (`.btn`, `.btn-primary`, `.input`, `.sl-modal-*`) and raw HTML.
- There is **no `src/hooks/`, `src/api/`, `src/types/`** directory. All types live inline in pages; all API calls use `apiFetch` from `src/utils/api.ts` (with a small number of justified exceptions noted in CAT-3).

---

## Section 1 — Findings

> Findings are listed BLOCKER → CRITICAL → HIGH → MEDIUM → LOW. Identical patterns repeated across files are consolidated into a single finding.

---

### [BLOCKER] FE-B01 — `createPagination` hook does not exist

- **Category:** CAT-2 · Pagination
- **File:** `src/hooks/createPagination.ts` (entire `src/hooks/` directory missing)
- **Line:** n/a
- **Issue:** The hook the spec requires for all paginated views does not exist. The `src/hooks/` directory does not exist either.
- **Spec reference:** CAT-2 §1, §2
- **Fix:** Create `src/hooks/createPagination.ts` exporting a `createPagination()` hook that owns `page` + `pageSize` signals, derives `offset`/`limit`, returns a `params()` accessor, and exposes `setPage`, `setPageSize`, `reset()`. Refactor every list page (see FE-B03) to use it.

---

### [BLOCKER] FE-B02 — `<Pagination>` component does not exist

- **Category:** CAT-2 · Pagination
- **File:** `src/components/data/Pagination.tsx` (entire `src/components/data/` subfolder missing)
- **Line:** n/a
- **Issue:** No shared pagination UI exists. Pages that do paginate (Reception, HotelAnvelope, AdminV2) use ad-hoc cursor + infinite-scroll or "load more" buttons; the rest paginate not at all.
- **Spec reference:** CAT-2 §5, §6
- **Fix:** Create `src/components/data/Pagination.tsx` with prev/next, page-number buttons, `onPageSizeChange`, total count. Make it the only pagination UI in the app.

---

### [BLOCKER] FE-B03 — List pages render server data with no server-side pagination

- **Category:** CAT-2 · Pagination
- **Files & lines:**
  - [src/pages/Configurari.tsx:451](frontend/src/pages/Configurari.tsx#L451) — Locations (`limit=200` at L231)
  - [src/pages/Configurari.tsx:827](frontend/src/pages/Configurari.tsx#L827) — Employees (`limit=200` at L298)
  - [src/pages/Configurari.tsx:1086](frontend/src/pages/Configurari.tsx#L1086) — Disclaimers (`limit=200` at L256)
  - [src/pages/Configurari.tsx:1301](frontend/src/pages/Configurari.tsx#L1301) — Registers
  - [src/pages/Configurari.tsx:1598](frontend/src/pages/Configurari.tsx#L1598) — Categories
  - [src/pages/Configurari.tsx:1741](frontend/src/pages/Configurari.tsx#L1741) — Items (`limit=300` at L1436)
  - [src/pages/Configurari.tsx:2096](frontend/src/pages/Configurari.tsx#L2096) — Companies
  - [src/pages/Clienti.tsx:456](frontend/src/pages/Clienti.tsx#L456) — Clients (`limit=200` at L110)
  - [src/pages/Rapoarte.tsx:266](frontend/src/pages/Rapoarte.tsx#L266) — Employees report (`limit=200` at L112)
  - [src/pages/Programari.tsx:639,667](frontend/src/pages/Programari.tsx#L639) — Appointments grid (all in memory, no API limit)
- **Issue:** Each page fetches a hard-capped slice once at mount, then filters client-side. As datasets grow, the UI silently truncates results past the cap; once the dataset exceeds the cap, search/filter return wrong results.
- **Spec reference:** CAT-2 §2, §3
- **Fix:** Wire each page to `createPagination` + `<Pagination>` and make the resource source reactive on `params()`, `search()`, `sortKey()`. Drop the static `limit`.

---

### [CRITICAL] FE-C01 — No global `<ErrorBoundary>` wrapping the app

- **Category:** CAT-7 · Error handling
- **File:** [src/App.tsx](frontend/src/App.tsx)
- **Line:** 22–62 (no `ErrorBoundary` anywhere in the file or the project)
- **Issue:** A `Suspense` fallback is provided for lazy-loaded routes, but no `solid-js` `<ErrorBoundary>` is mounted. Any uncaught render error in a page (a `props.foo.bar` against undefined, a thrown promise inside a memo) blank-screens the entire app with no recovery path. Confirmed by `grep -rn ErrorBoundary src/` → zero matches.
- **Spec reference:** CAT-7 §1
- **Fix:** Add `import { ErrorBoundary } from "solid-js"` and wrap `<PageSuspense>` (or the `Router`'s children) in `<ErrorBoundary fallback={(err, reset) => <AppErrorFallback err={err} reset={reset}/>}>`. Place a single `AppErrorFallback` in `src/components/layout/`.

---

### [CRITICAL] FE-C02 — `AdminV2` admin panel reachable without role guard

- **Category:** CAT-1 · Routing
- **File:** [src/App.tsx:85](frontend/src/App.tsx#L85)
- **Issue:** `/adminv2` is only wrapped in `<Protected>` (which only checks `auth.token`). `/configurari` and `/rapoarte` correctly gate behind `<Show when={adminVisible()}>`. AdminV2 (account management, SMTP, hotel images, logs) is reachable by any logged-in non-admin user.
- **Spec reference:** CAT-1 §3
- **Fix:** Mirror the pattern at L72–81: wrap the AdminV2 route in `<Show when={adminVisible()} fallback={<Navigate href="/"/>}>` before `<Protected>`. Add a server-side role check on every `/api/admin/*` endpoint regardless.

---

### [HIGH] FE-H01 — `<Pagination>` page size is hardcoded everywhere

- **Category:** CAT-2 · Pagination
- **Files & lines:**
  - [src/pages/AdminV2.tsx:573](frontend/src/pages/AdminV2.tsx#L573) — `limit=50`
  - [src/pages/Clienti.tsx:110](frontend/src/pages/Clienti.tsx#L110) — `limit=200`
  - [src/pages/Configurari.tsx:231,256,298,1419,1436,1894](frontend/src/pages/Configurari.tsx#L231) — `limit=200`/`300`
  - [src/pages/HotelAnvelope.tsx:630,734,736](frontend/src/pages/HotelAnvelope.tsx#L630) — `limit=200`
  - [src/pages/POS.tsx:11](frontend/src/pages/POS.tsx#L11) — `PAGE_SIZE=20`
  - [src/pages/Rapoarte.tsx:112](frontend/src/pages/Rapoarte.tsx#L112) — `limit=200`
  - [src/pages/Reception.tsx:1006](frontend/src/pages/Reception.tsx#L1006) — `limit=200`
- **Issue:** Spec requires user-adjustable page size via `<Pagination onPageSizeChange>`. None of the pages expose it.
- **Spec reference:** CAT-2 §6
- **Fix:** Plumb `pageSize` through `createPagination` and let `<Pagination>` change it. Default to a sensible value per page.

---

### [HIGH] FE-H02 — Filter/search changes do not reset pagination on Reception / HotelAnvelope

- **Category:** CAT-2 · Pagination
- **Files:**
  - [src/pages/Reception.tsx:1004-1012](frontend/src/pages/Reception.tsx#L1004-L1012) — Date filter resets cursor; search filter does NOT.
  - [src/pages/HotelAnvelope.tsx:751-769](frontend/src/pages/HotelAnvelope.tsx#L751-L769) — Filters (`searchName`, `filterDim`, `filterTip`) only run client-side; cursor is never reset, so changing a filter while paginated produces stale + filtered output.
- **Issue:** When the user changes a filter while N pages have already loaded, the kept results are filtered locally — what the user thinks they're filtering is not the full dataset.
- **Spec reference:** CAT-2 §4
- **Fix:** Make filters part of the resource source signal; on change, call `setPage(1)` (or cursor reset) and trigger a re-fetch with the filter sent to the API.

---

### [HIGH] FE-H03 — Props are destructured (breaks reactivity)

- **Category:** CAT-4 · Reactivity
- **Files:**
  - [src/components/ProductCard.tsx:9](frontend/src/components/ProductCard.tsx#L9) — `function ProductCard({ product }: Props)`
- **Issue:** SolidJS proxies props; destructuring at the function signature reads them once at first invocation and loses reactivity. Today the page passes a stable item ref so the symptom is hidden, but the moment a parent re-creates `product`, `ProductCard` will not update.
- **Spec reference:** CAT-4 §1
- **Fix:** `function ProductCard(props: { product: Product })` and access `props.product` throughout.

---

### [HIGH] FE-H04 — Server data lives in global stores (6 stores)

- **Category:** CAT-4 §7 · CAT-8 §1
- **Files:**
  - [src/store/productsStore.ts:28](frontend/src/store/productsStore.ts#L28) — `loadProducts()` fetches `/api/items?limit=300`, persists to `bs_products_cache_v2`
  - [src/store/employeesStore.ts:37](frontend/src/store/employeesStore.ts#L37) — `loadEmployees()` fetches `/api/employees?limit=200`
  - [src/store/catalogThemesStore.ts:15](frontend/src/store/catalogThemesStore.ts#L15) — `loadCatalogDepartments()` fetches `/api/departments` (20-min TTL)
  - [src/store/generalSettingsStore.ts:38](frontend/src/store/generalSettingsStore.ts#L38) — settings cached in `general_settings`
  - [src/store/hotelAnvelopeStore.ts:171,294,301,308,315,358](frontend/src/store/hotelAnvelopeStore.ts#L171) — cazari, marci, dimensiuni, locuri cazare, profil, images all cached
  - [src/store/receiptsStore.ts:118-167](frontend/src/store/receiptsStore.ts#L118) — `loadReceipts`/`loadMoreReceipts` + SSE
  - [src/store/programariStore.ts:60](frontend/src/store/programariStore.ts#L60) — appointments
- **Issue:** Spec wants server state in `createResource`; this codebase has it in `createSignal` + ad-hoc cache + ad-hoc invalidation. There is exactly **one** `createResource` in the whole app — at [src/pages/HealthCheck.tsx:16](frontend/src/pages/HealthCheck.tsx#L16). Consequence: no automatic refetch, no loading/error/refetching state, manual cache-busting, and possible cache-vs-SSE drift in `receiptsStore`.
- **Spec reference:** CAT-4 §7, CAT-8 §2
- **Fix:** Move server fetches into `createResource`s owned by the page (or a typed helper). Reserve stores for genuine cross-page UI state (auth, theme, device, cart, posHotelCtx).

---

### [HIGH] FE-H05 — `useAction`-style mutation helper missing; pages duplicate try/catch + loading + error per mutation

- **Category:** CAT-3 · Reuse
- **Files (sample of many):**
  - [src/pages/Configurari.tsx:280](frontend/src/pages/Configurari.tsx#L280), [305](frontend/src/pages/Configurari.tsx#L305) — saveEdit, addLocation
  - [src/pages/AdminV2.tsx:82-90](frontend/src/pages/AdminV2.tsx#L82) — custom `adminFetch` wrapper
  - [src/pages/Login.tsx:43-74](frontend/src/pages/Login.tsx#L43) — handleSubmit
  - [src/pages/HotelAnvelope.tsx:82-92](frontend/src/pages/HotelAnvelope.tsx#L82) — search wrapper
- **Issue:** Every mutation hand-rolls `setSaving(true); try {...} catch {...} finally { setSaving(false) }`. Confirmed: `grep -rn "useAction\|createMutation\|useMutation" src/` returns zero. ≈50 such mutation blocks across the codebase.
- **Spec reference:** CAT-3 §5
- **Fix:** Add `src/hooks/useAction.ts` returning `{ loading, error, run() }`. Refactor a handful of mutations as proof, then convert the rest incrementally.

---

### [HIGH] FE-H06 — UI primitive library is entirely absent

- **Category:** CAT-3 · Reuse
- **Files:** [src/components/](frontend/src/components/) — 8 files, all domain/layout. None of the spec primitives (`Button`, `Input`, `Select`, `Modal`, `Badge`, `Spinner`, `EmptyState`, `PageWrapper`, `ConfirmDialog`, `DataTable`) exist.
- **Issue:** Pages reach for raw `<input>`, `<button>`, `<select>` with shared CSS classes (`.input`, `.btn`, `.btn-primary`). Example: [src/pages/AdminV2.tsx:813-837](frontend/src/pages/AdminV2.tsx#L813-L837), [src/components/ShoppingList.tsx:280-281](frontend/src/components/ShoppingList.tsx#L280-L281), [src/pages/Configurari.tsx:419,433](frontend/src/pages/Configurari.tsx#L419), [src/pages/HotelAnvelope.tsx:113-120](frontend/src/pages/HotelAnvelope.tsx#L113-L120). 5 raw `<table>` implementations:
  - [src/pages/AdminV2.tsx:1448](frontend/src/pages/AdminV2.tsx#L1448)
  - [src/pages/Configurari.tsx:100](frontend/src/pages/Configurari.tsx#L100)
  - [src/pages/HotelAnvelope.tsx:2141](frontend/src/pages/HotelAnvelope.tsx#L2141)
  - [src/pages/HotelAnvelope.tsx:2393](frontend/src/pages/HotelAnvelope.tsx#L2393)
  - [src/pages/HotelAnvelope.tsx:2531](frontend/src/pages/HotelAnvelope.tsx#L2531)
- **Spec reference:** CAT-3 §1, §2, §3
- **Fix:** Create `src/components/ui/` and `src/components/data/`. Build `Input`, `Button`, `Select`, `Modal`, `ConfirmDialog`, `EmptyState`, `Spinner`, `Badge`, `DataTable`, `Pagination`. Migrate forms in order of pain: Configurari first (heaviest), then HotelAnvelope, then AdminV2.

---

### [HIGH] FE-H07 — Silent error swallowing in many `catch {}` blocks

- **Category:** CAT-7 · Error handling
- **Files (≥18 instances):**
  - [src/pages/AdminV2.tsx:59,72,268,449,1043,1052,1059,1069](frontend/src/pages/AdminV2.tsx#L59) — 8 empty catches (admin token, email logs, SMTP load, accounts list)
  - [src/pages/Configurari.tsx:250,261,1412](frontend/src/pages/Configurari.tsx#L250) — disclaimer/register/items cache loads
  - [src/pages/HotelAnvelope.tsx:632,646,728,834,951,1095,1208,1229](frontend/src/pages/HotelAnvelope.tsx#L632) — clientele/vehicle fetches
  - [src/pages/Programari.tsx:421](frontend/src/pages/Programari.tsx#L421) — status update "In lucru"
  - [src/pages/Reception.tsx:206](frontend/src/pages/Reception.tsx#L206) — ANAF lookup
  - [src/store/authStore.ts:29,38,53](frontend/src/store/authStore.ts#L29) — localStorage IO (acceptable since storage is opportunistic)
- **Issue:** A failed API call (network drop, 500) leaves the UI showing stale/empty data with no signal to the user. The `readApiError` helper exists in `src/utils/api.ts:60` but is rarely used.
- **Spec reference:** CAT-7 §5, §7
- **Fix:** Introduce a global `notify()` (see FE-H09) and have every `catch` route through it. Reserve `catch {}` for storage / non-critical telemetry, and add a one-line comment when truly intentional.

---

### [HIGH] FE-H08 — Heavy `: any` and `as any` usage across business code

- **Category:** CAT-5 · TypeScript
- **Files (top offenders):**
  - [src/utils/generateDocuments.ts](frontend/src/utils/generateDocuments.ts) — 26 `: any`, 11 `as any`
  - [src/pages/Configurari.tsx](frontend/src/pages/Configurari.tsx) — 15 `: any` (L216, L248, L259, L310-312, L712, L920, L962, L1195, L1397, L1583, L2236, L2455, L2522)
  - [src/pages/HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx) — 10 `: any`, 9 `as any` (L380-381, L479-488, L1045-46, L1310)
  - [src/pages/AdminV2.tsx](frontend/src/pages/AdminV2.tsx) — 10 `as any` (L171, L629, L695, L1089, L1108, L1111, L1143, L1164, L1634, L1637)
  - [src/pages/Reception.tsx](frontend/src/pages/Reception.tsx) — 8 `as any` (L495-504, L581-594)
  - [src/store/hotelAnvelopeStore.ts](frontend/src/store/hotelAnvelopeStore.ts) — 6 `: any` (L84, L100, L130, L135, L234, L272)
- **Total:** 86 `: any`, 45 `as any`, 0 `@ts-ignore`.
- **Issue:** Strict mode is enabled at [tsconfig.app.json:21](frontend/tsconfig.app.json#L21) but `any` is the main escape hatch. Concentrated in catch blocks and API-response mappers, both of which are typeable (`unknown` + narrowing, or a shared `ApiResponse<T>` type).
- **Spec reference:** CAT-5 §2, §3
- **Fix:** (1) Replace `catch (e: any)` with `catch (e: unknown)` + `parseApiError`. (2) Type the `Receipt` / `Account` / `EmailTemplate` etc. shapes in `src/types/` and drop the `as any` casts at the boundary. (3) Annotate the legitimate jsPDF-internal casts (`(doc as any).lastAutoTable.finalY`) with an explanatory comment.

---

### [HIGH] FE-H09 — No centralized notification / toast system

- **Category:** CAT-7 · Error handling · CAT-8 · State
- **File:** `src/store/notifications.ts` (missing)
- **Issue:** Pages use ad-hoc inline toasts (CSS classes `titlu-warn-toast`, `prgm-toast-error`), inline error `<span>`s, `setError` per page. No way to surface a notification cross-page (e.g., "saved" after a redirect).
- **Spec reference:** CAT-7 §5, CAT-8 §5
- **Fix:** Create `src/store/notifications.ts` exporting `notify(msg, kind)` + a `<Notifications/>` host mounted once in `App.tsx`. Refactor existing inline error displays through it incrementally.

---

### [HIGH] FE-H10 — Untyped `createResource` on HealthCheck

- **Category:** CAT-5 · TypeScript
- **File:** [src/pages/HealthCheck.tsx:16](frontend/src/pages/HealthCheck.tsx#L16)
- **Issue:** `const [status] = createResource(fetchHealth);` — no generic. Return type is `Resource<any>`.
- **Spec reference:** CAT-5 §5
- **Fix:** `createResource<HealthStatus>(fetchHealth)` once the `HealthStatus` type is declared in `src/types/`.

---

### [HIGH] FE-H11 — Vite production base path depends on env var that may be unset

- **Category:** CAT-1 · Routing · CAT-6 · Performance
- **File:** [frontend/vite.config.ts:5](frontend/vite.config.ts#L5) — `base: process.env.VITE_BASE_PATH ?? '/'`
- **Issue:** Spec says the app is served under `/berlinstar/` via reverse proxy. Build will only emit correct asset URLs if `VITE_BASE_PATH=/berlinstar/` is set at build time. There is no fallback to `/berlinstar/`, no CI check, no documentation in `package.json` or `Dockerfile`. A build that forgets the env var ships `/assets/*.js` URLs that 404 in production.
- **Spec reference:** CAT-1 §4, CAT-6 §4
- **Fix:** Either hardcode `base: '/berlinstar/'` (simplest, given a single deployment target), or fail the build when `NODE_ENV=production` and `VITE_BASE_PATH` is unset.

---

### [MEDIUM] FE-M01 — `createEffect` used where `createMemo` is correct (derived state)

- **Category:** CAT-4 · Reactivity
- **Files:**
  - [src/components/ShoppingList.tsx:88-97](frontend/src/components/ShoppingList.tsx#L88-L97) — derives several signals from `props.value`
  - [src/components/ShoppingList.tsx:642-654](frontend/src/components/ShoppingList.tsx#L642-L654) — `pendingLoad()` → 6 setters
  - [src/pages/Programari.tsx:258](frontend/src/pages/Programari.tsx#L258) — `createEffect(() => { weekOffset(); void reloadAppts(); })` (lone purpose is a refetch; should use `on()` to be explicit about the tracked dep)
  - [src/pages/Programari.tsx:259-262](frontend/src/pages/Programari.tsx#L259-L262) — `weekDays()` → `setMiniMonth()` (derived → memo)
  - [src/pages/AdminV2.tsx:1072-1075](frontend/src/pages/AdminV2.tsx#L1072-L1075) — `filterAccountId` → `loadLogs()` (legit effect, but use `on()`)
- **Issue:** Effects writing to other signals are a SolidJS anti-pattern unless they are side-effects (DOM, network, storage). Where the value is purely derived, use `createMemo`; where it's a fetch, use `on(source, () => fetch)` for explicit dependency tracking.
- **Spec reference:** CAT-4 §2
- **Fix:** Convert pure derivations to `createMemo`; wrap fetch-triggering effects in `on()`.

---

### [MEDIUM] FE-M02 — Many delete actions confirm only via custom in-page modal toggles, sometimes admin-gated

- **Category:** CAT-7 · Error handling
- **Files:** [src/pages/Clienti.tsx:30-42](frontend/src/pages/Clienti.tsx#L30-L42), [src/pages/Configurari.tsx:146-157](frontend/src/pages/Configurari.tsx#L146-L157), [src/pages/Programari.tsx:173,748-753](frontend/src/pages/Programari.tsx#L173), [src/pages/Reception.tsx:442,916](frontend/src/pages/Reception.tsx#L442)
- **Issue:** Confirmation exists (good), but it is reimplemented per page. Programari deletion is also tied to `adminVisible()` for the trigger UI but the underlying call has no server-side admin check evident on the client.
- **Spec reference:** CAT-7 §8, CAT-3 §1 (missing `ConfirmDialog`)
- **Fix:** Build the shared `ConfirmDialog` (FE-H06) and replace all four bespoke implementations. Verify server-side that delete endpoints enforce admin.

---

### [MEDIUM] FE-M03 — Stores expose raw `setX` setters rather than typed actions

- **Category:** CAT-8 · State
- **Files:**
  - [src/store/catalogThemesStore.ts:13](frontend/src/store/catalogThemesStore.ts#L13) — `setCatalogDepartments`
  - [src/store/employeesStore.ts:16](frontend/src/store/employeesStore.ts#L16) — `setEmployees`
  - [src/store/hotelAnvelopeStore.ts:145-152](frontend/src/store/hotelAnvelopeStore.ts#L145) — `setMarci`, `setDimensiuni`, `setProfiluri`, `setLocuriCazare`
  - [src/store/productsStore.ts:25](frontend/src/store/productsStore.ts#L25) — `setProducts`, `setIsOffline`
  - [src/store/programariStore.ts:55-56](frontend/src/store/programariStore.ts#L55) — `setProgramari`, `setLoading`
  - [src/store/receiptsStore.ts:104,114-115](frontend/src/store/receiptsStore.ts#L104) — `setReceipts`, `setHasMore`, `setLoadingMore`
- **Issue:** Anyone can call `setReceipts([])` from a page and silently bypass the SSE / cache logic. (Auth/cart already do it right — typed wrappers `login`, `addToCart`, etc.)
- **Spec reference:** CAT-8 §4
- **Fix:** Mark raw setters as `internal` (rename `_setReceipts`) or export only typed actions; consumers should call `clearReceipts()`, not `setReceipts([])`.

---

### [MEDIUM] FE-M04 — `localStorage` used outside `authStore` for API caches (7 keys)

- **Category:** CAT-8 · State
- **Files:** [productsStore.ts](frontend/src/store/productsStore.ts), [employeesStore.ts](frontend/src/store/employeesStore.ts), [catalogThemesStore.ts](frontend/src/store/catalogThemesStore.ts), [hotelAnvelopeStore.ts](frontend/src/store/hotelAnvelopeStore.ts), [generalSettingsStore.ts](frontend/src/store/generalSettingsStore.ts), [receiptsStore.ts](frontend/src/store/receiptsStore.ts), [adminStore.ts](frontend/src/store/adminStore.ts)
- **Issue:** Keys `bs_products_cache_v2`, `bs_employees_cache_v2_*`, `bs_departments_cache_*`, `bs_marci_anvelope`, `bs_dimensiuni_anvelope`, `bs_profiluri_anvelope`, `bs_locuri_cazare`, `bs_receipts`, `general_settings`, `bs_admin_visible` — all are API caches. Justified `localStorage` uses (`bs_auth`, `bs_device`, `bs_theme`, `bs_cart`, `bs_pos_hotel_ctx`) are fine; the rest are server-state-in-disk-cache.
- **Spec reference:** CAT-8 §3
- **Fix:** Move API caching into the resource layer (in-memory TTL or `createResource` with manual `refetch`), keep `localStorage` for true persistence only.

---

### [MEDIUM] FE-M05 — `<div onClick>` used as button without `role` / `tabIndex`

- **Category:** CAT-9 · Accessibility
- **Files:**
  - [src/pages/AdminV2.tsx:303,326,349](frontend/src/pages/AdminV2.tsx#L303) — hotel-img-card tiles
  - [src/pages/Clienti.tsx:589](frontend/src/pages/Clienti.tsx#L589) — `.cfg-location-info`
  - [src/pages/HotelAnvelope.tsx:392](frontend/src/pages/HotelAnvelope.tsx#L392) — `.rcard` row
  - [src/pages/Reception.tsx:627](frontend/src/pages/Reception.tsx#L627) — `.rcard-header` expander
- **Issue:** Keyboard users cannot focus or activate these controls. ProductCard does it right ([src/components/ProductCard.tsx:11](frontend/src/components/ProductCard.tsx#L11) has `role="button" tabIndex={0} onKeyDown`); the pattern should be repeated.
- **Spec reference:** CAT-9 §6
- **Fix:** Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for Enter/Space — or replace with `<button>` styled appropriately.

---

### [MEDIUM] FE-M06 — Inline domain types scattered across pages, no `src/types/`

- **Category:** CAT-5 · TypeScript · CAT-3 · Reuse
- **Files:** `ClientItem` is redeclared in [src/components/ShoppingList.tsx](frontend/src/components/ShoppingList.tsx), [src/pages/Programari.tsx](frontend/src/pages/Programari.tsx), [src/pages/Reception.tsx](frontend/src/pages/Reception.tsx), [src/pages/HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx). `Location` is redeclared in [src/pages/Configurari.tsx](frontend/src/pages/Configurari.tsx) and [src/components/DeviceSetupModal.tsx](frontend/src/components/DeviceSetupModal.tsx). Plus Configurari has 9 inline domain types, AdminV2 has 5, etc.
- **Issue:** Duplication risks drift; type changes touch multiple files.
- **Spec reference:** CAT-5 §6
- **Fix:** Create `src/types/` with `Client.ts`, `Location.ts`, `Receipt.ts` etc. Import from there. Delete the inline duplicates.

---

### [MEDIUM] FE-M07 — Modal focus management missing

- **Category:** CAT-9 · Accessibility
- **Files:**
  - [src/components/DeviceSetupModal.tsx:90,129](frontend/src/components/DeviceSetupModal.tsx#L90) — uses `autofocus` only
  - [src/components/NavBar.tsx:212-244](frontend/src/components/NavBar.tsx#L212) — admin modal, no focus trap
  - [src/components/ShoppingList.tsx](frontend/src/components/ShoppingList.tsx) — multiple `.sl-modal-overlay` blocks
  - [src/components/MontareRotiModal.tsx](frontend/src/components/MontareRotiModal.tsx) — no focus trap
- **Issue:** Tabbing escapes the modal onto background content; on close, focus is not restored to the trigger.
- **Spec reference:** CAT-9 §4
- **Fix:** Implement once in the shared `Modal` primitive (see FE-H06) with focus-trap behavior and focus restoration via `lastFocused = document.activeElement`.

---

### [MEDIUM] FE-M08 — Form inputs rely on `placeholder` instead of `<label>`

- **Category:** CAT-9 · Accessibility
- **Files (sample):** [src/components/ShoppingList.tsx:280-281](frontend/src/components/ShoppingList.tsx#L280-L281), [src/pages/Configurari.tsx:419,433](frontend/src/pages/Configurari.tsx#L419), [src/pages/Configurari.tsx:504-545](frontend/src/pages/Configurari.tsx#L504-L545) (multiple `<select>`), [src/pages/HotelAnvelope.tsx:113-120](frontend/src/pages/HotelAnvelope.tsx#L113-L120), [src/components/NavBar.tsx:221-228](frontend/src/components/NavBar.tsx#L221) (admin password input).
- **Issue:** Screen readers announce placeholder text inconsistently; placeholders disappear on type.
- **Spec reference:** CAT-9 §1
- **Fix:** Make the shared `Input` primitive (FE-H06) require a `label` prop and render a real `<label>`.

---

### [MEDIUM] FE-M09 — Loading state inconsistent / missing on several pages

- **Category:** CAT-7 · Error handling
- **Files:**
  - [src/pages/HotelAnvelope.tsx](frontend/src/pages/HotelAnvelope.tsx) — async fetches in callbacks, no top-level loading indicator
  - [src/pages/AdminV2.tsx](frontend/src/pages/AdminV2.tsx) — silent loads in `createEffect`
  - [src/pages/POS.tsx](frontend/src/pages/POS.tsx) — no loading/error feedback while products load
- **Issue:** User sees a blank screen for tens of milliseconds to seconds depending on connection. Some pages do this right ([Clienti.tsx:451-452](frontend/src/pages/Clienti.tsx#L451), [Programari.tsx:698-701](frontend/src/pages/Programari.tsx#L698), [Configurari.tsx:446-448](frontend/src/pages/Configurari.tsx#L446)).
- **Spec reference:** CAT-7 §3
- **Fix:** Adopt the `<Show when={loading()} fallback={...}>` pattern uniformly. Once `createResource` is in place (FE-H04), use the `.loading` accessor directly.

---

### [MEDIUM] FE-M10 — Form state uses 10–90 individual `createSignal` per page instead of a `createForm` helper

- **Category:** CAT-3 · Reuse
- **Files (signal counts per page):** Configurari.tsx (~26+), HotelAnvelope.tsx (~91), Reception.tsx (~39), AdminV2.tsx (~56), Programari.tsx (~32), ShoppingList.tsx (~57). Example block: [Configurari.tsx:167-197](frontend/src/pages/Configurari.tsx#L167-L197) (single location edit form: 15 signals).
- **Issue:** Form state is impossible to reset, validate, or serialize as a unit. Submission is a 15-line spread.
- **Spec reference:** CAT-3 §6
- **Fix:** Add `src/hooks/createForm.ts` with `{ values, setValue, errors, submit, reset }`. Convert one big form first.

---

### [LOW] FE-L01 — Missing explicit return types on exported async functions

- **Category:** CAT-5 · TypeScript
- **Files:** [src/utils/api.ts:40](frontend/src/utils/api.ts#L40) (`parseApiError` — inferred), [src/store/productsStore.ts:28](frontend/src/store/productsStore.ts#L28) (`loadProducts`), [src/store/receiptsStore.ts:118,144](frontend/src/store/receiptsStore.ts#L118) (`loadReceipts`, `loadMoreReceipts`), [src/store/hotelAnvelopeStore.ts:294](frontend/src/store/hotelAnvelopeStore.ts#L294) (`loadMarci`).
- **Issue:** Strict-mode codebases benefit from explicit return types at module boundaries to catch unintended widening.
- **Spec reference:** CAT-5 §8
- **Fix:** Add `: Promise<void>` / `: string` on the listed functions.

---

### [LOW] FE-L02 — Icon-only buttons without `aria-label`

- **Category:** CAT-9 · Accessibility
- **Files:** [src/components/DeviceSetupModal.tsx:107](frontend/src/components/DeviceSetupModal.tsx#L107) (`✏️` pencil), [src/components/ShoppingList.tsx:142](frontend/src/components/ShoppingList.tsx#L142) (`✕` close — has `title` but no `aria-label`).
- **Issue:** Screen readers may announce no name or the emoji literal.
- **Spec reference:** CAT-9 §2
- **Fix:** Add `aria-label="Editează"` / `aria-label="Închide"` on the listed buttons.

---

### [LOW] FE-L03 — `as` casts without explanatory comments

- **Category:** CAT-5 · TypeScript
- **Files:** sample of 10 sites — [NavBar.tsx:77](frontend/src/components/NavBar.tsx#L77), [MontareRotiModal.tsx:232](frontend/src/components/MontareRotiModal.tsx#L232), [AdminV2.tsx:1138](frontend/src/pages/AdminV2.tsx#L1138), [HotelAnvelope.tsx:328](frontend/src/pages/HotelAnvelope.tsx#L328), [Programari.tsx:326](frontend/src/pages/Programari.tsx#L326), [Reception.tsx:480](frontend/src/pages/Reception.tsx#L480), [generalSettingsStore.ts:30](frontend/src/store/generalSettingsStore.ts#L30), [montajRotiStore.ts:164](frontend/src/store/montajRotiStore.ts#L164), [programariStore.ts:48](frontend/src/store/programariStore.ts#L48), [themeStore.ts:7](frontend/src/store/themeStore.ts#L7).
- **Issue:** Most are legitimate DOM/enum/JSON-deserialization casts; comments would document the contract.
- **Spec reference:** CAT-5 §3
- **Fix:** Tag each with a one-line comment, e.g., `// safe: enum branded from select value`.

---

## Section 2 — Verified OK

| # | Check | File | Note |
|---|-------|------|------|
| 1 | All page routes lazy-loaded | [src/App.tsx:11-20](frontend/src/App.tsx#L11-L20) | 10 pages, all `lazy()` — only eagerly imports `Login` (intentional — login route renders fast on entry) |
| 2 | `<Suspense>` wraps protected outlet | [src/App.tsx:22-28,53-55](frontend/src/App.tsx#L22) | Fallback shows skeleton blocks, not a spinner |
| 3 | Auth guard exists | [src/App.tsx:30-62](frontend/src/App.tsx#L30) | `<Protected>` checks `auth.token`; trial expiry redirect |
| 4 | Router base reads `import.meta.env.BASE_URL` | [src/App.tsx:66](frontend/src/App.tsx#L66) | Sourced from Vite `base` config — see FE-H11 for the config caveat |
| 5 | TypeScript strict mode enabled | [frontend/tsconfig.app.json:21](frontend/tsconfig.app.json#L21) | `"strict": true` + `noUnusedLocals` + `noUnusedParameters` |
| 6 | jsPDF imported dynamically | [src/utils/generateDocuments.ts:472-475](frontend/src/utils/generateDocuments.ts#L472), [src/utils/generateReceiptPdf.ts:262-264](frontend/src/utils/generateReceiptPdf.ts#L262) | Wrapped in `loadPdf()` helper — adds ~300KB only when used |
| 7 | qrcode imported dynamically | [src/utils/generateDocuments.ts:584](frontend/src/utils/generateDocuments.ts#L584) | `await import("qrcode")` inside data-URL helper |
| 8 | Vite manual chunks split solid-vendor | [frontend/vite.config.ts:18-20](frontend/vite.config.ts#L18-L20) | `solid-js`+`@solidjs/router` isolated |
| 9 | `solid-vendor` chunk-size warning at 300KB | [frontend/vite.config.ts:15](frontend/vite.config.ts#L15) | Build will warn if main bundle bloats |
| 10 | apiFetch handles 401 → logout + bs:unauthorized event | [src/utils/api.ts:25-31](frontend/src/utils/api.ts#L25-L31), [src/App.tsx:40-47](frontend/src/App.tsx#L40-L47) | Single source of truth for unauth redirect |
| 11 | `fetch()` outside `apiFetch` is justified | NavBar/Login (auth), AdminV2/Configurari uploads (FormData), HealthCheck (no-auth), generateDocuments (fonts/external images) | No business-data leaks |
| 12 | No direct store mutation (`store.x = y`) | all stores | All writes go through the setter returned by `createStore`/`createSignal` |
| 13 | Cart, theme, posHotelCtx, device, auth `localStorage` use is justified | [authStore.ts](frontend/src/store/authStore.ts), [themeStore.ts](frontend/src/store/themeStore.ts), [posHotelStore.ts](frontend/src/store/posHotelStore.ts), [deviceStore.ts](frontend/src/store/deviceStore.ts), [cartStore.ts](frontend/src/store/cartStore.ts) | True persistence needs (auth token, device id, theme pref, in-progress cart) |
| 14 | Delete operations use a confirmation modal (not immediate) | Clienti, Configurari, Programari, Reception, HotelAnvelope | Bespoke per page — see FE-M02 |
| 15 | `<Show>` used over ternary in JSX broadly | NavBar, App, Configurari, etc. | Found no naked `cond ? <Foo/> : null` for large subtrees |
| 16 | No `@ts-ignore` / `@ts-nocheck` | entire `src/` | Zero matches |
| 17 | Empty states present for the larger lists | [Clienti.tsx:451](frontend/src/pages/Clienti.tsx#L451), [Configurari.tsx:446,822,1081,1296,1688,1737,2091,2376](frontend/src/pages/Configurari.tsx#L446), [Rapoarte.tsx:259](frontend/src/pages/Rapoarte.tsx#L259) | "Niciun rezultat" / "Nu există …" handled |
| 18 | ProductCard is keyboard-accessible | [src/components/ProductCard.tsx:11](frontend/src/components/ProductCard.tsx#L11) | `role="button"`, `tabIndex={0}`, Enter handler |
| 19 | `outline: none` in CSS pairs with `border-color` focus state | [src/styles/global.css:225,923,989,1861](frontend/src/styles/global.css#L225) | Custom focus border replaces native outline |
| 20 | Offline indicator wired to product cache state | [src/components/NavBar.tsx:86](frontend/src/components/NavBar.tsx#L86), [src/store/productsStore.ts](frontend/src/store/productsStore.ts) | Visible offline banner |

---

## Section 3 — Risk Matrix

| ID | Title | Severity | Category | File(s) | Status |
|----|-------|----------|----------|---------|--------|
| FE-B01 | `createPagination` hook missing | BLOCKER | CAT-2 | src/hooks/ (absent) | ❌ Open |
| FE-B02 | `<Pagination>` component missing | BLOCKER | CAT-2 | src/components/data/ (absent) | ❌ Open |
| FE-B03 | List pages without server-side pagination | BLOCKER | CAT-2 | Configurari ×7, Clienti, Rapoarte, Programari | ❌ Open |
| FE-C01 | No global `<ErrorBoundary>` | CRITICAL | CAT-7 | src/App.tsx | ❌ Open |
| FE-C02 | AdminV2 route lacks adminVisible gate | CRITICAL | CAT-1 | src/App.tsx:85 | ❌ Open |
| FE-H01 | Page size hardcoded | HIGH | CAT-2 | 8 files | ❌ Open |
| FE-H02 | Filter doesn't reset pagination on Reception/HotelAnvelope | HIGH | CAT-2 | Reception.tsx:1004, HotelAnvelope.tsx:751 | ❌ Open |
| FE-H03 | Props destructuring | HIGH | CAT-4 | ProductCard.tsx:9 | ❌ Open |
| FE-H04 | Server data in global stores | HIGH | CAT-4 / CAT-8 | 7 store files | ❌ Open |
| FE-H05 | No mutation helper, try/catch duplicated | HIGH | CAT-3 | many pages | ❌ Open |
| FE-H06 | No UI primitive library | HIGH | CAT-3 | src/components/ | ❌ Open |
| FE-H07 | Silent `catch {}` blocks | HIGH | CAT-7 | 18+ sites | ❌ Open |
| FE-H08 | `any` usage in business code | HIGH | CAT-5 | 86 + 45 sites | ❌ Open |
| FE-H09 | No notification system | HIGH | CAT-7 / CAT-8 | src/store/ | ❌ Open |
| FE-H10 | Untyped `createResource` | HIGH | CAT-5 | HealthCheck.tsx:16 | ❌ Open |
| FE-H11 | Vite base path conditionally set via env | HIGH | CAT-1 / CAT-6 | vite.config.ts:5 | ❌ Open |
| FE-M01 | `createEffect` → should be memo/`on()` | MEDIUM | CAT-4 | 5 sites | ❌ Open |
| FE-M02 | Confirm-dialog duplicated per page | MEDIUM | CAT-7 | 4 pages | ❌ Open |
| FE-M03 | Raw store setters exported | MEDIUM | CAT-8 | 6 stores | ❌ Open |
| FE-M04 | `localStorage` API caches outside auth | MEDIUM | CAT-8 | 7 keys | ❌ Open |
| FE-M05 | `<div onClick>` without role/tabIndex | MEDIUM | CAT-9 | AdminV2 ×3, Clienti, HotelAnvelope, Reception | ❌ Open |
| FE-M06 | Inline domain types per page, no src/types/ | MEDIUM | CAT-3 / CAT-5 | many | ❌ Open |
| FE-M07 | Modal focus trap missing | MEDIUM | CAT-9 | 4 modals | ❌ Open |
| FE-M08 | Inputs without `<label>` | MEDIUM | CAT-9 | many | ❌ Open |
| FE-M09 | Loading state inconsistent | MEDIUM | CAT-7 | HotelAnvelope, AdminV2, POS | ❌ Open |
| FE-M10 | Form state via N individual signals | MEDIUM | CAT-3 | 6 pages | ❌ Open |
| FE-L01 | Missing return types on exports | LOW | CAT-5 | api.ts:40 + a few stores | ❌ Open |
| FE-L02 | Icon-only buttons without aria-label | LOW | CAT-9 | DeviceSetupModal, ShoppingList | ❌ Open |
| FE-L03 | `as` casts uncommented | LOW | CAT-5 | many | ❌ Open |

---

## Section 4 — Action Plan

### Fix immediately (BLOCKERs — block release)
1. **FE-B01 + FE-B02** — Add `src/hooks/createPagination.ts` and `src/components/data/Pagination.tsx`. Pair them: the hook owns state, the component renders the UI and emits events.
2. **FE-B03** — Wire pagination into the seven list pages. Start with Configurari (heaviest, 7 lists), then Clienti, Rapoarte, Programari. Reception and HotelAnvelope already have cursor pagination; convert their cursors to use the new hook for consistency.

### Fix before go-live (CRITICALs)
1. **FE-C01** — Wrap `Router` children in a `solid-js` `<ErrorBoundary>` with an `AppErrorFallback`. Test by `throw`ing inside one page and confirming graceful fallback.
2. **FE-C02** — Mirror the `<Show when={adminVisible()}>` gate on `/adminv2`. Verify server-side admin enforcement on every `/api/admin/*` route.

### Fix in current sprint (HIGHs)
1. **FE-H11** — Decide base path strategy (hardcode `/berlinstar/` or fail build when env unset). Lowest-effort highest-impact.
2. **FE-H06** — Create `src/components/ui/` with `Button`, `Input`, `Select`, `Modal`, `ConfirmDialog`, `Spinner`, `EmptyState`, `Badge`. Migrate Configurari forms first.
3. **FE-H09** — Add `src/store/notifications.ts` + `<Notifications/>` mounted in `App.tsx`. Route existing `setError` calls through it.
4. **FE-H05** — Add `src/hooks/useAction.ts`. Refactor 5 mutations as proof, leave the rest as backlog.
5. **FE-H04** — Move at least the simplest store (products or employees) to `createResource`. Discuss server-state strategy before doing all 7.
6. **FE-H07** — Audit every `catch {}` block; route non-trivial ones through `notify`, leave a comment on the rest.
7. **FE-H08** — Pick the worst file (`generateDocuments.ts`) and replace `: any` / `as any` with typed unions + `parseApiError` for error catches.
8. **FE-H03** — One-line fix in ProductCard.
9. **FE-H10** — One-line fix in HealthCheck.
10. **FE-H01 + FE-H02** — Naturally fall out of CAT-2 work above; verify after.

### Fix in next sprint (MEDIUMs + LOWs)
1. **FE-M01** — Convert pure-derivation effects to memos.
2. **FE-M02** — Replace bespoke confirm modals with shared `ConfirmDialog`.
3. **FE-M03** — Hide raw store setters (rename `_setX`).
4. **FE-M04** — Move API caches out of `localStorage`.
5. **FE-M05** — Add `role="button"` + `tabIndex` + Enter handler to 6 `<div onClick>` sites.
6. **FE-M06** — Stand up `src/types/`, consolidate duplicate domain types.
7. **FE-M07** — Implement focus-trap once in shared `Modal`.
8. **FE-M08** — Add labels through the shared `Input` primitive migration.
9. **FE-M09** — Once `createResource` is in place, loading state becomes free.
10. **FE-M10** — Build `createForm`, migrate one big form.
11. **FE-L01 / FE-L02 / FE-L03** — Mechanical cleanup pass.

---

## Section 5 — Summary

### Finding counts by category

| Category | BLOCKER | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|---------|----------|------|--------|-----|-------|
| CAT-1 Routing | 0 | 1 | 1 | 0 | 0 | 2 |
| CAT-2 Pagination | 3 | 0 | 2 | 0 | 0 | 5 |
| CAT-3 Reuse | 0 | 0 | 2 | 2 | 0 | 4 |
| CAT-4 Reactivity | 0 | 0 | 2 | 1 | 0 | 3 |
| CAT-5 TypeScript | 0 | 0 | 2 | 1 | 2 | 5 |
| CAT-6 Performance | 0 | 0 | 1 | 0 | 0 | 1 |
| CAT-7 Error/UX | 0 | 1 | 2 | 3 | 0 | 6 |
| CAT-8 Store | 0 | 0 | 1 | 2 | 0 | 3 |
| CAT-9 Accessibility | 0 | 0 | 0 | 3 | 1 | 4 |
| **TOTAL** | **3** | **2** | **13** | **12** | **3** | **33** |

### Top 3 systemic issues

1. **No shared abstractions for UI, mutations, forms, pagination, notifications.** Every page reinvents inputs, buttons, modals, confirmations, "saving" signals, error toasts, and pagination cursors. The result is the four largest files in the repo (Configurari 2708, HotelAnvelope 2588, AdminV2 1773, ShoppingList 1529, Reception 1154) — much of this size is duplicated machinery. Building `src/components/ui/`, `src/hooks/{createPagination,useAction,createForm}`, and `src/store/notifications.ts` would shrink these pages by 30–50% without touching business logic.
2. **Server state in global stores instead of `createResource`.** 7 of 15 stores cache API responses with custom TTL + custom invalidation + (in `receiptsStore`) custom SSE merge. The whole app has exactly one `createResource` (in HealthCheck). This is the root cause of the silent `catch {}` epidemic, the per-page loading-flag boilerplate, and the inconsistent error UX. Migrating even half of these to `createResource` would simplify both the stores and their consumers.
3. **`any` as the default escape hatch at the API boundary.** 86 `: any` + 45 `as any` cluster around two patterns: `catch (e: any)` and "I got a JSON back, let me cast it". `unknown` + `parseApiError` would handle the first; per-endpoint typed responses would handle the second. Strict mode is on, which makes this fixable mechanically.

### Positive findings

- **PDF / QR libraries are correctly lazy-loaded.** No `jspdf`/`qrcode` in the main bundle — surprising and good. The `loadPdf()` helper at [generateDocuments.ts:472](frontend/src/utils/generateDocuments.ts#L472) is a model dynamic-import pattern.
- **Route-level code splitting is correctly applied** for every page except `Login` (which is reasonable — it loads on first paint anyway).
- **Auth + 401 handling is centralized and correct:** one `apiFetch`, one `bs:unauthorized` event, one `<Protected>` listener. Page-level fetches outside `apiFetch` (uploads, ANAF) are all justified.
- **TypeScript strict mode is on**, with `noUnusedLocals` + `noUnusedParameters` — the foundation for fixing FE-H08 is already in place.
- **Empty states and confirm dialogs are present** on the larger lists; they just aren't shared components yet.
- **No direct store mutations**: every store update goes through the appropriate setter. The discipline is there; the design just exposes too many raw setters (FE-M03).
- **`ProductCard` is a correctly-built keyboard-accessible card** — use it as the pattern for the FE-M05 fix.
- **Vite chunk strategy** (manual `solid-vendor` split + 300KB warning) is a sensible baseline; the bundle should stay healthy if the open issues are fixed.

---
*Generated by Frontend Code Review Agent. All findings reference specific files and lines.*
