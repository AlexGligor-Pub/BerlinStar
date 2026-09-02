import { For, Show, createSignal } from "solid-js";
import { registersApi, type Register, type RegisterCreate } from "../../api/registers";
import { companiesApi, type Company } from "../../api/companies";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { generalSettings } from "../../store/generalSettingsStore";
import { exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

type RegForm = RegisterCreate;

const emptyRegForm = (): RegForm => ({
  name: "", company_id: null,
  deviz_serie: "", deviz_numar: 0,
  factura_serie: "", factura_numar: 0,
  chitanta_serie: "", chitanta_numar: 0,
  aviz_serie: "", aviz_numar: 0,
});

export default function RegisterPanel() {
  const list = createListResource<Register>({ fetcher: cursorFetcher(registersApi.list), limit: 100 });
  const companies = createListResource<Company>({ fetcher: () => companiesApi.listAll() });

  const [editId, setEditId]   = createSignal<number | null>(null);
  const [editForm, setEditForm] = createSignal<RegForm>(emptyRegForm());
  const [addOpen, setAddOpen] = createSignal(false);
  const [addForm, setAddForm] = createSignal<RegForm>(emptyRegForm());
  const [deleteTarget, setDeleteTarget] = createSignal<Register | null>(null);

  const save = useAction({
    fn: (id: number) => registersApi.update(id, editForm()),
    onSuccess: () => { setEditId(null); void list.reload(); },
    silentError: true,
  });

  const add = useAction({
    fn: () => registersApi.create(addForm()),
    onSuccess: () => { setAddForm(emptyRegForm()); setAddOpen(false); void list.reload(); },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => registersApi.remove(id),
    onSuccess: () => void list.reload(),
    silentError: true,
  });

  const saving = () => save.loading() || add.loading() || remove.loading();
  const error = () => list.error() ?? companies.error() ?? save.error() ?? add.error() ?? remove.error();
  function clearErrors() { save.reset(); add.reset(); remove.reset(); }

  function startEdit(r: Register) {
    setEditId(r.id);
    setEditForm({
      name: r.name, company_id: r.company_id,
      deviz_serie: r.deviz_serie, deviz_numar: r.deviz_numar,
      factura_serie: r.factura_serie, factura_numar: r.factura_numar,
      chitanta_serie: r.chitanta_serie, chitanta_numar: r.chitanta_numar,
      aviz_serie: r.aviz_serie, aviz_numar: r.aviz_numar,
    });
    setAddOpen(false); clearErrors();
  }
  function cancelEdit() { setEditId(null); }

  function confirmDelete() {
    const r = deleteTarget(); if (!r) return;
    setDeleteTarget(null);
    void remove.run(r.id);
  }

  function companyName(id: number | null) {
    return id ? (companies.items().find(c => c.id === id)?.name ?? `#${id}`) : "—";
  }

  function doExportCSV() {
    exportCSV("Registre",
      ["Companie", "Nume", "Deviz Serie", "Deviz Nr", "Factură Serie", "Factură Nr", "Chitanță Serie", "Chitanță Nr", "Aviz însoțire Serie", "Aviz însoțire Nr"],
      list.items().map(r => [companyName(r.company_id), r.name, r.deviz_serie, String(r.deviz_numar), r.factura_serie, String(r.factura_numar), r.chitanta_serie, String(r.chitanta_numar), r.aviz_serie, String(r.aviz_numar)]));
  }
  function doExportPDF() {
    exportPDF("Registre",
      ["Companie", "Nume", "Deviz Serie", "Deviz Nr", "Factură Serie", "Factură Nr", "Chitanță Serie", "Chitanță Nr", "Aviz însoțire Serie", "Aviz însoțire Nr"],
      list.items().map(r => [companyName(r.company_id), r.name, r.deviz_serie, String(r.deviz_numar), r.factura_serie, String(r.factura_numar), r.chitanta_serie, String(r.chitanta_numar), r.aviz_serie, String(r.aviz_numar)]));
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
          <For each={companies.items()}>
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
        <button class="btn btn-sm btn-primary" onClick={() => { setAddOpen(true); setEditId(null); clearErrors(); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      <Show when={addOpen()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <RegFormFields f={addForm()} setF={setAddForm} />
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !addForm().name.trim() || !addForm().company_id} onClick={() => void add.run()}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => { setAddOpen(false); clearErrors(); }}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={list.loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!list.loading() && list.items().length === 0}>
        <p class="cfg-hint">Nu există registre. Apasă "+ Adaugă" pentru a crea unul.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={list.items()}>
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
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editForm().name.trim() || !editForm().company_id} onClick={() => void save.run(r.id)}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
        <Show when={list.hasMore()}>
          <button class="btn btn-sm btn-ghost" disabled={list.loadingMore()} onClick={() => void list.loadMore()}>
            {list.loadingMore() ? "Se încarcă..." : "Încarcă mai multe"}
          </button>
        </Show>
      </div>
    </div>
  );
}
