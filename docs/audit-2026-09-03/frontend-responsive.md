# Audit responsivitate & performanta runtime — BerlinStar frontend (SolidJS + Vite)

Repo: `/mnt/c/Users/dan-alexandru.gligor/berlinStar/BerlinStar/frontend`
Metoda: audit static, read-only (grep/sed pe surse + inspectie `dist/`). Nu s-a rulat browser/dev server; verdictele vizuale sunt inferate din CSS/JSX, marcate "inferat" unde e cazul.
Toate caile de mai jos sunt relative la `frontend/`.

---

## 0. Verdict per dimensiune ecran

| Ecran | Verdict | Motivare (citari) |
|---|---|---|
| **Mobile (<640px)** | **6/10 — utilizabil, cu inconsistente** | Modalele `.sl-modal` devin full-screen (`global.css:1394-1417`); tabelele TanStack din Stocuri/Rapoarte/Users au card layout via `isMobile()` (`Stocuri.tsx:311`, `Rapoarte.tsx:3600`, `UsersManager.tsx:267`); dar 5 fisiere cu `<table>` fara wrapper de scroll (`Concedii.tsx:1008`, `FacturaRapida.tsx:230`, `FacturaRapidaView.tsx:163`, `rapoarte/StocuriSection.tsx:121/158/189`, `LegacyImportSection.tsx`), `overflow-x:hidden` global pe `html`/`body` (`global.css:97,105`) mascheaza overflow-ul; 21 declaratii `font-size` 9–11px; 55 overlay-uri modale "raw" fara focus-trap. |
| **Tablet (640–1024px)** | **6/10 — zona cea mai putin acoperita** | Breakpoint-urile sunt fragmentate (480/600/640/700/760/767/768/820/900/1200, `global.css` — vezi §2.1); majoritatea regulilor "mobile" se opresc la 640/768 iar cele "desktop" incep la 769 -> pe 768–900 unele layout-uri (ex. `.sl-fdl-grid` 3 coloane pana la 900, `global.css:1216-1221`; `UsersManager` trece pe card sub 900 dar Stocuri sub 768) se comporta diferit intre pagini. Niciun `@container`. |
| **Desktop (>1024px)** | **8/10 — bun** | `.page-content{max-width:1200px}` (`global.css:117-121`), grid-uri `auto-fit`, lazy routes per pagina (`App.tsx:17-37`), TanStack Table cu sort/filter. Minus: 130KB CSS global (uncompressed) incarcat pe orice pagina; logo PNG 793KB in navbar. |

**Nota generala responsivitate: 6.5/10.**

---

## 1. Arhitectura CSS

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 1.1 | **Un singur fisier CSS global de 7.779 linii / 171KB sursa (130KB in `dist/`)**, fara CSS modules, fara preprocesor, fara utilitare. Tot CSS-ul se descarca pe orice ruta, inclusiv `/login` si `/ghid`. | High | `src/styles/global.css` (unicul `.css` din `src`); `dist/assets/index-Dq64VivG.css` 130.346 bytes; `dist/index.html` il incarca ca stylesheet unic. |
| 1.2 | **2.337 atribute `style=` inline in TSX** — stilizarea per-componenta se face predominant inline, ceea ce (a) nu poate fi tintita de media queries, (b) forteaza `!important` in CSS (25 aparitii, ex. `global.css:6682-6695` `.efactura-toolbar ... !important`), (c) creste dimensiunea chunk-urilor JS. | High | numaratoare `grep -c "style=\{\{\|style=\"" src --include=*.tsx` = 2337; ex. `Stocuri.tsx:312-330` (card mobil construit integral din stiluri inline), `EmailSection.tsx:547`, `NavBar.tsx:142`. |
| 1.3 | **Design tokens**: exista `:root` cu ~16 variabile de culoare + 4 teme (`light/dark/gray/apple`), plus aliasuri de compatibilitate (`--surface-2`, `--bg-card`, `--primary`). Nu exista tokens pentru spacing, typography scale, z-index, breakpoints. | Medium | `global.css:2-33` (`:root`), `:35-81` (teme); comentariul de la `:26-32` documenteaza aliasul `--surface-2` introdus pentru ~15 fisiere cu typo. |
| 1.4 | **288 culori hex hard-codate** in afara blocului de variabile (vs. 841 folosiri `var(--…)`) -> risc de contrast gresit in temele dark (exact bug-ul descris in comentariul de la `global.css:26-32`). | Medium | `sed -n 83,7779p global.css \| grep -o '#[0-9a-f]{3,8}' \| wc -l` = 288. |
| 1.5 | **Naming inconsistent**: coexista BEM (`.ai-panel__body`, `.emp-popup__stat`), kebab plat (`.rcard-header`, `.sl-modal-footer`), prefixe de pagina (`.prgm-`, `.cfg-`, `.concedii-`), utilitare Tailwind-like nefolosite (`.flex-col`, `.items-center`, `.gap-8`, `.mt-16`). | Low | `global.css` sectiuni la `:147, 1000, 4370, 7465`; lista clase nefolosite in `/tmp/claude-logs/audit/unused-classes.txt`. |
| 1.6 | **~92 din 892 clase (10%) nu apar in niciun `.ts/.tsx`** (verificare substring, deci estimare conservatoare): `.angajati-grid`, `.emp-popup*` (9 clase), `.doc-dropdown*`, `.pos-theme-preview--c1..c6`, `.rapoarte-col*`, `.notification--*`, `.hotel-layout/.hotel-sidebar`, `.login-title`, `.metoda-btn*`. Sectiunea "RECEPTION PAGE (old table - kept for reference)" e mentinuta explicit. | Medium | `global.css:2831` (comentariu "old table - kept for reference"); `/tmp/claude-logs/audit/unused-classes.txt`. |
| 1.7 | Asset-uri orfane: `src/assets/hero.png` (44KB, 0 importuri), `src/assets/vite.svg`, `src/assets/solid.svg`, `public/fonts/Roboto-Regular.ttf` (43KB, 0 referinte in `src`). Nu intra in bundle (Vite), dar `public/fonts` se publica. | Low | `grep -rn hero src` = 0; `grep -rn Roboto-Regular src` = 0. |

---

## 2. Design responsiv

### 2.1 Breakpoint-uri

Distributie `@media` in `global.css` (39 blocuri):

```
10x max-width:640px   6x max-width:768px   5x max-width:480px
 2x 900px  2x 820px  2x 600px  1x 1200px  1x 767px  1x 760px  1x 700px
 1x min-width:769px  1x min-width:768px  1x min-width:720px  1x min-width:640px
```

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.1.1 | **11 valori distincte de breakpoint**, fara variabile/conventie. Acelasi concept ("mobil") e 640 in ShoppingList/Rapoarte/Concedii, 768 in POS/Reception/AdminV2, 600 in Login, 760 in Ghid, 820 in e-Factura, 900 in UsersManager (JS). Rezultat: pe tableta (640–900) paginile se comporta diferit. | High | `global.css:498, 726, 916, 922, 1216-1219, 1394, 3212, 4370-4373, 6587, 6648, 7775`; JS: `UsersManager.tsx:267` (<900), `Stocuri.tsx:35` (<768). |
| 2.1.2 | **Detectie "isMobile" duplicata in 6 fisiere** cu `window.innerWidth` + `resize` listener, fara hook comun si fara `matchMedia`; pragul difera (768 vs 900). Fiecare resize re-evalueaza semnalul -> re-randare intre tabel si carduri. | Medium | `Stocuri.tsx:35-38`, `StocActivitate.tsx:57-58`, `Rapoarte.tsx:3257-3258`, `FacturaRapida.tsx:43-45`, `AccountsSection.tsx:88-89`, `UsersManager.tsx:267-268`; `src/hooks/` contine doar `createForm`, `createPagination`, `useAction`. |
| 2.1.3 | **Zero container queries, zero `clamp()`** (tipografie ne-fluida), `html{font-size:16px}` fix. | Low | `grep -c "clamp(" global.css` = 0; `grep @container src` = 0; `global.css:95`. |

### 2.2 Viewport / PWA

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.2.1 | Viewport corect: `width=device-width, initial-scale=1, viewport-fit=cover`; manifest `standalone`; `apple-mobile-web-app-status-bar-style=black-translucent`. **Dar** `viewport-fit=cover` + `black-translucent` + navbar `position:sticky; top:0` **fara `padding-top: env(safe-area-inset-top)`** -> in PWA standalone pe iPhone cu notch, navbar-ul intra sub status bar (inferat din CSS; neverificat pe device). Singura utilizare `safe-area` e in panoul AI. | High | `index.html:12-14`; `public/manifest.webmanifest` (`display: standalone`); `global.css:148-164` (`.navbar` sticky, fara safe-area); `global.css:7607` (unica aparitie `env(safe-area-inset-bottom)`). |
| 2.2.2 | `theme-color` fix `#0f172a` (albastru-inchis) indiferent de tema (light default = `#f8f9fa`) -> bara browserului mobil nu se potriveste cu tema light. | Low | `index.html:16`; `global.css:3` (`--bg:#f8f9fa`). |
| 2.2.3 | `html, body { overflow-x:hidden }` global — mascheaza orice overflow orizontal in loc sa-l previna; pe iOS poate bloca si scroll-ul orizontal legitim din `.table-wrap`. | Medium | `global.css:97, 105`. |
| 2.2.4 | `100vh` folosit de 11 ori vs. `100dvh` 8 ori; modalele full-screen mobile folosesc `height:100vh` (bara de adresa acopera footer-ul cu butoane). | Medium | `global.css:1402-1409` (`.sl-modal … height:100vh`), `:6008-6016` (AdminV2 a fost deja corectat pe `dvh`, comentariu explicit). |

### 2.3 Navigatie

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.3.1 | Nu exista sidebar/hamburger; navigatia principala e un **dropdown ancorat de logo** (`.logo-menu`/`.logo-dropdown`, `min-width:280px`, `position:absolute; left:0`). Pe mobil functioneaza (280 < 360), dar nu are tratament dedicat (fara `max-width: calc(100vw - 2*16px)`, fara full-width). AdminV2 are drawer propriu cu backdrop. | Medium | `NavBar.tsx:15,126-154`; `global.css:3038-3050`; `global.css:6023-6030` (`.adminv2-mobile-header`, `.adminv2-backdrop`). |
| 2.3.2 | `.navbar-right` e `position:absolute; right:16px; max-width:calc(100% - 80px)`; username-ul truncat la `max-width:150px` inline. Pe 320–360px, logo + username + 3-4 butoane icon (40px) risca suprapunere (inferat). | Low | `global.css:166-175`; `NavBar.tsx:278-282`. |

### 2.4 Tabele

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.4.1 | **Pattern bun**: TanStack Table in 10 fisiere; pe mobil comuta pe card layout (Stocuri, StocActivitate, Rapoarte/Concedii, UsersManager, AccountsSection). e-Factura si Rapoarte folosesc scroll orizontal + `.hide-mobile` pe coloane secundare. | — (pozitiv) | `Stocuri.tsx:311-374`; `Rapoarte.tsx:3600-3642`; `global.css:6672-6690`, `:5326-5355`. |
| 2.4.2 | **5 fisiere cu `<table>` fara niciun wrapper de scroll orizontal** (in acelasi fisier nu exista `table-wrap`/`table-scroll`/`overflow`): `Concedii.tsx:1008` (`<table class="concedii-list">`), `FacturaRapida.tsx:230`, `factura-rapida/FacturaRapidaView.tsx:163`, `rapoarte/StocuriSection.tsx:121,158,189`, `adminv2/LegacyImportSection.tsx`. Pe 360px acestea fie se comprima ilizibil, fie depasesc si sunt taiate de `overflow-x:hidden`. | High | liniile citate; `global.css:6142-6150` (utilitarul `.table-wrap` exista dar nu e aplicat acolo). |
| 2.4.3 | Tabelele cu card-layout redau **toate** randurile din `table.getRowModel().rows` fara paginare/virtualizare (Stocuri, Rapoarte). `getPaginationRowModel` nu e folosit nicaieri. | Medium | `Stocuri.tsx:313`; `Rapoarte.tsx:3600`; grep `getPaginationRowModel` = 0 rezultate. |
| 2.4.4 | `min-width` fixe mari pe tabele: `822px` (`global.css:4565`), `640px` (`:6679`), `520px` (`:5335`, resetat la 0 sub 640). | Low | liniile citate. |

### 2.5 Modale

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.5.1 | **Pozitiv**: `.sl-modal` devine full-screen sub 640px, footer-ul cu butoane pe 2 coloane. Exista componenta `ui/Modal.tsx` cu Portal, focus-trap, Escape, `role="dialog"`, `aria-modal`. | — | `global.css:1394-1417`; `components/ui/Modal.tsx:24-40, 68-78`. |
| 2.5.2 | **Componenta `Modal` e folosita in doar 12 locuri; 55 overlay-uri `sl-modal-overlay` sunt scrise manual** (ShoppingList 6, MontareRotiModal, RotiMasinaAnvelopeSection 3, SubscriptionCheckoutModal, etc.) -> fara focus-trap, fara Escape, fara `role="dialog"` (doar 2 `role="dialog"` in tot `src`). Pe mobil, la deschidere, focusul ramane pe butonul din spate; cu tastatura nu se poate iesi. | High | `ShoppingList.tsx:259,407,1576,1880,1918,2209`; `MontareRotiModal.tsx:660`; `SubscriptionCheckoutModal.tsx:150`; `RotiMasinaAnvelopeSection.tsx:419,452,485`; `grep -c 'role="dialog"' src` = 2. |
| 2.5.3 | `Modal.tsx` foloseste `id="modal-title"` fix -> ID duplicat cand sunt 2 modale deschise simultan (confirmare peste editare). | Low | `Modal.tsx:79,84`. |
| 2.5.4 | Modale cu latime inline `max-width:1000px` (ShoppingList) — pe tableta 768–1000 ocupa 92vw ok; nu e bug, doar inconsistenta cu `.sl-modal--lg`. | Low | `ShoppingList.tsx:2209`; `global.css:1385`. |

### 2.6 Formulare, touch, tipografie

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.6.1 | Touch targets: `.btn` = padding 8px/16px + 0.875rem -> ~37px; `.btn-sm{min-height:36px}`, `.btn-icon{min-width/min-height:40px}`. Sub recomandarea 44px (Apple HIG) / 48dp (Material) dar acceptabil. | Low | `global.css:213-225`, `:6134-6140`. |
| 2.6.2 | **21 declaratii `font-size` de 9–11px** (`11px` x14, `10px` x6, `9px` x1) — sub 12px e greu lizibil pe mobil si zoom-at automat de iOS Safari la focus in input daca <16px (inputurile: `.input` — neverificat font-size). | Medium | `grep -o "font-size:\s*(9|10|11)px" global.css`. |
| 2.6.3 | Nu exista `@media (hover: hover)` pentru cele 90 reguli `:hover` -> pe touch, hover-ul ramane "lipit" dupa tap (ex. `.btn-primary:hover`, `.navbar-fullscreen-btn:hover`). | Low | `grep -c ":hover" global.css` = 90; `grep -c "hover: hover"` = 0. |
| 2.6.4 | Layout: predominant flex + `grid` cu `repeat(auto-fit, minmax())` (bun), ex. `.rapoarte-kpi-grid`, `.product-grid`. | — | `global.css:5320-5324`, `:916-920`. |

### 2.7 Print

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 2.7.1 | Nu exista `@media print` in `global.css`; singurul print e o fereastra HTML generata in `configurari/shared.ts:122-139` (`window.print()` dupa 400ms). Documentele (bonuri, facturi, concedii) se genereaza cu jsPDF, nu prin print CSS -> ok pentru fluxul principal; dar Ctrl+P pe orice pagina tipareste navbar + butoane. | Low | `grep "@media print" src` -> doar `shared.ts:122`. |

---

## 3. Performanta runtime & bundle

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 3.1 | **Logo PNG 1000x1000, 793KB, incarcat in navbar pe fiecare pagina autentificata** (randat la ~36px), plus pe Login, AdminV2, NoAccess; acelasi fisier e favicon (32x32!), apple-touch-icon, icon PWA 192/512 si e re-fetch-uit pentru PDF (`public/logo.png`). E cel mai mare asset din `dist/` (793.350 bytes vs. 390KB jsPDF). Pe 3G/4G slab, LCP al Login-ului e dominat de acest fisier. | **Critical** | `NavBar.tsx:10,134`; `Login.tsx:8`; `AdminV2.tsx:4,134`; `NoAccess.tsx:2`; `index.html:9-11,18`; `manifest.webmanifest` icons; `generateReceiptPdf.ts:271`; `file src/assets/logo.png` = 1000x1000 RGBA; `dist/assets/logo-BnAhq69d.png` 793.350 B. |
| 3.2 | **Cautari server la fiecare keystroke, fara debounce**: `HotelAnvelope.tsx:139` (`onInput -> search()` -> `apiFetch(/api/clienti?q=)`, def. `:104-115`), `ShoppingList.tsx:146` (`:109-118`), `Programari.tsx:862` (`searchClients` `:500-508`), `AccountsSection.tsx:501` (`loadAccounts()` `:93-100`). Rezultatele pot sosi out-of-order (nu exista AbortController). Debounce exista doar in `Clienti.tsx:145-150` si `Reception.tsx:1750-1762` (450ms). | High | liniile citate; `grep -rn "debounce\|throttle\|AbortController" src` -> doar Clienti/Reception. |
| 3.3 | **Zero virtualizare**; liste mari randate integral cu `<For>`: Reception `filtered()` din pana la 200 bonuri (`Reception.tsx:1740` `loadReceipts(..., 200, ...)`, `:1909`), Stocuri toate randurile (`Stocuri.tsx:313`), HotelAnvelope `filtered()` (`:230, 1832`) cu `limit=500` la `:393` din store. Fiecare card de bon contine sub-liste (`:964, 1401, 1420`). | Medium | liniile citate; `grep -i virtual src` = 0 (doar text "Spatiul Privat Virtual"). |
| 3.4 | `Rapoarte.tsx` are 3.843 linii, **35 `createEffect`** si 31 `<For>`; mai multe efecte de tip `createEffect(() => { periodVersion(); selectedLocIds(); void load(); })` (`:423, 1005, 3288`) fara `on()`/`defer` — orice semnal citit accidental in `load()` re-declanseaza fetch-ul. `HotelAnvelope.tsx` 3.156 linii cu doar 3 `createMemo` la 20 `<For>` — filtrarile din JSX (`c.items.filter(i => i.anvelopa)` `:2645`, `s.wheels.slice(0,5)` `:2491`) se recalculeaza la fiecare re-run. | Medium | liniile citate. |
| 3.5 | Bundle: code-splitting per ruta e corect (`App.tsx:17-37`, 21 chunk-uri), jsPDF/autotable incarcate dinamic (`generateDocuments.ts:150-151`, `leavePdf.ts:61`, `invoiceReceived.ts:108-109`), font PDF NotoSans-Ro 31KB via `src/assets` (hash Vite). **Dar**: `html2canvas` 202KB e tras de jsPDF (`dist/assets/html2canvas.esm-*.js`) desi nu e folosit in `src`; `AdminV2` chunk 196KB si `Configurari` 124KB (pagini monolit); `d3` (`charts-*.js` 119KB) importat static in Rapoarte (`Rapoarte.tsx:24`) -> se incarca chiar daca utilizatorul nu deschide sectiunea cu grafice. | Medium | `dist/assets/` listare; `grep -rn html2canvas src` = 0. |
| 3.6 | Imagini: 0 `<img>` cu `loading="lazy"`/`width`/`height` (15 `<img>` in src) -> CLS pe avatare/produse; `.product-card-img` are `aspect-ratio:1/1` (bun, previne CLS pentru produse). | Low | `grep 'loading="lazy"' src` = 0; `global.css:991-997`. |
| 3.7 | Fonturi UI: system font stack, fara web fonts -> zero FOIT/FOUT. Bun. | — | `global.css:99`. |
| 3.8 | Iconuri: SVG inline in JSX (NavBar 18, HotelAnvelope 5, ThemeToggle 4); `public/icons.svg` sprite (5KB) nu e referit din `src` (`<use` = 0). | Low | `grep -c "<svg" src`; `grep "icons.svg\|<use " src` = 0. |
| 3.9 | Polling: `SubscriptionBanner` `setInterval` (`:36`), `LogsSection` 30s (`:85`), `ReportsSection` 10s (`:175`) — fara pauza la `document.hidden`. SSE pentru bonuri (`receiptsStore.ts:606, 641`) — corect. | Low | liniile citate. |
| 3.10 | `resize` listeners in 6 componente fara throttle (semnal boolean -> cost mic, dar redundanta). | Low | vezi 2.1.2. |

---

## 4. Loading & perceived performance

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 4.1 | Pozitiv: `Suspense` cu skeleton pe schimbarea de ruta (`App.tsx:39-45`), `.skeleton` shimmer (`global.css:6170-6176`), `ErrorBoundary` global (`AppErrorBoundary.tsx`), banner conectivitate, POS "Deviz" cu `visibleCount`/`PAGE_SIZE` (`POS.tsx:439`). | — | liniile citate. |
| 4.2 | Paginare reala (`createPagination` + `Pagination.tsx`) doar in Clienti, EFacturaReceived, EFacturaSent; Reception foloseste cursor `last_id` (`receiptsStore.ts:270`). Restul incarca cu `limit` fix (200/500) fara "load more". | Medium | `grep -l createPagination src`; `hotelAnvelopeStore.ts:393` (`limit=500`). |
| 4.3 | Nu exista optimistic UI generalizat; `useAction` hook exista (`src/hooks/useAction.ts`) — neverificat cat e folosit. | Low (unverified) | — |
| 4.4 | Theme flash: `data-theme` e setat din `createEffect` dupa incarcarea JS (`themeStore.ts:11-14`), fara script inline in `index.html` -> utilizatorii cu tema dark vad un flash alb la fiecare incarcare (inferat). | Medium | `themeStore.ts:6-14`; `index.html` nu contine `<script>` inline. |

---

## 5. Accesibilitate (baza)

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 5.1 | Pozitiv: `:focus-visible` global cu outline accent (`global.css:6117-6131`), `.sr-only` (`:6152`), `--text-muted` ajustat pentru WCAG AA (`:8`), `Modal.tsx` cu focus-trap/restore. | — | liniile citate. |
| 5.2 | Doar **90 atribute `aria-*` in 46.867 linii TSX**; `role="dialog"`/`aria-modal` doar 2 (in `Modal.tsx`). 25 butoane cu continut doar simbol (✕, ×, ⋮, ←…) si 10 doar cu `title=` -> fara nume accesibil. | High | `grep -o "aria-[a-z]+" src \| wc -l` = 90; `grep -o '<button[^>]*>\s*(✕\|×\|…)\s*</button>' src` = 25. |
| 5.3 | `prefers-reduced-motion` acopera doar `.logo-coin` (`global.css:3034-3036`); raman 14 `animation:` (skeleton shimmer infinit, `success-pop`, `fadeInUp`, `connectivity-pulse`, `dropdown-in`) si 67 `transition:` neacoperite. | Medium | `global.css:3034`, `:1836, 1859, 3093, 3169, 3186, 6166, 6179`. |
| 5.4 | `<html lang="en">` pentru o aplicatie in romana -> screen readerele pronunta gresit, hyphenation/autocorrect gresite. | Medium | `index.html:2`. |
| 5.5 | Contrast tokens: light `#5a6268` pe `#f8f9fa` ≈ 6.4:1, dark `#8b91a8` pe `#1a1d27` ≈ 5.5:1 — OK. Culorile hard-codate (288) nu sunt garantate. | Low | `global.css:8, 41`. |

---

## 6. Dark mode / teme

| # | Constatare | Severitate | Dovada |
|---|---|---|---|
| 6.1 | 4 teme via `[data-theme]` + `localStorage` (`bs_theme`), ciclate dintr-un buton (`ThemeToggle.tsx`). Nu respecta `prefers-color-scheme` la prima vizita (default `light`); un singur bloc `@media (prefers-color-scheme: dark)` aplica badge-uri SPV **independent de `data-theme`** -> pe OS dark + tema light, badge-urile SPV au culori dark pe fundal light. | Medium | `themeStore.ts:7` (`?? "light"`); `global.css:314-320`. |
| 6.2 | Fallback-uri `var(--x, #hex)` cu valori light in ~15 fisiere (documentat in comentariul `global.css:26-32`); aliasul rezolva `--surface-2` dar nu si alte fallback-uri hard-codate (ex. `var(--border, #e0e0e0)` `:6210`, `var(--bg-soft, #f7f9fc)` `:6211` — `--bg-soft` nu e definit in `:root`). | Medium | `global.css:6210-6211, 6248`; `grep -n "^\s*--bg-soft" global.css` = 0 (inferat: `--bg-soft` nedefinit -> fallback light in dark). |

---

## 7. Recomandari (prioritizate; efort S/M/L)

| Prio | Recomandare | Efort | Adreseaza |
|---|---|---|---|
| 1 | **Logo**: exporta `logo.png` la 72x72/144x144 WebP/PNG optimizat pentru navbar (~5–10KB), 192/512 separat pentru manifest, 32x32 favicon; pastreaza 1000px doar pentru PDF (si acela optimizat/`pngquant`). | S | 3.1 (Critical) |
| 2 | **Hook comun `createMediaQuery(query)`** pe `matchMedia` + constante de breakpoint (`--bp-sm:640px`, `--bp-md:768px`, `--bp-lg:1024px`) in CSS si TS; migreaza cele 6 `isMobile` duplicate si normalizeaza cele 11 breakpoint-uri la 3–4. | M | 2.1.1, 2.1.2 |
| 3 | **Debounce (300ms) + AbortController** in `apiFetch` pentru cautari: HotelAnvelope, ShoppingList, Programari, AccountsSection; extrage un `createDebouncedSearch()` din codul deja existent in `Clienti.tsx:145-150`. | S | 3.2 |
| 4 | **Migreaza cele 55 overlay-uri raw la `ui/Modal.tsx`** (sau extrage un `useDialogA11y(ref)` pentru cazurile cu layout custom); genereaza `id` unic pentru titlu; adauga `aria-label` pe butoanele-simbol. | M–L | 2.5.2, 2.5.3, 5.2 |
| 5 | Impacheteaza cele 6 `<table>` neprotejate in `.table-wrap` (utilitar deja existent) sau adauga card-layout ca in Stocuri; adauga `.hide-mobile` pe coloanele secundare. | S | 2.4.2 |
| 6 | Safe-area: `.navbar{padding-top:env(safe-area-inset-top)}` + `height:calc(53px + env(safe-area-inset-top))`; inlocuieste `100vh` cu `100dvh` in `.sl-modal` mobile. | S | 2.2.1, 2.2.4 |
| 7 | Script inline in `index.html` `<head>` care citeste `localStorage.bs_theme` si seteaza `data-theme` inainte de paint; `theme-color` dinamic per tema (`meta` actualizat din `themeStore`); default la `prefers-color-scheme`. | S | 4.4, 6.1 |
| 8 | Sparge `global.css` pe pagini (CSS importat din chunk-ul lazy al fiecarei pagini — Vite il code-split-eaza automat) sau adopta CSS Modules pentru fisierele noi; sterge sectiunea "old table" si clasele din `unused-classes.txt` (verificare manuala inainte). | L | 1.1, 1.6 |
| 9 | Politica pentru stiluri inline: interzice `style=` nou pentru layout (permis doar pentru valori dinamice); muta blocurile repetitive (cardurile mobile din Stocuri/Rapoarte) in clase. Elimina cei 25 `!important`. | L (incremental) | 1.2 |
| 10 | Virtualizare (`@tanstack/solid-virtual`) sau "load more" pe Reception (200 bonuri x sub-liste), Stocuri si HotelAnvelope (500); activeaza `getPaginationRowModel` in tabelele TanStack mari. | M | 3.3, 4.2 |
| 11 | `import()` dinamic pentru `./rapoarte/charts` (d3, 119KB) la prima afisare a unei sectiuni cu grafice; verifica excluderea `html2canvas` (jsPDF `optionalDependencies` / alias la modul gol in Vite). | S–M | 3.5 |
| 12 | `@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}`; `<html lang="ro">`; `@media (hover:hover)` pentru `:hover`. | S | 5.3, 5.4, 2.6.3 |
| 13 | Defineste `--bg-soft` (sau inlocuieste), audit al celor 288 culori hex vs. teme dark; muta blocul `prefers-color-scheme` SPV pe `[data-theme]`. | M | 1.4, 6.1, 6.2 |
| 14 | `width`/`height`/`loading="lazy"` pe `<img>` de avatare/produse; `document.hidden` pentru cele 3 polling-uri. | S | 3.6, 3.9 |

---

## 8. Rezumat severitati

- **Critical (1)**: 3.1 logo 793KB pe fiecare pagina.
- **High (7)**: 1.1 CSS monolit; 1.2 stiluri inline masive; 2.1.1 breakpoint-uri fragmentate; 2.2.1 safe-area lipsa in PWA; 2.4.2 tabele fara scroll wrapper; 2.5.2 modale fara a11y/focus; 3.2 cautari fara debounce; 5.2 aria minimal.
- **Medium (14)**: 1.3, 1.4, 1.6, 2.1.2, 2.2.3, 2.2.4, 2.3.1, 2.4.3, 2.6.2, 3.3, 3.4, 3.5, 4.2, 4.4, 5.3, 5.4, 6.1, 6.2.
- **Low**: restul.

Artefacte auxiliare: `/tmp/claude-logs/audit/unused-classes.txt` (clase CSS potential moarte), `/tmp/claude-logs/audit/css-classes.txt` (toate clasele), `/tmp/claude-logs/audit/scan*.sh` (comenzile de verificare, reproductibile).
