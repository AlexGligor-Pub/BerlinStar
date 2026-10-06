import { createSignal } from "solid-js";
import { apiFetch, API_BASE, parseApiError } from "../utils/api";
import { auth } from "./authStore";
import type { CartItem } from "./cartStore";
import { notify } from "./notificationsStore";

export interface VehicolData {
  numarMasina: string;
  marca?: string | null;
  model?: string | null;
  numarKilometrii?: number | null;
  anFabricatie?: number | null;
  vin?: string | null;
  observatii?: string | null;
}

export interface Receipt {
  id: string;
  date: string;
  titlu: string;
  clientId: number | null;
  clientNume: string | null;
  clientCui: string | null;
  clientAdresa: string | null;
  clientTelefon: string | null;
  clientTip: string | null;
  clientReprezentant: string | null;
  clientNumarMasina: string | null;
  descriere?: string;
  dateTehn?: string;
  metodaPlata?: string;
  partialPay?: number;
  items: CartItem[];
  total: number;
  devizSerie: string;
  devizNr: number;
  facturaSerie: string;
  facturaNr: number;
  chitantaSerie: string;
  chitantaNr: number;
  programareId: number | null;
  locationId: number | null;
  vehicol?: VehicolData | null;
  updatedAt?: string | null;
  efacturaStatus: string | null;
  efacturaLocked: boolean;
  efacturaError: string | null;
  efacturaIndexIncarcare: number | null;
  source?: string;
  dueDate?: string | null;
  // Câmpuri FDL — populate doar pentru source="fdl"
  constatari?: string | null;
  sugestii?: string | null;
  timpEstimatOre?: number | null;
  fdlFinalizedAt?: string | null;
}

const CACHE_KEY = "bs_receipts";

export interface RawReceiptItem {
  id: number;
  name: string;
  price: string | number;
  qty: number;
  unit: string;
  employee_id?: number | null;
  employee_name?: string | null;
  employee_target_pct?: number | null;
  item_id?: number | null;
  item_type?: string | null;
  vat_percent?: string | number | null;
  /** Pretul de lista, cand linia are o reducere aplicata. */
  original_price?: string | number | null;
}

interface RawReceiptVehicol {
  numar_masina: string;
  marca?: string | null;
  model?: string | null;
  numar_kilometrii?: number | null;
  an_fabricatie?: number | null;
  vin?: string | null;
  observatii?: string | null;
}

export interface RawReceipt {
  id: number | string;
  created_at: string;
  titlu: string;
  client_id?: number | null;
  client_nume?: string | null;
  client_cui?: string | null;
  client_adresa?: string | null;
  client_telefon?: string | null;
  client_tip?: string | null;
  client_reprezentant?: string | null;
  client_numar_masina?: string | null;
  descriere?: string | null;
  date_tehn?: string | null;
  pay_method?: string;
  partial_pay?: string | number | null;
  receipt_items: RawReceiptItem[];
  total: string | number;
  deviz_serie?: string;
  deviz_nr?: number;
  factura_serie?: string;
  factura_nr?: number;
  chitanta_serie?: string;
  chitanta_nr?: number;
  programare_id?: number | null;
  location_id?: number | null;
  vehicol?: RawReceiptVehicol | null;
  updated_at?: string | null;
  efactura_status?: string | null;
  efactura_locked?: boolean;
  efactura_error?: string | null;
  efactura_index_incarcare?: number | null;
  source?: string;
  due_date?: string | null;
  constatari?: string | null;
  sugestii?: string | null;
  timp_estimat_ore?: string | number | null;
  fdl_finalized_at?: string | null;
}

export function mapReceiptFromApi(r: RawReceipt): Receipt {
  return mapFromApi(r);
}

function mapFromApi(r: RawReceipt): Receipt {
  return {
    id: String(r.id),
    date: r.created_at,
    titlu: r.titlu,
    clientId: r.client_id ?? null,
    clientNume: r.client_nume ?? null,
    clientCui: r.client_cui ?? null,
    clientAdresa: r.client_adresa ?? null,
    clientTelefon: r.client_telefon ?? null,
    clientTip: r.client_tip ?? null,
    clientReprezentant: r.client_reprezentant ?? null,
    clientNumarMasina: r.client_numar_masina ?? null,
    descriere: r.descriere ?? undefined,
    dateTehn: r.date_tehn ?? undefined,
    metodaPlata: r.pay_method && r.pay_method !== "Neplatit" ? r.pay_method : undefined,
    partialPay: r.partial_pay != null ? (typeof r.partial_pay === "number" ? r.partial_pay : parseFloat(r.partial_pay)) : undefined,
    items: r.receipt_items.map((i) => ({
      id: i.id,
      // Prefix propriu: `i.id` e id-ul randului din bon, iar cosul din POS
      // construieste `${idProdus}_${angajat}` pentru produsele din catalog. Fara
      // prefix, un produs cu acelasi numar s-ar aduna peste aceasta linie.
      lineId: `ri_${i.id}_${i.employee_id ?? ""}`,
      name: i.name,
      price: typeof i.price === "number" ? i.price : parseFloat(i.price),
      qty: i.qty,
      unit: i.unit,
      employeeId: i.employee_id ?? null,
      employeeName: i.employee_name ?? null,
      employeeTargetPct: i.employee_target_pct ?? null,
      itemId: i.item_id ?? null,
      itemType: i.item_type ?? null,
      vatPercent: i.vat_percent != null ? (typeof i.vat_percent === "number" ? i.vat_percent : parseFloat(i.vat_percent)) : null,
      originalPrice: i.original_price != null ? (typeof i.original_price === "number" ? i.original_price : parseFloat(i.original_price)) : null,
    })),
    total: typeof r.total === "number" ? r.total : parseFloat(r.total),
    devizSerie: r.deviz_serie ?? "",
    devizNr: r.deviz_nr ?? 0,
    facturaSerie: r.factura_serie ?? "",
    facturaNr: r.factura_nr ?? 0,
    chitantaSerie: r.chitanta_serie ?? "",
    chitantaNr: r.chitanta_nr ?? 0,
    programareId: r.programare_id ?? null,
    locationId: r.location_id ?? null,
    vehicol: r.vehicol ? {
      numarMasina: r.vehicol.numar_masina,
      marca: r.vehicol.marca ?? null,
      model: r.vehicol.model ?? null,
      numarKilometrii: r.vehicol.numar_kilometrii ?? null,
      anFabricatie: r.vehicol.an_fabricatie ?? null,
      vin: r.vehicol.vin ?? null,
      observatii: r.vehicol.observatii ?? null,
    } : null,
    updatedAt: r.updated_at ?? null,
    efacturaStatus: r.efactura_status ?? null,
    efacturaLocked: r.efactura_locked ?? false,
    efacturaError: r.efactura_error ?? null,
    efacturaIndexIncarcare: r.efactura_index_incarcare ?? null,
    source: r.source ?? "reception",
    dueDate: r.due_date ?? null,
    constatari: r.constatari ?? null,
    sugestii: r.sugestii ?? null,
    timpEstimatOre: r.timp_estimat_ore != null
      ? (typeof r.timp_estimat_ore === "number" ? r.timp_estimat_ore : parseFloat(r.timp_estimat_ore))
      : null,
    fdlFinalizedAt: r.fdl_finalized_at ?? null,
  };
}

function loadCache(): Receipt[] {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const [receipts, setReceipts] = createSignal<Receipt[]>(loadCache());

/** Cache-ul local e doar o comoditate la pornire. Un `setItem` care arunca
 *  (spatiu epuizat, stocare blocata) nu are voie sa transforme in eroare o
 *  operatie deja reusita pe server — utilizatorul ar repeta-o si ar dubla bonul. */
function persistCache(list: Receipt[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // Mai bine fara cache decat cu unul ramas in urma.
    try { localStorage.removeItem(CACHE_KEY); } catch { /* stocare indisponibila */ }
  }
}

/** Pastreaza obiectul vechi pentru bonurile neschimbate la o reincarcare, ca
 *  tot ce depinde de ele in interfata sa nu fie recalculat degeaba. */
function keepUnchanged(prev: Receipt[], next: Receipt[]): Receipt[] {
  const old = new Map(prev.map((r) => [r.id, r]));
  return next.map((r) => {
    const before = old.get(r.id);
    return before && JSON.stringify(before) === JSON.stringify(r) ? before : r;
  });
}

function _diffAndNotifyEfacturaStatus(prev: Receipt[], next: Receipt[]): void {
  const prevMap = new Map(prev.map((r) => [r.id, r.efacturaStatus]));
  for (const r of next) {
    const old = prevMap.get(r.id);
    if (old === undefined) continue;
    if (old === r.efacturaStatus) continue;
    if (r.efacturaStatus === "in_prelucrare" && old === "pending_upload") {
      notify(`Factura ${r.titlu}: in procesare ANAF`, "info");
    } else if (r.efacturaStatus === "accepted") {
      notify(`Factura ${r.titlu} a fost acceptata de ANAF`, "success");
    } else if (r.efacturaStatus === "rejected") {
      notify(`Factura ${r.titlu} a fost respinsa de ANAF`, "warn");
    } else if (r.efacturaStatus === "error" && r.efacturaIndexIncarcare === null) {
      notify(`Factura ${r.titlu}: eroare la trimitere — ${r.efacturaError ?? "verifica setarile"}`, "error");
    }
  }
}

// Parametrii ultimului load — folositi de loadMoreReceipts si de reimprospatarea SSE
let _lastDateFrom: string | null = null;
let _lastDateTo: string | null = null;
let _lastLimit: number = 10;
let _lastSearch: string = "";
let _lastItemSearch: string = "";
let _lastLocationId: number | null = null;
let _nextCursor: number | null = null;
// Cate pagini sunt in lista (prima + cele aduse cu „load more").
let _pagesLoaded = 1;
// Creste la fiecare incarcare completa; un raspuns pornit inaintea ei e aruncat.
let _loadSeq = 0;
// Creste la fiecare reimprospatare SSE; doar cea mai recenta are voie sa scrie lista.
let _refreshSeq = 0;
// La un eveniment SSE recitim cel mult atatea pagini din cele deja incarcate.
const MAX_REFRESH_PAGES = 3;

const [hasMore, setHasMore] = createSignal(false);
const [loadingMore, setLoadingMore] = createSignal(false);
export { hasMore, loadingMore };

interface ReceiptsPage {
  items: Receipt[];
  nextCursor: number | null;
}

/** O pagina din lista, cu filtrele ultimului load. `null` = raspuns refuzat. */
async function _fetchPage(lastId: number | null): Promise<ReceiptsPage | null> {
  let qs = `/api/receipts?limit=${_lastLimit}&sort=-activity&unpaid_days=30`;
  if (lastId != null) qs += `&last_id=${lastId}`;
  if (_lastDateFrom) qs += `&date_from=${_lastDateFrom}`;
  if (_lastDateTo) qs += `&date_to=${_lastDateTo}`;
  if (_lastSearch) qs += `&q=${encodeURIComponent(_lastSearch)}`;
  if (_lastItemSearch) qs += `&item_q=${encodeURIComponent(_lastItemSearch)}`;
  if (_lastLocationId != null) qs += `&location_id=${_lastLocationId}`;
  const res = await apiFetch(qs);
  if (!res.ok) return null;
  const data = await res.json();
  return { items: (data.items as RawReceipt[]).map(mapFromApi), nextCursor: data.next_cursor ?? null };
}

/**
 * Incarca prima pagina cu filtrele date si inlocuieste lista.
 *
 * Un filtru omis inseamna „fara filtru", nu „ca data trecuta": „Deschide
 * existent" din POS apeleaza fara cautare/interval/locatie si nu trebuie sa
 * mosteneasca ce a ramas din Receptie. Doar `limit` omis pastreaza valoarea
 * anterioara.
 */
export async function loadReceipts(dateFrom?: string | null, dateTo?: string | null, limit?: number, q?: string, locationId?: number | null, itemQ?: string) {
  _lastDateFrom = dateFrom ?? null;
  _lastDateTo = dateTo ?? null;
  if (limit !== undefined) _lastLimit = limit;
  _lastSearch = q ?? "";
  _lastItemSearch = itemQ ?? "";
  _lastLocationId = locationId ?? null;
  _nextCursor = null;
  const seq = ++_loadSeq;
  try {
    const page = await _fetchPage(null);
    // Intre timp a pornit o incarcare mai noua (alt filtru): raspunsul acesta e vechi.
    if (!page || seq !== _loadSeq) return;
    _nextCursor = page.nextCursor;
    _pagesLoaded = 1;
    setHasMore(_nextCursor !== null);
    _diffAndNotifyEfacturaStatus(receipts(), page.items);
    const next = keepUnchanged(receipts(), page.items);
    setReceipts(next);
    persistCache(next);
  } catch {
    // ramane cache-ul existent
  }
}

export async function loadMoreReceipts() {
  if (!_nextCursor || loadingMore()) return;
  setLoadingMore(true);
  const seq = _loadSeq;
  try {
    const page = await _fetchPage(_nextCursor);
    // Lista a fost reincarcata cu alte filtre cat a durat cererea: pagina
    // aceasta apartine listei vechi si nu are ce cauta in cea noua.
    if (!page || seq !== _loadSeq) return;
    _nextCursor = page.nextCursor;
    _pagesLoaded += 1;
    setHasMore(_nextCursor !== null);
    // Un bon modificat intre doua pagini isi schimba pozitia in sortarea dupa
    // activitate si poate reveni pe pagina urmatoare — nu il afisam de doua ori.
    const seen = new Set(receipts().map((r) => r.id));
    const updated = [...receipts(), ...page.items.filter((r) => !seen.has(r.id))];
    setReceipts(updated);
    persistCache(updated);
  } catch {
    // ignore
  } finally {
    setLoadingMore(false);
  }
}

/**
 * Reimprospatare dupa un eveniment SSE: reciteste paginile deja incarcate, cu
 * aceleasi filtre, in loc sa se intoarca la prima pagina (operatorul care a
 * derulat isi pierdea pozitia la fiecare salvare a unui coleg).
 *
 * Marginit la MAX_REFRESH_PAGES cereri: daca erau incarcate mai multe pagini,
 * restul se elibereaza si revin la derulare, prin „load more" — un rand
 * neverificat (poate sters intre timp) nu ramane afisat.
 */
async function refreshLoadedReceipts(): Promise<void> {
  // O pagina in curs de adus ar fi suprascrisa de rezultat; mai asteptam.
  if (loadingMore()) { scheduleReload(); return; }
  const seq = _loadSeq;
  const my = ++_refreshSeq;
  const pages = Math.min(Math.max(_pagesLoaded, 1), MAX_REFRESH_PAGES);
  try {
    const fresh: Receipt[] = [];
    const seen = new Set<string>();
    let cursor: number | null = null;
    let loaded = 0;
    for (let i = 0; i < pages; i++) {
      const page = await _fetchPage(cursor);
      // Fara raspuns sau cu filtrele schimbate intre timp: lista ramane cum e.
      if (!page || seq !== _loadSeq) return;
      // A pornit o reimprospatare mai noua (alt eveniment SSE): paginile citite
      // aici sunt mai vechi decat ale ei si nu au voie sa ajunga ultimele in lista.
      if (my !== _refreshSeq) return;
      for (const r of page.items) {
        if (!seen.has(r.id)) { seen.add(r.id); fresh.push(r); }
      }
      cursor = page.nextCursor;
      loaded += 1;
      if (cursor === null) break;
    }
    _nextCursor = cursor;
    _pagesLoaded = loaded;
    setHasMore(_nextCursor !== null);
    _diffAndNotifyEfacturaStatus(receipts(), fresh);
    const next = keepUnchanged(receipts(), fresh);
    setReceipts(next);
    persistCache(next);
  } catch {
    // ramane lista existenta; urmatorul eveniment reincearca
  }
}

// Input type pentru save/update content: campurile efactura sunt server-side (derivate
// din EFacturaSentRecord), deci nu trebuie pasate de caller la create/update content.
export type ReceiptInput = Omit<Receipt, "id" | "efacturaStatus" | "efacturaLocked" | "efacturaError" | "efacturaIndexIncarcare">;

export async function saveReceipt(receipt: ReceiptInput): Promise<Receipt> {
  const body: Record<string, unknown> = {
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    pay_method: receipt.metodaPlata ?? "Neplatit",
    programare_id: receipt.programareId ?? null,
    location_id: receipt.locationId ?? null,
    client_id: receipt.clientId ?? null,
    source: receipt.source ?? "reception",
    // Camp de data golit in formular = "" -> null (altfel 422 pe `date | None`).
    due_date: receipt.dueDate || null,
    constatari: receipt.constatari ?? null,
    sugestii: receipt.sugestii ?? null,
    timp_estimat_ore: receipt.timpEstimatOre != null ? receipt.timpEstimatOre.toFixed(2) : null,
    items: receipt.items.map((i) => ({
      name: i.name,
      price: i.price.toFixed(2),
      qty: i.qty,
      unit: i.unit,
      employee_id: i.employeeId ?? null,
      item_id: i.itemId ?? null,
      item_type: i.itemType ?? null,
      vat_percent: i.vatPercent != null ? String(i.vatPercent) : null,
      original_price: i.originalPrice != null ? i.originalPrice.toFixed(2) : null,
    })),
    total: receipt.total.toFixed(2),
  };

  const res = await apiFetch("/api/receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const created = mapFromApi(await res.json());
  setReceipts([created, ...receipts()]);
  persistCache(receipts());
  return created;
}

export async function updateReceiptContent(id: string, receipt: ReceiptInput): Promise<Receipt> {
  const body: Record<string, unknown> = {
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    due_date: receipt.dueDate || null,
    // null = backend nu schimbă sursa; "fdl"/"pos" comută FDL <-> deviz.
    source: receipt.source ?? null,
    constatari: receipt.constatari ?? null,
    sugestii: receipt.sugestii ?? null,
    timp_estimat_ore: receipt.timpEstimatOre != null ? receipt.timpEstimatOre.toFixed(2) : null,
    items: receipt.items.map((i) => ({
      name: i.name,
      price: i.price.toFixed(2),
      qty: i.qty,
      unit: i.unit,
      employee_id: i.employeeId ?? null,
      item_id: i.itemId ?? null,
      item_type: i.itemType ?? null,
      vat_percent: i.vatPercent != null ? String(i.vatPercent) : null,
      original_price: i.originalPrice != null ? i.originalPrice.toFixed(2) : null,
    })),
    total: receipt.total.toFixed(2),
  };

  const res = await apiFetch(`/api/receipts/${id}/content`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  setReceipts(receipts().map((r) => r.id === String(id) ? updated : r));
  persistCache(receipts());
  return updated;
}

export async function updateMetodaPlata(id: string, metodaPlata: string | null, partialPay?: number) {
  const pay_method = metodaPlata ?? "Neplatit";
  const res = await apiFetch(`/api/receipts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      pay_method,
      partial_pay: pay_method === "Platit Partial" ? (partialPay ?? 100) : null,
    }),
  });
  if (!res.ok) throw new Error(await _readApiError(res, `Eroare ${res.status} la salvarea platii.`));
  // Folosim raspunsul serverului, nu o presupunere locala: la schimbarea
  // statusului backendul poate ajusta `partial_pay` si inregistra automat o
  // miscare in registrul de plati, iar `updated_at` se schimba — de ele depinde
  // reimprospatarea sectiunii "Situatie plati".
  const fresh = mapFromApi(await res.json());
  const updated = receipts().map((r) => (r.id === id ? fresh : r));
  setReceipts(updated);
  persistCache(updated);
}

export async function assignFacturaNumber(id: string, locationId: number): Promise<{ serie: string; nr: number }> {
  const res = await apiFetch(`/api/receipts/${id}/assign-number`, {
    method: "POST",
    body: JSON.stringify({ doc_type: "factura", location_id: locationId }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const data: { serie: string; nr: number; due_date?: string | null } = await res.json();
  const next = receipts().map((r) =>
    r.id === id
      ? { ...r, facturaSerie: data.serie, facturaNr: data.nr, dueDate: data.due_date ?? r.dueDate }
      : r
  );
  setReceipts(next);
  persistCache(next);
  return { serie: data.serie, nr: data.nr };
}

export function applyDocNumber(
  id: string,
  docType: "deviz" | "factura" | "chitanta",
  serie: string,
  nr: number,
  /** Scadenta stabilita de server la prima numerotare a facturii. */
  dueDate?: string | null,
) {
  const next = receipts().map((r) => {
    if (r.id !== id) return r;
    if (docType === "deviz") return { ...r, devizSerie: serie, devizNr: nr };
    if (docType === "factura") {
      return { ...r, facturaSerie: serie, facturaNr: nr, dueDate: dueDate ?? r.dueDate };
    }
    return { ...r, chitantaSerie: serie, chitantaNr: nr };
  });
  setReceipts(next);
  persistCache(next);
}

export async function finalizeFdl(id: string): Promise<Receipt> {
  const res = await apiFetch(`/api/receipts/${id}/finalize-fdl`, { method: "POST" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  persistCache(next);
  return updated;
}

export async function convertFdlToDeviz(id: string): Promise<Receipt> {
  const res = await apiFetch(`/api/receipts/${id}/convert-to-deviz`, { method: "POST" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  persistCache(next);
  return updated;
}

/** Reciteste un singur bon de la server si il pune in lista.
 *
 *  Necesar dupa o miscare in registrul de plati: statusul (`pay_method`,
 *  `partial_pay`) se recalculeaza pe server din registru, deci lista locala ar
 *  arata o stare invechita. Esecul e ignorat intentionat — registrul si-a facut
 *  treaba, iar cardul se aliniaza la urmatorul refresh sau eveniment SSE.
 */
export async function refreshReceipt(id: string): Promise<Receipt | null> {
  try {
    const res = await apiFetch(`/api/receipts/${id}`);
    if (!res.ok) return null;
    const updated = mapFromApi(await res.json());
    const next = receipts().map((r) => (r.id === id ? updated : r));
    setReceipts(next);
    persistCache(next);
    return updated;
  } catch {
    return null;
  }
}

export async function deleteReceipt(id: string) {
  const res = await apiFetch(`/api/receipts/${id}`, { method: "DELETE" });
  // 404 = bonul e deja sters pe server; il scoatem si din lista locala. Orice alt
  // refuz (423 blocat de e-Factura, 403 rol, 5xx) trebuie sa ajunga la utilizator.
  if (!res.ok && res.status !== 404) {
    throw new Error(await _readApiError(res, `Eroare ${res.status} la stergerea bonului.`));
  }
  const updated = receipts().filter((r) => r.id !== id);
  setReceipts(updated);
  persistCache(updated);
}

export async function updateReceiptClient(id: string, clientId: number | null): Promise<void> {
  const res = await apiFetch(`/api/receipts/${id}/client`, {
    method: "PATCH",
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  persistCache(next);
}

export async function saveReceiptVehicol(id: string, vehicol: VehicolData): Promise<void> {
  const res = await apiFetch(`/api/receipts/${id}/vehicol`, {
    method: "PUT",
    body: JSON.stringify({
      numar_masina: vehicol.numarMasina,
      marca: vehicol.marca ?? null,
      model: vehicol.model ?? null,
      numar_kilometrii: vehicol.numarKilometrii ?? null,
      an_fabricatie: vehicol.anFabricatie ?? null,
      vin: vehicol.vin ?? null,
      observatii: vehicol.observatii ?? null,
    }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = parseApiError(j.detail ?? j, msg); } catch {}
    throw new Error(msg);
  }
  const next = receipts().map((r) => r.id === id ? { ...r, vehicol } : r);
  setReceipts(next);
  persistCache(next);
}

async function _readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json();
    return parseApiError(j.detail ?? j, fallback);
  } catch {
    return fallback;
  }
}

// Optimistic update: marcam local statusul efactura ca sa se ascunda butonul
// "Trimite in SPV" instant, inainte ca SSE-ul sa re-incarce lista. Acopera
// fereastra de race intre POST /upload si urmatorul refresh.
export function applyEfacturaStatus(
  id: string,
  status: string | null,
  opts?: { locked?: boolean; error?: string | null },
) {
  const next = receipts().map((r) => {
    if (r.id !== id) return r;
    return {
      ...r,
      efacturaStatus: status,
      efacturaLocked: opts?.locked ?? r.efacturaLocked,
      efacturaError: opts?.error ?? null,
    };
  });
  setReceipts(next);
  persistCache(next);
}

export async function uploadToSpv(receiptId: string): Promise<void> {
  const res = await apiFetch(`/api/efactura/receipts/${receiptId}/upload`, { method: "POST" });
  if (!res.ok) throw new Error(await _readApiError(res, "Eroare la trimiterea in SPV."));
  applyEfacturaStatus(receiptId, "pending_upload", { locked: true, error: null });
}

export async function retryEFactura(receiptId: string): Promise<void> {
  const res = await apiFetch(`/api/efactura/receipts/${receiptId}/retry`, { method: "POST" });
  if (!res.ok) throw new Error(await _readApiError(res, "Eroare la reincercare."));
  applyEfacturaStatus(receiptId, "pending_upload", { locked: true, error: null });
}

export { receipts };

export type SseStatus = "connected" | "connecting" | "disconnected";
const [sseStatus, setSseStatus] = createSignal<SseStatus>("disconnected");
export { sseStatus };

const [posCount, setPosCount] = createSignal(0);
export { posCount };

let _es: EventSource | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reloadTimer: ReturnType<typeof setTimeout> | undefined;
let _esAttempts = 0;

function scheduleReload() {
  clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(() => { void refreshLoadedReceipts(); }, 300);
}

// Exponential backoff cu jitter pentru reconectare SSE (max 60s).
function _backoffDelay(attempt: number): number {
  const base = Math.min(60_000, 1000 * Math.pow(2, attempt));
  return base + Math.floor(Math.random() * 1000);
}

let _posEs: EventSource | null = null;
let _posReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _posAttempts = 0;

export function connectPosSSE(): void {
  if (_posEs) return;
  const token = auth.token;
  if (!token) return;
  const es = new EventSource(`${API_BASE}/api/receipts/events?token=${encodeURIComponent(token)}&client_type=pos`);
  _posEs = es;
  es.onopen = () => { _posAttempts = 0; };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      _posEs = null;
      const delay = _backoffDelay(_posAttempts++);
      _posReconnectTimer = setTimeout(() => { _posReconnectTimer = null; connectPosSSE(); }, delay);
    }
  };
}

export function disconnectPosSSE(): void {
  if (_posReconnectTimer) { clearTimeout(_posReconnectTimer); _posReconnectTimer = null; }
  if (_posEs) { _posEs.close(); _posEs = null; }
  _posAttempts = 0;
}

export function connectSSE(): void {
  if (_es) return;
  _openSSE();
}

export function disconnectSSE(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_es) { _es.close(); _es = null; }
  // O reimprospatare programata nu mai are ce cauta dupa parasirea Receptiei.
  clearTimeout(_reloadTimer);
  _esAttempts = 0;
  setSseStatus("disconnected");
}

function _openSSE(): void {
  const token = auth.token;
  if (!token) return;
  setSseStatus("connecting");
  const es = new EventSource(`${API_BASE}/api/receipts/events?token=${encodeURIComponent(token)}&client_type=reception`);
  _es = es;
  es.onopen = () => { _esAttempts = 0; setSseStatus("connected"); };
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "receipts_changed") scheduleReload();
      else if (data.type === "connected" && data.pos_count != null) setPosCount(data.pos_count);
      else if (data.type === "pos_count") setPosCount(data.count);
    } catch {}
  };
  es.onerror = () => {
    setSseStatus("connecting");
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      _es = null;
      const delay = _backoffDelay(_esAttempts++);
      _reconnectTimer = setTimeout(() => { _reconnectTimer = null; _openSSE(); }, delay);
    }
  };
}
