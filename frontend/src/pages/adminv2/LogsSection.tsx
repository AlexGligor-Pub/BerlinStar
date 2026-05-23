import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";

interface TaskLog {
  id: number;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  duration_ms: number | null;
  items_processed: number | null;
  items_failed: number | null;
  error_message: string | null;
  triggered_by: string;
}

interface JobInfoMin {
  job_id: string;
  label: string;
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function statusInfo(s: TaskLog["status"]) {
  if (s === "success") return { text: "Succes", color: "var(--success)", icon: "✓" };
  if (s === "error") return { text: "Eroare", color: "var(--danger)", icon: "✕" };
  return { text: "Ruleaza", color: "var(--accent)", icon: "⟳" };
}

const PAGE_SIZE = 50;

export default function LogsSection() {
  const [logs, setLogs] = createSignal<TaskLog[]>([]);
  const [total, setTotal] = createSignal(0);
  const [offset, setOffset] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [jobFilter, setJobFilter] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [jobsList, setJobsList] = createSignal<JobInfoMin[]>([]);
  const [expanded, setExpanded] = createSignal<number | null>(null);
  const [clearing, setClearing] = createSignal(false);

  async function loadJobsList() {
    const res = await adminFetch("/api/admin/efactura/jobs");
    if (res.ok) {
      const data: { job_id: string; label: string }[] = await res.json();
      setJobsList(data.map((j) => ({ job_id: j.job_id, label: j.label })));
    }
  }

  async function loadLogs(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(reset ? 0 : offset()),
      });
      if (jobFilter()) params.set("job_id", jobFilter());
      if (statusFilter()) params.set("status", statusFilter());
      const res = await adminFetch(`/api/admin/efactura/task-logs?${params}`);
      if (!res.ok) return;
      const data: { items: TaskLog[]; total: number; offset: number } = await res.json();
      setLogs(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } finally {
      setLoading(false);
    }
  }

  let intervalHandle: number | undefined;
  onMount(() => {
    loadJobsList();
    loadLogs();
    intervalHandle = window.setInterval(() => loadLogs(false), 30_000);
  });
  onCleanup(() => {
    if (intervalHandle !== undefined) window.clearInterval(intervalHandle);
  });

  function applyFilters() {
    setOffset(0);
    loadLogs(true);
  }

  function nextPage() {
    setOffset((o) => o + PAGE_SIZE);
    loadLogs(false);
  }

  function prevPage() {
    setOffset((o) => Math.max(0, o - PAGE_SIZE));
    loadLogs(false);
  }

  async function doClearAll() {
    if (!confirm("Stergi TOATE logurile? Aceasta operatie nu poate fi revocata.")) return;
    setClearing(true);
    try {
      const res = await adminFetch("/api/admin/efactura/task-logs", { method: "DELETE" });
      if (res.ok) {
        setOffset(0);
        await loadLogs(true);
      }
    } finally {
      setClearing(false);
    }
  }

  function jobLabel(job_id: string): string {
    return jobsList().find((j) => j.job_id === job_id)?.label ?? job_id;
  }

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Logs rulari taskuri</h2>
        <div class="reception-header-right">
          <span class="reception-count">{total()} total</span>
          <button class="btn btn-sm btn-ghost" onClick={() => loadLogs(true)} disabled={loading()}>
            {loading() ? "..." : "↻ Refresh"}
          </button>
          <button class="btn btn-sm btn-danger" onClick={doClearAll} disabled={clearing() || total() === 0}>
            {clearing() ? "..." : "🗑 Sterge tot"}
          </button>
        </div>
      </div>

      <div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <div style="display:flex;flex-direction:column;gap:4px;min-width:200px">
          <label class="admin-form-label">Job</label>
          <select
            class="input"
            value={jobFilter()}
            onChange={(e) => { setJobFilter(e.currentTarget.value); applyFilters(); }}
          >
            <option value="">Toate</option>
            <For each={jobsList()}>
              {(j) => <option value={j.job_id}>{j.label}</option>}
            </For>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:140px">
          <label class="admin-form-label">Status</label>
          <select
            class="input"
            value={statusFilter()}
            onChange={(e) => { setStatusFilter(e.currentTarget.value); applyFilters(); }}
          >
            <option value="">Toate</option>
            <option value="success">Succes</option>
            <option value="error">Eroare</option>
            <option value="running">Ruleaza</option>
          </select>
        </div>
        <Show when={jobFilter() || statusFilter()}>
          <button
            class="btn btn-sm btn-ghost"
            onClick={() => { setJobFilter(""); setStatusFilter(""); applyFilters(); }}
          >
            Curata filtre
          </button>
        </Show>
        <span class="text-muted" style="font-size:11px;margin-left:auto">
          Auto-refresh la 30s · retenție 90 zile
        </span>
      </div>

      <Show when={logs().length === 0 && !loading()}>
        <div class="card" style="text-align:center;padding:48px 16px">
          <div class="text-muted">Nicio rulare inregistrata.</div>
        </div>
      </Show>

      <Show when={logs().length > 0}>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--surface-2);position:sticky;top:0;z-index:1">
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Pornit</th>
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Job</th>
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Status</th>
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Durata</th>
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Items</th>
                <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border)">Trigger</th>
              </tr>
            </thead>
            <tbody>
              <For each={logs()}>
                {(l) => {
                  const s = statusInfo(l.status);
                  const isOpen = () => expanded() === l.id;
                  return (
                    <>
                      <tr
                        style={`border-bottom:1px solid var(--border);cursor:${l.error_message ? "pointer" : "default"}`}
                        onClick={() => {
                          if (l.error_message) {
                            setExpanded(isOpen() ? null : l.id);
                          }
                        }}
                      >
                        <td style="padding:8px 10px;font-size:12px">{fmtDate(l.started_at)}</td>
                        <td style="padding:8px 10px">
                          <div style="display:flex;flex-direction:column;gap:1px">
                            <span style="font-weight:600">{jobLabel(l.job_id)}</span>
                            <span class="text-muted" style="font-size:11px;font-family:monospace">{l.job_id}</span>
                          </div>
                        </td>
                        <td style="padding:8px 10px">
                          <span style={`color:${s.color};font-weight:600`}>
                            {s.icon} {s.text}
                          </span>
                          <Show when={l.error_message}>
                            <span class="text-muted" style="font-size:11px;margin-left:6px">
                              {isOpen() ? "▼" : "▶"} detalii
                            </span>
                          </Show>
                        </td>
                        <td style="padding:8px 10px;font-size:12px;font-variant-numeric:tabular-nums">
                          {fmtDuration(l.duration_ms)}
                        </td>
                        <td style="padding:8px 10px;font-size:12px">
                          <Show when={l.items_processed !== null || l.items_failed !== null} fallback={<span class="text-muted">—</span>}>
                            <span>{l.items_processed ?? 0} ok</span>
                            <Show when={(l.items_failed ?? 0) > 0}>
                              <span style="color:var(--danger);margin-left:6px">/ {l.items_failed} fail</span>
                            </Show>
                          </Show>
                        </td>
                        <td style="padding:8px 10px;font-size:12px">
                          <span
                            style={`padding:2px 6px;border-radius:3px;font-size:11px;background:var(--surface-2);${l.triggered_by === "manual" ? "color:var(--accent)" : ""}`}
                          >
                            {l.triggered_by}
                          </span>
                        </td>
                      </tr>
                      <Show when={isOpen() && l.error_message}>
                        <tr>
                          <td colspan={6} style="padding:0;background:color-mix(in srgb, var(--danger) 5%, transparent)">
                            <pre style="margin:0;padding:12px 16px;font-size:11px;font-family:monospace;white-space:pre-wrap;color:var(--danger);max-height:300px;overflow:auto">{l.error_message}</pre>
                          </td>
                        </tr>
                      </Show>
                    </>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;gap:8px">
          <span class="text-muted" style="font-size:12px">
            {offset() + 1} – {Math.min(offset() + logs().length, total())} din {total()}
          </span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-ghost" disabled={offset() === 0 || loading()} onClick={prevPage}>← Anterior</button>
            <button class="btn btn-sm btn-ghost" disabled={offset() + logs().length >= total() || loading()} onClick={nextPage}>Urmator →</button>
          </div>
        </div>
      </Show>
    </div>
  );
}
