import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface Employee {
  id: number;
  name: string;
  description: string | null;
  target: number;
  currentTargetAccumulation: number;
}

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

export { selectedEmployeeId };

export async function loadEmployees() {
  try {
    const res = await apiFetch("/api/employees?limit=200&sort=name");
    if (!res.ok) return;
    const data = await res.json();
    setEmployees(data.items.map((e: any) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      target: parseFloat(e.target),
      currentTargetAccumulation: parseFloat(e.current_target_accumulation),
    })));
  } catch {}
}

export { employees };
