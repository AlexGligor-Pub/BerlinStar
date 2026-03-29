import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export type ProgramareStatus = "Programat" | "In lucru" | "Executat" | "Anulat";

export interface Programare {
  id: string;
  accountId: number;
  titlu: string;
  notite: string | null;
  clientId: number | null;
  clientNume: string | null;
  locationId: number;
  departmentId: number | null;
  departmentName: string | null;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
  status: ProgramareStatus;
  createdAt: string;
  updatedAt: string | null;
  isDeleted: boolean;
}

export interface ProgramareInput {
  titlu: string;
  notite?: string | null;
  clientId?: number | null;
  locationId: number;
  departmentId?: number | null;
  startTime: string;
  endTime: string;
  status?: ProgramareStatus;
}

function mapFromApi(r: any): Programare {
  return {
    id: String(r.id),
    accountId: r.account_id,
    titlu: r.titlu,
    notite: r.notite ?? null,
    clientId: r.client_id ?? null,
    clientNume: r.client_nume ?? null,
    locationId: r.location_id,
    departmentId: r.department_id ?? null,
    departmentName: r.department_name ?? null,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status as ProgramareStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    isDeleted: r.is_deleted ?? false,
  };
}

const [programari, setProgramari] = createSignal<Programare[]>([]);
const [loading, setLoading] = createSignal(false);

export { programari, loading };

export async function loadProgramari(
  locationId: number,
  dateFrom?: string,
  dateTo?: string,
  q?: string,
  departmentId?: number | null,
  status?: string,
): Promise<void> {
  setLoading(true);
  try {
    let qs = `/api/programari?location_id=${locationId}`;
    if (dateFrom) qs += `&date_from=${encodeURIComponent(dateFrom)}`;
    if (dateTo) qs += `&date_to=${encodeURIComponent(dateTo)}`;
    if (q) qs += `&q=${encodeURIComponent(q)}`;
    if (departmentId != null) qs += `&department_id=${departmentId}`;
    if (status) qs += `&status=${encodeURIComponent(status)}`;
    const res = await apiFetch(qs);
    if (!res.ok) return;
    const data: any[] = await res.json();
    setProgramari(data.map(mapFromApi));
  } catch {
    // keep existing
  } finally {
    setLoading(false);
  }
}

export async function createProgramare(input: ProgramareInput): Promise<Programare> {
  const body = {
    titlu: input.titlu,
    notite: input.notite ?? null,
    client_id: input.clientId ?? null,
    location_id: input.locationId,
    department_id: input.departmentId ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    status: input.status ?? "Programat",
  };
  const res = await apiFetch("/api/programari", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? msg; } catch {}
    throw new Error(msg);
  }
  const created = mapFromApi(await res.json());
  setProgramari([created, ...programari()]);
  return created;
}

export async function updateProgramare(id: string, input: Partial<ProgramareInput> & { status?: ProgramareStatus }): Promise<Programare> {
  const body: Record<string, any> = {};
  if (input.titlu !== undefined) body.titlu = input.titlu;
  if (input.notite !== undefined) body.notite = input.notite;
  if (input.clientId !== undefined) body.client_id = input.clientId;
  if (input.departmentId !== undefined) body.department_id = input.departmentId;
  if (input.startTime !== undefined) body.start_time = input.startTime;
  if (input.endTime !== undefined) body.end_time = input.endTime;
  if (input.status !== undefined) body.status = input.status;

  const res = await apiFetch(`/api/programari/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json(); msg = j.detail ?? msg; } catch {}
    throw new Error(msg);
  }
  const updated = mapFromApi(await res.json());
  setProgramari(programari().map((p) => p.id === id ? updated : p));
  return updated;
}

export async function deleteProgramare(id: string): Promise<void> {
  await apiFetch(`/api/programari/${id}`, { method: "DELETE" });
  setProgramari(programari().filter((p) => p.id !== id));
}
