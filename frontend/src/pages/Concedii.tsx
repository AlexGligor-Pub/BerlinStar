import { For, Show, createMemo, createSignal, createEffect, onMount } from "solid-js";
import Modal from "../components/ui/Modal";
import { canManage } from "../store/permissions";
import { notify } from "../store/notificationsStore";
import { employees, loadEmployees, type Employee } from "../store/employeesStore";
import { apiFetch } from "../utils/api";
import type { Location } from "../types/location";
import {
  leaves, loading, loadLeaves, loadHolidays, loadBalance, holidaysByYear,
  fetchLeavesInRange, fetchLeaveSnapshot,
  createLeave, updateLeave, deleteLeave, approveLeave, rejectLeave, resetLeave,
  computeWorkingDays, isHourBased,
  type Leave, type LeaveType, type LeaveStatus, type LeaveBalance,
  type LeaveDetailsSnapshot, type RomanianHoliday,
} from "../store/leavesStore";
import { generateLeaveRequestPdf } from "../utils/leavePdf";

/** Dosar de personal (subset folosit pentru preview-ul cererii). */
interface EmployeeLegalDetails {
  has: boolean;
  cnp: string | null;
  job_title: string | null;
  department: string | null;
  contract_number: string | null;
  company_name: string | null;
}

const RO_MONTHS_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const RO_DAYS_SHORT  = ["Lu","Ma","Mi","Jo","Vi","Sâ","Du"];

const LEAVE_TYPES: { value: LeaveType; label: string; emoji: string; cls: string }[] = [
  { value: "Concediu de odihna",  label: "Odihnă",       emoji: "🏖", cls: "leave-type-vacation" },
  { value: "Concediu medical",    label: "Medical",       emoji: "🤒", cls: "leave-type-sick" },
  { value: "Business Trip",       label: "Business Trip", emoji: "✈️", cls: "leave-type-business" },
  { value: "Concediu fara plata", label: "Fără plată",    emoji: "📄", cls: "leave-type-unpaid" },
  { value: "Invoire",                label: "Învoire",     emoji: "🕐", cls: "leave-type-permission" },
  { value: "Overtime",               label: "Overtime",    emoji: "⏱", cls: "leave-type-overtime" },
  { value: "Recuperare Ore invoire", label: "Recuperare",  emoji: "↩", cls: "leave-type-recovery" },
];

/** Format ore zecimale: 2 -> „2h", 2.5 -> „2h 30m", -1.5 -> „-1h 30m". */
function fmtHours(h: number | null | undefined): string {
  if (h == null) return "—";
  const sign = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  const whole = Math.floor(abs);
  const mins = Math.round((abs - whole) * 60);
  return mins === 0 ? `${sign}${whole}h` : `${sign}${whole}h ${mins}m`;
}

/** Ore intre doua „HH:MM" (zecimal), 0 daca invalid. */
function hoursBetween(startHM: string, endHM: string): number {
  if (!startHM || !endHM) return 0;
  const [sh, sm] = startHM.split(":").map(Number);
  const [eh, em] = endHM.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

/** Normalizeaza „HH:MM:SS" sau „HH:MM" la „HH:MM" pentru <input type=time>. */
function toHM(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

const STATUS_LABELS: { value: LeaveStatus; label: string; cls: string }[] = [
  { value: "Approved", label: "Aprobate",  cls: "leave-status-approved" },
  { value: "Pending",  label: "În așteptare", cls: "leave-status-pending" },
  { value: "Rejected", label: "Respinse",  cls: "leave-status-rejected" },
];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtRo(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  return `${d.getDate()} ${RO_MONTHS_FULL[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

function typeMeta(type: LeaveType) {
  return LEAVE_TYPES.find((t) => t.value === type)!;
}

/** Tooltip pentru pill-urile din calendar (ore pentru tipuri pe ore, zile altfel). */
function leaveTooltip(l: Leave): string {
  if (isHourBased(l.type)) {
    return `${l.employeeName} — ${l.type}\n${fmtRo(l.startDate)} · ${toHM(l.startTime)}–${toHM(l.endTime)}\n${fmtHours(l.hours)}`;
  }
  return `${l.employeeName} — ${l.type}\n${fmtRo(l.startDate)} - ${fmtRo(l.endDate)}\n${l.workingDays} zile lucratoare`;
}

function Avatar(props: { name: string; imagePath: string | null; size?: number }) {
  const size = () => props.size ?? 28;
  const initial = () => props.name.charAt(0).toUpperCase();
  return (
    <div
      style={`width:${size()}px;height:${size()}px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--accent,#5b7cfa);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size() * 0.44)}px;font-weight:700`}
    >
      <Show when={props.imagePath} fallback={<span>{initial()}</span>}>
        <img src={props.imagePath!} alt={props.name} style="width:100%;height:100%;object-fit:cover" />
      </Show>
    </div>
  );
}

function OverlapView(props: {
  current: Leave;
  monthLeaves: Leave[];
  holidays: Record<number, RomanianHoliday[]>;
  month: { y: number; m: number };
  onShiftMonth: (delta: number) => void;
}) {
  const overlapping = createMemo(() => {
    const cur = props.current;
    return props.monthLeaves.filter((l) =>
      l.id !== cur.id &&
      !l.isDeleted &&
      l.startDate <= cur.endDate &&
      l.endDate   >= cur.startDate &&
      l.status !== "Rejected"
    );
  });

  function buildCells(y: number, m: number) {
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    type Cell = {
      day: number | null;
      date: string | null;
      isWeekend: boolean;
      isHoliday: boolean;
      others: Leave[];
      inCurrent: boolean;
    };
    const arr: Cell[] = [];
    const holidayDates = new Set<string>();
    for (const h of (props.holidays[y] ?? [])) holidayDates.add(h.date);
    const cur = props.current;
    for (let i = 0; i < firstDow; i++) arr.push({ day: null, date: null, isWeekend: false, isHoliday: false, others: [], inCurrent: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(y, m, d).getDay();
      const others = overlapping().filter((l) => ds >= l.startDate && ds <= l.endDate);
      const inCurrent = ds >= cur.startDate && ds <= cur.endDate;
      arr.push({
        day: d, date: ds,
        isWeekend: dow === 0 || dow === 6,
        isHoliday: holidayDates.has(ds),
        others, inCurrent,
      });
    }
    return arr;
  }

  return (
    <div class="concedii-overlap">
      <div class="concedii-overlap-header">
        <span class="concedii-overlap-title">🔍 Cine mai e în concediu</span>
        <div class="concedii-overlap-nav">
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => props.onShiftMonth(-1)} aria-label="Luna anterioara">‹</button>
          <span class="concedii-overlap-month-name">{RO_MONTHS_FULL[props.month.m]} {props.month.y}</span>
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => props.onShiftMonth(1)} aria-label="Luna urmatoare">›</button>
        </div>
      </div>
      <div class="concedii-overlap-month">
        <div class="concedii-overlap-dow">
          <For each={RO_DAYS_SHORT}>{(d) => <span>{d}</span>}</For>
        </div>
        <div class="concedii-overlap-grid">
          <For each={buildCells(props.month.y, props.month.m)}>
            {(c) => {
              if (!c.date) return <span />;
              return (
                <div
                  class="concedii-overlap-cell"
                  classList={{
                    "is-weekend": c.isWeekend,
                    "is-holiday": c.isHoliday,
                    "is-current": c.inCurrent,
                    "has-other": c.others.length > 0,
                  }}
                  title={c.others.length > 0
                    ? c.others.map((l) => `${l.employeeName ?? "?"} (${l.status === "Approved" ? "aprobat" : "pending"})`).join("\n")
                    : undefined}
                >
                  <span class="concedii-overlap-day">{c.day}</span>
                  <Show when={c.others.length > 0}>
                    <div class="concedii-overlap-avatars">
                      <For each={c.others.slice(0, 3)}>
                        {(l) => (
                          <Avatar name={l.employeeName ?? "?"} imagePath={l.employeeImagePath} size={20} />
                        )}
                      </For>
                      <Show when={c.others.length > 3}>
                        <span class="concedii-overlap-avatars-more">+{c.others.length - 3}</span>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <Show
        when={overlapping().length > 0}
        fallback={
          <div class="concedii-overlap-empty">
            ✓ Niciun alt angajat nu e în concediu în această perioadă.
          </div>
        }
      >
        <div class="concedii-overlap-list">
          <For each={overlapping()}>
            {(l) => {
              const t = typeMeta(l.type);
              return (
                <div class="concedii-overlap-item">
                  <Avatar name={l.employeeName ?? "?"} imagePath={l.employeeImagePath} size={28} />
                  <div style="flex:1;min-width:0">
                    <div class="concedii-overlap-item-name">{l.employeeName ?? "?"}</div>
                    <div class="concedii-overlap-item-meta">
                      {fmtRo(l.startDate)} – {fmtRo(l.endDate)} · {l.locationName ?? "—"}
                    </div>
                  </div>
                  <span class={`concedii-type-badge ${t.cls}`}>{t.emoji} {t.label}</span>
                  <span class={`concedii-status-badge status-${l.status.toLowerCase()}`}>
                    {l.status === "Approved" ? "Aprobată" : "Pending"}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

function MiniCalendarPicker(props: {
  value: string;
  onChange: (ymd: string) => void;
  minDate?: string;
}) {
  const init = new Date(props.value + "T12:00:00");
  const [vY, setVY] = createSignal(init.getFullYear());
  const [vM, setVM] = createSignal(init.getMonth());

  function prev() {
    if (vM() === 0) { setVY((y) => y - 1); setVM(11); } else setVM((m) => m - 1);
  }
  function next() {
    if (vM() === 11) { setVY((y) => y + 1); setVM(0); } else setVM((m) => m + 1);
  }

  const cells = createMemo(() => {
    const y = vY(), m = vM();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const arr: Array<{ day: number | null; date: string | null }> = [];
    for (let i = 0; i < firstDow; i++) arr.push({ day: null, date: null });
    for (let d = 1; d <= days; d++) arr.push({ day: d, date: `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    return arr;
  });

  return (
    <div class="mini-cal">
      <div class="mini-cal-header">
        <button type="button" class="mini-cal-nav" onClick={prev} aria-label="Luna anterioară">‹</button>
        <span class="mini-cal-title">{RO_MONTHS_FULL[vM()]} {vY()}</span>
        <button type="button" class="mini-cal-nav" onClick={next} aria-label="Luna următoare">›</button>
      </div>
      <div class="mini-cal-grid">
        <For each={RO_DAYS_SHORT}>{(d) => <span class="mini-cal-dow">{d}</span>}</For>
        <For each={cells()}>
          {(cell) => {
            if (!cell.date) return <span />;
            const disabled = () => props.minDate !== undefined && cell.date! < props.minDate;
            return (
              <button
                type="button"
                class="mini-cal-day"
                classList={{
                  "mini-cal-day--selected": cell.date === props.value,
                  "mini-cal-day--disabled": disabled(),
                }}
                disabled={disabled()}
                onClick={() => props.onChange(cell.date!)}
              >{cell.day}</button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

interface FormState {
  id: number | null;
  employeeId: number | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  startTime: string; // HH:MM (tipuri pe ore)
  endTime: string;   // HH:MM
  notes: string;
  employeeConsent: boolean;
}

function emptyForm(today: string): FormState {
  return {
    id: null, employeeId: null, type: "Concediu de odihna",
    startDate: today, endDate: today, startTime: "09:00", endTime: "17:00",
    notes: "", employeeConsent: false,
  };
}

export default function Concedii() {
  const today = new Date();
  const todayYMD = toYMD(today);

  // ── View state ──────────────────────────────────────────────────────────────
  const [viewYear, setViewYear]   = createSignal(today.getFullYear());
  const [viewMonth, setViewMonth] = createSignal(today.getMonth());
  const [mode, setMode] = createSignal<"calendar" | "list">("calendar");

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [selectedTypes, setSelectedTypes]     = createSignal<Set<LeaveType>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = createSignal<Set<LeaveStatus>>(new Set());
  const [selectedLocationIds, setSelectedLocationIds] = createSignal<Set<number>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = createSignal<number | null>(null);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [locationsList, setLocationsList] = createSignal<Location[]>([]);
  const [balances, setBalances] = createSignal<LeaveBalance[]>([]);
  const [showSidePanel, setShowSidePanel] = createSignal(true);

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = createSignal(false);
  const [form, setForm] = createSignal<FormState>(emptyForm(todayYMD));
  const [submitting, setSubmitting] = createSignal(false);
  const [formDetails, setFormDetails] = createSignal<EmployeeLegalDetails | null>(null);
  const [approverConsent, setApproverConsent] = createSignal(false);
  const [detailSnapshot, setDetailSnapshot] = createSignal<LeaveDetailsSnapshot | null>(null);
  const [detailLeave, setDetailLeave] = createSignal<Leave | null>(null);
  const [detailMonthLeaves, setDetailMonthLeaves] = createSignal<Leave[]>([]);
  const [overlapMonth, setOverlapMonth] = createSignal<{ y: number; m: number } | null>(null);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [deleteTarget, setDeleteTarget] = createSignal<Leave | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  // ── Derived ─────────────────────────────────────────────────────────────────
  function monthRangeYMD(y: number, m: number): { from: string; to: string } {
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    return { from, to };
  }

  // ── Loaders ────────────────────────────────────────────────────────────────
  async function loadLocations() {
    try {
      const res = await apiFetch("/api/locations?limit=200");
      if (!res.ok) return;
      const json = await res.json() as { items: Location[] };
      setLocationsList(json.items ?? []);
    } catch { /* ignore */ }
  }

  async function reloadLeaves() {
    const { from, to } = monthRangeYMD(viewYear(), viewMonth());
    // Single-pick filters (first one chosen, since API supports single type/status)
    const typeArr = Array.from(selectedTypes());
    const statusArr = Array.from(selectedStatuses());
    const locArr = Array.from(selectedLocationIds());
    await loadLeaves({
      dateFrom: from,
      dateTo:   to,
      type:     typeArr.length === 1 ? typeArr[0] : null,
      status:   statusArr.length === 1 ? statusArr[0] : null,
      locationId: locArr.length === 1 ? locArr[0] : null,
      employeeId: selectedEmployeeId(),
    });
  }

  async function reloadPendingCount() {
    try {
      const res = await apiFetch("/api/leaves?status=Pending");
      if (!res.ok) return;
      const data = (await res.json()) as unknown[];
      setPendingCount(data.length);
    } catch { /* ignore */ }
  }

  async function reloadBalances() {
    const list = employees();
    if (!list.length) { setBalances([]); return; }
    const year = viewYear();
    const results = await Promise.all(
      list.map((e) => loadBalance(e.id, year)),
    );
    setBalances(results.filter((r): r is LeaveBalance => r !== null));
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  onMount(() => {
    void loadLocations();
    void loadHolidays(viewYear());
    void reloadPendingCount();
  });

  // Reload employees when location filter changes (single-location filter is honored;
  // for multi-select sau "toate" se incarca toti angajatii).
  createEffect(() => {
    const locs = selectedLocationIds();
    if (locs.size === 1) {
      void loadEmployees(Array.from(locs)[0], { force: true });
    } else {
      void loadEmployees(null, { force: true });
    }
  });

  // Reload leaves whenever month or filters change
  createEffect(() => {
    viewYear(); viewMonth();
    selectedTypes(); selectedStatuses(); selectedLocationIds(); selectedEmployeeId();
    void reloadLeaves();
  });

  // Reload holidays when year changes
  createEffect(() => {
    void loadHolidays(viewYear());
  });

  // Reload balances when employees change or year changes
  createEffect(() => {
    employees(); viewYear();
    void reloadBalances();
  });

  // When detail modal opens, initialize overlap month to leave's start month.
  createEffect(() => {
    const l = detailLeave();
    if (!l) { setOverlapMonth(null); setDetailMonthLeaves([]); return; }
    const start = new Date(l.startDate + "T12:00:00");
    setOverlapMonth({ y: start.getFullYear(), m: start.getMonth() });
  });

  // Fetch leaves for the currently viewed overlap month.
  createEffect(() => {
    const mm = overlapMonth();
    if (!mm) return;
    const monthStart = `${mm.y}-${String(mm.m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(mm.y, mm.m + 1, 0).getDate();
    const monthEnd = `${mm.y}-${String(mm.m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    void loadHolidays(mm.y);
    void fetchLeavesInRange(monthStart, monthEnd).then(setDetailMonthLeaves);
  });

  // Incarca datele legale ale angajatului selectat in formular (preview + verificare dosar).
  createEffect(() => {
    const id = form().employeeId;
    if (id == null) { setFormDetails(null); return; }
    void (async () => {
      try {
        // Dosarul de personal e permis doar rolurilor admin/manager (server-side).
        const res = await apiFetch(`/api/employees/${id}/details`);
        // Fara acces Rapoarte (401) nu putem sti daca exista dosar — nu afisam
        // avertismentul "fara dosar" (ar fi inselator), doar ascundem preview-ul.
        if (res.status === 401) { setFormDetails(null); return; }
        if (!res.ok) { setFormDetails({ has: false, cnp: null, job_title: null, department: null, contract_number: null, company_name: null }); return; }
        const d = await res.json();
        if (!d) { setFormDetails({ has: false, cnp: null, job_title: null, department: null, contract_number: null, company_name: null }); return; }
        let companyName: string | null = null;
        if (d.company_id != null) {
          try {
            const cr = await apiFetch("/api/companies?limit=200");
            if (cr.ok) {
              const cj = await cr.json();
              companyName = (cj.items ?? []).find((c: any) => c.id === d.company_id)?.name ?? null;
            }
          } catch { /* ignore */ }
        }
        setFormDetails({
          has: true,
          cnp: d.cnp ?? null,
          job_title: d.job_title ?? null,
          department: d.department ?? null,
          contract_number: d.contract_number ?? null,
          company_name: companyName,
        });
      } catch {
        setFormDetails(null);
      }
    })();
  });

  // Reset acord aprobator + (re)incarca snapshot-ul legal cand se schimba
  // cererea afisata in modal. Snapshot-ul e protejat de gate-ul Rapoarte;
  // fara token valid ramane null (sectiunea nu se afiseaza).
  createEffect(() => {
    const l = detailLeave();
    setApproverConsent(false);
    setDetailSnapshot(null);
    if (l == null) return;
    void fetchLeaveSnapshot(l.id).then((snap) => {
      if (detailLeave()?.id === l.id) setDetailSnapshot(snap);
    });
  });

  function shiftOverlapMonth(delta: number) {
    const mm = overlapMonth();
    if (!mm) return;
    const d = new Date(mm.y, mm.m + delta, 1);
    setOverlapMonth({ y: d.getFullYear(), m: d.getMonth() });
  }

  // ── Multi-select filter helpers ─────────────────────────────────────────────
  function toggleType(t: LeaveType) {
    const s = new Set(selectedTypes());
    s.has(t) ? s.delete(t) : s.add(t);
    setSelectedTypes(s);
  }
  function toggleStatus(s: LeaveStatus) {
    const set = new Set(selectedStatuses());
    set.has(s) ? set.delete(s) : set.add(s);
    setSelectedStatuses(set);
  }
  function toggleLocation(id: number) {
    const set = new Set(selectedLocationIds());
    set.has(id) ? set.delete(id) : set.add(id);
    setSelectedLocationIds(set);
  }

  // ── Client-side filter (when multiple filters or fallback) ──────────────────
  const filteredLeaves = createMemo<Leave[]>(() => {
    const types = selectedTypes();
    const statuses = selectedStatuses();
    const locs = selectedLocationIds();
    return leaves().filter((l) => {
      if (types.size > 0 && !types.has(l.type)) return false;
      if (statuses.size > 0 && !statuses.has(l.status)) return false;
      if (locs.size > 0 && (l.locationId == null || !locs.has(l.locationId))) return false;
      if (selectedEmployeeId() != null && l.employeeId !== selectedEmployeeId()) return false;
      return true;
    });
  });

  // Lista cererilor cu pending primele, apoi restul dupa data inceperii.
  const sortedListLeaves = createMemo<Leave[]>(() => {
    const statusRank: Record<LeaveStatus, number> = { Pending: 0, Approved: 1, Rejected: 2 };
    return [...filteredLeaves()].sort((a, b) => {
      const r = statusRank[a.status] - statusRank[b.status];
      if (r !== 0) return r;
      return b.startDate.localeCompare(a.startDate);
    });
  });

  // ── Calendar grid build ────────────────────────────────────────────────────
  interface DayCell {
    date: string | null;
    day: number | null;
    inCurrent: boolean;
    isToday: boolean;
    isWeekend: boolean;
    holidayName: string | null;
    pills: Leave[];
  }

  const calendarCells = createMemo<DayCell[]>(() => {
    const y = viewYear();
    const m = viewMonth();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    const cells: DayCell[] = [];
    const holidayMap = new Map<string, string>();
    for (const h of (holidaysByYear()[y] ?? [])) holidayMap.set(h.date, h.name);
    // also next/prev year overlap (calendar may show days from adjacent months/years)
    for (const yy of [y - 1, y + 1]) {
      for (const h of (holidaysByYear()[yy] ?? [])) holidayMap.set(h.date, h.name);
    }

    function pillsFor(dateStr: string): Leave[] {
      return filteredLeaves().filter((l) => dateStr >= l.startDate && dateStr <= l.endDate);
    }

    // Previous month overflow
    for (let i = 0; i < firstDow; i++) {
      const day = prevMonthDays - firstDow + 1 + i;
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const ds = `${py}-${String(pm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow = new Date(py, pm, day).getDay();
      cells.push({
        date: ds, day, inCurrent: false,
        isToday: ds === todayYMD,
        isWeekend: dow === 0 || dow === 6,
        holidayName: holidayMap.get(ds) ?? null,
        pills: pillsFor(ds),
      });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(y, m, d).getDay();
      cells.push({
        date: ds, day: d, inCurrent: true,
        isToday: ds === todayYMD,
        isWeekend: dow === 0 || dow === 6,
        holidayName: holidayMap.get(ds) ?? null,
        pills: pillsFor(ds),
      });
    }
    // Next month fill to 42 cells (6 rows)
    while (cells.length < 42) {
      const idx = cells.length - firstDow - daysInMonth + 1;
      const nm = m === 11 ? 0 : m + 1;
      const ny = m === 11 ? y + 1 : y;
      const ds = `${ny}-${String(nm+1).padStart(2,'0')}-${String(idx).padStart(2,'0')}`;
      const dow = new Date(ny, nm, idx).getDay();
      cells.push({
        date: ds, day: idx, inCurrent: false,
        isToday: ds === todayYMD,
        isWeekend: dow === 0 || dow === 6,
        holidayName: holidayMap.get(ds) ?? null,
        pills: pillsFor(ds),
      });
    }
    return cells;
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth() === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth() === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  // ── Form actions ────────────────────────────────────────────────────────────
  function openCreateForm(startYMD?: string) {
    setForm({ ...emptyForm(startYMD ?? todayYMD), endDate: startYMD ?? todayYMD });
    setShowForm(true);
  }
  function openEditForm(l: Leave) {
    setForm({
      id: l.id, employeeId: l.employeeId, type: l.type,
      startDate: l.startDate, endDate: l.endDate,
      startTime: toHM(l.startTime) || "09:00",
      endTime: toHM(l.endTime) || "17:00",
      notes: l.notes ?? "",
      employeeConsent: l.employeeConsent,
    });
    setDetailLeave(null);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setSubmitting(false);
  }
  function selectedEmployee(): Employee | null {
    const id = form().employeeId;
    if (id == null) return null;
    return employees().find((e) => e.id === id) ?? null;
  }
  function balanceFor(employeeId: number | null): LeaveBalance | null {
    if (employeeId == null) return null;
    return balances().find((b) => b.employee_id === employeeId) ?? null;
  }

  async function submitForm(e: Event) {
    e.preventDefault();
    if (submitting()) return;
    const f = form();
    if (f.employeeId == null) { notify("Selecteaza un angajat.", "warn"); return; }
    const hourBased = isHourBased(f.type);

    if (hourBased) {
      if (hoursBetween(f.startTime, f.endTime) <= 0) {
        notify("Ora de sfârșit trebuie să fie după ora de început.", "warn");
        return;
      }
    } else {
      if (f.endDate < f.startDate) { notify("Data de sfarsit trebuie sa fie dupa data de inceput.", "warn"); return; }
      const vb = vacationBalanceInfo();
      if (vb && vb.over) {
        notify(`Numarul de zile (${vb.requested}) depaseste soldul disponibil (${vb.available}).`, "warn");
        return;
      }
      if (f.id == null && !f.employeeConsent) {
        notify("Bifează acordul angajatului pentru a trimite cererea.", "warn");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (f.id == null) {
        await createLeave({
          employeeId: f.employeeId, type: f.type,
          startDate: f.startDate, endDate: hourBased ? f.startDate : f.endDate,
          startTime: hourBased ? f.startTime : null,
          endTime: hourBased ? f.endTime : null,
          notes: f.notes || null,
          employeeConsent: hourBased ? false : f.employeeConsent,
        });
        notify("Cerere creata cu succes.", "success");
      } else {
        await updateLeave(f.id, {
          type: f.type,
          startDate: f.startDate, endDate: hourBased ? f.startDate : f.endDate,
          startTime: hourBased ? f.startTime : null,
          endTime: hourBased ? f.endTime : null,
          notes: f.notes || null,
        });
        notify("Cerere actualizata.", "success");
      }
      closeForm();
      await reloadLeaves();
      await reloadBalances();
      await reloadPendingCount();
    } catch (err) {
      notify((err as Error).message || "Eroare la salvare.", "error");
      setSubmitting(false);
    }
  }

  function handleDelete(l: Leave) {
    setDeleteTarget(l);
  }
  async function confirmDelete() {
    const l = deleteTarget();
    if (!l || deleting()) return;
    setDeleting(true);
    try {
      await deleteLeave(l.id);
      notify("Cerere stearsa.", "success");
      setDeleteTarget(null);
      setDetailLeave(null);
      await reloadBalances();
      await reloadPendingCount();
    } catch (err) {
      notify((err as Error).message || "Eroare la stergere.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleApprove(l: Leave) {
    const hourBased = isHourBased(l.type);
    if (!hourBased && !approverConsent()) {
      notify("Bifează acordul de aprobare pentru a aproba cererea.", "warn");
      return;
    }
    try {
      const updated = await approveLeave(l.id, hourBased ? true : approverConsent());
      notify("Cerere aprobata.", "success");
      setDetailLeave(updated);
      await reloadBalances();
      await reloadPendingCount();
    } catch (err) {
      notify((err as Error).message || "Eroare la aprobare.", "error");
    }
  }
  async function handleReject(l: Leave) {
    try {
      const updated = await rejectLeave(l.id);
      notify("Cerere respinsa.", "info");
      setDetailLeave(updated);
      await reloadBalances();
      await reloadPendingCount();
    } catch (err) {
      notify((err as Error).message || "Eroare la respingere.", "error");
    }
  }
  async function handleReset(l: Leave) {
    try {
      const updated = await resetLeave(l.id);
      notify("Cerere readusa in asteptare.", "info");
      setDetailLeave(updated);
      await reloadBalances();
      await reloadPendingCount();
    } catch (err) {
      notify((err as Error).message || "Eroare la resetare.", "error");
    }
  }

  // Preview live for working days in form
  const formWorkingDays = createMemo(() => computeWorkingDays(form().startDate, form().endDate));
  // Preview live ore (tipuri pe ore)
  const formIsHourBased = createMemo(() => isHourBased(form().type));
  const formHours = createMemo(() => hoursBetween(form().startTime, form().endTime));

  // Vacation balance check — only for type VACATION, compared against employee's annual cota.
  const vacationBalanceInfo = createMemo<{ over: boolean; available: number; requested: number } | null>(() => {
    const f = form();
    if (f.type !== "Concediu de odihna") return null;
    const b = balanceFor(f.employeeId);
    if (!b) return null;
    // Disponibil = annual - used (approved) - pending. Daca editez o cerere VACATION existenta,
    // zilele ei sunt deja in used/pending => le adaug inapoi la disponibil.
    let available = b.annual_allowance - b.used_vacation_days - b.pending_vacation_days;
    if (f.id != null) {
      const original = leaves().find((l) => l.id === f.id);
      if (original && original.type === "Concediu de odihna") {
        available += original.workingDays;
      }
    }
    const requested = formWorkingDays();
    return { over: requested > available, available: Math.max(0, available), requested };
  });

  return (
    <div class="page-content concedii-page">
      {/* TOOLBAR */}
      <div class="concedii-toolbar">
        <div class="concedii-toolbar-row">
          <div class="concedii-toolbar-actions">
            <div class="concedii-mode-toggle" role="tablist">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                classList={{ "is-active": mode() === "calendar" }}
                onClick={() => setMode("calendar")}
              >Calendar</button>
              <button
                type="button"
                class="btn btn-ghost btn-sm concedii-pending-btn"
                classList={{ "is-active": mode() === "list" }}
                onClick={() => setMode("list")}
                title="Vezi toate cererile, cu cele in asteptare primele"
              >
                Lista cereri
                <Show when={pendingCount() > 0}>
                  <span class="concedii-pending-badge">{pendingCount()}</span>
                </Show>
              </button>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onClick={() => openCreateForm()}>+ Cerere nouă</button>
          </div>
        </div>

        <div class="concedii-filters">
          <div class="concedii-filter-group">
            <span class="concedii-filter-label">Tip:</span>
            <For each={LEAVE_TYPES}>
              {(t) => (
                <button
                  type="button"
                  class="concedii-chip"
                  classList={{ "is-active": selectedTypes().has(t.value) }}
                  onClick={() => toggleType(t.value)}
                ><span class={`concedii-chip-dot ${t.cls}`} /> {t.emoji} {t.label}</button>
              )}
            </For>
          </div>
          <div class="concedii-filter-group">
            <span class="concedii-filter-label">Status:</span>
            <For each={STATUS_LABELS}>
              {(s) => (
                <button
                  type="button"
                  class="concedii-chip"
                  classList={{ "is-active": selectedStatuses().has(s.value), [s.cls]: true }}
                  onClick={() => toggleStatus(s.value)}
                >{s.label}</button>
              )}
            </For>
          </div>
          <div class="concedii-filter-group">
            <span class="concedii-filter-label">Locație:</span>
            <button
              type="button"
              class="concedii-chip"
              classList={{ "is-active": selectedLocationIds().size === 0 }}
              onClick={() => setSelectedLocationIds(new Set())}
            >Toate</button>
            <For each={locationsList()}>
              {(loc) => (
                <button
                  type="button"
                  class="concedii-chip"
                  classList={{ "is-active": selectedLocationIds().has(loc.id) }}
                  onClick={() => toggleLocation(loc.id)}
                >{loc.name}</button>
              )}
            </For>
          </div>
          <Show when={selectedEmployeeId() !== null}>
            <div class="concedii-filter-group">
              <span class="concedii-filter-label">Angajat:</span>
              <button
                type="button"
                class="concedii-chip is-active"
                onClick={() => setSelectedEmployeeId(null)}
              >
                {employees().find((e) => e.id === selectedEmployeeId())?.name ?? "?"} ✕
              </button>
            </div>
          </Show>
        </div>
      </div>

      <div class="concedii-layout">
        {/* MAIN */}
        <div class="concedii-main">
          <Show when={loading()}>
            <div class="concedii-loading">Se incarca…</div>
          </Show>

          <Show when={mode() === "calendar"}>
            <div class="concedii-cal">
              <div class="concedii-month-nav concedii-cal-monthbar">
                <button type="button" class="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Luna anterioara">‹</button>
                <button type="button" class="btn btn-ghost btn-sm" onClick={goToday}>Azi</button>
                <h2 class="concedii-month-title">{RO_MONTHS_FULL[viewMonth()]} {viewYear()}</h2>
                <button type="button" class="btn btn-ghost btn-sm" onClick={nextMonth} aria-label="Luna urmatoare">›</button>
              </div>
              <div class="concedii-cal-dow">
                <For each={RO_DAYS_SHORT}>{(d) => <span>{d}</span>}</For>
              </div>
              <div class="concedii-cal-grid">
                <For each={calendarCells()}>
                  {(cell) => (
                    <div
                      class="concedii-cal-day"
                      classList={{
                        "is-out": !cell.inCurrent,
                        "is-weekend": cell.isWeekend,
                        "is-today": cell.isToday,
                        "is-holiday": !!cell.holidayName,
                      }}
                      title={cell.holidayName ?? undefined}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest(".concedii-pill")) return;
                        if (cell.date) openCreateForm(cell.date);
                      }}
                    >
                      <div class="concedii-cal-day-num">
                        <span>{cell.day}</span>
                        <Show when={cell.holidayName}>
                          <span class="concedii-cal-holiday" title={cell.holidayName!}>★</span>
                        </Show>
                      </div>
                      <Show
                        when={cell.pills.length <= 2}
                        fallback={
                          <div class="concedii-cal-avatars">
                            <For each={cell.pills.slice(0, 6)}>
                              {(l) => (
                                <button
                                  type="button"
                                  class="concedii-cal-avatar-btn"
                                  classList={{
                                    [`status-${l.status.toLowerCase()}`]: true,
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setDetailLeave(l); }}
                                  title={leaveTooltip(l)}
                                >
                                  <Avatar name={l.employeeName ?? "?"} imagePath={l.employeeImagePath} size={22} />
                                </button>
                              )}
                            </For>
                            <Show when={cell.pills.length > 6}>
                              <span class="concedii-pill-more">+{cell.pills.length - 6}</span>
                            </Show>
                          </div>
                        }
                      >
                        <div class="concedii-cal-pills">
                          <For each={cell.pills}>
                            {(l) => {
                              const t = typeMeta(l.type);
                              return (
                                <button
                                  type="button"
                                  class="concedii-pill"
                                  classList={{
                                    [`status-${l.status.toLowerCase()}`]: true,
                                    [t.cls]: true,
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setDetailLeave(l); }}
                                  title={leaveTooltip(l)}
                                >
                                  <Avatar name={l.employeeName ?? "?"} imagePath={l.employeeImagePath} size={16} />
                                  <span class="concedii-pill-emoji">{t.emoji}</span>
                                  <span class="concedii-pill-name">{(l.employeeName ?? "?").split(" ")[0]}</span>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={mode() === "list"}>
            <div class="concedii-list-wrap">
              <table class="concedii-list">
                <thead>
                  <tr>
                    <th>Angajat</th>
                    <th>Locație</th>
                    <th>Tip</th>
                    <th>Status</th>
                    <th>De la</th>
                    <th>Până la</th>
                    <th style="text-align:right">Zile lucr.</th>
                    <th>Aprobat de</th>
                    <th>Acorduri</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedListLeaves()} fallback={
                    <tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">Nicio cerere pentru filtrele selectate.</td></tr>
                  }>
                    {(l) => {
                      const t = typeMeta(l.type);
                      return (
                        <tr>
                          <td>
                            <div style="display:flex;align-items:center;gap:8px">
                              <Avatar name={l.employeeName ?? "?"} imagePath={l.employeeImagePath} size={28} />
                              <span>{l.employeeName ?? "?"}</span>
                            </div>
                          </td>
                          <td>{l.locationName ?? "—"}</td>
                          <td><span class={`concedii-type-badge ${t.cls}`}>{t.emoji} {t.label}</span></td>
                          <td><span class={`concedii-status-badge status-${l.status.toLowerCase()}`}>{l.status === "Approved" ? "Aprobată" : l.status === "Pending" ? "În așteptare" : "Respinsă"}</span></td>
                          <td>{fmtRo(l.startDate)}</td>
                          <td>{isHourBased(l.type) ? `${toHM(l.startTime)}–${toHM(l.endTime)}` : fmtRo(l.endDate)}</td>
                          <td style="text-align:right">{isHourBased(l.type) ? fmtHours(l.hours) : `${l.workingDays} zile`}</td>
                          <td>{l.approverNameSnapshot ?? l.approverName ?? "—"}</td>
                          <td>
                            <span title="Acord angajat">{l.employeeConsent ? "✅" : "⬜"}</span>
                            {" "}
                            <span title="Acord aprobator">{l.approverConsent ? "✅" : "⬜"}</span>
                          </td>
                          <td style="white-space:nowrap">
                            <button type="button" class="btn btn-ghost btn-sm" onClick={() => setDetailLeave(l)}>Detalii</button>
                            <Show when={!isHourBased(l.type)}>
                              <button type="button" class="btn btn-ghost btn-sm" title="Export PDF" onClick={() => void generateLeaveRequestPdf(l)}>⬇ PDF</button>
                            </Show>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>

        {/* SIDE PANEL — Solduri */}
        <aside class="concedii-side" classList={{ "is-collapsed": !showSidePanel() }}>
          <div class="concedii-side-header">
            <span>Solduri concediu {viewYear()}</span>
            <button type="button" class="btn btn-ghost btn-sm" onClick={() => setShowSidePanel((s) => !s)} aria-label="Comuta panou lateral">
              {showSidePanel() ? "›" : "‹"}
            </button>
          </div>
          <Show when={showSidePanel()}>
            <div class="concedii-side-body">
              <For each={balances()} fallback={<p style="color:var(--text-muted);margin:0">Niciun angajat.</p>}>
                {(b) => {
                  const pct = () => b.annual_allowance === 0 ? 0 : Math.min(100, Math.round((b.used_vacation_days / b.annual_allowance) * 100));
                  const emp = () => employees().find((e) => e.id === b.employee_id);
                  return (
                    <button
                      type="button"
                      class="concedii-balance-row"
                      classList={{ "is-active": selectedEmployeeId() === b.employee_id }}
                      onClick={() => setSelectedEmployeeId(selectedEmployeeId() === b.employee_id ? null : b.employee_id)}
                    >
                      <div style="display:flex;align-items:center;gap:8px;width:100%">
                        <Avatar name={b.employee_name} imagePath={emp()?.imagePath ?? null} size={32} />
                        <div style="flex:1;min-width:0;text-align:left">
                          <div class="concedii-balance-name">{b.employee_name}</div>
                          <div class="concedii-balance-meta">
                            {b.used_vacation_days} / {b.annual_allowance} zile
                            <Show when={b.pending_vacation_days > 0}>
                              <span style="color:var(--warn,#856404);margin-left:6px">(+{b.pending_vacation_days} pending)</span>
                            </Show>
                          </div>
                          <div class="concedii-balance-bar">
                            <div class="concedii-balance-bar-fill" style={`width:${pct()}%`} />
                          </div>
                          <Show when={b.overtime_hours || b.permission_hours || b.recovery_hours || b.permission_count}>
                            <div class="concedii-balance-hours" title="Sold ore: overtime + recuperare − învoire">
                              <span>⏱ {fmtHours(b.overtime_hours)}</span>
                              <span>🕐 {b.permission_count} ({fmtHours(b.permission_hours)})</span>
                              <span>↩ {fmtHours(b.recovery_hours)}</span>
                              <span class="concedii-balance-net" classList={{ "is-negative": b.net_hours_balance < 0 }}>
                                Sold {fmtHours(b.net_hours_balance)}
                              </span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </aside>
      </div>

      {/* ── MODAL: Form Create / Edit ─────────────────────────────────────── */}
      <Modal
        open={showForm()}
        onClose={closeForm}
        title={form().id == null ? "Cerere nouă" : "Editează cerere"}
        size="md"
        footer={
          <>
            <button type="button" class="btn btn-ghost btn-sm" onClick={closeForm}>Anulează</button>
            <button type="submit" form="leave-form" class="btn btn-primary btn-sm" disabled={submitting() || (vacationBalanceInfo()?.over ?? false) || (!formIsHourBased() && form().id == null && !form().employeeConsent)}>
              {submitting() ? "..." : (form().id == null ? "Creează" : "Salvează")}
            </button>
          </>
        }
      >
        <form id="leave-form" onSubmit={submitForm} style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="form-label">Angajat</label>
            <select
              class="input"
              value={form().employeeId ?? ""}
              onChange={(e) => setForm({ ...form(), employeeId: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
            >
              <option value="">Selectează…</option>
              <For each={employees()}>
                {(emp) => <option value={emp.id}>{emp.name}</option>}
              </For>
            </select>
            <Show when={selectedEmployee()}>
              {(emp) => (
                <div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding:8px;border-radius:8px;background:var(--surface2)">
                  <Avatar name={emp().name} imagePath={emp().imagePath} size={36} />
                  <div style="flex:1">
                    <div style="font-weight:600">{emp().name}</div>
                    <Show when={balanceFor(emp().id)}>
                      {(b) => (
                        <div style="font-size:12px;color:var(--text-muted)">
                          Sold concediu: {b().remaining_vacation_days} / {b().annual_allowance} rămase
                        </div>
                      )}
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </div>

          <div>
            <label class="form-label">Tip</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <For each={LEAVE_TYPES}>
                {(t) => (
                  <button
                    type="button"
                    class="concedii-chip"
                    classList={{ "is-active": form().type === t.value }}
                    onClick={() => setForm({ ...form(), type: t.value })}
                  ><span class={`concedii-chip-dot ${t.cls}`} /> {t.emoji} {t.label}</button>
                )}
              </For>
            </div>
          </div>

          <Show
            when={!formIsHourBased()}
            fallback={
              <>
                <div>
                  <label class="form-label">Data</label>
                  <MiniCalendarPicker
                    value={form().startDate}
                    onChange={(d) => setForm({ ...form(), startDate: d, endDate: d })}
                  />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                  <div>
                    <label class="form-label">De la (ora)</label>
                    <input
                      class="input"
                      type="time"
                      value={form().startTime}
                      onInput={(e) => setForm({ ...form(), startTime: e.currentTarget.value })}
                    />
                  </div>
                  <div>
                    <label class="form-label">Până la (ora)</label>
                    <input
                      class="input"
                      type="time"
                      value={form().endTime}
                      onInput={(e) => setForm({ ...form(), endTime: e.currentTarget.value })}
                    />
                  </div>
                </div>
                <div style="padding:10px 12px;border-radius:8px;background:var(--surface2);font-size:14px">
                  <strong>{fmtHours(formHours())}</strong> în interval
                  <span style="color:var(--text-muted);font-size:12px;display:block;margin-top:2px">
                    {form().type === "Overtime"
                      ? "Ore peste program (alimentează soldul)."
                      : form().type === "Recuperare Ore invoire"
                      ? "Ore recuperate (alimentează soldul)."
                      : "Ore de învoire (se scad din sold)."}
                  </span>
                </div>
              </>
            }
          >
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div>
                <label class="form-label">De la</label>
                <MiniCalendarPicker
                  value={form().startDate}
                  onChange={(d) => setForm({ ...form(), startDate: d, endDate: d > form().endDate ? d : form().endDate })}
                />
              </div>
              <div>
                <label class="form-label">Până la</label>
                <MiniCalendarPicker
                  value={form().endDate}
                  onChange={(d) => setForm({ ...form(), endDate: d })}
                  minDate={form().startDate}
                />
              </div>
            </div>

            <div style="padding:10px 12px;border-radius:8px;background:var(--surface2);font-size:14px">
              <strong>{formWorkingDays()}</strong> zile lucrătoare în interval
              <span style="color:var(--text-muted);font-size:12px;display:block;margin-top:2px">(exclude weekend + sărbători legale RO)</span>
            </div>
            <Show when={vacationBalanceInfo()}>
              {(vb) => (
                <div
                  style={`padding:10px 12px;border-radius:8px;font-size:13px;${
                    vb().over
                      ? "background:#f8d7da;color:#721c24;border:1px solid #f5c2c7"
                      : "background:#d4edda;color:#155724;border:1px solid #c3e6cb"
                  }`}
                >
                  <Show
                    when={vb().over}
                    fallback={
                      <span>✓ Soldul de concediu acoperă cererea ({vb().requested} / {vb().available} disponibile).</span>
                    }
                  >
                    <strong>⚠ Depășește soldul!</strong> Cerute: {vb().requested} zile, disponibile: {vb().available}.
                  </Show>
                </div>
              )}
            </Show>
          </Show>

          <div>
            <label class="form-label">Motiv / Note (opțional)</label>
            <textarea
              class="input"
              rows={3}
              value={form().notes}
              onInput={(e) => setForm({ ...form(), notes: e.currentTarget.value })}
            />
          </div>

          {/* Date legale ale angajatului (din dosarul de personal) — doar tipuri pe zile */}
          <Show when={!formIsHourBased() && form().employeeId != null && formDetails()}>
            {(d) => (
              <Show
                when={d().has}
                fallback={
                  <div style="padding:10px 12px;border-radius:8px;font-size:13px;background:#fff3cd;color:#856404;border:1px solid #ffeeba">
                    ⚠ Angajatul nu are dosar de personal completat. Cererea va fi incompletă legal.
                    Completează datele din <strong>Configurări → Angajați → Detalii Angajat</strong>.
                  </div>
                }
              >
                <div style="padding:10px 12px;border-radius:8px;font-size:13px;background:var(--surface2)">
                  <div style="font-weight:600;margin-bottom:4px">Date legale (din dosar)</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;color:var(--text-muted)">
                    <Show when={d().job_title}><span>Funcție: {d().job_title}</span></Show>
                    <Show when={d().department}><span>· Dep.: {d().department}</span></Show>
                    <Show when={d().contract_number}><span>· CIM: {d().contract_number}</span></Show>
                    <Show when={d().cnp}><span>· CNP: {d().cnp}</span></Show>
                    <Show when={d().company_name}><span>· Firmă: {d().company_name}</span></Show>
                  </div>
                </div>
              </Show>
            )}
          </Show>

          {/* Acord digital angajat — necesar pentru cereri noi (doar tipuri pe zile) */}
          <Show when={!formIsHourBased() && form().id == null}>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:var(--surface2);cursor:pointer;font-size:13px">
              <input
                type="checkbox"
                checked={form().employeeConsent}
                onInput={(e) => setForm({ ...form(), employeeConsent: e.currentTarget.checked })}
                style="margin-top:2px"
              />
              <span>
                <strong>Acordul angajatului.</strong> Angajatul își dă acordul în mod digital pentru
                această cerere de concediu și confirmă corectitudinea datelor de mai sus.
              </span>
            </label>
          </Show>
        </form>
      </Modal>

      {/* ── MODAL: Detalii leave ─────────────────────────────────────────── */}
      <Modal
        open={detailLeave() !== null}
        onClose={() => setDetailLeave(null)}
        title="Detalii absență"
        size="lg"
        footer={
          <Show when={detailLeave()}>
            {(l) => (
              <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;width:100%">
                <Show when={!isHourBased(l().type)}>
                  <button type="button" class="btn btn-ghost btn-sm" onClick={() => void generateLeaveRequestPdf(l())}>⬇ Export PDF</button>
                </Show>
                <button type="button" class="btn btn-ghost btn-sm" onClick={() => handleDelete(l())}>Șterge</button>
                <button type="button" class="btn btn-ghost btn-sm" onClick={() => openEditForm(l())}>Editează</button>
                <Show when={canManage()}>
                  <button
                    type="button"
                    class="btn btn-sm concedii-action-btn"
                    classList={{ "is-current": l().status === "Approved" }}
                    style="background:#d4edda;color:#155724;border-color:#155724"
                    disabled={l().status === "Approved" || (!isHourBased(l().type) && !approverConsent())}
                    title={l().status !== "Approved" && !isHourBased(l().type) && !approverConsent() ? "Bifează acordul de aprobare" : undefined}
                    onClick={() => handleApprove(l())}
                  >✓ {l().status === "Approved" ? "Aprobată" : "Aprobă"}</button>
                  <button
                    type="button"
                    class="btn btn-sm concedii-action-btn"
                    classList={{ "is-current": l().status === "Rejected" }}
                    style="background:#f8d7da;color:#721c24;border-color:#721c24"
                    disabled={l().status === "Rejected"}
                    onClick={() => handleReject(l())}
                  >✕ {l().status === "Rejected" ? "Respinsă" : "Respinge"}</button>
                  <Show when={l().status !== "Pending"}>
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => handleReset(l())}>↺ Resetează</button>
                  </Show>
                </Show>
              </div>
            )}
          </Show>
        }
      >
        <Show when={detailLeave()}>
          {(l) => {
            const t = typeMeta(l().type);
            return (
              <div style="display:flex;flex-direction:column;gap:14px">
                <div style="display:flex;align-items:center;gap:12px">
                  <Avatar name={l().employeeName ?? "?"} imagePath={l().employeeImagePath} size={56} />
                  <div>
                    <div style="font-size:18px;font-weight:700">{l().employeeName ?? "?"}</div>
                    <div style="color:var(--text-muted);font-size:13px">{l().locationName ?? "Fără locație"}</div>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                  <span class={`concedii-type-badge ${t.cls}`}>{t.emoji} {t.label}</span>
                  <span class={`concedii-status-badge status-${l().status.toLowerCase()}`}>
                    {l().status === "Approved" ? "Aprobată" : l().status === "Pending" ? "În așteptare" : "Respinsă"}
                  </span>
                </div>
                <Show
                  when={!isHourBased(l().type)}
                  fallback={
                    <div style="font-size:15px">
                      <strong>{fmtRo(l().startDate)}</strong>
                      <span style="color:var(--text-muted);margin-left:8px">
                        {toHM(l().startTime)}–{toHM(l().endTime)} · {fmtHours(l().hours)}
                      </span>
                    </div>
                  }
                >
                  <div style="font-size:15px">
                    <strong>{fmtRo(l().startDate)} – {fmtRo(l().endDate)}</strong>
                    <span style="color:var(--text-muted);margin-left:8px">({l().workingDays} zile lucrătoare)</span>
                  </div>
                </Show>
                <Show when={l().notes}>
                  <div style="padding:10px 12px;border-radius:8px;background:var(--surface2);font-size:14px;white-space:pre-wrap">
                    {l().notes}
                  </div>
                </Show>
                <Show when={l().approvedAt}>
                  <div style="font-size:13px;color:var(--text-muted)">
                    {l().status === "Approved" ? "Aprobată" : "Respinsă"} de {l().approverNameSnapshot ?? l().approverName ?? "?"} la {new Date(l().approvedAt!).toLocaleString("ro-RO")}
                  </div>
                </Show>

                {/* Date legale (snapshot la momentul cererii) — protejat de
                    gate-ul Rapoarte, adus separat prin fetchLeaveSnapshot. */}
                <Show when={detailSnapshot()}>
                  {(snap) => (
                    <div style="border:1px solid var(--border,#2a2a2a);border-radius:8px;padding:10px 12px;font-size:13px">
                      <div style="font-weight:600;margin-bottom:6px">📋 Date legale ale cererii</div>
                      <Show when={snap().company}>
                        {(co) => (
                          <div style="margin-bottom:4px">
                            <strong>{co().name}</strong>
                            <Show when={co().cui}><span style="color:var(--text-muted)"> · CUI {co().cui}</span></Show>
                            <Show when={co().nr_reg_com}><span style="color:var(--text-muted)"> · {co().nr_reg_com}</span></Show>
                          </div>
                        )}
                      </Show>
                      <div style="display:flex;flex-wrap:wrap;gap:8px;color:var(--text-muted)">
                        <Show when={snap().employee.cnp}><span>CNP: {snap().employee.cnp}</span></Show>
                        <Show when={snap().employee.job_title}><span>· Funcție: {snap().employee.job_title}</span></Show>
                        <Show when={snap().employee.department}><span>· Dep.: {snap().employee.department}</span></Show>
                        <Show when={snap().employee.contract_number}><span>· CIM: {snap().employee.contract_number}</span></Show>
                      </div>
                      <Show when={snap().vacation}>
                        {(v) => (
                          <div style="margin-top:4px;color:var(--text-muted)">
                            Sold: {v().annual_allowance} zile/an · rămase după cerere: {v().remaining_after}
                          </div>
                        )}
                      </Show>
                      <Show when={!snap().has_details}>
                        <div style="margin-top:6px;color:#856404">⚠ Dosar de personal incomplet la momentul cererii.</div>
                      </Show>
                    </div>
                  )}
                </Show>

                {/* Acorduri digitale — doar tipuri pe zile (flux legal) */}
                <Show when={!isHourBased(l().type)}>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span>{l().employeeConsent ? "✅" : "⬜"}</span>
                    <span>
                      Acord angajat
                      <Show when={l().employeeConsentAt}>
                        <span style="color:var(--text-muted)"> · {new Date(l().employeeConsentAt!).toLocaleString("ro-RO")}</span>
                      </Show>
                    </span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span>{l().approverConsent ? "✅" : "⬜"}</span>
                    <span>
                      Acord aprobator
                      <Show when={l().approverConsent && l().approverNameSnapshot}>
                        <span style="color:var(--text-muted)"> · {l().approverNameSnapshot}</span>
                      </Show>
                    </span>
                  </div>
                </div>
                </Show>

                {/* Bifa de acord pentru aprobator (admin, cerere ne-aprobată) — doar tipuri pe zile */}
                <Show when={!isHourBased(l().type) && canManage() && l().status !== "Approved"}>
                  <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:var(--surface2);cursor:pointer;font-size:13px">
                    <input
                      type="checkbox"
                      checked={approverConsent()}
                      onInput={(e) => setApproverConsent(e.currentTarget.checked)}
                      style="margin-top:2px"
                    />
                    <span>
                      <strong>Acordul aprobatorului.</strong> Îmi dau acordul în mod digital pentru aprobarea
                      acestei cereri. (Necesar pentru a apăsa „Aprobă".)
                    </span>
                  </label>
                </Show>
                <Show when={overlapMonth()}>
                  {(mm) => (
                    <OverlapView
                      current={l()}
                      monthLeaves={detailMonthLeaves()}
                      holidays={holidaysByYear()}
                      month={mm()}
                      onShiftMonth={shiftOverlapMonth}
                    />
                  )}
                </Show>
                <Show when={!canManage() && l().status === "Pending"}>
                  <div style="font-size:12px;color:var(--text-muted);font-style:italic">
                    Doar administratorul poate aproba sau respinge cererea.
                  </div>
                </Show>
              </div>
            );
          }}
        </Show>
      </Modal>

      {/* ── MODAL: Confirmare ștergere ───────────────────────────────────── */}
      <Modal
        open={deleteTarget() !== null}
        onClose={() => !deleting() && setDeleteTarget(null)}
        title="Confirmă ștergerea"
        size="sm"
        footer={
          <>
            <button type="button" class="btn btn-ghost btn-sm" disabled={deleting()} onClick={() => setDeleteTarget(null)}>Anulează</button>
            <button type="button" class="btn btn-sm" style="background:#f8d7da;color:#721c24;border-color:#dc3545" disabled={deleting()} onClick={confirmDelete}>
              {deleting() ? "Se șterge..." : "Șterge"}
            </button>
          </>
        }
      >
        <Show when={deleteTarget()}>
          {(l) => (
            <div style="display:flex;flex-direction:column;gap:10px">
              <p style="margin:0">
                Ștergi cererea de absență pentru <strong>{l().employeeName ?? "?"}</strong>?
              </p>
              <div style="padding:8px 12px;border-radius:8px;background:var(--surface2);font-size:13px;color:var(--text-muted)">
                <Show
                  when={isHourBased(l().type)}
                  fallback={<>{l().type} · {fmtRo(l().startDate)} – {fmtRo(l().endDate)} · {l().workingDays} zile lucrătoare</>}
                >
                  {l().type} · {fmtRo(l().startDate)} · {toHM(l().startTime)}–{toHM(l().endTime)} · {fmtHours(l().hours)}
                </Show>
              </div>
              <p style="margin:0;font-size:12px;color:var(--text-muted)">Această acțiune nu poate fi anulată.</p>
            </div>
          )}
        </Show>
      </Modal>
    </div>
  );
}
