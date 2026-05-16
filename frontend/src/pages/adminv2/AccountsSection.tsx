import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { readJsonSafe } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";
import type { Account } from "./types";

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

function statusLabel(a: Account) {
  if (a.is_deleted) return { text: "Sters", cls: "admin-badge admin-badge--deleted" };
  if (a.is_locked) return { text: "Trial", cls: "admin-badge admin-badge--trial" };
  return { text: "Activ", cls: "admin-badge admin-badge--active" };
}


export default function AccountsSection() {
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
      if (reset) setAccounts(data.items);
      else setAccounts((prev) => [...prev, ...data.items]);
      setHasMore(data.next_cursor !== null);
      setLastId(data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => loadAccounts());

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

  const [editForm, setEditForm] = createSignal<FormState>(emptyForm());
  const [editErr, setEditErr] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);

  const [deleteConfirmInput, setDeleteConfirmInput] = createSignal("");
  const [deleting, setDeleting] = createSignal(false);

  function openPreview(a: Account) {
    setPreviewAccount(a);
    setPreviewMode("view");
    setDeleteConfirmInput("");
    setEditErr("");
  }

  function closePreview() {
    setPreviewAccount(null);
    setPreviewMode("view");
    setDeleteConfirmInput("");
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
    setEditSaving(true); setEditErr("");
    try {
      const patch: Record<string, unknown> = {
        name: f.name.trim(), username: f.username.trim(),
        email: f.email.trim() || null, description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
        is_locked: f.is_locked, locked_at: f.locked_at ? new Date(f.locked_at).toISOString() : null,
      };
      if (f.password.trim()) patch.password = f.password.trim();
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
          <button class="btn btn-sm btn-primary" onClick={openAdd}>+ Cont nou</button>
        </div>
      </div>

      {/* Cards grid */}
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
          <div class="account-card-grid">
            <For each={filtered()}>
              {(a) => {
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
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Cont nou</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <form onSubmit={doAdd} style="display:contents">
              <div class="admin-modal-body">
                <div class="admin-form-row"><label class="admin-form-label">Nume *</label>
                  <input class="input" value={addForm().name} onInput={(e) => setField(setAddForm, "name", e.currentTarget.value)} /></div>
                <div class="admin-form-row"><label class="admin-form-label">Username *</label>
                  <input class="input" value={addForm().username} onInput={(e) => setField(setAddForm, "username", e.currentTarget.value)} /></div>
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
          </div>
        </div>
      </Show>

      {/* Modal: Preview / Edit / Delete */}
      <Show when={previewAccount()}>
        {(a) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal">

              {/* ── View mode ── */}
              <Show when={previewMode() === "view"}>
                <div class="sl-modal-header">
                  <span class="sl-modal-title">#{a().id} — {a().name}</span>
                  <button class="btn btn-ghost btn-sm" onClick={closePreview}>✕</button>
                </div>
                <div class="admin-modal-body">
                  <div class="admin-preview-grid">
                    <span class="admin-form-label">Nume</span><span>{a().name}</span>
                    <span class="admin-form-label">Username</span><span>{a().username}</span>
                    <span class="admin-form-label">Email</span><span>{a().email ?? "—"}</span>
                    <span class="admin-form-label">Status</span>
                    <span><span class={statusLabel(a()).cls}>{statusLabel(a()).text}</span></span>
                    <span class="admin-form-label">Trial expiră</span><span>{fmtDate(a().locked_at)}</span>
                    <span class="admin-form-label">Creat</span><span>{fmtDate(a().created_at)}</span>
                    <span class="admin-form-label">Modificat</span><span>{fmtDate(a().updated_at)}</span>
                    <Show when={a().description}>
                      <span class="admin-form-label">Descriere</span><span>{a().description}</span>
                    </Show>
                    <Show when={a().image_url}>
                      <span class="admin-form-label">Image URL</span>
                      <span style="word-break:break-all;font-size:12px">{a().image_url}</span>
                    </Show>
                  </div>
                </div>
                <div class="sl-modal-footer">
                  <button class="btn btn-danger btn-sm" onClick={() => { setDeleteConfirmInput(""); setPreviewMode("delete"); }}>
                    Șterge
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
                      <input class="input" value={editForm().username} onInput={(e) => setField(setEditForm, "username", e.currentTarget.value)} /></div>
                    <div class="admin-form-row"><label class="admin-form-label">Parola nouă (gol = neschimbat)</label>
                      <input class="input" type="password" value={editForm().password} onInput={(e) => setField(setEditForm, "password", e.currentTarget.value)} /></div>
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
    </div>
  );
}
