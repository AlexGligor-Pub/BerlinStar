import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { readJsonSafe } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";

interface LastRun {
  status: "running" | "success" | "error";
  finished_at: string | null;
  started_at: string;
  duration_ms: number | null;
  triggered_by: string;
}

interface JobInfo {
  job_id: string;
  label: string;
  enabled: boolean;
  trigger_type: "cron" | "interval";
  cron_expression: string | null;
  cron_expression_default: string;
  is_override: boolean;
  next_run_at: string | null;
  last_run: LastRun | null;
  scheduler_running: boolean;
}

interface EditState {
  trigger_type: "cron" | "interval";
  cron_expression: string;
  enabled: boolean;
}

function statusBadge(s: LastRun["status"] | null) {
  if (s === null) return { text: "Niciodata", color: "var(--text-muted)" };
  if (s === "success") return { text: "Succes", color: "var(--success)" };
  if (s === "error") return { text: "Eroare", color: "var(--danger)" };
  return { text: "Ruleaza", color: "var(--accent)" };
}

export default function TasksSection() {
  const [jobs, setJobs] = createSignal<JobInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [triggeringId, setTriggeringId] = createSignal<string | null>(null);
  const [actionMsg, setActionMsg] = createSignal<{ id: string; ok: boolean; text: string } | null>(null);
  const [sorting, setSorting] = createSignal<SortingState>([{ id: "job_id", desc: false }]);

  // Edit modal
  const [editJob, setEditJob] = createSignal<JobInfo | null>(null);
  const [editForm, setEditForm] = createSignal<EditState>({ trigger_type: "cron", cron_expression: "", enabled: true });
  const [editSaving, setEditSaving] = createSignal(false);
  const [editErr, setEditErr] = createSignal("");

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/efactura/jobs");
      if (res.ok) setJobs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    loadJobs();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && editJob() && !editSaving()) {
        closeEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  async function doTrigger(j: JobInfo) {
    setTriggeringId(j.job_id);
    setActionMsg(null);
    try {
      const res = await adminFetch(`/api/admin/efactura/jobs/${j.job_id}/trigger`, { method: "POST" });
      const body = await readJsonSafe<ApiMessageBody & { ok?: boolean }>(res);
      if (res.ok && body.ok) {
        setActionMsg({ id: j.job_id, ok: true, text: "Job rulat cu succes." });
      } else {
        setActionMsg({ id: j.job_id, ok: false, text: body.detail ?? "Eroare la rulare." });
      }
      await loadJobs();
    } catch {
      setActionMsg({ id: j.job_id, ok: false, text: "Eroare de conexiune." });
    } finally {
      setTriggeringId(null);
    }
  }

  function openEdit(j: JobInfo) {
    setEditJob(j);
    setEditForm({
      trigger_type: j.trigger_type,
      cron_expression: j.cron_expression ?? j.cron_expression_default,
      enabled: j.enabled,
    });
    setEditErr("");
  }

  function closeEdit() {
    setEditJob(null);
    setEditErr("");
  }

  async function doSaveEdit() {
    const j = editJob();
    const f = editForm();
    if (!j) return;
    if (!f.cron_expression.trim()) { setEditErr("Expresia nu poate fi goala."); return; }
    setEditSaving(true);
    setEditErr("");
    try {
      const res = await adminFetch(`/api/admin/efactura/jobs/${j.job_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cron_expression: f.cron_expression.trim(),
          trigger_type: f.trigger_type,
          enabled: f.enabled,
        }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setEditErr(d.detail ?? "Eroare la salvare.");
        return;
      }
      closeEdit();
      await loadJobs();
    } finally {
      setEditSaving(false);
    }
  }

  async function doResetDefault() {
    const j = editJob();
    if (!j) return;
    if (!confirm(`Sigur revii la schedule-ul default pentru "${j.label}"?`)) return;
    setEditSaving(true);
    setEditErr("");
    try {
      const res = await adminFetch(`/api/admin/efactura/jobs/${j.job_id}`, {
        method: "PATCH",
        body: JSON.stringify({ reset_to_default: true }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setEditErr(d.detail ?? "Eroare.");
        return;
      }
      closeEdit();
      await loadJobs();
    } finally {
      setEditSaving(false);
    }
  }

  const schedulerRunning = () => jobs()[0]?.scheduler_running ?? false;

  const columns: ColumnDef<JobInfo>[] = [
    {
      id: "job_id",
      accessorKey: "job_id",
      header: "Job",
      cell: (info) => {
        const j = info.row.original;
        return (
          <div style="display:flex;flex-direction:column;gap:2px">
            <span style="font-weight:600">{j.label}</span>
            <span class="text-muted" style="font-size:11px;font-family:monospace">{j.job_id}</span>
          </div>
        );
      },
    },
    {
      id: "schedule",
      header: "Schedule",
      enableSorting: false,
      cell: (info) => {
        const j = info.row.original;
        const expr = j.cron_expression ?? j.cron_expression_default;
        const human = j.trigger_type === "interval" ? `la ${expr} min` : `cron: ${expr}`;
        return (
          <span style="font-family:monospace;font-size:12px">
            {human}
            <Show when={j.is_override}>
              <span style="margin-left:6px;font-size:10px;padding:1px 4px;border-radius:3px;background:var(--accent);color:white">OVERRIDE</span>
            </Show>
          </span>
        );
      },
    },
    {
      id: "next_run_at",
      accessorKey: "next_run_at",
      header: "Urmatoarea rulare",
      cell: (info) => {
        const j = info.row.original;
        if (!j.enabled) return <span class="text-muted">(dezactivat)</span>;
        if (!j.next_run_at) return <span class="text-muted">—</span>;
        return <span style="font-size:12px">{fmtDate(j.next_run_at)}</span>;
      },
    },
    {
      id: "last_run",
      header: "Ultima rulare",
      enableSorting: false,
      cell: (info) => {
        const j = info.row.original;
        if (!j.last_run) return <span class="text-muted">—</span>;
        const b = statusBadge(j.last_run.status);
        return (
          <div style="display:flex;flex-direction:column;gap:2px">
            <span style={`color:${b.color};font-weight:600;font-size:12px`}>{b.text}</span>
            <span class="text-muted" style="font-size:11px">{fmtDate(j.last_run.finished_at ?? j.last_run.started_at)}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const j = info.row.original;
        const msg = () => {
          const m = actionMsg();
          return m && m.id === j.job_id ? m : null;
        };
        return (
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <div style="display:flex;gap:6px">
              <button
                class="btn btn-sm btn-ghost"
                disabled={triggeringId() === j.job_id}
                onClick={() => doTrigger(j)}
                title="Ruleaza acum (manual)"
              >
                {triggeringId() === j.job_id ? "..." : "▶ Ruleaza"}
              </button>
              <button class="btn btn-sm btn-ghost" onClick={() => openEdit(j)}>
                ✎ Editeaza
              </button>
            </div>
            <Show when={msg()}>
              {(m) => (
                <span style={`font-size:11px;color:${m().ok ? "var(--success)" : "var(--danger)"}`}>
                  {m().text}
                </span>
              )}
            </Show>
          </div>
        );
      },
    },
  ];

  const table = createSolidTable({
    get data() { return jobs(); },
    columns,
    state: { get sorting() { return sorting(); } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Tasks programate</h2>
        <div class="reception-header-right">
          <span style={`font-size:12px;padding:4px 8px;border-radius:4px;background:var(--surface-2);color:${schedulerRunning() ? "var(--success)" : "var(--danger)"}`}>
            Scheduler: {schedulerRunning() ? "🟢 Activ" : "🔴 Oprit"}
          </span>
          <button class="btn btn-sm btn-ghost" onClick={loadJobs} disabled={loading()}>
            {loading() ? "..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      <Show when={!schedulerRunning()}>
        <div class="card" style="padding:12px 16px;margin-bottom:12px;border-left:4px solid var(--danger);background:color-mix(in srgb, var(--danger) 8%, transparent)">
          <strong>Scheduler-ul nu ruleaza.</strong> Activeaza-l din eFactura ANAF → Configurare globala → "Scheduler activ".
          Joburile nu se vor executa automat, dar le poti rula manual.
        </div>
      </Show>

      <div class="card" style="padding:0;overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <For each={table.getHeaderGroups()}>
              {(hg) => (
                <tr style="background:var(--surface-2);position:sticky;top:0;z-index:1">
                  <For each={hg.headers}>
                    {(h) => (
                      <th
                        style={`padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border);${h.column.getCanSort() ? "cursor:pointer;user-select:none" : ""}`}
                        onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody>
            <For each={table.getRowModel().rows}>
              {(row) => (
                <tr style={`border-bottom:1px solid var(--border);${!row.original.enabled ? "opacity:0.5" : ""}`}>
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <td style="padding:8px 10px;vertical-align:top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={editJob()}>
        {(j) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-edit-title">
              <div class="sl-modal-header">
                <span class="sl-modal-title" id="tasks-edit-title">Editeaza schedule: {j().label}</span>
                <button class="btn btn-ghost btn-sm" onClick={closeEdit}>✕</button>
              </div>
              <div class="admin-modal-body">
                <div class="admin-form-row">
                  <label class="admin-form-label">Job ID</label>
                  <input class="input" value={j().job_id} disabled />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Tip trigger</label>
                  <select
                    class="input"
                    value={editForm().trigger_type}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, trigger_type: e.currentTarget.value as "cron" | "interval" }))
                    }
                  >
                    <option value="cron">Cron (5 campuri)</option>
                    <option value="interval">Interval (minute)</option>
                  </select>
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">
                    {editForm().trigger_type === "cron" ? "Cron expression" : "Minute"}
                  </label>
                  <input
                    class="input"
                    style="font-family:monospace"
                    value={editForm().cron_expression}
                    placeholder={editForm().trigger_type === "cron" ? "ex. 0 2 1 * * (lunar, ziua 1, ora 02:00)" : "ex. 15"}
                    onInput={(e) => setEditForm((p) => ({ ...p, cron_expression: e.currentTarget.value }))}
                  />
                  <p style="margin:6px 0 0;font-size:11px;color:var(--text-muted)">
                    Default: <code>{j().cron_expression_default}</code> ({j().trigger_type === "cron" ? "cron" : "interval min"})
                  </p>
                </div>
                <div class="admin-form-row admin-form-row--check">
                  <label class="admin-chk-label">
                    <input
                      type="checkbox"
                      checked={editForm().enabled}
                      onChange={(e) => setEditForm((p) => ({ ...p, enabled: e.currentTarget.checked }))}
                    />
                    Job activ
                  </label>
                </div>
                <Show when={editErr()}>
                  <p style="color:var(--danger);font-size:13px;margin:0">{editErr()}</p>
                </Show>
                <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted)">
                  Cron: <code>minute hour day month dow</code> (ex. <code>0 2 1 * *</code> = lunar, ziua 1, ora 02:00).
                </p>
              </div>
              <div class="sl-modal-footer">
                <button class="btn btn-ghost btn-sm" style="margin-right:auto" disabled={editSaving()} onClick={doResetDefault}>
                  Reset la default
                </button>
                <button class="btn btn-ghost btn-sm" onClick={closeEdit} disabled={editSaving()}>Anuleaza</button>
                <button class="btn btn-primary btn-sm" disabled={editSaving()} onClick={doSaveEdit}>
                  {editSaving() ? "Se salveaza..." : "Salveaza"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
