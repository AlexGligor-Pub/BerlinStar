import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface Employee {
  id: number;
  name: string;
  description: string | null;
  target: number;
  currentTargetAccumulation: number;
  imagePath: string | null;
}

const EMP_CACHE_KEY = "bs_employees_cache_v2";
const EMP_CACHE_TTL = 20 * 60 * 1000;

const [employees, setEmployees] = createSignal<Employee[]>([]);
const [selectedEmployeeId, setSelectedEmployeeId] = createSignal<number | null>(null);

export function selectEmployee(id: number | null) {
  setSelectedEmployeeId(id);
}

export function selectedEmployeeName(): string | null {
  const id = selectedEmployeeId();
  if (id === null) return null;
  return employees().find((e) => e.id === id)?.name ?? null;
}

export function selectedEmployee(): Employee | null {
  const id = selectedEmployeeId();
  if (id === null) return null;
  return employees().find((e) => e.id === id) ?? null;
}

export { selectedEmployeeId };

export async function loadEmployees(locationId?: number | null) {
  const cacheKey = `${EMP_CACHE_KEY}_${locationId ?? "all"}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { ts, items } = JSON.parse(cached);
      if (Date.now() - ts < EMP_CACHE_TTL) { setEmployees(items); return; }
    }
  } catch {}
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/employees?limit=200&sort=name${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    const items = data.items.map((e: any) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      target: parseFloat(e.target),
      currentTargetAccumulation: parseFloat(e.current_target_accumulation),
      imagePath: e.image_path ?? null,
    }));
    setEmployees(items);
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export { employees };
