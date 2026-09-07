import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface CatalogDepartment {
  id: number;
  name: string;
  image_path: string | null;
  showInProgramari: boolean;
}

interface RawDept {
  id: number;
  name: string;
  image_path?: string | null;
  show_in_programari?: boolean;
}

const DEPT_CACHE_KEY = "bs_departments_cache_v2";
const DEPT_CACHE_TTL = 20 * 60 * 1000;

const [catalogDepartments, setCatalogDepartments] = createSignal<CatalogDepartment[]>([]);

export async function loadCatalogDepartments(locationId?: number | null): Promise<void> {
  const cacheKey = `${DEPT_CACHE_KEY}_${locationId ?? "all"}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; items: CatalogDepartment[] };
      if (Date.now() - parsed.ts < DEPT_CACHE_TTL) { setCatalogDepartments(parsed.items); return; }
    }
  } catch {
    // corrupt cache — fall through
  }
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/departments?limit=100${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: RawDept[] };
    const items: CatalogDepartment[] = data.items.map((d) => ({
      id: d.id, name: d.name, image_path: d.image_path ?? null, showInProgramari: d.show_in_programari ?? true,
    }));
    setCatalogDepartments(items);
    writeCache(cacheKey, items);
  } catch {
    // network — keep previous
  }
}

function writeCache(cacheKey: string, items: CatalogDepartment[]): void {
  try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items })); } catch {
    // storage disabled — keep in-memory
  }
}

export function patchCatalogDepartment(id: number, patch: Partial<CatalogDepartment>, locationId?: number | null): void {
  const items = catalogDepartments().map((d) => (d.id === id ? { ...d, ...patch } : d));
  setCatalogDepartments(items);
  writeCache(`${DEPT_CACHE_KEY}_${locationId ?? "all"}`, items);
}

export { catalogDepartments };
