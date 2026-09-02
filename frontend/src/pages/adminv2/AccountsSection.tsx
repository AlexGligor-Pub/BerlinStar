import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { readJsonSafe } from "../../utils/api";
import { debounce } from "../../utils/debounce";
import { useIsMobile } from "../../hooks/createMediaQuery";
import type { ApiMessageBody } from "../../types";
import { loginAsImpersonatedUser } from "../../store/authStore";
import { adminFetch } from "./admin-auth";
import Modal from "../../components/ui/Modal";
import UsersManager from "../../components/UsersManager";
import { fmtDate } from "./shared";
import type { Account } from "./types";
import { drawDailyCountBars } from "../rapoarte/charts";

interface FormState {
  name: string;
  username: string;
  password: string;
  email: string;
  description: string;
  image_url: string;
  is_locked: boolean;
  locked_at: string;
}

function emptyForm(): FormState {
  return { name: "", username: "", password: "", email: "", description: "", image_url: "", is_locked: false, locked_at: "" };
}

function setField<K extends keyof FormState>(
  setter: (fn: (prev: FormState) => FormState) => void,
  key: K,
  value: FormState[K]
) {
  setter((prev) => ({ ...prev, [key]: value }));
}

const USERNAME_RE = /^[a-z0-9]+$/;
function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function statusLabel(a: Account) {
  if (a.is_deleted) return { text: "Sters", cls: "admin-badge admin-badge--deleted" };
  if (a.is_locked) return { text: "Trial", cls: "admin-badge admin-badge--trial" };
  return { text: "Activ", cls: "admin-badge admin-badge--active" };
}

type EFactTokenState = "disconnected" | "connected" | "expiring_soon" | "expired";

interface EFactTokenStatus {
  company_id: number;
  connected: boolean;
  expires_at: string | null;
  days_until_expiry: number | null;
  state: EFactTokenState;
}

interface EFactCompanySummary {
  company_id: number;
  account_id: number;
  name: string;
  cui: number;
  is_vat_payer: boolean | null;
  settings: { use_test_env: boolean } | null;
  token_status: EFactTokenStatus;
}

function efactStateInfo(s: EFactTokenState): { color: string; icon: string; label: string } {
  switch (s) {
    case "connected":     return { color: "var(--success)", icon: "🟢", label: "Conectat" };
    case "expiring_soon": return { color: "var(--accent)",  icon: "🟠", label: "Expiră curând" };
    case "expired":       return { color: "var(--danger)",  icon: "🔴", label: "Expirat" };
    default:              return { color: "var(--text-muted)", icon: "⚫", label: "Deconectat" };
  }
}

export default function AccountsSection() {
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [includeDeleted, setIncludeDeleted] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(false);
  const [lastId, setLastId] = createSignal<number | null>(null);
  const [sorting, setSorting] = createSignal<SortingState>([{ id: "id", desc: true }]);

  const isMobile = useIsMobile();

  let accountsAbort: AbortController | null = null;
  async function loadAccounts(reset = true) {
    accountsAbort?.abort();
    const ctrl = new AbortController();
    accountsAbort = ctrl;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", sort: "id" });
      if (search()) params.set("q", search());
      if (includeDeleted()) params.set("include_deleted", "true");
      if (!reset && lastId() !== null) params.set("last_id", String(lastId()));
      const res = await adminFetch(`/api/accounts?${params}`, { signal: ctrl.signal });
      if (ctrl.signal.aborted || !res.ok) return;
      const data: { items: Account[]; next_cursor: number | null } = await res.json();
      if (ctrl.signal.aborted) return;
      if (reset) setAccounts(data.items);
      else setAccounts((prev) => [...prev, ...data.items]);
      setHasMore(data.next_cursor !== null);
      setLastId(data.next_cursor);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") throw err;
    } finally {
      if (accountsAbort === ctrl) { accountsAbort = null; setLoading(false); }
    }
  }
  const debouncedLoadAccounts = debounce(() => { void loadAccounts(); }, 300);

  onMount(() => loadAccounts());

  const [efactCompanies, setEfactCompanies] = createSignal<EFactCompanySummary[]>([]);
  const [efactLoading, setEfactLoading] = createSignal(false);
  const [efactLoaded, setEfactLoaded] = createSignal(false);

  async function loadEfactCompanies() {
    if (efactLoaded() || efactLoading()) return;
    setEfactLoading(true);
    try {
      const res = await adminFetch("/api/admin/efactura/companies");
      if (res.ok) {
        setEfactCompanies(await res.json());
        setEfactLoaded(true);
      }
    } finally {
      setEfactLoading(false);
    }
  }

  function companiesForAccount(accountId: number): EFactCompanySummary[] {
    return efactCompanies().filter((c) => c.account_id === accountId);
  }

  const [refreshingCompanyId, setRefreshingCompanyId] = createSignal<number | null>(null);
  const [refreshMsg, setRefreshMsg] = createSignal<{ id: number; ok: boolean; text: string } | null>(null);

  interface ReceiptsDailyPoint { date: string; count: number }
  interface ReceiptsDailyResponse { account_id: number; days: number; total: number; points: ReceiptsDailyPoint[] }
  const [receiptsDaily, setReceiptsDaily] = createSignal<ReceiptsDailyResponse | null>(null);
  const [receiptsLoading, setReceiptsLoading] = createSignal(false);
  const [receiptsChartRef, setReceiptsChartRef] = createSignal<HTMLDivElement | undefined>(undefined);

  let chartRafHandle: number | null = null;
  createEffect(() => {
    const d = receiptsDaily();
    const el = receiptsChartRef();
    if (!d || !el) return;
    if (d.total <= 0) return;
    if (chartRafHandle !== null) cancelAnimationFrame(chartRafHandle);
    chartRafHandle = requestAnimationFrame(() => {
      chartRafHandle = null;
      drawDailyCountBars(el, d.points, { label: "bonuri" });
    });
  });
  onCleanup(() => {
    if (chartRafHandle !== null) cancelAnimationFrame(chartRafHandle);
  });

  async function loadReceiptsDaily(accountId: number) {
    setReceiptsLoading(true);
    setReceiptsDaily(null);
    try {
      const res = await adminFetch(`/api/admin/accounts/${accountId}/receipts-daily?days=30`);
      if (res.ok) setReceiptsDaily(await res.json());
    } finally {
      setReceiptsLoading(false);
    }
  }

  async function doRefreshCompanyToken(companyId: number) {
    setRefreshingCompanyId(companyId);
    setRefreshMsg(null);
    try {
      const res = await adminFetch(`/api/admin/efactura/companies/${companyId}/refresh-token`, { method: "POST" });
      const body = await readJsonSafe<ApiMessageBody & { ok?: boolean; expires_at?: string }>(res);
      if (res.ok && body.ok) {
        // Re-fetch the companies list so the new expiry shows up.
        setEfactLoaded(false);
        await loadEfactCompanies();
        setRefreshMsg({ id: companyId, ok: true, text: body.detail ?? "Token refreshat." });
      } else {
        setRefreshMsg({ id: companyId, ok: false, text: body.detail ?? "Eroare la refresh." });
      }
    } catch {
      setRefreshMsg({ id: companyId, ok: false, text: "Eroare de conexiune." });
    } finally {
      setRefreshingCompanyId(null);
    }
  }

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return accounts();
    return accounts().filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q)
    );
  });

  // ── Create modal ──────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = createSignal(false);
  const [addForm, setAddForm] = createSignal<FormState>(emptyForm());
  const [addErr, setAddErr] = createSignal("");
  const [addSaving, setAddSaving] = createSignal(false);

  function openAdd() { setAddForm(emptyForm()); setAddErr(""); setAddOpen(true); }

  async function doAdd(e: Event) {
    e.preventDefault();
    const f = addForm();
    if (!f.name.trim() || !f.username.trim() || !f.password.trim()) {
      setAddErr("Nume, username și parola sunt obligatorii.");
      return;
    }
    if (!USERNAME_RE.test(f.username.trim())) {
      setAddErr("Username-ul poate conține doar litere mici (a-z) și cifre, fără spații sau caractere speciale.");
      return;
    }
    if (!f.email.trim()) {
      setAddErr("Emailul este obligatoriu.");
      return;
    }
    setAddSaving(true); setAddErr("");
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(), username: f.username.trim(), password: f.password,
        email: f.email.trim() || null, description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
      };
      const res = await adminFetch("/api/accounts", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { setAddErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la salvare."); return; }
      const created: Account = await res.json();
      if (f.is_locked) {
        await adminFetch(`/api/accounts/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_locked: true, locked_at: f.locked_at || new Date().toISOString() }),
        });
      }
      setAddOpen(false);
      loadAccounts();
    } finally { setAddSaving(false); }
  }

  // ── Preview / Edit modal ──────────────────────────────────────────────────
  type PreviewMode = "view" | "edit" | "delete";
  const [previewAccount, setPreviewAccount] = createSignal<Account | null>(null);
  const [previewMode, setPreviewMode] = createSignal<PreviewMode>("view");

  // Colaps cards in view mode
  const [efactOpen, setEfactOpen] = createSignal(false);
  const [activityOpen, setActivityOpen] = createSignal(false);

  const [editForm, setEditForm] = createSignal<FormState>(emptyForm());
  const [editErr, setEditErr] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);

  const [deleteConfirmInput, setDeleteConfirmInput] = createSignal("");
  const [deleting, setDeleting] = createSignal(false);

  // ── Support tehnic / impersonate ─────────────────────────────────────────
  const [confirmSupportOpen, setConfirmSupportOpen] = createSignal(false);
  // Contul pentru care e deschis modalul de utilizatori (null = inchis).
  const [usersAccount, setUsersAccount] = createSignal<Account | null>(null);
  const [impersonating, setImpersonating] = createSignal(false);
  const [supportErr, setSupportErr] = createSignal("");

  async function doImpersonate() {
    const a = previewAccount();
    if (!a) return;
    setImpersonating(true);
    setSupportErr("");
    try {
      const res = await adminFetch(`/api/admin/accounts/${a.id}/impersonate`, { method: "POST" });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setSupportErr(d.detail ?? "Eroare la logare.");
        return;
      }
      const data: {
        access_token: string;
        username: string;
        is_locked: boolean;
        locked_at: string | null;
        role?: string;
        resources?: string[];
        code?: string | null;
      } = await res.json();
      loginAsImpersonatedUser(
        data.username,
        data.access_token,
        data.is_locked,
        data.locked_at ?? null,
        "/",
        { role: data.role ?? null, resources: data.resources ?? [], code: data.code ?? null },
      );
    } catch {
      setSupportErr("Eroare de conexiune.");
    } finally {
      setImpersonating(false);
    }
  }

  function openPreview(a: Account) {
    setPreviewAccount(a);
    setPreviewMode("view");
    setDeleteConfirmInput("");
    setEditErr("");
    setEfactOpen(false);
    setActivityOpen(false);
    void loadEfactCompanies();
    void loadReceiptsDaily(a.id);
  }

  function closePreview() {
    setPreviewAccount(null);
    setPreviewMode("view");
    setDeleteConfirmInput("");
    setEfactOpen(false);
    setActivityOpen(false);
  }

  function startEdit() {
    const a = previewAccount();
    if (!a) return;
    setEditForm({
      name: a.name, username: a.username, password: "",
      email: a.email ?? "", description: a.description ?? "",
      image_url: a.image_url ?? "", is_locked: a.is_locked,
      locked_at: a.locked_at ? a.locked_at.slice(0, 16) : "",
    });
    setEditErr("");
    setPreviewMode("edit");
  }

  async function doEdit(e: Event) {
    e.preventDefault();
    const f = editForm(); const a = previewAccount();
    if (!a) return;
    if (!f.name.trim() || !f.username.trim()) { setEditErr("Nume și username sunt obligatorii."); return; }
    if (!USERNAME_RE.test(f.username.trim())) {
      setEditErr("Username-ul poate conține doar litere mici (a-z) și cifre, fără spații sau caractere speciale.");
      return;
    }
    setEditSaving(true); setEditErr("");
    try {
      const patch: Record<string, unknown> = {
        name: f.name.trim(), username: f.username.trim(),
        email: f.email.trim() || null, description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
        is_locked: f.is_locked, locked_at: f.locked_at ? new Date(f.locked_at).toISOString() : null,
      };
      const res = await adminFetch(`/api/accounts/${a.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (!res.ok) { setEditErr((await readJsonSafe<ApiMessageBody>(res)).detail ?? "Eroare la salvare."); return; }
      closePreview();
      loadAccounts();
    } finally { setEditSaving(false); }
  }

  async function doDelete() {
    const a = previewAccount(); if (!a) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/accounts/${a.id}`, { method: "DELETE" });
      closePreview();
      loadAccounts();
    } finally { setDeleting(false); }
  }

  async function doRestore(a: Account) {
    await adminFetch(`/api/accounts/${a.id}`, { method: "PATCH", body: JSON.stringify({ is_deleted: false }) });
    loadAccounts();
  }

  const columns: ColumnDef<Account>[] = [
    {
      id: "avatar",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const a = info.row.original;
        const initials = a.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "#";
        return (
          <Show
            when={a.image_url}
            fallback={
              <div
                class="account-card__avatar"
                style="width:32px;height:32px;border-radius:50%;font-size:12px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0"
              >
                {initials}
              </div>
            }
          >
            <img
              src={a.image_url!}
              alt={a.name}
              style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border);display:block;flex-shrink:0"
            />
          </Show>
        );
      },
    },
    {
      id: "id",
      accessorKey: "id",
      header: "ID",
      cell: (info) => (
        <span style="color:var(--text-muted);font-variant-numeric:tabular-nums">
          {info.getValue() as number}
        </span>
      ),
    },
    {
      id: "name",
      accessorKey: "name",
      header: "Nume",
      cell: (info) => <span style="font-weight:600">{info.getValue() as string}</span>,
    },
    {
      id: "username",
      accessorKey: "username",
      header: "Username",
      cell: (info) => <span style="color:var(--text-muted)">@{info.getValue() as string}</span>,
    },
    {
      id: "email",
      accessorKey: "email",
      header: "Email",
      cell: (info) => <span>{(info.getValue() as string | null) ?? "—"}</span>,
    },
    {
      id: "status",
      accessorFn: (a) => (a.is_deleted ? 2 : a.is_locked ? 1 : 0),
      header: "Status",
      cell: (info) => {
        const st = statusLabel(info.row.original);
        return <span class={st.cls}>{st.text}</span>;
      },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Creat",
      cell: (info) => (
        <span class="text-muted" style="font-size:12px">{fmtDate(info.getValue() as string)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const a = info.row.original;
        return (
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <Show
              when={!a.is_deleted}
              fallback={
                <button class="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); doRestore(a); }}>
                  Restaurează
                </button>
              }
            >
              <button class="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openPreview(a); }}>
                Vezi detalii
              </button>
            </Show>
          </div>
        );
      },
    },
  ];

  const table = createSolidTable({
    get data() { return filtered(); },
    columns,
    state: {
      get sorting() { return sorting(); },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Header */}
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Conturi</h2>
        <div class="reception-header-right">
          <input
            class="input reception-search"
            type="search"
            placeholder="Cauta dupa nume / username..."
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); debouncedLoadAccounts(); }}
          />
          <label class="admin-chk-label">
            <input
              type="checkbox"
              checked={includeDeleted()}
              onChange={(e) => { setIncludeDeleted(e.currentTarget.checked); loadAccounts(); }}
            />
            Include stersi
          </label>
          <span class="reception-count">{filtered().length} conturi</span>
          <button class="btn btn-sm btn-primary" onClick={openAdd}>+ Cont nou</button>
        </div>
      </div>

      {/* Loading / empty state */}
      <Show when={loading() && accounts().length === 0}>
        <div class="text-muted" style="text-align:center;padding:48px">Se încarcă...</div>
      </Show>

      <Show when={!loading() && filtered().length === 0}>
        <div class="card" style="text-align:center;padding:48px 16px">
          <div class="text-muted">Nu există conturi.</div>
        </div>
      </Show>

      {/* Mobile: cards */}
      <Show when={isMobile() && filtered().length > 0}>
        <div class="account-card-grid">
          <For each={table.getRowModel().rows}>
            {(row) => {
              const a = row.original;
              const st = statusLabel(a);
              const initials = a.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
              return (
                <div class="account-card" classList={{ "account-card--deleted": a.is_deleted }}>
                  <div class="account-card__avatar">{initials || "#"}</div>
                  <div class="account-card__body">
                    <div class="account-card__name">{a.name}</div>
                    <div class="account-card__username">@{a.username}</div>
                    <Show when={a.email}>
                      <div class="account-card__email">{a.email}</div>
                    </Show>
                    <div class="account-card__meta">
                      <span class={st.cls}>{st.text}</span>
                      <span class="text-muted" style="font-size:11px">{fmtDate(a.created_at)}</span>
                    </div>
                  </div>
                  <div class="account-card__actions">
                    <Show
                      when={!a.is_deleted}
                      fallback={
                        <button class="btn btn-sm btn-ghost" onClick={() => doRestore(a)}>Restaurează</button>
                      }
                    >
                      <button class="btn btn-sm btn-ghost" onClick={() => openPreview(a)}>
                        Vezi detalii
                      </button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Desktop: TanStack table */}
      <Show when={!isMobile() && filtered().length > 0}>
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
                {(row) => {
                  const a = row.original;
                  return (
                    <tr
                      style={`border-bottom:1px solid var(--border);transition:background 0.15s;cursor:pointer;${a.is_deleted ? "opacity:0.6" : ""}`}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                      onClick={() => { if (!a.is_deleted) openPreview(a); }}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td style="padding:8px 10px">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </For>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
      <Show when={hasMore()}>
        <div style="text-align:center;padding:16px">
          <button class="btn btn-ghost btn-sm" disabled={loading()} onClick={() => loadAccounts(false)}>
            {loading() ? "Se încarcă..." : "Mai mult"}
          </button>
        </div>
      </Show>

      {/* Modal: Create */}
      <Show when={addOpen()}>
        <Modal
          open
          title="Cont nou"
          onClose={() => setAddOpen(false)}
          closeOnEscape={false}
          bodyClass="sl-modal-body--stack"
        >
          <form onSubmit={doAdd} style="display:contents">
            <div class="admin-modal-body">
              <div class="admin-form-row"><label class="admin-form-label">Nume *</label>
                <input class="input" value={addForm().name} onInput={(e) => setField(setAddForm, "name", e.currentTarget.value)} /></div>
              <div class="admin-form-row"><label class="admin-form-label">Username *</label>
                <input class="input" value={addForm().username} placeholder="doar litere mici și cifre" onInput={(e) => setField(setAddForm, "username", sanitizeUsername(e.currentTarget.value))} /></div>
              <div class="admin-form-row"><label class="admin-form-label">Parola *</label>
                <input class="input" type="password" value={addForm().password} onInput={(e) => setField(setAddForm, "password", e.currentTarget.value)} /></div>
              <div class="admin-form-row"><label class="admin-form-label">Email</label>
                <input class="input" value={addForm().email} onInput={(e) => setField(setAddForm, "email", e.currentTarget.value)} /></div>
              <div class="admin-form-row"><label class="admin-form-label">Descriere</label>
                <textarea class="input admin-textarea" value={addForm().description} onInput={(e) => setField(setAddForm, "description", e.currentTarget.value)} /></div>
              <div class="admin-form-row"><label class="admin-form-label">Image URL</label>
                <input class="input" value={addForm().image_url} onInput={(e) => setField(setAddForm, "image_url", e.currentTarget.value)} /></div>
              <div class="admin-form-row admin-form-row--check">
                <label class="admin-chk-label">
                  <input type="checkbox" checked={addForm().is_locked} onChange={(e) => setField(setAddForm, "is_locked", e.currentTarget.checked)} />
                  Trial (is_locked)
                </label>
              </div>
              <Show when={addForm().is_locked}>
                <div class="admin-form-row"><label class="admin-form-label">Locked at</label>
                  <input class="input" type="datetime-local" value={addForm().locked_at} onInput={(e) => setField(setAddForm, "locked_at", e.currentTarget.value)} /></div>
              </Show>
              <Show when={addErr()}><p style="color:var(--danger);font-size:13px;margin:0">{addErr()}</p></Show>
            </div>
            <div class="sl-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}>Anulează</button>
              <button type="submit" class="btn btn-primary btn-sm" disabled={addSaving()}>{addSaving() ? "Se salvează..." : "Creează"}</button>
            </div>
          </form>
        </Modal>
      </Show>

      {/* Modal: Preview / Edit / Delete */}
      <Show when={previewAccount()}>
        {(a) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="width:min(1400px,96vw);height:min(96vh,1000px);max-height:96vh">

              {/* ── View mode ── */}
              <Show when={previewMode() === "view"}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">#{a().id} — {a().name}</span>
                  <button type="button" class="btn btn-ghost btn-sm" onClick={closePreview} aria-label="Închide">✕</button>
                </div>
                <div class="admin-modal-body" style="flex:1;min-height:0;max-height:none;overflow:auto;gap:14px">

                  {/* ── Card 1: Account info (full width) ── */}
                  {(() => {
                    const initials = a().name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "#";
                    return (
                      <div class="card" style="padding:20px;display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
                        {/* Avatar rotund */}
                        <Show
                          when={a().image_url}
                          fallback={
                            <div style="flex-shrink:0;width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb, var(--accent) 15%, transparent);color:var(--accent);font-weight:700;font-size:2rem;letter-spacing:0.05em;border:2px solid var(--border)">
                              {initials}
                            </div>
                          }
                        >
                          <a href={a().image_url!} target="_blank" rel="noopener noreferrer" style="flex-shrink:0;display:block;line-height:0">
                            <img
                              src={a().image_url!}
                              alt={a().name}
                              style="width:96px;height:96px;border-radius:50%;border:2px solid var(--border);object-fit:cover;display:block"
                            />
                          </a>
                        </Show>

                        {/* Conținut: nume + username + status + grid */}
                        <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:14px">
                          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                            <div style="display:flex;flex-direction:column;gap:2px">
                              <div style="font-size:1.25rem;font-weight:700;color:var(--text);line-height:1.2">
                                {a().name}
                              </div>
                              <div style="font-size:0.85rem;color:var(--text-muted)">
                                @{a().username}
                              </div>
                            </div>
                            <span class={statusLabel(a()).cls}>{statusLabel(a()).text}</span>
                          </div>

                          <div
                            class="admin-preview-grid"
                            style="grid-template-columns:110px 1fr 110px 1fr;gap:8px 16px;font-size:0.88rem"
                          >
                            <span class="admin-form-label">Cod firmă</span>
                            <span style="font-family:var(--font-mono,monospace)">{a().code ?? "—"}</span>
                            <span class="admin-form-label">Email</span><span>{a().email ?? "—"}</span>
                            <span class="admin-form-label">Trial expiră</span><span>{fmtDate(a().locked_at)}</span>
                            <span class="admin-form-label">Creat</span><span>{fmtDate(a().created_at)}</span>
                            <span class="admin-form-label">Modificat</span><span>{fmtDate(a().updated_at)}</span>
                            <Show when={a().description}>
                              <span class="admin-form-label">Descriere</span>
                              <span style="grid-column:2/-1">{a().description}</span>
                            </Show>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Card 2: E-factura (collapsible) ── */}
                  <div class="card" style="padding:0;overflow:hidden">
                    <button
                      type="button"
                      onClick={() => setEfactOpen((v) => !v)}
                      style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;width:100%;box-sizing:border-box"
                    >
                      <span style="display:flex;align-items:center;gap:10px">
                        <span style="font-weight:600">E-factura</span>
                        <Show when={efactLoaded()}>
                          <span class="text-muted" style="font-size:12px">
                            {companiesForAccount(a().id).length} {companiesForAccount(a().id).length === 1 ? "firmă" : "firme"}
                          </span>
                        </Show>
                      </span>
                      <span class="cfg-accordion-arrow">{efactOpen() ? "▼" : "▶"}</span>
                    </button>
                    <Show when={efactOpen()}>
                      <div style="padding:0 16px 16px;border-top:1px solid var(--border)">
                        <div style="padding-top:12px">
                          <Show when={efactLoading() && !efactLoaded()}>
                            <div class="text-muted" style="font-size:13px">Se încarcă...</div>
                          </Show>
                          <Show when={efactLoaded()}>
                            <Show
                              when={companiesForAccount(a().id).length > 0}
                              fallback={
                                <div class="text-muted" style="font-size:13px">
                                  Nicio companie eFactura configurată pentru acest cont.
                                </div>
                              }
                            >
                              <div style="display:flex;flex-direction:column;gap:8px">
                                <For each={companiesForAccount(a().id)}>
                                  {(c) => {
                                    const info = efactStateInfo(c.token_status.state);
                                    const env = c.settings?.use_test_env ? "SANDBOX" : "PROD";
                                    const msg = () => {
                                      const m = refreshMsg();
                                      return m && m.id === c.company_id ? m : null;
                                    };
                                    return (
                                      <div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px">
                                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between">
                                          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                            <span style="font-weight:600">{c.name}</span>
                                            <span class="text-muted" style="font-size:12px">CUI {c.cui}</span>
                                            <span
                                              style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--surface-2)"
                                              title="Mediu ANAF"
                                            >
                                              {env}
                                            </span>
                                          </div>
                                          <Show when={c.token_status.connected}>
                                            <button
                                              class="btn btn-ghost btn-sm"
                                              disabled={refreshingCompanyId() === c.company_id}
                                              onClick={() => doRefreshCompanyToken(c.company_id)}
                                              title="Force-refresh manual al token-ului ANAF"
                                            >
                                              {refreshingCompanyId() === c.company_id ? "Se refreshează..." : "↻ Refresh token"}
                                            </button>
                                          </Show>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:6px;font-size:13px;flex-wrap:wrap">
                                          <span>{info.icon}</span>
                                          <span style={`color:${info.color};font-weight:600`}>{info.label}</span>
                                          <Show when={c.token_status.connected && c.token_status.expires_at}>
                                            <span class="text-muted">
                                              · valid pana la <b>{fmtDate(c.token_status.expires_at)}</b>
                                              <Show when={c.token_status.days_until_expiry !== null}>
                                                {" "}({c.token_status.days_until_expiry}z)
                                              </Show>
                                            </span>
                                          </Show>
                                        </div>
                                        <Show when={msg()}>
                                          {(m) => (
                                            <div style={`font-size:12px;color:${m().ok ? "var(--success)" : "var(--danger)"}`}>
                                              {m().text}
                                            </div>
                                          )}
                                        </Show>
                                      </div>
                                    );
                                  }}
                                </For>
                              </div>
                            </Show>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>

                  {/* ── Card 3: Activitate (collapsible) ── */}
                  <div class="card" style="padding:0;overflow:hidden">
                    <button
                      type="button"
                      onClick={() => setActivityOpen((v) => !v)}
                      style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;width:100%;box-sizing:border-box"
                    >
                      <span style="display:flex;align-items:center;gap:10px">
                        <span style="font-weight:600">Activitate</span>
                        <Show when={receiptsDaily()}>
                          <span class="text-muted" style="font-size:12px">
                            ultimele 30 zile · total: <b style="color:var(--text)">{receiptsDaily()!.total}</b> bonuri
                          </span>
                        </Show>
                      </span>
                      <span class="cfg-accordion-arrow">{activityOpen() ? "▼" : "▶"}</span>
                    </button>
                    <Show when={activityOpen()}>
                      <div style="padding:12px 16px 16px;border-top:1px solid var(--border)">
                        <Show when={receiptsLoading()}>
                          <div class="text-muted" style="font-size:13px">Se încarcă...</div>
                        </Show>
                        <Show when={!receiptsLoading() && receiptsDaily()}>
                          <Show
                            when={receiptsDaily()!.total > 0}
                            fallback={
                              <div class="text-muted" style="font-size:13px">
                                Niciun bon emis în ultimele 30 zile.
                              </div>
                            }
                          >
                            <div ref={setReceiptsChartRef} style="width:100%;min-height:260px" />
                          </Show>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
                <div class="sl-modal-footer">
                  <button
                    class="btn btn-danger btn-sm"
                    style="margin-right:auto"
                    onClick={() => { setDeleteConfirmInput(""); setPreviewMode("delete"); }}
                  >
                    Șterge
                  </button>
                  <button class="btn btn-ghost btn-sm" onClick={() => setUsersAccount(a())}>
                    👥 Utilizatori
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    onClick={() => { setSupportErr(""); setConfirmSupportOpen(true); }}
                  >
                    Oferă support tehnic
                  </button>
                  <button class="btn btn-primary btn-sm" onClick={startEdit}>Editează</button>
                </div>
              </Show>

              {/* ── Edit mode ── */}
              <Show when={previewMode() === "edit"}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">Editează #{a().id} — {a().name}</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setPreviewMode("view")}>✕</button>
                </div>
                <form onSubmit={doEdit} style="display:contents">
                  <div class="admin-modal-body">
                    <div class="admin-form-row"><label class="admin-form-label">Nume *</label>
                      <input class="input" value={editForm().name} onInput={(e) => setField(setEditForm, "name", e.currentTarget.value)} /></div>
                    <div class="admin-form-row"><label class="admin-form-label">Username *</label>
                      <input class="input" value={editForm().username} placeholder="doar litere mici și cifre" onInput={(e) => setField(setEditForm, "username", sanitizeUsername(e.currentTarget.value))} /></div>
                    <div class="admin-form-row">
                      <label class="admin-form-label">Parole</label>
                      <div>
                        <button type="button" class="btn btn-ghost btn-sm" onClick={() => setUsersAccount(a())}>
                          👥 Utilizatori și parole
                        </button>
                        <div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)">
                          Autentificarea se face pe utilizatori, nu pe cont — parolele se
                          schimbă de acolo.
                        </div>
                      </div>
                    </div>
                    <div class="admin-form-row"><label class="admin-form-label">Email</label>
                      <input class="input" value={editForm().email} onInput={(e) => setField(setEditForm, "email", e.currentTarget.value)} /></div>
                    <div class="admin-form-row"><label class="admin-form-label">Descriere</label>
                      <textarea class="input admin-textarea" value={editForm().description} onInput={(e) => setField(setEditForm, "description", e.currentTarget.value)} /></div>
                    <div class="admin-form-row"><label class="admin-form-label">Image URL</label>
                      <input class="input" value={editForm().image_url} onInput={(e) => setField(setEditForm, "image_url", e.currentTarget.value)} /></div>
                    <div class="admin-form-row admin-form-row--check">
                      <label class="admin-chk-label">
                        <input type="checkbox" checked={editForm().is_locked} onChange={(e) => setField(setEditForm, "is_locked", e.currentTarget.checked)} />
                        Trial (is_locked)
                      </label>
                    </div>
                    <Show when={editForm().is_locked}>
                      <div class="admin-form-row"><label class="admin-form-label">Locked at</label>
                        <input class="input" type="datetime-local" value={editForm().locked_at} onInput={(e) => setField(setEditForm, "locked_at", e.currentTarget.value)} /></div>
                    </Show>
                    <Show when={editErr()}><p style="color:var(--danger);font-size:13px;margin:0">{editErr()}</p></Show>
                  </div>
                  <div class="sl-modal-footer">
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => setPreviewMode("view")}>← Înapoi</button>
                    <button type="submit" class="btn btn-primary btn-sm" disabled={editSaving()}>{editSaving() ? "Se salvează..." : "Salvează"}</button>
                  </div>
                </form>
              </Show>

              {/* ── Delete confirmation mode ── */}
              <Show when={previewMode() === "delete"}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">Confirmare ștergere</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setPreviewMode("view")}>✕</button>
                </div>
                <div class="admin-modal-body">
                  <p style="margin:0 0 12px;color:var(--text)">
                    Ești sigur că vrei să ștergi contul{" "}
                    <strong>{a().name}</strong>{" "}
                    <span class="text-muted">({a().username})</span>?
                  </p>
                  <p style="margin:0 0 8px;font-size:13px;color:var(--text-muted)">
                    Scrie <strong style="color:var(--text)">{a().username}</strong> pentru a confirma:
                  </p>
                  <input
                    class="input"
                    placeholder={a().username}
                    value={deleteConfirmInput()}
                    onInput={(e) => setDeleteConfirmInput(e.currentTarget.value)}
                    autofocus
                  />
                </div>
                <div class="sl-modal-footer">
                  <button class="btn btn-ghost btn-sm" onClick={() => setPreviewMode("view")}>Anulează</button>
                  <button
                    class="btn btn-danger btn-sm"
                    disabled={deleteConfirmInput() !== a().username || deleting()}
                    onClick={doDelete}
                  >
                    {deleting() ? "..." : "Șterge definitiv"}
                  </button>
                </div>
              </Show>

            </div>
          </div>
        )}
      </Show>

      {/* Modal: confirmare logare ca support tehnic (impersonate) */}
      {/* ── Utilizatorii unui cont (acelasi component ca pagina Utilizatori) ── */}
      <Modal
        open={!!usersAccount()}
        onClose={() => setUsersAccount(null)}
        title={`Utilizatori — ${usersAccount()?.name ?? ""}`}
        size="lg"
      >
        <Show when={usersAccount()}>
          {(acc) => (
            <>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">
                Cod firmă: <strong style="font-family:var(--font-mono,monospace)">{acc().code ?? "—"}</strong>
                {" · "}la login se cer codul firmei, utilizatorul și parola.
              </div>
              <UsersManager
                basePath={`/api/admin/accounts/${acc().id}/users`}
                fetcher={adminFetch}
                companyCode={acc().code}
                embedded
              />
            </>
          )}
        </Show>
        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <button class="btn btn-primary btn-sm" onClick={() => setUsersAccount(null)}>Închide</button>
        </div>
      </Modal>

      <Show when={confirmSupportOpen() && previewAccount()}>
        {(a) => (
          <Modal
            open
            title="Logare ca support tehnic"
            hideClose
            bodyClass="sl-modal-body--stack"
            footer={<>
              <button
                class="btn btn-ghost btn-sm"
                disabled={impersonating()}
                onClick={() => setConfirmSupportOpen(false)}
              >
                Anulează
              </button>
              <button
                class="btn btn-primary btn-sm"
                disabled={impersonating()}
                onClick={doImpersonate}
              >
                {impersonating() ? "Se loghează..." : "Da, loghează-mă"}
              </button>
            </>}
          >
            <div class="admin-modal-body">
              <p style="margin:0 0 12px">
                Te vei loga ca <strong>{a().name}</strong> ({a().username}) cu drepturi
                complete pe acel cont. Sesiunea ta de administrator se va închide și
                vei părăsi pagina AdminV2.
              </p>
              <p style="margin:0 0 12px">
                Pentru a reveni va trebui să te delogi și să reintroduci parolele
                administrator.
              </p>
              <Show when={supportErr()}>
                <p style="color:var(--danger);font-size:13px;margin:0">{supportErr()}</p>
              </Show>
            </div>
          </Modal>
        )}
      </Show>
    </div>
  );
}
