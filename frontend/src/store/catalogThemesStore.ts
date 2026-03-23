import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface CatalogDepartment {
  id: number;
  name: string;
  image_path: string | null;
}

const DEPT_CACHE_KEY = "bs_departments_cache";
const DEPT_CACHE_TTL = 20 * 60 * 1000;

const [catalogDepartments, setCatalogDepartments] = createSignal<CatalogDepartment[]>([]);

export async function loadCatalogDepartments(locationId?: number | null) {
  const cacheKey = `${DEPT_CACHE_KEY}_${locationId ?? "all"}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { ts, items } = JSON.parse(cached);
      if (Date.now() - ts < DEPT_CACHE_TTL) { setCatalogDepartments(items); return; }
    }
  } catch {}
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/departments?limit=100${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    const items = data.items.map((d: any) => ({ id: d.id, name: d.name, image_path: d.image_path ?? null }));
    setCatalogDepartments(items);
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export { catalogDepartments };
