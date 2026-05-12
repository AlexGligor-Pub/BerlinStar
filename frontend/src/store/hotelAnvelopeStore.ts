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

export interface ProfilAnvelopa {
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
  profilId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  comments: string | null;
  marcaNume: string | null;
  dimensiuneValoare: string | null;
  profilValoare: string | null;
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
  locationId: number | null;
  locationName: string | null;
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
  numarMasina: string | null;
  depAnvelope: boolean;
  depCapace: boolean;
  depRotiComplete: boolean;
  depAntifurturi: boolean;
  depPrezoane: boolean;
  referintaCazareId: number | null;
  montatePeMasina: boolean;
  referintaCazareDataCheckin: string | null;
  referintaCazareItems: CazareItem[];
  items: CazareItem[];
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapAnvelopa(a: any): Anvelopa {
  return {
    id: a.id,
    clientId: a.client_id ?? null,
    marcaId: a.marca_id ?? null,
    dimensiuneId: a.dimensiune_id ?? null,
    profilId: a.profil_id ?? null,
    tip: a.tip as TipAnvelopa,
    adancime: a.adancime ?? null,
    comments: a.comments ?? null,
    marcaNume: a.marca_nume ?? null,
    dimensiuneValoare: a.dimensiune_valoare ?? null,
    profilValoare: a.profil_valoare ?? null,
  };
}

function mapCazare(c: any): Cazare {
  return {
    id: c.id,
    clientId: c.client_id ?? null,
    employeeId: c.employee_id ?? null,
    locCazareId: c.loc_cazare_id ?? null,
    locationId: c.location_id ?? null,
    locationName: c.location_name ?? null,
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
    numarMasina: c.numar_masina ?? null,
    depAnvelope: c.dep_anvelope ?? true,
    depCapace: c.dep_capace ?? false,
    depRotiComplete: c.dep_roti_complete ?? false,
    depAntifurturi: c.dep_antifurturi ?? false,
    depPrezoane: c.dep_prezoane ?? false,
    referintaCazareId: c.referinta_cazare_id ?? null,
    montatePeMasina: c.montate_pe_masina ?? false,
    referintaCazareDataCheckin: c.referinta_cazare_data_checkin ?? null,
    referintaCazareItems: (c.referinta_cazare_items ?? []).map((item: any) => ({
      id: item.id,
      anvelopaId: item.anvelopa_id ?? null,
      anvelopa: item.anvelopa ? mapAnvelopa(item.anvelopa) : null,
    })),
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
const [profiluri, setProfiluri] = createSignal<ProfilAnvelopa[]>([]);
const [locuriCazare, setLocuriCazare] = createSignal<LocCazare[]>([]);
const [cazariHasMore, setCazariHasMore] = createSignal(false);
const [cazariLoadingMore, setCazariLoadingMore] = createSignal(false);
const [cazariNextCursor, setCazariNextCursor] = createSignal<number | null>(null);
const [_lastCazariParams, _setLastCazariParams] = createSignal<Parameters<typeof loadCazari>[0]>(undefined);

export { cazari, marci, dimensiuni, profiluri, locuriCazare, cazariHasMore, cazariLoadingMore };

// ─── Load functions ───────────────────────────────────────────────────────────

function buildCazariQs(params: Parameters<typeof loadCazari>[0], lastId?: number) {
  const qs = new URLSearchParams();
  qs.set("limit", String(params?.limit ?? 30));
  if (params?.activa !== undefined) qs.set("activa", String(params.activa));
  if (params?.clientId !== undefined) qs.set("client_id", String(params.clientId));
  if (params?.locationId !== undefined) qs.set("location_id", String(params.locationId));
  if (params?.dateFrom) qs.set("date_from", params.dateFrom);
  if (params?.dateTo) qs.set("date_to", params.dateTo);
  if (lastId !== undefined) qs.set("last_id", String(lastId));
  return qs;
}

export async function loadCazari(params?: {
  activa?: boolean;
  clientId?: number;
  locationId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  _setLastCazariParams(params);
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
    const qs = buildCazariQs(_lastCazariParams(), cursor);
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
const PROFIL_CACHE_KEY = "bs_profiluri_anvelope";
const LOCURI_CACHE_KEY = "bs_locuri_cazare";
const CACHE_TTL = 10 * 60 * 1000;

async function loadCached<T>(
  cacheKey: string,
  url: string,
  setter: (items: T[]) => void,
  mapper: (raw: any) => T,
  force: boolean,
): Promise<void> {
  if (!force) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { ts, items } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) { setter(items); return; }
      }
    } catch {}
  }
  try {
    const res = await apiFetch(`${url}?limit=500`);
    if (!res.ok) return;
    const data = await res.json();
    const items: T[] = data.items.map(mapper);
    setter(items);
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export function loadMarci(force = false) {
  return loadCached<MarcaAnvelopa>(
    MARCI_CACHE_KEY, "/api/marci-anvelope", setMarci,
    (m) => ({ id: m.id, nume: m.nume }), force,
  );
}

export function loadDimensiuni(force = false) {
  return loadCached<DimensiuneAnvelopa>(
    DIM_CACHE_KEY, "/api/dimensiuni-anvelope", setDimensiuni,
    (d) => ({ id: d.id, valoare: d.valoare }), force,
  );
}

export function loadLocuriCazare(force = false) {
  return loadCached<LocCazare>(
    LOCURI_CACHE_KEY, "/api/loc-cazare", setLocuriCazare,
    (l) => ({ id: l.id, nume: l.nume, description: l.description ?? null }), force,
  );
}

export function loadProfil(force = false) {
  return loadCached<ProfilAnvelopa>(
    PROFIL_CACHE_KEY, "/api/profiluri-anvelope", setProfiluri,
    (p) => ({ id: p.id, valoare: p.valoare }), force,
  );
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
export function invalidateProfilCache() {
  localStorage.removeItem(PROFIL_CACHE_KEY);
}

// ─── Hotel Anvelope Images (global cache) ─────────────────────────────────────

export interface HotelAnvelopeImages {
  cazare: string | null;
  scoatere: string | null;
  montare: string | null;
}

const [hotelImages, setHotelImages] = createSignal<HotelAnvelopeImages>({
  cazare: null,
  scoatere: null,
  montare: null,
});

export { hotelImages };

let _hotelImagesLoaded = false;
let _hotelImagesPromise: Promise<void> | null = null;

export function invalidateHotelImages(): void {
  _hotelImagesLoaded = false;
}

export function loadHotelImages(force = false): Promise<void> {
  if (!force && _hotelImagesLoaded) return Promise.resolve();
  if (_hotelImagesPromise) return _hotelImagesPromise;
  _hotelImagesPromise = (async () => {
    try {
      const res = await apiFetch("/api/global-settings/hotel-anvelope");
      if (res.ok) {
        const d = await res.json();
        setHotelImages({
          cazare: d.hotel_cazare_image_path ?? null,
          scoatere: d.hotel_scoatere_image_path ?? null,
          montare: d.hotel_montare_image_path ?? null,
        });
        _hotelImagesLoaded = true;
      }
    } catch {}
    finally { _hotelImagesPromise = null; }
  })();
  return _hotelImagesPromise;
}

