import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch, apiUpload } from "../../utils/api";
import type { Department } from "./types";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function DepartamentePanel() {
  const [items, setItems]     = createSignal<Department[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  const [imageUploading, setImageUploading] = createSignal(false);
  let deptFileInputRef: HTMLInputElement | undefined;

  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  const [deleteTarget, setDeleteTarget] = createSignal<Department | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? items().filter(d => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)) : items();
  });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/departments?limit=200");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("Eroare la încărcare.");
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditName(d.name);
    setEditDesc(d.description ?? "");
    setEditImagePath(d.image_path ?? null);
    setAddMode(false);
    setError(null);
  }

  async function handleDeptImageFile(file: File) {
    const id = editId();
    if (!id) return;
    setImageUploading(true);
    setError(null);
    try {
      const compressed = await compressToPng(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await apiUpload(`/api/departments/${id}/image`, fd);
      if (!res.ok) throw new Error("Eroare la upload imagine.");
      const updated = await res.json() as { image_path: string | null };
      setEditImagePath(updated.image_path ?? null);
      setItems(items().map(dep => dep.id === id ? { ...dep, image_path: updated.image_path ?? null } : dep));
    } catch (ex: any) {
      setError(ex?.message ?? "Eroare la upload.");
    } finally {
      setImageUploading(false);
    }
  }

  async function saveEdit() {
    if (!editName().trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/departments/${editId()}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName().trim(), description: editDesc().trim() || null }),
      });
      if (!res.ok) throw new Error();
      setEditId(null);
      await load();
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const d = deleteTarget();
    if (!d) return;
    setSaving(true);
    setError(null);
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/departments/${d.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Eroare la ștergere.");
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!newName().trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/departments", {
        method: "POST",
        body: JSON.stringify({ name: newName().trim(), description: newDesc().trim() || null }),
      });
      if (!res.ok) throw new Error();
      setNewName(""); setNewDesc(""); setAddMode(false);
      await load();
    } catch {
      setError("Eroare la adăugare.");
    } finally {
      setSaving(false);
    }
  }

  function doExportCSV() {
    exportCSV("Departamente", ["#", "Nume", "Descriere"],
      filtered().map((d, i) => [String(i + 1), d.name, d.description ?? ""]));
  }
  function doExportPDF() {
    exportPDF("Departamente", ["#", "Nume", "Descriere"],
      filtered().map((d, i) => [String(i + 1), d.name, d.description ?? ""]));
  }

  return (
    <div class="cfg-panel">
      <Show when={deleteTarget()}>
        <DeleteModal
          label={deleteTarget()!.name}
          saving={saving()}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Show>

      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Departamente</h2>
        <input class="input cfg-search" placeholder="Caută..." value={search()} onInput={e => setSearch(e.currentTarget.value)} />
        <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
        <button class="btn btn-sm btn-primary" onClick={() => { setAddMode(true); setEditId(null); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}>
        <p class="cfg-error">{error()}</p>
      </Show>

      <Show when={addMode()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <div class="cfg-location-fields">
            <input class="input" placeholder="Nume departament *" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
            <input class="input" placeholder="Descriere (opțional)" value={newDesc()} onInput={(e) => setNewDesc(e.currentTarget.value)} />
          </div>
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !newName().trim()} onClick={addItem}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>
      <Show when={!loading() && filtered().length === 0}>
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există departamente. Apasă \"+ Adaugă\" pentru a crea unul."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(d) => (
            <Show
              when={editId() === d.id}
              fallback={
                <div class="cfg-location-row">
                  <Show
                    when={d.image_path}
                    fallback={<div class="cfg-employee-avatar cfg-employee-avatar--sm cfg-employee-avatar--placeholder">{d.name.charAt(0).toUpperCase()}</div>}
                  >
                    <img src={d.image_path!} class="cfg-employee-avatar cfg-employee-avatar--sm" alt="avatar" />
                  </Show>
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{d.name}</span>
                    <Show when={d.description}>
                      <span class="cfg-location-desc">{d.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(d)}>Editează</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields">
                  <div class="cfg-employee-image-row">
                    <Show
                      when={editImagePath()}
                      fallback={<div class="cfg-employee-avatar cfg-employee-avatar--placeholder">{editName().trim().charAt(0).toUpperCase() || "?"}</div>}
                    >
                      <img src={editImagePath()!} class="cfg-employee-avatar" alt="avatar" />
                    </Show>
                    <input ref={deptFileInputRef} type="file" accept="image/*" style="display:none"
                      onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) handleDeptImageFile(f); ev.currentTarget.value = ""; }}
                    />
                    <button class="btn btn-sm btn-ghost" disabled={imageUploading()} onClick={() => deptFileInputRef?.click()}>
                      {imageUploading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
                    </button>
                  </div>
                  <input class="input" placeholder="Nume *" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(d)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editName().trim()} onClick={saveEdit}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
