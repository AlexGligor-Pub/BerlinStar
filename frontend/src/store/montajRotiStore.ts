import { apiFetch } from "../utils/api";
import type { TipAnvelopa } from "./hotelAnvelopeStore";

export type PozitieRoata =
  | "dreapta_fata"
  | "stanga_fata"
  | "dreapta_spate"
  | "stanga_spate"
  | "rezerva"
  | "nespecificat";

export const POZITII_ORDONATE: PozitieRoata[] = [
  "dreapta_fata",
  "stanga_fata",
  "dreapta_spate",
  "stanga_spate",
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

export interface MontajRota {
  id: number;
  receiptId: number | null;
  pozitie: PozitieRoata;
  presiune: number | null;
  ordine: number | null;
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

export interface MontajRotaDraft {
  pozitie: PozitieRoata;
  presiune: number | null;
  ordine: number | null;
  marcaId: number | null;
  dimensiuneId: number | null;
  profilId: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
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
    tip: r.tip,
    adancime: r.adancime ?? null,
    comments: r.comments ?? null,
    marcaNume: r.marca_nume ?? null,
    dimensiuneValoare: r.dimensiune_valoare ?? null,
    profilValoare: r.profil_valoare ?? null,
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
      tip: it.tip,
      adancime: it.adancime,
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
