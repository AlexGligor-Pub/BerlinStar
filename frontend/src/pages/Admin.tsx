import { For, Show, createMemo, createSignal } from "solid-js";
import { API_BASE } from "../utils/api";

interface Account {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
  username: string;
  email: string | null;
  image_url: string | null;
  is_locked: boolean;
  locked_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO") + " " + d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(API_BASE + url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
  });
}

export default function Admin() {
  // ── Auth gate ────────────────────────────────────────────────────────────
  const [verified, setVerified] = createSignal(false);
  const [pass1, setPass1] = createSignal("");
  const [pass2, setPass2] = createSignal("");
  const [verifyErr, setVerifyErr] = createSignal("");
  const [verifying, setVerifying] = createSignal(false);

  async function doVerify(e: Event) {
    e.preventDefault();
    setVerifyErr("");
    setVerifying(true);
    try {
      const res = await adminFetch("/api/admin/verify", {
        method: "POST",
        body: JSON.stringify({ password1: pass1(), password2: pass2() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setVerifyErr((d as any).detail ?? "Parole incorecte.");
        return;
      }
      setVerified(true);
      loadAccounts();
    } catch {
      setVerifyErr("Eroare de conexiune.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Accounts state ───────────────────────────────────────────────────────
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [includeDeleted, setIncludeDeleted] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(false);
  const [lastId, setLastId] = createSignal<number | null>(null);

  async function loadAccounts(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", sort: "id" });
      if (search()) params.set("q", search());
      if (includeDeleted()) params.set("include_deleted", "true");
      if (!reset && lastId() !== null) params.set("last_id", String(lastId()));
      const res = await adminFetch(`/api/accounts?${params}`);
      if (!res.ok) return;
      const data: { items: Account[]; next_cursor: number | null } = await res.json();
      if (reset) {
        setAccounts(data.items);
      } else {
        setAccounts((prev) => [...prev, ...data.items]);
      }
      setHasMore(data.next_cursor !== null);
      setLastId(data.next_cursor);
    } finally {
      setLoading(false);
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

  // ── Create / Edit modal ──────────────────────────────────────────────────
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

  const emptyForm = (): FormState => ({
    name: "",
    username: "",
    password: "",
    email: "",
    description: "",
    image_url: "",
    is_locked: false,
    locked_at: "",
  });

  const [addOpen, setAddOpen] = createSignal(false);
  const [addForm, setAddForm] = createSignal<FormState>(emptyForm());
  const [addErr, setAddErr] = createSignal("");
  const [addSaving, setAddSaving] = createSignal(false);

  function openAdd() {
    setAddForm(emptyForm());
    setAddErr("");
    setAddOpen(true);
  }

  async function doAdd(e: Event) {
    e.preventDefault();
    const f = addForm();
    if (!f.name.trim() || !f.username.trim() || !f.password.trim()) {
      setAddErr("Nume, username și parola sunt obligatorii.");
      return;
    }
    setAddSaving(true);
    setAddErr("");
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(),
        username: f.username.trim(),
        password: btoa(f.password),
        email: f.email.trim() || null,
        description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
      };
      const res = await adminFetch("/api/accounts", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAddErr((d as any).detail ?? "Eroare la salvare.");
        return;
      }
      const created: Account = await res.json();
      if (f.is_locked) {
        await adminFetch(`/api/accounts/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_locked: true, locked_at: f.locked_at || new Date().toISOString() }),
        });
      }
      setAddOpen(false);
      loadAccounts();
    } finally {
      setAddSaving(false);
    }
  }

  const [editAccount, setEditAccount] = createSignal<Account | null>(null);
  const [editForm, setEditForm] = createSignal<FormState>(emptyForm());
  const [editErr, setEditErr] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);

  function openEdit(a: Account) {
    setEditForm({
      name: a.name,
      username: a.username,
      password: "",
      email: a.email ?? "",
      description: a.description ?? "",
      image_url: a.image_url ?? "",
      is_locked: a.is_locked,
      locked_at: a.locked_at ? a.locked_at.slice(0, 16) : "",
    });
    setEditErr("");
    setEditAccount(a);
  }

  async function doEdit(e: Event) {
    e.preventDefault();
    const f = editForm();
    const a = editAccount();
    if (!a) return;
    if (!f.name.trim() || !f.username.trim()) {
      setEditErr("Nume și username sunt obligatorii.");
      return;
    }
    setEditSaving(true);
    setEditErr("");
    try {
      const patch: Record<string, unknown> = {
        name: f.name.trim(),
        username: f.username.trim(),
        email: f.email.trim() || null,
        description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
        is_locked: f.is_locked,
        locked_at: f.locked_at ? new Date(f.locked_at).toISOString() : null,
      };
      if (f.password.trim()) patch.password = btoa(f.password.trim());
      const res = await adminFetch(`/api/accounts/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setEditErr((d as any).detail ?? "Eroare la salvare.");
        return;
      }
      setEditAccount(null);
      loadAccounts();
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete modal ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = createSignal<Account | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  async function doDelete() {
    const a = deleteTarget();
    if (!a) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/accounts/${a.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      loadAccounts();
    } finally {
      setDeleting(false);
    }
  }

  // ── Restore ───────────────────────────────────────────────────────────────
  async function doRestore(a: Account) {
    await adminFetch(`/api/accounts/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_deleted: false }),
    });
    loadAccounts();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function statusLabel(a: Account) {
    if (a.is_deleted) return { text: "Sters", cls: "admin-badge admin-badge--deleted" };
    if (a.is_locked) return { text: "Trial", cls: "admin-badge admin-badge--trial" };
    return { text: "Activ", cls: "admin-badge admin-badge--active" };
  }

  function setField<K extends keyof FormState>(
    setter: (fn: (prev: FormState) => FormState) => void,
    key: K,
    value: FormState[K]
  ) {
    setter((prev) => ({ ...prev, [key]: value }));
  }

  // ── Auth gate render ──────────────────────────────────────────────────────
  return (
    <Show
      when={verified()}
      fallback={
        <div class="admin-gate-page">
          <form class="admin-gate-card" onSubmit={doVerify}>
            <div class="admin-gate-title">Admin Panel</div>
            <div class="admin-gate-subtitle">Acces restricționat</div>
            <input
              class="input"
              type="password"
              placeholder="Parola 1"
              value={pass1()}
              onInput={(e) => setPass1(e.currentTarget.value)}
              autofocus
            />
            <input
              class="input"
              type="password"
              placeholder="Parola 2"
              value={pass2()}
              onInput={(e) => setPass2(e.currentTarget.value)}
            />
            <Show when={verifyErr()}>
              <p class="admin-gate-err">{verifyErr()}</p>
            </Show>
            <button class="btn btn-primary" type="submit" disabled={verifying()}>
              {verifying() ? "Se verifică..." : "Intră"}
            </button>
          </form>
        </div>
      }
    >
      {/* ── Admin Panel ─────────────────────────────────────────────────── */}
      <div class="admin-page">
        {/* Header */}
        <div class="page-header" style="max-width:1100px;margin:0 auto;width:100%">
          <h1 class="page-title">Admin Panel</h1>
          <div class="reception-header-right">
            <input
              class="input reception-search"
              style="width:220px"
              type="search"
              placeholder="Cauta dupa nume / username..."
              value={search()}
              onInput={(e) => { setSearch(e.currentTarget.value); loadAccounts(); }}
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
            <button class="btn btn-sm btn-primary" onClick={openAdd}>
              + Cont nou
            </button>
          </div>
        </div>

        {/* Accounts list */}
        <div class="admin-list" style="max-width:1100px;margin:0 auto;width:100%">
          <Show
            when={!loading() || accounts().length > 0}
            fallback={<div class="text-muted" style="text-align:center;padding:48px">Se încarcă...</div>}
          >
            <Show
              when={filtered().length > 0}
              fallback={
                <div class="card" style="text-align:center;padding:48px 16px">
                  <div class="text-muted">Nu există conturi.</div>
                </div>
              }
            >
              {/* Header row */}
              <div class="admin-row admin-row--header">
                <span class="admin-col admin-col--id">#</span>
                <span class="admin-col admin-col--name">Nume</span>
                <span class="admin-col admin-col--username">Username</span>
                <span class="admin-col admin-col--email">Email</span>
                <span class="admin-col admin-col--status">Status</span>
                <span class="admin-col admin-col--date">Creat</span>
                <span class="admin-col admin-col--actions" />
              </div>
              <For each={filtered()}>
                {(a) => {
                  const st = statusLabel(a);
                  return (
                    <div class="admin-row" classList={{ "admin-row--deleted": a.is_deleted }}>
                      <span class="admin-col admin-col--id">{a.id}</span>
                      <span class="admin-col admin-col--name">{a.name}</span>
                      <span class="admin-col admin-col--username">{a.username}</span>
                      <span class="admin-col admin-col--email">{a.email ?? "—"}</span>
                      <span class="admin-col admin-col--status">
                        <span class={st.cls}>{st.text}</span>
                      </span>
                      <span class="admin-col admin-col--date">{fmtDate(a.created_at)}</span>
                      <span class="admin-col admin-col--actions">
                        <Show
                          when={!a.is_deleted}
                          fallback={
                            <button class="btn btn-sm btn-ghost" onClick={() => doRestore(a)}>
                              Restaurează
                            </button>
                          }
                        >
                          <button class="btn btn-sm btn-ghost" onClick={() => openEdit(a)}>
                            Editează
                          </button>
                          <button class="btn btn-sm btn-danger" onClick={() => setDeleteTarget(a)}>
                            Șterge
                          </button>
                        </Show>
                      </span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>

          <Show when={hasMore()}>
            <div style="text-align:center;padding:16px">
              <button class="btn btn-ghost btn-sm" disabled={loading()} onClick={() => loadAccounts(false)}>
                {loading() ? "Se încarcă..." : "Mai mult"}
              </button>
            </div>
          </Show>
        </div>

        {/* ── Modal: Create ──────────────────────────────────────────────── */}
        <Show when={addOpen()}>
          <div class="sl-modal-overlay" onClick={() => setAddOpen(false)}>
            <div class="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div class="sl-modal-header">
                <span class="sl-modal-title">Cont nou</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}>✕</button>
              </div>
              <form onSubmit={doAdd} class="admin-modal-form">
                <div class="admin-form-row">
                  <label class="admin-form-label">Nume *</label>
                  <input class="input" value={addForm().name}
                    onInput={(e) => setField(setAddForm, "name", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Username *</label>
                  <input class="input" value={addForm().username}
                    onInput={(e) => setField(setAddForm, "username", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Parola *</label>
                  <input class="input" type="password" value={addForm().password}
                    onInput={(e) => setField(setAddForm, "password", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Email</label>
                  <input class="input" value={addForm().email}
                    onInput={(e) => setField(setAddForm, "email", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Descriere</label>
                  <textarea class="input admin-textarea" value={addForm().description}
                    onInput={(e) => setField(setAddForm, "description", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row">
                  <label class="admin-form-label">Image URL</label>
                  <input class="input" value={addForm().image_url}
                    onInput={(e) => setField(setAddForm, "image_url", e.currentTarget.value)} />
                </div>
                <div class="admin-form-row admin-form-row--check">
                  <label class="admin-chk-label">
                    <input type="checkbox" checked={addForm().is_locked}
                      onChange={(e) => setField(setAddForm, "is_locked", e.currentTarget.checked)} />
                    Trial (is_locked)
                  </label>
                </div>
                <Show when={addForm().is_locked}>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Locked at</label>
                    <input class="input" type="datetime-local" value={addForm().locked_at}
                      onInput={(e) => setField(setAddForm, "locked_at", e.currentTarget.value)} />
                  </div>
                </Show>
                <Show when={addErr()}>
                  <p style="color:var(--danger);font-size:13px;margin:0">{addErr()}</p>
                </Show>
                <div class="sl-modal-footer">
                  <button type="button" class="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}>Anulează</button>
                  <button type="submit" class="btn btn-primary btn-sm" disabled={addSaving()}>
                    {addSaving() ? "Se salvează..." : "Creează"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        {/* ── Modal: Edit ───────────────────────────────────────────────── */}
        <Show when={editAccount()}>
          {(a) => (
            <div class="sl-modal-overlay" onClick={() => setEditAccount(null)}>
              <div class="admin-modal" onClick={(e) => e.stopPropagation()}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">Editează #{a().id} — {a().name}</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setEditAccount(null)}>✕</button>
                </div>
                <form onSubmit={doEdit} class="admin-modal-form">
                  <div class="admin-form-row">
                    <label class="admin-form-label">Nume *</label>
                    <input class="input" value={editForm().name}
                      onInput={(e) => setField(setEditForm, "name", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Username *</label>
                    <input class="input" value={editForm().username}
                      onInput={(e) => setField(setEditForm, "username", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Parola nouă (gol = neschimbat)</label>
                    <input class="input" type="password" value={editForm().password}
                      onInput={(e) => setField(setEditForm, "password", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Email</label>
                    <input class="input" value={editForm().email}
                      onInput={(e) => setField(setEditForm, "email", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Descriere</label>
                    <textarea class="input admin-textarea" value={editForm().description}
                      onInput={(e) => setField(setEditForm, "description", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row">
                    <label class="admin-form-label">Image URL</label>
                    <input class="input" value={editForm().image_url}
                      onInput={(e) => setField(setEditForm, "image_url", e.currentTarget.value)} />
                  </div>
                  <div class="admin-form-row admin-form-row--check">
                    <label class="admin-chk-label">
                      <input type="checkbox" checked={editForm().is_locked}
                        onChange={(e) => setField(setEditForm, "is_locked", e.currentTarget.checked)} />
                      Trial (is_locked)
                    </label>
                  </div>
                  <Show when={editForm().is_locked}>
                    <div class="admin-form-row">
                      <label class="admin-form-label">Locked at</label>
                      <input class="input" type="datetime-local" value={editForm().locked_at}
                        onInput={(e) => setField(setEditForm, "locked_at", e.currentTarget.value)} />
                    </div>
                  </Show>
                  <Show when={editErr()}>
                    <p style="color:var(--danger);font-size:13px;margin:0">{editErr()}</p>
                  </Show>
                  <div class="sl-modal-footer">
                    <button type="button" class="btn btn-ghost btn-sm" onClick={() => setEditAccount(null)}>Anulează</button>
                    <button type="submit" class="btn btn-primary btn-sm" disabled={editSaving()}>
                      {editSaving() ? "Se salvează..." : "Salvează"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Show>

        {/* ── Modal: Delete ─────────────────────────────────────────────── */}
        <Show when={deleteTarget()}>
          {(a) => (
            <div class="sl-modal-overlay" onClick={() => setDeleteTarget(null)}>
              <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">Șterge cont</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
                </div>
                <p style="margin:0;color:var(--text)">
                  Sigur vrei să ștergi contul <strong>{a().name}</strong> ({a().username})?
                </p>
                <div class="sl-modal-footer">
                  <button class="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>Anulează</button>
                  <button class="btn btn-danger btn-sm" onClick={doDelete} disabled={deleting()}>
                    {deleting() ? "..." : "Șterge"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>
    </Show>
  );
}
