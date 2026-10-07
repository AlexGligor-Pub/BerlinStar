import { createSignal } from "solid-js";
import { apiFetch, readApiError } from "../utils/api";

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
  employeeId: number | null;
  employeeName: string | null;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
  status: ProgramareStatus;
  createdAt: string;
  updatedAt: string | null;
  isDeleted: boolean;
  // Programari online (site public / asistent AI). `intern` = introdusa aici.
  source: "intern" | "web" | "mcp";
  publicRef: string | null;
  contactNume: string | null;
  contactTelefon: string | null;
  vehicul: string | null;
}

export interface ProgramareInput {
  titlu: string;
  notite?: string | null;
  clientId?: number | null;
  locationId: number;
  departmentId?: number | null;
  employeeId?: number | null;
  startTime: string;
  endTime: string;
  status?: ProgramareStatus;
}

interface RawProgramare {
  id: number | string;
  account_id: number;
  titlu: string;
  notite?: string | null;
  client_id?: number | null;
  client_nume?: string | null;
  location_id: number;
  department_id?: number | null;
  department_name?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  is_deleted?: boolean;
  source?: string;
  public_ref?: string | null;
  contact_nume?: string | null;
  contact_telefon?: string | null;
  vehicul_marca?: string | null;
  vehicul_model?: string | null;
  vehicul_an?: number | null;
}

function mapFromApi(r: RawProgramare): Programare {
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
    employeeId: r.employee_id ?? null,
    employeeName: r.employee_name ?? null,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status as ProgramareStatus, // server enum mirrored by ProgramareStatus union
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? null,
    isDeleted: r.is_deleted ?? false,
    source: r.source === "web" || r.source === "mcp" ? r.source : "intern",
    publicRef: r.public_ref ?? null,
    contactNume: r.contact_nume ?? null,
    contactTelefon: r.contact_telefon ?? null,
    vehicul: [r.vehicul_marca, r.vehicul_model, r.vehicul_an].filter(Boolean).join(" ") || null,
  };
}

const [programari, setProgramari] = createSignal<Programare[]>([]);
const [loading, setLoading] = createSignal(false);

export { programari, loading };

export interface ProgramariQuery {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  departmentId?: number | null;
  employeeId?: number | null;
  status?: string;
}

export async function loadProgramari(locationId: number, opts: ProgramariQuery = {}): Promise<void> {
  setLoading(true);
  try {
    let qs = `/api/programari?location_id=${locationId}`;
    if (opts.dateFrom) qs += `&date_from=${encodeURIComponent(opts.dateFrom)}`;
    if (opts.dateTo) qs += `&date_to=${encodeURIComponent(opts.dateTo)}`;
    if (opts.q) qs += `&q=${encodeURIComponent(opts.q)}`;
    if (opts.departmentId != null) qs += `&department_id=${opts.departmentId}`;
    if (opts.employeeId != null) qs += `&employee_id=${opts.employeeId}`;
    if (opts.status) qs += `&status=${encodeURIComponent(opts.status)}`;
    const res = await apiFetch(qs);
    if (!res.ok) return;
    const data = (await res.json()) as RawProgramare[];
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
    employee_id: input.employeeId ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    status: input.status ?? "Programat",
  };
  const res = await apiFetch("/api/programari", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `Eroare ${res.status}`));
  }
  const created = mapFromApi(await res.json());
  setProgramari([created, ...programari()]);
  return created;
}

export async function updateProgramare(id: string, input: Partial<ProgramareInput> & { status?: ProgramareStatus }): Promise<Programare> {
  const body: Record<string, unknown> = {};
  if (input.titlu !== undefined) body.titlu = input.titlu;
  if (input.notite !== undefined) body.notite = input.notite;
  if (input.clientId !== undefined) body.client_id = input.clientId;
  if (input.departmentId !== undefined) body.department_id = input.departmentId;
  if (input.employeeId !== undefined) body.employee_id = input.employeeId;
  if (input.startTime !== undefined) body.start_time = input.startTime;
  if (input.endTime !== undefined) body.end_time = input.endTime;
  if (input.status !== undefined) body.status = input.status;

  const res = await apiFetch(`/api/programari/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `Eroare ${res.status}`));
  }
  const updated = mapFromApi(await res.json());
  setProgramari(programari().map((p) => p.id === id ? updated : p));
  return updated;
}

export async function deleteProgramare(id: string): Promise<void> {
  const res = await apiFetch(`/api/programari/${id}`, { method: "DELETE" });
  // 404 = programarea e deja stearsa pe server; o scoatem si local.
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res, `Eroare ${res.status}`));
  }
  setProgramari(programari().filter((p) => p.id !== id));
}
