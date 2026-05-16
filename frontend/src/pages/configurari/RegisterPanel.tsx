import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../../utils/api";
import { generalSettings } from "../../store/generalSettingsStore";
import { exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

interface RegisterItem {
  id: number; name: string; company_id: number | null;
  deviz_serie: string; deviz_numar: number;
  factura_serie: string; factura_numar: number;
  chitanta_serie: string; chitanta_numar: number;
  aviz_serie: string; aviz_numar: number;
}

type RegForm = Omit<RegisterItem, "id">;

const emptyRegForm = (): RegForm => ({
  name: "", company_id: null,
  deviz_serie: "", deviz_numar: 0,
  factura_serie: "", factura_numar: 0,
  chitanta_serie: "", chitanta_numar: 0,
  aviz_serie: "", aviz_numar: 0,
});

export default function RegisterPanel() {
  const [items, setItems]     = createSignal<RegisterItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [editId, setEditId]   = createSignal<number | null>(null);
  const [editForm, setEditForm] = createSignal<RegForm>(emptyRegForm());
  const [addOpen, setAddOpen] = createSignal(false);
  const [addForm, setAddForm] = createSignal<RegForm>(emptyRegForm());
  const [deleteTarget, setDeleteTarget] = createSignal<RegisterItem | null>(null);
  const [saving, setSaving]   = createSignal(false);
  const [error, setError]     = createSignal<string | null>(null);
  const [companies, setCompanies] = createSignal<{ id: number; name: string }[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [regRes, compRes] = await Promise.all([
        apiFetch("/api/registers?limit=200"),
        apiFetch("/api/companies?limit=200"),
      ]);
      if (!regRes.ok) throw new Error();
      const data = await regRes.json();
      setItems(data.items ?? []);
      if (compRes.ok) {
        const cd = await compRes.json();
        setCompanies((cd.items ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch {
      setError("Eroare la încărcare.");
    } finally { setLoading(false); }
  }

  onMount(load);

  function startEdit(r: RegisterItem) {
    const { id, ...rest } = r;
    setEditId(id); setEditForm(rest); setAddOpen(false); setError(null);
  }
  function cancelEdit() { setEditId(null); }

  async function saveEdit(id: number) {
    if (!editForm().name.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/registers/${id}`, { method: "PATCH", body: JSON.stringify(editForm()) });
      setItems(items().map(r => r.id === id ? { id, ...editForm() } : r));
      cancelEdit();
    } catch {
      setError("Eroare la salvare.");
    } finally { setSaving(false); }
  }

  async function saveAdd() {
    if (!addForm().name.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/registers", { method: "POST", body: JSON.stringify(addForm()) });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setItems([...items(), created]);
      setAddForm(emptyRegForm()); setAddOpen(false);
    } catch {
      setError("Eroare la adăugare.");
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    const r = deleteTarget(); if (!r) return;
    setSaving(true); setError(null); setDeleteTarget(null);
    try {
      await apiFetch(`/api/registers/${r.id}`, { method: "DELETE" });
      setItems(items().filter(x => x.id !== r.id));
    } catch {
      setError("Eroare la ștergere.");
    } finally { setSaving(false); }
  }

  function companyName(id: number | null) {
    return id ? (companies().find(c => c.id === id)?.name ?? `#${id}`) : "—";
  }

  function doExportCSV() {
    exportCSV("Registre",
      ["Companie", "Nume", "Deviz Serie", "Deviz Nr", "Factură Serie", "Factură Nr", "Chitanță Serie", "Chitanță Nr", "Aviz însoțire Serie", "Aviz însoțire Nr"],
      items().map(r => [companyName(r.company_id), r.name, r.deviz_serie, String(r.deviz_numar), r.factura_serie, String(r.factura_numar), r.chitanta_serie, String(r.chitanta_numar), r.aviz_serie, String(r.aviz_numar)]));
  }
  function doExportPDF() {
    exportPDF("Registre",
      ["Companie", "Nume", "Deviz Serie", "Deviz Nr", "Factură Serie", "Factură Nr", "Chitanță Serie", "Chitanță Nr", "Aviz însoțire Serie", "Aviz însoțire Nr"],
      items().map(r => [companyName(r.company_id), r.name, r.deviz_serie, String(r.deviz_numar), r.factura_serie, String(r.factura_numar), r.chitanta_serie, String(r.chitanta_numar), r.aviz_serie, String(r.aviz_numar)]));
  }

  function RegFormFields(props: { f: RegForm; setF: (v: RegForm) => void }) {
    const f = () => props.f;
    const s = (patch: Partial<RegForm>) => props.setF({ ...f(), ...patch });
    return (
      <div class="cfg-location-fields">
        <select
          class="input"
          value={f().company_id ?? 0}
          onChange={e => { const v = parseInt(e.currentTarget.value); s({ company_id: v === 0 ? null : v }); }}
        >
          <option value={0}>— Fără companie —</option>
          <For each={companies()}>
            {(c) => <option value={c.id}>{c.name}</option>}
          </For>
        </select>
        <input class="input" placeholder="Nume registru *" value={f().name} onInput={e => s({ name: e.currentTarget.value })} />
        <div class="cfg-register-grid">
          <span class="cfg-register-label">Deviz</span>
          <input class="input" placeholder="Serie" value={f().deviz_serie} onInput={e => s({ deviz_serie: e.currentTarget.value })} />
          <input class="input" type="number" min="0" placeholder="Număr" value={f().deviz_numar} onInput={e => s({ deviz_numar: parseInt(e.currentTarget.value) || 0 })} />

          <Show when={generalSettings()?.useFactura !== false}>
            <span class="cfg-register-label">Factură</span>
            <input class="input" placeholder="Serie" value={f().factura_serie} onInput={e => s({ factura_serie: e.currentTarget.value })} />
            <input class="input" type="number" min="0" placeholder="Număr" value={f().factura_numar} onInput={e => s({ factura_numar: parseInt(e.currentTarget.value) || 0 })} />

            <span class="cfg-register-label">Chitanță</span>
            <input class="input" placeholder="Serie" value={f().chitanta_serie} onInput={e => s({ chitanta_serie: e.currentTarget.value })} />
            <input class="input" type="number" min="0" placeholder="Număr" value={f().chitanta_numar} onInput={e => s({ chitanta_numar: parseInt(e.currentTarget.value) || 0 })} />
          </Show>

          <Show when={generalSettings()?.useAviz !== false}>
            <span class="cfg-register-label">Aviz însoțire</span>
            <input class="input" placeholder="Serie" value={f().aviz_serie} onInput={e => s({ aviz_serie: e.currentTarget.value })} />
            <input class="input" type="number" min="0" placeholder="Număr" value={f().aviz_numar} onInput={e => s({ aviz_numar: parseInt(e.currentTarget.value) || 0 })} />
          </Show>
        </div>
      </div>
    );
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
        <h2 class="cfg-panel-title">Registre</h2>
        <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
        <button class="btn btn-sm btn-primary" onClick={() => { setAddOpen(true); setEditId(null); setError(null); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      <Show when={addOpen()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <RegFormFields f={addForm()} setF={setAddForm} />
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !addForm().name.trim() || !addForm().company_id} onClick={saveAdd}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => { setAddOpen(false); setError(null); }}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!loading() && items().length === 0}>
        <p class="cfg-hint">Nu există registre. Apasă "+ Adaugă" pentru a crea unul.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={items()}>
          {(r) => (
            <Show when={editId() === r.id}
              fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{r.name}</span>
                    <Show when={r.company_id !== null}>
                      <span class="cfg-location-desc" style="opacity:0.7">{companyName(r.company_id)}</span>
                    </Show>
                    <span class="cfg-location-desc">
                      Deviz: {r.deviz_serie || "—"} / {r.deviz_numar}
                      <Show when={generalSettings()?.useFactura !== false}>
                        &nbsp;·&nbsp;Factură: {r.factura_serie || "—"} / {r.factura_numar}
                        &nbsp;·&nbsp;Chitanță: {r.chitanta_serie || "—"} / {r.chitanta_numar}
                      </Show>
                      <Show when={generalSettings()?.useAviz !== false}>
                        &nbsp;·&nbsp;Aviz însoțire: {r.aviz_serie || "—"} / {r.aviz_numar}
                      </Show>
                    </span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(r)}>Editează</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <RegFormFields f={editForm()} setF={setEditForm} />
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(r)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editForm().name.trim() || !editForm().company_id} onClick={() => saveEdit(r.id)}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
