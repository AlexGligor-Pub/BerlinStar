import { createSignal } from "solid-js";
import { apiFetch, API_BASE } from "../utils/api";
import {
  INDICE_VITEZA_SHORTCUTS as _IV,
  INDICE_SARCINA_SHORTCUTS as _IS,
  type TipAnvelopa,
} from "./hotelAnvelopeStore";

// Re-export — definitiile traiesc in hotelAnvelopeStore (proprietatile sunt
// ale anvelopei). Pastram exporturile aici pentru ca importurile existente din
// MontareRotiModal sa nu trebuiasca rescrise.
export const INDICE_VITEZA_SHORTCUTS = _IV;
export const INDICE_SARCINA_SHORTCUTS = _IS;

export type PozitieRoata =
  | "dreapta_fata"
  | "stanga_fata"
  | "dreapta_spate"
  | "stanga_spate"
  | "rezerva"
  | "nespecificat";

export const POZITII_ORDONATE: PozitieRoata[] = [
  "stanga_fata",
  "dreapta_fata",
  "stanga_spate",
  "dreapta_spate",
  "rezerva",
  "nespecificat",
];

export const POZITIE_LABELS: Record<PozitieRoata, string> = {
  dreapta_fata: "Dreapta Față",
  stanga_fata: "Stânga Față",
  dreapta_spate: "Dreapta Spate",
  stanga_spate: "Stânga Spate",
  rezerva: "Rezervă",
  nespecificat: "Nespecificat",
};

export const PRESIUNE_SHORTCUTS = [2.2, 2.5, 2.8, 3.0];

export const CUPLU_SHORTCUTS = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];

export const ADANCIME_SHORTCUTS = [2, 3, 4, 5, 6];
export const ADANCIME_DEFAULT = 5;

export interface MontajRota {
  id: number;
  receiptId: number | null;
  pozitie: PozitieRoata;
  presiune: number | null;
  ordine: number | null;
  marcaId: number | null;
  dimensiuneId: number | null;
  profilId: number | null;
  dotId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  cupluStrangere: number | null;
  indiceViteza: string | null;
  indiceSarcina: number | null;
  comments: string | null;
  marcaNume: string | null;
  dimensiuneValoare: string | null;
  profilValoare: string | null;
  dotValoare: string | null;
}

export interface MontajRotaDraft {
  pozitie: PozitieRoata;
  presiune: number | null;
  ordine: number | null;
  marcaId: number | null;
  dimensiuneId: number | null;
  profilId: number | null;
  dotId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  cupluStrangere: number | null;
  indiceViteza: string | null;
  indiceSarcina: number | null;
  comments: string | null;
}

function mapMontajRota(r: any): MontajRota {
  return {
    id: r.id,
    receiptId: r.receipt_id ?? null,
    pozitie: r.pozitie,
    presiune: r.presiune ?? null,
    ordine: r.ordine ?? null,
    marcaId: r.marca_id ?? null,
    dimensiuneId: r.dimensiune_id ?? null,
    profilId: r.profil_id ?? null,
    dotId: r.dot_id ?? null,
    tip: r.tip,
    adancime: r.adancime ?? null,
    cupluStrangere: r.cuplu_strangere ?? null,
    indiceViteza: r.indice_viteza ?? null,
    indiceSarcina: r.indice_sarcina ?? null,
    comments: r.comments ?? null,
    marcaNume: r.marca_nume ?? null,
    dimensiuneValoare: r.dimensiune_valoare ?? null,
    profilValoare: r.profil_valoare ?? null,
    dotValoare: r.dot_valoare ?? null,
  };
}

export async function loadMontajRotiByReceipt(receiptId: number): Promise<MontajRota[]> {
  try {
    const res = await apiFetch(`/api/montaj-roti?receipt_id=${receiptId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).map(mapMontajRota);
  } catch {
    return [];
  }
}

export interface MontajSuggestion {
  receiptId: number;
  receiptCreatedAt: string;
  montajCreatedAt: string;
  numarMasina: string;
  clientId: number | null;
  clientNume: string | null;
  wheels: MontajRota[];
}

export async function loadLatestMontajByPlate(plate: string): Promise<MontajSuggestion | null> {
  const q = (plate ?? "").trim();
  if (!q) return null;
  try {
    const res = await apiFetch(`/api/montaj-roti/by-license-plate?numar_masina=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.found !== true) return null;
    const wheels = Array.isArray(data.wheels) ? (data.wheels as any[]).map(mapMontajRota) : [];
    if (wheels.length === 0) return null;
    return {
      receiptId: data.receipt_id,
      receiptCreatedAt: data.receipt_created_at,
      montajCreatedAt: data.montaj_created_at,
      numarMasina: data.numar_masina,
      clientId: data.client_id ?? null,
      clientNume: data.client_nume ?? null,
      wheels,
    };
  } catch {
    return null;
  }
}

export async function bulkUpsertMontajRoti(
  receiptId: number,
  items: MontajRotaDraft[],
): Promise<MontajRota[]> {
  const body = {
    receipt_id: receiptId,
    items: items.map((it) => ({
      pozitie: it.pozitie,
      presiune: it.presiune,
      ordine: it.ordine,
      marca_id: it.marcaId,
      dimensiune_id: it.dimensiuneId,
      profil_id: it.profilId,
      dot_id: it.dotId,
      tip: it.tip,
      adancime: it.adancime,
      cuplu_strangere: it.cupluStrangere,
      indice_viteza: it.indiceViteza,
      indice_sarcina: it.indiceSarcina,
      comments: it.comments,
    })),
  };
  const res = await apiFetch("/api/montaj-roti/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? "Eroare la salvarea rotilor.");
  }
  const data = await res.json();
  return (data as any[]).map(mapMontajRota);
}

export function defaultPozitieForIndex(idx: number): PozitieRoata {
  return POZITII_ORDONATE[Math.min(idx, POZITII_ORDONATE.length - 1)];
}

// ─── Montare Roti Images (global cache) ──────────────────────────────────────

export type MontareRotiImages = Record<PozitieRoata, string | null>;

const [montareRotiImages, setMontareRotiImages] = createSignal<MontareRotiImages>({
  stanga_fata: null,
  dreapta_fata: null,
  stanga_spate: null,
  dreapta_spate: null,
  rezerva: null,
  nespecificat: null,
});

export { montareRotiImages };

let _montareRotiImagesLoaded = false;
let _montareRotiImagesPromise: Promise<void> | null = null;

export function invalidateMontareRotiImages(): void {
  _montareRotiImagesLoaded = false;
}

/** Construieste URL-urile prin proxy-ul BE pentru fiecare pozitie care are imagine configurata. */
export function buildMontareRotiProxyUrls(): MontareRotiImages {
  const imgs = montareRotiImages();
  const out: MontareRotiImages = {
    stanga_fata: null, dreapta_fata: null, stanga_spate: null,
    dreapta_spate: null, rezerva: null, nespecificat: null,
  };
  (Object.keys(out) as PozitieRoata[]).forEach((p) => {
    out[p] = imgs[p] ? `${API_BASE}/api/global-settings/montare-roti/image/${p}` : null;
  });
  return out;
}

export function loadMontareRotiImages(force = false): Promise<void> {
  if (!force && _montareRotiImagesLoaded) return Promise.resolve();
  if (_montareRotiImagesPromise) return _montareRotiImagesPromise;
  _montareRotiImagesPromise = (async () => {
    try {
      const res = await apiFetch("/api/global-settings/montare-roti");
      if (res.ok) {
        const d = await res.json();
        setMontareRotiImages({
          stanga_fata: d.montare_stanga_fata_image_path ?? null,
          dreapta_fata: d.montare_dreapta_fata_image_path ?? null,
          stanga_spate: d.montare_stanga_spate_image_path ?? null,
          dreapta_spate: d.montare_dreapta_spate_image_path ?? null,
          rezerva: d.montare_rezerva_image_path ?? null,
          nespecificat: d.montare_nespecificat_image_path ?? null,
        });
        _montareRotiImagesLoaded = true;
      }
    } catch {}
    finally { _montareRotiImagesPromise = null; }
  })();
  return _montareRotiImagesPromise;
}
