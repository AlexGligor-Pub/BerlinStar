# Audit arhitectură frontend — BerlinStar (SolidJS + Vite + TS)

Data: 2026-09-03. Branch: `feat/utilizatori-roluri`. Mod: read-only, fără build (s-a analizat `dist/` existent din 2026-09-01).
Rădăcină: `/mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/frontend`. Toate căile de mai jos sunt relative la `frontend/`.

Severități: **Critical / High / Medium / Low**. Efort: **S** (<1 zi) / **M** (1–3 zile) / **L** (>3 zile).

---

## 0. Rezumat executiv

Aplicația este un SPA SolidJS de ~54.600 linii (`src/`), cu 21 rute lazy, 22 store-uri globale bazate pe semnale și un strat API minimal (`apiFetch`). Fundația e sănătoasă (routing lazy, wrapper unic de fetch, guard-uri de rol, ErrorBoundary global, SSE cu backoff), dar **paginile sunt monoliți**: 5 fișiere depășesc 1.500 linii (Rapoarte 3.843, HotelAnvelope 3.156, ShoppingList 2.265, Reception 1.953, Concedii 1.544), stilizarea e făcută cu 2.366 atribute `style="..."` inline peste un `global.css` de 7.779 linii, iar primitivele reutilizabile create anterior (`createForm`, `useAction`, `DataTable`, `Button/Input/Select`) sunt **practic neutilizate** (0, 0, 3 și respectiv 2 importuri). Nu există teste, lint sau formatter. Tipurile API sunt scrise manual, duplicate între pagini și store-uri (322 declarații `interface/type`, 1.420 câmpuri snake_case).

**Notă de status față de raportul anterior (`frontend_code_review_report.md`, 2026-05-14):** BLOCKER-ele FE-B01/B02 (hook + componentă de paginare) sunt rezolvate (`src/hooks/createPagination.ts`, `src/components/data/Pagination.tsx`), dar folosite doar în 3 pagini. FE-C01 (ErrorBoundary) rezolvat (`src/components/layout/AppErrorBoundary.tsx`). FE-H03 (destructurare props) rezolvat (0 apariții). FE-H05/H06/H09/M10 (useAction, UI kit, toast, createForm) sunt „rezolvate” doar la nivel de infrastructură — cu excepția `notify()` (251 apeluri), nimic nu a fost adoptat. FE-B03 (liste fără paginare server) rămâne deschis în panourile Configurari (`limit=200` la mount, ex. `src/pages/configurari/DepartamentePanel.tsx:35`). FE-C02 (AdminV2 fără guard de rută) rămâne parțial: ruta nu e păzită (`src/App.tsx:135`), dar secțiunile cer un token admin verificat de server (`src/pages/AdminV2.tsx:100-110`).

---

## 1. Structură proiect și routing

### Observații
- Structura pe foldere e clasică și corectă: `components/ (ui, data, layout, efactura, subscription)`, `hooks/`, `pages/ (+ subfoldere adminv2, configurari, efactura, factura-rapida, rapoarte, angajati)`, `store/`, `styles/`, `types/`, `utils/ (+ pdf)`, `docs/content/*.md`.
- **Routing**: toate rutele sunt declarate într-un singur loc, `src/App.tsx:93-151`, cu `lazy()` per pagină (`src/App.tsx:17-37`) — code-splitting per rută funcționează (confirmat de chunk-urile `POS-*.js`, `Reception-*.js` etc. din `dist/assets`).
- Guard-urile de rol sunt inline pe fiecare rută: `<Show when={canX()} fallback={<Navigate href="/" />}>` (ex. `src/App.tsx:100-104`, `110-119`, `130-134`). `can()` returnează **optimist `true`** când profilul nu e încărcat (`src/store/permissions.ts:64-67`) — acceptabil, serverul respinge cu 403, dar UI-ul poate „licări”.
- Componenta `Protected` (`src/App.tsx:47-85`) este instanțiată **per rută** (`component={() => <Protected component={POS} />}`), deci `NavBar`, `SubscriptionBanner` și `DeviceSetupModal` se **remontează la fiecare navigare**, iar `refreshProfile()` (`src/App.tsx:60`) face un request `/api/auth/me` la fiecare schimbare de pagină. Excepția e `/efactura`, care folosește corect nested routes cu layout (`src/App.tsx:142-150`).
- Ruta `/adminv2` nu are guard de rol (`src/App.tsx:135`); accesul e controlat în pagină prin parole verificate pe server (`src/pages/AdminV2.tsx:100-110`, `src/pages/adminv2/admin-auth.ts`).
- Registru de navigație **triplu**: rutele în `App.tsx`, meniul în `NavBar.tsx` (blocuri `<Show when={canAdvanced()}>` la `src/components/NavBar.tsx:195,203,211,225,233`), secțiunile ghidului în `src/docs/index.ts:9-24`. Adăugarea unei pagini cere 3 editări sincronizate + permisiuni.

### Cele mai mari fișiere (linii)
| Fișier | Linii |
|---|---|
| `src/styles/global.css` | 7.779 |
| `src/pages/Rapoarte.tsx` | 3.843 |
| `src/pages/HotelAnvelope.tsx` | 3.156 |
| `src/utils/generateDocuments.ts` | 2.277 |
| `src/components/ShoppingList.tsx` | 2.265 |
| `src/pages/Reception.tsx` | 1.953 |
| `src/pages/rapoarte/charts.ts` | 1.673 |
| `src/pages/Concedii.tsx` | 1.544 |
| `src/pages/adminv2/EFacturaSection.tsx` | 1.421 |
| `src/components/UsersManager.tsx` | 1.198 |
| `src/pages/adminv2/AccountsSection.tsx` | 1.062 |
| `src/pages/Programari.tsx` | 1.026 |

`Rapoarte.tsx` conține 11 panouri de raport ca funcții în același fișier (`src/pages/Rapoarte.tsx:392,647,974,1527,1988,2212,2693,3034,3244`) și 42 declarații de tip; doar `StocuriSection` a fost extras (`src/pages/rapoarte/StocuriSection.tsx`). `HotelAnvelope.tsx` are 59 `createSignal` și 388 atribute `style=` inline.

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| S1 | **High** | Pagini-monolit >1.500 linii, cu zeci de semnale locale; imposibil de testat/refolosit | `Rapoarte.tsx` (3.843), `HotelAnvelope.tsx` (3.156, 59 semnale), `ShoppingList.tsx` (2.265, 44 semnale), `Reception.tsx` (1.953, 39 semnale) |
| S2 | **Medium** | Shell-ul aplicației (NavBar, bannere, refreshProfile) se remontează la fiecare rută; `/api/auth/me` la fiecare navigare | `src/App.tsx:47-85`, `:60`, `:98-140` |
| S3 | **Medium** | Registru de rute/meniu/ghid triplicat, fără sursă unică | `src/App.tsx:93-151`, `src/components/NavBar.tsx:195-259`, `src/docs/index.ts:9-24` |
| S4 | **Low** | `/adminv2` fără guard de rută (compensat de verificarea server-side a parolelor) | `src/App.tsx:135`, `src/pages/AdminV2.tsx:100-110` |

### Recomandări
- **R1 (M)** Mută `Protected` + `NavBar` într-un layout de rută părinte (`<Route component={AppLayout}>` cu `props.children`), ca la `/efactura`. Elimină remount-ul și request-ul `/me` per navigare. Guard-urile devin `<Route path="/rapoarte" component={guard(canReports, Rapoarte)}>` printr-un helper.
- **R2 (S)** Definește un `routes.ts` (`{ path, label, icon, requires, component, guideId }`) consumat de `App.tsx`, `NavBar.tsx` și `docs/index.ts`.
- **R3 (L)** Sparge `Rapoarte.tsx` în `pages/rapoarte/<Panel>.tsx` cu `lazy()` per panou (chunk-ul `Rapoarte` are 115 KB + `charts` 120 KB), la fel `HotelAnvelope.tsx` (formular/anvelopă/card/listă) și `ShoppingList.tsx` (modalele inline devin componente).

---

## 2. State management și data fetching

### Observații
- 22 store-uri module-singleton în `src/store/`, toate pe `createSignal` (540 apeluri în src; `createStore` doar în `authStore.ts:57` și `cartStore.ts`). Nu există `createResource` în pagini (singura utilizare: `src/pages/HealthCheck.tsx:22`) și nu există nici un strat de query/cache (nu există TanStack Query/`@solid-primitives`).
- Pattern dominant în pagini: `const [items,setItems]=createSignal([]); const [loading,setLoading]=createSignal(true); const [error,setError]=createSignal(null); async function load(){ setLoading(true); try{ const res=await apiFetch(...); if(!res.ok) throw ...; setItems((await res.json()).items) } catch{ setError(...) } finally{ setLoading(false) } } onMount(load);` — ex. `src/pages/configurari/DepartamentePanel.tsx:8-46`, `src/pages/Clienti.tsx:62-134`. Metrice: 291 semnale `createSignal(false|true)` (loading), 202 `setError*(`, 78 blocuri `catch (`.
- **Invalidare**: după mutații se re-cheamă `load()` integral (`DepartamentePanel.tsx:89,105,124`). Nu există optimistic updates (o excepție minoră: `DepartamentePanel.tsx:70` patch local după upload).
- Store-urile „cache server”: `productsStore` (`bs_products_cache_v2`, fără TTL, `src/store/productsStore.ts:26-38`), `employeesStore` (TTL 20 min, `src/store/employeesStore.ts:22-23,50-60`), `catalogThemesStore`, `hotelAnvelopeStore` (5 funcții `invalidate*Cache` manuale, `src/store/hotelAnvelopeStore.ts:445-480`). Politici de cache diferite per store, fără abstracție comună. 73 apeluri `localStorage.*Item` în 20+ fișiere.
- Hook-urile din `src/hooks/` (`createForm.ts`, `useAction.ts`, `createPagination.ts`) sunt bine scrise dar: `createForm` și `useAction` au **0 utilizări** în afara definiției (grep `import .*(createForm|useAction)` → nimic); `createPagination` e folosit în 3 pagini (`Clienti.tsx:67`, `EFacturaSent.tsx`, `EFacturaReceived.tsx`).
- Hack anti-first-run pe efecte: `let _mounted=false; createEffect(on([...],()=>{ if(!_mounted){_mounted=true;return} load() }))` (`src/pages/Clienti.tsx:138-142`) — `on(..., { defer: true })` face exact asta nativ.
- Formularele sunt semnale de obiect cu spread (`src/pages/Clienti.tsx:71,74,88`) sau zeci de semnale scalare (`DepartamentePanel.tsx:12-21`), ceea ce re-randează întregul obiect la fiecare tastă; `createStore` ar oferi granularitate.
- `receiptsStore` combină date + SSE + mapare + persistență (661 linii, 15 apeluri `localStorage`).

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| ST1 | **High** | Nicio abstracție de data-fetching: fiecare listă își reimplementează loading/error/reload; 291 semnale loading, 202 setError, 78 try/catch | `DepartamentePanel.tsx:8-46`, `Clienti.tsx:62-134` |
| ST2 | **High** | `createForm`/`useAction` există dar au 0 utilizări → boilerplate rămâne | `src/hooks/createForm.ts`, `src/hooks/useAction.ts`, grep import = 0 |
| ST3 | **Medium** | Politici de cache localStorage ad-hoc (cu/fără TTL, chei per store), fără invalidare centralizată | `productsStore.ts:26-38`, `employeesStore.ts:22-23`, `hotelAnvelopeStore.ts:445-480` |
| ST4 | **Medium** | Fără optimistic updates; fiecare mutație reîncarcă lista întreagă | `DepartamentePanel.tsx:89,105,124` |
| ST5 | **Low** | `_mounted` flag în loc de `on(..., {defer:true})`; formulare ca semnal-obiect cu spread | `Clienti.tsx:138-142`, `:71-74` |

### Recomandări
- **R4 (M)** Introdu `createResource`-based `createListResource<T>(fetcher, deps)` (sau `@tanstack/solid-query`) care returnează `{ data, loading, error, refetch, mutate }`. Migrează întâi panourile Configurari (14 fișiere cu același pattern).
- **R5 (S)** Adoptă `useAction` în mutații (save/delete) — reduce fiecare handler de la ~15 la ~3 linii și unifică toast-urile de eroare.
- **R6 (S)** Un `createCachedSignal(key, ttl, loader)` în `store/` pentru products/employees/departments; elimină cele 3 implementări.

---

## 3. Stratul API

### Observații
- Un singur wrapper `apiFetch` (`src/utils/api.ts:67-87`): prefixare `API_BASE`, header `Authorization: Bearer`, `Content-Type` automat, colapsare `//`, raportare conectivitate, logout + event `bs:unauthorized` pe 401 (prins în `App.tsx:62-69`). Helpere: `apiUpload`, `parseApiError` (înțelege 422 Pydantic), `readApiError`, `readJsonSafe`, `apiFetchJson<T>`. Solid ca bază.
- **Fără retry, fără timeout implicit** (timeout doar unde apelantul pune `AbortSignal.timeout`, ex. `productsStore.ts:44`), fără deduplicare de request-uri, fără anulare la unmount.
- 248 apeluri `apiFetch*` răspândite în 45 fișiere; **paginile fac direct fetch** (HotelAnvelope 34, LocatiiPanel 14, Reception 10, ShoppingList 10, Clienti 9). 133 literale `"/api/..."` hard-codate în pagini. Nu există un modul `api/clients.ts` per entitate.
- **Tipare**: tipurile de răspuns sunt scrise manual, lângă apel: `src/types/` are doar 4 fișiere (`api.ts`, `client.ts`, `health.ts`, `location.ts`), în timp ce 322 `interface/type` sunt împrăștiate în pagini/store-uri. `Client` și `ClientVehicol` sunt definite în `src/types/client.ts:1-30` **și** re-declarate local în `src/pages/Clienti.tsx:11-35` (drift: `client_id` obligatoriu vs opțional). 1.420 câmpuri snake_case în tipuri TS → maparea manuală snake→camel e făcută per store (`productsStore.ts:15-57`, `employeesStore.ts:14-20`, `receiptsStore.ts:126`). Nu există generare din OpenAPI (nici `openapi-typescript`, nici `orval` în `package.json`).
- Auth: token în `localStorage` `bs_auth` (`src/store/authStore.ts:22,57-63`) — expus la XSS; se folosește `DOMPurify` (dep) ceea ce indică randare de HTML. Token admin elevat separat în `localStorage` 24 h (`src/pages/adminv2/admin-auth.ts:12-14,36-38`). Wrapper redundant `reportsApiFetch` care doar delegă (`src/pages/Rapoarte.tsx:42-44`).
- **SSE** (`src/store/receiptsStore.ts:582-661`): două conexiuni (POS/Reception), reconectare cu backoff exponențial + jitter (`:592-595`), debounce reload 300 ms (`:587-590`). Tokenul JWT e trimis **în query string** (`:606`, `:641`) → ajunge în access-log-uri nginx/uvicorn. `AssistantSection.tsx` are propriul client SSE (3 apariții), nefactorizat.
- Erorile: `catch {}` gol/silențios apare încă (ex. `DepartamentePanel.tsx:39,90,106,125` cu mesaje generice, fără `readApiError`), deși infrastructura de mesaje există.

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| A1 | **High** | Fără client API tipizat per entitate; 248 apeluri și 133 URL-uri literale în UI; tipuri duplicate/drift | `Clienti.tsx:11-35` vs `types/client.ts:1-30`; grep `"/api/` = 133 |
| A2 | **High** | Tipuri API scrise manual (322 decl., 1.420 câmpuri snake_case), fără generare din OpenAPI-ul FastAPI | `package.json` (fără codegen), `types/` = 4 fișiere |
| A3 | **Medium** | Token JWT în query string la SSE (log leakage) | `receiptsStore.ts:606,641` |
| A4 | **Medium** | Fără timeout/retry/anulare implicite în `apiFetch` | `api.ts:67-87` |
| A5 | **Medium** | Token-uri în `localStorage` (bs_auth, adminv2_token) — vector XSS, agravat de randare HTML (DOMPurify) | `authStore.ts:22,61`, `admin-auth.ts:12-14` |
| A6 | **Low** | Client SSE duplicat (receiptsStore + AssistantSection); `reportsApiFetch` wrapper mort | `receiptsStore.ts:602-661`, `AssistantSection.tsx`, `Rapoarte.tsx:42-44` |

### Recomandări
- **R7 (M)** Generează tipurile din `/openapi.json` cu `openapi-typescript` (`src/types/generated/api.d.ts`) și un `apiClient<paths>()` tipizat (ex. `openapi-fetch`). Elimină interfețele manuale progresiv; `snake_case` rămâne în tipuri, maparea camel dispare.
- **R8 (M)** Introdu `src/api/<entity>.ts` (ex. `clientiApi.list(params)`, `.create()`, `.update()`, `.remove()`) — singurul loc cu URL-uri. Paginile nu mai importă `apiFetch`.
- **R9 (S)** SSE: trimite token-ul printr-un endpoint de „ticket” cu viață scurtă sau cookie HttpOnly; extrage `createSSE(url, handlers)` cu backoff în `utils/sse.ts` și refolosește în `AssistantSection`.
- **R10 (S)** `apiFetch`: `AbortSignal.timeout(15000)` implicit, un retry pentru GET idempotente la eroare de rețea, opțional `signal` legat de `onCleanup`.

---

## 4. Design de componente

### Observații
- **UI kit** (`src/components/ui/`: Button, Input, Select, Modal, ConfirmDialog, Spinner, EmptyState, Badge, PageWrapper) există, dar: `Button/Input/Select` sunt importate în **2** fișiere; `Modal` din ui e importat în ~10 fișiere, în timp ce **55** overlay-uri de modal sunt construite inline (`class="sl-modal-overlay"`: ShoppingList 13 — ex. `src/components/ShoppingList.tsx:258,406,1575,1610`; HotelAnvelope 12; Reception 7; Stocuri 4). Modalele inline nu au focus-trap/Escape, deci fix-ul FE-M07 e valabil doar pentru 10 %.
- `Modal.tsx` folosește `id="modal-title"` fix (`src/components/ui/Modal.tsx:76,80`) → ID duplicat când două modale sunt deschise (ex. modal + ConfirmDialog). Fără închidere la click pe overlay — conform preferinței proiectului.
- **Duplicare de logică**: `SearchableSelect` există ca componentă (`src/components/SearchableSelect.tsx:3-10`) și e **copiat identic** în `src/pages/HotelAnvelope.tsx:192-200`. `compressToPng` există în două variante divergente (`src/pages/configurari/shared.ts:8` maxBytes 100 KB, scalare −0.1; `src/pages/adminv2/shared.ts:25` maxBytes 500 KB, scalare 0.75). `fmtDate`/`fmtMoney`: 41 definiții de helpere `fmt*/format*` în 26 fișiere (ex. `HotelAnvelope.tsx:66`, `adminv2/shared.ts:14`, `rapoarte/format.ts`, `utils/pdf/format.ts`). `DeleteModal` re-declarat local în `Clienti.tsx:37` deși există `ConfirmDialog`.
- **Tabele**: trei abordări coexistă — TanStack Table în 9 fișiere (`EFacturaSent/Received`, `Stocuri`, `StocActivitate`, `UsersManager`, adminv2 `Tasks/Logs/Accounts/RotiMasina`, parțial `Rapoarte`), `DataTable` propriu (`src/components/data/DataTable.tsx`, cu propriul `ColumnDef` incompatibil cu TanStack) în 3 fișiere, și `<table>` scris manual în ~15 fișiere (Rapoarte 11). Regula proiectului (memorie: „TanStack pentru orice tabel nou + mobile-friendly”) nu e încă reflectată într-o componentă `TanStackTable` reutilizabilă — fiecare fișier repetă `createSolidTable + flexRender + getCoreRowModel` (5 simboluri × 9 fișiere).
- **Formulare**: fără bibliotecă de validare (nici zod/valibot); validare ad-hoc (`cnpError` în `types/client.ts:46`), inputs cu `placeholder` în loc de `<label>` (`DepartamentePanel.tsx:168-169`). `createForm` neutilizat.
- **Stilizare**: 2.366 atribute `style="..."` (HotelAnvelope 388, Rapoarte 265, EFacturaSection 121) peste `global.css` cu 1.185 selectori de clasă, 73 variabile CSS, 37 media queries, secțiuni per pagină (`/* ===== POS PAGE ===== */` la `global.css:828`, `CONFIGURARI` la `:3474`). Un singur fișier CSS = orice pagină încarcă 130 KB CSS (`dist/assets/index-Dq64VivG.css`), și fără CSS modules/scoping → riscuri de coliziune.
- Prop drilling: moderat (0 destructurări props — bine). 126 non-null assertions `()!` (ex. `deleteTarget()!.name`, `DepartamentePanel.tsx:145`) — pattern Solid tipic, dar `<Show when={x()} keyed>{(v)=>...}` l-ar elimina.
- Pozitiv: `Notifications` global + `notify()` adoptat (251 apeluri); `ConfirmDialog` adoptat parțial; `PageWrapper/EmptyState` există.

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| C1 | **High** | 55 modale inline vs 10 folosiri `Modal` → fără a11y/focus-trap, cod duplicat | `ShoppingList.tsx:258,406,1575,1610`, `HotelAnvelope.tsx` (12) |
| C2 | **High** | Stilizare inline masivă (2.366) + CSS global monolit 7.779 linii | `HotelAnvelope.tsx` (388 style=), `global.css` |
| C3 | **Medium** | Trei paradigme de tabel (TanStack / DataTable / `<table>` manual), fără wrapper comun | 9 / 3 / 15 fișiere |
| C4 | **Medium** | Componente și helpere copiate: `SearchableSelect`, `compressToPng`, `fmtDate`, `DeleteModal` | `HotelAnvelope.tsx:192` vs `components/SearchableSelect.tsx:3`; `configurari/shared.ts:8` vs `adminv2/shared.ts:25` |
| C5 | **Low** | `Modal` cu `id="modal-title"` fix; inputs fără `<label>` | `ui/Modal.tsx:76,80`; `DepartamentePanel.tsx:168` |

### Recomandări
- **R11 (M)** `components/data/TanStackTable.tsx` generic (`columns: ColumnDef<T>[]`, `data`, sorting, `mobileCard?: (row)=>JSX`) + `columnHelpers.ts` (`textCol`, `moneyCol`, `dateCol`, `actionsCol`). Șterge `DataTable` după migrarea celor 3 folosiri.
- **R12 (L)** Campanie „zero modal inline”: înlocuiește cele 55 overlay-uri cu `<Modal>`; adaugă `id` unic (`createUniqueId()`) în `Modal.tsx`.
- **R13 (M)** `utils/format.ts` unic (`fmtMoney`, `fmtDate`, `fmtDateTime`, `fmtNumber` cu `Intl.NumberFormat("ro-RO")`), șterge cele 41 definiții locale; unifică `compressToPng` în `utils/image.ts`.
- **R14 (L)** Sparge `global.css` în `styles/{tokens,base,components,pages/*}.css` importate din pagină (Vite le va pune în chunk-ul paginii) sau adoptă CSS Modules; interzice `style=` nou prin lint (`solid/style-prop`).

---

## 5. Calitate TypeScript

### Observații
- `tsconfig.app.json` este **strict și modern**: `strict`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (`tsconfig.app.json:23-29`). `build` rulează `tsc -b` înainte de `vite build` (`package.json:8`) → erorile de tip blochează build-ul. Foarte bine. Lipsește `noUncheckedIndexedAccess`.
- **126 apariții `any`** (`: any` / `as any` / `<any>`), concentrate în `utils/generateDocuments.ts` (24), `pages/rapoarte/charts.ts` (11, d3), `Reception.tsx` (8), `HotelAnvelope.tsx` (8), `generateReceiptPdf.ts` (6). 36 sunt `catch (e: any)`. 0 `@ts-ignore/@ts-expect-error`, 0 `console.log` — curat.
- `src/types/` e sub-utilizat (4 fișiere, 4 re-exporturi în `types/index.ts`); tipurile de domeniu trăiesc în store-uri (`Product` în `productsStore.ts:4`, `Receipt` în `receiptsStore.ts`) și pagini (`Rapoarte.tsx` 42 decl.). `types/client.ts` conține și funcții (`normalizeCnp`, `cnpForSave`) — mix tipuri/logică.
- `@types/d3` e în `dependencies` în loc de `devDependencies` (`package.json:15`).

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| T1 | **Medium** | 126 `any`, 24 în generatorul de documente PDF (cod critic fiscal) | `utils/generateDocuments.ts`, `rapoarte/charts.ts` |
| T2 | **Medium** | Tipuri de domeniu împrăștiate/duplicate; `types/` aproape gol | `Clienti.tsx:11-35` vs `types/client.ts` |
| T3 | **Low** | `@types/d3` în dependencies; lipsă `noUncheckedIndexedAccess` | `package.json:15`, `tsconfig.app.json` |

### Recomandări
- **R15 (S)** `catch (e: unknown)` + helper `errMsg(e)`; tipizează d3 (`Selection<SVGGElement, ...>`) în `charts.ts`; `useUnknownInCatchVariables` e deja implicit prin `strict`, deci anotarea `: any` e o alegere explicită de evitat.
- **R16 (M)** Odată cu R7, mută toate tipurile de domeniu în `types/generated` + `types/domain.ts` (aliasuri camel dacă e nevoie).

---

## 6. Build, performanță, dependențe, i18n

### Observații (din `dist/` existent, 52 fișiere, 3,2 MB)
- `vite.config.ts`: base `/berlinstar/` în producție (`:6-9`), proxy `/api` → 4000, `usePolling` (WSL), `sourcemap: false`, `chunkSizeWarningLimit: 300`, `manualChunks` doar `solid-vendor` (`:27-33`). Fără `build.target`, fără analiză de bundle (`rollup-plugin-visualizer`).
- Chunk-uri (bytes, minificat, ne-gzip): `jspdf.es.min` **390.372** + `html2canvas.esm` **202.301** + `index.es` (fflate/jsPDF deps) 151.000 + `jspdf.plugin.autotable` 31.081 → **~775 KB pentru PDF**, încărcat lazy (dynamic import în `utils/generateDocuments.ts`, `generateReceiptPdf.ts`, `pdf/primitives.ts`) — corect, dar `html2canvas` (202 KB) e tras de jsPDF deși nu pare folosit direct (unverified: nu am găsit `html2canvas` în src; e dependență opțională a jsPDF care ajunge în bundle).
- Pagini: `AdminV2` 196 KB, `Configurari` 125 KB, `Rapoarte` 115 KB + `charts` 120 KB (d3), `HotelAnvelope` 107 KB, `POS` 89 KB, `Reception` 73 KB, `Concedii` 54 KB, `Ghid` 51 KB. Entry `index` 57 KB + `solid-vendor` 44 KB + TanStack shared 53 KB + CSS **130 KB** (un singur fișier, tot CSS-ul pe orice pagină).
- `logo.png` **793 KB** în `src/assets` și `public/` (`ls src/assets`), importat în NavBar/Login/AdminV2/NoAccess (`NavBar.tsx:10`) și folosit ca favicon (`dist/index.html:9-11`) → ~0,8 MB pe primul load pentru un logo; `generateReceiptPdf.ts:271` îl mai și fetch-uiește din `public/`.
- `AdminV2` importă static toate cele 14 secțiuni (`src/pages/AdminV2.tsx:6-19`) → 196 KB pentru pagina de admin; `Configurari` importă static 14 panouri (`src/pages/Configurari.tsx:3-16`). `Rapoarte` importă static toate panourile + d3.
- `Ghid`: `import.meta.glob(..., eager: true)` încarcă toate cele 3 limbi × ~14 secțiuni de markdown în același chunk (`src/docs/index.ts:27`).
- **i18n**: UI hard-codat în română (ex. `DataTable.tsx:29`, `Pagination.tsx:37`), fără bibliotecă; doar ghidul are ro/en/hu (`src/store/guideStore.ts:3`). Formatare: 57 apeluri `toLocale*String/Intl` răspândite, plus helpere `fmt*` locale (vezi C4). Nicio bibliotecă de date (fără date-fns/dayjs) — manipulări manuale (`HotelAnvelope.tsx:46-60`).
- Dependențe: mici și rezonabile (`solid-js`, `@solidjs/router`, `@tanstack/solid-table`, `d3`, `jspdf(+autotable)`, `qrcode`, `dompurify`, `@stripe/stripe-js`). `d3` complet importat (7.9) — se pot folosi doar sub-pachetele (`d3-scale`, `d3-shape`).

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| B1 | **High** | `logo.png` 793 KB pe primul load (NavBar/Login/favicon) | `src/assets/logo.png`, `NavBar.tsx:10`, `dist/index.html:9-11` |
| B2 | **Medium** | CSS unic de 130 KB pe orice rută; `AdminV2` 196 KB și `Configurari` 125 KB fără lazy pe secțiuni | `dist/assets/index-Dq64VivG.css`, `AdminV2.tsx:6-19`, `Configurari.tsx:3-16` |
| B3 | **Medium** | `html2canvas` 202 KB în bundle fără utilizare directă (unverified — probabil tras de jsPDF) | `dist/assets/html2canvas.esm-*.js` |
| B4 | **Low** | Fără i18n pentru UI; formatare numerică/dată dispersată | `DataTable.tsx:29`, 57 apeluri `toLocale*` |
| B5 | **Low** | Ghidul încarcă toate limbile eager; `d3` monolitic | `docs/index.ts:27`, `rapoarte/charts.ts` |

### Recomandări
- **R17 (S)** Convertește `logo.png` în WebP/AVIF ≤ 30 KB + SVG pentru favicon; generează `apple-touch-icon` 180 px. Câștig imediat ~750 KB.
- **R18 (S)** `lazy()` pe secțiunile AdminV2/Configurari/Rapoarte (păstrează registrul, schimbă `component: lazy(() => import(...))`); `rollup-plugin-visualizer` în `vite.config.ts` pentru monitorizare.
- **R19 (S)** Ghid: `import.meta.glob` fără `eager`, încărcat pe secțiune + limbă.
- **R20 (M)** `utils/format.ts` cu `Intl.NumberFormat/DateTimeFormat` memoizate (vezi R13); dacă se dorește multilingv, pregătește un `t()` minimal peste JSON per limbă (ghidul deja are ro/en/hu).

---

## 7. Testare, lint, format, CI

### Observații
- **Zero teste**: nu există `*.test.*`/`*.spec.*` în `src/`, nici vitest/playwright/jest în `package.json` (scripts: doar `dev`, `build`, `preview`).
- **Zero lint/format**: nu există `.eslintrc*`, `eslint.config.*`, `.prettierrc`, `biome.json`, `.editorconfig` în `frontend/` (verificat `ls -a`). Fără `eslint-plugin-solid` — regulile de reactivitate (destructurare props, acces semnal în afara tracking) nu sunt verificate automat.
- `README.md` e template-ul Solid nemodificat (port 5173, deși `vite.config.ts:14` setează 2000). Nu există documentație de arhitectură în `frontend/`.
- Singurul „gate” este `tsc -b` în `npm run build`.

### Constatări
| ID | Sev. | Constatare | Dovadă |
|---|---|---|---|
| Q1 | **Critical** | Fără teste automate pe un cod care generează documente fiscale (facturi, e-Factura, PDF-uri) și calculează prețuri/TVA | `src/` (0 fișiere test), `package.json:6-10` |
| Q2 | **High** | Fără ESLint (+ `eslint-plugin-solid`) și Prettier; convențiile depind de review manual | `frontend/` (fără config) |
| Q3 | **Low** | README template; port documentat greșit | `README.md`, `vite.config.ts:14` |

### Recomandări
- **R21 (M)** Vitest + `@solidjs/testing-library`: începe cu unit-teste pure (fără DOM) pe `utils/generateDocuments.ts`, `utils/pdf/format.ts`, `utils/api.ts:parseApiError`, `hooks/*`, `store/permissions.ts`, `cartStore` (totaluri/TVA). Țintă: logică de bani acoperită 100 %.
- **R22 (S)** ESLint flat config cu `typescript-eslint` + `eslint-plugin-solid` + Prettier; `lint` și `typecheck` în scripts; rulate în CI/pre-commit.
- **R23 (M)** 3–5 teste Playwright smoke (login, POS adaugă produs → bon, Recepție listă, Clienți CRUD) rulate pe QA.

---

## 8. „Cât costă o funcționalitate nouă” (ex. entitate CRUD „Furnizori”)

### Azi (verificat pe `DepartamentePanel.tsx` / `Clienti.tsx`)
1. Declari manual `interface Furnizor` (+ posibil duplicat în store dacă e refolosit) — 15 linii.
2. Pagina: 8–25 `createSignal` (items/loading/error/search/editId/form fields/addMode/deleteTarget/saving) — `DepartamentePanel.tsx:8-25`.
3. `load()` cu try/catch/finally + `onMount(load)` — 15 linii; paginare = încă `createPagination` + `createEffect(on(...))` + debounce (`Clienti.tsx:136-150`).
4. 3 handlere de mutație (`addItem`, `saveEdit`, `confirmDelete`) × ~15 linii try/catch + `await load()`.
5. JSX: header + search + export + formular inline add + formular inline edit + listă + `DeleteModal` — 150–250 linii cu `class="cfg-*"` și `style=` inline.
6. Înregistrare în 3–4 locuri: `App.tsx` (rută + guard), `NavBar.tsx` (meniu + `<Show when={can…}>`), `docs/index.ts` + 3 fișiere markdown ro/en/hu, eventual `permissions.ts` (`Resource`) **și** oglinda din backend `permissions.py` (`permissions.ts:1-9`).
7. CSS: secțiune nouă în `global.css` (7.779 linii) sau `style=` inline.

Estimare: **400–700 linii** și 6–8 fișiere atinse pentru un CRUD simplu; nimic din pașii 2–5 nu e testabil izolat.

### Țintă (după R4, R5, R7, R8, R11, R2)
```ts
// api/furnizori.ts (generat/tipizat)
export const furnizoriApi = crudApi<Furnizor, FurnizorInput>("/api/furnizori");

// pages/Furnizori.tsx
const list = createListResource(() => furnizoriApi.list(pagination.params(), { q: search() }));
const save = useAction({ fn: furnizoriApi.upsert, successMessage: "Salvat", onSuccess: list.refetch });
const remove = useAction({ fn: furnizoriApi.remove, onSuccess: list.refetch });
const form = createForm<FurnizorInput>({ initialValues: EMPTY, validate: furnizorSchema });
return <CrudPage title="Furnizori" resource={list} pagination={pagination}
  columns={[textCol("nume","Nume"), textCol("cui","CUI"), actionsCol({ onEdit, onDelete: remove.run })]}
  form={<FurnizorForm form={form} onSubmit={form.submit(save.run)} />} />;

// routes.ts — o singură intrare
{ path: "/furnizori", label: "Furnizori", icon: "🏭", requires: "settings", component: lazy(() => import("./pages/Furnizori")), guide: "furnizori" }
```
Estimare: **~120 linii**, 3 fișiere, fiecare strat testabil unitar.

### Pași concreți (ordine recomandată)
| # | Acțiune | Efort | Dependențe |
|---|---|---|---|
| 1 | R22 ESLint/Prettier + R17 logo + R15 `any` în catch | S | — |
| 2 | R21 Vitest pe utils/pdf/format/api/permissions | M | 1 |
| 3 | R7 openapi-typescript + R8 `api/<entity>.ts` (începe cu clienti, departments) | M | — |
| 4 | R4 `createListResource` + R5 `useAction` în panourile Configurari (14 panouri, același pattern) | M | 3 |
| 5 | R11 `TanStackTable` + column factories; migrează `DataTable` (3) și `<table>` din Rapoarte | M | — |
| 6 | R1/R2 layout de rută + `routes.ts` | M | — |
| 7 | R13 `utils/format.ts`, R6 cache comun, R9 SSE util | S–M | — |
| 8 | R3/R12/R14 spargere monoliți, modale, CSS pe pagini | L | 4,5 |

---

## 9. Ce funcționează bine (de păstrat)
- Wrapper `apiFetch` unic, cu tratare 401 centralizată, `parseApiError` pentru 422 Pydantic, raportare conectivitate (`utils/api.ts`, `store/connectivityStore.ts`).
- Lazy routing per pagină; `tsc -b` strict în build; 0 `@ts-ignore`, 0 `console.log`, 0 destructurări de props.
- Permisiuni server-driven (`resources` de la `/api/auth/me`) cu fallback local documentat (`permissions.ts`).
- SSE cu backoff + jitter + debounce; store de conectivitate cu polling adaptiv.
- Igiena `localStorage` cu prefix `bs_` și purge la login/logout (`authStore.ts:92-133`).
- Modal cu focus-trap și Escape, `ConfirmDialog`, toast global `notify()` (adoptat larg: 251 apeluri).
- Ghid utilizator în 3 limbi din markdown (`docs/content`).

---

## 10. Notă asupra `dist/` analizat
Dimensiunile chunk-urilor provin din `frontend/dist/assets` generat la 2026-09-01 20:28 (nu s-a rulat build în acest audit). Sunt bytes minificați fără gzip; cu gzip valorile scad de ~3–4×. `html2canvas` (B3) marcat *unverified* privind cauza includerii.
