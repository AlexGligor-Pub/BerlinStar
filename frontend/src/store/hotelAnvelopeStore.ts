import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarcaAnvelopa {
  id: number;
  nume: string;
}

export interface DimensiuneAnvelopa {
  id: number;
  valoare: string;
}

export interface LocCazare {
  id: number;
  nume: string;
  description: string | null;
}

export type TipAnvelopa = "iarna" | "vara" | "ms" | "altele";

export interface Anvelopa {
  id: number;
  clientId: number | null;
  marcaId: number | null;
  dimensiuneId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  comments: string | null;
  marcaNume: string | null;
  dimensiuneValoare: string | null;
}

export interface CazareItem {
  id: number;
  anvelopaId: number | null;
  anvelopa: Anvelopa | null;
}

export interface Cazare {
  id: number;
  clientId: number | null;
  employeeId: number | null;
  locCazareId: number | null;
  dataCheckin: string;
  dataCheckout: string | null;
  comments: string | null;
  createdAt: string;
  clientNume: string | null;
  clientCui: string | null;
  clientTelefon: string | null;
  clientAdresa: string | null;
  clientReprezentant: string | null;
  employeeName: string | null;
  locCazareNume: string | null;
  items: CazareItem[];
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapAnvelopa(a: any): Anvelopa {
  return {
    id: a.id,
    clientId: a.client_id ?? null,
    marcaId: a.marca_id ?? null,
    dimensiuneId: a.dimensiune_id ?? null,
    tip: a.tip as TipAnvelopa,
    adancime: a.adancime ?? null,
    comments: a.comments ?? null,
    marcaNume: a.marca_nume ?? null,
    dimensiuneValoare: a.dimensiune_valoare ?? null,
  };
}

function mapCazare(c: any): Cazare {
  return {
    id: c.id,
    clientId: c.client_id ?? null,
    employeeId: c.employee_id ?? null,
    locCazareId: c.loc_cazare_id ?? null,
    dataCheckin: c.data_checkin,
    dataCheckout: c.data_checkout ?? null,
    comments: c.comments ?? null,
    createdAt: c.created_at,
    clientNume: c.client_nume ?? null,
    clientCui: c.client_cui ?? null,
    clientTelefon: c.client_telefon ?? null,
    clientAdresa: c.client_adresa ?? null,
    clientReprezentant: c.client_reprezentant ?? null,
    employeeName: c.employee_name ?? null,
    locCazareNume: c.loc_cazare_nume ?? null,
    items: (c.items ?? []).map((item: any) => ({
      id: item.id,
      anvelopaId: item.anvelopa_id ?? null,
      anvelopa: item.anvelopa ? mapAnvelopa(item.anvelopa) : null,
    })),
  };
}

// ─── Signals ─────────────────────────────────────────────────────────────────

const [cazari, setCazari] = createSignal<Cazare[]>([]);
const [marci, setMarci] = createSignal<MarcaAnvelopa[]>([]);
const [dimensiuni, setDimensiuni] = createSignal<DimensiuneAnvelopa[]>([]);
const [locuriCazare, setLocuriCazare] = createSignal<LocCazare[]>([]);
const [cazariHasMore, setCazariHasMore] = createSignal(false);
const [cazariLoadingMore, setCazariLoadingMore] = createSignal(false);
const [cazariNextCursor, setCazariNextCursor] = createSignal<number | null>(null);
let _lastCazariParams: Parameters<typeof loadCazari>[0];

export { cazari, marci, dimensiuni, locuriCazare, cazariHasMore, cazariLoadingMore };

// ─── Load functions ───────────────────────────────────────────────────────────

function buildCazariQs(params: Parameters<typeof loadCazari>[0], lastId?: number) {
  const qs = new URLSearchParams();
  qs.set("limit", String(params?.limit ?? 30));
  if (params?.activa !== undefined) qs.set("activa", String(params.activa));
  if (params?.clientId !== undefined) qs.set("client_id", String(params.clientId));
  if (params?.dateFrom) qs.set("date_from", params.dateFrom);
  if (params?.dateTo) qs.set("date_to", params.dateTo);
  if (lastId !== undefined) qs.set("last_id", String(lastId));
  return qs;
}

export async function loadCazari(params?: {
  activa?: boolean;
  clientId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  _lastCazariParams = params;
  try {
    const res = await apiFetch(`/api/cazare-anvelope?${buildCazariQs(params)}`);
    if (!res.ok) return;
    const data = await res.json();
    setCazari(data.items.map(mapCazare));
    setCazariHasMore(data.next_cursor != null);
    setCazariNextCursor(data.next_cursor ?? null);
  } catch {}
}

export async function loadMoreCazari() {
  if (!cazariHasMore() || cazariLoadingMore()) return;
  const cursor = cazariNextCursor();
  if (cursor == null) return;
  setCazariLoadingMore(true);
  try {
    const qs = buildCazariQs(_lastCazariParams, cursor);
    const res = await apiFetch(`/api/cazare-anvelope?${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setCazari((prev) => [...prev, ...data.items.map(mapCazare)]);
    setCazariHasMore(data.next_cursor != null);
    setCazariNextCursor(data.next_cursor ?? null);
  } catch {} finally { setCazariLoadingMore(false); }
}

export async function loadAnvelope(clientId: number): Promise<Anvelopa[]> {
  try {
    const res = await apiFetch(`/api/anvelope?client_id=${clientId}&limit=200`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items.map(mapAnvelopa);
  } catch {
    return [];
  }
}

const MARCI_CACHE_KEY = "bs_marci_anvelope";
const DIM_CACHE_KEY = "bs_dimensiuni_anvelope";
const LOCURI_CACHE_KEY = "bs_locuri_cazare";
const CACHE_TTL = 10 * 60 * 1000;

export async function loadMarci(force = false) {
  if (!force) {
    try {
      const cached = localStorage.getItem(MARCI_CACHE_KEY);
      if (cached) {
        const { ts, items } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setMarci(items); return; }
      }
    } catch {}
  }
  try {
    const res = await apiFetch("/api/marci-anvelope?limit=500");
    if (!res.ok) return;
    const data = await res.json();
    const items: MarcaAnvelopa[] = data.items.map((m: any) => ({ id: m.id, nume: m.nume }));
    setMarci(items);
    localStorage.setItem(MARCI_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export async function loadDimensiuni(force = false) {
  if (!force) {
    try {
      const cached = localStorage.getItem(DIM_CACHE_KEY);
      if (cached) {
        const { ts, items } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setDimensiuni(items); return; }
      }
    } catch {}
  }
  try {
    const res = await apiFetch("/api/dimensiuni-anvelope?limit=500");
    if (!res.ok) return;
    const data = await res.json();
    const items: DimensiuneAnvelopa[] = data.items.map((d: any) => ({ id: d.id, valoare: d.valoare }));
    setDimensiuni(items);
    localStorage.setItem(DIM_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export async function loadLocuriCazare(force = false) {
  if (!force) {
    try {
      const cached = localStorage.getItem(LOCURI_CACHE_KEY);
      if (cached) {
        const { ts, items } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setLocuriCazare(items); return; }
      }
    } catch {}
  }
  try {
    const res = await apiFetch("/api/loc-cazare?limit=500");
    if (!res.ok) return;
    const data = await res.json();
    const items: LocCazare[] = data.items.map((l: any) => ({
      id: l.id, nume: l.nume, description: l.description ?? null,
    }));
    setLocuriCazare(items);
    localStorage.setItem(LOCURI_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export function invalidateLocuriCache() {
  localStorage.removeItem(LOCURI_CACHE_KEY);
}
export function invalidateMarciCache() {
  localStorage.removeItem(MARCI_CACHE_KEY);
}
export function invalidateDimensiuniCache() {
  localStorage.removeItem(DIM_CACHE_KEY);
}
