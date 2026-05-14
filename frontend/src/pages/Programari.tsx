import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { device } from "../store/deviceStore";
import { catalogDepartments, loadCatalogDepartments } from "../store/catalogThemesStore";
import {
  programari, loading,
  loadProgramari, createProgramare, updateProgramare, deleteProgramare,
} from "../store/programariStore";
import type { Programare, ProgramareStatus, ProgramareInput } from "../store/programariStore";
import { triggerLoad } from "../store/resumeStore";
import { adminVisible } from "../store/adminStore";
import { notify } from "../store/notificationsStore";
import { apiFetch } from "../utils/api";

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

function calcColumns(appts: Programare[]): ApptWithCol[] {
  if (appts.length === 0) return [];
  const sorted = [...appts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const colEnds: Array<number> = [0, 0, 0];
  const assigned: ApptWithCol[] = [];

  for (const appt of sorted) {
    const startMs = new Date(appt.startTime).getTime();
    let col = 0;
    for (let i = 0; i < 3; i++) {
      if (colEnds[i] <= startMs) { col = i; break; }
      if (i === 2) col = 0;
    }
    colEnds[col] = new Date(appt.endTime).getTime();
    assigned.push({ ...appt, colIdx: col, colCount: 1 });
  }

  // Compute colCount per overlap group
  for (let i = 0; i < assigned.length; i++) {
    const a      = assigned[i];
    const aStart = new Date(a.startTime).getTime();
    const aEnd   = new Date(a.endTime).getTime();
    let maxCol   = a.colIdx;
    for (let j = 0; j < assigned.length; j++) {
      if (i === j) continue;
      const b = assigned[j];
      if (new Date(b.startTime).getTime() < aEnd && new Date(b.endTime).getTime() > aStart) {
        if (b.colIdx > maxCol) maxCol = b.colIdx;
      }
    }
    assigned[i] = { ...assigned[i], colCount: maxCol + 1 };
  }
  return assigned;
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function Programari() {
  const navigate = useNavigate();

  const [weekOffset,    setWeekOffset]    = createSignal(0);
  const [selectedDept,  setSelectedDept]  = createSignal<number | null>(null);
  const [q,             setQ]             = createSignal("");
  const [selectedAppt,  setSelectedAppt]  = createSignal<Programare | null>(null);
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [formAppt,      setFormAppt]      = createSignal<Programare | null>(null);
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);
  const [actionError,   setActionError]   = createSignal<string | null>(null);
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

  let calGridRef!: HTMLDivElement;

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
    await loadCatalogDepartments(); // load all departments, not filtered by location
    await reloadAppts();
    const timer = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  async function reloadAppts() {
    const locId = locationId();
    if (locId == null) return;
    const days = weekDays();
    const from = new Date(days[0]); from.setHours(0, 0, 0, 0);
    const to   = new Date(days[6]); to.setHours(23, 59, 59, 999);
    await loadProgramari(locId, from.toISOString(), to.toISOString());
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

  // ─── Form state ───────────────────────────────────────────────────────────

  const [formDay,      setFormDay]      = createSignal<Date>(new Date());
  const [formStartMin, setFormStartMin] = createSignal(9 * 60);
  const [formEndMin,   setFormEndMin]   = createSignal(10 * 60);
  const [formTitlu,    setFormTitlu]    = createSignal("");
  const [formNotite,   setFormNotite]   = createSignal("");
  const [formDeptId,   setFormDeptId]   = createSignal<number | null>(null);
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
  const [clientCreateSaving,  setClientCreateSaving]  = createSignal(false);

  function initForm(day: Date, startMin: number, endMin: number) {
    setFormDay(day); setFormStartMin(startMin); setFormEndMin(endMin);
    setFormTitlu(""); setFormNotite("");
    setFormDeptId(selectedDept()); setFormStatus("Programat");
    setFormClient(null); setClientQ(""); setClientRes([]); setClientOpen(false);
    setShowClientCreate(false); setClientCreateNume(""); setClientCreateTelefon(""); setClientCreateMasina(""); setClientCreateTip("fizic");
    setFormError(null);
  }

  async function searchClients(val: string) {
    if (!val.trim()) { setClientRes([]); setClientOpen(false); return; }
    setClientSearching(true);
    try {
      const res = await apiFetch(`/api/clienti?q=${encodeURIComponent(val)}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setClientRes((data.items ?? []).map((c: any) => ({ id: c.id, nume: c.nume, numar_masina: c.numar_masina ?? null })));
      setClientOpen(true); // deschide mereu — chiar si gol, sa arate optiunea de creare
    } finally { setClientSearching(false); }
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
    setClientCreateSaving(true);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: clientCreateTip(),
          nume: clientCreateNume().trim(),
          telefon: clientCreateTelefon().trim() || null,
          numar_masina: clientCreateMasina().trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Eroare la creare client.");
      const data = await res.json();
      pickClient({ id: data.id, nume: data.nume, numar_masina: data.numar_masina ?? null });
      setShowClientCreate(false);
      setClientCreateNume(""); setClientCreateTelefon(""); setClientCreateMasina("");
      setClientCreateTip("fizic");
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

  return (
    <div class="prgm-page">
      {/* ── Left sidebar — mini calendar ────────────────────────────────── */}
      <div class="prgm-sidebar">
        <button class="btn btn-ghost btn-sm prgm-sidebar-today" onClick={() => setWeekOffset(0)}>Azi</button>
        <div class="prgm-mini-cal">
          <div class="prgm-mini-cal-header">
            <button class="btn btn-ghost btn-sm" style="padding:0 6px" onClick={prevMiniMonth}>‹</button>
            <span class="prgm-mini-cal-title">{miniMonthLabel()}</span>
            <button class="btn btn-ghost btn-sm" style="padding:0 6px" onClick={nextMiniMonth}>›</button>
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
                onClick={() => selectWeekContaining(day)}
              >{day.getDate()}</div>
            }</For>
          </div>
        </div>
        <button class="btn btn-primary btn-sm prgm-sidebar-new" onClick={openCreateModal}>+ Programare nouă</button>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div class="prgm-main">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div class="prgm-header">
        <input
          class="input prgm-search"
          placeholder="Caută titlu sau client..."
          value={q()}
          onInput={(e) => setQ(e.currentTarget.value)}
        />
        <span class="prgm-week-label">{weekLabel()}</span>
        <div class="prgm-dept-chips">
          <button
            class={`prgm-chip${selectedDept() === null ? " prgm-chip-active" : ""}`}
            onClick={() => setSelectedDept(null)}
          >Toate</button>
          <For each={catalogDepartments()}>{(dept) => {
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
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      <div class="prgm-cal-wrap">
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
                      onClick={() => onSlotClick(day, t.min)}
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
                      onClick={(e) => { if (drag) return; e.stopPropagation(); setSelectedAppt(appt); }}
                    >
                      <div style="padding:2px 4px;overflow:hidden;height:calc(100% - 8px)">
                        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px">{appt.titlu}</div>
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
      </div>{/* end prgm-main */}

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
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:440px;width:100%" onClick={(e) => e.stopPropagation()}>
              <div class="sl-modal-header">
                <span class="sl-modal-title">{appt().titlu}</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setSelectedAppt(null)}>✕</button>
              </div>
              <div class="sl-modal-body" style="padding:16px 20px;display:grid;gap:10px;font-size:14px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style={`display:inline-block;padding:3px 10px;border-radius:12px;background:${STATUS_COLORS[appt().status]};color:#fff;font-size:12px;font-weight:600`}>{appt().status}</span>
                  <Show when={appt().departmentName}>
                    <span style="color:var(--text-muted);font-size:12px">{appt().departmentName}</span>
                  </Show>
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
              </div>
              <div class="sl-modal-footer" style="flex-wrap:wrap;gap:6px">
                <Show when={adminVisible() && deleteConfirm() === appt().id}>
                  <span style="font-size:13px;color:var(--danger)">Confirmi?</span>
                  <button class="btn btn-sm" style="background:var(--danger,#ef4444);color:#fff" onClick={() => handleDelete(appt().id)}>Șterge</button>
                  <button class="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>Nu</button>
                </Show>
                <Show when={deleteConfirm() !== appt().id}>
                  <Show when={adminVisible()}>
                    <button class="btn btn-ghost btn-sm" style="color:var(--danger,#ef4444)" onClick={() => setDeleteConfirm(appt().id)}>Șterge</button>
                  </Show>
                  <div style="flex:1" />
                  <button class="btn btn-ghost btn-sm" onClick={() => openEditModal(appt())}>Editează</button>
                  <Show when={appt().status === "Programat" || appt().status === "In lucru"}>
                    <button class="btn btn-primary btn-sm" onClick={() => handleStartWork(appt())}>Începe lucru</button>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <Show when={showFormModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:640px;width:100%" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">{formAppt() ? "Editează programare" : "Programare nouă"}</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowFormModal(false)}>✕</button>
            </div>
            <div class="sl-modal-body" style="padding:14px 18px;display:grid;gap:10px;overflow-y:auto;max-height:85vh">

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
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchClients(clientQ()); } }}
                  />
                  <Show when={!formClient()}>
                    <button
                      class="btn btn-ghost btn-sm"
                      style="white-space:nowrap;flex-shrink:0"
                      disabled={clientSearching()}
                      onClick={() => void searchClients(clientQ())}
                    >
                      {clientSearching() ? "..." : "Caută"}
                    </button>
                  </Show>
                  <Show when={formClient()}>
                    <button class="btn btn-ghost btn-sm" style="padding:0 8px;flex-shrink:0" onClick={clearClient}>✕</button>
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
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
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
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
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
                    <For each={catalogDepartments()}>{(d) =>
                      <option value={d.id}>{d.name}</option>
                    }</For>
                  </select>
                </div>
              </div>

              <Show when={formError()}>
                <span style="color:var(--danger,#ef4444);font-size:13px">{formError()}</span>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowFormModal(false)}>Anulează</button>
              <button class="btn btn-primary btn-sm" disabled={formSaving()} onClick={handleFormSave}>
                {formSaving() ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
