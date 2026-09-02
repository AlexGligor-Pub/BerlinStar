import { For, Show, createMemo, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { employeesApi, type Employee } from "../../api/employees";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function AngajatiPanel() {
  const navigate = useNavigate();
  const list = createListResource<Employee>({ fetcher: cursorFetcher(employeesApi.list, { sort: "name" }), limit: 100 });
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editTarget, setEditTarget]       = createSignal("");
  const [editVacationDays, setEditVacationDays] = createSignal("21");
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  const [addMode, setAddMode]     = createSignal(false);
  const [newName, setNewName]     = createSignal("");
  const [newDesc, setNewDesc]     = createSignal("");
  const [newTarget, setNewTarget] = createSignal("0");
  const [newVacationDays, setNewVacationDays] = createSignal("21");

  const [deleteTarget, setDeleteTarget] = createSignal<Employee | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? list.items().filter(e => e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q)) : list.items();
  });

  const upload = useAction({
    fn: async (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", await compressToPng(file));
      return employeesApi.uploadImage(id, fd);
    },
    onSuccess: (updated, id) => {
      setEditImagePath(updated.image_path ?? null);
      list.mutate(items => items.map(e => e.id === id ? { ...e, image_path: updated.image_path ?? null } : e));
    },
    silentError: true,
  });

  const save = useAction({
    fn: (id: number) => employeesApi.update(id, {
      name: editName().trim(),
      description: editDesc().trim() || null,
      target: parseFloat(editTarget()) || 0,
      annual_vacation_days: Math.max(0, Math.min(365, parseInt(editVacationDays(), 10) || 0)),
    }),
    onSuccess: () => { setEditId(null); void list.reload(); },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => employeesApi.remove(id),
    onSuccess: () => void list.reload(),
    silentError: true,
  });

  const add = useAction({
    fn: () => employeesApi.create({
      name: newName().trim(),
      description: newDesc().trim() || null,
      target: parseFloat(newTarget()) || 0,
      annual_vacation_days: Math.max(0, Math.min(365, parseInt(newVacationDays(), 10) || 21)),
    }),
    onSuccess: () => {
      setNewName(""); setNewDesc(""); setNewTarget("0"); setNewVacationDays("21"); setAddMode(false);
      void list.reload();
    },
    silentError: true,
  });

  const saving = () => save.loading() || add.loading() || remove.loading();
  const error = () => list.error() ?? upload.error() ?? save.error() ?? add.error() ?? remove.error();
  function clearErrors() { upload.reset(); save.reset(); add.reset(); remove.reset(); }

  function startEdit(e: Employee) {
    setEditId(e.id);
    setEditName(e.name);
    setEditDesc(e.description ?? "");
    setEditTarget(e.target);
    setEditVacationDays(String(e.annual_vacation_days ?? 21));
    setEditImagePath(e.image_path ?? null);
    setAddMode(false);
    clearErrors();
  }

  function confirmDelete() {
    const e = deleteTarget();
    if (!e) return;
    setDeleteTarget(null);
    void remove.run(e.id);
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
            <button class="btn btn-sm btn-primary" disabled={saving() || !newName().trim()} onClick={() => void add.run()}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={list.loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>
      <Show when={!list.loading() && filtered().length === 0}>
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
                    <button class="btn btn-sm btn-ghost" onClick={() => navigate(`/angajati/${e.id}`)}>Detalii Angajat</button>
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
                        if (f) void upload.run(e.id, f);
                        ev.currentTarget.value = "";
                      }}
                    />
                    <button
                      class="btn btn-sm btn-ghost"
                      disabled={upload.loading()}
                      onClick={() => fileInputRef?.click()}
                    >
                      {upload.loading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
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
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editName().trim()} onClick={() => void save.run(e.id)}>Salvează</button>
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
