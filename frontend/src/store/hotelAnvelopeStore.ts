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

export interface CodDotAnvelopa {
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
  dotId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  indiceViteza: string | null;
  indiceSarcina: number | null;
  comments: string | null;
  marcaNume: string | null;
  dimensiuneValoare: string | null;
  profilValoare: string | null;
  dotValoare: string | null;
}

export const INDICE_VITEZA_SHORTCUTS: string[] = ["H", "V", "T", "W", "Y", "S", "R", "Q", "P", "N"];
export const INDICE_SARCINA_SHORTCUTS: number[] = [91, 94, 95, 88, 98, 87, 92, 96, 100, 102];

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
  successorCazareId: number | null;
  successorMontatePeMasina: boolean | null;
  referintaCazareDataCheckin: string | null;
  referintaCazareItems: CazareItem[];
  items: CazareItem[];
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

interface RawAnvelopa {
  id: number;
  client_id?: number | null;
  marca_id?: number | null;
  dimensiune_id?: number | null;
  profil_id?: number | null;
  dot_id?: number | null;
  tip: string;
  adancime?: number | null;
  indice_viteza?: string | null;
  indice_sarcina?: number | null;
  comments?: string | null;
  marca_nume?: string | null;
  dimensiune_valoare?: string | null;
  profil_valoare?: string | null;
  dot_valoare?: string | null;
}

interface RawCazareItem {
  id: number;
  anvelopa_id?: number | null;
  anvelopa?: RawAnvelopa | null;
}

interface RawCazare {
  id: number;
  client_id?: number | null;
  employee_id?: number | null;
  loc_cazare_id?: number | null;
  location_id?: number | null;
  location_name?: string | null;
  data_checkin: string;
  data_checkout?: string | null;
  comments?: string | null;
  created_at: string;
  client_nume?: string | null;
  client_cui?: string | null;
  client_telefon?: string | null;
  client_adresa?: string | null;
  client_reprezentant?: string | null;
  employee_name?: string | null;
  loc_cazare_nume?: string | null;
  numar_masina?: string | null;
  dep_anvelope?: boolean;
  dep_capace?: boolean;
  dep_roti_complete?: boolean;
  dep_antifurturi?: boolean;
  dep_prezoane?: boolean;
  referinta_cazare_id?: number | null;
  montate_pe_masina?: boolean;
  successor_cazare_id?: number | null;
  successor_montate_pe_masina?: boolean | null;
  referinta_cazare_data_checkin?: string | null;
  referinta_cazare_items?: RawCazareItem[];
  items?: RawCazareItem[];
}

function mapAnvelopa(a: RawAnvelopa): Anvelopa {
  return {
    id: a.id,
    clientId: a.client_id ?? null,
    marcaId: a.marca_id ?? null,
    dimensiuneId: a.dimensiune_id ?? null,
    profilId: a.profil_id ?? null,
    dotId: a.dot_id ?? null,
    tip: a.tip as TipAnvelopa, // server enum oglindit local
    adancime: a.adancime ?? null,
    indiceViteza: a.indice_viteza ?? null,
    indiceSarcina: a.indice_sarcina ?? null,
    comments: a.comments ?? null,
    marcaNume: a.marca_nume ?? null,
    dimensiuneValoare: a.dimensiune_valoare ?? null,
    profilValoare: a.profil_valoare ?? null,
    dotValoare: a.dot_valoare ?? null,
  };
}

export function mapCazare(c: RawCazare): Cazare {
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
    successorCazareId: c.successor_cazare_id ?? null,
    successorMontatePeMasina: c.successor_montate_pe_masina ?? null,
    referintaCazareDataCheckin: c.referinta_cazare_data_checkin ?? null,
    referintaCazareItems: (c.referinta_cazare_items ?? []).map((item) => ({
      id: item.id,
      anvelopaId: item.anvelopa_id ?? null,
      anvelopa: item.anvelopa ? mapAnvelopa(item.anvelopa) : null,
    })),
    items: (c.items ?? []).map((item) => ({
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
const [coduriDot, setCoduriDot] = createSignal<CodDotAnvelopa[]>([]);
const [locuriCazare, setLocuriCazare] = createSignal<LocCazare[]>([]);
const [cazariHasMore, setCazariHasMore] = createSignal(false);
const [cazariLoadingMore, setCazariLoadingMore] = createSignal(false);
const [cazariNextCursor, setCazariNextCursor] = createSignal<number | null>(null);
const [_lastCazariParams, _setLastCazariParams] = createSignal<Parameters<typeof loadCazari>[0]>(undefined);

export { cazari, marci, dimensiuni, profiluri, coduriDot, locuriCazare, cazariHasMore, cazariLoadingMore };

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

export async function getCazareById(id: number): Promise<Cazare | null> {
  try {
    const res = await apiFetch(`/api/cazare-anvelope/${id}`);
    if (!res.ok) return null;
    return mapCazare(await res.json());
  } catch {
    return null;
  }
}

/** Returneaza cazarile ACTIVE (data_checkout NULL) pentru o placuta data.
 *  Folosit la avertizarea utilizatorului din POS cand placuta are deja anvelope
 *  in depozit (eventual la alt client). */
export async function loadActiveCazariByPlate(plate: string): Promise<Cazare[]> {
  const q = (plate ?? "").trim();
  if (!q) return [];
  try {
    const res = await apiFetch(
      `/api/cazare-anvelope?activa=true&numar_masina=${encodeURIComponent(q)}&limit=50`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(mapCazare);
  } catch {
    return [];
  }
}

export interface VehiculInfo {
  numarMasina: string;
  marca: string | null;
  model: string | null;
  numarKilometrii: number | null;
  vin: string | null;
  observatii: string | null;
}

function _normalizePlate(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

export async function getVehiculForCazare(cazare: Pick<Cazare, "clientId" | "numarMasina">): Promise<VehiculInfo | null> {
  if (!cazare.clientId || !cazare.numarMasina) return null;
  try {
    const res = await apiFetch(`/api/clienti/${cazare.clientId}/vehicole`);
    if (!res.ok) return null;
    interface RawVehicul {
      numar_masina?: string | null;
      marca?: string | null;
      model?: string | null;
      numar_kilometrii?: number | null;
      vin?: string | null;
      observatii?: string | null;
    }
    const list = (await res.json()) as RawVehicul[];
    const wanted = _normalizePlate(cazare.numarMasina);
    const v = list.find((x) => _normalizePlate(x.numar_masina ?? "") === wanted);
    if (!v) return null;
    return {
      numarMasina: v.numar_masina ?? cazare.numarMasina,
      marca: v.marca ?? null,
      model: v.model ?? null,
      numarKilometrii: v.numar_kilometrii ?? null,
      vin: v.vin ?? null,
      observatii: v.observatii ?? null,
    };
  } catch {
    return null;
  }
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
const DOT_CACHE_KEY = "bs_coduri_dot_anvelope";
const LOCURI_CACHE_KEY = "bs_locuri_cazare";
const CACHE_TTL = 10 * 60 * 1000;

async function loadCached<R, T>(
  cacheKey: string,
  url: string,
  setter: (items: T[]) => void,
  mapper: (raw: R) => T,
  force: boolean,
): Promise<void> {
  if (!force) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; items: T[] };
        if (Date.now() - parsed.ts < CACHE_TTL) { setter(parsed.items); return; }
      }
    } catch {
      // cache corrupt — fall through to network
    }
  }
  try {
    const res = await apiFetch(`${url}?limit=500`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: R[] };
    const items: T[] = data.items.map(mapper);
    setter(items);
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items })); } catch {
      // storage quota/disabled — keep in-memory
    }
  } catch {
    // network — silent (consumers see previous cached state)
  }
}

interface RawNamed { id: number; nume: string }
interface RawValoare { id: number; valoare: string }
interface RawLocCazare { id: number; nume: string; description?: string | null }

export function loadMarci(force = false): Promise<void> {
  return loadCached<RawNamed, MarcaAnvelopa>(
    MARCI_CACHE_KEY, "/api/marci-anvelope", setMarci,
    (m) => ({ id: m.id, nume: m.nume }), force,
  );
}

export function loadDimensiuni(force = false): Promise<void> {
  return loadCached<RawValoare, DimensiuneAnvelopa>(
    DIM_CACHE_KEY, "/api/dimensiuni-anvelope", setDimensiuni,
    (d) => ({ id: d.id, valoare: d.valoare }), force,
  );
}

export function loadLocuriCazare(force = false): Promise<void> {
  return loadCached<RawLocCazare, LocCazare>(
    LOCURI_CACHE_KEY, "/api/loc-cazare", setLocuriCazare,
    (l) => ({ id: l.id, nume: l.nume, description: l.description ?? null }), force,
  );
}

export function loadProfil(force = false): Promise<void> {
  return loadCached<RawValoare, ProfilAnvelopa>(
    PROFIL_CACHE_KEY, "/api/profiluri-anvelope", setProfiluri,
    (p) => ({ id: p.id, valoare: p.valoare }), force,
  );
}

export function loadCoduriDot(force = false): Promise<void> {
  return loadCached<RawValoare, CodDotAnvelopa>(
    DOT_CACHE_KEY, "/api/coduri-dot-anvelope", setCoduriDot,
    (d) => ({ id: d.id, valoare: d.valoare }), force,
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
export function invalidateCoduriDotCache() {
  localStorage.removeItem(DOT_CACHE_KEY);
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

