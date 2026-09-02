import { For, Show, createMemo, createSignal } from "solid-js";
import { departmentsApi, type Department } from "../../api/departments";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function DepartamentePanel() {
  const list = createListResource<Department>({ fetcher: cursorFetcher(departmentsApi.list), limit: 100 });
  const [search, setSearch] = createSignal("");

  const [editId, setEditId] = createSignal<number | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editDesc, setEditDesc] = createSignal("");
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  let deptFileInputRef: HTMLInputElement | undefined;

  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  const [deleteTarget, setDeleteTarget] = createSignal<Department | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q
      ? list.items().filter((d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q))
      : list.items();
  });

  const upload = useAction({
    fn: async (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", await compressToPng(file));
      return departmentsApi.uploadImage(id, fd);
    },
    onSuccess: (updated, id) => {
      setEditImagePath(updated.image_path ?? null);
      list.mutate((items) => items.map((d) => (d.id === id ? { ...d, image_path: updated.image_path ?? null } : d)));
    },
    silentError: true,
  });

  const save = useAction({
    fn: (id: number) => departmentsApi.update(id, { name: editName().trim(), description: editDesc().trim() || null }),
    onSuccess: () => { setEditId(null); void list.reload(); },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => departmentsApi.remove(id),
    onSuccess: () => void list.reload(),
    silentError: true,
  });

  const add = useAction({
    fn: () => departmentsApi.create({ name: newName().trim(), description: newDesc().trim() || null }),
    onSuccess: () => { setNewName(""); setNewDesc(""); setAddMode(false); void list.reload(); },
    silentError: true,
  });

  const saving = () => save.loading() || remove.loading() || add.loading();
  const error = () => list.error() ?? upload.error() ?? save.error() ?? remove.error() ?? add.error();
  function clearErrors() { upload.reset(); save.reset(); remove.reset(); add.reset(); }

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditName(d.name);
    setEditDesc(d.description ?? "");
    setEditImagePath(d.image_path ?? null);
    setAddMode(false);
    clearErrors();
  }

  function confirmDelete() {
    const d = deleteTarget();
    if (!d) return;
    setDeleteTarget(null);
    void remove.run(d.id);
  }

  const exportRows = () => filtered().map((d, i) => [String(i + 1), d.name, d.description ?? ""]);
  const doExportCSV = () => exportCSV("Departamente", ["#", "Nume", "Descriere"], exportRows());
  const doExportPDF = () => exportPDF("Departamente", ["#", "Nume", "Descriere"], exportRows());

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
        <input class="input cfg-search" placeholder="Caută..." value={search()} onInput={(e) => setSearch(e.currentTarget.value)} />
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
            <button class="btn btn-sm btn-primary" disabled={saving() || !newName().trim()} onClick={() => void add.run()}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={list.loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>
      <Show when={!list.loading() && filtered().length === 0}>
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
                      onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) void upload.run(d.id, f); ev.currentTarget.value = ""; }}
                    />
                    <button class="btn btn-sm btn-ghost" disabled={upload.loading()} onClick={() => deptFileInputRef?.click()}>
                      {upload.loading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
                    </button>
                  </div>
                  <input class="input" placeholder="Nume *" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(d)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editName().trim()} onClick={() => void save.run(d.id)}>Salvează</button>
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
