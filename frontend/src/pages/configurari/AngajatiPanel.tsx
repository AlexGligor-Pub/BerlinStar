import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch, apiUpload } from "../../utils/api";
import type { EmployeeItem } from "./types";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function AngajatiPanel() {
  const [items, setItems]     = createSignal<EmployeeItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editTarget, setEditTarget]       = createSignal("");
  const [editVacationDays, setEditVacationDays] = createSignal("21");
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  const [imageUploading, setImageUploading] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;

  const [addMode, setAddMode]     = createSignal(false);
  const [newName, setNewName]     = createSignal("");
  const [newDesc, setNewDesc]     = createSignal("");
  const [newTarget, setNewTarget] = createSignal("0");
  const [newVacationDays, setNewVacationDays] = createSignal("21");

  const [deleteTarget, setDeleteTarget] = createSignal<EmployeeItem | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? items().filter(e => e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q)) : items();
  });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/employees?limit=200&sort=name");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items.map((e: any) => ({
        id: e.id,
        name: e.name,
        description: e.description ?? null,
        target: e.target,
        image_path: e.image_path ?? null,
        annual_vacation_days: e.annual_vacation_days ?? 21,
      })));
    } catch {
      setError("Eroare la încărcare.");
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  function startEdit(e: EmployeeItem) {
    setEditId(e.id);
    setEditName(e.name);
    setEditDesc(e.description ?? "");
    setEditTarget(e.target);
    setEditVacationDays(String(e.annual_vacation_days ?? 21));
    setEditImagePath(e.image_path ?? null);
    setAddMode(false);
    setError(null);
  }

  async function handleImageFile(file: File) {
    const id = editId();
    if (!id) return;
    setImageUploading(true);
    setError(null);
    try {
      const compressed = await compressToPng(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await apiUpload(`/api/employees/${id}/image`, fd);
      if (!res.ok) throw new Error("Eroare la upload imagine.");
      const updated = await res.json() as { image_path: string | null };
      setEditImagePath(updated.image_path ?? null);
      setItems(items().map(e => e.id === id ? { ...e, image_path: updated.image_path ?? null } : e));
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
      const res = await apiFetch(`/api/employees/${editId()}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName().trim(),
          description: editDesc().trim() || null,
          target: parseFloat(editTarget()) || 0,
          annual_vacation_days: Math.max(0, Math.min(365, parseInt(editVacationDays(), 10) || 0)),
        }),
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
    const e = deleteTarget();
    if (!e) return;
    setSaving(true);
    setError(null);
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/employees/${e.id}`, { method: "DELETE" });
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
      const res = await apiFetch("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: newName().trim(),
          description: newDesc().trim() || null,
          target: parseFloat(newTarget()) || 0,
          annual_vacation_days: Math.max(0, Math.min(365, parseInt(newVacationDays(), 10) || 21)),
        }),
      });
      if (!res.ok) throw new Error();
      setNewName(""); setNewDesc(""); setNewTarget("0"); setNewVacationDays("21"); setAddMode(false);
      await load();
    } catch {
      setError("Eroare la adăugare.");
    } finally {
      setSaving(false);
    }
  }

  function doExportCSV() {
    exportCSV("Angajati", ["#", "Nume", "Descriere", "Target lunar"],
      filtered().map((e, i) => [String(i + 1), e.name, e.description ?? "", e.target]));
  }
  function doExportPDF() {
    exportPDF("Angajați", ["#", "Nume", "Descriere", "Target lunar"],
      filtered().map((e, i) => [String(i + 1), e.name, e.description ?? "", e.target]));
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
        <h2 class="cfg-panel-title">Angajați</h2>
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
            <div class="cfg-field-row">
              <label>Nume *</label>
              <input class="input" placeholder="Nume" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
            </div>
            <div class="cfg-field-row">
              <label>Descriere</label>
              <input class="input" placeholder="Opțional" value={newDesc()} onInput={(e) => setNewDesc(e.currentTarget.value)} />
            </div>
            <div class="cfg-field-row">
              <label>Target lunar</label>
              <input class="input" type="number" placeholder="0 = fără" value={newTarget()} onInput={(e) => setNewTarget(e.currentTarget.value)} />
            </div>
            <div class="cfg-field-row">
              <label>Zile concediu / an</label>
              <input class="input" type="number" min="0" max="365" placeholder="21" value={newVacationDays()} onInput={(e) => setNewVacationDays(e.currentTarget.value)} />
            </div>
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
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există angajați. Apasă \"+ Adaugă\" pentru a crea unul."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(e) => (
            <Show
              when={editId() === e.id}
              fallback={
                <div class="cfg-location-row">
                  <Show
                    when={e.image_path}
                    fallback={
                      <div class="cfg-employee-avatar cfg-employee-avatar--sm cfg-employee-avatar--placeholder">
                        {e.name.charAt(0).toUpperCase()}
                      </div>
                    }
                  >
                    <img src={e.image_path!} class="cfg-employee-avatar cfg-employee-avatar--sm" alt="avatar" />
                  </Show>
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{e.name}</span>
                    <Show when={e.description}>
                      <span class="cfg-location-desc">{e.description}</span>
                    </Show>
                    <span class="cfg-location-desc">🏖 {e.annual_vacation_days ?? 21} zile concediu/an</span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(e)}>Editează</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields">
                  <div class="cfg-employee-image-row">
                    <Show
                      when={editImagePath()}
                      fallback={
                        <div class="cfg-employee-avatar cfg-employee-avatar--placeholder">
                          {editName().trim().charAt(0).toUpperCase() || "?"}
                        </div>
                      }
                    >
                      <img src={editImagePath()!} class="cfg-employee-avatar" alt="avatar" />
                    </Show>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style="display:none"
                      onChange={(ev) => {
                        const f = ev.currentTarget.files?.[0];
                        if (f) handleImageFile(f);
                        ev.currentTarget.value = "";
                      }}
                    />
                    <button
                      class="btn btn-sm btn-ghost"
                      disabled={imageUploading()}
                      onClick={() => fileInputRef?.click()}
                    >
                      {imageUploading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
                    </button>
                  </div>
                  <div class="cfg-field-row">
                    <label>Nume *</label>
                    <input class="input" placeholder="Nume" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  </div>
                  <div class="cfg-field-row">
                    <label>Descriere</label>
                    <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                  </div>
                  <div class="cfg-field-row">
                    <label>Target lunar</label>
                    <input class="input" type="number" placeholder="Target lunar" value={editTarget()} onInput={(e) => setEditTarget(e.currentTarget.value)} />
                  </div>
                  <div class="cfg-field-row">
                    <label>Zile concediu / an</label>
                    <input class="input" type="number" min="0" max="365" placeholder="Zile concediu" value={editVacationDays()} onInput={(e) => setEditVacationDays(e.currentTarget.value)} />
                  </div>
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(e)}>Șterge</button>
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
