import { createSignal } from "solid-js";
import { apiFetch, API_BASE } from "../utils/api";
import { auth } from "./authStore";
import type { CartItem } from "./cartStore";
import { notify } from "./notificationsStore";

export interface VehicolData {
  numarMasina: string;
  marca?: string | null;
  model?: string | null;
  numarKilometrii?: number | null;
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
}

interface RawReceiptVehicol {
  numar_masina: string;
  marca?: string | null;
  model?: string | null;
  numar_kilometrii?: number | null;
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
      lineId: `${i.id}_${i.employee_id ?? ""}`,
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

// Parametrii ultimului load — folositi de SSE scheduleReload
let _lastDateFrom: string | null = null;
let _lastDateTo: string | null = null;
let _lastLimit: number = 10;
let _lastSearch: string = "";
let _lastLocationId: number | null = null;
let _nextCursor: number | null = null;

const [hasMore, setHasMore] = createSignal(false);
const [loadingMore, setLoadingMore] = createSignal(false);
export { hasMore, loadingMore };

export async function loadReceipts(dateFrom?: string | null, dateTo?: string | null, limit?: number, q?: string, locationId?: number | null) {
  if (dateFrom !== undefined) _lastDateFrom = dateFrom ?? null;
  if (dateTo !== undefined) _lastDateTo = dateTo ?? null;
  if (limit !== undefined) _lastLimit = limit;
  if (q !== undefined) _lastSearch = q;
  if (locationId !== undefined) _lastLocationId = locationId ?? null;
  _nextCursor = null;
  try {
    let qs = `/api/receipts?limit=${_lastLimit}&sort=-activity&unpaid_days=30`;
    if (_lastDateFrom) qs += `&date_from=${_lastDateFrom}`;
    if (_lastDateTo) qs += `&date_to=${_lastDateTo}`;
    if (_lastSearch) qs += `&q=${encodeURIComponent(_lastSearch)}`;
    if (_lastLocationId != null) qs += `&location_id=${_lastLocationId}`;
    const res = await apiFetch(qs);
    if (!res.ok) return;
    const data = await res.json();
    const mapped: Receipt[] = data.items.map(mapFromApi);
    _nextCursor = data.next_cursor ?? null;
    setHasMore(_nextCursor !== null);
    _diffAndNotifyEfacturaStatus(receipts(), mapped);
    setReceipts(mapped);
    localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
  } catch {
    // ramane cache-ul existent
  }
}

export async function loadMoreReceipts() {
  if (!_nextCursor || loadingMore()) return;
  setLoadingMore(true);
  try {
    let qs = `/api/receipts?limit=${_lastLimit}&sort=-activity&unpaid_days=30&last_id=${_nextCursor}`;
    if (_lastDateFrom) qs += `&date_from=${_lastDateFrom}`;
    if (_lastDateTo) qs += `&date_to=${_lastDateTo}`;
    if (_lastSearch) qs += `&q=${encodeURIComponent(_lastSearch)}`;
    if (_lastLocationId != null) qs += `&location_id=${_lastLocationId}`;
    const res = await apiFetch(qs);
    if (!res.ok) return;
    const data = await res.json();
    const mapped: Receipt[] = data.items.map(mapFromApi);
    _nextCursor = data.next_cursor ?? null;
    setHasMore(_nextCursor !== null);
    const updated = [...receipts(), ...mapped];
    setReceipts(updated);
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  } finally {
    setLoadingMore(false);
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
    due_date: receipt.dueDate ?? null,
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
    })),
    total: receipt.total.toFixed(2),
  };

  const res = await apiFetch("/api/receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const created = mapFromApi(await res.json());
  setReceipts([created, ...receipts()]);
  localStorage.setItem(CACHE_KEY, JSON.stringify(receipts()));
  return created;
}

export async function updateReceiptContent(id: string, receipt: ReceiptInput): Promise<Receipt> {
  const body: Record<string, unknown> = {
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    due_date: receipt.dueDate ?? null,
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
    })),
    total: receipt.total.toFixed(2),
  };

  const res = await apiFetch(`/api/receipts/${id}/content`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  setReceipts(receipts().map((r) => r.id === String(id) ? updated : r));
  localStorage.setItem(CACHE_KEY, JSON.stringify(receipts()));
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
  if (!res.ok) return;
  const updated = receipts().map((r) =>
    r.id === id ? {
      ...r,
      metodaPlata: pay_method !== "Neplatit" ? pay_method : undefined,
      partialPay: pay_method === "Platit Partial" ? (partialPay ?? 100) : undefined,
    } : r
  );
  setReceipts(updated);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export async function assignFacturaNumber(id: string, locationId: number): Promise<{ serie: string; nr: number }> {
  const res = await apiFetch(`/api/receipts/${id}/assign-number`, {
    method: "POST",
    body: JSON.stringify({ doc_type: "factura", location_id: locationId }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const data: { serie: string; nr: number } = await res.json();
  const next = receipts().map((r) =>
    r.id === id ? { ...r, facturaSerie: data.serie, facturaNr: data.nr } : r
  );
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return { serie: data.serie, nr: data.nr };
}

export function applyDocNumber(
  id: string,
  docType: "deviz" | "factura" | "chitanta",
  serie: string,
  nr: number,
) {
  const next = receipts().map((r) => {
    if (r.id !== id) return r;
    if (docType === "deviz") return { ...r, devizSerie: serie, devizNr: nr };
    if (docType === "factura") return { ...r, facturaSerie: serie, facturaNr: nr };
    return { ...r, chitantaSerie: serie, chitantaNr: nr };
  });
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

export async function finalizeFdl(id: string): Promise<Receipt> {
  const res = await apiFetch(`/api/receipts/${id}/finalize-fdl`, { method: "POST" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return updated;
}

export async function convertFdlToDeviz(id: string): Promise<Receipt> {
  const res = await apiFetch(`/api/receipts/${id}/convert-to-deviz`, { method: "POST" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return updated;
}

export async function deleteReceipt(id: string) {
  await apiFetch(`/api/receipts/${id}`, { method: "DELETE" });
  const updated = receipts().filter((r) => r.id !== id);
  setReceipts(updated);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export async function updateReceiptClient(id: string, clientId: number | null): Promise<void> {
  const res = await apiFetch(`/api/receipts/${id}/client`, {
    method: "PATCH",
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

export async function saveReceiptVehicol(id: string, vehicol: VehicolData): Promise<void> {
  const res = await apiFetch(`/api/receipts/${id}/vehicol`, {
    method: "PUT",
    body: JSON.stringify({
      numar_masina: vehicol.numarMasina,
      marca: vehicol.marca ?? null,
      model: vehicol.model ?? null,
      numar_kilometrii: vehicol.numarKilometrii ?? null,
      vin: vehicol.vin ?? null,
      observatii: vehicol.observatii ?? null,
    }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  const next = receipts().map((r) => r.id === id ? { ...r, vehicol } : r);
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

async function _readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json();
    return j.detail ?? j.message ?? fallback;
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
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
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
  _reloadTimer = setTimeout(() => loadReceipts(), 300);
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
