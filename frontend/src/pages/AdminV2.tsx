import { For, Show, createMemo, createSignal, onMount, createEffect } from "solid-js";
import { API_BASE } from "../utils/api";
import { invalidateHotelImages } from "../store/hotelAnvelopeStore";
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
  compress?: boolean;
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
      const toUpload = props.compress ? await compressToPng(file, 500_000) : file;
      const fd = new FormData();
      fd.append("file", toUpload);
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
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_cazare_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "scoatere"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Scoatere Roti"
          currentUrl={images().hotel_scoatere_image_path}
          endpoint="/api/global-settings/hotel-scoatere-image"
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_scoatere_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "montare"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Montare Roti"
          currentUrl={images().hotel_montare_image_path}
          endpoint="/api/global-settings/hotel-montare-image"
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_montare_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
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
    if (!f.email.trim()) {
      setAddErr("Emailul este obligatoriu.");
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

// ── Email Section ─────────────────────────────────────────────────────────────

interface SmtpSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_from_address: string;
  smtp_use_tls: boolean;
  smtp_enabled: boolean;
}

interface EmailTemplate {
  id: number;
  scenario: string;
  subject: string;
  title: string;
  body: string;
  enabled: boolean;
}

interface EmailLog {
  id: number;
  sent_at: string;
  account_id: number | null;
  to_address: string;
  scenario: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  body_html: string | null;
}

const SCENARIO_LABELS: Record<string, string> = {
  client_nou: "Client nou",
  reminder_plata: "Reminder plată",
};

const EMPTY_SMTP: SmtpSettings = {
  smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
  smtp_from_name: "", smtp_from_address: "", smtp_use_tls: true, smtp_enabled: false,
};

function EmailSection() {
  const [smtp, setSmtp] = createSignal<SmtpSettings>({ ...EMPTY_SMTP });
  const [smtpSaving, setSmtpSaving] = createSignal(false);
  const [smtpMsg, setSmtpMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  const [testTo, setTestTo] = createSignal("");
  const [testSubject, setTestSubject] = createSignal("Test email — BerlinStar");
  const [testBody, setTestBody] = createSignal(
    "<p>Acesta este un <strong>email de test</strong> trimis din BerlinStar.</p><p>Dacă îl primiți, configurația SMTP funcționează corect.</p>"
  );
  const [testPreview, setTestPreview] = createSignal(false);
  const [testSending, setTestSending] = createSignal(false);
  const [testMsg, setTestMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  const [tmplEdits, setTmplEdits] = createSignal<Record<string, EmailTemplate>>({});
  const [expandedScenario, setExpandedScenario] = createSignal<string | null>(null);
  const [tmplSaving, setTmplSaving] = createSignal<string | null>(null);
  const [tmplMsg, setTmplMsg] = createSignal<Record<string, { ok: boolean; text: string }>>({});
  const [previewScenarios, setPreviewScenarios] = createSignal<Record<string, boolean>>({});

  const [logs, setLogs] = createSignal<EmailLog[]>([]);
  const [logsAccounts, setLogsAccounts] = createSignal<Account[]>([]);
  const [filterAccountId, setFilterAccountId] = createSignal<number | null>(null);
  const [expandedLogId, setExpandedLogId] = createSignal<number | null>(null);
  const [openMenuId, setOpenMenuId] = createSignal<number | null>(null);
  const [viewLog, setViewLog] = createSignal<EmailLog | null>(null);
  const [resendingId, setResendingId] = createSignal<number | null>(null);
  const [resendMsg, setResendMsg] = createSignal<{ id: number; ok: boolean; text: string } | null>(null);

  onMount(async () => {
    try {
      const r = await adminFetch("/api/email-settings/smtp");
      if (r.ok) setSmtp(await r.json());
    } catch {}
    try {
      const r = await adminFetch("/api/email-settings/templates");
      if (r.ok) {
        const data: EmailTemplate[] = await r.json();
        const edits: Record<string, EmailTemplate> = {};
        for (const t of data) edits[t.scenario] = { ...t };
        setTmplEdits(edits);
      }
    } catch {}
    try {
      const r = await adminFetch("/api/accounts?limit=200&sort=id");
      if (r.ok) {
        const data: { items: Account[] } = await r.json();
        setLogsAccounts(data.items);
      }
    } catch {}
    loadLogs();
  });

  async function loadLogs() {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterAccountId() !== null) params.set("account_id", String(filterAccountId()));
      const r = await adminFetch(`/api/email-settings/logs?${params}`);
      if (r.ok) setLogs(await r.json());
    } catch {}
  }

  createEffect(() => {
    filterAccountId();
    loadLogs();
  });

  async function saveSmtp() {
    setSmtpSaving(true);
    setSmtpMsg(null);
    try {
      const r = await adminFetch("/api/email-settings/smtp", {
        method: "PATCH",
        body: JSON.stringify(smtp()),
      });
      if (r.ok) {
        setSmtpMsg({ ok: true, text: "Setări salvate." });
      } else {
        const d = await r.json().catch(() => ({}));
        setSmtpMsg({ ok: false, text: (d as any).detail ?? "Eroare la salvare." });
      }
    } catch {
      setSmtpMsg({ ok: false, text: "Eroare de conexiune." });
    } finally {
      setSmtpSaving(false);
    }
  }

  async function sendTest() {
    setTestSending(true);
    setTestMsg(null);
    try {
      const r = await adminFetch("/api/email-settings/test", {
        method: "POST",
        body: JSON.stringify({ to_address: testTo(), subject: testSubject() || undefined, body_html: testBody() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setTestMsg({ ok: true, text: (d as any).message ?? "Email trimis." });
        loadLogs();
      } else {
        setTestMsg({ ok: false, text: (d as any).detail ?? "Eroare la trimitere." });
        loadLogs();
      }
    } catch {
      setTestMsg({ ok: false, text: "Eroare de conexiune." });
    } finally {
      setTestSending(false);
    }
  }

  async function saveTemplate(scenario: string) {
    setTmplSaving(scenario);
    setTmplMsg((prev) => { const n = { ...prev }; delete n[scenario]; return n; });
    const edits = tmplEdits()[scenario];
    if (!edits) return;
    try {
      const r = await adminFetch(`/api/email-settings/templates/${scenario}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: edits.subject,
          title: edits.title,
          body: edits.body,
          enabled: edits.enabled,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setTmplEdits((prev) => ({ ...prev, [scenario]: { ...prev[scenario], ...(d as EmailTemplate) } }));
        setTmplMsg((prev) => ({ ...prev, [scenario]: { ok: true, text: "Template salvat." } }));
      } else {
        setTmplMsg((prev) => ({
          ...prev,
          [scenario]: { ok: false, text: (d as any).detail ?? "Eroare." },
        }));
      }
    } catch {
      setTmplMsg((prev) => ({ ...prev, [scenario]: { ok: false, text: "Eroare de conexiune." } }));
    } finally {
      setTmplSaving(null);
    }
  }

  async function resendEmail(log: EmailLog) {
    setResendingId(log.id);
    setResendMsg(null);
    setOpenMenuId(null);
    try {
      const r = await adminFetch(`/api/email-settings/logs/${log.id}/resend`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setResendMsg({ id: log.id, ok: true, text: "Email retrims cu succes." });
        loadLogs();
      } else {
        setResendMsg({ id: log.id, ok: false, text: (d as any).detail ?? "Eroare la retrimitere." });
      }
    } catch {
      setResendMsg({ id: log.id, ok: false, text: "Eroare de conexiune." });
    } finally {
      setResendingId(null);
    }
  }

  function setSmtpField<K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) {
    setSmtp((prev) => ({ ...prev, [key]: value }));
  }

  function setTmplField(scenario: string, key: keyof EmailTemplate, value: any) {
    setTmplEdits((prev) => ({
      ...prev,
      [scenario]: { ...(prev[scenario] ?? {}), [key]: value } as EmailTemplate,
    }));
  }

  const VARIABLE_HINT = "{client_name}, {company_name}, {amount}, {factura_nr}, {expiry_date}, {vehicle_plate}";

  return (
    <div>
      <div class="page-header" style="margin-bottom:24px">
        <h2 class="page-title" style="font-size:1.25rem">Email</h2>
      </div>

      {/* ── SMTP Config ── */}
      <div class="card" style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px">Configurare SMTP</h3>

        <div class="admin-form-row" style="margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
            <input type="checkbox" checked={smtp().smtp_enabled}
              onChange={(e) => setSmtpField("smtp_enabled", e.currentTarget.checked)} />
            Activat
          </label>
        </div>

        <div class="admin-form-row">
          <label class="admin-form-label">Host SMTP</label>
          <input class="input" placeholder="mail.domain.com" value={smtp().smtp_host}
            onInput={(e) => setSmtpField("smtp_host", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Port</label>
          <input class="input" type="number" value={smtp().smtp_port}
            onInput={(e) => setSmtpField("smtp_port", parseInt(e.currentTarget.value) || 587)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Utilizator SMTP</label>
          <input class="input" value={smtp().smtp_user}
            onInput={(e) => setSmtpField("smtp_user", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Parolă SMTP</label>
          <input class="input" type="password" placeholder="(gol = neschimbat)"
            value={smtp().smtp_password}
            onInput={(e) => setSmtpField("smtp_password", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Nume expeditor</label>
          <input class="input" value={smtp().smtp_from_name}
            onInput={(e) => setSmtpField("smtp_from_name", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Adresă expeditor</label>
          <input class="input" type="email" value={smtp().smtp_from_address}
            onInput={(e) => setSmtpField("smtp_from_address", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row" style="margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
            <input type="checkbox" checked={smtp().smtp_use_tls}
              onChange={(e) => setSmtpField("smtp_use_tls", e.currentTarget.checked)} />
            Folosește STARTTLS (port 587) — dezactivat = SSL direct (port 465)
          </label>
        </div>

        <Show when={smtpMsg()}>
          {(msg) => (
            <p style={`font-size:13px;margin-bottom:8px;color:var(--${msg().ok ? "success" : "danger"})`}>
              {msg().text}
            </p>
          )}
        </Show>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" disabled={smtpSaving()} onClick={saveSmtp}>
            {smtpSaving() ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>

      {/* ── Test email ── */}
      <div class="card" style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px">Testează trimiterea</h3>
        <div class="admin-form-row" style="margin-bottom:12px">
          <label class="admin-form-label">Adresă destinatar test</label>
          <input class="input" type="email" placeholder="test@example.com"
            value={testTo()} onInput={(e) => setTestTo(e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Subiect</label>
          <input class="input" value={testSubject()}
            onInput={(e) => setTestSubject(e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="admin-form-label" style="margin-bottom:0">Conținut HTML</label>
            <button
              class="btn btn-ghost btn-sm"
              style="font-size:0.78rem;padding:2px 10px"
              onClick={() => setTestPreview((v) => !v)}
            >
              {testPreview() ? "✏️ Editează" : "👁 Preview"}
            </button>
          </div>
          <Show
            when={testPreview()}
            fallback={
              <textarea
                class="input admin-textarea"
                style="min-height:140px;font-family:monospace;font-size:0.82rem"
                value={testBody()}
                onInput={(e) => setTestBody(e.currentTarget.value)}
              />
            }
          >
            <iframe
              srcdoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;margin:0;color:#222;font-size:14px;line-height:1.6}</style></head><body>${testBody()}</body></html>`}
              style="width:100%;min-height:140px;border:1px solid var(--border);border-radius:6px;background:#fff;display:block"
              sandbox=""
            />
          </Show>
        </div>
        <Show when={testMsg()}>
          {(msg) => (
            <p style={`font-size:13px;margin-bottom:8px;color:var(--${msg().ok ? "success" : "danger"})`}>
              {msg().text}
            </p>
          )}
        </Show>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" disabled={testSending() || !testTo().includes("@")}
            onClick={sendTest}>
            {testSending() ? "Se trimite..." : "Trimite email test"}
          </button>
        </div>
      </div>

      {/* ── Template-uri ── */}
      <div style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:8px">Template-uri email</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">
          Variabile disponibile în subiect și conținut:&nbsp;
          <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:0.78rem">
            {VARIABLE_HINT}
          </code>
        </p>

        <For each={["client_nou", "reminder_plata"]}>
          {(scenario) => {
            const tmpl = () => tmplEdits()[scenario];
            const isExpanded = () => expandedScenario() === scenario;
            const msg = () => tmplMsg()[scenario];
            const isPreview = () => previewScenarios()[scenario] ?? false;

            return (
              <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden">
                <button
                  style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:none;border:none;cursor:pointer;text-align:left"
                  onClick={() => setExpandedScenario(isExpanded() ? null : scenario)}
                >
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:0.9rem;font-weight:600;color:var(--text)">
                      {SCENARIO_LABELS[scenario] ?? scenario}
                    </span>
                    <Show when={tmpl()?.enabled}>
                      <span class="admin-badge admin-badge--active" style="font-size:0.7rem">Activ</span>
                    </Show>
                    <Show when={tmpl() && !tmpl()!.enabled}>
                      <span class="admin-badge admin-badge--deleted" style="font-size:0.7rem">Inactiv</span>
                    </Show>
                  </div>
                  <span style="color:var(--text-muted);font-size:0.75rem">{isExpanded() ? "▲" : "▼"}</span>
                </button>

                <Show when={isExpanded()}>
                  <div style="padding:0 16px 16px;border-top:1px solid var(--border)">
                    <div class="admin-form-row" style="margin-top:12px">
                      <label class="admin-form-label">Subiect</label>
                      <input class="input" value={tmpl()?.subject ?? ""}
                        onInput={(e) => setTmplField(scenario, "subject", e.currentTarget.value)} />
                    </div>
                    <div class="admin-form-row">
                      <label class="admin-form-label">Titlu (heading în email)</label>
                      <input class="input" value={tmpl()?.title ?? ""}
                        onInput={(e) => setTmplField(scenario, "title", e.currentTarget.value)} />
                    </div>
                    <div class="admin-form-row">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                        <label class="admin-form-label" style="margin-bottom:0">Conținut HTML</label>
                        <button
                          class="btn btn-ghost btn-sm"
                          style="font-size:0.78rem;padding:2px 10px"
                          onClick={() => setPreviewScenarios((prev) => ({ ...prev, [scenario]: !prev[scenario] }))}
                        >
                          {isPreview() ? "✏️ Editează" : "👁 Preview"}
                        </button>
                      </div>
                      <Show
                        when={isPreview()}
                        fallback={
                          <textarea
                            class="input admin-textarea"
                            style="min-height:200px;font-family:monospace;font-size:0.82rem"
                            value={tmpl()?.body ?? ""}
                            onInput={(e) => setTmplField(scenario, "body", e.currentTarget.value)}
                          />
                        }
                      >
                        <iframe
                          srcdoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;margin:0;color:#222;font-size:14px;line-height:1.6}</style></head><body>${tmpl()?.body ?? ""}</body></html>`}
                          style="width:100%;min-height:200px;border:1px solid var(--border);border-radius:6px;background:#fff;display:block"
                          sandbox=""
                        />
                      </Show>
                    </div>
                    <div class="admin-form-row" style="margin-bottom:12px">
                      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
                        <input type="checkbox" checked={tmpl()?.enabled ?? false}
                          onChange={(e) => setTmplField(scenario, "enabled", e.currentTarget.checked)} />
                        Activat
                      </label>
                    </div>
                    <Show when={msg()}>
                      {(m) => (
                        <p style={`font-size:13px;margin-bottom:8px;color:var(--${m().ok ? "success" : "danger"})`}>
                          {m().text}
                        </p>
                      )}
                    </Show>
                    <div style="display:flex;justify-content:flex-end">
                      <button class="btn btn-primary btn-sm"
                        disabled={tmplSaving() === scenario}
                        onClick={() => saveTemplate(scenario)}>
                        {tmplSaving() === scenario ? "Se salvează..." : "Salvează template"}
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* ── Istoric emailuri ── */}
      <div style="max-width:900px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3 style="font-size:0.95rem;font-weight:600">Istoric emailuri trimise</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <select
              class="input"
              style="width:auto;font-size:0.85rem;padding:4px 8px"
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFilterAccountId(v === "" ? null : parseInt(v));
              }}
            >
              <option value="">Toate conturile</option>
              <For each={logsAccounts()}>
                {(acc) => <option value={acc.id}>{acc.name}</option>}
              </For>
            </select>
            <button class="btn btn-ghost btn-sm" onClick={loadLogs}>↻ Refresh</button>
          </div>
        </div>

        <Show
          when={logs().length > 0}
          fallback={<p style="color:var(--text-muted);font-size:0.875rem">Niciun email trimis încă.</p>}
        >
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border)">
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Data/ora</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Cont</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Destinatar</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Scenariu</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Subiect</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Status</th>
                  <th style="padding:6px 10px" />
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log) => {
                    const isErr = log.status === "error";
                    const accountName = () => {
                      if (log.account_id === null) return "Admin";
                      return logsAccounts().find((a) => a.id === log.account_id)?.name ?? `#${log.account_id}`;
                    };
                    const isExpanded = () => expandedLogId() === log.id;
                    const menuOpen = () => openMenuId() === log.id;

                    return (
                      <>
                        <tr
                          style={`border-bottom:1px solid var(--border);cursor:${isErr ? "pointer" : "default"};background:${isErr ? "rgba(var(--danger-rgb,220,53,69),0.04)" : "transparent"}`}
                          onClick={() => isErr && setExpandedLogId(isExpanded() ? null : log.id)}
                        >
                          <td style="padding:6px 10px;white-space:nowrap;color:var(--text-muted)">{fmtDate(log.sent_at)}</td>
                          <td style="padding:6px 10px;white-space:nowrap">{accountName()}</td>
                          <td style="padding:6px 10px;white-space:nowrap">{log.to_address}</td>
                          <td style="padding:6px 10px;white-space:nowrap">
                            {log.scenario ? (SCENARIO_LABELS[log.scenario] ?? log.scenario) : "Test"}
                          </td>
                          <td style="padding:6px 10px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                            title={log.subject}>{log.subject}</td>
                          <td style="padding:6px 10px">
                            <Show
                              when={isErr}
                              fallback={<span class="admin-badge admin-badge--active" style="font-size:0.7rem">OK</span>}
                            >
                              <span class="admin-badge admin-badge--deleted" style="font-size:0.7rem">Eroare {isErr ? "▾" : ""}</span>
                            </Show>
                          </td>
                          <td style="padding:4px 8px;position:relative">
                            <button
                              class="btn btn-ghost btn-sm"
                              style="padding:2px 8px;font-size:1.1rem;line-height:1"
                              onClick={() => setOpenMenuId(menuOpen() ? null : log.id)}
                              title="Acțiuni"
                            >⋮</button>
                            <Show when={menuOpen()}>
                              <div style="position:absolute;right:4px;top:calc(100% + 2px);z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.25);min-width:180px;overflow:hidden">
                                <button
                                  style="display:block;width:100%;text-align:left;padding:9px 14px;background:var(--surface);border:none;cursor:pointer;font-size:0.84rem;color:var(--text)"
                                  onClick={() => { setViewLog(log); setOpenMenuId(null); }}
                                >Vizualizare email</button>
                                <button
                                  style="display:block;width:100%;text-align:left;padding:9px 14px;background:var(--surface);border:none;border-top:1px solid var(--border);cursor:pointer;font-size:0.84rem;color:var(--text)"
                                  onClick={() => resendEmail(log)}
                                  disabled={resendingId() === log.id}
                                >{resendingId() === log.id ? "Se trimite..." : "Retrimitere"}</button>
                              </div>
                            </Show>
                            <Show when={resendMsg()?.id === log.id}>
                              <span style={`font-size:0.72rem;display:block;white-space:nowrap;color:${resendMsg()?.ok ? "var(--success)" : "var(--danger)"}`}>
                                {resendMsg()?.text}
                              </span>
                            </Show>
                          </td>
                        </tr>
                        <Show when={isExpanded() && isErr}>
                          <tr style="background:rgba(var(--danger-rgb,220,53,69),0.04)">
                            <td colspan="7" style="padding:6px 10px 10px 10px;font-size:0.78rem;color:var(--danger)">
                              {log.error_message ?? "Eroare necunoscută"}
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
        </Show>
      </div>

      {/* overlay pentru închidere meniu dropdown */}
      <Show when={openMenuId() !== null}>
        <div style="position:fixed;inset:0;z-index:199" onClick={() => setOpenMenuId(null)} />
      </Show>

      {/* ── Vizualizare email modal ── */}
      <Show when={viewLog() !== null}>
        {(_) => {
          const log = viewLog()!;
          const accountName = log.account_id === null
            ? "Admin"
            : (logsAccounts().find((a) => a.id === log.account_id)?.name ?? `#${log.account_id}`);
          return (
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px">
              <div class="card" style="width:100%;max-width:720px;max-height:88vh;overflow-y:auto;padding:24px;position:relative">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                  <h3 style="font-size:1rem;font-weight:600;margin:0">Vizualizare email</h3>
                  <button class="btn btn-ghost btn-sm" onClick={() => setViewLog(null)}>✕ Închide</button>
                </div>
                <div style="display:grid;grid-template-columns:max-content 1fr;gap:6px 12px;font-size:0.85rem;margin-bottom:16px">
                  <span style="color:var(--text-muted)">Data/ora</span><span>{fmtDate(log.sent_at)}</span>
                  <span style="color:var(--text-muted)">Cont</span><span>{accountName}</span>
                  <span style="color:var(--text-muted)">Destinatar</span><span>{log.to_address}</span>
                  <span style="color:var(--text-muted)">Scenariu</span>
                  <span>{log.scenario ? (SCENARIO_LABELS[log.scenario] ?? log.scenario) : "Test"}</span>
                  <span style="color:var(--text-muted)">Subiect</span><span>{log.subject}</span>
                  <span style="color:var(--text-muted)">Status</span>
                  <span>
                    <Show
                      when={log.status === "error"}
                      fallback={<span class="admin-badge admin-badge--active" style="font-size:0.75rem">OK</span>}
                    >
                      <span class="admin-badge admin-badge--deleted" style="font-size:0.75rem">Eroare</span>
                    </Show>
                  </span>
                  <Show when={log.error_message}>
                    <span style="color:var(--text-muted)">Eroare</span>
                    <span style="color:var(--danger);font-size:0.8rem">{log.error_message}</span>
                  </Show>
                </div>
                <Show
                  when={log.body_html}
                  fallback={<p style="color:var(--text-muted);font-size:0.85rem">Conținutul emailului nu a fost salvat.</p>}
                >
                  <div style="margin-bottom:8px;font-size:0.8rem;font-weight:600;color:var(--text-muted)">Conținut email</div>
                  <iframe
                    sandbox=""
                    srcdoc={log.body_html!}
                    style="width:100%;min-height:320px;border:1px solid var(--border);border-radius:6px;background:#fff"
                  />
                </Show>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
}

// ── Main AdminV2 Page ─────────────────────────────────────────────────────────

type Section = "conturi" | "hotel" | "email";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "conturi", label: "Conturi", icon: "👥" },
  { id: "hotel", label: "Hotel Anvelope", icon: "🔧" },
  { id: "email", label: "Email", icon: "✉️" },
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
            <Show when={section() === "email"}>
              <EmailSection />
            </Show>
          </main>
        </div>
      </div>
    </Show>
  );
}
