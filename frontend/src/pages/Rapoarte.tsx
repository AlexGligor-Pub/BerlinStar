import { For, Show, Switch, Match, createSignal, onMount, createMemo, createEffect, onCleanup } from "solid-js";
import * as d3 from "d3";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";
import { generalSettings } from "../store/generalSettingsStore";
import { toNumber, fmtMoney, todayISO, fmtRoDate, toLocalISO } from "./rapoarte/format";
import {
  persistedSignal,
  periodFrom,
  periodTo,
  periodLabel,
  periodVersion,
  commitPeriod,
  hideExplanations, setHideExplanations,
} from "./rapoarte/state";
import { PALETTE, colorByIndex, PAY_COLORS, RO_DOW } from "./rapoarte/constants";
import {
  drawLine, drawDonut, drawBar, drawGroupedBars,
  drawMonthlyBars, drawMonthlyDualBars, drawMonthlySeriesBars, drawHeatmap,
  drawYoYBars, attachMultiLineResize,
  type DailyTotal, type DonutItem, type BarItem, type GroupedBarItem,
  type MonthlyItem, type MonthlySeriesItem, type ProgramariHeatmapCell,
  type YoYBucket, type MultiLineSeries,
} from "./rapoarte/charts";
import StocuriSection from "./rapoarte/StocuriSection";
import ReportsGate from "./rapoarte/ReportsGate";
import { reportsFetch, setReportsToken } from "./rapoarte/reports-auth";
import {
  createSolidTable as tanstackCreate,
  flexRender as tanstackFlexRender,
  getCoreRowModel as tanstackCoreRowModel,
  getSortedRowModel as tanstackSortedRowModel,
  getFilteredRowModel as tanstackFilteredRowModel,
  type ColumnDef as TanstackColumnDef,
  type SortingState as TanstackSorting,
} from "@tanstack/solid-table";
import { exportCSV as sharedExportCSV, exportPDF as sharedExportPDF } from "./configurari/shared";
import { ExportMenu } from "./configurari/components";

/** Wrapper peste apiFetch care injecteaza tokenul de Rapoarte si, la 401,
 * curata tokenul si emite un eveniment ca gate-ul sa reia ecranul de parola.
 */
function reportsApiFetch(url: string, options?: RequestInit): Promise<Response> {
  return reportsFetch(url, options).then((res) => {
    if (res.status === 401) {
      setReportsToken(null);
      try { window.dispatchEvent(new CustomEvent("bs:reports-locked")); } catch {}
    }
    return res;
  });
}

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
  { id: "comparare-yoy", label: "Comparare YoY" },
  { id: "produse-servicii", label: "Produse / Servicii" },
  { id: "angajati", label: "Angajați" },
  { id: "hotel-anvelope", label: "Hotel Anvelope" },
  { id: "clienti", label: "Clienți" },
  { id: "programari", label: "Programări" },
  { id: "concedii", label: "Concedii" },
  { id: "stocuri", label: "Stocuri" },
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

// TargetAngajatiPanel (donut + month selector) este definit mai jos, după
// helper-ele D3 (drawDonut, PALETTE, fmtMoney). Vezi `function TargetAngajatiPanel()`.

// ───── LOCAȚII PANEL ──────────────────────────────────────────────────────────

// DailyTotal type mutat in ./rapoarte/charts.ts

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

// PAY_COLORS importat din ./rapoarte/constants

// toNumber, fmtMoney, firstOfMonthISO, todayISO, fmtRoDate importate din ./rapoarte/format

// persistedSignal, periodFrom/To/Label/Version, commitPeriod, hideExplanations
// importate din ./rapoarte/state — modul de single source of truth pentru
// starea partajata intre toate panourile.

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

type QuickKey = "today" | "7d" | "last_week" | "30d" | "mtd" | "qtd" | "ytd" | "12m";

function PeriodSlicer() {
  const [activeQuick, setActiveQuick] = persistedSignal<QuickKey | null>("rapoarte_quick_key", "mtd");
  const [draftFrom, setDraftFrom] = createSignal(periodFrom());
  const [draftTo, setDraftTo] = createSignal(periodTo());
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  // Slider range = 1 ian anul curent → azi (fără viitor — nu există date)
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const totalDays = Math.max(1, Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000));

  function pctOf(iso: string): number {
    const d = new Date(iso);
    const diff = Math.round((d.getTime() - yearStart.getTime()) / 86400000);
    return Math.max(0, Math.min(100, Math.round((diff / totalDays) * 100)));
  }
  function dateFromPct(pct: number): string {
    const d = new Date(yearStart);
    d.setDate(d.getDate() + Math.round((pct / 100) * totalDays));
    return toLocalISO(d);
  }

  const [sliderMin, setSliderMin] = createSignal(pctOf(draftFrom()));
  const [sliderMax, setSliderMax] = createSignal(pctOf(draftTo()));

  function applyQuick(key: QuickKey) {
    const now = new Date();
    let from = new Date(now);
    let to = new Date(now);
    let label = "";
    if (key === "today") { label = "Azi"; }
    else if (key === "7d") {
      // Săptămâna curentă: de luni până azi (luni=1 ... duminică=0)
      const dow = now.getDay();
      const daysFromMonday = (dow + 6) % 7;
      from.setDate(from.getDate() - daysFromMonday);
      label = "Săptămâna curentă";
    }
    else if (key === "last_week") {
      // Săptămâna trecută: luni → duminică din săptămâna anterioară
      const dow = now.getDay();
      const daysFromMonday = (dow + 6) % 7;
      from.setDate(from.getDate() - daysFromMonday - 7);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
      label = "Săptămâna trecută";
    }
    else if (key === "30d") { from.setDate(from.getDate() - 29); label = "Ultimele 30 zile"; }
    else if (key === "mtd") { from = new Date(now.getFullYear(), now.getMonth(), 1); label = "Luna aceasta"; }
    else if (key === "qtd") {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1); label = "Trim. curent";
    }
    else if (key === "ytd") { from = new Date(now.getFullYear(), 0, 1); label = "An curent"; }
    else if (key === "12m") { from.setFullYear(from.getFullYear() - 1); label = "12 luni"; }
    const f = toLocalISO(from);
    const t = toLocalISO(to);
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
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "7d" }} onClick={() => applyQuick("7d")}>Săptămâna curentă</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "last_week" }} onClick={() => applyQuick("last_week")}>Săptămâna trecută</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "30d" }} onClick={() => applyQuick("30d")}>30 zile</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "mtd" }} onClick={() => applyQuick("mtd")}>Luna aceasta</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "qtd" }} onClick={() => applyQuick("qtd")}>Trim. curent</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "ytd" }} onClick={() => applyQuick("ytd")}>An curent</button>
        <button class="slicer-qbtn" classList={{ "slicer-qbtn--active": activeQuick() === "12m" }} onClick={() => applyQuick("12m")}>12 luni</button>
      </div>
      <div class="slicer-active-summary">
        <span class="slicer-active-summary__label">
          {periodLabel()}: <strong>{fmtRoDate(periodFrom())} → {fmtRoDate(periodTo())}</strong>
        </span>
        <button
          type="button"
          class="slicer-advanced-toggle"
          aria-expanded={advancedOpen()}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span class={`slicer-advanced-caret ${advancedOpen() ? "is-open" : ""}`}>▸</span>
          Filtrare avansată
        </button>
      </div>
      <Show when={advancedOpen()}>
        <div class="slicer-advanced">
          <div class="slicer-range-inputs">
            <input type="date" max={todayISO()} value={draftFrom()} onInput={(e) => { setDraftFrom(e.currentTarget.value); setSliderMin(pctOf(e.currentTarget.value)); setActiveQuick(null); }} />
            <span class="slicer-dash">→</span>
            <input type="date" max={todayISO()} value={draftTo()} onInput={(e) => { setDraftTo(e.currentTarget.value); setSliderMax(pctOf(e.currentTarget.value)); setActiveQuick(null); }} />
          </div>
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
          <div class="slicer-active-wrap">
            <button class="slicer-apply-btn" onClick={applyCustom}>Aplică</button>
            <button class="slicer-reset-btn" onClick={resetPeriod}>Reset</button>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface LocationOption { id: number; name: string }

// Lista locațiilor — fetch-uită o singură dată și partajată între panel-uri.
const [locationsList, setLocationsList] = createSignal<LocationOption[]>([]);
let locationsFetched = false;

async function ensureLocationsLoaded() {
  if (locationsFetched) return;
  locationsFetched = true;
  try {
    const res = await apiFetch("/api/locations?limit=200");
    if (!res.ok) return;
    const json = await res.json() as { items: LocationOption[] };
    setLocationsList((json.items ?? []).map((l) => ({ id: l.id, name: l.name })));
  } catch {
    locationsFetched = false; // permitem retry data viitoare
  }
}

function LocationFilter(props: {
  selected: () => number[];
  setSelected: (v: number[]) => void;
}) {
  function toggle(id: number) {
    const cur = props.selected();
    props.setSelected(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  function selectAll() { props.setSelected([]); }
  return (
    <Show when={locationsList().length > 0}>
      <div class="loc-filter">
        <span class="loc-filter__title">Locații</span>
        <div class="loc-filter__chips">
          <button
            type="button"
            class="loc-chip"
            classList={{ "loc-chip--active": props.selected().length === 0 }}
            onClick={selectAll}
          >Toate</button>
          <For each={locationsList()}>
            {(loc) => (
              <button
                type="button"
                class="loc-chip"
                classList={{ "loc-chip--active": props.selected().includes(loc.id) }}
                onClick={() => toggle(loc.id)}
              >{loc.name}</button>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

function LocatiiPanel() {
  const [data, setData] = createSignal<LocatiiSummary | null>(null);
  const [, setLoading] = createSignal(true);
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>("rapoarte_locatii_ids", []);

  let lineRef: HTMLDivElement | undefined;
  let donutRef: HTMLDivElement | undefined;
  let itypeDonutRef: HTMLDivElement | undefined;
  let momRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/locatii?${qs.toString()}`);
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

  onMount(ensureLocationsLoaded);

  // Reîncarcă la schimbare de perioadă SAU de selecție locații
  createEffect(() => { periodVersion(); selectedLocIds(); void load(); });

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

      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

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

      {/* Mix metode de plată donut + tabel */}
      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
          <div style="flex:1;min-width:260px">
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
          <Show when={data()}>
            {(d) => {
              const items = () => [
                { label: "Card", value: toNumber(d().pay_methods.sum_card), color: PAY_COLORS[0] },
                { label: "Cash", value: toNumber(d().pay_methods.sum_cash), color: PAY_COLORS[1] },
                { label: "OP", value: toNumber(d().pay_methods.sum_op), color: PAY_COLORS[2] },
                { label: "Parțial", value: toNumber(d().pay_methods.sum_partial), color: PAY_COLORS[3] },
                { label: "Neplătit", value: toNumber(d().pay_methods.sum_neplatit), color: PAY_COLORS[4] },
              ];
              const totalPay = () => items().reduce((s, i) => s + i.value, 0);
              return (
                <div style="flex:1;min-width:260px;align-self:center">
                  <table class="locatii-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                    <thead>
                      <tr>
                        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border,#2a3045);color:var(--text-muted,#8b90a0);font-weight:600">Metodă</th>
                        <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border,#2a3045);color:var(--text-muted,#8b90a0);font-weight:600">Valoare (lei)</th>
                        <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border,#2a3045);color:var(--text-muted,#8b90a0);font-weight:600">Procent</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={items()}>
                        {(it) => {
                          const pct = totalPay() > 0 ? (it.value / totalPay()) * 100 : 0;
                          return (
                            <tr>
                              <td style="padding:6px 8px;border-bottom:1px solid var(--border-soft,#222838)">
                                <span style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${it.color};margin-right:8px;vertical-align:middle`} />
                                {it.label}
                              </td>
                              <td style="padding:6px 8px;border-bottom:1px solid var(--border-soft,#222838);text-align:right;font-variant-numeric:tabular-nums">{fmtMoney(it.value)}</td>
                              <td style="padding:6px 8px;border-bottom:1px solid var(--border-soft,#222838);text-align:right;font-variant-numeric:tabular-nums;color:var(--text-muted,#8b90a0)">{pct.toFixed(1)}%</td>
                            </tr>
                          );
                        }}
                      </For>
                      <tr>
                        <td style="padding:8px;font-weight:700">Total</td>
                        <td style="padding:8px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">{fmtMoney(totalPay())}</td>
                        <td style="padding:8px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            }}
          </Show>
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

// ───── COMPARARE YoY PANEL ────────────────────────────────────────────────────

interface YoYBucketAPI {
  month?: number;
  quarter?: number;
  location_id?: number | null;
  location_name?: string;
  value_a: string | number;
  value_b: string | number;
  delta_abs: string | number;
  delta_pct: number | null;
}

interface YoYSummaryAPI {
  year_a: number;
  year_b: number;
  metric: string;
  total_a: string | number;
  total_b: string | number;
  delta_abs: string | number;
  delta_pct: number | null;
  monthly: YoYBucketAPI[];
  quarterly: YoYBucketAPI[];
  per_location: YoYBucketAPI[];
}

type YoYMetric = "sum_total" | "sum_paid" | "count_total";

const RO_MONTHS_SHORT = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Noi","Dec"];

function CompareYoYPanel() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [yearA, setYearA] = persistedSignal<number>("rapoarte_yoy_year_a", currentYear);
  const [yearB, setYearB] = persistedSignal<number>("rapoarte_yoy_year_b", currentYear - 1);
  const [metric, setMetric] = persistedSignal<YoYMetric>("rapoarte_yoy_metric", "sum_total");
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>("rapoarte_yoy_loc_ids", []);
  const [data, setData] = createSignal<YoYSummaryAPI | null>(null);
  const [, setLoading] = createSignal(true);

  let monthlyRef: HTMLDivElement | undefined;
  let quarterlyRef: HTMLDivElement | undefined;
  let perLocRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        year_a: String(yearA()),
        year_b: String(yearB()),
        metric: metric(),
      });
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/locatii-yoy?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului YoY.`, "error");
        return;
      }
      setData(await res.json());
    } catch {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(ensureLocationsLoaded);

  createEffect(() => {
    // reîncărcăm la orice schimbare de an / metrică / locații
    yearA(); yearB(); metric(); selectedLocIds();
    void load();
  });

  const unit = () => metric() === "count_total" ? "buc" as const : "lei" as const;

  createEffect(() => {
    const d = data();
    if (!d || !monthlyRef) return;
    const items: YoYBucket[] = d.monthly.map((m) => ({
      label: RO_MONTHS_SHORT[(m.month || 1) - 1],
      value_a: toNumber(m.value_a),
      value_b: toNumber(m.value_b),
      delta_pct: m.delta_pct,
    }));
    drawYoYBars(monthlyRef, items, d.year_a, d.year_b, unit());
  });

  createEffect(() => {
    const d = data();
    if (!d || !quarterlyRef) return;
    const items: YoYBucket[] = d.quarterly.map((q) => ({
      label: `Q${q.quarter ?? "?"}`,
      value_a: toNumber(q.value_a),
      value_b: toNumber(q.value_b),
      delta_pct: q.delta_pct,
    }));
    drawYoYBars(quarterlyRef, items, d.year_a, d.year_b, unit());
  });

  createEffect(() => {
    const d = data();
    if (!d || !perLocRef) return;
    const items: YoYBucket[] = d.per_location.map((l) => ({
      label: l.location_name || "Fără locație",
      value_a: toNumber(l.value_a),
      value_b: toNumber(l.value_b),
      delta_pct: l.delta_pct,
    }));
    drawYoYBars(perLocRef, items, d.year_a, d.year_b, unit());
  });

  function shiftPair(deltaYears: number) {
    setYearA(yearA() + deltaYears);
    setYearB(yearB() + deltaYears);
  }
  function presetCurrentVsPrev() { setYearA(currentYear); setYearB(currentYear - 1); }
  function presetPrevVsTwoBack() { setYearA(currentYear - 1); setYearB(currentYear - 2); }

  const metricLabel = () => {
    if (metric() === "sum_paid") return "Venit încasat";
    if (metric() === "count_total") return "Număr de bonuri";
    return "Venit total facturat";
  };
  const unitLabel = () => unit() === "lei" ? "lei" : "buc";

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Comparare Year-over-Year" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:780px;line-height:1.6">
          Comparație cap-la-cap între doi ani: defalcare lunară, trimestrială și pe
          locații. Implicit afișează <strong>anul curent vs anul trecut</strong>,
          dar poți alege orice combinație (de ex. <em>anul trecut vs acum doi ani</em>).
          Δ% deasupra fiecărei perechi de bare indică variația anului A față de anul B
          (verde = creștere, roșu = scădere).
        </p>
      </Show>

      {/* Controale: ani + metrică + preset-uri */}
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:14px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.8rem;color:var(--text-muted,#8b90a0)">
          <span>Anul A (referința „curentă")</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={yearA()}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (!Number.isNaN(v)) setYearA(v);
            }}
            style="width:96px;padding:6px 8px;border-radius:6px;border:1px solid var(--border,#2a3045);background:var(--surface,#1e2330);color:var(--text,#e8eaf0)"
          />
        </label>
        <span style="font-weight:700;font-size:1.1rem;padding-bottom:8px">vs</span>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.8rem;color:var(--text-muted,#8b90a0)">
          <span>Anul B (comparator)</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={yearB()}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (!Number.isNaN(v)) setYearB(v);
            }}
            style="width:96px;padding:6px 8px;border-radius:6px;border:1px solid var(--border,#2a3045);background:var(--surface,#1e2330);color:var(--text,#e8eaf0)"
          />
        </label>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:0.8rem;color:var(--text-muted,#8b90a0)">
          <span>Metrică</span>
          <select
            value={metric()}
            onChange={(e) => setMetric(e.currentTarget.value as YoYMetric)}
            style="padding:6px 8px;border-radius:6px;border:1px solid var(--border,#2a3045);background:var(--surface,#1e2330);color:var(--text,#e8eaf0)"
          >
            <option value="sum_total">Venit total facturat (lei)</option>
            <option value="sum_paid">Venit încasat (lei)</option>
            <option value="count_total">Număr de bonuri</option>
          </select>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="loc-chip" onClick={presetCurrentVsPrev}>An curent vs an trecut</button>
          <button type="button" class="loc-chip" onClick={presetPrevVsTwoBack}>An trecut vs acum 2 ani</button>
          <button type="button" class="loc-chip" title="Mută ambii ani cu -1" onClick={() => shiftPair(-1)}>← 1 an</button>
          <button type="button" class="loc-chip" title="Mută ambii ani cu +1" onClick={() => shiftPair(1)}>1 an →</button>
        </div>
      </div>

      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

      {/* KPI rezumat */}
      <Show when={data()}>
        {(d) => (
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:14px 0">
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Total {d().year_a} ({metricLabel()})</span>
              <span class="locatii-kpi__value">{fmtMoney(toNumber(d().total_a))} {unitLabel()}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Total {d().year_b}</span>
              <span class="locatii-kpi__value" style="color:var(--text-muted,#8b90a0)">{fmtMoney(toNumber(d().total_b))} {unitLabel()}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Diferență absolută</span>
              <span class="locatii-kpi__value" style={`color:${toNumber(d().delta_abs) >= 0 ? "#3ea96a" : "#ef4444"}`}>
                {toNumber(d().delta_abs) >= 0 ? "+" : ""}{fmtMoney(toNumber(d().delta_abs))} {unitLabel()}
              </span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Variație YoY</span>
              <Show when={d().delta_pct !== null} fallback={
                <span class="locatii-kpi__value" style="color:var(--text-muted,#8b90a0)">—</span>
              }>
                <span class="locatii-kpi__value" style={`color:${(d().delta_pct ?? 0) >= 0 ? "#3ea96a" : "#ef4444"}`}>
                  {(d().delta_pct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(d().delta_pct ?? 0).toFixed(1)}%
                </span>
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* Charts */}
      <div class="locatii-charts">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Comparație lunară</div>
          <div class="locatii-chart-subtitle">
            {metricLabel()} · {yearA()} vs {yearB()} · Δ% afișat deasupra fiecărei perechi de bare
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Pentru fiecare lună sunt afișate două bare: <strong>anul A</strong> (culoare accent)
              și <strong>anul B</strong> (gri). Δ% de deasupra reprezintă variația procentuală a anului A
              față de anul B. Util pentru a vedea trendul sezonier și efectele
              promoționale lunare.
            </p>
          </Show>
          <div ref={monthlyRef} style="margin-top:8px" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Comparație trimestrială</div>
          <div class="locatii-chart-subtitle">
            {metricLabel()} · {yearA()} vs {yearB()} · agregat pe trimestre
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Aceleași date agregate pe trimestre (Q1 = ian-mar, Q2 = apr-iun, Q3 = iul-sep, Q4 = oct-dec).
              Util pentru a vedea sezonalitatea anuală fără zgomotul fluctuațiilor lunare.
            </p>
          </Show>
          <div ref={quarterlyRef} style="margin-top:8px" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Per locație</div>
          <div class="locatii-chart-subtitle">
            {metricLabel()} pe întreg anul · sortat descrescător după {yearA()}
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Comparație totală anuală per locație. Δ% indică creșterea/scăderea fiecărei locații
              de la anul B la anul A. Aplică filtrul de locații de mai sus pentru a vedea
              doar locațiile relevante.
            </p>
          </Show>
          <div ref={perLocRef} style="margin-top:8px" />
        </div>
      </div>

      {/* Tabel detaliat lunar */}
      <Show when={data()}>
        {(d) => (
          <div class="locatii-chart-card" style="margin-top:14px">
            <div class="locatii-chart-title">Detaliu lunar</div>
            <div class="locatii-chart-subtitle">Toate cele 12 luni, cu Δ absolut și Δ procentual</div>
            <div class="rapoarte-table-scroll" style="margin-top:10px">
              <table>
                <thead>
                  <tr>
                    <th style="text-align:left">Luna</th>
                    <th class="num">{d().year_a}</th>
                    <th class="num">{d().year_b}</th>
                    <th class="num">Δ absolut</th>
                    <th class="num">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={d().monthly}>
                    {(m) => {
                      const va = toNumber(m.value_a);
                      const vb = toNumber(m.value_b);
                      const da = toNumber(m.delta_abs);
                      const positive = da >= 0;
                      return (
                        <tr>
                          <td class="nowrap">{RO_MONTHS_SHORT[(m.month || 1) - 1]}</td>
                          <td class="num">{fmtMoney(va)}</td>
                          <td class="num" style="color:var(--text-muted,#8b90a0)">{fmtMoney(vb)}</td>
                          <td class="num" style={`color:${positive ? "#3ea96a" : "#ef4444"};font-weight:600`}>
                            {positive ? "+" : ""}{fmtMoney(da)}
                          </td>
                          <td class="num" style={`color:${m.delta_pct === null ? "var(--text-muted,#8b90a0)" : (m.delta_pct >= 0 ? "#3ea96a" : "#ef4444")};font-weight:600`}>
                            <Show when={m.delta_pct !== null} fallback="—">
                              {(m.delta_pct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(m.delta_pct ?? 0).toFixed(1)}%
                            </Show>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Show>
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

// PALETTE, colorByIndex importate din ./rapoarte/constants

function ProduseServiciiPanel() {
  const [data, setData] = createSignal<ProduseServiciiSummary | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>("rapoarte_ps_loc_ids", []);

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
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/produse-servicii?${qs.toString()}`);
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

  onMount(ensureLocationsLoaded);
  createEffect(() => { periodVersion(); selectedLocIds(); void load(); });

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

      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

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

            {/* Row 4: Comparare servicii (multi-line chart) */}
            <h3 class="locatii-section-title" style="margin-top:24px">4. Comparare servicii în timp</h3>
            <Show when={!hideExplanations()}>
              <p class="chart-explanation" style="max-width:820px">
                Selectează din dreapta unul sau mai multe servicii (sau produse) pentru a vedea
                evoluția lor pe perioada selectată în acelaşi grafic. Folosește filtrele de
                departament şi categorie pentru a restrânge lista. Maxim 30 servicii odată.
              </p>
            </Show>
            <CompareServicesBlock selectedLocIds={selectedLocIds} />
          </>
        )}
      </Show>
    </div>
  );
}

// ───── COMPARARE SERVICII (multi-line chart) ──────────────────────────────────

interface CatalogItem {
  item_id: number;
  item_name: string;
  item_type: string;
  category_id: number;
  category_name: string;
  department_id: number | null;
  department_name: string;
}

interface SeriesPoint { report_date: string; total: string | number }
interface ApiSeries {
  item_id: number;
  item_name: string;
  category_name: string;
  department_name: string;
  points: SeriesPoint[];
  total: string | number;
}
interface TimeseriesResponse {
  series: ApiSeries[];
  period_start: string;
  period_end: string;
}

function CompareServicesBlock(props: { selectedLocIds: () => number[] }) {
  const [catalog, setCatalog] = createSignal<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = createSignal(true);
  const [selectedIds, setSelectedIds] = persistedSignal<number[]>("rapoarte_ps_compare_ids", []);
  const [series, setSeries] = createSignal<ApiSeries[]>([]);
  const [loadingSeries, setLoadingSeries] = createSignal(false);

  const [filterDeptId, setFilterDeptId] = persistedSignal<number | null>("rapoarte_ps_compare_dept", null);
  const [filterCatId, setFilterCatId] = persistedSignal<number | null>("rapoarte_ps_compare_cat", null);
  const [search, setSearch] = persistedSignal<string>("rapoarte_ps_compare_search", "");

  let chartRef: HTMLDivElement | undefined;

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const res = await reportsApiFetch("/api/reports/items-catalog");
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea catalogului.`, "error");
        return;
      }
      const data = await res.json();
      setCatalog(data.items as CatalogItem[]);
    } catch {
      notify("Eroare de reţea la încărcarea catalogului.", "error");
    } finally {
      setLoadingCatalog(false);
    }
  }

  async function loadSeries() {
    if (selectedIds().length === 0) {
      setSeries([]);
      return;
    }
    setLoadingSeries(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      for (const id of selectedIds()) qs.append("item_ids", String(id));
      for (const id of props.selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/items-timeseries?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea seriilor.`, "error");
        return;
      }
      const data = (await res.json()) as TimeseriesResponse;
      setSeries(data.series);
    } catch {
      notify("Eroare de reţea la timeseries.", "error");
    } finally {
      setLoadingSeries(false);
    }
  }

  onMount(() => { void loadCatalog(); });
  createEffect(() => {
    periodVersion();
    selectedIds();
    props.selectedLocIds();
    void loadSeries();
  });

  // Resetăm filtrul de categorie dacă departamentul se schimbă
  createEffect(() => {
    const did = filterDeptId();
    if (did === null) return;
    const cid = filterCatId();
    if (cid === null) return;
    const cat = catalog().find((c) => c.category_id === cid);
    if (!cat || cat.department_id !== did) setFilterCatId(null);
  });

  // Listă departamente unice (cele cu id valid; itemii fara departament intra in "Toate")
  const departments = createMemo(() => {
    const map = new Map<number, string>();
    catalog().forEach((it) => {
      if (it.department_id !== null && !map.has(it.department_id)) {
        map.set(it.department_id, it.department_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ro"));
  });

  // Listă categorii (filtrate după department dacă e selectat)
  const categories = createMemo(() => {
    const did = filterDeptId();
    const seen = new Set<number>();
    const out: { id: number; name: string; department_name: string }[] = [];
    catalog().forEach((it) => {
      if (did !== null && it.department_id !== did) return;
      if (seen.has(it.category_id)) return;
      seen.add(it.category_id);
      out.push({ id: it.category_id, name: it.category_name, department_name: it.department_name });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  });

  // Itemii filtraţi pentru lista de selecție
  const filteredItems = createMemo(() => {
    const did = filterDeptId();
    const cid = filterCatId();
    const q = search().trim().toLowerCase();
    return catalog().filter((it) => {
      if (did !== null && it.department_id !== did) return false;
      if (cid !== null && it.category_id !== cid) return false;
      if (q && !it.item_name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  function toggle(id: number) {
    const cur = selectedIds();
    if (cur.includes(id)) {
      setSelectedIds(cur.filter((x) => x !== id));
    } else {
      if (cur.length >= 30) {
        notify("Maxim 30 servicii pot fi comparate odată.", "warn");
        return;
      }
      setSelectedIds([...cur, id]);
    }
  }

  function clearSelection() { setSelectedIds([]); }

  // Map item_id → CatalogItem pentru afișarea chip-urilor selectate
  const selectedItems = createMemo(() => {
    const ids = new Set(selectedIds());
    return catalog().filter((it) => ids.has(it.item_id));
  });

  // Render chart cu ResizeObserver atasat (redraw la rotire/resize)
  createEffect(() => {
    if (!chartRef) return;
    const s = series();
    const mlSeries: MultiLineSeries[] = s.length === 0 ? [] : s.map((srv, i) => ({
      key: String(srv.item_id),
      label: srv.item_name,
      color: colorByIndex(i),
      points: srv.points.map((p) => ({ date: p.report_date, value: toNumber(p.total) })),
    }));
    attachMultiLineResize(chartRef, mlSeries, { dateFrom: periodFrom(), dateTo: periodTo() });
  });

  onCleanup(() => {
    if (!chartRef) return;
    const obs = (chartRef as any).__multiLineResizeObs as ResizeObserver | undefined;
    if (obs) { obs.disconnect(); delete (chartRef as any).__multiLineResizeObs; }
  });

  return (
    <div class="compare-services-grid">
      {/* Stânga: chart + legendă */}
      <div class="locatii-chart-card" style="min-width:0">
        <div class="locatii-chart-title">Evoluţie zilnică · {periodLabel()}</div>
        <div class="locatii-chart-subtitle">RON · o linie pentru fiecare serviciu selectat</div>

        <Show when={loadingSeries()}>
          <p class="cfg-hint" style="margin-top:14px">Se încarcă datele...</p>
        </Show>

        <div ref={chartRef} style="margin-top:10px;min-height:240px" />

        <Show when={selectedItems().length > 0}>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">
            <For each={selectedItems()}>
              {(it, i) => (
                <span
                  class="loc-chip loc-chip--active"
                  style={`background:${colorByIndex(i())};border-color:${colorByIndex(i())};color:#fff;cursor:pointer`}
                  title="Click pentru a deselecta"
                  onClick={() => toggle(it.item_id)}
                >
                  {it.item_name} · {it.category_name}
                </span>
              )}
            </For>
            <button type="button" class="loc-chip" onClick={clearSelection}>Curăţă tot</button>
          </div>
        </Show>

        <Show when={selectedItems().length > 0 && series().length > 0}>
          <div style="margin-top:14px;font-size:0.85rem;color:var(--text-muted)">
            <For each={series()}>
              {(s) => (
                <div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0">
                  <span>{s.item_name} <span style="opacity:0.7">· {s.category_name} · {s.department_name}</span></span>
                  <strong>{fmtMoney(toNumber(s.total))} lei</strong>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Dreapta: filtre + listă selectabilă (pe mobil apare deasupra prin order:-1) */}
      <div class="locatii-chart-card compare-services-filters" style="display:flex;flex-direction:column;gap:10px">
        <div class="locatii-chart-title">Filtrare servicii</div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:0.78rem;color:var(--text-muted)">Departament</label>
          <select
            class="input"
            style="height:32px;padding:2px 8px"
            value={filterDeptId() === null ? "" : String(filterDeptId())}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFilterDeptId(v === "" ? null : Number(v));
            }}
          >
            <option value="">Toate departamentele</option>
            <For each={departments()}>
              {(d) => <option value={String(d.id)}>{d.name}</option>}
            </For>
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:0.78rem;color:var(--text-muted)">Categorie</label>
          <select
            class="input"
            style="height:32px;padding:2px 8px"
            value={filterCatId() === null ? "" : String(filterCatId())}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFilterCatId(v === "" ? null : Number(v));
            }}
          >
            <option value="">Toate categoriile</option>
            <For each={categories()}>
              {(c) => <option value={String(c.id)}>{c.name}</option>}
            </For>
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:0.78rem;color:var(--text-muted)">Caută</label>
          <input
            type="search"
            class="input"
            style="height:32px;padding:2px 8px"
            placeholder="nume serviciu..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>

        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">
          {filteredItems().length} de servicii · {selectedIds().length}/30 selectate
        </div>

        <Show when={loadingCatalog()} fallback={
          <div class="compare-services-list" style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:4px">
            <Show when={filteredItems().length === 0}>
              <div style="padding:18px;text-align:center;color:var(--text-muted);font-size:0.85rem">Niciun serviciu nu corespunde filtrelor.</div>
            </Show>
            <For each={filteredItems()}>
              {(it) => {
                const checked = () => selectedIds().includes(it.item_id);
                return (
                  <label style="display:flex;align-items:flex-start;gap:8px;padding:6px;border-radius:4px;cursor:pointer;font-size:0.85rem"
                         classList={{ "compare-row--active": checked() }}>
                    <input
                      type="checkbox"
                      checked={checked()}
                      onChange={() => toggle(it.item_id)}
                      style="margin-top:3px;flex-shrink:0"
                    />
                    <span style="min-width:0;flex:1">
                      <span style="display:block">{it.item_name}</span>
                      <span style="display:block;font-size:0.74rem;color:var(--text-muted)">{it.category_name} · {it.department_name}</span>
                    </span>
                  </label>
                );
              }}
            </For>
          </div>
        }>
          <p class="cfg-hint">Se încarcă...</p>
        </Show>
      </div>
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
  locations: { location_id: number | null; location_name: string; total: string }[];
}

function AngajatiPanel() {
  const [employees, setEmployees] = createSignal<EmployeeReport[]>([]);
  const [selectedId, setSelectedId] = persistedSignal<number | null>("rapoarte_angajat_selected", null);
  const [detail, setDetail] = createSignal<EmpDetail | null>(null);
  const [loadingList, setLoadingList] = createSignal(true);
  const [loadingDetail, setLoadingDetail] = createSignal(false);
  const [search, setSearch] = persistedSignal<string>("rapoarte_angajat_search", "");

  let lineRef: HTMLDivElement | undefined;
  let deptBarRef: HTMLDivElement | undefined;
  let deptDonutRef: HTMLDivElement | undefined;
  let catBarRef: HTMLDivElement | undefined;
  let catDonutRef: HTMLDivElement | undefined;
  let typesBarRef: HTMLDivElement | undefined;
  let typesDonutRef: HTMLDivElement | undefined;
  let deptTypeRef: HTMLDivElement | undefined;
  let monthlyRef: HTMLDivElement | undefined;
  let locDonutRef: HTMLDivElement | undefined;

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
      const res = await reportsApiFetch(`/api/reports/employees/${empId}?${qs.toString()}`);
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

      // Locations donut
      if (locDonutRef) {
        const items: DonutItem[] = (d.locations ?? []).map((l, i) => ({
          label: l.location_name,
          value: toNumber(l.total),
          color: colorByIndex(i),
        }));
        drawDonut(locDonutRef, items, "lei total");
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
        <div class="angajati-strip">
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
          <Show when={filteredEmployees().length === 0}>
            <div class="cfg-hint" style="padding:14px">Niciun angajat.</div>
          </Show>
        </div>

        <Show when={selectedId() === null}>
          <div class="angajati-mdl__placeholder" style="margin-top:14px">
            Apasă pe un angajat din listă pentru a vedea analiza detaliată.
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

                {/* 7. Contribuție per locație */}
                <h3 class="locatii-section-title" style="margin-top:24px">7. Contribuție per locație</h3>
                <Show when={!hideExplanations()}>
                  <p class="chart-explanation" style="max-width:820px">
                    Donut-ul arată cât a generat angajatul în fiecare locație. Dacă apare „Fără locație"
                    înseamnă date vechi de dinainte de migrarea care a adăugat coloana — un
                    <strong> refresh lunar</strong> al raportului <code>employee_daily</code> din AdminV2 le repopulează.
                  </p>
                </Show>
                <Show when={(d().locations?.length ?? 0) === 0}>
                  <div class="locatii-empty">Nicio activitate înregistrată per locație.</div>
                </Show>
                <div class="locatii-chart-card">
                  <div ref={locDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
                </div>
              </>
            )}
          </Show>
        </div>
        </Show>
      </Show>
    </div>
  );
}

// drawLine mutat in ./rapoarte/charts.ts

// DonutItem type mutat in ./rapoarte/charts.ts

// BarItem type mutat in ./rapoarte/charts.ts

// drawDonut mutat in ./rapoarte/charts.ts

// ───── BAR CHART (horizontal) ─────────────────────────────────────────────────

// drawBar mutat in ./rapoarte/charts.ts

// ───── GROUPED BARS (Produse vs Servicii per departament) ─────────────────────

// GroupedBarItem type mutat in ./rapoarte/charts.ts

// drawGroupedBars mutat in ./rapoarte/charts.ts

// ───── MONTHLY BARS cu delta % ────────────────────────────────────────────────

// MonthlyItem type mutat in ./rapoarte/charts.ts

// RO_MONTHS, fmtMonth importate din ./rapoarte/constants

// drawMonthlyBars mutat in ./rapoarte/charts.ts

// ───── TARGET ANGAJAȚI PANEL (donut contribuție pe ultimele 3 luni) ──────────

interface EmpContrib {
  employee_id: number | null;
  employee_name: string;
  image_path: string | null;
  target: string | number;
  sum_amount: string | number;
  count_items: number;
  contribution_pct: number;
  target_progress_pct: number;
}

interface MonthContrib {
  month: string;
  period_start: string;
  period_end: string;
  total: string | number;
  employees: EmpContrib[];
}

interface ContributiiAngajatiSummary {
  months: MonthContrib[];
}

function fmtMonthLabel(month: string, idx: number): { prefix: string; name: string } {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const monthName = new Date(y, (m || 1) - 1, 1)
    .toLocaleDateString("ro-RO", { month: "long" });
  const niceName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const prefix = idx === 0 ? "Luna curentă" : idx === 1 ? "Luna trecută" : "Acum 2 luni";
  return { prefix, name: `${niceName} ${y}` };
}

function TargetAngajatiPanel() {
  const [data, setData] = createSignal<ContributiiAngajatiSummary | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [monthIdx, setMonthIdx] = persistedSignal<number>("rapoarte_ta_month_idx", 0);
  const [donutRef, setDonutRef] = createSignal<HTMLDivElement | null>(null);

  onMount(async () => {
    try {
      const res = await reportsApiFetch("/api/reports/contributii-angajati");
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch {
      notify("Eroare de conexiune la raportul de contribuție.", "error");
    } finally {
      setLoading(false);
    }
  });

  const currentMonth = createMemo<MonthContrib | null>(() => {
    const d = data();
    if (!d) return null;
    return d.months[monthIdx()] ?? null;
  });

  createEffect(() => {
    const m = currentMonth();
    const ref = donutRef();
    if (!ref) return;
    if (!m) {
      d3.select(ref).selectAll("*").remove();
      return;
    }
    const items: DonutItem[] = m.employees.map((e, i) => ({
      label: e.employee_name,
      value: toNumber(e.sum_amount),
      color: colorByIndex(i),
    }));
    drawDonut(ref, items, "lei total lună");
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Target Angajați" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:8px;max-width:680px;line-height:1.6">
          Donutul arată cât a contribuit fiecare angajat din totalul lunii (suma sliceurilor = 100%).
          Datele includ doar încasări <strong>plătite</strong> (exclude bonurile neplătite).
          Targetul afișat pe fiecare card este valoarea curentă din fișa angajatului, iar procentul
          arată gradul de atingere al lui pentru luna selectată.
        </p>
      </Show>

      {/* Selector lună — tab-uri grid responsive */}
      <div class="ta-month-tabs">
        <For each={data()?.months ?? []}>
          {(m, i) => {
            const lbl = fmtMonthLabel(m.month, i());
            return (
              <button
                class="ta-month-tab"
                classList={{ "ta-month-tab--active": monthIdx() === i() }}
                onClick={() => setMonthIdx(i())}
                aria-pressed={monthIdx() === i()}
              >
                <span class="ta-month-tab__label">{lbl.prefix}</span>
                <span class="ta-month-tab__name">{lbl.name}</span>
              </button>
            );
          }}
        </For>
      </div>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>

      <Show when={!loading() && (data()?.months?.length ?? 0) === 0}>
        <p class="cfg-hint">Nu există date pentru ultimele 3 luni.</p>
      </Show>

      <Show when={!loading() && currentMonth() !== null}>
        {(() => {
          const m = currentMonth()!;
          const total = toNumber(m.total);
          return (
            <div class="ta-layout">
              <div class="ta-card">
                <div class="ta-card__title">Contribuție angajați</div>
                <div class="ta-card__subtitle">
                  Total lună: <strong>{fmtMoney(total)} lei</strong>
                  <Show when={m.employees.length > 0}>
                    {" • "}{m.employees.length} angajați activi
                  </Show>
                </div>
                <div class="ta-donut-wrap" ref={setDonutRef} />
              </div>

              <div class="ta-card">
                <div class="ta-card__title">Detalii angajați</div>
                <div class="ta-card__subtitle">Sortat descrescător după contribuție</div>
                <Show when={m.employees.length === 0}>
                  <div class="locatii-empty">Nicio activitate înregistrată în această lună.</div>
                </Show>
                <div class="ta-emp-list">
                  <For each={m.employees}>
                    {(e, i) => {
                      const color = colorByIndex(i());
                      const target = toNumber(e.target);
                      const sum = toNumber(e.sum_amount);
                      const tgtPct = e.target_progress_pct;
                      const tgtPctClamped = Math.min(tgtPct, 100);
                      const tgtColor = tgtPct >= 100 ? "var(--success)" : "var(--accent)";
                      return (
                        <div class="ta-emp-row">
                          <Avatar name={e.employee_name} imagePath={e.image_path} size={48} />
                          <div class="ta-emp-main">
                            <div class="ta-emp-name">{e.employee_name}</div>
                            <div class="ta-emp-meta">
                              {fmtMoney(sum)} lei
                              <Show when={e.count_items > 0}>
                                {" • "}{e.count_items} itemi
                              </Show>
                            </div>
                            <Show when={target > 0}>
                              <div class="ta-target-bar">
                                <div class="ta-target-bar__fill" style={`width:${tgtPctClamped}%;background:${tgtColor}`} />
                              </div>
                              <div class="ta-target-line">
                                <span>Target: {fmtMoney(target)} lei</span>
                                <span class="ta-target-line__pct" style={`color:${tgtColor}`}>{tgtPct.toFixed(0)}%</span>
                              </div>
                            </Show>
                            <Show when={target === 0}>
                              <div class="ta-emp-meta--no-target">Fără target setat</div>
                            </Show>
                          </div>
                          <div
                            class="ta-contrib-badge"
                            style={`background:${color}22;border-color:${color};color:${color}`}
                            title="% contribuție din totalul lunii"
                          >
                            {e.contribution_pct.toFixed(1)}%
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>
          );
        })()}
      </Show>
    </div>
  );
}

// ───── HOTEL ANVELOPE PANEL ───────────────────────────────────────────────────

interface AnvelopeLocationActive {
  location_id: number | null;
  location_name: string;
  cazari_active: number;
  anvelope_depozitate: number;
}

interface AnvelopeLocCazareActive {
  location_id: number | null;
  location_name: string;
  loc_cazare_id: number | null;
  loc_cazare_nume: string;
  cazari_active: number;
  anvelope_depozitate: number;
}

interface AnvelopeMonthly {
  month: string;
  checkins: number;
  checkouts: number;
  checkouts_montate: number;
  anvelope_in: number;
  anvelope_out: number;
}

interface AnvelopeEmployeeTotal {
  employee_id: number | null;
  employee_name: string;
  image_path: string | null;
  count_checkins: number;
  count_checkouts: number;
}

interface AnvelopeEmployeeLocation {
  employee_id: number | null;
  employee_name: string;
  location_id: number | null;
  location_name: string;
  count_checkouts: number;
}

interface AnvelopeKpi {
  cazari_active_total: number;
  anvelope_depozitate_total: number;
  intrari_perioada: number;
  iesiri_perioada: number;
  iesiri_montate_perioada: number;
}

interface HotelAnvelopeSummary {
  kpi: AnvelopeKpi;
  active_per_location: AnvelopeLocationActive[];
  active_per_loc_cazare: AnvelopeLocCazareActive[];
  monthly: AnvelopeMonthly[];
  per_employee: AnvelopeEmployeeTotal[];
  per_employee_location: AnvelopeEmployeeLocation[];
  period_start: string;
  period_end: string;
}

// drawMonthlyDualBars mutat in ./rapoarte/charts.ts

function HotelAnvelopePanel() {
  const [data, setData] = createSignal<HotelAnvelopeSummary | null>(null);
  const [, setLoading] = createSignal(true);
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>(
    "rapoarte_anvelope_loc_ids",
    [],
  );

  let activeBarRef: HTMLDivElement | undefined;
  let monthlyDualRef: HTMLDivElement | undefined;
  let montateDonutRef: HTMLDivElement | undefined;
  let empBarRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/hotel-anvelope?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(ensureLocationsLoaded);
  createEffect(() => {
    periodVersion();
    selectedLocIds();
    void load();
  });

  // Bar: cazări active per locație
  createEffect(() => {
    const d = data();
    if (!d || !activeBarRef) return;
    const items: BarItem[] = d.active_per_location.map((r, i) => ({
      label: r.location_name,
      value: r.cazari_active,
      color: colorByIndex(i),
    }));
    drawBar(activeBarRef, items);
  });

  // Dual bars: intrări vs scoateri pe lună
  createEffect(() => {
    const d = data();
    if (!d || !monthlyDualRef) return;
    drawMonthlyDualBars(
      monthlyDualRef,
      d.monthly.map((m) => ({
        month: m.month,
        checkins: m.checkins,
        checkouts: m.checkouts,
      })),
    );
  });

  // Donut: scoateri montate vs nemontate
  createEffect(() => {
    const d = data();
    if (!d || !montateDonutRef) return;
    const montate = d.kpi.iesiri_montate_perioada;
    const nemontate = Math.max(0, d.kpi.iesiri_perioada - montate);
    const items: DonutItem[] = [
      { label: "Montate pe mașină", value: montate, color: "#3ea96a" },
      { label: "Predate la sediu", value: nemontate, color: "#5b7cfa" },
    ].filter((i) => i.value > 0);
    drawDonut(montateDonutRef, items, "scoateri");
  });

  // Bar: cazări (check-ins) per angajat
  createEffect(() => {
    const d = data();
    if (!d || !empBarRef) return;
    const items: BarItem[] = d.per_employee.map((r, i) => ({
      label: r.employee_name,
      value: r.count_checkins,
      color: colorByIndex(i),
    }));
    drawBar(empBarRef, items);
  });

  // Matrice angajat × locație (scoateri): grupăm pe angajat, păstrăm doar
  // angajații cu cel puțin o scoatere în perioadă.
  const matrix = createMemo(() => {
    const d = data();
    if (!d) return { employees: [] as string[], locations: [] as string[], grid: {} as Record<string, Record<string, number>> };
    const byEmp = new Map<string, Map<string, number>>();
    const locSet = new Set<string>();
    for (const r of d.per_employee_location) {
      const emp = r.employee_name;
      const loc = r.location_name;
      locSet.add(loc);
      let m = byEmp.get(emp);
      if (!m) {
        m = new Map();
        byEmp.set(emp, m);
      }
      m.set(loc, (m.get(loc) ?? 0) + r.count_checkouts);
    }
    const employees = Array.from(byEmp.keys()).sort((a, b) => {
      const sa = Array.from(byEmp.get(a)!.values()).reduce((s, v) => s + v, 0);
      const sb = Array.from(byEmp.get(b)!.values()).reduce((s, v) => s + v, 0);
      return sb - sa;
    });
    const locations = Array.from(locSet).sort();
    const grid: Record<string, Record<string, number>> = {};
    for (const e of employees) {
      grid[e] = {};
      const m = byEmp.get(e)!;
      for (const l of locations) grid[e][l] = m.get(l) ?? 0;
    }
    return { employees, locations, grid };
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Hotel Anvelope" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:780px;line-height:1.6">
          Această secțiune arată operațiunile din hotelul de anvelope: câte cazări sunt
          active acum (anvelope efectiv depozitate la sediu), câte intrări și scoateri
          au fost procesate, cine le-a procesat și unde. Snapshot-ul „cazări active" este
          calculat live, restul indicatorilor sunt agregați noaptea de un proces automat.
        </p>
      </Show>

      <PeriodSlicer />
      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

      <Show when={data()}>
        {(d) => (
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0">
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Cazări active</span>
              <span class="locatii-kpi__value">{d().kpi.cazari_active_total}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Anvelope depozitate</span>
              <span class="locatii-kpi__value">{d().kpi.anvelope_depozitate_total}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Intrări (perioadă)</span>
              <span class="locatii-kpi__value">{d().kpi.intrari_perioada}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Scoateri (perioadă)</span>
              <span class="locatii-kpi__value">{d().kpi.iesiri_perioada}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Scoateri montate</span>
              <span class="locatii-kpi__value">{d().kpi.iesiri_montate_perioada}</span>
            </div>
          </div>
        )}
      </Show>

      <div class="locatii-charts">
        <div class="locatii-chart-card" style="flex:2;min-width:0">
          <div class="locatii-chart-title">Cazări active per locație</div>
          <div class="locatii-chart-subtitle">Snapshot curent — cazări fără check-out</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Numărul de cazări <strong>active acum</strong> în fiecare locație. Filtrul de perioadă
              nu se aplică aici — e o fotografie a momentului prezent. Folosește tabelul de mai jos
              pentru a vedea și câte anvelope sunt depozitate fizic.
            </p>
          </Show>
          <div ref={activeBarRef} style="margin-top:8px" />
        </div>
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Detalii per locație</div>
          <div class="locatii-chart-subtitle">Cazări + anvelope depozitate</div>
          <Show when={data()}>
            {(d) => (
              <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:0.85rem">
                <thead>
                  <tr style="border-bottom:1px solid var(--border)">
                    <th style="text-align:left;padding:6px 4px">Locație</th>
                    <th style="text-align:right;padding:6px 4px">Cazări</th>
                    <th style="text-align:right;padding:6px 4px">Anvelope</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={d().active_per_location}>
                    {(r) => (
                      <tr style="border-bottom:1px solid var(--border)">
                        <td style="padding:6px 4px">{r.location_name}</td>
                        <td style="text-align:right;padding:6px 4px">{r.cazari_active}</td>
                        <td style="text-align:right;padding:6px 4px">{r.anvelope_depozitate}</td>
                      </tr>
                    )}
                  </For>
                  <Show when={d().active_per_location.length === 0}>
                    <tr>
                      <td colspan="3" style="padding:12px;text-align:center;color:var(--text-muted)">
                        Nicio cazare activă.
                      </td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            )}
          </Show>
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Locuri de depozitare</div>
          <div class="locatii-chart-subtitle">
            Câte cazări și câte anvelope sunt în fiecare loc de depozitare, grupat pe locație
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Pentru fiecare locație, vezi defalcarea pe locurile fizice de depozitare (rafturi, camere etc.):
              câte cazări active sunt acolo și câte anvelope conțin total. Util pentru a vedea
              ocuparea pe spații și a planifica reorganizarea.
            </p>
          </Show>
          <Show when={data()}>
            {(d) => {
              const groups = createMemo(() => {
                const byLoc = new Map<string, AnvelopeLocCazareActive[]>();
                for (const r of d().active_per_loc_cazare) {
                  const key = r.location_name;
                  const arr = byLoc.get(key) ?? [];
                  arr.push(r);
                  byLoc.set(key, arr);
                }
                return Array.from(byLoc.entries()).map(([location_name, rows]) => ({
                  location_name,
                  rows,
                  cazari_total: rows.reduce((s, r) => s + r.cazari_active, 0),
                  anvelope_total: rows.reduce((s, r) => s + r.anvelope_depozitate, 0),
                }));
              });
              return (
                <Show
                  when={groups().length > 0}
                  fallback={
                    <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem">
                      Nicio cazare activă.
                    </div>
                  }
                >
                  <div style="overflow-x:auto;margin-top:8px">
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
                      <thead>
                        <tr style="border-bottom:1px solid var(--border)">
                          <th style="text-align:left;padding:6px 8px">Locație / Loc de depozitare</th>
                          <th style="text-align:right;padding:6px 8px">Cazări</th>
                          <th style="text-align:right;padding:6px 8px">Anvelope</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={groups()}>
                          {(g) => (
                            <>
                              <tr style="background:var(--surface2);font-weight:600">
                                <td style="padding:8px;border-top:1px solid var(--border)">{g.location_name}</td>
                                <td style="text-align:right;padding:8px;border-top:1px solid var(--border)">{g.cazari_total}</td>
                                <td style="text-align:right;padding:8px;border-top:1px solid var(--border)">{g.anvelope_total}</td>
                              </tr>
                              <For each={g.rows}>
                                {(r) => (
                                  <tr style="border-top:1px solid var(--border)">
                                    <td style="padding:6px 8px 6px 24px;color:var(--text-muted)">↳ {r.loc_cazare_nume}</td>
                                    <td style="text-align:right;padding:6px 8px">{r.cazari_active}</td>
                                    <td style="text-align:right;padding:6px 8px">{r.anvelope_depozitate}</td>
                                  </tr>
                                )}
                              </For>
                            </>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              );
            }}
          </Show>
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:2;min-width:0">
          <div class="locatii-chart-title">Intrări vs scoateri pe lună</div>
          <div class="locatii-chart-subtitle">Mișcările lunare în perioada selectată</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Bare grupate per lună: <strong>verde</strong> = intrări (cazări noi), <strong>portocaliu</strong> = scoateri
              (cazări încheiate). Util pentru a vedea sezonalitatea (peak primăvară/toamnă) și
              echilibrul intrări/ieșiri într-o perioadă.
            </p>
          </Show>
          <div ref={monthlyDualRef} style="margin-top:8px" />
        </div>
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Scoateri montate pe mașină</div>
          <div class="locatii-chart-subtitle">Anvelope predate montate vs predate la sediu</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              La scoatere, anvelopele pot fi montate direct pe mașină (clientul pleacă cu ele
              montate) sau predate la sediu. Util pentru a vedea ce procent din scoateri sunt
              însoțite de serviciul de montaj.
            </p>
          </Show>
          <div ref={montateDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Cazări per angajat</div>
          <div class="locatii-chart-subtitle">
            Numărul de check-in-uri procesate de fiecare angajat în perioada selectată
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Câte cazări noi a procesat fiecare angajat. Util pentru a vedea distribuția
              volumului de muncă pe operațiunea de hotel anvelope.
            </p>
          </Show>
          <div ref={empBarRef} style="margin-top:8px" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Scoateri: angajat × locație</div>
          <div class="locatii-chart-subtitle">
            Câte scoateri a procesat fiecare angajat în fiecare locație
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Matrice cu numărul de scoateri (check-out-uri) per combinație angajat × locație.
              Util pentru a vedea cine acoperă ce locație și echilibrul de încărcare.
            </p>
          </Show>
          <Show when={data()}>
            {(_d) => {
              const m = matrix();
              return (
                <Show
                  when={m.employees.length > 0 && m.locations.length > 0}
                  fallback={
                    <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem">
                      Nicio scoatere în perioada selectată.
                    </div>
                  }
                >
                  <div style="overflow-x:auto;margin-top:8px">
                    <table style="border-collapse:collapse;font-size:0.85rem;min-width:100%">
                      <thead>
                        <tr style="border-bottom:1px solid var(--border)">
                          <th style="text-align:left;padding:6px 8px;position:sticky;left:0;background:var(--surface);z-index:1">
                            Angajat
                          </th>
                          <For each={m.locations}>
                            {(loc) => (
                              <th style="text-align:right;padding:6px 8px;white-space:nowrap">{loc}</th>
                            )}
                          </For>
                          <th style="text-align:right;padding:6px 8px;border-left:1px solid var(--border)">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={m.employees}>
                          {(emp) => {
                            const total = m.locations.reduce((s, l) => s + (m.grid[emp][l] ?? 0), 0);
                            return (
                              <tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:6px 8px;white-space:nowrap;position:sticky;left:0;background:var(--surface)">
                                  {emp}
                                </td>
                                <For each={m.locations}>
                                  {(loc) => {
                                    const v = m.grid[emp][loc] ?? 0;
                                    return (
                                      <td
                                        style={`text-align:right;padding:6px 8px;${v === 0 ? "color:var(--text-muted);opacity:0.4" : ""}`}
                                      >
                                        {v || "—"}
                                      </td>
                                    );
                                  }}
                                </For>
                                <td style="text-align:right;padding:6px 8px;font-weight:600;border-left:1px solid var(--border)">
                                  {total}
                                </td>
                              </tr>
                            );
                          }}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              );
            }}
          </Show>
        </div>
      </div>
    </div>
  );
}

// ───── MONTHLY MULTI-SERIES BARS ──────────────────────────────────────────────
// Generic helper pentru bare grupate lunar cu N serii (folosit de Clienți și
// Programări). Spre deosebire de drawMonthlyDualBars (hardcodat pe 2 serii cu
// label „Intrări/Scoateri"), aici fiecare serie își aduce label-ul și culoarea.

// MonthlySeriesItem type mutat in ./rapoarte/charts.ts

// drawMonthlySeriesBars mutat in ./rapoarte/charts.ts

// ───── CLIENȚI (CRM) PANEL ────────────────────────────────────────────────────

interface ClientiKpi {
  clienti_unici: number;
  clienti_noi: number;
  clienti_recurenti: number;
  sum_paid_total: string | number;
  ltv_mediu: string | number;
}

interface ClientiBucket {
  label: string;
  count_clients: number;
  sum_paid: string | number;
  pct: number;      // % din total clienți
  pct_sum: number;  // % din totalul de bani (contribuție bucket)
}

interface ClientiTop {
  client_id: number;
  nume: string;
  telefon: string | null;
  numar_masina: string | null;
  sum_paid: string | number;
  count_receipts: number;
}

interface ClientiNewVsReturning {
  month: string;
  count_new: number;
  count_returning: number;
}

interface ClientiInactiv {
  client_id: number;
  nume: string;
  telefon: string | null;
  numar_masina: string | null;
  last_visit: string;
  sum_paid_total: string | number;
  count_receipts_total: number;
}

interface ClientiSummary {
  kpi: ClientiKpi;
  spending_buckets: ClientiBucket[];
  visit_freq_buckets: ClientiBucket[];
  top_clients: ClientiTop[];
  new_vs_returning: ClientiNewVsReturning[];
  inactivi: ClientiInactiv[];
  period_start: string;
  period_end: string;
}

function ClientiPanel() {
  const [data, setData] = createSignal<ClientiSummary | null>(null);
  const [, setLoading] = createSignal(true);
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>(
    "rapoarte_clienti_loc_ids",
    [],
  );

  let spendingDonutRef: HTMLDivElement | undefined;
  let freqDonutRef: HTMLDivElement | undefined;
  let nvrBarRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/clienti?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(ensureLocationsLoaded);
  createEffect(() => {
    periodVersion();
    selectedLocIds();
    void load();
  });

  createEffect(() => {
    const d = data();
    if (!d || !spendingDonutRef) return;
    const items: DonutItem[] = d.spending_buckets.map((b, i) => ({
      label: b.label,
      value: b.count_clients,
      color: colorByIndex(i),
    }));
    drawDonut(spendingDonutRef, items, "clienți");
  });

  createEffect(() => {
    const d = data();
    if (!d || !freqDonutRef) return;
    const items: DonutItem[] = d.visit_freq_buckets.map((b, i) => ({
      label: b.label,
      value: b.count_clients,
      color: colorByIndex(i + 3),
    }));
    drawDonut(freqDonutRef, items, "clienți");
  });

  createEffect(() => {
    const d = data();
    if (!d || !nvrBarRef) return;
    const items: MonthlySeriesItem[] = d.new_vs_returning.map((m) => ({
      month: m.month,
      series: [
        { key: "new", label: "Noi",       value: m.count_new,       color: "#3ea96a" },
        { key: "ret", label: "Recurenți", value: m.count_returning, color: "#5b7cfa" },
      ],
    }));
    drawMonthlySeriesBars(nvrBarRef, items);
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Clienți" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:780px;line-height:1.6">
          Analiză CRM a portofoliului de clienți pentru perioada și locațiile selectate.
          „Recurent" = client cu 2+ vizite în perioadă; „Nou" = client cu o singură vizită
          (deci pe perioadă mai mare, recurenții cresc cumulativ). Mai jos: profilul de
          cheltuieli, top clienți după valoare și listă de clienți inactivi peste 12 luni
          — utilă pentru campanii de win-back.
        </p>
      </Show>

      <PeriodSlicer />
      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

      <Show when={data()}>
        {(d) => (
          <div class="rapoarte-kpi-grid">
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Clienți unici</span>
              <span class="locatii-kpi__value">{d().kpi.clienti_unici}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Clienți noi</span>
              <span class="locatii-kpi__value">{d().kpi.clienti_noi}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Recurenți</span>
              <span class="locatii-kpi__value">{d().kpi.clienti_recurenti}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">LTV mediu</span>
              <span class="locatii-kpi__value">{fmtMoney(toNumber(d().kpi.ltv_mediu))}</span>
            </div>
          </div>
        )}
      </Show>

      <div class="locatii-charts">
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Profil cheltuieli (buckete)</div>
          <div class="locatii-chart-subtitle">Câți clienți cad în fiecare interval de plată</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Donut-ul împarte clienții în grupe după <strong>cât a plătit fiecare în
              perioada selectată</strong> (suma totală a bonurilor lor). Util pentru a
              vedea structura portofoliului: câți sunt clienți „mici" (montaj sezonier),
              câți „medii" și câți „valoroși" (seturi premium, servicii multiple).
            </p>
          </Show>
          <div ref={spendingDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
          <Show when={data()}>
            {(d) => (
              <div class="rapoarte-table-scroll" style="margin-top:10px">
                <table style="min-width:0">
                  <thead>
                    <tr>
                      <th style="text-align:left">Interval</th>
                      <th class="num">Clienți</th>
                      <th class="num">% clienți</th>
                      <th class="num">Total</th>
                      <th class="num">% bani</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().spending_buckets}>
                      {(b) => (
                        <tr>
                          <td class="nowrap">{b.label}</td>
                          <td class="num">{b.count_clients}</td>
                          <td class="num">{b.pct.toFixed(1)}%</td>
                          <td class="num">{fmtMoney(toNumber(b.sum_paid))}</td>
                          <td class="num bold">{b.pct_sum.toFixed(1)}%</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            )}
          </Show>
        </div>
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Frecvență vizite</div>
          <div class="locatii-chart-subtitle">Câte bonuri are fiecare client în perioadă</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Câți clienți au revenit de mai multe ori în perioadă. O proporție mare de
              clienți cu o singură vizită indică oportunitate de campanii de retenție.
            </p>
          </Show>
          <div ref={freqDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Clienți noi vs recurenți, pe lună</div>
          <div class="locatii-chart-subtitle">
            <span style="color:#3ea96a">■ Noi</span> &nbsp;
            <span style="color:#5b7cfa">■ Recurenți</span>
          </div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Pentru fiecare lună din perioadă: câți clienți au avut o singură vizită
              acea lună (verde) vs câți au revenit de 2+ ori (albastru). Bara albastră
              care crește constant = retenție bună.
            </p>
          </Show>
          <div ref={nvrBarRef} style="margin-top:8px" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Top 20 clienți după valoare</div>
          <div class="locatii-chart-subtitle">Sortat după suma plătită în perioada selectată</div>
          <Show when={data()}>
            {(d) => (
              <Show
                when={d().top_clients.length > 0}
                fallback={
                  <div style="padding:24px;text-align:center;color:var(--text-muted,#8b90a0);font-size:0.85rem">
                    Niciun client cu vânzări în perioadă.
                  </div>
                }
              >
                <div class="rapoarte-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th style="text-align:left">#</th>
                        <th style="text-align:left">Client</th>
                        <th class="hide-mobile" style="text-align:left">Telefon</th>
                        <th class="hide-mobile" style="text-align:left">Mașină</th>
                        <th class="num">Bonuri</th>
                        <th class="num">Total plătit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().top_clients}>
                        {(c, i) => (
                          <tr>
                            <td class="muted">{i() + 1}</td>
                            <td class="nowrap">{c.nume}</td>
                            <td class="hide-mobile muted nowrap">{c.telefon ?? "—"}</td>
                            <td class="hide-mobile muted nowrap">{c.numar_masina ?? "—"}</td>
                            <td class="num">{c.count_receipts}</td>
                            <td class="num bold nowrap">{fmtMoney(toNumber(c.sum_paid))}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            )}
          </Show>
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Clienți inactivi (peste 12 luni fără vizită)</div>
          <div class="locatii-chart-subtitle">Top 50, sortați descendent după valoarea istorică</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Lista clienților cu vânzări istorice dar care nu au revenit în ultimele
              12 luni. Filtrul de locație și perioadă <em>nu</em> se aplică aici (e o
              listă de cont). Țintă pentru campanii de win-back.
            </p>
          </Show>
          <Show when={data()}>
            {(d) => (
              <Show
                when={d().inactivi.length > 0}
                fallback={
                  <div style="padding:24px;text-align:center;color:var(--text-muted,#8b90a0);font-size:0.85rem">
                    Niciun client inactiv.
                  </div>
                }
              >
                <div class="rapoarte-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th style="text-align:left">Client</th>
                        <th class="hide-mobile" style="text-align:left">Telefon</th>
                        <th class="hide-mobile" style="text-align:left">Mașină</th>
                        <th style="text-align:left">Ultima vizită</th>
                        <th class="num">Bonuri</th>
                        <th class="num">Total istoric</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().inactivi}>
                        {(c) => (
                          <tr>
                            <td class="nowrap">{c.nume}</td>
                            <td class="hide-mobile muted nowrap">{c.telefon ?? "—"}</td>
                            <td class="hide-mobile muted nowrap">{c.numar_masina ?? "—"}</td>
                            <td class="nowrap">{fmtRoDate(c.last_visit)}</td>
                            <td class="num">{c.count_receipts_total}</td>
                            <td class="num bold nowrap">{fmtMoney(toNumber(c.sum_paid_total))}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

// ───── PROGRAMĂRI (Ops) PANEL ─────────────────────────────────────────────────

interface ProgramariKpi {
  total_programari: number;
  count_programat: number;
  count_in_lucru: number;
  count_executat: number;
  count_anulat: number;
  count_with_receipt: number;
  rata_anulare_pct: number;
  conversie_executat_to_bon_pct: number;
  lead_time_mediu_zile: number;
}

// ProgramariHeatmapCell type mutat in ./rapoarte/charts.ts

interface ProgramariMonthly {
  month: string;
  count_total: number;
  count_executat: number;
  count_anulat: number;
}

interface ProgramariFunnel {
  status: string;
  count: number;
  pct: number;
}

interface ProgramariPeakSlot {
  day_of_week: number;
  hour: number;
  count: number;
}

interface ProgramariSummary {
  kpi: ProgramariKpi;
  heatmap: ProgramariHeatmapCell[];
  monthly: ProgramariMonthly[];
  funnel: ProgramariFunnel[];
  peak_slots: ProgramariPeakSlot[];
  period_start: string;
  period_end: string;
}

// RO_DOW, RO_DOW_SHORT importate din ./rapoarte/constants

// drawHeatmap mutat in ./rapoarte/charts.ts

function ProgramariPanel() {
  const [data, setData] = createSignal<ProgramariSummary | null>(null);
  const [, setLoading] = createSignal(true);
  const [selectedLocIds, setSelectedLocIds] = persistedSignal<number[]>(
    "rapoarte_programari_loc_ids",
    [],
  );

  let heatmapRef: HTMLDivElement | undefined;
  let funnelDonutRef: HTMLDivElement | undefined;
  let monthlyRef: HTMLDivElement | undefined;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date_from: periodFrom(), date_to: periodTo() });
      for (const id of selectedLocIds()) qs.append("location_ids", String(id));
      const res = await reportsApiFetch(`/api/reports/programari?${qs.toString()}`);
      if (!res.ok) {
        notify(`Eroare ${res.status} la încărcarea raportului.`, "error");
        return;
      }
      setData(await res.json());
    } catch {
      notify("Eroare de conexiune.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(ensureLocationsLoaded);
  createEffect(() => {
    periodVersion();
    selectedLocIds();
    void load();
  });

  createEffect(() => {
    const d = data();
    if (!d || !heatmapRef) return;
    drawHeatmap(heatmapRef, d.heatmap);
  });

  createEffect(() => {
    const d = data();
    if (!d || !funnelDonutRef) return;
    const colors: Record<string, string> = {
      "Programat": "#5b7cfa",
      "In lucru":  "#f5a623",
      "Executat":  "#3ea96a",
      "Anulat":    "#ef4444",
    };
    const items: DonutItem[] = d.funnel.map((f) => ({
      label: f.status,
      value: f.count,
      color: colors[f.status] ?? "#8b90a0",
    }));
    drawDonut(funnelDonutRef, items, "programări");
  });

  createEffect(() => {
    const d = data();
    if (!d || !monthlyRef) return;
    const items: MonthlySeriesItem[] = d.monthly.map((m) => ({
      month: m.month,
      series: [
        { key: "total", label: "Total",    value: m.count_total,    color: "#5b7cfa" },
        { key: "exec",  label: "Executat", value: m.count_executat, color: "#3ea96a" },
        { key: "anul",  label: "Anulat",   value: m.count_anulat,   color: "#ef4444" },
      ],
    }));
    drawMonthlySeriesBars(monthlyRef, items);
  });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <PanelHeader title="Programări" />
      <Show when={!hideExplanations()}>
        <p class="cfg-hint" style="margin-bottom:14px;max-width:780px;line-height:1.6">
          Analiza operațională a programărilor: când sunt sloturile peak (heatmap zi×oră),
          ce procent se anulează, ce procent ajung la bon emis (conversia operațională)
          și care e lead-time-ul mediu între programare și execuție. Datele sunt poziționate
          pe data programării (start_time), nu pe data creării.
        </p>
      </Show>

      <PeriodSlicer />
      <LocationFilter selected={selectedLocIds} setSelected={setSelectedLocIds} />

      <Show when={data()}>
        {(d) => (
          <div class="rapoarte-kpi-grid">
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Total programări</span>
              <span class="locatii-kpi__value">{d().kpi.total_programari}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Executate</span>
              <span class="locatii-kpi__value">{d().kpi.count_executat}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Anulate</span>
              <span class="locatii-kpi__value">{d().kpi.count_anulat}</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Rata anulare</span>
              <span class="locatii-kpi__value">{d().kpi.rata_anulare_pct.toFixed(1)}%</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Lead time mediu</span>
              <span class="locatii-kpi__value">{d().kpi.lead_time_mediu_zile.toFixed(1)} zile</span>
            </div>
            <div class="locatii-kpi">
              <span class="locatii-kpi__label">Conversie la bon</span>
              <span class="locatii-kpi__value">{d().kpi.conversie_executat_to_bon_pct.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </Show>

      <div class="locatii-charts">
        <div class="locatii-chart-card" style="flex:2;min-width:0">
          <div class="locatii-chart-title">Heatmap programări — zi × oră</div>
          <div class="locatii-chart-subtitle">Albastru mai intens = mai multe programări</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Grila arată câte programări sunt în fiecare combinație zi a săptămânii × oră
              de start. Util pentru a vedea sloturile peak (overbooking) și sloturile goale
              (oportunități de promoție).
            </p>
          </Show>
          <div ref={heatmapRef} style="margin-top:8px" />
        </div>
        <div class="locatii-chart-card" style="flex:1;min-width:260px">
          <div class="locatii-chart-title">Distribuție pe status</div>
          <div class="locatii-chart-subtitle">Funnel-ul programărilor</div>
          <Show when={!hideExplanations()}>
            <p class="chart-explanation">
              Cum se distribuie programările pe status: programat (în viitor), în lucru,
              executat sau anulat. Util pentru a vedea sănătatea operațională.
            </p>
          </Show>
          <div ref={funnelDonutRef} style="margin-top:8px;display:flex;flex-direction:column;align-items:center" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Evoluție lunară</div>
          <div class="locatii-chart-subtitle">
            <span style="color:#5b7cfa">■ Total</span> &nbsp;
            <span style="color:#3ea96a">■ Executat</span> &nbsp;
            <span style="color:#ef4444">■ Anulat</span>
          </div>
          <div ref={monthlyRef} style="margin-top:8px" />
        </div>
      </div>

      <div class="locatii-charts" style="margin-top:14px">
        <div class="locatii-chart-card" style="flex:1;min-width:0">
          <div class="locatii-chart-title">Top 5 sloturi peak</div>
          <div class="locatii-chart-subtitle">Cele mai aglomerate combinații zi × oră</div>
          <Show when={data()}>
            {(d) => (
              <Show
                when={d().peak_slots.length > 0}
                fallback={
                  <div style="padding:24px;text-align:center;color:var(--text-muted,#8b90a0);font-size:0.85rem">
                    Niciun slot cu programări.
                  </div>
                }
              >
                <div class="rapoarte-table-scroll">
                  <table style="min-width:0">
                    <thead>
                      <tr>
                        <th style="text-align:left">#</th>
                        <th style="text-align:left">Zi</th>
                        <th style="text-align:left">Oră</th>
                        <th class="num">Programări</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().peak_slots}>
                        {(s, i) => (
                          <tr>
                            <td class="muted">{i() + 1}</td>
                            <td class="nowrap">{RO_DOW[s.day_of_week]}</td>
                            <td class="nowrap">{s.hour}:00</td>
                            <td class="num bold">{s.count}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

// ───── ROOT ───────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Concedii Report Panel — heatmap zi × săptămână + TanStack table per lună
// ────────────────────────────────────────────────────────────────────────────
function ConcediiReportPanel() {
  const RO_MONTHS = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
  const RO_MONTHS_SHORT = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];
  const RO_DAYS   = ["L","M","M","J","V","S","D"];

  const today = new Date();
  const [y, setY] = createSignal(today.getFullYear());
  const [m, setM] = createSignal(today.getMonth());
  const [rows, setRows] = createSignal<RawConcedii[]>([]);
  const [holidays, setHolidays] = createSignal<Set<string>>(new Set());
  const [filter, setFilter] = createSignal("");
  const [sorting, setSorting] = createSignal<TanstackSorting>([{ id: "start_date", desc: false }]);

  const [isMobile, setIsMobile] = createSignal(typeof window !== "undefined" && window.innerWidth < 768);
  function onResize() { setIsMobile(window.innerWidth < 768); }
  onMount(() => window.addEventListener("resize", onResize));
  onCleanup(() => window.removeEventListener("resize", onResize));

  function prev() { if (m() === 0) { setY((v) => v - 1); setM(11); } else setM((v) => v - 1); }
  function next() { if (m() === 11) { setY((v) => v + 1); setM(0); } else setM((v) => v + 1); }
  function goToday() { setY(today.getFullYear()); setM(today.getMonth()); }

  function pad2(n: number): string { return String(n).padStart(2, "0"); }
  function ymd(yy: number, mm: number, dd: number): string { return `${yy}-${pad2(mm+1)}-${pad2(dd)}`; }

  async function reload() {
    const yy = y(), mm = m();
    const last = new Date(yy, mm + 1, 0).getDate();
    const mStart = ymd(yy, mm, 1);
    const mEnd = ymd(yy, mm, last);
    try {
      const res = await apiFetch(`/api/leaves?date_from=${mStart}&date_to=${mEnd}`);
      if (!res.ok) { setRows([]); return; }
      setRows(await res.json());
    } catch { setRows([]); }
    try {
      const hres = await apiFetch(`/api/leaves/holidays?year=${yy}`);
      if (hres.ok) {
        const hs = (await hres.json()) as { date: string; name: string }[];
        setHolidays(new Set(hs.map((h) => h.date)));
      }
    } catch { /* ignore */ }
  }

  createEffect(() => { y(); m(); void reload(); });

  // Heatmap data — count concedii per day (any type, non-deleted, non-rejected)
  const dayCounts = createMemo<Map<string, RawConcedii[]>>(() => {
    const map = new Map<string, RawConcedii[]>();
    const yy = y(), mm = m();
    const last = new Date(yy, mm + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const key = ymd(yy, mm, d);
      const list: RawConcedii[] = [];
      for (const r of rows()) {
        if (r.is_deleted) continue;
        if (r.status === "Rejected") continue;
        if (key >= r.start_date && key <= r.end_date) list.push(r);
      }
      map.set(key, list);
    }
    return map;
  });

  const maxCount = createMemo(() => {
    let max = 0;
    for (const list of dayCounts().values()) if (list.length > max) max = list.length;
    return max;
  });

  function intensity(n: number): string {
    if (n === 0) return "rgba(255,255,255,0.04)";
    // d3.interpolateBlues
    const t = maxCount() === 0 ? 0 : n / maxCount();
    const c = d3.interpolateBlues(0.2 + 0.7 * t);
    return c;
  }
  function textColor(n: number): string {
    if (n === 0) return "var(--text-muted,#8b90a0)";
    const t = maxCount() === 0 ? 0 : n / maxCount();
    return t > 0.55 ? "#fff" : "var(--text,#dbe0ea)";
  }

  // Build calendar grid (7 cols × N rows)
  const grid = createMemo(() => {
    const yy = y(), mm = m();
    const firstDow = (new Date(yy, mm, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(yy, mm + 1, 0).getDate();
    const cells: Array<{ day: number | null; date: string | null; count: number; isHoliday: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, date: null, count: 0, isHoliday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const k = ymd(yy, mm, d);
      const cnt = (dayCounts().get(k) ?? []).length;
      cells.push({ day: d, date: k, count: cnt, isHoliday: holidays().has(k) });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, date: null, count: 0, isHoliday: false });
    return cells;
  });

  // ── TanStack table ────────────────────────────────────────────────────────
  const columns: TanstackColumnDef<RawConcedii>[] = [
    {
      accessorKey: "employee_name",
      header: "Angajat",
      cell: (info) => {
        const r = info.row.original;
        return (
          <div style="display:flex;align-items:center;gap:8px">
            <Avatar name={r.employee_name ?? "?"} imagePath={r.employee_image_path ?? null} size={28} />
            <span>{r.employee_name ?? "?"}</span>
          </div>
        );
      },
    },
    { accessorKey: "location_name", header: "Locație", cell: (i) => i.row.original.location_name ?? "—" },
    {
      accessorKey: "type", header: "Tip",
      cell: (i) => {
        const t = i.row.original.type;
        const map: Record<string, string> = {
          "Concediu de odihna": "🏖 Odihnă",
          "Concediu medical": "🤒 Medical",
          "Business Trip": "✈️ Business",
          "Concediu fara plata": "📝 Învoire",
        };
        return map[t] ?? t;
      },
    },
    {
      accessorKey: "status", header: "Status",
      cell: (i) => {
        const s = i.row.original.status;
        const color = s === "Approved" ? "#d4edda;color:#155724" : s === "Pending" ? "#fff3cd;color:#856404" : "#f8d7da;color:#721c24";
        const txt = s === "Approved" ? "Aprobată" : s === "Pending" ? "În așteptare" : "Respinsă";
        return <span style={`display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:${color}`}>{txt}</span>;
      },
    },
    { accessorKey: "start_date", header: "De la", cell: (i) => fmtRoDate(i.row.original.start_date) },
    { accessorKey: "end_date", header: "Până la", cell: (i) => fmtRoDate(i.row.original.end_date) },
    { accessorKey: "working_days", header: "Zile lucr.", cell: (i) => i.row.original.working_days },
    { accessorKey: "approver_name", header: "Aprobat de", cell: (i) => i.row.original.approver_name ?? "—" },
    { accessorKey: "notes", header: "Motiv", cell: (i) => i.row.original.notes ?? "—" },
  ];

  const filteredRows = createMemo<RawConcedii[]>(() => rows().filter((r) => !r.is_deleted));

  const table = tanstackCreate({
    get data() { return filteredRows(); },
    columns,
    state: {
      get sorting() { return sorting(); },
      get globalFilter() { return filter(); },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _id, value) => {
      const q = String(value ?? "").toLowerCase();
      if (!q) return true;
      const r = row.original;
      return (
        (r.employee_name ?? "").toLowerCase().includes(q) ||
        (r.location_name ?? "").toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q)
      );
    },
    getCoreRowModel: tanstackCoreRowModel(),
    getSortedRowModel: tanstackSortedRowModel(),
    getFilteredRowModel: tanstackFilteredRowModel(),
  });

  // Stats
  const stats = createMemo(() => {
    const all = filteredRows();
    const totalDays = all.reduce((s, r) => s + (r.working_days ?? 0), 0);
    const pending = all.filter((r) => r.status === "Pending").length;
    const approved = all.filter((r) => r.status === "Approved").length;
    return { total: all.length, totalDays, pending, approved };
  });

  // Export helpers — folosesc tabelul filtrat & sortat curent
  const TYPE_LABELS: Record<string, string> = {
    "Concediu de odihna": "Concediu de odihnă",
    "Concediu medical":   "Concediu medical",
    "Business Trip":      "Business Trip",
    "Concediu fara plata": "Învoire",
  };
  const STATUS_LABELS: Record<string, string> = { Approved: "Aprobată", Pending: "În așteptare", Rejected: "Respinsă" };

  function exportRows(): string[][] {
    return table.getRowModel().rows.map((r) => {
      const x = r.original;
      return [
        x.employee_name ?? "—",
        x.location_name ?? "—",
        TYPE_LABELS[x.type] ?? x.type,
        STATUS_LABELS[x.status] ?? x.status,
        fmtRoDate(x.start_date),
        fmtRoDate(x.end_date),
        String(x.working_days ?? 0),
        x.approver_name ?? "—",
        x.notes ?? "",
      ];
    });
  }
  const EXPORT_HEADERS = ["Angajat", "Locație", "Tip", "Status", "De la", "Până la", "Zile lucr.", "Aprobat de", "Motiv"];
  function exportTitle() { return `Concedii ${RO_MONTHS[m()]} ${y()}`; }
  function doExportCSV() { sharedExportCSV(exportTitle(), EXPORT_HEADERS, exportRows()); }
  function doExportPDF() { sharedExportPDF(exportTitle(), EXPORT_HEADERS, exportRows()); }

  return (
    <div class="cfg-panel concedii-report">
      <PanelHeader title="Concedii" />

      <div class="concedii-report-toolbar">
        <div class="concedii-report-monthnav">
          <button type="button" class="btn btn-ghost btn-sm" onClick={prev} aria-label="Luna anterioara">‹</button>
          <button type="button" class="btn btn-ghost btn-sm" onClick={goToday}>Azi</button>
          <h3 class="concedii-report-monthtitle">
            {isMobile() ? RO_MONTHS_SHORT[m()] : RO_MONTHS[m()]} {y()}
          </h3>
          <button type="button" class="btn btn-ghost btn-sm" onClick={next} aria-label="Luna urmatoare">›</button>
        </div>
        <div class="concedii-report-toolbar-actions">
          <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
          <button type="button" class="btn btn-ghost btn-sm" onClick={reload} title="Refresh">↻</button>
        </div>
      </div>

      <div class="concedii-report-stats">
        <div class="locatii-chart-card concedii-report-stat"><div class="concedii-report-stat-label">Cereri totale</div><div class="concedii-report-stat-value">{stats().total}</div></div>
        <div class="locatii-chart-card concedii-report-stat"><div class="concedii-report-stat-label">Aprobate</div><div class="concedii-report-stat-value" style="color:#198754">{stats().approved}</div></div>
        <div class="locatii-chart-card concedii-report-stat"><div class="concedii-report-stat-label">În așteptare</div><div class="concedii-report-stat-value" style="color:#f59e0b">{stats().pending}</div></div>
        <div class="locatii-chart-card concedii-report-stat"><div class="concedii-report-stat-label">Total zile lucr.</div><div class="concedii-report-stat-value">{stats().totalDays}</div></div>
      </div>

      <div class="locatii-chart-card concedii-report-section">
        <div class="locatii-chart-title">Heatmap concedii — zi a lunii</div>
        <div class="locatii-chart-subtitle">Albastru mai intens = mai mulți angajați în concediu</div>
        <p class="chart-explanation">
          Câți angajați sunt în concediu (aprobat sau pending) în fiecare zi. Util pentru a vedea perioadele aglomerate.
        </p>
        <div class="concedii-report-heatmap">
          <div class="concedii-report-dow">
            <For each={RO_DAYS}>{(d) => <span>{d}</span>}</For>
          </div>
          <div class="concedii-report-grid">
            <For each={grid()}>
              {(c) => {
                if (c.day == null) return <span />;
                const list = c.date ? (dayCounts().get(c.date) ?? []) : [];
                const title = list.length === 0
                  ? `Ziua ${c.day} — niciun angajat in concediu`
                  : `Ziua ${c.day} — ${list.length} angajat(i):\n` + list.map((l) => `• ${l.employee_name} (${l.type})`).join("\n");
                return (
                  <div
                    class="concedii-report-cell"
                    classList={{ "is-holiday": c.isHoliday }}
                    style={`background:${intensity(c.count)};color:${textColor(c.count)}`}
                    title={title}
                  >
                    <div class="concedii-report-cell-day">{c.day}</div>
                    <Show when={c.count > 0}>
                      <div class="concedii-report-cell-count">{c.count}</div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      <div class="locatii-chart-card concedii-report-section">
        <div class="locatii-chart-title">Toate cererile din {RO_MONTHS[m()]} {y()}</div>
        <div class="concedii-report-search">
          <input
            class="input"
            placeholder="🔍 Caută angajat, locație, tip, motiv..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <span class="concedii-report-count">{table.getRowModel().rows.length} / {filteredRows().length}</span>
        </div>

        <Show when={table.getRowModel().rows.length === 0}>
          <div style="padding:16px;color:var(--text-muted);text-align:center">Nicio cerere pentru această lună.</div>
        </Show>

        <Show when={isMobile() && table.getRowModel().rows.length > 0}>
          <div class="concedii-report-cards">
            <For each={table.getRowModel().rows}>
              {(row) => {
                const r = row.original;
                const t = TYPE_LABELS[r.type] ?? r.type;
                const s = STATUS_LABELS[r.status] ?? r.status;
                const statusColor = r.status === "Approved" ? "#198754" : r.status === "Pending" ? "#f59e0b" : "#dc3545";
                return (
                  <div class="concedii-report-card" style={`border-left:4px solid ${statusColor}`}>
                    <div class="concedii-report-card-head">
                      <Avatar name={r.employee_name ?? "?"} imagePath={r.employee_image_path ?? null} size={32} />
                      <div style="flex:1;min-width:0">
                        <div style="font-weight:600">{r.employee_name ?? "?"}</div>
                        <div style="color:var(--text-muted);font-size:12px">{r.location_name ?? "—"}</div>
                      </div>
                      <span style={`font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${statusColor}22;color:${statusColor}`}>{s}</span>
                    </div>
                    <div class="concedii-report-card-row"><span>Tip</span><strong>{t}</strong></div>
                    <div class="concedii-report-card-row"><span>Perioadă</span><strong>{fmtRoDate(r.start_date)} → {fmtRoDate(r.end_date)}</strong></div>
                    <div class="concedii-report-card-row"><span>Zile lucr.</span><strong>{r.working_days}</strong></div>
                    <Show when={r.approver_name}>
                      <div class="concedii-report-card-row"><span>Aprobat de</span><strong>{r.approver_name}</strong></div>
                    </Show>
                    <Show when={r.notes}>
                      <div class="concedii-report-card-notes">{r.notes}</div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={!isMobile() && table.getRowModel().rows.length > 0}>
          <div class="concedii-report-tablewrap">
            <table class="concedii-report-table">
              <thead>
                <For each={table.getHeaderGroups()}>
                  {(hg) => (
                    <tr>
                      <For each={hg.headers}>
                        {(h) => {
                          const sort = h.column.getIsSorted();
                          const canSort = h.column.getCanSort();
                          return (
                            <th
                              classList={{ "is-sortable": canSort }}
                              onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                            >
                              <span style="display:inline-flex;align-items:center;gap:4px">
                                {tanstackFlexRender(h.column.columnDef.header, h.getContext())}
                                <Show when={sort === "asc"}><span style="font-size:11px">▲</span></Show>
                                <Show when={sort === "desc"}><span style="font-size:11px">▼</span></Show>
                              </span>
                            </th>
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </thead>
              <tbody>
                <For each={table.getRowModel().rows}>
                  {(row) => (
                    <tr>
                      <For each={row.getVisibleCells()}>
                        {(cell) => <td>{tanstackFlexRender(cell.column.columnDef.cell, cell.getContext())}</td>}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );
}

interface RawConcedii {
  id: number;
  employee_id: number;
  employee_name: string | null;
  employee_image_path: string | null;
  location_id: number | null;
  location_name: string | null;
  type: string;
  status: "Pending" | "Approved" | "Rejected";
  start_date: string;
  end_date: string;
  working_days: number;
  notes: string | null;
  approver_name: string | null;
  is_deleted: boolean;
}

export default function Rapoarte() {
  const [active, setActive] = persistedSignal<SectionId>("rapoarte_active_section", "target-angajati");

  // Filtrare secțiuni vizibile: ascunde „Hotel Anvelope" când feature-ul e
  // dezactivat din Setări Generale. Dacă utilizatorul avea secțiunea activă
  // salvată în localStorage și acum e ascunsă, comutăm pe prima disponibilă.
  const visibleSections = createMemo(() =>
    SECTIONS.filter((s) =>
      !(s.id === "hotel-anvelope" && generalSettings()?.dezactiveazaHotelAnvelope),
    ),
  );
  createEffect(() => {
    const vis = visibleSections();
    if (!vis.some((s) => s.id === active())) {
      setActive(vis[0].id);
    }
  });

  const isHotelHidden = () => !!generalSettings()?.dezactiveazaHotelAnvelope;

  return (
    <ReportsGate>
      <div class="cfg-layout">
        <aside class="cfg-sidebar">
          <div class="cfg-sidebar-title">Rapoarte</div>
          <For each={visibleSections()}>
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
            <Match when={active() === "comparare-yoy"}><CompareYoYPanel /></Match>
            <Match when={active() === "produse-servicii"}><ProduseServiciiPanel /></Match>
            <Match when={active() === "angajati"}><AngajatiPanel /></Match>
            <Match when={active() === "hotel-anvelope" && !isHotelHidden()}><HotelAnvelopePanel /></Match>
            <Match when={active() === "clienti"}><ClientiPanel /></Match>
            <Match when={active() === "programari"}><ProgramariPanel /></Match>
            <Match when={active() === "concedii"}><ConcediiReportPanel /></Match>
            <Match when={active() === "stocuri"}><StocuriSection /></Match>
          </Switch>
        </main>
      </div>
    </ReportsGate>
  );
}
