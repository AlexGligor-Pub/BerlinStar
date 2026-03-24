import { createSignal } from "solid-js";
import { apiFetch, API_BASE } from "../utils/api";
import { auth } from "./authStore";
import type { CartItem } from "./cartStore";

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
}

const CACHE_KEY = "bs_receipts";

function mapFromApi(r: any): Receipt {
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
    descriere: r.descriere ?? undefined,
    dateTehn: r.date_tehn ?? undefined,
    metodaPlata: r.pay_method !== "Neplatit" ? r.pay_method : undefined,
    partialPay: r.partial_pay != null ? parseFloat(r.partial_pay) : undefined,
    items: r.receipt_items.map((i: any) => ({
      id: i.id,
      lineId: `${i.id}_${i.employee_id ?? ""}`,
      name: i.name,
      price: parseFloat(i.price),
      qty: i.qty,
      unit: i.unit,
      employeeId: i.employee_id ?? null,
      employeeName: i.employee_name ?? null,
      employeeTargetPct: i.employee_target_pct ?? null,
    })),
    total: parseFloat(r.total),
    devizSerie: r.deviz_serie ?? "",
    devizNr: r.deviz_nr ?? 0,
    facturaSerie: r.factura_serie ?? "",
    facturaNr: r.factura_nr ?? 0,
    chitantaSerie: r.chitanta_serie ?? "",
    chitantaNr: r.chitanta_nr ?? 0,
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

// Parametrii ultimului load — folositi de SSE scheduleReload
let _lastDateFrom: string | null = null;
let _lastDateTo: string | null = null;
let _lastLimit: number = 10;
let _lastSearch: string = "";
let _nextCursor: number | null = null;

const [hasMore, setHasMore] = createSignal(false);
const [loadingMore, setLoadingMore] = createSignal(false);
export { hasMore, loadingMore };

export async function loadReceipts(dateFrom?: string | null, dateTo?: string | null, limit?: number, q?: string) {
  if (dateFrom !== undefined) _lastDateFrom = dateFrom ?? null;
  if (dateTo !== undefined) _lastDateTo = dateTo ?? null;
  if (limit !== undefined) _lastLimit = limit;
  if (q !== undefined) _lastSearch = q;
  _nextCursor = null;
  try {
    let qs = `/api/receipts?limit=${_lastLimit}&sort=-id&unpaid_days=30`;
    if (_lastDateFrom) qs += `&date_from=${_lastDateFrom}`;
    if (_lastDateTo) qs += `&date_to=${_lastDateTo}`;
    if (_lastSearch) qs += `&q=${encodeURIComponent(_lastSearch)}`;
    const res = await apiFetch(qs);
    if (!res.ok) return;
    const data = await res.json();
    const mapped: Receipt[] = data.items.map(mapFromApi);
    _nextCursor = data.next_cursor ?? null;
    setHasMore(_nextCursor !== null);
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
    let qs = `/api/receipts?limit=${_lastLimit}&sort=-id&unpaid_days=30&last_id=${_nextCursor}`;
    if (_lastDateFrom) qs += `&date_from=${_lastDateFrom}`;
    if (_lastDateTo) qs += `&date_to=${_lastDateTo}`;
    if (_lastSearch) qs += `&q=${encodeURIComponent(_lastSearch)}`;
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

export async function saveReceipt(receipt: Omit<Receipt, "id">): Promise<Receipt> {
  const body = {
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    pay_method: receipt.metodaPlata ?? "Neplatit",
    items: receipt.items.map((i) => ({
      name: i.name,
      price: i.price.toFixed(2),
      qty: i.qty,
      unit: i.unit,
      employee_id: i.employeeId ?? null,
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

export async function updateReceiptContent(id: string, receipt: Omit<Receipt, "id">): Promise<Receipt> {
  const body = {
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    items: receipt.items.map((i) => ({
      name: i.name,
      price: i.price.toFixed(2),
      qty: i.qty,
      unit: i.unit,
      employee_id: i.employeeId ?? null,
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
  if (!res.ok) return;
  const updated = mapFromApi(await res.json());
  const next = receipts().map((r) => r.id === id ? updated : r);
  setReceipts(next);
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
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

function scheduleReload() {
  clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(() => loadReceipts(), 800);
}

let _posEs: EventSource | null = null;

export function connectPosSSE(): void {
  if (_posEs) return;
  const token = auth.token;
  if (!token) return;
  const es = new EventSource(`${API_BASE}/api/receipts/events?token=${encodeURIComponent(token)}&client_type=pos`);
  _posEs = es;
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      _posEs = null;
      setTimeout(() => connectPosSSE(), 5000);
    }
  };
}

export function disconnectPosSSE(): void {
  if (_posEs) { _posEs.close(); _posEs = null; }
}

export function connectSSE(): void {
  if (_es) return;
  _openSSE();
}

export function disconnectSSE(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_es) { _es.close(); _es = null; }
  setSseStatus("disconnected");
}

function _openSSE(): void {
  const token = auth.token;
  if (!token) return;
  setSseStatus("connecting");
  const es = new EventSource(`${API_BASE}/api/receipts/events?token=${encodeURIComponent(token)}&client_type=reception`);
  _es = es;
  es.onopen = () => setSseStatus("connected");
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
      _reconnectTimer = setTimeout(() => { _reconnectTimer = null; _openSSE(); }, 5000);
    }
  };
}
