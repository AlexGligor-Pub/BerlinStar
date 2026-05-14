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
  vin?: string | null;
  observatii?: string | null;
}
