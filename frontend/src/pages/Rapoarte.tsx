import { For, Show, Switch, Match, createSignal, onMount, createMemo, onCleanup, createEffect } from "solid-js";
import * as d3 from "d3";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";

interface EmployeeReport {
  id: number;
  name: string;
  description: string | null;
  target: string;
  current_target_accumulation: string;
  image_path: string | null;
}

const SECTIONS = [
  { id: "target-angajati", label: "Target Angajați" },
  { id: "locatii", label: "Locații" },
  { id: "produse-servicii", label: "Produse / Servicii" },
  { id: "angajati", label: "Angajați" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

function Avatar(props: { name: string; imagePath: string | null; size?: number }) {
  const size = () => props.size ?? 32;
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

function daysElapsedThisMonth(): number {
  const now = new Date();
  return now.getDate(); // day of month = days elapsed since start (inclusive)
}

function EmployeePopup(props: {
  employee: EmployeeReport;
  onClose: () => void;
}) {
  const e = props.employee;
  const acc = parseFloat(e.current_target_accumulation);
  const tgt = parseFloat(e.target);
  const progressPct = tgt > 0 ? (acc / tgt) * 100 : 0;
  const days = daysElapsedThisMonth();

  const fmt = (v: number) =>
    v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const barColor = progressPct >= 100 ? "var(--success,#3ea96a)" : "var(--accent,#5b7cfa)";

  let timer: ReturnType<typeof setTimeout>;
  onMount(() => {
    timer = setTimeout(props.onClose, 5000);
  });
  onCleanup(() => clearTimeout(timer));

  return (
    <div class="emp-popup-overlay" onClick={props.onClose}>
      <div class="emp-popup" onClick={(ev) => ev.stopPropagation()}>
        <button class="emp-popup__close" onClick={props.onClose} aria-label="Închide">✕</button>
        <div class="emp-popup__avatar">
          <Avatar name={e.name} imagePath={e.image_path} size={72} />
        </div>
        <div class="emp-popup__name">{e.name}</div>

        <div class="emp-popup__stats">
          <div class="emp-popup__stat">
            <span class="emp-popup__stat-label">Acumulare</span>
            <span class="emp-popup__stat-value">{fmt(acc)} lei</span>
          </div>
          <div class="emp-popup__stat">
            <span class="emp-popup__stat-label">Target lunar</span>
            <span class="emp-popup__stat-value">{fmt(tgt)} lei</span>
          </div>
          <div class="emp-popup__stat">
            <span class="emp-popup__stat-label">Progres</span>
            <span class="emp-popup__stat-value" style={`color:${barColor};font-weight:700`}>
              {Math.round(progressPct)}%
            </span>
          </div>
          <div class="emp-popup__stat">
            <span class="emp-popup__stat-label">Zile scurse din lună</span>
            <span class="emp-popup__stat-value">{days} zile</span>
          </div>
        </div>

        {/* Mini progress bar */}
        <div style="margin-top:14px;background:var(--border,#e5e7eb);border-radius:4px;height:8px;overflow:hidden">
          <div style={`height:100%;width:${Math.min(progressPct, 100)}%;background:${barColor};border-radius:4px;transition:width 0.4s ease`} />
        </div>
        <p style="font-size:0.72rem;color:var(--text-muted);margin:6px 0 0;text-align:right">
          Se închide automat în 5 s
        </p>
      </div>
    </div>
  );
}

function TargetAngajatiPanel() {
  const [employees, setEmployees] = createSignal<EmployeeReport[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [sortBy, setSortBy] = createSignal<"target" | "name">("target");
  const [popup, setPopup] = createSignal<EmployeeReport | null>(null);
  const [selectedDescs, setSelectedDescs] = createSignal<Set<string>>(new Set());
  const [showZeroTarget, setShowZeroTarget] = createSignal(false);

  onMount(async () => {
    // Dashboardul agregheaza target-uri client-side, deci avem nevoie de toti
    // angajatii. Iteram cu offset pana epuizam pagina (pagina marime 200).
    const all: EmployeeReport[] = [];
    const PAGE = 200;
    let offset = 0;
    try {
      while (true) {
        const res = await apiFetch(`/api/employees?limit=${PAGE}&offset=${offset}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as { items: EmployeeReport[]; total?: number };
        const items = data.items ?? [];
        all.push(...items);
        if (items.length < PAGE) break;
        offset += PAGE;
        if (offset > 5000) break; // safeguard impotriva loop-ului
      }
      setEmployees(all);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Eroare la încărcare angajați.";
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  });

  // Employees with progress >= 1% (base pool, respects showZeroTarget toggle)
  const withTarget = createMemo(() =>
    showZeroTarget()
      ? employees()
      : employees().filter(e => {
          const tgt = parseFloat(e.target);
          const acc = parseFloat(e.current_target_accumulation);
          const pct = tgt > 0 ? (acc / tgt) * 100 : 0;
          return pct >= 1;
        })
  );

  // Unique descriptions only from the base pool (so chips reflect visible employees)
  const uniqueDescs = createMemo(() => {
    const set = new Set<string>();
    for (const e of withTarget()) {
      if (e.description?.trim()) set.add(e.description.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ro"));
  });

  function toggleDesc(desc: string) {
    setSelectedDescs(prev => {
      const next = new Set(prev);
      if (next.has(desc)) next.delete(desc);
      else next.add(desc);
      return next;
    });
  }

  const filtered = createMemo(() => {
    const sel = selectedDescs();
    if (sel.size === 0) return withTarget();
    return withTarget().filter(e => e.description?.trim() && sel.has(e.description.trim()));
  });

  const sorted = createMemo(() => {
    const list = [...filtered()];
    if (sortBy() === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    }
    return list.sort(
      (a, b) =>
        parseFloat(b.current_target_accumulation) - parseFloat(a.current_target_accumulation)
    );
  });

  const maxValue = createMemo(() => {
    const vals = sorted().map(e =>
      Math.max(parseFloat(e.current_target_accumulation), parseFloat(e.target))
    );
    return Math.max(...vals, 1);
  });

  const fmt = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Target Angajați" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:8px;max-width:620px;line-height:1.6">
          Graficul afișează acumularea curentă a targetului pentru fiecare angajat. Bara colorată
          reprezintă valoarea vânzărilor înregistrate în perioada curentă. Linia orizontală indică
          targetul lunar setat. Apasă pe o bară pentru detalii. Targetul se configurează din{" "}
          <strong>Configurări → Angajați</strong>.
        </p>
      </Show>

      {/* Sort controls + zero-target toggle */}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <button
          class="btn btn-sm"
          classList={{ "btn-primary": sortBy() === "target", "btn-ghost": sortBy() !== "target" }}
          onClick={() => setSortBy("target")}
        >
          După target
        </button>
        <button
          class="btn btn-sm"
          classList={{ "btn-primary": sortBy() === "name", "btn-ghost": sortBy() !== "name" }}
          onClick={() => setSortBy("name")}
        >
          După nume
        </button>
        <button
          class="btn btn-sm"
          classList={{ "btn-primary": showZeroTarget(), "btn-ghost": !showZeroTarget() }}
          onClick={() => { setShowZeroTarget(v => !v); setSelectedDescs(new Set<string>()); }}
          style="margin-left:auto"
        >
          {showZeroTarget() ? "Ascunde fără target" : "Arată fără target"}
        </button>
      </div>

      {/* Description filter chips */}
      <Show when={uniqueDescs().length > 0}>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:0.78rem;color:var(--text-muted);flex-shrink:0">Filtrează:</span>
          <For each={uniqueDescs()}>
            {(desc) => (
              <button
                class="desc-chip"
                classList={{ "desc-chip--active": selectedDescs().has(desc) }}
                onClick={() => toggleDesc(desc)}
              >
                {desc}
              </button>
            )}
          </For>
          <Show when={selectedDescs().size > 0}>
            <button
              class="desc-chip desc-chip--clear"
              onClick={() => setSelectedDescs(new Set())}
            >
              ✕ Resetează
            </button>
          </Show>
        </div>
      </Show>

      {/* Legend */}
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted)">
          <div style="width:14px;height:14px;border-radius:3px;background:var(--accent,#5b7cfa)" />
          Acumulare curentă
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted)">
          <div style="width:20px;height:2px;background:#FFD700;opacity:0.9;border-radius:1px" />
          Target lunar
        </div>
      </div>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>

      <Show when={!loading() && sorted().length === 0}>
        <p class="cfg-hint">Nu există angajați înregistrați.</p>
      </Show>

      <Show when={!loading() && sorted().length > 0}>
        <div class="rapoarte-chart-wrap">
          <div class="rapoarte-bars">
            <For each={sorted()}>
              {(e) => {
                const acc = parseFloat(e.current_target_accumulation);
                const tgt = parseFloat(e.target);
                const mv = maxValue();
                const accPct = Math.min((acc / mv) * 100, 100);
                const tgtPct = tgt > 0 ? Math.min((tgt / mv) * 100, 100) : 0;
                const progressPct = tgt > 0 ? (acc / tgt) * 100 : 0;
                const barColor = progressPct >= 100
                  ? "var(--success,#3ea96a)"
                  : "var(--accent,#5b7cfa)";
                const showPct = progressPct > 0.05;

                return (
                  <div
                    class="rapoarte-col"
                    onClick={() => setPopup(e)}
                    style="cursor:pointer"
                  >
                    <div class="rapoarte-col__bar-area">
                      {/* Percentage label above bar */}
                      <Show when={showPct}>
                        <div
                          class="rapoarte-col__pct"
                          style={`bottom:calc(${accPct}% + 4px)`}
                        >
                          {Math.round(progressPct)}%
                        </div>
                      </Show>
                      <div
                        class="rapoarte-col__bar"
                        style={`height:${accPct}%;background:${barColor}`}
                      />
                      <Show when={tgtPct > 0}>
                        <div
                          class="rapoarte-col__target"
                          style={`bottom:${tgtPct}%`}
                          title={`Target: ${fmt(e.target)} lei`}
                        />
                      </Show>
                    </div>
                    <Avatar name={e.name} imagePath={e.image_path} size={28} />
                    <div class="rapoarte-col__name-wrap">
                      <span class="rapoarte-col__name">{e.name}</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      <Show when={popup() !== null}>
        <EmployeePopup employee={popup()!} onClose={() => setPopup(null)} />
      </Show>
    </div>
  );
}

// ───── LOCAȚII PANEL ──────────────────────────────────────────────────────────

interface DailyTotal {
  report_date: string;
  sum_total: string | number;
  sum_paid: string | number;
  sum_unpaid: string | number;
  count_total: number;
}

interface PayMethods {
  sum_card: string | number;
  sum_cash: string | number;
  sum_op: string | number;
  sum_partial: string | number;
  sum_neplatit: string | number;
  sum_paid: string | number;
  sum_unpaid: string | number;
}

interface LocatiiItemTypes {
  produse: string | number;
  servicii: string | number;
}

interface LocatiiMonthly {
  month: string;
  total: string | number;
  delta_pct: number | null;
}

interface LocatiiSummary {
  daily: DailyTotal[];
  pay_methods: PayMethods;
  item_types: LocatiiItemTypes;
  monthly: LocatiiMonthly[];
  total: string | number;
  bonuri: number;
  period_start: string | null;
  period_end: string | null;
}

const PAY_LABELS: Record<keyof PayMethods, string> = {
  sum_card: "Card",
  sum_cash: "Cash",
  sum_op: "OP",
  sum_partial: "Parțial",
  sum_neplatit: "Neplătit",
  sum_paid: "",
  sum_unpaid: "",
};
const PAY_COLORS = ["#5b7cfa", "#3ea96a", "#a855f7", "#f5a623", "#ef4444"];

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function firstOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtRoDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

// ───── SHARED PERIOD STATE ────────────────────────────────────────────────────

const [periodFrom, setPeriodFrom] = createSignal(firstOfMonthISO());
const [periodTo, setPeriodTo] = createSignal(todayISO());
const [periodLabel, setPeriodLabel] = createSignal("Luna aceasta");
const [periodVersion, setPeriodVersion] = createSignal(0);

function commitPeriod(from: string, to: string, label: string) {
  setPeriodFrom(from);
  setPeriodTo(to);
  setPeriodLabel(label);
  setPeriodVersion((v) => v + 1);
}

// ───── EXPLANATIONS TOGGLE (persistat în localStorage) ────────────────────────

const HIDE_EXPL_KEY = "rapoarte_hide_explanations";

function _initialHideExplanations(): boolean {
  try {
    return localStorage.getItem(HIDE_EXPL_KEY) === "1";
  } catch {
    return false;
  }
}

const [hideExplanations, setHideExplanationsRaw] = createSignal(_initialHideExplanations());

function setHideExplanations(v: boolean) {
  setHideExplanationsRaw(v);
  try {
    localStorage.setItem(HIDE_EXPL_KEY, v ? "1" : "0");
  } catch {
    // localStorage indisponibil — păstrăm doar starea în memorie
  }
}

function ExplanationsToggle() {
  return (
    <label class="explanations-toggle">
      <input
        type="checkbox"
        checked={hideExplanations()}
        onChange={(e) => setHideExplanations(e.currentTarget.checked)}
      />
      <span>Ascunde explicațiile</span>
    </label>
  );
}

function PanelHeader(props: { title: string }) {
  return (
    <div class="panel-header-row">
      <h2 class="cfg-panel-title" style="margin:0">{props.title}</h2>
      <ExplanationsToggle />
    </div>
  );
}

// ───── PERIOD SLICER ──────────────────────────────────────────────────────────

type QuickKey = "today" | "7d" | "30d" | "mtd" | "qtd" | "ytd" | "12m";

function PeriodSlicer() {
  const [activeQuick, setActiveQuick] = createSignal<QuickKey | null>("mtd");
  const [draftFrom, setDraftFrom] = createSignal(periodFrom());
  const [draftTo, setDraftTo] = createSignal(periodTo());

  // Slider range = anul curent (1 ian – 31 dec)
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000);

  function pctOf(iso: string): number {
    const d = new Date(iso);
    const diff = Math.round((d.getTime() - yearStart.getTime()) / 86400000);
    return Math.max(0, Math.min(100, Math.round((diff / totalDays) * 100)));
  }
  function dateFromPct(pct: number): string {
    const d = new Date(yearStart);
    d.setDate(d.getDate() + Math.round((pct / 100) * totalDays));
    return d.toISOString().slice(0, 10);
  }

  const [sliderMin, setSliderMin] = createSignal(pctOf(draftFrom()));
  const [sliderMax, setSliderMax] = createSignal(pctOf(draftTo()));

  function applyQuick(key: QuickKey) {
    const now = new Date();
    let from = new Date(now);
    const to = new Date(now);
    let label = "";
    if (key === "today") { label = "Azi"; }
    else if (key === "7d") { from.setDate(from.getDate() - 6); label = "Ultimele 7 zile"; }
    else if (key === "30d") { from.setDate(from.getDate() - 29); label = "Ultimele 30 zile"; }
    else if (key === "mtd") { from = new Date(now.getFullYear(), now.getMonth(), 1); label = "Luna aceasta"; }
    else if (key === "qtd") {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1); label = "Trim. curent";
    }
    else if (key === "ytd") { from = new Date(now.getFullYear(), 0, 1); label = "An curent"; }
    else if (key === "12m") { from.setFullYear(from.getFullYear() - 1); label = "12 luni"; }
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    setDraftFrom(f); setDraftTo(t);
    setSliderMin(pctOf(f)); setSliderMax(pctOf(t));
    setActiveQuick(key);
    commitPeriod(f, t, label);
  }

  function applyCustom() {
    if (!draftFrom() || !draftTo()) {
      notify("Selectează ambele date.", "error");
      return;
    }
    if (draftFrom() > draftTo()) {
      notify("Data de început trebuie să fie înainte de data de sfârșit.", "error");
      return;
    }
    const label = `${fmtRoDate(draftFrom())} – ${fmtRoDate(draftTo())}`;
    setActiveQuick(null);
    commitPeriod(draftFrom(), draftTo(), label);
  }

  function resetPeriod() {
    applyQuick("mtd");
  }

  function onSliderInput(which: "min" | "max", value: number) {
    let lo = sliderMin();
    let hi = sliderMax();
    if (which === "min") {
      lo = Math.min(value, hi - 1);
      setSliderMin(lo);
    } else {
      hi = Math.max(value, lo + 1);
      setSliderMax(hi);
    }
    const f = dateFromPct(lo);
    const t = dateFromPct(hi);
    setDraftFrom(f); setDraftTo(t);
    setActiveQuick(null);
  }

  return (
    <div class="slicer-bar">
      <span class="slicer-title">Perioadă</span>
      <div class="slicer-quick-btns">
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "today" }} onClick={() => applyQuick("today")}>Azi</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "7d" }} onClick={() => applyQuick("7d")}>7 zile</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "30d" }} onClick={() => applyQuick("30d")}>30 zile</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "mtd" }} onClick={() => applyQuick("mtd")}>Luna aceasta</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "qtd" }} onClick={() => applyQuick("qtd")}>Trim. curent</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "ytd" }} onClick={() => applyQuick("ytd")}>An curent</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "12m" }} onClick={() => applyQuick("12m")}>12 luni</button>
      </div>
      <div class="slicer-sep" />
      <div class="slicer-range-inputs">
        <input type="date" value={draftFrom()} onInput={(e) => { setDraftFrom(e.currentTarget.value); setSliderMin(pctOf(e.currentTarget.value)); setActiveQuick(null); }} />
        <span class="slicer-dash">→</span>
        <input type="date" value={draftTo()} onInput={(e) => { setDraftTo(e.currentTarget.value); setSliderMax(pctOf(e.currentTarget.value)); setActiveQuick(null); }} />
      </div>
      <div class="slicer-sep" />
      <div class="slicer-slider-wrap">
        <div class="slicer-slider-track">
          <div class="slicer-slider-range" style={`left:${sliderMin()}%;width:${sliderMax() - sliderMin()}%`} />
          <input
            type="range" min="0" max="100" value={sliderMin()}
            onInput={(e) => onSliderInput("min", parseInt(e.currentTarget.value))}
          />
          <input
            type="range" min="0" max="100" value={sliderMax()}
            onInput={(e) => onSliderInput("max", parseInt(e.currentTarget.value))}
          />
        </div>
        <div class="slicer-slider-labels">
          <span>{fmtRoDate(dateFromPct(sliderMin()))}</span>
          <span>{fmtRoDate(dateFromPct(sliderMax()))}</span>
        </div>
      </div>
      <div class="slicer-sep" />
      <div class="slicer-active-wrap">
        <span class="slicer-active-label">{periodLabel()}</span>
        <button class="slicer-apply-btn" onClick={applyCustom}>Aplică</button>
        <button class="slicer-reset-btn" onClick={resetPeriod}>Reset</button>
      </div>
    </div>
  );
}

function LocatiiPanel() {
  const [data, setData] = createSignal<LocatiiSummary | null>(null);
  const [loading, setLoading] = createSignal(true);

  let lineRef: HTMLDivElement | undefined;
  let donutRef: HTMLDivElement | undefined;
  let itypeDonutRef: HTMLDivElement | undefined;
  let momRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      const res = await apiFetch(`/api/reports/locatii?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch (e: unknown) {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Reîncarcă la fiecare schimbare de perioadă
  createEffect(() => { periodVersion(); void load(); });

  createEffect(() => {
    const d = data();
    if (!d || !lineRef) return;
    drawLine(lineRef, d.daily);
  });

  createEffect(() => {
    const d = data();
    if (!d || !donutRef) return;
    const items: DonutItem[] = [
      { label: "Card", value: toNumber(d.pay_methods.sum_card), color: PAY_COLORS[0] },
      { label: "Cash", value: toNumber(d.pay_methods.sum_cash), color: PAY_COLORS[1] },
      { label: "OP", value: toNumber(d.pay_methods.sum_op), color: PAY_COLORS[2] },
      { label: "Parțial", value: toNumber(d.pay_methods.sum_partial), color: PAY_COLORS[3] },
      { label: "Neplătit", value: toNumber(d.pay_methods.sum_neplatit), color: PAY_COLORS[4] },
    ].filter((i) => i.value > 0);
    drawDonut(donutRef, items, "lei total");
  });

  createEffect(() => {
    const d = data();
    if (!d || !itypeDonutRef) return;
    const items: DonutItem[] = [
      { label: "Produse", value: toNumber(d.item_types.produse), color: PALETTE[0] },
      { label: "Servicii", value: toNumber(d.item_types.servicii), color: PALETTE[1] },
    ].filter((i) => i.value > 0);
    drawDonut(itypeDonutRef, items, "lei total");
  });

  createEffect(() => {
    const d = data();
    if (!d || !momRef) return;
    const items: MonthlyItem[] = d.monthly.map((m) => ({
      month: m.month,
      total: toNumber(m.total),
      delta_pct: m.delta_pct,
    }));
    drawMonthlyBars(momRef, items);
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Locații" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:780px;line-height:1.6">
          Această secțiune afișează venitul agregat pentru perioada selectată. Datele sunt
          precalculate noaptea de un proces automat și re-validate săptămânal pentru
          eventualele modificări retroactive. Folosește slicer-ul de mai jos pentru a alege
          intervalul de timp.
        </p>
      </Show>

      <PeriodSlicer />

      {/* KPI rezumat */}
      <Show when={data()}>
        {(d) => (
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0">
            <div class="locatii-kpi"><span class="locatii-kpi__label">Venit total</span><span class="locatii-kpi__value">{fmtMoney(toNumber(d().total))} lei</span></div>
            <div class="locatii-kpi"><span class="locatii-kpi__label">Bonuri</span><span class="locatii-kpi__value">{d().bonuri}</span></div>
            <div class="locatii-kpi"><span class="locatii-kpi__label">Plătit</span><span class="locatii-kpi__value">{fmtMoney(toNumber(d().pay_methods.sum_paid))} lei</span></div>
            <div class="locatii-kpi"><span class="locatii-kpi__label">Neplătit</span><span class="locatii-kpi__value" style="color:var(--danger,#ef4444)">{fmtMoney(toNumber(d().pay_methods.sum_unpaid))} lei</span></div>
          </div>
        )}
      </Show>

      {/* Charts */}
      <div class="locatii-charts">
        <div class="locatii-chart-card" style="flex:2;min-width:0">
          <div class="locatii-chart-title">Venituri totale</div>
          <div class="locatii-chart-subtitle">Sumă zilnică din toate bonurile (lei) — neșterse, indiferent de status plată</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Linia arată cum a evoluat <strong>încasarea facturată zilnic</strong> pe parcursul
              perioadei. Aria umbrită sub linie are doar rol vizual. Trecând cu mouse-ul peste linie
              poți vedea suma exactă pentru ziua respectivă. Sunt incluse toate bonurile (plătite,
              parțiale și neplătite) — pentru cashflow real folosește KPI-ul „Plătit".
            </p>
          </Show>
          <div ref={lineRef} style="margin-top:8px" />
          <Show when={data() && data()!.daily.length === 0}>
            <div style="text-align:center;padding:32px;color:var(--text-muted);font-size:0.85rem">
              Niciun receipt în perioada selectată.
            </div>
          </Show>
        </div>
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Mix metode de plată</div>
          <div class="locatii-chart-subtitle">Procent din venit per metodă</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Fiecare felie reprezintă o metodă de plată. Pentru bonurile parțiale e luată doar
              suma efectiv încasată. Treci cu mouse-ul peste felie pentru detalii. Util pentru a
              vedea ce procent din vânzări vine prin fiecare metodă.
            </p>
          </Show>
          <div ref={donutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
        </div>
      </div>

      {/* Produse vs Servicii donut */}
      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:260px;max-width:480px">
          <div class="locatii-chart-title">Produse vs Servicii</div>
          <div class="locatii-chart-subtitle">Contribuția produselor vs serviciilor la venit</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Arată cât din venitul total provine din vânzarea de <strong>produse</strong> versus
              prestarea de <strong>servicii</strong>. Treci cu mouse-ul peste felie pentru valoarea
              exactă. Itemii introduși manual (fără legătură cu catalogul) sunt număraţi implicit
              ca servicii.
            </p>
          </Show>
          <div ref={itypeDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
        </div>
      </div>

      {/* Month-over-Month evolution */}
      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Evoluție lunară (Month-over-Month)</div>
          <div class="locatii-chart-subtitle">Suma pe fiecare lună + diferența față de luna anterioară</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Fiecare bară reprezintă suma totală facturată într-o lună din perioada selectată.
              Deasupra fiecărei bare este afișat <strong>procentul de creștere sau scădere</strong>
              față de luna anterioară (▲ verde pentru creștere, ▼ roșu pentru scădere). Prima lună
              din interval nu are referință și apare cu „—". Util pentru a urmări trendul pe termen
              lung — alege o perioadă suficient de mare (cel puțin 12 luni) pentru a vedea sezonalitatea.
            </p>
          </Show>
          <div ref={momRef} style="margin-top:8px" />
          <Show when={data() && data()!.monthly.length === 0}>
            <div class="locatii-empty">Nicio lună cu venituri în perioada selectată.</div>
          </Show>
        </div>
      </div>
    </div>
  );
}

// ───── PRODUSE/SERVICII PANEL ─────────────────────────────────────────────────

interface DepartmentTotal {
  department_id: number | null;
  department_name: string;
  total: string | number;
}
interface CategoryTotal {
  category_id: number | null;
  category_name: string;
  department_id: number | null;
  department_name: string;
  total: string | number;
}
interface EmployeeTotal {
  employee_id: number | null;
  employee_name: string;
  total: string | number;
}
interface ProduseServiciiSummary {
  departments: DepartmentTotal[];
  categories: CategoryTotal[];
  employees: EmployeeTotal[];
  period_start: string;
  period_end: string;
}

const PALETTE = [
  "#5b7cfa", "#3ea96a", "#f5a623", "#a855f7", "#ef4444",
  "#06b6d4", "#e8441a", "#8b5cf6", "#10b981", "#ec4899",
  "#f59e0b", "#3b82f6",
];

function colorByIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

function ProduseServiciiPanel() {
  const [data, setData] = createSignal<ProduseServiciiSummary | null>(null);
  const [loading, setLoading] = createSignal(true);

  let deptBarRef: HTMLDivElement | undefined;
  let deptDonutRef: HTMLDivElement | undefined;
  let catBarRef: HTMLDivElement | undefined;
  let catDonutRef: HTMLDivElement | undefined;
  let empBarRef: HTMLDivElement | undefined;
  let empDonutRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      const res = await apiFetch(`/api/reports/produse-servicii?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch (e: unknown) {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => { periodVersion(); void load(); });

  // Departments
  createEffect(() => {
    const d = data();
    if (!d || !deptBarRef || !deptDonutRef) return;
    // Map fiecare departament la o culoare consistentă între bar & donut
    const colorMap = new Map<string, string>();
    d.departments.forEach((dp, i) => colorMap.set(dp.department_name, colorByIndex(i)));
    const barItems: BarItem[] = d.departments.map((dp) => ({
      label: dp.department_name,
      value: toNumber(dp.total),
      color: colorMap.get(dp.department_name)!,
    }));
    drawBar(deptBarRef, barItems);
    const donutItems: DonutItem[] = d.departments.map((dp) => ({
      label: dp.department_name,
      value: toNumber(dp.total),
      color: colorMap.get(dp.department_name)!,
    }));
    drawDonut(deptDonutRef, donutItems, "lei total");
  });

  // Categories grouped by department (colored by parent department)
  createEffect(() => {
    const d = data();
    if (!d || !catBarRef || !catDonutRef) return;
    // Build department color map (consistent cu chartul de departamente)
    const colorMap = new Map<string, string>();
    const uniqueDepts: string[] = [];
    d.departments.forEach((dp, i) => {
      colorMap.set(dp.department_name, colorByIndex(i));
      uniqueDepts.push(dp.department_name);
    });
    // Sortează categoriile pe departament (grupate), apoi descrescător după total
    const sorted = [...d.categories].sort((a, b) => {
      const da = uniqueDepts.indexOf(a.department_name);
      const db = uniqueDepts.indexOf(b.department_name);
      if (da !== db) return (da === -1 ? 999 : da) - (db === -1 ? 999 : db);
      return toNumber(b.total) - toNumber(a.total);
    });
    const barItems: BarItem[] = sorted.map((c) => ({
      label: `${c.category_name} · ${c.department_name}`,
      value: toNumber(c.total),
      color: colorMap.get(c.department_name) || PALETTE[0],
    }));
    drawBar(catBarRef, barItems);
    // Donut-ul arată distribuția pe categorii (felie per categorie)
    const donutItems: DonutItem[] = sorted.map((c, i) => ({
      label: c.category_name,
      value: toNumber(c.total),
      color: colorByIndex(i),
    }));
    drawDonut(catDonutRef, donutItems, "lei total");
  });

  // Employees
  createEffect(() => {
    const d = data();
    if (!d || !empBarRef || !empDonutRef) return;
    const barItems: BarItem[] = d.employees.map((e, i) => ({
      label: e.employee_name,
      value: toNumber(e.total),
      color: colorByIndex(i),
    }));
    drawBar(empBarRef, barItems);
    const donutItems: DonutItem[] = d.employees.map((e, i) => ({
      label: e.employee_name,
      value: toNumber(e.total),
      color: colorByIndex(i),
    }));
    drawDonut(empDonutRef, donutItems, "lei total");
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Produse / Servicii" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:820px;line-height:1.6">
          Analiză a vânzărilor pe <strong>departamente</strong>, <strong>tipuri de
          servicii</strong> și <strong>angajați</strong>. Datele acoperă perioada selectată în
          slicer-ul de mai jos. Itemii introduși manual din POS (fără legătură cu catalogul) apar
          etichetați separat ca „Introducere Manuala".
        </p>
      </Show>

      <PeriodSlicer />

      <Show when={loading()}>
        <p class="cfg-hint" style="margin-top:14px">Se încarcă...</p>
      </Show>

      <Show when={data()}>
        {(d) => (
          <>
            {/* Row 1: Departments */}
            <h3 class="locatii-section-title">1. Venituri pe departament</h3>
            <Show when={!hideExplanations()}>
              <p class="chart-explanation" style="max-width:820px">
                Cât a generat fiecare departament în perioada selectată. Barele orizontale sunt
                sortate descrescător — primul e cel care a adus cele mai multe încasări. Donut-ul
                din dreapta arată același lucru sub formă de procent din total.
              </p>
            </Show>
            <Show when={d().departments.length === 0}>
              <div class="locatii-empty">Niciun departament cu venituri în perioada selectată.</div>
            </Show>
            <div class="locatii-charts" style="margin-bottom:24px">
              <div class="locatii-chart-card" style="flex:2;min-width:0">
                <div class="locatii-chart-title">Sumă per departament</div>
                <div class="locatii-chart-subtitle">RON · sortat descrescător</div>
                <div ref={deptBarRef} style="margin-top:8px" />
              </div>
              <div class="locatii-chart-card" style="flex:1;min-width:260px">
                <div class="locatii-chart-title">Procent din total</div>
                <div class="locatii-chart-subtitle">contribuția fiecărui departament</div>
                <div ref={deptDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
              </div>
            </div>

            {/* Row 2: Categories grouped by Department */}
            <h3 class="locatii-section-title">2. Venituri pe tip de serviciu (grupate pe departament)</h3>
            <Show when={!hideExplanations()}>
              <p class="chart-explanation" style="max-width:820px">
                Fiecare bară reprezintă o <strong>categorie</strong> de servicii. Culoarea barei
                indică departamentul părinte — astfel poți vedea rapid din ce departament face parte
                fiecare categorie. Categoriile sunt grupate pe departament și sortate descrescător
                în interiorul fiecărui grup. Donut-ul din dreapta arată ponderea fiecărei categorii
                în veniturile totale.
              </p>
            </Show>
            <Show when={d().categories.length === 0}>
              <div class="locatii-empty">Nicio categorie cu venituri în perioada selectată.</div>
            </Show>
            <div class="locatii-charts" style="margin-bottom:24px">
              <div class="locatii-chart-card" style="flex:2;min-width:0">
                <div class="locatii-chart-title">Sumă per categorie</div>
                <div class="locatii-chart-subtitle">RON · culoare = departament părinte</div>
                <div ref={catBarRef} style="margin-top:8px" />
              </div>
              <div class="locatii-chart-card" style="flex:1;min-width:260px">
                <div class="locatii-chart-title">Procent din total</div>
                <div class="locatii-chart-subtitle">contribuția fiecărei categorii</div>
                <div ref={catDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
              </div>
            </div>

            {/* Row 3: Employees */}
            <h3 class="locatii-section-title">3. Venituri generate de fiecare angajat</h3>
            <Show when={!hideExplanations()}>
              <p class="chart-explanation" style="max-width:820px">
                Suma totală a serviciilor sau produselor atribuite fiecărui angajat (din bonurile
                la care a fost setat ca executant). <strong>Important:</strong> aici sunt incluse
                doar bonurile plătite — consistent cu logica de calcul al targetului lunar.
                Donut-ul arată ce procent din venitul total a fost generat de fiecare angajat.
              </p>
            </Show>
            <Show when={d().employees.length === 0}>
              <div class="locatii-empty">Niciun angajat cu venituri (plătite) în perioada selectată.</div>
            </Show>
            <div class="locatii-charts">
              <div class="locatii-chart-card" style="flex:2;min-width:0">
                <div class="locatii-chart-title">Sumă per angajat</div>
                <div class="locatii-chart-subtitle">RON · sortat descrescător</div>
                <div ref={empBarRef} style="margin-top:8px" />
              </div>
              <div class="locatii-chart-card" style="flex:1;min-width:260px">
                <div class="locatii-chart-title">Procent din total</div>
                <div class="locatii-chart-subtitle">contribuția fiecărui angajat</div>
                <div ref={empDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

// ───── ANGAJATI PANEL ─────────────────────────────────────────────────────────

interface EmpDetail {
  employee: { id: number; name: string; image_path: string | null; target: string; current_target_accumulation: string };
  period_start: string;
  period_end: string;
  total: string;
  daily: { report_date: string; total: string }[];
  departments: { department_id: number | null; department_name: string; total: string }[];
  categories: { category_id: number | null; category_name: string; department_name: string; total: string }[];
  item_types: { produse: string; servicii: string; count_produse: number; count_servicii: number };
  departments_by_type: { department_name: string; produse_sum: string; servicii_sum: string; produse_count: number; servicii_count: number }[];
  monthly: { month: string; total: string; delta_pct: number | null }[];
}

function AngajatiPanel() {
  const [employees, setEmployees] = createSignal<EmployeeReport[]>([]);
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [detail, setDetail] = createSignal<EmpDetail | null>(null);
  const [loadingList, setLoadingList] = createSignal(true);
  const [loadingDetail, setLoadingDetail] = createSignal(false);
  const [search, setSearch] = createSignal("");

  let lineRef: HTMLDivElement | undefined;
  let deptBarRef: HTMLDivElement | undefined;
  let deptDonutRef: HTMLDivElement | undefined;
  let catBarRef: HTMLDivElement | undefined;
  let catDonutRef: HTMLDivElement | undefined;
  let typesBarRef: HTMLDivElement | undefined;
  let typesDonutRef: HTMLDivElement | undefined;
  let deptTypeRef: HTMLDivElement | undefined;
  let monthlyRef: HTMLDivElement | undefined;

  async function loadEmployees() {
    setLoadingList(true);
    const all: EmployeeReport[] = [];
    const PAGE = 200;
    let offset = 0;
    try {
      while (true) {
        const res = await apiFetch(`/api/employees?limit=${PAGE}&offset=${offset}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as { items: EmployeeReport[] };
        const items = data.items ?? [];
        all.push(...items);
        if (items.length < PAGE) break;
        offset += PAGE;
        if (offset > 5000) break;
      }
      setEmployees(all);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Eroare la încărcare angajați.";
      notify(msg, "error");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(empId: number) {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      const res = await apiFetch(`/api/reports/employees/${empId}?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setDetail(await res.json());
    } catch {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoadingDetail(false);
    }
  }

  onMount(loadEmployees);

  // Reîncarcă detail la schimbare angajat sau perioadă
  createEffect(() => {
    const id = selectedId();
    periodVersion(); // dep
    if (id !== null) void loadDetail(id);
  });

  // Draw charts on detail change.
  // Ref-urile sunt înăuntrul unui <Show when={!loadingDetail() && detail()}>, deci nu
  // sunt atașate cât timp loadingDetail e true. Citim AMBELE semnale ca să re-rulăm
  // efectul când loadingDetail trece pe false (moment în care divs sunt mounted).
  // queueMicrotask amână execuția până după ce Solid a terminat render-ul curent.
  createEffect(() => {
    const d = detail();
    const loading = loadingDetail();
    if (!d || loading) return;

    queueMicrotask(() => {
      if (lineRef) {
        drawLine(lineRef, d.daily.map((r) => ({
          report_date: r.report_date,
          sum_total: r.total,
          sum_paid: r.total,
          sum_unpaid: 0,
          count_total: 0,
        })));
      }

      // Departments
      if (deptBarRef && deptDonutRef) {
        const colorMap = new Map<string, string>();
        d.departments.forEach((dp, i) => colorMap.set(dp.department_name, colorByIndex(i)));
        const barItems: BarItem[] = d.departments.map((dp) => ({
          label: dp.department_name,
          value: toNumber(dp.total),
          color: colorMap.get(dp.department_name)!,
        }));
        drawBar(deptBarRef, barItems);
        drawDonut(deptDonutRef, d.departments.map((dp) => ({
          label: dp.department_name,
          value: toNumber(dp.total),
          color: colorMap.get(dp.department_name)!,
        })));
      }

      // Categories
      if (catBarRef && catDonutRef) {
        const items: BarItem[] = d.categories.map((c, i) => ({
          label: `${c.category_name} · ${c.department_name}`,
          value: toNumber(c.total),
          color: colorByIndex(i),
        }));
        drawBar(catBarRef, items);
        drawDonut(catDonutRef, d.categories.map((c, i) => ({
          label: c.category_name,
          value: toNumber(c.total),
          color: colorByIndex(i),
        })));
      }

      // Produse vs Servicii
      if (typesBarRef && typesDonutRef) {
        const itemsBar: BarItem[] = [
          { label: `Produse (${d.item_types.count_produse} buc)`, value: toNumber(d.item_types.produse), color: PALETTE[0] },
          { label: `Servicii (${d.item_types.count_servicii} buc)`, value: toNumber(d.item_types.servicii), color: PALETTE[1] },
        ];
        drawBar(typesBarRef, itemsBar);
        drawDonut(typesDonutRef, [
          { label: "Produse", value: toNumber(d.item_types.produse), color: PALETTE[0] },
          { label: "Servicii", value: toNumber(d.item_types.servicii), color: PALETTE[1] },
        ]);
      }

      // Departments by type (grouped bars)
      if (deptTypeRef) {
        const items: GroupedBarItem[] = d.departments_by_type.map((r) => ({
          label: r.department_name,
          produse: toNumber(r.produse_sum),
          servicii: toNumber(r.servicii_sum),
          produse_count: r.produse_count,
          servicii_count: r.servicii_count,
        }));
        drawGroupedBars(deptTypeRef, items);
      }

      // Monthly with delta
      if (monthlyRef) {
        const items: MonthlyItem[] = d.monthly.map((m) => ({
          month: m.month,
          total: toNumber(m.total),
          delta_pct: m.delta_pct,
        }));
        drawMonthlyBars(monthlyRef, items);
      }
    });
  });

  const filteredEmployees = createMemo(() => {
    const q = search().trim().toLowerCase();
    const list = q ? employees().filter((e) => e.name.toLowerCase().includes(q)) : employees();
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  });

  const selectedEmployee = createMemo(() => {
    const id = selectedId();
    return id !== null ? employees().find((e) => e.id === id) ?? null : null;
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Angajați" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:820px;line-height:1.6">
          Selectează un angajat din grila de mai jos pentru a vedea analiza detaliată a vânzărilor
          atribuite lui. Toate sumele includ <strong>doar bonurile plătite</strong>. Folosește
          slicer-ul pentru a schimba perioada — datele se reîncarcă automat.
        </p>
      </Show>

      <PeriodSlicer />

      {/* Search + employee grid */}
      <div style="margin:14px 0 8px">
        <input
          type="search"
          class="input"
          placeholder="Caută angajat..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style="max-width:280px;height:34px;padding:4px 10px"
        />
      </div>

      <Show when={loadingList()}>
        <p class="cfg-hint">Se încarcă angajații...</p>
      </Show>

      <Show when={!loadingList()}>
        <div class="angajati-grid">
          <For each={filteredEmployees()}>
            {(e) => (
              <button
                class="angajat-card"
                classList={{ "angajat-card--active": selectedId() === e.id }}
                onClick={() => setSelectedId(e.id)}
              >
                <Avatar name={e.name} imagePath={e.image_path} size={56} />
                <span class="angajat-card__name">{e.name}</span>
                <Show when={e.description}>
                  <span class="angajat-card__desc">{e.description}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={selectedId() !== null}>
        <div class="angajati-detail">
          <Show when={selectedEmployee()}>
            {(e) => (
              <div class="angajati-detail-header">
                <Avatar name={e().name} imagePath={e().image_path} size={48} />
                <div>
                  <h3 style="margin:0;font-size:1.15rem">{e().name}</h3>
                  <Show when={e().description}>
                    <div style="font-size:0.8rem;color:var(--text-muted)">{e().description}</div>
                  </Show>
                </div>
                <Show when={detail()}>
                  {(d) => (
                    <div class="angajati-detail-total">
                      <span class="locatii-kpi__label">Total perioadă</span>
                      <span class="locatii-kpi__value">{fmtMoney(toNumber(d().total))} lei</span>
                    </div>
                  )}
                </Show>
              </div>
            )}
          </Show>

          <Show when={loadingDetail()}>
            <p class="cfg-hint">Se încarcă datele...</p>
          </Show>

          <Show when={!loadingDetail() && detail()}>
            {(d) => (
              <>
                {/* 1. Linie zilnică */}
                <h3 class="locatii-section-title">1. Contribuție zilnică</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Suma totală pe care a generat-o angajatul în fiecare zi din perioada selectată.
                    Util pentru a vedea consistența activității și a identifica zilele de vârf.
                  </p>
                </Show>
                <Show when={d().daily.length === 0}>
                  <div class="locatii-empty">Nicio zi cu venituri în perioada selectată.</div>
                </Show>
                <div class="locatii-chart-card" style="margin-bottom:24px">
                  <div ref={lineRef} style="margin-top:8px" />
                </div>

                {/* 2. Departamente */}
                <h3 class="locatii-section-title">2. Venituri pe departament</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Distribuția veniturilor pe departamente. Util pentru a vedea în ce zone lucrează
                    cel mai mult angajatul. Donut-ul arată ponderea fiecărui departament.
                  </p>
                </Show>
                <div class="locatii-charts" style="margin-bottom:24px">
                  <div class="locatii-chart-card" style="flex:2;min-width:0">
                    <div class="locatii-chart-title">Sumă per departament</div>
                    <div ref={deptBarRef} style="margin-top:8px" />
                  </div>
                  <div class="locatii-chart-card" style="flex:1;min-width:260px">
                    <div class="locatii-chart-title">Procent</div>
                    <div ref={deptDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
                  </div>
                </div>

                {/* 3. Categorii (servicii) */}
                <h3 class="locatii-section-title">3. Venituri pe tip de serviciu</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Fiecare bară este o categorie de servicii (cu departamentul părinte între
                    paranteze). Sortat descrescător după valoare. Donut-ul arată ponderea fiecărei
                    categorii.
                  </p>
                </Show>
                <div class="locatii-charts" style="margin-bottom:24px">
                  <div class="locatii-chart-card" style="flex:2;min-width:0">
                    <div class="locatii-chart-title">Sumă per categorie</div>
                    <div ref={catBarRef} style="margin-top:8px" />
                  </div>
                  <div class="locatii-chart-card" style="flex:1;min-width:260px">
                    <div class="locatii-chart-title">Procent</div>
                    <div ref={catDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
                  </div>
                </div>

                {/* 4. Produse vs Servicii */}
                <h3 class="locatii-section-title">4. Produse vs Servicii</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Cât a vândut angajatul din produse vs cât a generat din servicii. Util pentru
                    profilul activității — predominant tehnic / consultativ vs comercial.
                  </p>
                </Show>
                <div class="locatii-charts" style="margin-bottom:24px">
                  <div class="locatii-chart-card" style="flex:2;min-width:0">
                    <div class="locatii-chart-title">Sume</div>
                    <div ref={typesBarRef} style="margin-top:8px" />
                  </div>
                  <div class="locatii-chart-card" style="flex:1;min-width:260px">
                    <div class="locatii-chart-title">Procent</div>
                    <div ref={typesDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
                  </div>
                </div>

                {/* 5. Departament × Produse/Servicii */}
                <h3 class="locatii-section-title">5. Produse vs Servicii per departament</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Pentru fiecare departament, suma vândută separat ca produse și ca servicii.
                    Hover pe bară pentru a vedea și numărul de bucăți. Util pentru a vedea unde
                    angajatul prestează servicii și unde vinde produse din catalog.
                  </p>
                </Show>
                <Show when={d().departments_by_type.length === 0}>
                  <div class="locatii-empty">Niciun departament cu activitate în perioada selectată.</div>
                </Show>
                <div class="locatii-chart-card" style="margin-bottom:24px">
                  <div ref={deptTypeRef} style="margin-top:8px" />
                </div>

                {/* 6. Lunar cu delta % */}
                <h3 class="locatii-section-title">6. Evoluție lunară</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Suma totală pe fiecare lună din intervalul selectat. Sub fiecare bară este
                    afișat procentul de creștere sau scădere față de luna anterioară. Prima lună
                    din interval nu are referință de comparație. Util pentru a vedea trendul pe
                    termen lung.
                  </p>
                </Show>
                <Show when={d().monthly.length === 0}>
                  <div class="locatii-empty">Nicio lună cu venituri în perioada selectată.</div>
                </Show>
                <div class="locatii-chart-card">
                  <div ref={monthlyRef} style="margin-top:8px" />
                </div>
              </>
            )}
          </Show>
        </div>
      </Show>

      <Show when={selectedId() === null && !loadingList()}>
        <div class="locatii-empty" style="margin-top:20px">
          Apasă pe un angajat din grilă pentru a vedea analiza detaliată.
        </div>
      </Show>
    </div>
  );
}

function drawLine(container: HTMLDivElement, daily: DailyTotal[]) {
  d3.select(container).selectAll("*").remove();
  if (daily.length === 0) return;

  const w = container.clientWidth || 600;
  const h = 240;
  const margin = { top: 12, right: 20, bottom: 32, left: 60 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const parseDate = d3.timeParse("%Y-%m-%d");
  const points = daily.map((d) => ({
    date: parseDate(d.report_date)!,
    total: toNumber(d.sum_total),
  }));

  const x = d3.scaleTime()
    .domain(d3.extent(points, (d) => d.date) as [Date, Date])
    .range([0, iw]);

  const yMax = d3.max(points, (d) => d.total) || 100;
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.1])
    .range([ih, 0])
    .nice();

  // Gridlines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => ""))
    .selectAll("line")
    .attr("stroke", "var(--border, #2a3045)")
    .attr("stroke-opacity", 0.4);
  g.selectAll(".domain").remove();

  // X axis
  const tickCount = Math.min(8, points.length);
  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.timeFormat("%d.%m") as any))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");
  g.selectAll(".domain").attr("stroke", "var(--border, #2a3045)");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => {
      const n = +v;
      if (n >= 1000) return (n / 1000).toFixed(1) + "k";
      return String(n);
    }))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  // Area
  const area = d3.area<typeof points[0]>()
    .x((d) => x(d.date))
    .y0(ih)
    .y1((d) => y(d.total))
    .curve(d3.curveCatmullRom);

  const line = d3.line<typeof points[0]>()
    .x((d) => x(d.date))
    .y((d) => y(d.total))
    .curve(d3.curveCatmullRom);

  g.append("path")
    .datum(points)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("fill-opacity", 0.12)
    .attr("d", area);

  const path = g.append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", "var(--accent, #5b7cfa)")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  const totalLen = (path.node() as SVGPathElement).getTotalLength();
  path.attr("stroke-dasharray", totalLen)
    .attr("stroke-dashoffset", totalLen)
    .transition().duration(900).ease(d3.easeLinear).attr("stroke-dashoffset", 0);

  // Hover dot + tooltip
  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  d3.select(container).style("position", "relative");

  const hoverDot = g.append("circle")
    .attr("r", 5)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("stroke", "var(--surface, #1e2330)")
    .attr("stroke-width", 2)
    .style("opacity", 0);

  svg.append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", iw)
    .attr("height", ih)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const xp = mx - margin.left;
      const xDate = x.invert(xp);
      const bisect = d3.bisector<typeof points[0], Date>((d) => d.date).left;
      const i = Math.min(points.length - 1, Math.max(0, bisect(points, xDate)));
      const p = points[i];
      hoverDot.style("opacity", 1).attr("cx", x(p.date)).attr("cy", y(p.total));
      const rect = container.getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:var(--accent,#5b7cfa)">${d3.timeFormat("%d %b %Y")(p.date)}</strong>${fmtMoney(p.total)} lei`);
    })
    .on("mouseout", () => {
      hoverDot.style("opacity", 0);
      tooltip.style("opacity", 0);
    });
}

interface DonutItem {
  label: string;
  value: number;
  color: string;
}

interface BarItem {
  label: string;
  value: number;
  color: string;
}

function drawDonut(container: HTMLDivElement, items: DonutItem[], centerLabelText: string = "lei total") {
  d3.select(container).selectAll("*").remove();

  const filtered = items.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = 260;
  const h = 240;
  const r = Math.min(w, h) / 2 - 18;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .style("max-width", w + "px")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${w / 2},${h / 2 - 10})`);

  const pie = d3.pie<DonutItem>().value((d) => d.value).sort(null);
  const arc = d3.arc<d3.PieArcDatum<DonutItem>>()
    .innerRadius(r * 0.58)
    .outerRadius(r);
  const arcHover = d3.arc<d3.PieArcDatum<DonutItem>>()
    .innerRadius(r * 0.55)
    .outerRadius(r + 6);

  // Center label
  const centerLabel = g.append("text")
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none");
  centerLabel.append("tspan")
    .attr("class", "donut-center-value")
    .attr("x", 0)
    .attr("dy", "-0.2em")
    .attr("font-size", "20px")
    .attr("font-weight", 700)
    .attr("fill", "var(--text, #e8eaf0)")
    .text(fmtMoney(total));
  centerLabel.append("tspan")
    .attr("class", "donut-center-label")
    .attr("x", 0)
    .attr("dy", "1.4em")
    .attr("font-size", "10px")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .text(centerLabelText);

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  g.selectAll("path")
    .data(pie(filtered))
    .join("path")
    .attr("fill", (d) => d.data.color)
    .attr("stroke", "var(--surface, #1e2330)")
    .attr("stroke-width", 2)
    .attr("d", arc as any)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).transition().duration(120).attr("d", arcHover as any);
      const pct = ((d.data.value / total) * 100).toFixed(1);
      centerLabel.select(".donut-center-value")
        .attr("fill", d.data.color)
        .text(pct + "%");
      centerLabel.select(".donut-center-label").text(d.data.label);
    })
    .on("mousemove", function (event, d) {
      const rect = container.getBoundingClientRect();
      const pct = ((d.data.value / total) * 100).toFixed(1);
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:${d.data.color}">${d.data.label}</strong>${fmtMoney(d.data.value)} lei (${pct}%)`);
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(120).attr("d", arc as any);
      centerLabel.select(".donut-center-value")
        .attr("fill", "var(--text, #e8eaf0)")
        .text(fmtMoney(total));
      centerLabel.select(".donut-center-label").text(centerLabelText);
      tooltip.style("opacity", 0);
    });

  // Legend (limitat la primele 8 pentru claritate)
  const legend = d3.select(container)
    .append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "8px")
    .style("justify-content", "center")
    .style("margin-top", "8px")
    .style("max-width", "260px");

  filtered.slice(0, 8).forEach((item) => {
    const pct = ((item.value / total) * 100).toFixed(1);
    const entry = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "5px")
      .style("font-size", "11px")
      .style("color", "var(--text-muted, #8b90a0)");
    entry.append("span")
      .style("width", "10px")
      .style("height", "10px")
      .style("border-radius", "2px")
      .style("background", item.color);
    entry.append("span").text(`${item.label} ${pct}%`);
  });
  if (filtered.length > 8) {
    legend.append("div")
      .style("font-size", "11px")
      .style("color", "var(--text-muted, #8b90a0)")
      .text(`+ ${filtered.length - 8} mai puține`);
  }
}

// ───── BAR CHART (horizontal) ─────────────────────────────────────────────────

function drawBar(container: HTMLDivElement, items: BarItem[]) {
  d3.select(container).selectAll("*").remove();
  const filtered = items.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const barH = 26;
  const gap = 4;
  const margin = { top: 8, right: 60, bottom: 12, left: 180 };
  const ih = filtered.length * (barH + gap);
  const h = ih + margin.top + margin.bottom;
  const iw = w - margin.left - margin.right;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xMax = d3.max(filtered, (d) => d.value) || 1;
  const x = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, iw]);
  const y = d3.scaleBand<string>().domain(filtered.map((d, i) => `${i}_${d.label}`)).range([0, ih]).padding(0.15);

  // Y axis (label-uri)
  g.append("g")
    .call(d3.axisLeft(y).tickFormat((id) => {
      const label = filtered[parseInt(String(id).split("_")[0])].label;
      return label.length > 26 ? label.slice(0, 25) + "…" : label;
    }))
    .selectAll("text")
    .attr("fill", "var(--text, #e8eaf0)")
    .style("font-size", "12px");
  g.selectAll(".domain, .tick line").attr("stroke", "var(--border, #2a3045)").attr("stroke-opacity", 0.4);

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  const total = filtered.reduce((s, d) => s + d.value, 0);

  g.selectAll("rect")
    .data(filtered)
    .join("rect")
    .attr("x", 0)
    .attr("y", (_d, i) => y(`${i}_${filtered[i].label}`) || 0)
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", (d) => d.color)
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill-opacity", 0.85);
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
      const rect = container.getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:${d.color}">${d.label}</strong>${fmtMoney(d.value)} lei (${pct}%)`);
    })
    .on("mousemove", function (event) {
      const rect = container.getBoundingClientRect();
      tooltip
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.style("opacity", 0);
    })
    .transition()
    .duration(700)
    .attr("width", (d) => x(d.value));

  // Etichete de valoare la capătul barei
  g.selectAll("text.bar-value")
    .data(filtered)
    .join("text")
    .attr("class", "bar-value")
    .attr("x", (d) => x(d.value) + 6)
    .attr("y", (_d, i) => (y(`${i}_${filtered[i].label}`) || 0) + y.bandwidth() / 2 + 4)
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px")
    .style("font-weight", 500)
    .style("opacity", 0)
    .text((d) => fmtMoney(d.value))
    .transition()
    .delay(700)
    .duration(300)
    .style("opacity", 1);
}

// ───── GROUPED BARS (Produse vs Servicii per departament) ─────────────────────

interface GroupedBarItem {
  label: string;          // e.g. departamentul
  produse: number;
  servicii: number;
  produse_count?: number;
  servicii_count?: number;
}

function drawGroupedBars(container: HTMLDivElement, items: GroupedBarItem[]) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const barH = 14;
  const groupGap = 18;
  const margin = { top: 30, right: 90, bottom: 12, left: 180 };
  const ih = items.length * (barH * 2 + 4 + groupGap);
  const h = ih + margin.top + margin.bottom;
  const iw = w - margin.left - margin.right;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(items, (d) => Math.max(d.produse, d.servicii)) || 1;
  const x = d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, iw]);

  // Y axis labels per group
  const labels = g.append("g");
  items.forEach((d, i) => {
    const yMid = i * (barH * 2 + 4 + groupGap) + barH + 2;
    labels.append("text")
      .attr("x", -10)
      .attr("y", yMid + 4)
      .attr("text-anchor", "end")
      .attr("fill", "var(--text, #e8eaf0)")
      .style("font-size", "12px")
      .text(d.label.length > 24 ? d.label.slice(0, 23) + "…" : d.label);
  });

  // Legend
  const legendG = svg.append("g").attr("transform", `translate(${margin.left},10)`);
  legendG.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", PALETTE[0]).attr("rx", 2);
  legendG.append("text").attr("x", 18).attr("y", 10).attr("fill", "var(--text-muted, #8b90a0)").style("font-size", "11px").text("Produse");
  legendG.append("rect").attr("x", 90).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", PALETTE[1]).attr("rx", 2);
  legendG.append("text").attr("x", 108).attr("y", 10).attr("fill", "var(--text-muted, #8b90a0)").style("font-size", "11px").text("Servicii");

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  items.forEach((d, i) => {
    const yTop = i * (barH * 2 + 4 + groupGap);
    // Produse
    g.append("rect")
      .attr("x", 0).attr("y", yTop)
      .attr("height", barH)
      .attr("width", 0)
      .attr("fill", PALETTE[0])
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${PALETTE[0]}">${d.label} · Produse</strong>${fmtMoney(d.produse)} lei${d.produse_count !== undefined ? ` (${d.produse_count} buc)` : ""}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .transition().duration(700).attr("width", x(d.produse));

    g.append("text")
      .attr("x", x(d.produse) + 6)
      .attr("y", yTop + barH - 2)
      .attr("fill", "var(--text-muted, #8b90a0)")
      .style("font-size", "10px")
      .style("opacity", 0)
      .text(fmtMoney(d.produse))
      .transition().delay(700).duration(300).style("opacity", 1);

    // Servicii
    g.append("rect")
      .attr("x", 0).attr("y", yTop + barH + 4)
      .attr("height", barH)
      .attr("width", 0)
      .attr("fill", PALETTE[1])
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("opacity", 1)
          .style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px")
          .html(`<strong style="display:block;color:${PALETTE[1]}">${d.label} · Servicii</strong>${fmtMoney(d.servicii)} lei${d.servicii_count !== undefined ? ` (${d.servicii_count} buc)` : ""}`);
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style("left", (event.clientX - rect.left + 14) + "px")
          .style("top", (event.clientY - rect.top - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .transition().duration(700).attr("width", x(d.servicii));

    g.append("text")
      .attr("x", x(d.servicii) + 6)
      .attr("y", yTop + barH * 2 + 2)
      .attr("fill", "var(--text-muted, #8b90a0)")
      .style("font-size", "10px")
      .style("opacity", 0)
      .text(fmtMoney(d.servicii))
      .transition().delay(700).duration(300).style("opacity", 1);
  });
}

// ───── MONTHLY BARS cu delta % ────────────────────────────────────────────────

interface MonthlyItem {
  month: string;          // "YYYY-MM"
  total: number;
  delta_pct: number | null;
}

const RO_MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${RO_MONTHS[m - 1]} ${y}`;
}

function drawMonthlyBars(container: HTMLDivElement, items: MonthlyItem[]) {
  d3.select(container).selectAll("*").remove();
  if (items.length === 0) {
    d3.select(container)
      .append("div")
      .style("padding", "32px 0")
      .style("text-align", "center")
      .style("color", "var(--text-muted, #8b90a0)")
      .style("font-size", "0.85rem")
      .text("Nicio valoare de afișat.");
    return;
  }

  const w = container.clientWidth || 600;
  const h = 260;
  const margin = { top: 30, right: 20, bottom: 50, left: 60 };
  const iw = w - margin.left - margin.right;
  const ih = h - margin.top - margin.bottom;

  d3.select(container).style("position", "relative");

  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", h);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand<string>().domain(items.map((d) => d.month)).range([0, iw]).padding(0.2);
  const yMax = d3.max(items, (d) => d.total) || 1;
  const y = d3.scaleLinear().domain([0, yMax * 1.2]).range([ih, 0]).nice();

  // Gridlines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => ""))
    .selectAll("line")
    .attr("stroke", "var(--border, #2a3045)")
    .attr("stroke-opacity", 0.4);
  g.selectAll(".domain").remove();

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickFormat((m) => fmtMonth(m as string)))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => {
      const n = +v;
      if (n >= 1000) return (n / 1000).toFixed(1) + "k";
      return String(n);
    }))
    .selectAll("text")
    .attr("fill", "var(--text-muted, #8b90a0)")
    .style("font-size", "11px");

  const tooltip = d3.select(container)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "var(--surface, #1e2330)")
    .style("border", "1px solid var(--border, #2a3045)")
    .style("border-radius", "6px")
    .style("padding", "6px 10px")
    .style("font-size", "12px")
    .style("color", "var(--text, #e8eaf0)")
    .style("opacity", 0)
    .style("transition", "opacity 0.12s");

  // Bars
  g.selectAll("rect.bar")
    .data(items)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.month) || 0)
    .attr("width", x.bandwidth())
    .attr("y", ih)
    .attr("height", 0)
    .attr("fill", "var(--accent, #5b7cfa)")
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill-opacity", 0.85);
      const rect = container.getBoundingClientRect();
      const deltaHtml = d.delta_pct === null
        ? `<div style="color:var(--text-muted, #8b90a0);font-size:10px">prima lună din interval</div>`
        : `<div style="color:${d.delta_pct >= 0 ? "var(--success, #3ea96a)" : "var(--danger, #ef4444)"};font-size:10px">${d.delta_pct >= 0 ? "↑" : "↓"} ${Math.abs(d.delta_pct).toFixed(1)}% vs luna anterioară</div>`;
      tooltip.style("opacity", 1)
        .style("left", (event.clientX - rect.left + 14) + "px")
        .style("top", (event.clientY - rect.top - 10) + "px")
        .html(`<strong style="display:block;color:var(--accent, #5b7cfa)">${fmtMonth(d.month)}</strong>${fmtMoney(d.total)} lei${deltaHtml}`);
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill-opacity", 1);
      tooltip.style("opacity", 0);
    })
    .transition().duration(700)
    .attr("y", (d) => y(d.total))
    .attr("height", (d) => ih - y(d.total));

  // Delta badges deasupra barei
  g.selectAll("g.delta")
    .data(items)
    .join("g")
    .attr("class", "delta")
    .attr("transform", (d) => `translate(${(x(d.month) || 0) + x.bandwidth() / 2},${y(d.total) - 8})`)
    .each(function (d) {
      const sel = d3.select(this);
      if (d.delta_pct === null) {
        sel.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", "var(--text-muted, #8b90a0)")
          .style("font-size", "10px")
          .style("opacity", 0)
          .text("—")
          .transition().delay(700).duration(300).style("opacity", 1);
      } else {
        const positive = d.delta_pct >= 0;
        const color = positive ? "#3ea96a" : "#ef4444";
        const text = `${positive ? "▲" : "▼"} ${Math.abs(d.delta_pct).toFixed(1)}%`;
        sel.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", color)
          .style("font-size", "10.5px")
          .style("font-weight", 700)
          .style("opacity", 0)
          .text(text)
          .transition().delay(700).duration(300).style("opacity", 1);
      }
    });

  // Value label inside / above bar
  g.selectAll("text.bar-value")
    .data(items)
    .join("text")
    .attr("class", "bar-value")
    .attr("x", (d) => (x(d.month) || 0) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.total) + 16)
    .attr("text-anchor", "middle")
    .attr("fill", "#fff")
    .style("font-size", "10px")
    .style("font-weight", 600)
    .style("opacity", 0)
    .text((d) => fmtMoney(d.total))
    .transition().delay(700).duration(300).style("opacity", (d) => (ih - y(d.total) > 20 ? 1 : 0));
}

// ───── ROOT ───────────────────────────────────────────────────────────────────

export default function Rapoarte() {
  const [active, setActive] = createSignal<SectionId>("target-angajati");

  return (
    <div class="cfg-layout">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Rapoarte</div>
        <For each={SECTIONS}>
          {(s) => (
            <button
              class="cfg-sidebar-item"
              classList={{ "cfg-sidebar-item--active": active() === s.id }}
              onClick={() => setActive(s.id)}
            >{s.label}</button>
          )}
        </For>
      </aside>
      <main class="cfg-content">
        <Switch>
          <Match when={active() === "target-angajati"}><TargetAngajatiPanel /></Match>
          <Match when={active() === "locatii"}><LocatiiPanel /></Match>
          <Match when={active() === "produse-servicii"}><ProduseServiciiPanel /></Match>
          <Match when={active() === "angajati"}><AngajatiPanel /></Match>
        </Switch>
      </main>
    </div>
  );
}
