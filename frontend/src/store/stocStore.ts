import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";
import { getReportsToken } from "../pages/rapoarte/reports-auth";

export interface StocRow {
  item_id: number;
  name: string;
  unit: string;
  price: number | string;
  cost_price: number | string | null;
  stoc_minim: number;
  qty: number;
  department_id: number;
  department_name: string;
  category_id: number;
  category_name: string;
}

export interface StocSnapshot {
  location_id: number;
  location_name: string;
  nr_produse: number;
  qty_total: number;
  valoare_cost: number | string;
  valoare_vanzare: number | string;
  sub_stoc_minim: number;
}

export interface MiscareStoc {
  id: number;
  created_at: string;
  movement_type: "SALE" | "SALE_REVERSE" | "PURCHASE" | "ADJUSTMENT";
  item_id: number | null;
  item_name: string;
  location_id: number | null;
  employee_id: number | null;
  employee_name: string | null;
  receipt_id: number | null;
  qty_delta: number;
  unit_cost: number | string | null;
  unit_price: number | string | null;
  note: string | null;
  created_by_user: string | null;
}

const [stocuri, setStocuri] = createSignal<StocRow[]>([]);
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

export { stocuri, loading, error };

export async function loadStocuri(locationId: number, q?: string): Promise<void> {
  setLoading(true);
  setError(null);
  try {
    const qs = new URLSearchParams({ location_id: String(locationId) });
    if (q) qs.set("q", q);
    const res = await apiFetch(`/api/stocuri?${qs.toString()}`);
    if (!res.ok) throw new Error(`Eroare ${res.status}`);
    setStocuri(await res.json());
  } catch (e: any) {
    setError(e?.message || "Eroare la incarcarea stocurilor.");
    setStocuri([]);
  } finally {
    setLoading(false);
  }
}

export async function updateItemMeta(
  itemId: number,
  locationId: number,
  patch: { cost_price?: number | null; stoc_minim?: number },
): Promise<StocRow> {
  const res = await apiFetch(`/api/stocuri/item/${itemId}?location_id=${locationId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  const updated: StocRow = await res.json();
  setStocuri((prev) => prev.map((r) => (r.item_id === itemId ? updated : r)));
  return updated;
}

export async function intrareMarfa(payload: {
  item_id: number;
  location_id: number;
  qty: number;
  unit_cost?: number | null;
  note?: string | null;
}): Promise<StocRow> {
  const res = await apiFetch(`/api/stocuri/intrare`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const updated: StocRow = await res.json();
  setStocuri((prev) => prev.map((r) => (r.item_id === payload.item_id ? updated : r)));
  return updated;
}

export async function ajustareStoc(payload: {
  item_id: number;
  location_id: number;
  new_qty: number;
  note?: string | null;
}): Promise<StocRow> {
  const res = await apiFetch(`/api/stocuri/ajustare`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const updated: StocRow = await res.json();
  setStocuri((prev) => prev.map((r) => (r.item_id === payload.item_id ? updated : r)));
  return updated;
}

export async function loadSnapshot(locationId: number): Promise<StocSnapshot> {
  const res = await apiFetch(`/api/stocuri/snapshot?location_id=${locationId}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function loadMiscari(params: {
  location_id?: number;
  date_from?: string;
  date_to?: string;
  employee_id?: number;
  item_id?: number;
  movement_type?: string;
  limit?: number;
}): Promise<MiscareStoc[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await apiFetch(`/api/stocuri/miscari?${qs.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function loadTopProduse(params: {
  date_from?: string;
  date_to?: string;
  location_ids?: number[];
  limit?: number;
}): Promise<Array<{
  item_id: number;
  item_name: string;
  qty_total: number;
  valoare_vanzare: number;
  valoare_cost: number;
  marja: number;
}>> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.limit) qs.set("limit", String(params.limit));
  for (const lid of params.location_ids || []) qs.append("location_ids", String(lid));
  const res = await apiFetch(`/api/stocuri/reports/top-produse?${qs.toString()}`, {
    authToken: getReportsToken(),
    handleUnauthorized: false,
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function loadPerAngajat(params: {
  date_from?: string;
  date_to?: string;
  location_ids?: number[];
}): Promise<Array<{
  employee_id: number | null;
  employee_name: string;
  item_id: number | null;
  item_name: string;
  qty_total: number;
  valoare: number;
}>> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  for (const lid of params.location_ids || []) qs.append("location_ids", String(lid));
  const res = await apiFetch(`/api/stocuri/reports/per-angajat?${qs.toString()}`, {
    authToken: getReportsToken(),
    handleUnauthorized: false,
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
