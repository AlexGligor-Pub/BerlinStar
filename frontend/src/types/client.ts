export interface Client {
  id: number;
  tip: "fizic" | "juridic";
  nume: string;
  cui: string | null;
  reprezentant: string | null;
  telefon: string | null;
  email: string | null;
  adresa: string | null;
  description: string | null;
  comments: string | null;
  numar_masina: string | null;
}

export type ClientItem = Pick<
  Client,
  "id" | "nume" | "cui" | "numar_masina"
> & Partial<Omit<Client, "id" | "nume" | "cui" | "numar_masina">>;

export interface ClientVehicol {
  id: number;
  client_id?: number;
  numar_masina: string;
  marca: string | null;
  model: string | null;
  numar_kilometrii?: number | null;
  an_fabricatie?: number | null;
  vin?: string | null;
  observatii?: string | null;
}

/** Persoanele fizice nu au CUI: campul `cui` tine CNP-ul, iar e-Factura B2C cere
 *  13 cifre (13 zerouri cand CNP-ul real nu e cunoscut). */
export const CNP_PLACEHOLDER = "0000000000000";

export function normalizeCnp(v: string): string {
  return v.replace(/[\s.-]/g, "");
}

/** Gol inseamna „CNP necunoscut", nu eroare: pleaca spre server ca placeholder. */
export function cnpForSave(v: string): string {
  return normalizeCnp(v) || CNP_PLACEHOLDER;
}

/** Doar un CNP tastat gresit e eroare — golul e acceptat. */
export function cnpError(v: string): string | null {
  const c = normalizeCnp(v);
  return !c || /^\d{13}$/.test(c) ? null : "CNP invalid: trebuie să aibă exact 13 cifre.";
}
