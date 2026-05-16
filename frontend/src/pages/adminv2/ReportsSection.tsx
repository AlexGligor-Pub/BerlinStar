import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { ApiMessageBody } from "../../types";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";

interface ReportStatus {
  report_type: string;
  status: string;
  last_run_at: string | null;
  last_period_start: string | null;
  last_period_end: string | null;
  last_triggered_at: string | null;
  last_error: string | null;
  last_duration_ms: number | null;
  cooldown_remaining_s: number;
}

const REPORT_LABELS: Record<string, { title: string; description: string }> = {
  receipts_daily: {
    title: "Raport zilnic — Receipts",
    description: "Agregare zilnică: count + sum per locație, pay_method, item_type, categorii și departamente. Include și receipts neplătite.",
  },
  employee_daily: {
    title: "Raport zilnic — Per angajat",
    description: "Doar receipts plătite (pay_method ≠ Neplatit). Grupat pe employee × item_type × categorie × departament.",
  },
};

function fmtCooldown(s: number): string {
  if (s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}


export default function ReportsSection() {
  const [reports, setReports] = createSignal<ReportStatus[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [triggering, setTriggering] = createSignal<Record<string, boolean>>({});
  const [errMsg, setErrMsg] = createSignal<string>("");

  async function loadReports() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/reports");
      if (!res.ok) {
        setErrMsg(`Eroare ${res.status} la încărcarea rapoartelor.`);
        return;
      }
      const data = (await res.json()) as ReportStatus[];
      setReports(data);
      setErrMsg("");
    } catch (e) {
      setErrMsg("Eroare de conexiune.");
    } finally {
      setLoading(false);
    }
  }

  async function doTrigger(reportType: string, mode: "incremental" | "weekly_refresh" = "incremental") {
    setTriggering((m) => ({ ...m, [reportType]: true }));
    try {
      const res = await adminFetch(`/api/admin/reports/${reportType}/trigger?mode=${mode}`, {
        method: "POST",
      });
      if (res.status === 429) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        notify(`${REPORT_LABELS[reportType]?.title ?? reportType}: ${d.detail ?? "Cooldown activ."}`, "warn");
        await loadReports();
        return;
      }
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        notify(`Eroare ${res.status}: ${d.detail ?? "Trigger eșuat."}`, "error");
        return;
      }
      notify(`${REPORT_LABELS[reportType]?.title ?? reportType}: rulare pornită.`, "success");
      await loadReports();
    } catch {
      notify("Eroare de conexiune la trigger.", "error");
    } finally {
      setTriggering((m) => ({ ...m, [reportType]: false }));
    }
  }

  onMount(() => {
    void loadReports();
  });
  const interval = setInterval(() => { void loadReports(); }, 10000);
  onCleanup(() => clearInterval(interval));

  return (
    <div class="adminv2-section">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <h1 class="page-title">Rapoarte globale</h1>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">
            Worker zilnic la 02:00 (Europe/Bucharest) + refresh duminică la 04:00. Trigger manual cu cooldown 5min.
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onClick={loadReports} disabled={loading()}>
          {loading() ? "Se reîncarcă..." : "↻ Reîncarcă"}
        </button>
      </div>

      <Show when={errMsg()}>
        <div class="login-error" style="margin:12px 0">{errMsg()}</div>
      </Show>

      <div class="account-card-grid" style="margin-top:16px">
        <For each={reports()}>
          {(r) => {
            const label = REPORT_LABELS[r.report_type] ?? { title: r.report_type, description: "" };
            const busy = () => triggering()[r.report_type] === true;
            const onCooldown = () => r.cooldown_remaining_s > 0;
            const isRunning = () => r.status === "running";
            const isFailed = () => r.status === "failed";
            return (
              <div class="account-card">
                <div class="account-card__body">
                  <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
                    <div class="account-card__name">{label.title}</div>
                    <span
                      style={`font-size:0.75rem;padding:2px 8px;border-radius:10px;font-weight:600;background:${
                        isRunning() ? "#3b82f6" : isFailed() ? "#ef4444" : "#22c55e"
                      };color:#fff`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">{label.description}</div>
                  <div class="account-card__meta" style="margin-top:8px">
                    <div><strong>Ultima rulare:</strong> {fmtDate(r.last_run_at)}</div>
                    <Show when={r.last_period_start && r.last_period_end}>
                      <div><strong>Perioadă:</strong> {r.last_period_start} → {r.last_period_end}</div>
                    </Show>
                    <Show when={r.last_duration_ms !== null}>
                      <div><strong>Durată:</strong> {r.last_duration_ms} ms</div>
                    </Show>
                    <Show when={r.last_error}>
                      <div style="color:#ef4444;word-break:break-word"><strong>Eroare:</strong> {r.last_error}</div>
                    </Show>
                  </div>
                </div>
                <div class="account-card__actions" style="display:flex;gap:8px;flex-wrap:wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    onClick={() => doTrigger(r.report_type, "incremental")}
                    disabled={busy() || isRunning() || onCooldown()}
                  >
                    {busy()
                      ? "Pornește..."
                      : isRunning()
                      ? "În rulare..."
                      : onCooldown()
                      ? `Disponibil în ${fmtCooldown(r.cooldown_remaining_s)}`
                      : "Rulează acum"}
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    onClick={() => doTrigger(r.report_type, "weekly_refresh")}
                    disabled={busy() || isRunning() || onCooldown()}
                    title="Re-rulează pentru luna trecută + luna curentă"
                  >
                    Refresh lună
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={!loading() && reports().length === 0}>
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          Niciun raport configurat.
        </div>
      </Show>
    </div>
  );
}
