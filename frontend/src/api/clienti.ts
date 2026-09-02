import { crudApi, http, type CursorQuery, type Schemas } from "./client";
import type { Client, ClientVehicol } from "../types/client";

export type ClientCreate = Schemas["ClientCreate"];
export type ClientUpdate = Partial<ClientCreate>;
export type ClientVehicolCreate = Schemas["ClientVehicolCreate"];
export type ClientVehicolUpdate = Partial<ClientVehicolCreate>;

export interface ClientiQuery extends CursorQuery {
  q?: string | null;
  q_masina?: string | null;
  tip?: string | null;
  cui?: string | null;
  offset?: number;
}

const base = crudApi<Client, ClientCreate, ClientUpdate, ClientiQuery>("/api/clienti");

export const clientiApi = {
  ...base,
  listVehicole: (clientId: number) => http.get<ClientVehicol[]>(`/api/clienti/${clientId}/vehicole`),
  createVehicol: (clientId: number, body: ClientVehicolCreate) =>
    http.post<ClientVehicol>(`/api/clienti/${clientId}/vehicole`, body, { errorMessage: "Eroare la salvare." }),
  updateVehicol: (clientId: number, vId: number, body: ClientVehicolUpdate) =>
    http.patch<ClientVehicol>(`/api/clienti/${clientId}/vehicole/${vId}`, body, {
      errorMessage: "Eroare la salvare.",
    }),
  removeVehicol: (clientId: number, vId: number) =>
    http.delete(`/api/clienti/${clientId}/vehicole/${vId}`, { errorMessage: "Eroare la ștergere." }),
};
