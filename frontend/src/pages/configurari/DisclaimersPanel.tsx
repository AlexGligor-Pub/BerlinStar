import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch } from "../../utils/api";
import { exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

interface DisclaimerItem { id: number; title: string; text: string; }

export default function DisclaimersPanel() {
  const [items, setItems]     = createSignal<DisclaimerItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]       = createSignal<number | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editText, setEditText]   = createSignal("");
  const [addOpen, setAddOpen]     = createSignal(false);
  const [addTitle, setAddTitle]   = createSignal("");
  const [addText, setAddText]     = createSignal("");
  const [deleteTarget, setDeleteTarget] = createSignal<DisclaimerItem | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? items().filter(d => d.title.toLowerCase().includes(q) || d.text.toLowerCase().includes(q)) : items();
  });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/disclaimers?limit=200");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((data.items ?? []).map((d: any) => ({ id: d.id, title: d.title, text: d.text })));
    } catch {
      setError("Eroare la încărcare.");
    } finally { setLoading(false); }
  }

  onMount(load);

  function startEdit(d: DisclaimerItem) {
    setEditId(d.id); setEditTitle(d.title); setEditText(d.text);
    setAddOpen(false); setError(null);
  }
  function cancelEdit() { setEditId(null); setEditTitle(""); setEditText(""); }

  async function saveEdit(id: number) {
    if (!editTitle().trim()) return;
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/disclaimers/${id}`, { method: "PATCH", body: JSON.stringify({ title: editTitle().trim(), text: editText().trim() }) });
      setItems(items().map(d => d.id === id ? { ...d, title: editTitle().trim(), text: editText().trim() } : d));
      cancelEdit();
    } catch {
      setError("Eroare la salvare.");
    } finally { setSaving(false); }
  }

  async function saveAdd() {
    if (!addTitle().trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/disclaimers", { method: "POST", body: JSON.stringify({ title: addTitle().trim(), text: addText().trim() }) });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setItems([...items(), { id: created.id, title: created.title, text: created.text }]);
      setAddTitle(""); setAddText(""); setAddOpen(false);
    } catch {
      setError("Eroare la adăugare.");
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    const d = deleteTarget();
    if (!d) return;
    setSaving(true); setError(null); setDeleteTarget(null);
    try {
      await apiFetch(`/api/disclaimers/${d.id}`, { method: "DELETE" });
      setItems(items().filter(x => x.id !== d.id));
    } catch {
      setError("Eroare la ștergere.");
    } finally { setSaving(false); }
  }

  function doExportCSV() {
    exportCSV("Disclaimers", ["Titlu", "Text"], filtered().map(d => [d.title, d.text]));
  }
  function doExportPDF() {
    exportPDF("Disclaimers", ["Titlu", "Text"], filtered().map(d => [d.title, d.text]));
  }

  return (
    <div class="cfg-panel">
      <Show when={deleteTarget()}>
        <DeleteModal
          label={deleteTarget()!.title || `disclaimer #${deleteTarget()!.id}`}
          saving={saving()}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Show>

      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Disclaimers</h2>
        <input class="input cfg-search" placeholder="Caută..." value={search()} onInput={e => setSearch(e.currentTarget.value)} />
        <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
        <button class="btn btn-sm btn-primary" onClick={() => { setAddOpen(true); setEditId(null); setError(null); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      <Show when={addOpen()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <div class="cfg-location-fields">
            <input class="input" placeholder="Titlu *" value={addTitle()} onInput={e => setAddTitle(e.currentTarget.value)} />
            <textarea
              class="cfg-textarea"
              rows={4}
              placeholder="Textul disclaimerului..."
              value={addText()}
              onInput={e => setAddText(e.currentTarget.value)}
            />
          </div>
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !addTitle().trim()} onClick={saveAdd}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => { setAddOpen(false); setAddTitle(""); setAddText(""); }}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!loading() && filtered().length === 0}>
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există disclaimere. Apasă \"+ Adaugă\" pentru a crea unul."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(d) => (
            <Show
              when={editId() === d.id}
              fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{d.title}</span>
                    <Show when={d.text}>
                      <span class="cfg-location-desc" style="white-space:pre-wrap">{d.text}</span>
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
                  <input class="input" placeholder="Titlu *" value={editTitle()} onInput={e => setEditTitle(e.currentTarget.value)} />
                  <textarea
                    class="cfg-textarea"
                    rows={4}
                    value={editText()}
                    onInput={e => setEditText(e.currentTarget.value)}
                  />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(d)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editTitle().trim()} onClick={() => saveEdit(d.id)}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
