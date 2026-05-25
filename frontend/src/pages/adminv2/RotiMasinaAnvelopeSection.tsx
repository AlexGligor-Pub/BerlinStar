import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { readJsonSafe } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";

type Status = "pending" | "approved" | "rejected";

interface Marca {
  id: number;
  nume: string;
  status: Status;
  proposed_by_account_id: number | null;
  proposed_by_account_name: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
}

type TabKey = "pending" | "approved" | "rejected" | "all";

const TAB_LABELS: Record<TabKey, string> = {
  pending: "În așteptare",
  approved: "Aprobate",
  rejected: "Respinse",
  all: "Toate",
};

const STATUS_BADGE: Record<Status, { text: string; bg: string; color: string }> = {
  pending:  { text: "În așteptare", bg: "rgba(245,158,11,.15)", color: "#b45309" },
  approved: { text: "Aprobată",     bg: "rgba(16,185,129,.15)", color: "#047857" },
  rejected: { text: "Respinsă",     bg: "rgba(239,68,68,.15)",  color: "#b91c1c" },
};

export default function RotiMasinaAnvelopeSection() {
  const [tab, setTab] = createSignal<TabKey>("pending");
  const [rows, setRows] = createSignal<Marca[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [counts, setCounts] = createSignal<Counts>({ pending: 0, approved: 0, rejected: 0 });
  const [sorting, setSorting] = createSignal<SortingState>([{ id: "nume", desc: false }]);
  const [hasMore, setHasMore] = createSignal(false);
  const [lastId, setLastId] = createSignal<number | null>(null);

  async function loadCounts() {
    const res = await adminFetch("/api/admin/marci-anvelope/counts");
    if (res.ok) setCounts(await res.json());
  }

  async function loadRows(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (tab() !== "all") params.set("status", tab());
      if (!reset && lastId() !== null) params.set("last_id", String(lastId()));
      const res = await adminFetch(`/api/admin/marci-anvelope?${params}`);
      if (!res.ok) return;
      const data: { items: Marca[]; next_cursor: number | null } = await res.json();
      if (reset) setRows(data.items);
      else setRows((prev) => [...prev, ...data.items]);
      setHasMore(data.next_cursor !== null);
      setLastId(data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void loadCounts();
    void loadRows();
  });

  function changeTab(t: TabKey) {
    setTab(t);
    setLastId(null);
    void loadRows(true);
  }

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return rows();
    return rows().filter((m) =>
      m.nume.toLowerCase().includes(q) ||
      (m.proposed_by_account_name ?? "").toLowerCase().includes(q),
    );
  });

  // ── Action handlers ──────────────────────────────────────────────────────
  const [busyId, setBusyId] = createSignal<number | null>(null);
  const [actionErr, setActionErr] = createSignal<string | null>(null);

  async function approve(id: number) {
    setBusyId(id); setActionErr(null);
    try {
      const res = await adminFetch(`/api/admin/marci-anvelope/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        setActionErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la aprobare.");
        return;
      }
      await Promise.all([loadCounts(), loadRows(true)]);
    } finally { setBusyId(null); }
  }

  async function reject(id: number) {
    setBusyId(id); setActionErr(null);
    try {
      const res = await adminFetch(`/api/admin/marci-anvelope/${id}/reject`, { method: "POST" });
      if (!res.ok) {
        setActionErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la respingere.");
        return;
      }
      await Promise.all([loadCounts(), loadRows(true)]);
    } finally { setBusyId(null); }
  }

  // ── Create / edit / delete modals ─────────────────────────────────────────
  const [addOpen, setAddOpen] = createSignal(false);
  const [addName, setAddName] = createSignal("");
  const [addSaving, setAddSaving] = createSignal(false);
  const [addErr, setAddErr] = createSignal("");

  async function doAdd(e: Event) {
    e.preventDefault();
    const name = addName().trim();
    if (!name) { setAddErr("Numele este obligatoriu."); return; }
    setAddSaving(true); setAddErr("");
    try {
      const res = await adminFetch("/api/admin/marci-anvelope", {
        method: "POST",
        body: JSON.stringify({ nume: name }),
      });
      if (!res.ok) {
        setAddErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la salvare.");
        return;
      }
      setAddOpen(false);
      setAddName("");
      await Promise.all([loadCounts(), loadRows(true)]);
    } finally { setAddSaving(false); }
  }

  const [editTarget, setEditTarget] = createSignal<Marca | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);
  const [editErr, setEditErr] = createSignal("");

  function openEdit(m: Marca) {
    setEditTarget(m);
    setEditName(m.nume);
    setEditErr("");
  }

  async function doEdit(e: Event) {
    e.preventDefault();
    const t = editTarget();
    if (!t) return;
    const name = editName().trim();
    if (!name) { setEditErr("Numele este obligatoriu."); return; }
    setEditSaving(true); setEditErr("");
    try {
      const res = await adminFetch(`/api/admin/marci-anvelope/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nume: name }),
      });
      if (!res.ok) {
        setEditErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la salvare.");
        return;
      }
      setEditTarget(null);
      await loadRows(true);
    } finally { setEditSaving(false); }
  }

  const [delTarget, setDelTarget] = createSignal<Marca | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  async function doDelete() {
    const t = delTarget();
    if (!t) return;
    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/marci-anvelope/${t.id}`, { method: "DELETE" });
      if (!res.ok) return;
      setDelTarget(null);
      await Promise.all([loadCounts(), loadRows(true)]);
    } finally { setDeleting(false); }
  }

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: ColumnDef<Marca>[] = [
    {
      id: "id",
      accessorKey: "id",
      header: "ID",
      cell: (info) => (
        <span style="color:var(--text-muted);font-variant-numeric:tabular-nums">{info.getValue() as number}</span>
      ),
    },
    {
      id: "nume",
      accessorKey: "nume",
      header: "Nume",
      cell: (info) => <span style="font-weight:600">{info.getValue() as string}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: (info) => {
        const s = info.getValue() as Status;
        const b = STATUS_BADGE[s];
        return (
          <span style={`padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${b.bg};color:${b.color}`}>
            {b.text}
          </span>
        );
      },
    },
    {
      id: "proposed_by",
      accessorFn: (m) => m.proposed_by_account_name ?? "",
      header: "Propus de",
      cell: (info) => {
        const m = info.row.original;
        if (m.proposed_by_account_id === null) {
          return <span class="text-muted" style="font-style:italic;font-size:12px">— sistem —</span>;
        }
        return <span style="font-size:13px">{m.proposed_by_account_name ?? `#${m.proposed_by_account_id}`}</span>;
      },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Creat",
      cell: (info) => <span class="text-muted" style="font-size:12px">{fmtDate(info.getValue() as string)}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const m = info.row.original;
        const busy = () => busyId() === m.id;
        return (
          <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
            <Show when={m.status === "pending"}>
              <button
                class="btn btn-sm"
                style="background:var(--success,#10b981);color:#fff"
                disabled={busy()}
                onClick={(e) => { e.stopPropagation(); void approve(m.id); }}
              >Aprobă</button>
              <button
                class="btn btn-sm"
                style="background:var(--danger,#ef4444);color:#fff"
                disabled={busy()}
                onClick={(e) => { e.stopPropagation(); void reject(m.id); }}
              >Respinge</button>
            </Show>
            <Show when={m.status === "approved"}>
              <button class="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEdit(m); }}>Editează</button>
              <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onClick={(e) => { e.stopPropagation(); setDelTarget(m); }}>Șterge</button>
            </Show>
            <Show when={m.status === "rejected"}>
              <button
                class="btn btn-sm"
                style="background:var(--success,#10b981);color:#fff"
                disabled={busy()}
                onClick={(e) => { e.stopPropagation(); void approve(m.id); }}
              >Reaprobă</button>
              <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onClick={(e) => { e.stopPropagation(); setDelTarget(m); }}>Șterge</button>
            </Show>
          </div>
        );
      },
    },
  ];

  const table = createSolidTable({
    get data() { return filtered(); },
    columns,
    state: { get sorting() { return sorting(); } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Mărci anvelope (globale)</h2>
        <div class="reception-header-right">
          <input
            class="input reception-search"
            type="search"
            placeholder="Caută după nume / cont..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <span class="reception-count">{filtered().length} mărci</span>
          <button class="btn btn-sm btn-primary" onClick={() => { setAddName(""); setAddErr(""); setAddOpen(true); }}>
            + Marcă nouă
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <For each={(["pending", "approved", "rejected", "all"] as TabKey[])}>
          {(t) => {
            const isActive = () => tab() === t;
            const count = () => t === "all" ? counts().pending + counts().approved + counts().rejected : counts()[t as Status];
            return (
              <button
                class={`btn btn-sm ${isActive() ? "btn-primary" : "btn-ghost"}`}
                onClick={() => changeTab(t)}
              >
                {TAB_LABELS[t]}
                <Show when={t === "pending" && counts().pending > 0}>
                  <span style="margin-left:6px;background:var(--danger,#ef4444);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700">
                    {counts().pending}
                  </span>
                </Show>
                <Show when={t !== "pending"}>
                  <span class="text-muted" style="margin-left:6px;font-size:11px">({count()})</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      <Show when={actionErr()}>
        <div class="login-error" style="margin-bottom:12px">{actionErr()}</div>
      </Show>

      <Show when={loading() && rows().length === 0}>
        <div class="text-muted" style="text-align:center;padding:48px">Se încarcă...</div>
      </Show>

      <Show when={!loading() && filtered().length === 0}>
        <div class="card" style="text-align:center;padding:48px 16px">
          <div class="text-muted">Nicio marcă în această secțiune.</div>
        </div>
      </Show>

      <Show when={filtered().length > 0}>
        <div class="card" style="padding:0;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <For each={table.getHeaderGroups()}>
                {(hg) => (
                  <tr style="background:var(--surface-2);position:sticky;top:0;z-index:1">
                    <For each={hg.headers}>
                      {(h) => {
                        const sort = h.column.getIsSorted();
                        const canSort = h.column.getCanSort();
                        return (
                          <th
                            style={`padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border);${canSort ? "cursor:pointer;user-select:none" : ""}`}
                            onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                          >
                            <span style="display:inline-flex;align-items:center;gap:4px">
                              {flexRender(h.column.columnDef.header, h.getContext())}
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
                  <tr style="border-bottom:1px solid var(--border)">
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td style="padding:8px 10px">
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
      </Show>

      <Show when={hasMore()}>
        <div style="text-align:center;padding:16px">
          <button class="btn btn-ghost btn-sm" disabled={loading()} onClick={() => loadRows(false)}>
            {loading() ? "Se încarcă..." : "Încarcă mai mult"}
          </button>
        </div>
      </Show>

      {/* Modal: Adaugă marcă */}
      <Show when={addOpen()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:480px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Marcă nouă (aprobată direct)</span>
            </div>
            <form onSubmit={doAdd} style="display:contents">
              <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
                <label class="form-label">Nume marcă</label>
                <input
                  class="input"
                  type="text"
                  value={addName()}
                  onInput={(e) => setAddName(e.currentTarget.value)}
                  placeholder="ex: Michelin"
                  autofocus
                />
                <Show when={addErr()}>
                  <p style="color:var(--danger);font-size:13px;margin:0">{addErr()}</p>
                </Show>
              </div>
              <div class="sl-modal-footer">
                <button type="button" class="btn btn-ghost btn-sm" disabled={addSaving()} onClick={() => setAddOpen(false)}>Anulează</button>
                <button type="submit" class="btn btn-primary btn-sm" disabled={addSaving() || !addName().trim()}>
                  {addSaving() ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal: Editează marcă */}
      <Show when={editTarget()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:480px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Editează marcă</span>
            </div>
            <form onSubmit={doEdit} style="display:contents">
              <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
                <label class="form-label">Nume marcă</label>
                <input
                  class="input"
                  type="text"
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  autofocus
                />
                <Show when={editErr()}>
                  <p style="color:var(--danger);font-size:13px;margin:0">{editErr()}</p>
                </Show>
              </div>
              <div class="sl-modal-footer">
                <button type="button" class="btn btn-ghost btn-sm" disabled={editSaving()} onClick={() => setEditTarget(null)}>Anulează</button>
                <button type="submit" class="btn btn-primary btn-sm" disabled={editSaving() || !editName().trim()}>
                  {editSaving() ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal: Confirmare ștergere */}
      <Show when={delTarget()}>
        {(t) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:480px;width:100%">
              <div class="sl-modal-header">
                <span class="sl-modal-title">Șterge marcă</span>
              </div>
              <div class="sl-modal-body" style="padding:16px 20px">
                <p style="margin:0;font-size:14px;line-height:1.5">
                  Ștergi marca <strong>„{t().nume}”</strong>? Anvelopele/montajele care o referă păstrează istoricul, dar marca nu va mai apărea în dropdown-uri.
                </p>
              </div>
              <div class="sl-modal-footer">
                <button class="btn btn-ghost btn-sm" disabled={deleting()} onClick={() => setDelTarget(null)}>Anulează</button>
                <button
                  class="btn btn-sm"
                  style="background:var(--danger,#ef4444);color:#fff"
                  disabled={deleting()}
                  onClick={doDelete}
                >{deleting() ? "Se șterge..." : "Șterge"}</button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
