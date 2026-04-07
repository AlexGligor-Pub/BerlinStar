import { For, Show, Switch, Match, createSignal, onMount, createMemo, onCleanup } from "solid-js";
import { apiFetch } from "../utils/api";

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
    try {
      const res = await apiFetch("/api/employees?limit=200");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items ?? []);
      }
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
      <h2 class="cfg-panel-title">Target Angajați</h2>
      <p class="cfg-hint" style="margin-bottom:8px;max-width:620px;line-height:1.6">
        Graficul afișează acumularea curentă a targetului pentru fiecare angajat. Bara colorată
        reprezintă valoarea vânzărilor înregistrate în perioada curentă. Linia orizontală indică
        targetul lunar setat. Apasă pe o bară pentru detalii. Targetul se configurează din{" "}
        <strong>Configurări → Angajați</strong>.
      </p>

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
        </Switch>
      </main>
    </div>
  );
}
