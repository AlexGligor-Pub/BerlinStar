import { createSignal } from "solid-js";
import { apiFetch, apiFetchJson } from "../utils/api";
import { reportsFetch } from "../pages/rapoarte/reports-auth";

export type LeaveType =
  | "Concediu de odihna"
  | "Concediu medical"
  | "Business Trip"
  | "Concediu fara plata"
  | "Invoire"
  | "Overtime"
  | "Recuperare Ore invoire";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

// Tipuri masurate in ore (single-day): interval orar + ore, fara zile lucratoare.
export const HOUR_BASED_TYPES: ReadonlySet<LeaveType> = new Set<LeaveType>([
  "Invoire",
  "Overtime",
  "Recuperare Ore invoire",
]);
export function isHourBased(type: LeaveType): boolean {
  return HOUR_BASED_TYPES.has(type);
}

export interface LeaveSnapshotEmployee {
  name: string | null;
  cnp: string | null;
  job_title: string | null;
  department: string | null;
  contract_number: string | null;
  contract_date: string | null;
  address_domicile: string | null;
  phone: string | null;
  personal_email: string | null;
}

export interface LeaveSnapshotCompany {
  name: string | null;
  cui: number | null;
  nr_reg_com: string | null;
  address: string | null;
}

export interface LeaveSnapshotVacation {
  annual_allowance: number;
  used_before_request: number;
  requested: number;
  remaining_after: number;
}

export interface LeaveDetailsSnapshot {
  employee: LeaveSnapshotEmployee;
  company: LeaveSnapshotCompany | null;
  vacation: LeaveSnapshotVacation;
  has_details: boolean;
}

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
  startTime: string | null; // HH:MM:SS (tipuri pe ore)
  endTime: string | null;   // HH:MM:SS
  hours: number | null;     // total ore (tipuri pe ore)
  notes: string | null;
  approvedBy: number | null;
  approverName: string | null;
  approvedAt: string | null;
  requestDate: string | null;
  employeeConsent: boolean;
  employeeConsentAt: string | null;
  approverConsent: boolean;
  approverNameSnapshot: string | null;
  // `detailsSnapshot` NU vine in lista (date legale protejate de gate-ul
  // Rapoarte) — se aduce la cerere prin fetchLeaveSnapshot().
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
  startTime?: string | null; // HH:MM (tipuri pe ore)
  endTime?: string | null;
  notes?: string | null;
  requestDate?: string | null;
  employeeConsent?: boolean;
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
  // Sold ore (Invoire / Overtime / Recuperare) — aprobate:
  overtime_hours: number;
  permission_hours: number;
  recovery_hours: number;
  permission_count: number;
  net_hours_balance: number; // overtime + recuperare - invoire
  // In asteptare (informativ):
  pending_overtime_hours: number;
  pending_permission_hours: number;
  pending_recovery_hours: number;
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
  start_time?: string | null;
  end_time?: string | null;
  hours?: number | string | null;
  notes: string | null;
  approved_by: number | null;
  approver_name?: string | null;
  approved_at: string | null;
  request_date?: string | null;
  employee_consent?: boolean;
  employee_consent_at?: string | null;
  approver_consent?: boolean;
  approver_name_snapshot?: string | null;
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
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    hours: r.hours == null ? null : Number(r.hours),
    notes: r.notes,
    approvedBy: r.approved_by,
    approverName: r.approver_name ?? null,
    approvedAt: r.approved_at,
    requestDate: r.request_date ?? null,
    employeeConsent: r.employee_consent ?? false,
    employeeConsentAt: r.employee_consent_at ?? null,
    approverConsent: r.approver_consent ?? false,
    approverNameSnapshot: r.approver_name_snapshot ?? null,
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
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    notes: input.notes ?? null,
    request_date: input.requestDate ?? null,
    employee_consent: input.employeeConsent ?? false,
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
  if (input.startTime   !== undefined) body.start_time = input.startTime;
  if (input.endTime     !== undefined) body.end_time = input.endTime;
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

async function approvalAction(
  id: number,
  action: "approve" | "reject" | "reset",
  body?: Record<string, unknown>,
): Promise<Leave> {
  const res = await apiFetch(`/api/leaves/${id}/${action}`, {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  const updated = mapLeave(await res.json());
  setLeaves(leaves().map((l) => l.id === id ? updated : l));
  return updated;
}

// Aprobarea necesita acordul digital al aprobatorului (validat si pe backend).
export const approveLeave = (id: number, approverConsent = true) =>
  approvalAction(id, "approve", { approver_consent: approverConsent });
export const rejectLeave  = (id: number) => approvalAction(id, "reject");
export const resetLeave   = (id: number) => approvalAction(id, "reset");

/** Snapshot-ul datelor legale ale cererii — protejat de gate-ul Rapoarte.
 *  Intoarce `null` daca lipseste sau daca nu exista token Rapoarte valid (401). */
export async function fetchLeaveSnapshot(id: number): Promise<LeaveDetailsSnapshot | null> {
  try {
    const res = await reportsFetch(`/api/leaves/${id}/snapshot`);
    if (!res.ok) return null;
    return (await res.json()) as LeaveDetailsSnapshot | null;
  } catch {
    return null;
  }
}

export async function consentLeave(id: number, employeeConsent: boolean): Promise<Leave> {
  const res = await apiFetch(`/api/leaves/${id}/consent`, {
    method: "POST",
    body: JSON.stringify({ employee_consent: employeeConsent }),
  });
  if (!res.ok) {
    let msg = `Eroare ${res.status}`;
    try { const j = await res.json() as { detail?: string }; msg = j.detail ?? msg; } catch { /* non-JSON */ }
    throw new Error(msg);
  }
  const updated = mapLeave(await res.json());
  setLeaves(leaves().map((l) => l.id === id ? updated : l));
  return updated;
}

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
