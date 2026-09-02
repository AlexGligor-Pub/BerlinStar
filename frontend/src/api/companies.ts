import { crudApi, http, type Schemas } from "./client";

export type Company = Schemas["CompanyRead"];
export type CompanyCreate = Schemas["CompanyCreate"];
export type CompanyUpdate = Schemas["CompanyUpdate"];

export interface AnafCompany {
  name?: string | null;
  address?: string | null;
  representative?: string | null;
  nr_reg_com?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  is_vat_payer?: boolean | null;
  registration_status?: string | null;
  [k: string]: unknown;
}

const base = crudApi<Company, CompanyCreate, CompanyUpdate>("/api/companies");

export const companiesApi = {
  ...base,
  /** 404 = CUI negasit; apelantul decide mesajul, de aceea raspuns brut. */
  anafRaw: (cui: string | number) => http.raw(`/api/companies/anaf/${cui}`),
  uploadLogo: (id: number, fd: FormData) =>
    http.upload<{ logo_path: string | null }>(`/api/companies/${id}/logo`, fd),
  uploadBackground: (id: number, fd: FormData) =>
    http.upload<{ background_path: string | null }>(`/api/companies/${id}/background`, fd),
};
