import { For, Show, Switch, Match, createSignal, onMount, createMemo } from "solid-js";
import { apiFetch } from "../utils/api";

interface EmployeeReport {
  id: number;
  name: string;
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

function TargetAngajatiPanel() {
  const [employees, setEmployees] = createSignal<EmployeeReport[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [sortBy, setSortBy] = createSignal<"target" | "name">("target");

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

  const sorted = createMemo(() => {
    const list = [...employees()];
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

  const fmt = (v: string) =>
    parseFloat(v).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div class="cfg-panel" style="max-width:100%">
      <h2 class="cfg-panel-title">Target Angajați</h2>
      <p class="cfg-hint" style="margin-bottom:8px;max-width:620px;line-height:1.6">
        Graficul afișează acumularea curentă a targetului pentru fiecare angajat. Bara colorată
        reprezintă valoarea vânzărilor înregistrate de angajat în perioada curentă. Linia verticală
        indică targetul lunar setat. Targetul fiecărui angajat se configurează din{" "}
        <strong>Configurări → Angajați</strong>.
      </p>

      {/* Sort controls */}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
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
      </div>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>

      <Show when={!loading() && sorted().length === 0}>
        <p class="cfg-hint">Nu există angajați înregistrați.</p>
      </Show>

      <Show when={!loading() && sorted().length > 0}>
        {/* Legend */}
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted)">
            <div style="width:14px;height:14px;border-radius:3px;background:var(--accent,#5b7cfa)" />
            Acumulare curentă
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-muted)">
            <div style="width:2px;height:14px;background:var(--text-muted);opacity:0.7" />
            Target lunar
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
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

              return (
                <div class="target-row">
                  <div class="target-row__name">
                    <Avatar name={e.name} imagePath={e.image_path} size={28} />
                    <span title={e.name}>{e.name}</span>
                  </div>
                  <div class="target-row__bar">
                    <div style={`height:100%;width:${accPct}%;background:${barColor};border-radius:5px;transition:width 0.5s ease`} />
                    <Show when={tgtPct > 0}>
                      <div
                        style={`position:absolute;left:${tgtPct}%;top:-4px;bottom:-4px;width:2px;background:var(--text-muted);opacity:0.6;z-index:2;border-radius:1px`}
                        title={`Target: ${fmt(e.target)} lei`}
                      />
                    </Show>
                  </div>
                  <div class="target-row__value">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--text)">
                      {fmt(e.current_target_accumulation)} lei
                    </span>
                    <Show when={tgt > 0}>
                      <span style="font-size:0.75rem;color:var(--text-muted)">
                        din {fmt(e.target)} lei ({Math.round(progressPct)}%)
                      </span>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
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
