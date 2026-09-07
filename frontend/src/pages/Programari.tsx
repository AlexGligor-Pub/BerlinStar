import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { device } from "../store/deviceStore";
import { catalogDepartments, loadCatalogDepartments, patchCatalogDepartment } from "../store/catalogThemesStore";
import type { CatalogDepartment } from "../store/catalogThemesStore";
import { employees, loadEmployees } from "../store/employeesStore";
import { departmentsApi } from "../api/departments";
import {
  programari, loading,
  loadProgramari, createProgramare, updateProgramare, deleteProgramare,
} from "../store/programariStore";
import type { Programare, ProgramareStatus, ProgramareInput } from "../store/programariStore";
import { triggerLoad } from "../store/resumeStore";
import { CNP_PLACEHOLDER, cnpError, cnpForSave } from "../types/client";
import { canManage } from "../store/permissions";
import { notify } from "../store/notificationsStore";
import { apiFetch } from "../utils/api";
import { createDebouncedSearch } from "../utils/debounce";
import Modal from "../components/ui/Modal";

// ─── Calendar constants ──────────────────────────────────────────────────────

const PX_PER_HOUR = 72;
const CAL_START   = 7 * 60;   // 420 min
const CAL_END     = 19 * 60;  // 1140 min
const TOTAL_H     = (CAL_END - CAL_START) / 60 * PX_PER_HOUR; // 864px
const WORK_START  = 8 * 60;   // ore normale de lucru
const WORK_END    = 17 * 60;
const OFF_TOP_H   = (WORK_START - CAL_START) / 60 * PX_PER_HOUR; // 72px  (7–8)
const OFF_BOT_TOP = (WORK_END   - CAL_START) / 60 * PX_PER_HOUR; // 720px
const OFF_BOT_H   = (CAL_END   - WORK_END)   / 60 * PX_PER_HOUR; // 144px (17–19)

function minToTop(min: number)  { return (min - CAL_START) / 60 * PX_PER_HOUR; }

const STATUS_COLORS: Record<ProgramareStatus, string> = {
  "Programat": "#3b82f6",
  "In lucru":  "#f59e0b",
  "Executat":  "#22c55e",
  "Anulat":    "#6b7280",
};

// Culori dept — saturate pt. programari, pale pt. chips
const DEPT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ec4899",
  "#8b5cf6", "#10b981", "#ef4444", "#0ea5e9",
  "#f97316", "#a855f7",
];

const DAY_NAMES      = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const MINI_DAY_NAMES = ["L",   "M",   "M",   "J",   "V",   "S",   "D"];

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekDays(offset: number): Date[] {
  const mon = getMonday(new Date());
  mon.setDate(mon.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dateToLocalMin(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function dateLocalIso(date: Date, hourMin: number): string {
  const d = new Date(date);
  d.setHours(Math.floor(hourMin / 60), hourMin % 60, 0, 0);
  return d.toISOString();
}

function dateToInputValue(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function minToTimeInput(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeInputToMin(val: string): number {
  const [h, m] = val.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ─── Overlap column layout ───────────────────────────────────────────────────

interface ApptWithCol extends Programare { colIdx: number; colCount: number; }

// Grupuri de suprapunere (cluster) cu numar nelimitat de coloane; colCount = coloanele clusterului.
function calcColumns(appts: Programare[]): ApptWithCol[] {
  if (appts.length === 0) return [];
  const sorted = appts
    .map((a) => ({ a, s: new Date(a.startTime).getTime(), e: new Date(a.endTime).getTime() }))
    .sort((x, y) => x.s - y.s || x.e - y.e);
  const out: ApptWithCol[] = [];
  let cluster: { a: Programare; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = 0;

  const flush = () => {
    for (const c of cluster) out.push({ ...c.a, colIdx: c.col, colCount: colEnds.length });
    cluster = []; colEnds = []; clusterEnd = 0;
  };

  for (const x of sorted) {
    if (cluster.length > 0 && x.s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= x.s);
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = x.e;
    clusterEnd = Math.max(clusterEnd, x.e);
    cluster.push({ a: x.a, col });
  }
  flush();
  return out;
}

// ─── Time slot labels ────────────────────────────────────────────────────────

interface TimeLabel { label: string; top: number; isHour: boolean; min: number; }
const TIME_LABELS: TimeLabel[] = [];
for (let min = CAL_START; min < CAL_END; min += 30) {
  const h = Math.floor(min / 60), m = min % 60;
  TIME_LABELS.push({
    label: m === 0 ? `${String(h).padStart(2, "0")}:00` : "",
    top:   minToTop(min),
    isHour: m === 0,
    min,
  });
}

// ─── Client item ─────────────────────────────────────────────────────────────

interface ClientItem { id: number; nume: string; numar_masina: string | null; }

// ─── Angajat: avatar, filtru persistat per dispozitiv, popover ───────────────

type EmpFilterKey = number | "none";
type EmpFilter = EmpFilterKey[];
const EMP_FILTER_LS_KEY = "bs_prgm_filter_v1";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

function isEmpFilterKey(v: unknown): v is EmpFilterKey {
  return typeof v === "number" || v === "none";
}

function loadEmpFilter(): EmpFilter {
  try {
    const raw = localStorage.getItem(EMP_FILTER_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { employeeId?: unknown; employeeIds?: unknown };
    if (Array.isArray(parsed.employeeIds)) return parsed.employeeIds.filter(isEmpFilterKey);
    return isEmpFilterKey(parsed.employeeId) ? [parsed.employeeId] : [];
  } catch { return []; }
}

function saveEmpFilter(v: EmpFilter): void {
  try { localStorage.setItem(EMP_FILTER_LS_KEY, JSON.stringify({ employeeIds: v })); } catch { /* storage disabled */ }
}

interface AvatarSource { name: string; imagePath?: string | null; }

function EmpAvatar(props: { emp: AvatarSource | null | undefined; class?: string }) {
  const cls = () => `prgm-emp-av${props.class ? ` ${props.class}` : ""}`;
  return (
    <Show when={props.emp?.imagePath} fallback={
      <span class={`${cls()}${props.emp ? "" : " prgm-emp-av--dashed"}`} aria-hidden="true">
        {props.emp ? initials(props.emp.name) : "?"}
      </span>
    }>
      {(src) => <img class={cls()} src={src()} alt="" />}
    </Show>
  );
}

function Popover(props: {
  open: boolean; onClose: () => void; label: string;
  trigger: JSX.Element; children: JSX.Element; class?: string;
}) {
  let wrap!: HTMLDivElement;
  function onOutside(e: PointerEvent) {
    if (props.open && wrap && !wrap.contains(e.target as Node)) props.onClose();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !props.open) return;
    e.stopPropagation();
    props.onClose();
    wrap.querySelector<HTMLElement>("button")?.focus();
  }
  onMount(() => document.addEventListener("pointerdown", onOutside));
  onCleanup(() => document.removeEventListener("pointerdown", onOutside));
  return (
    <div class={`prgm-pop-wrap${props.class ? ` ${props.class}` : ""}`} ref={wrap} on:keydown={onKey}>
      {props.trigger}
      <Show when={props.open}>
        <div class="prgm-pop" role="group" aria-label={props.label}>{props.children}</div>
      </Show>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Programari() {
  const navigate = useNavigate();

  const [weekOffset,    setWeekOffset]    = createSignal(0);
  const [selectedDept,  setSelectedDept]  = createSignal<number | null>(null);
  const [empFilter,     setEmpFilter]     = createSignal<EmpFilter>(loadEmpFilter());
  const [empPopOpen,    setEmpPopOpen]    = createSignal(false);
  const [visibPopOpen,  setVisibPopOpen]  = createSignal(false);
  const [visibSaved,    setVisibSaved]    = createSignal(false);
  const [detailAssigning, setDetailAssigning] = createSignal(false);
  const [q,             setQ]             = createSignal("");
  const [selectedAppt,  setSelectedAppt]  = createSignal<Programare | null>(null);
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [formAppt,      setFormAppt]      = createSignal<Programare | null>(null);
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);
  const [actionError,   setActionError]   = createSignal<string | null>(null);
  const [calendarOpen,  setCalendarOpen]  = createSignal(false);
  const [miniMonth,     setMiniMonth]     = createSignal({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [nowMin,        setNowMin]        = createSignal(new Date().getHours() * 60 + new Date().getMinutes());

  // Drag state — plain object for perf, dragTick triggers re-renders
  let drag: {
    apptId: string; type: "move" | "resize";
    startY: number; startX: number;
    origStartMin: number; origEndMin: number; origDayIdx: number;
    curStartMin:  number; curEndMin:  number; curDayIdx:  number;
  } | null = null;
  const [dragTick, setDragTick] = createSignal(0);
  let lastMoveEndTs = 0;

  let calGridRef!: HTMLDivElement;
  let calWrapRef!: HTMLDivElement;

  function scrollToNow() {
    if (!calWrapRef) return;
    const headerH = 48;
    const target = Math.max(0, minToTop(nowMin()) - 80);
    calWrapRef.scrollTo({ top: target + headerH, behavior: "smooth" });
  }

  const weekDays    = createMemo(() => getWeekDays(weekOffset()));
  const locationId  = createMemo(() => device()?.locationId ?? null);

  const weekLabel = createMemo(() => {
    const days = weekDays();
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    return `${days[0].toLocaleDateString("ro-RO", opts)} – ${days[6].toLocaleDateString("ro-RO", { ...opts, year: "numeric" })}`;
  });

  const deptColorMap = createMemo(() => {
    const map = new Map<number, string>();
    catalogDepartments().forEach((dept, i) => {
      map.set(dept.id, DEPT_COLORS[i % DEPT_COLORS.length]);
    });
    return map;
  });

  const visibleDepartments = createMemo(() => catalogDepartments().filter((d) => d.showInProgramari));
  const hiddenDeptCount    = createMemo(() => catalogDepartments().length - visibleDepartments().length);
  const empById            = createMemo(() => new Map(employees().map((e) => [e.id, e])));
  const empFilterActive    = () => empFilter().length > 0;
  const filterEmp          = createMemo(() => {
    const f = empFilter();
    return f.length === 1 && typeof f[0] === "number" ? empById().get(f[0]) ?? null : null;
  });
  const empFilterLabel = () => {
    const f = empFilter();
    if (f.length === 0) return "Toți angajații";
    if (f.length === 1) return f[0] === "none" ? "Neasignate" : filterEmp()?.name ?? "Angajat";
    return `${f.length} selectați`;
  };
  const empFilterHas = (k: EmpFilterKey) => empFilter().includes(k);

  function clearEmpFilter() {
    setEmpFilter([]); saveEmpFilter([]); setEmpPopOpen(false);
  }
  function toggleEmpFilter(k: EmpFilterKey, on: boolean) {
    const next = on ? [...empFilter().filter((x) => x !== k), k] : empFilter().filter((x) => x !== k);
    setEmpFilter(next); saveEmpFilter(next);
  }

  createEffect(on(visibleDepartments, (vis) => {
    const sel = selectedDept();
    if (sel != null && !vis.some((d) => d.id === sel)) setSelectedDept(null);
  }));

  async function toggleDeptVisible(dept: CatalogDepartment, show: boolean) {
    patchCatalogDepartment(dept.id, { showInProgramari: show });
    try {
      await departmentsApi.update(dept.id, { show_in_programari: show });
      setVisibSaved(false); setVisibSaved(true);
      setTimeout(() => setVisibSaved(false), 1800);
    } catch (err: unknown) {
      patchCatalogDepartment(dept.id, { showInProgramari: !show });
      setActionError(err instanceof Error ? err.message : "Nu s-a putut salva setarea diviziei.");
    }
  }

  async function showAllDepts() {
    for (const d of catalogDepartments()) {
      if (!d.showInProgramari) await toggleDeptVisible(d, true);
    }
  }

  const miniCalDays = createMemo(() => {
    const { year, month } = miniMonth();
    const firstDow    = new Date(year, month, 1).getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const start       = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  });

  const miniMonthLabel = createMemo(() => {
    const { year, month } = miniMonth();
    return new Date(year, month, 1).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
  });

  function isInSelectedWeek(d: Date): boolean {
    return weekDays().some((wd) => isSameDay(wd, d));
  }

  function selectWeekContaining(d: Date) {
    const targetMon = getMonday(d);
    const todayMon  = getMonday(new Date());
    const diffWeeks = Math.round((targetMon.getTime() - todayMon.getTime()) / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(diffWeeks);
  }

  function prevMiniMonth() {
    setMiniMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }

  function nextMiniMonth() {
    setMiniMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }

  onMount(async () => {
    await Promise.all([
      loadCatalogDepartments(), // toate departamentele, nu filtrate pe locatie
      loadEmployees(locationId(), { force: true }),
    ]);
    await reloadAppts();
    queueMicrotask(() => {
      if (!calWrapRef) return;
      const headerH = 48;
      calWrapRef.scrollTop = Math.max(0, minToTop(nowMin()) - 80) + headerH;
    });
    const timer = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  async function reloadAppts() {
    const locId = locationId();
    if (locId == null) return;
    const days = weekDays();
    const from = new Date(days[0]); from.setHours(0, 0, 0, 0);
    const to   = new Date(days[6]); to.setHours(23, 59, 59, 999);
    await loadProgramari(locId, { dateFrom: from.toISOString(), dateTo: to.toISOString() });
  }

  // Tracking explicit pe weekOffset() pentru a evita refetch-uri din alte semnale.
  createEffect(on(weekOffset, () => { void reloadAppts(); }));
  // Derive miniMonth din weekDays — derivare pura, dar setMiniMonth e signal aparte.
  createEffect(on(weekDays, (days) => {
    const d = days[3]; // joi — luna reprezentativa a saptamanii
    setMiniMonth({ year: d.getFullYear(), month: d.getMonth() });
  }));

  const filteredProgramari = createMemo(() => {
    let list = programari();
    if (selectedDept() != null) list = list.filter((p) => p.departmentId === selectedDept());
    const ef = empFilter();
    if (ef.length > 0) {
      const ids = new Set(ef);
      list = list.filter((p) => (p.employeeId == null ? ids.has("none") : ids.has(p.employeeId)));
    }
    if (q().trim()) {
      const ql = q().toLowerCase();
      list = list.filter((p) =>
        p.titlu.toLowerCase().includes(ql) ||
        (p.clientNume && p.clientNume.toLowerCase().includes(ql))
      );
    }
    return list;
  });

  function getDayAppts(day: Date): ApptWithCol[] {
    return calcColumns(filteredProgramari().filter((p) => isSameDay(new Date(p.startTime), day)));
  }

  // Reactive style for each appointment (reads dragTick for drag preview)
  function apptStyle(appt: ApptWithCol): string {
    void dragTick();
    const startMin = dateToLocalMin(appt.startTime);
    const endMin   = dateToLocalMin(appt.endTime);
    const top      = minToTop(startMin);
    const colW     = 100 / appt.colCount;
    const left     = colW * appt.colIdx;
    const color    = (appt.departmentId != null ? deptColorMap().get(appt.departmentId) : null)
                     ?? STATUS_COLORS[appt.status]
                     ?? "#3b82f6";

    let height    = Math.max(28, (endMin - startMin) / 60 * PX_PER_HOUR);
    let transform = "";
    let zIndex    = 1;
    let opacity   = 1;

    if (drag?.apptId === appt.id) {
      zIndex  = 10;
      opacity = 0.88;
      if (drag.type === "resize") {
        height = Math.max(28, (drag.curEndMin - startMin) / 60 * PX_PER_HOUR);
      } else {
        const dy       = (drag.curStartMin - startMin) / 60 * PX_PER_HOUR;
        const gridW    = calGridRef?.offsetWidth ?? 822;
        const dayColW  = (gridW - 52) / 7;
        const dx       = (drag.curDayIdx - drag.origDayIdx) * dayColW;
        transform = `translate(${dx}px, ${dy}px)`;
      }
    }

    return [
      "position:absolute",
      `top:${top}px`, `height:${height}px`,
      `left:calc(${left}% + 2px)`, `width:calc(${colW}% - 4px)`,
      `background:${color}`, "border-radius:4px",
      "cursor:grab", "user-select:none", "touch-action:none",
      "font-size:11px", "color:#fff", "box-shadow:0 1px 3px rgba(0,0,0,.2)",
      `z-index:${zIndex}`, `opacity:${opacity}`,
      transform ? `transform:${transform}` : "",
    ].filter(Boolean).join(";");
  }

  function onApptPointerDown(e: PointerEvent, appt: Programare, type: "move" | "resize") {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const days        = weekDays();
    const startDate   = new Date(appt.startTime);
    const origDayIdx  = Math.max(0, days.findIndex((d) => isSameDay(d, startDate)));
    const startMin    = dateToLocalMin(appt.startTime);
    const endMin      = dateToLocalMin(appt.endTime);
    drag = {
      apptId: appt.id, type,
      startY: e.clientY, startX: e.clientX,
      origStartMin: startMin, origEndMin: endMin, origDayIdx,
      curStartMin: startMin, curEndMin: endMin, curDayIdx: origDayIdx,
    };
    setDragTick((v) => v + 1);
  }

  function onCalPointerMove(e: PointerEvent) {
    if (!drag) return;
    const deltaY     = e.clientY - drag.startY;
    const deltaX     = e.clientX - drag.startX;
    const deltaMins  = Math.round(deltaY / PX_PER_HOUR * 60 / 30) * 30;
    const gridW      = calGridRef?.offsetWidth ?? 822;
    const dayColW    = (gridW - 52) / 7;
    const dayDelta   = Math.round(deltaX / dayColW);

    if (drag.type === "move") {
      const dur      = drag.origEndMin - drag.origStartMin;
      const newStart = Math.max(CAL_START, Math.min(drag.origStartMin + deltaMins, CAL_END - dur));
      drag.curStartMin = newStart;
      drag.curEndMin   = newStart + dur;
      drag.curDayIdx   = Math.max(0, Math.min(6, drag.origDayIdx + dayDelta));
    } else {
      const rawEnd     = drag.origEndMin + deltaMins;
      drag.curEndMin   = Math.round(Math.max(drag.origStartMin + 30, Math.min(rawEnd, CAL_END)) / 30) * 30;
    }
    setDragTick((v) => v + 1);
  }

  async function onCalPointerUp(_e: PointerEvent) {
    if (!drag) return;
    const d = { ...drag };
    drag = null;
    setDragTick((v) => v + 1);

    const moved = d.curStartMin !== d.origStartMin || d.curEndMin !== d.origEndMin || d.curDayIdx !== d.origDayIdx;
    if (!moved) return;
    lastMoveEndTs = Date.now();

    const days       = weekDays();
    const targetDay  = days[d.curDayIdx];
    if (!targetDay) return;

    const newStartIso = dateLocalIso(targetDay, d.curStartMin);
    const newEndIso   = dateLocalIso(targetDay, d.curEndMin);
    try {
      await updateProgramare(d.apptId, { startTime: newStartIso, endTime: newEndIso });
    } catch (err: any) {
      setActionError(err?.message ?? "Eroare la salvare.");
    }
  }

  function onSlotClick(day: Date, startMin: number) {
    if (drag) return;
    if (!locationId()) return;
    setFormAppt(null);
    initForm(day, startMin, startMin + 60);
    setShowFormModal(true);
    setSelectedAppt(null);
  }

  function openCreateModal() {
    setFormAppt(null);
    initForm(weekDays()[0], 9 * 60, 10 * 60);
    setShowFormModal(true);
    setSelectedAppt(null);
  }

  function openEditModal(appt: Programare) {
    setFormAppt(appt);
    const sd = new Date(appt.startTime);
    initForm(sd, dateToLocalMin(appt.startTime), dateToLocalMin(appt.endTime));
    setFormTitlu(appt.titlu);
    setFormNotite(appt.notite ?? "");
    setFormDeptId(appt.departmentId);
    setFormEmployeeId(appt.employeeId);
    setFormStatus(appt.status);
    if (appt.clientId != null) {
      setFormClient({ id: appt.clientId, nume: appt.clientNume ?? "", numar_masina: null });
      setClientQ(appt.clientNume ?? "");
    } else {
      setFormClient(null); setClientQ("");
    }
    setFormError(null);
    setShowFormModal(true);
    setSelectedAppt(null);
  }

  async function handleStartWork(appt: Programare): Promise<void> {
    try {
      await updateProgramare(appt.id, { status: "In lucru" });
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la marcare „În lucru”.", "error");
    }
    triggerLoad({
      titlu: appt.titlu,
      descriere: "", dateTehn: "", items: [],
      clientId: appt.clientId ?? null,
      clientNume: appt.clientNume ?? null,
      clientCui: null, clientTip: null,
      programareId: Number(appt.id),
      employeeId: appt.employeeId ?? null,
    });
    setSelectedAppt(null);
    navigate("/");
  }

  async function handleDelete(id: string) {
    try {
      await deleteProgramare(id);
      setSelectedAppt(null); setDeleteConfirm(null);
    } catch (err: any) {
      setActionError(err?.message ?? "Eroare la stergere.");
    }
  }

  async function quickAssign(appt: Programare, employeeId: number | null) {
    setDetailAssigning(true);
    try {
      setSelectedAppt(await updateProgramare(appt.id, { employeeId }));
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la asignarea angajatului.", "error");
    } finally {
      setDetailAssigning(false);
    }
  }

  // ─── Form state ───────────────────────────────────────────────────────────

  const [formDay,      setFormDay]      = createSignal<Date>(new Date());
  const [formStartMin, setFormStartMin] = createSignal(9 * 60);
  const [formEndMin,   setFormEndMin]   = createSignal(10 * 60);
  const [formTitlu,    setFormTitlu]    = createSignal("");
  const [formNotite,   setFormNotite]   = createSignal("");
  const [formDeptId,   setFormDeptId]   = createSignal<number | null>(null);
  const [formEmployeeId, setFormEmployeeId] = createSignal<number | null>(null);
  const [formStatus,   setFormStatus]   = createSignal<ProgramareStatus>("Programat");
  const [formClient,   setFormClient]   = createSignal<ClientItem | null>(null);
  const [formSaving,   setFormSaving]   = createSignal(false);
  const [formError,    setFormError]    = createSignal<string | null>(null);

  const [clientQ,         setClientQ]         = createSignal("");
  const [clientRes,       setClientRes]       = createSignal<ClientItem[]>([]);
  const [clientOpen,      setClientOpen]      = createSignal(false);
  const [clientSearching, setClientSearching] = createSignal(false);

  const [showClientCreate,    setShowClientCreate]    = createSignal(false);
  const [clientCreateTip,     setClientCreateTip]     = createSignal<"fizic" | "juridic">("fizic");
  const [clientCreateNume,    setClientCreateNume]    = createSignal("");
  const [clientCreateTelefon, setClientCreateTelefon] = createSignal("");
  const [clientCreateMasina,  setClientCreateMasina]  = createSignal("");
  const [clientCreateCnp,     setClientCreateCnp]     = createSignal(CNP_PLACEHOLDER);
  const [clientCreateSaving,  setClientCreateSaving]  = createSignal(false);

  function initForm(day: Date, startMin: number, endMin: number) {
    setFormDay(day); setFormStartMin(startMin); setFormEndMin(endMin);
    setFormTitlu(""); setFormNotite("");
    setFormDeptId(selectedDept()); setFormEmployeeId(null); setFormStatus("Programat");
    setFormClient(null); setClientQ(""); setClientRes([]); setClientOpen(false);
    setShowClientCreate(false); setClientCreateNume(""); setClientCreateTelefon(""); setClientCreateMasina(""); setClientCreateTip("fizic");
    setFormError(null);
  }

  const clientSearch = createDebouncedSearch<ClientItem[] | null>({
    fetch: async (val, signal) => {
      const res = await apiFetch(`/api/clienti?q=${encodeURIComponent(val)}&limit=10`, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.items ?? []).map((c: any) => ({ id: c.id, nume: c.nume, numar_masina: c.numar_masina ?? null }));
    },
    onResult: (items) => {
      if (!items) return;
      setClientRes(items);
      setClientOpen(true); // deschide mereu — chiar si gol, sa arate optiunea de creare
    },
    onPending: setClientSearching,
  });
  async function searchClients(val: string, immediate = false): Promise<void> {
    if (!val.trim()) { clientSearch.cancel(); setClientRes([]); setClientOpen(false); return; }
    if (immediate) await clientSearch.searchNow(val);
    else clientSearch.search(val);
  }

  function pickClient(c: ClientItem) {
    setFormClient(c); setClientQ(c.nume); setClientOpen(false); setClientRes([]);
    setShowClientCreate(false);
  }

  function clearClient() {
    setFormClient(null); setClientQ(""); setClientRes([]); setClientOpen(false);
    setShowClientCreate(false);
  }

  async function handleClientCreate() {
    if (!clientCreateNume().trim()) return;
    if (clientCreateTip() === "fizic") {
      const e = cnpError(clientCreateCnp());
      if (e) { setFormError(e); return; }
    }
    setClientCreateSaving(true);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: clientCreateTip(),
          nume: clientCreateNume().trim(),
          cui: clientCreateTip() === "fizic" ? cnpForSave(clientCreateCnp()) : null,
          telefon: clientCreateTelefon().trim() || null,
          numar_masina: clientCreateMasina().trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Eroare la creare client.");
      const data = await res.json();
      pickClient({ id: data.id, nume: data.nume, numar_masina: data.numar_masina ?? null });
      setShowClientCreate(false);
      setClientCreateNume(""); setClientCreateTelefon(""); setClientCreateMasina("");
      setClientCreateCnp(CNP_PLACEHOLDER); setClientCreateTip("fizic");
    } catch (err: any) {
      setFormError(err?.message ?? "Eroare la creare client.");
    } finally {
      setClientCreateSaving(false);
    }
  }

  async function handleFormSave() {
    if (!formTitlu().trim()) { setFormError("Titlul este obligatoriu."); return; }
    const locId = locationId();
    if (!locId) { setFormError("Dispozitiv fara locatie configurata."); return; }
    if (formEndMin() <= formStartMin()) { setFormError("Ora de sfarsit trebuie sa fie dupa ora de inceput."); return; }
    setFormSaving(true); setFormError(null);
    try {
      const input: ProgramareInput = {
        titlu: formTitlu().trim(),
        notite: formNotite().trim() || null,
        clientId: formClient()?.id ?? null,
        locationId: locId,
        departmentId: formDeptId(),
        employeeId: formEmployeeId(),
        startTime: dateLocalIso(formDay(), formStartMin()),
        endTime:   dateLocalIso(formDay(), formEndMin()),
        status: formStatus(),
      };
      const existing = formAppt();
      if (existing) {
        await updateProgramare(existing.id, input);
      } else {
        await createProgramare(input);
      }
      setShowFormModal(false);
    } catch (err: any) {
      setFormError(err?.message ?? "Eroare la salvare.");
    } finally {
      setFormSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // Mini calendar (folosit atât în sidebar pe desktop cât și în modal pe mobil)
  const renderMiniCal = (opts: { closeOnPick?: boolean } = {}) => (
    <div class="prgm-mini-cal">
      <div class="prgm-mini-cal-header">
        <button type="button" class="btn btn-ghost btn-sm" style="padding:0 8px" onClick={prevMiniMonth} aria-label="Luna anterioară">‹</button>
        <span class="prgm-mini-cal-title">{miniMonthLabel()}</span>
        <button type="button" class="btn btn-ghost btn-sm" style="padding:0 8px" onClick={nextMiniMonth} aria-label="Luna următoare">›</button>
      </div>
      <div class="prgm-mini-cal-grid">
        <For each={MINI_DAY_NAMES}>{(n) => <div class="prgm-mini-dow">{n}</div>}</For>
        <For each={miniCalDays()}>{(day) =>
          <div
            class={[
              "prgm-mini-day",
              isInSelectedWeek(day) ? "prgm-mini-day-sel" : "",
              isSameDay(day, new Date()) ? "prgm-mini-day-today" : "",
              day.getMonth() !== miniMonth().month ? "prgm-mini-day-other" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => { selectWeekContaining(day); if (opts.closeOnPick) setCalendarOpen(false); }}
          >{day.getDate()}</div>
        }</For>
      </div>
    </div>
  );

  return (
    <div class="prgm-page-wrap">
      {/* ── Sidebar (doar pe desktop) ──────────────────────────────────── */}
      <aside class="prgm-sidebar">
        <button class="btn btn-ghost btn-sm w-full" onClick={() => { setWeekOffset(0); scrollToNow(); }}>Azi</button>
        {renderMiniCal()}
      </aside>

    <div class="prgm-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div class="prgm-header">
        <button class="btn btn-ghost btn-sm prgm-calendar-btn" onClick={() => setCalendarOpen(true)}>📅 Calendar</button>
        <button class="btn btn-ghost btn-sm" onClick={() => { setWeekOffset(0); scrollToNow(); }}>Azi</button>
        <button class="btn btn-primary btn-sm" onClick={openCreateModal}>+ Programare nouă</button>
        <input
          class="input prgm-search"
          placeholder="Caută titlu sau client..."
          value={q()}
          onInput={(e) => setQ(e.currentTarget.value)}
        />
        <div class="prgm-week-nav">
          <button class="btn btn-ghost btn-sm" aria-label="Săptămâna anterioară" onClick={() => setWeekOffset(weekOffset() - 1)}>‹</button>
          <span class="prgm-week-label">{weekLabel()}</span>
          <button class="btn btn-ghost btn-sm" aria-label="Săptămâna următoare" onClick={() => setWeekOffset(weekOffset() + 1)}>›</button>
        </div>
        <Popover
          class="prgm-emp-filter"
          open={empPopOpen()}
          onClose={() => setEmpPopOpen(false)}
          label="Filtru angajat"
          trigger={
            <button
              type="button"
              class={`btn btn-ghost btn-sm prgm-emp-trigger${empFilterActive() ? " prgm-emp-trigger--active" : ""}`}
              aria-haspopup="true"
              aria-expanded={empPopOpen()}
              onClick={() => setEmpPopOpen((o) => !o)}
            >
              <Show when={empFilter().length === 1} fallback={<span aria-hidden="true">👥</span>}>
                <EmpAvatar emp={filterEmp()} class="prgm-emp-av--sm" />
              </Show>
              <span class="prgm-emp-trigger-label">{empFilterLabel()}</span>
              <span aria-hidden="true">▾</span>
            </button>
          }
        >
          <div class="prgm-pop-list">
            <button type="button" class="prgm-pop-item" aria-selected={!empFilterActive()} onClick={clearEmpFilter}>
              <span class="prgm-emp-av" aria-hidden="true">👥</span>Toți angajații
            </button>
            <label class="prgm-pop-item" aria-selected={empFilterHas("none")}>
              <input type="checkbox" checked={empFilterHas("none")} onChange={(e) => toggleEmpFilter("none", e.currentTarget.checked)} />
              <EmpAvatar emp={null} />Neasignate
            </label>
            <div class="prgm-pop-sep" />
            <For each={employees()}>{(e) =>
              <label class="prgm-pop-item" aria-selected={empFilterHas(e.id)}>
                <input type="checkbox" checked={empFilterHas(e.id)} onChange={(ev) => toggleEmpFilter(e.id, ev.currentTarget.checked)} />
                <EmpAvatar emp={e} />{e.name}
              </label>
            }</For>
            <Show when={employees().length === 0}>
              <div class="prgm-pop-empty">Niciun angajat pe această locație</div>
            </Show>
          </div>
        </Popover>
        <div class="prgm-dept-chips">
          <button
            class={`prgm-chip${selectedDept() === null ? " prgm-chip-active" : ""}`}
            onClick={() => setSelectedDept(null)}
          >Toate</button>
          <For each={visibleDepartments()}>{(dept) => {
            const color = () => deptColorMap().get(dept.id) ?? "#6b7280";
            return (
              <button
                class="prgm-chip"
                style={selectedDept() === dept.id
                  ? `background:${color()};color:#fff;border-color:${color()}`
                  : `background:${color()}22;color:${color()};border-color:${color()}66`}
                onClick={() => setSelectedDept(selectedDept() === dept.id ? null : dept.id)}
              >{dept.name}</button>
            );
          }}</For>
          <Show when={canManage()}>
            <Popover
              class="prgm-visib-wrap"
              open={visibPopOpen()}
              onClose={() => setVisibPopOpen(false)}
              label="Divizii afișate"
              trigger={
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  title="Divizii afișate în Programări (setare de cont)"
                  aria-haspopup="true"
                  aria-expanded={visibPopOpen()}
                  onClick={() => setVisibPopOpen((o) => !o)}
                >
                  ⚙
                  <Show when={hiddenDeptCount() > 0}>
                    <span class="prgm-visib-count">{visibleDepartments().length}/{catalogDepartments().length}</span>
                  </Show>
                </button>
              }
            >
              <div class="prgm-pop-head">
                <div class="prgm-pop-title">Divizii afișate</div>
                <div class="prgm-pop-hint">Se aplică pentru tot contul</div>
              </div>
              <div class="prgm-pop-list">
                <For each={catalogDepartments()}>{(d) =>
                  <label class="prgm-pop-item">
                    <input type="checkbox" checked={d.showInProgramari} onChange={(e) => void toggleDeptVisible(d, e.currentTarget.checked)} />
                    <span class="prgm-dept-swatch" style={`background:${deptColorMap().get(d.id) ?? "#6b7280"}`} />
                    {d.name}
                  </label>
                }</For>
                <Show when={catalogDepartments().length === 0}>
                  <div class="prgm-pop-empty">Nu există divizii configurate</div>
                </Show>
              </div>
              <div class="prgm-pop-foot">
                <button type="button" class="btn btn-ghost btn-sm" disabled={hiddenDeptCount() === 0} onClick={() => void showAllDepts()}>Toate</button>
                <Show when={visibSaved()}><span class="prgm-pop-saved">✓ Salvat</span></Show>
              </div>
            </Popover>
          </Show>
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      <div class="prgm-cal-wrap" ref={calWrapRef}>
        <div
          class="prgm-cal-grid"
          ref={calGridRef}
          onPointerMove={onCalPointerMove}
          onPointerUp={onCalPointerUp}
        >
          {/* Time column */}
          <div class="prgm-time-col">
            <div class="prgm-col-header" />
            <div style={`position:relative;height:${TOTAL_H}px`}>
              <For each={TIME_LABELS}>{(t) =>
                <div style={`position:absolute;top:${t.top - 7}px;right:4px;font-size:10px;color:var(--text-muted);line-height:1;user-select:none`}>
                  {t.label}
                </div>
              }</For>
            </div>
          </div>

          {/* Day columns */}
          <For each={weekDays()}>{(day, i) => {
            const todayDate = new Date();
            const isToday   = isSameDay(day, todayDate);

            return (
              <div class="prgm-day-col">
                <div class={`prgm-col-header${isToday ? " prgm-col-today" : ""}`}>
                  <span class="prgm-col-dow">{DAY_NAMES[i()]}</span>
                  <span class="prgm-col-date">{day.getDate()}</span>
                </div>
                <div class="prgm-day-body" style={`height:${TOTAL_H}px`}>
                  {/* Off-peak zones (7–8 și 17–19) */}
                  <div class="prgm-off-peak" style={`top:0;height:${OFF_TOP_H}px`} />
                  <div class="prgm-off-peak" style={`top:${OFF_BOT_TOP}px;height:${OFF_BOT_H}px`} />
                  {/* Linie ora curenta */}
                  <Show when={isToday && nowMin() >= CAL_START && nowMin() <= CAL_END}>
                    <div class="prgm-now-line" style={`top:${minToTop(nowMin())}px`} />
                  </Show>
                  {/* Slot background lines */}
                  <For each={TIME_LABELS}>{(t) =>
                    <div
                      class={`prgm-slot-line${t.isHour ? " prgm-slot-line-hour" : ""}`}
                      style={`top:${t.top}px;height:${PX_PER_HOUR / 2}px`}
                      onDblClick={() => onSlotClick(day, t.min)}
                    />
                  }</For>

                  {/* Appointments */}
                  <For each={getDayAppts(day)}>{(appt) =>
                    <div
                      style={apptStyle(appt)}
                      class={drag?.apptId === appt.id ? "prgm-appt-dragging" : ""}
                      onPointerDown={(e) => {
                        if ((e.target as HTMLElement).classList.contains("prgm-resize-handle")) return;
                        onApptPointerDown(e, appt, "move");
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDblClick={(e) => { e.stopPropagation(); if (drag || Date.now() - lastMoveEndTs < 600) return; setSelectedAppt(appt); }}
                      aria-label={`${appt.titlu}, ${formatTime(appt.startTime)}–${formatTime(appt.endTime)}, ${appt.employeeName ?? "neasignat"}`}
                    >
                      {(() => {
                        const long = dateToLocalMin(appt.endTime) - dateToLocalMin(appt.startTime) >= 45;
                        return (
                          <Show when={appt.employeeId != null || long}>
                            <span
                              class={`prgm-emp-dot${long ? "" : " prgm-emp-dot--xs"}${appt.employeeId == null ? " prgm-emp-dot--none" : ""}`}
                              title={appt.employeeName ?? "Neasignat"}
                              aria-hidden="true"
                            >{appt.employeeName ? initials(appt.employeeName) : "?"}</span>
                          </Show>
                        );
                      })()}
                      <div style="padding:2px 4px;overflow:hidden;height:calc(100% - 8px)">
                        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;padding-right:18px">{appt.titlu}</div>
                        <div style="opacity:0.9;font-size:10px">{formatTime(appt.startTime)}–{formatTime(appt.endTime)}</div>
                        <Show when={appt.clientNume}>
                          <div style="opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px">{appt.clientNume}</div>
                        </Show>
                      </div>
                      <div
                        class="prgm-resize-handle"
                        onPointerDown={(e) => { e.stopPropagation(); onApptPointerDown(e, appt, "resize"); }}
                      />
                    </div>
                  }</For>
                </div>
              </div>
            );
          }}</For>
        </div>
      </div>

      <Show when={loading()}>
        <div class="prgm-loading">Se încarcă...</div>
      </Show>

      {/* ── Action error toast ──────────────────────────────────────────── */}
      <Show when={actionError()}>
        <div class="prgm-toast-error">
          {actionError()}
          <button style="margin-left:12px;opacity:0.8;background:none;border:none;color:#fff;cursor:pointer" onClick={() => setActionError(null)}>✕</button>
        </div>
      </Show>

      {/* ── Detail modal ────────────────────────────────────────────────── */}
      <Show when={selectedAppt()}>
        {(appt) => (
          <Modal
            open
            title={appt().titlu}
            onClose={() => setSelectedAppt(null)}
            style="max-width:440px;width:100%"
            footerStyle="flex-wrap:wrap;gap:6px"
            bodyStyle="padding:16px 20px;display:grid;gap:10px;font-size:14px"
            footer={<>
              <Show when={canManage() && deleteConfirm() === appt().id}>
                <span style="font-size:13px;color:var(--danger)">Confirmi?</span>
                <button class="btn btn-sm" style="background:var(--danger,#ef4444);color:#fff" onClick={() => handleDelete(appt().id)}>Șterge</button>
                <button class="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>Nu</button>
              </Show>
              <Show when={deleteConfirm() !== appt().id}>
                <Show when={canManage()}>
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger,#ef4444)" onClick={() => setDeleteConfirm(appt().id)}>Șterge</button>
                </Show>
                <div style="flex:1" />
                <button class="btn btn-ghost btn-sm" onClick={() => openEditModal(appt())}>Editează</button>
                <Show when={appt().status === "Programat" || appt().status === "In lucru"}>
                  <button class="btn btn-primary btn-sm" onClick={() => handleStartWork(appt())}>Începe lucru</button>
                </Show>
              </Show>
            </>}
          >
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style={`display:inline-block;padding:3px 10px;border-radius:12px;background:${STATUS_COLORS[appt().status]};color:#fff;font-size:12px;font-weight:600`}>{appt().status}</span>
              <Show when={appt().departmentName}>
                <span style="color:var(--text-muted);font-size:12px">{appt().departmentName}</span>
              </Show>
            </div>
            <div class="prgm-detail-emp">
              <EmpAvatar emp={appt().employeeId != null ? empById().get(appt().employeeId!) ?? { name: appt().employeeName ?? "?" } : null} class="prgm-emp-av--md" />
              <div style="flex:1;min-width:0">
                <div class="prgm-detail-emp-role">Angajat</div>
                <select
                  class="input input-sm"
                  value={appt().employeeId ?? ""}
                  disabled={detailAssigning()}
                  aria-label="Asignează angajat"
                  onChange={(e) => void quickAssign(appt(), e.currentTarget.value ? Number(e.currentTarget.value) : null)}
                >
                  <option value="">— Neasignat —</option>
                  <For each={employees()}>{(e) => <option value={e.id}>{e.name}</option>}</For>
                  <Show when={appt().employeeId != null && !empById().has(appt().employeeId!)}>
                    <option value={appt().employeeId!}>{appt().employeeName ?? "Angajat"} (indisponibil)</option>
                  </Show>
                </select>
              </div>
            </div>
            <div>
              <span style="color:var(--text-muted);font-size:12px">Data</span><br />
              {new Date(appt().startTime).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div>
              <span style="color:var(--text-muted);font-size:12px">Interval orar</span><br />
              {formatTime(appt().startTime)} – {formatTime(appt().endTime)}
            </div>
            <Show when={appt().clientNume}>
              <div>
                <span style="color:var(--text-muted);font-size:12px">Client</span><br />
                {appt().clientNume}
              </div>
            </Show>
            <Show when={appt().notite}>
              <div>
                <span style="color:var(--text-muted);font-size:12px">Notițe</span><br />
                <span style="white-space:pre-wrap">{appt().notite}</span>
              </div>
            </Show>
          </Modal>
        )}
      </Show>

      {/* ── Calendar modal (doar pe mobil; pe desktop e în sidebar) ───── */}
      <Show when={calendarOpen()}>
        <Modal
          open
          title="Calendar"
          onClose={() => setCalendarOpen(false)}
          class="prgm-cal-modal"
          bodyStyle="display:flex;flex-direction:column;gap:10px"
          footer={<>
            <button class="btn btn-ghost btn-sm" onClick={() => setCalendarOpen(false)}>Închide</button>
          </>}
        >
          <button class="btn btn-ghost btn-sm w-full" onClick={() => { setWeekOffset(0); setCalendarOpen(false); }}>Azi</button>
          {renderMiniCal({ closeOnPick: true })}
        </Modal>
      </Show>

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <Show when={showFormModal()}>
        <Modal
          open
          title={formAppt() ? "Editează programare" : "Programare nouă"}
          onClose={() => setShowFormModal(false)}
          class="prgm-form-modal"
          closeOnEscape={false}
          bodyClass="prgm-form-body"
          footer={<>
            <button class="btn btn-ghost btn-sm" onClick={() => setShowFormModal(false)}>Anulează</button>
            <button class="btn btn-primary btn-sm" disabled={formSaving()} onClick={handleFormSave}>
              {formSaving() ? "Se salvează..." : "Salvează"}
            </button>
          </>}
        >

          {/* Titlu */}
          <input
            class="input"
            placeholder="Titlu *"
            value={formTitlu()}
            onInput={(e) => setFormTitlu(e.currentTarget.value)}
          />

          {/* Notite */}
          <textarea
            class="input"
            placeholder="Notițe (opțional)"
            rows={2}
            style="resize:vertical"
            value={formNotite()}
            onInput={(e) => setFormNotite(e.currentTarget.value)}
          />

          {/* Client search */}
          <div style="position:relative">
            <div style="display:flex;gap:6px;align-items:center">
              <input
                class="input"
                style="flex:1;font-size:13px"
                placeholder="Caută client după nume sau nr. mașină..."
                value={clientQ()}
                disabled={!!formClient()}
                onInput={(e) => { setClientQ(e.currentTarget.value); void searchClients(e.currentTarget.value); }}
                onFocus={() => { if (clientRes().length || clientQ().trim()) setClientOpen(true); }}
                onBlur={() => setTimeout(() => setClientOpen(false), 200)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchClients(clientQ(), true); } }}
              />
              <Show when={!formClient()}>
                <button
                  class="btn btn-ghost btn-sm"
                  style="white-space:nowrap;flex-shrink:0"
                  disabled={clientSearching()}
                  onClick={() => void searchClients(clientQ(), true)}
                >
                  {clientSearching() ? "..." : "Caută"}
                </button>
              </Show>
              <Show when={formClient()}>
                <button type="button" class="btn btn-ghost btn-sm" style="padding:0 8px;flex-shrink:0" onClick={clearClient} aria-label="Șterge client">✕</button>
              </Show>
            </div>
            <Show when={clientOpen()}>
              <div style="position:absolute;top:calc(100% + 2px);left:0;right:0;background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:6px;z-index:30;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.12)">
                <For each={clientRes()}>{(c) =>
                  <div
                    style="padding:8px 12px;cursor:pointer;font-size:13px;display:flex;gap:8px;align-items:center"
                    onMouseDown={() => pickClient(c)}
                  >
                    <span>{c.nume}</span>
                    <Show when={c.numar_masina}>
                      <span style="color:var(--text-muted);font-size:11px">{c.numar_masina}</span>
                    </Show>
                  </div>
                }</For>
                <Show when={clientQ().trim()}>
                  <div
                    style="padding:8px 12px;cursor:pointer;font-size:13px;color:var(--primary,#3b82f6);border-top:1px solid var(--border);display:flex;align-items:center;gap:6px"
                    onMouseDown={() => {
                      setClientOpen(false);
                      setShowClientCreate(true);
                      setClientCreateNume(clientQ());
                    }}
                  >
                    <span style="font-weight:700">+</span> Creează client nou: <em style="margin-left:2px">"{clientQ()}"</em>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Quick client create */}
          <Show when={showClientCreate()}>
            <div style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;display:grid;gap:8px;background:var(--bg-hover,#f9fafb)">
              <div style="font-size:12px;font-weight:600;color:var(--text-muted)">Client nou</div>
              <div style="display:grid;grid-template-columns:90px 1fr;gap:6px">
                <select class="input" style="font-size:12px" value={clientCreateTip()} onChange={(e) => setClientCreateTip(e.currentTarget.value as "fizic" | "juridic")}>
                  <option value="fizic">Fizic</option>
                  <option value="juridic">Juridic</option>
                </select>
                <input class="input" style="font-size:13px" placeholder="Nume *" value={clientCreateNume()} onInput={(e) => setClientCreateNume(e.currentTarget.value)} />
              </div>
              <Show when={clientCreateTip() === "fizic"}>
                <input class="input" style="font-size:13px" placeholder="CNP" aria-label="CNP" inputmode="numeric" maxlength="13" value={clientCreateCnp()} onFocus={(e) => e.currentTarget.select()} onInput={(e) => setClientCreateCnp(e.currentTarget.value)} />
              </Show>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                <input class="input" style="font-size:13px" placeholder="Telefon" value={clientCreateTelefon()} onInput={(e) => setClientCreateTelefon(e.currentTarget.value)} />
                <input class="input" style="font-size:13px" placeholder="Nr. mașină" value={clientCreateMasina()} onInput={(e) => setClientCreateMasina(e.currentTarget.value)} />
              </div>
              <div style="display:flex;gap:6px;justify-content:flex-end">
                <button class="btn btn-ghost btn-sm" onClick={() => setShowClientCreate(false)}>Anulează</button>
                <button class="btn btn-primary btn-sm" disabled={clientCreateSaving() || !clientCreateNume().trim()} onClick={handleClientCreate}>
                  {clientCreateSaving() ? "Se salvează..." : "Salvează client"}
                </button>
              </div>
            </div>
          </Show>

          {/* Date + time grid */}
          <div class="prgm-form-row3">
            <div>
              <div class="prgm-form-label">Data</div>
              <input
                class="input"
                type="date"
                value={dateToInputValue(formDay())}
                onInput={(e) => setFormDay(new Date(e.currentTarget.value + "T00:00:00"))}
              />
            </div>
            <div>
              <div class="prgm-form-label">Ora start</div>
              <input
                class="input"
                type="time"
                step={1800}
                value={minToTimeInput(formStartMin())}
                onInput={(e) => {
                  const m = timeInputToMin(e.currentTarget.value);
                  setFormStartMin(m);
                  if (formEndMin() <= m) setFormEndMin(m + 60);
                }}
              />
            </div>
            <div>
              <div class="prgm-form-label">Ora sfârșit</div>
              <input
                class="input"
                type="time"
                step={1800}
                value={minToTimeInput(formEndMin())}
                onInput={(e) => setFormEndMin(timeInputToMin(e.currentTarget.value))}
              />
            </div>
          </div>

          {/* Duration quick buttons */}
          <div>
            <div class="prgm-form-label">Durată rapidă</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <For each={[30, 40, 50, 60, 90, 120]}>{(dur) =>
                <button
                  class="btn btn-ghost btn-sm"
                  style="font-size:12px;min-width:52px"
                  onClick={() => setFormEndMin(formStartMin() + dur)}
                >{dur} min</button>
              }</For>
            </div>
          </div>

          {/* Status + Departament */}
          <div class="prgm-form-row2">
            <div>
              <div class="prgm-form-label">Status</div>
              <select class="input" style="font-size:13px" value={formStatus()} onChange={(e) => setFormStatus(e.currentTarget.value as ProgramareStatus)}>
                <option value="Programat">Programat</option>
                <option value="In lucru">In lucru</option>
                <option value="Executat">Executat</option>
                <option value="Anulat">Anulat</option>
              </select>
            </div>
            <div>
              <div class="prgm-form-label">Departament</div>
              <select class="input" style="font-size:13px" value={formDeptId() ?? ""} onChange={(e) => setFormDeptId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
                <option value="">— niciun departament —</option>
                <For each={visibleDepartments()}>{(d) =>
                  <option value={d.id}>{d.name}</option>
                }</For>
                <For each={catalogDepartments().filter((d) => !d.showInProgramari && d.id === formAppt()?.departmentId)}>{(d) =>
                  <option value={d.id}>{d.name} (ascunsă)</option>
                }</For>
              </select>
            </div>
          </div>

          {/* Angajat */}
          <div>
            <div class="prgm-form-label">Angajat</div>
            <div class="prgm-form-emp">
              <EmpAvatar emp={formEmployeeId() != null ? empById().get(formEmployeeId()!) ?? { name: formAppt()?.employeeName ?? "?" } : null} class="prgm-emp-av--md" />
              <select class="input" style="font-size:13px" value={formEmployeeId() ?? ""} onChange={(e) => setFormEmployeeId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
                <option value="">— Neasignat —</option>
                <For each={employees()}>{(e) => <option value={e.id}>{e.name}</option>}</For>
                <Show when={formAppt()?.employeeId != null && !empById().has(formAppt()!.employeeId!)}>
                  <option value={formAppt()!.employeeId!}>{formAppt()!.employeeName ?? "Angajat"} (indisponibil)</option>
                </Show>
              </select>
            </div>
          </div>

          <Show when={formError()}>
            <span style="color:var(--danger,#ef4444);font-size:13px">{formError()}</span>
          </Show>
        </Modal>
      </Show>
    </div>
    </div>
  );
}
