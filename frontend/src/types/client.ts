import type { components } from "../api/schema";

type ClientRead = components["schemas"]["ClientRead"];
type ClientVehicolRead = components["schemas"]["ClientVehicolRead"];

export type ClientTip = "fizic" | "juridic";

type ServerMeta = "account_id" | "created_at" | "updated_at" | "is_deleted";

/** Sursa unica pentru forma clientului (Clienti, ClientDetail, POS, Receptie). */
export interface Client extends Omit<ClientRead, "tip" | ServerMeta>, Partial<Pick<ClientRead, ServerMeta>> {
  tip: ClientTip;
}

export type ClientItem = Pick<Client, "id" | "nume" | "cui" | "numar_masina"> &
  Partial<Omit<Client, "id" | "nume" | "cui" | "numar_masina">>;

export interface ClientVehicol
  extends Omit<ClientVehicolRead, "client_id" | ServerMeta>,
    Partial<Pick<ClientVehicolRead, "client_id" | ServerMeta>> {}

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
