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

interface RawEmployee {
  id: number;
  name: string;
  description?: string | null;
  target: string | number;
  current_target_accumulation: string | number;
  image_path?: string | null;
}

const EMP_CACHE_KEY = "bs_employees_cache_v2";
const EMP_CACHE_TTL = 20 * 60 * 1000;

const [employees, setEmployees] = createSignal<Employee[]>([]);
const [selectedEmployeeId, setSelectedEmployeeId] = createSignal<number | null>(null);

export function selectEmployee(id: number | null): void {
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

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v);
}

export async function loadEmployees(locationId?: number | null): Promise<void> {
  const cacheKey = `${EMP_CACHE_KEY}_${locationId ?? "all"}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; items: Employee[] };
      if (Date.now() - parsed.ts < EMP_CACHE_TTL) { setEmployees(parsed.items); return; }
    }
  } catch {
    // cache miss/corrupt — fall through to network
  }
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/employees?limit=200&sort=name${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: RawEmployee[] };
    const items: Employee[] = data.items.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      target: toNumber(e.target),
      currentTargetAccumulation: toNumber(e.current_target_accumulation),
      imagePath: e.image_path ?? null,
    }));
    setEmployees(items);
    try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items })); } catch {
      // storage quota/disabled — non-fatal, keep in-memory list
    }
  } catch {
    // network error — keep previous state; consumers see empty list
  }
}

export { employees };
