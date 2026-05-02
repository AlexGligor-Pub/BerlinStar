import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { API_BASE } from "../utils/api";
import logo from "../assets/logo.png";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface HotelImages {
  hotel_cazare_image_path: string | null;
  hotel_scoatere_image_path: string | null;
  hotel_montare_image_path: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ro-RO") +
    " " +
    d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
  );
}

async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(API_BASE + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
}

async function compressToPng(file: File, maxBytes = 500_000): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const tryRender = () => {
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxBytes || w <= 200) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }));
            } else {
              w = Math.round(w * 0.75);
              h = Math.round(h * 0.75);
              tryRender();
            }
          },
          "image/png"
        );
      };
      tryRender();
    };
    img.src = url;
  });
}

// ── Image Upload Dialog ───────────────────────────────────────────────────────

function ImageUploadDialog(props: {
  title: string;
  currentUrl: string | null;
  endpoint: string;
  onSaved: (url: string) => void;
  onClose: () => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(props.currentUrl);
  const [pendingFile, setPendingFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [err, setErr] = createSignal("");

  let fileInput!: HTMLInputElement;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) { setErr("Selectează un fișier imagine."); return; }
    setErr("");
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function doUpload() {
    const file = pendingFile();
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const compressed = await compressToPng(file, 500_000);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch(API_BASE + props.endpoint, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr((d as any).detail ?? "Eroare la upload.");
        return;
      }
      const data = await res.json();
      props.onSaved(data.url);
      props.onClose();
    } catch {
      setErr("Eroare de conexiune.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div class="sl-modal-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="sl-modal adminv2-upload-modal">
        <div class="sl-modal-header">
          <span class="sl-modal-title">{props.title}</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>

        <div class="sl-modal-body">
          {/* Drag & drop zone */}
          <div
            class="hotel-upload-drop"
            classList={{ "hotel-upload-drop--active": dragging() }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer?.files ?? null); }}
            onClick={() => fileInput.click()}
          >
            <Show
              when={previewUrl()}
              fallback={
                <div class="hotel-upload-drop__placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 16l4-4 4 4 4-6 4 6" />
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                  </svg>
                  <span>Trage imaginea aici sau apasă pentru a alege</span>
                </div>
              }
            >
              <img src={previewUrl()!} class="hotel-upload-drop__preview" alt="preview" />
            </Show>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style="display:none"
            onChange={(e) => handleFiles(e.currentTarget.files)}
          />

          <button
            class="btn btn-ghost btn-sm"
            style="width:100%;margin-top:8px"
            onClick={() => fileInput.click()}
          >
            Alege fișier
          </button>

          <Show when={err()}>
            <p style="color:var(--danger);font-size:13px;margin:8px 0 0">{err()}</p>
          </Show>
        </div>

        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button
            class="btn btn-primary btn-sm"
            disabled={!pendingFile() || uploading()}
            onClick={doUpload}
          >
            {uploading() ? "Se încarcă..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hotel Anvelope Section ────────────────────────────────────────────────────

function HotelAnvelopeSection() {
  const [images, setImages] = createSignal<HotelImages>({
    hotel_cazare_image_path: null,
    hotel_scoatere_image_path: null,
    hotel_montare_image_path: null,
  });
  const [dialogType, setDialogType] = createSignal<"cazare" | "scoatere" | "montare" | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(API_BASE + "/api/global-settings/hotel-anvelope");
      if (res.ok) setImages(await res.json());
    } catch {}
  });

  return (
    <div>
      <div class="page-header" style="margin-bottom:24px">
        <h2 class="page-title" style="font-size:1.25rem">Hotel Anvelope — Imagini</h2>
      </div>

      <div class="hotel-img-grid">
        {/* Cazare Roti */}
        <div class="hotel-img-card" onClick={() => setDialogType("cazare")}>
          <div class="hotel-img-card__title">Cazare Roti</div>
          <Show
            when={images().hotel_cazare_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_cazare_image_path!}
              class="hotel-img-card__img"
              alt="Cazare Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>

        {/* Scoatere Roti */}
        <div class="hotel-img-card" onClick={() => setDialogType("scoatere")}>
          <div class="hotel-img-card__title">Scoatere Roti</div>
          <Show
            when={images().hotel_scoatere_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_scoatere_image_path!}
              class="hotel-img-card__img"
              alt="Scoatere Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>

        {/* Montare Roti */}
        <div class="hotel-img-card" onClick={() => setDialogType("montare")}>
          <div class="hotel-img-card__title">Montare Roti</div>
          <Show
            when={images().hotel_montare_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_montare_image_path!}
              class="hotel-img-card__img"
              alt="Montare Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Show when={dialogType() === "cazare"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Cazare Roti"
          currentUrl={images().hotel_cazare_image_path}
          endpoint="/api/global-settings/hotel-cazare-image"
          onSaved={(url) => setImages((prev) => ({ ...prev, hotel_cazare_image_path: url + "?t=" + Date.now() }))}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "scoatere"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Scoatere Roti"
          currentUrl={images().hotel_scoatere_image_path}
          endpoint="/api/global-settings/hotel-scoatere-image"
          onSaved={(url) => setImages((prev) => ({ ...prev, hotel_scoatere_image_path: url + "?t=" + Date.now() }))}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "montare"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Montare Roti"
          currentUrl={images().hotel_montare_image_path}
          endpoint="/api/global-settings/hotel-montare-image"
          onSaved={(url) => setImages((prev) => ({ ...prev, hotel_montare_image_path: url + "?t=" + Date.now() }))}
          onClose={() => setDialogType(null)}
        />
      </Show>
    </div>
  );
}

// ── Accounts Section ──────────────────────────────────────────────────────────

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

function AccountsSection() {
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
    setAddSaving(true); setAddErr("");
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(), username: f.username.trim(), password: btoa(f.password),
        email: f.email.trim() || null, description: f.description.trim() || null,
        image_url: f.image_url.trim() || null,
      };
      const res = await adminFetch("/api/accounts", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { setAddErr(((await res.json().catch(() => ({}))) as any).detail ?? "Eroare la salvare."); return; }
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
      if (f.password.trim()) patch.password = btoa(f.password.trim());
      const res = await adminFetch(`/api/accounts/${a.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (!res.ok) { setEditErr(((await res.json().catch(() => ({}))) as any).detail ?? "Eroare la salvare."); return; }
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
          <div class="sl-modal-overlay" onClick={(e) => e.target === e.currentTarget && closePreview()}>
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

// ── Main AdminV2 Page ─────────────────────────────────────────────────────────

type Section = "conturi" | "hotel";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "conturi", label: "Conturi", icon: "👥" },
  { id: "hotel", label: "Hotel Anvelope", icon: "🔧" },
];

export default function AdminV2() {
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
    } catch {
      setVerifyErr("Eroare de conexiune.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Layout state ─────────────────────────────────────────────────────────
  const [section, setSection] = createSignal<Section>("conturi");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  function selectSection(s: Section) {
    setSection(s);
    setSidebarOpen(false); // auto-close on mobile after selection
  }

  // ── Auth gate render ──────────────────────────────────────────────────────
  return (
    <Show
      when={verified()}
      fallback={
        <div class="login-page">
          <div class="login-card">
            <img src={logo} alt="Berlin Star" class="login-logo" />
            <div class="login-subtitle">Administrator</div>
            <div class="login-powered">Logare Administrator</div>

            <Show when={verifyErr()}>
              <div class="login-error">{verifyErr()}</div>
            </Show>

            <form onSubmit={doVerify} autocomplete="off">
              <div class="form-group">
                <label class="form-label">Parola 1</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={pass1()}
                  onInput={(e) => setPass1(e.currentTarget.value)}
                  autofocus
                />
              </div>
              <div class="form-group">
                <label class="form-label">Parola 2</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={pass2()}
                  onInput={(e) => setPass2(e.currentTarget.value)}
                />
              </div>
              <button class="btn btn-primary w-full mt-8" type="submit" disabled={verifying()}>
                {verifying() ? "Se verifică..." : "Intră în Admin"}
              </button>
            </form>
          </div>
        </div>
      }
    >
      <div class="adminv2-page">
        {/* Mobile header */}
        <div class="adminv2-mobile-header">
          <button
            class="btn btn-ghost btn-sm adminv2-hamburger"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span class="adminv2-mobile-title">
            {NAV_ITEMS.find((n) => n.id === section())?.label ?? "Admin"}
          </span>
        </div>

        <div class="adminv2-layout">
          {/* Sidebar overlay backdrop (mobile) */}
          <Show when={sidebarOpen()}>
            <div class="adminv2-backdrop" onClick={() => setSidebarOpen(false)} />
          </Show>

          {/* Sidebar */}
          <aside class="adminv2-sidebar" classList={{ "adminv2-sidebar--open": sidebarOpen() }}>
            <div class="adminv2-sidebar-header">
              <span class="adminv2-sidebar-title">BerlinStar Admin</span>
            </div>
            <nav class="adminv2-nav">
              <For each={NAV_ITEMS}>
                {(item) => (
                  <button
                    class="adminv2-nav-item"
                    classList={{ "adminv2-nav-item--active": section() === item.id }}
                    onClick={() => selectSection(item.id)}
                  >
                    <span class="adminv2-nav-item__icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )}
              </For>
            </nav>
          </aside>

          {/* Main content */}
          <main class="adminv2-content">
            <Show when={section() === "conturi"}>
              <AccountsSection />
            </Show>
            <Show when={section() === "hotel"}>
              <HotelAnvelopeSection />
            </Show>
          </main>
        </div>
      </div>
    </Show>
  );
}
