import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface CatalogDepartment {
  id: number;
  name: string;
}

const [catalogDepartments, setCatalogDepartments] = createSignal<CatalogDepartment[]>([]);

export async function loadCatalogDepartments(locationId?: number | null) {
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/departments?limit=100${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setCatalogDepartments(
      data.items.map((d: any) => ({ id: d.id, name: d.name }))
    );
  } catch {}
}

export { catalogDepartments };
