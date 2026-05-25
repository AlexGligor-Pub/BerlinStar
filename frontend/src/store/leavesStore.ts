import { createSignal } from "solid-js";
import { apiFetch, apiFetchJson } from "../utils/api";

export type LeaveType = "Concediu de odihna" | "Concediu medical" | "Business Trip" | "Concediu fara plata";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface Leave {
  id: number;
  accountId: number;
  employeeId: number;
  employeeName: string | null;
  employeeImagePath: string | null;
  locationId: number | null;
  locationName: string | null;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  workingDays: number;
  notes: string | null;
  approvedBy: number | null;
  approverName: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isDeleted: boolean;
}

export interface LeaveInput {
  employeeId: number;
  locationId?: number | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  notes?: string | null;
}

export interface LeaveTypeBreakdown {
  type: LeaveType;
  used_days: number;
  pending_days: number;
}

export interface LeaveBalance {
  employee_id: number;
  employee_name: string;
  year: number;
  annual_allowance: number;
  used_vacation_days: number;
  pending_vacation_days: number;
  remaining_vacation_days: number;
  breakdown: LeaveTypeBreakdown[];
}

export interface RomanianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

interface RawLeave {
  id: number;
  account_id: number;
  employee_id: number;
  employee_name?: string | null;
  employee_image_path?: string | null;
  location_id: number | null;
  location_name?: string | null;
  type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  working_days: number;
  notes: string | null;
  approved_by: number | null;
  approver_name?: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
}

function mapLeave(r: RawLeave): Leave {
  return {
    id: r.id,
    accountId: r.account_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name ?? null,
    employeeImagePath: r.employee_image_path ?? null,
    locationId: r.location_id,
    locationName: r.location_name ?? null,
    type: r.type,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    workingDays: r.working_days,
    notes: r.notes,
    approvedBy: r.approved_by,
    approverName: r.approver_name ?? null,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isDeleted: r.is_deleted,
  };
}

const [leaves, setLeaves] = createSignal<Leave[]>([]);
const [loading, setLoading] = createSignal(false);
const [holidaysByYear, setHolidaysByYear] = createSignal<Record<number, RomanianHoliday[]>>({});

export { leaves, loading, holidaysByYear };

export interface LeaveFilters {
  locationId?: number | null;
  employeeId?: number | null;
  type?: LeaveType | null;
  status?: LeaveStatus | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  q?: string | null;
}

export async function loadLeaves(filters: LeaveFilters = {}): Promise<void> {
  setLoading(true);
  try {
    const parts: string[] = [];
    if (filters.locationId != null) parts.push(`location_id=${filters.locationId}`);
    if (filters.employeeId != null) parts.push(`employee_id=${filters.employeeId}`);
    if (filters.type)               parts.push(`type=${encodeURIComponent(filters.type)}`);
    if (filters.status)             parts.push(`status=${encodeURIComponent(filters.status)}`);
    if (filters.dateFrom)           parts.push(`date_from=${filters.dateFrom}`);
    if (filters.dateTo)             parts.push(`date_to=${filters.dateTo}`);
    if (filters.q)                  parts.push(`q=${encodeURIComponent(filters.q)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const res = await apiFetch(`/api/leaves${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as RawLeave[];
    setLeaves(data.map(mapLeave));
  } catch {
    // keep previous
  } finally {
    setLoading(false);
  }
}

export async function fetchLeavesInRange(dateFrom: string, dateTo: string): Promise<Leave[]> {
  try {
    const res = await apiFetch(`/api/leaves?date_from=${dateFrom}&date_to=${dateTo}`);
    if (!res.ok) return [];
    const data = (await res.json()) as RawLeave[];
    return data.map(mapLeave);
  } catch {
    return [];
  }
}

export async function loadHolidays(year: number): Promise<RomanianHoliday[]> {
  const cached = holidaysByYear()[year];
  if (cached) return cached;
  try {
    const data = await apiFetchJson<RomanianHoliday[]>(`/api/leaves/holidays?year=${year}`);
    setHolidaysByYear({ ...holidaysByYear(), [year]: data });
    return data;
  } catch {
    return [];
  }
}

export async function loadBalance(employeeId: number, year: number): Promise<LeaveBalance | null> {
  try {
    return await apiFetchJson<LeaveBalance>(`/api/leaves/balance/${employeeId}?year=${year}`);
  } catch {
    return null;
  }
}

function inputToBody(input: LeaveInput): Record<string, unknown> {
  return {
    employee_id: input.employeeId,
    location_id: input.locationId ?? null,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    notes: input.notes ?? null,
  };
}

export async function createLeave(input: LeaveInput): Promise<Leave> {
  const res = await apiFetch("/api/leaves", { method: "POST", body: JSON.stringify(inputToBody(input)) });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  const created = mapLeave(await res.json());
  setLeaves([created, ...leaves()]);
  return created;
}

export async function updateLeave(id: number, input: Partial<LeaveInput>): Promise<Leave> {
  const body: Record<string, unknown> = {};
  if (input.type        !== undefined) body.type = input.type;
  if (input.locationId  !== undefined) body.location_id = input.locationId;
  if (input.startDate   !== undefined) body.start_date = input.startDate;
  if (input.endDate     !== undefined) body.end_date = input.endDate;
  if (input.notes       !== undefined) body.notes = input.notes;
  const res = await apiFetch(`/api/leaves/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  const updated = mapLeave(await res.json());
  setLeaves(leaves().map((l) => l.id === id ? updated : l));
  return updated;
}

export async function deleteLeave(id: number): Promise<void> {
  const res = await apiFetch(`/api/leaves/${id}`, { method: "DELETE" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  setLeaves(leaves().filter((l) => l.id !== id));
}

async function approvalAction(id: number, action: "approve" | "reject" | "reset"): Promise<Leave> {
  const res = await apiFetch(`/api/leaves/${id}/${action}`, { method: "POST" });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  const updated = mapLeave(await res.json());
  setLeaves(leaves().map((l) => l.id === id ? updated : l));
  return updated;
}

export const approveLeave = (id: number) => approvalAction(id, "approve");
export const rejectLeave  = (id: number) => approvalAction(id, "reject");
export const resetLeave   = (id: number) => approvalAction(id, "reset");

// Calcul zile lucratoare in frontend (preview live in modal), refoloseste holidays-urile cache-uite.
export function computeWorkingDays(startYMD: string, endYMD: string): number {
  if (!startYMD || !endYMD) return 0;
  const start = new Date(startYMD + "T12:00:00");
  const end = new Date(endYMD + "T12:00:00");
  if (end < start) return 0;
  const allHolidays = new Set<string>();
  for (const items of Object.values(holidaysByYear())) {
    for (const h of items) allHolidays.add(h.date);
  }
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
    if (dow !== 0 && dow !== 6 && !allHolidays.has(ymd)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
