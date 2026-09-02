import { For, Show, createMemo, createSignal } from "solid-js";
import { disclaimersApi, type Disclaimer } from "../../api/disclaimers";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function DisclaimersPanel() {
  const list = createListResource<Disclaimer>({ fetcher: cursorFetcher(disclaimersApi.list), limit: 100 });
  const [search, setSearch] = createSignal("");

  const [editId, setEditId]       = createSignal<number | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editText, setEditText]   = createSignal("");
  const [addOpen, setAddOpen]     = createSignal(false);
  const [addTitle, setAddTitle]   = createSignal("");
  const [addText, setAddText]     = createSignal("");
  const [deleteTarget, setDeleteTarget] = createSignal<Disclaimer | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? list.items().filter(d => d.title.toLowerCase().includes(q) || d.text.toLowerCase().includes(q)) : list.items();
  });

  const save = useAction({
    fn: (id: number) => disclaimersApi.update(id, { title: editTitle().trim(), text: editText().trim() }),
    onSuccess: (_updated, id) => {
      list.mutate(items => items.map(d => d.id === id ? { ...d, title: editTitle().trim(), text: editText().trim() } : d));
      cancelEdit();
    },
    silentError: true,
  });

  const add = useAction({
    fn: () => disclaimersApi.create({ title: addTitle().trim(), text: addText().trim() }),
    onSuccess: (created) => {
      list.mutate(items => [...items, created]);
      setAddTitle(""); setAddText(""); setAddOpen(false);
    },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => disclaimersApi.remove(id),
    onSuccess: (_result, id) => list.mutate(items => items.filter(x => x.id !== id)),
    silentError: true,
  });

  const saving = () => save.loading() || add.loading() || remove.loading();
  const error = () => list.error() ?? save.error() ?? add.error() ?? remove.error();
  function clearErrors() { save.reset(); add.reset(); remove.reset(); }

  function startEdit(d: Disclaimer) {
    setEditId(d.id); setEditTitle(d.title); setEditText(d.text);
    setAddOpen(false); clearErrors();
  }
  function cancelEdit() { setEditId(null); setEditTitle(""); setEditText(""); }

  function confirmDelete() {
    const d = deleteTarget();
    if (!d) return;
    setDeleteTarget(null);
    void remove.run(d.id);
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
        <button class="btn btn-sm btn-primary" onClick={() => { setAddOpen(true); setEditId(null); clearErrors(); }}>
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
            <button class="btn btn-sm btn-primary" disabled={saving() || !addTitle().trim()} onClick={() => void add.run()}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => { setAddOpen(false); setAddTitle(""); setAddText(""); }}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={list.loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!list.loading() && filtered().length === 0}>
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
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editTitle().trim()} onClick={() => void save.run(d.id)}>Salvează</button>
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
