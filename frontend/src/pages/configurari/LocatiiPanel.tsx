import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { locationsApi, type LocationDetail } from "../../api/locations";
import { departmentsApi, type Department } from "../../api/departments";
import { employeesApi, type Employee } from "../../api/employees";
import { disclaimersApi, type Disclaimer } from "../../api/disclaimers";
import { registersApi, type Register } from "../../api/registers";
import { companiesApi, type Company } from "../../api/companies";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function LocatiiPanel() {
  const list = createListResource<LocationDetail>({ fetcher: cursorFetcher(locationsApi.list), limit: 100 });
  const [search, setSearch] = createSignal("");

  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editDisclaimerId, setEditDisclaimerId] = createSignal<number | null>(null);
  const [editRegisterId, setEditRegisterId]     = createSignal<number | null>(null);
  const [editDepartmentIds, setEditDepartmentIds] = createSignal<Set<number>>(new Set<number>());
  const [editEmpIds, setEditEmpIds]       = createSignal<Set<number>>(new Set<number>());
  const [editCompanyId, setEditCompanyId] = createSignal<number | null>(null);
  const [allDepartments, setAllDepartments] = createSignal<Department[]>([]);
  const [allEmployees, setAllEmployees]   = createSignal<Employee[]>([]);
  const [allDisclaimers, setAllDisclaimers] = createSignal<Disclaimer[]>([]);
  const [allRegisters, setAllRegisters]   = createSignal<Register[]>([]);
  const [allCompanies, setAllCompanies]   = createSignal<Company[]>([]);
  const [deptOpen, setDeptOpen]           = createSignal(false);
  const [empOpen, setEmpOpen]             = createSignal(false);

  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  const [deleteTarget, setDeleteTarget] = createSignal<LocationDetail | null>(null);
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  let locFileInputRef: HTMLInputElement | undefined;

  const assocLoad = useAction({
    fn: () => Promise.all([
      departmentsApi.listAll(),
      employeesApi.listAll(),
      disclaimersApi.listAll(),
      registersApi.listAll(),
      companiesApi.listAll(),
    ]),
    onSuccess: ([depts, emps, discs, regs, comps]) => {
      setAllDepartments(depts);
      setAllEmployees(emps);
      setAllDisclaimers(discs);
      setAllRegisters(regs);
      setAllCompanies(comps);
    },
    silentError: true,
  });

  onMount(() => void assocLoad.run());

  const upload = useAction({
    fn: async (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", await compressToPng(file));
      return locationsApi.uploadImage(id, fd);
    },
    onSuccess: (updated, id) => {
      setEditImagePath(updated.image_path ?? null);
      list.mutate((items) => items.map((l) => (l.id === id ? { ...l, image_path: updated.image_path ?? null } : l)));
    },
    silentError: true,
  });

  const save = useAction({
    fn: (id: number) => Promise.all([
      locationsApi.update(id, {
        name: editName().trim(),
        description: editDesc().trim() || null,
        disclaimer_id: editDisclaimerId(),
        register_id: editRegisterId(),
        company_id: editCompanyId(),
      }),
      locationsApi.setDepartments(id, Array.from(editDepartmentIds())),
      locationsApi.setEmployees(id, Array.from(editEmpIds())),
    ]),
    onSuccess: () => { setEditId(null); void list.reload(); },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => locationsApi.remove(id),
    onSuccess: () => void list.reload(),
    silentError: true,
  });

  const add = useAction({
    fn: () => locationsApi.create({ name: newName().trim(), description: newDesc().trim() || null }),
    onSuccess: () => { setNewName(""); setNewDesc(""); setAddMode(false); void list.reload(); },
    silentError: true,
  });

  const saving = () => save.loading() || remove.loading() || add.loading();
  const error = () => list.error() ?? assocLoad.error() ?? upload.error() ?? save.error() ?? remove.error() ?? add.error();
  function clearErrors() { assocLoad.reset(); upload.reset(); save.reset(); remove.reset(); add.reset(); }

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q
      ? list.items().filter((l) => l.name.toLowerCase().includes(q) || (l.description ?? "").toLowerCase().includes(q))
      : list.items();
  });

  function startEdit(loc: LocationDetail) {
    setEditId(loc.id);
    setEditName(loc.name);
    setEditDesc(loc.description ?? "");
    setEditDisclaimerId(loc.disclaimer_id);
    setEditRegisterId(loc.register_id);
    setAddMode(false);
    setEditImagePath(loc.image_path ?? null);
    setEditDepartmentIds(new Set(loc.department_ids));
    setEditEmpIds(new Set(loc.employee_ids));
    setEditCompanyId(loc.company_id);
    setDeptOpen(false);
    setEmpOpen(false);
    clearErrors();
  }

  function cancelEdit() { setEditId(null); }

  function toggleNum(set: Set<number>, val: number): Set<number> {
    const s = new Set(set);
    if (s.has(val)) s.delete(val); else s.add(val);
    return s;
  }

  function confirmDelete() {
    const loc = deleteTarget();
    if (!loc) return;
    setDeleteTarget(null);
    void remove.run(loc.id);
  }

  function doExportCSV() {
    exportCSV("Locatii", ["#", "Nume", "Descriere"],
      filtered().map((l, i) => [String(i + 1), l.name, l.description ?? ""]));
  }
  function doExportPDF() {
    exportPDF("Locații", ["#", "Nume", "Descriere"],
      filtered().map((l, i) => [String(i + 1), l.name, l.description ?? ""]));
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
        <h2 class="cfg-panel-title">Locații</h2>
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
            <input class="input" placeholder="Nume locatie *" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
            <input class="input" placeholder="Descriere (optional)" value={newDesc()} onInput={(e) => setNewDesc(e.currentTarget.value)} />
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
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există locații. Apasă \"+ Adaugă\" pentru a crea una."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(loc) => (
            <Show
              when={editId() === loc.id}
              fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <div style="display:flex;align-items:center;gap:8px">
                      <Show when={loc.image_path}>
                        <img src={loc.image_path!} class="cfg-employee-avatar cfg-employee-avatar--sm" alt="avatar" />
                      </Show>
                      <span class="cfg-location-name">{loc.name}</span>
                    </div>
                    <Show when={loc.description}>
                      <span class="cfg-location-desc">{loc.description}</span>
                    </Show>
                    <Show when={loc.disclaimer_id !== null}>
                      <span class="cfg-location-desc" style="opacity:0.6;font-style:italic">
                        Disclaimer: {allDisclaimers().find(d => d.id === loc.disclaimer_id)?.title ?? `#${loc.disclaimer_id}`}
                      </span>
                    </Show>
                    <Show when={loc.register_id !== null}>
                      <span class="cfg-location-desc" style="opacity:0.6;font-style:italic">
                        Registru: {allRegisters().find(r => r.id === loc.register_id)?.name ?? `#${loc.register_id}`}
                      </span>
                    </Show>
                    <Show when={loc.company_id !== null}>
                      <span class="cfg-location-desc">
                        {allCompanies().find(c => c.id === loc.company_id)?.name ?? `#${loc.company_id}`}
                      </span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(loc)}>Editează</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields">
                  <input class="input" placeholder="Nume *" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                </div>

                <Show when={assocLoad.loading()}>
                  <p class="cfg-hint">Se încarcă departamente și angajați...</p>
                </Show>

                <Show when={!assocLoad.loading()}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Companie</span>
                    </div>
                    <select
                      class="input"
                      value={editCompanyId() ?? 0}
                      onChange={e => {
                        const v = parseInt(e.currentTarget.value);
                        setEditCompanyId(v === 0 ? null : v);
                        setEditRegisterId(null);
                      }}
                    >
                      <option value={0}>— Fără companie —</option>
                      <For each={allCompanies()}>
                        {(c) => <option value={c.id}>{c.name} (CUI {c.cui})</option>}
                      </For>
                    </select>
                  </div>

                  <Show when={editCompanyId() !== null}>
                    <div class="cfg-assoc-section">
                      <div class="cfg-assoc-header">
                        <span class="cfg-assoc-label">Registru</span>
                      </div>
                      <select
                        class="input"
                        value={editRegisterId() ?? 0}
                        onChange={e => {
                          const v = parseInt(e.currentTarget.value);
                          setEditRegisterId(v === 0 ? null : v);
                        }}
                      >
                        <option value={0}>— Fără registru —</option>
                        <For each={allRegisters().filter(r => r.company_id === editCompanyId())}>
                          {(r) => <option value={r.id}>{r.name}</option>}
                        </For>
                      </select>
                    </div>
                  </Show>

                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Disclaimer</span>
                    </div>
                    <select
                      class="input"
                      value={editDisclaimerId() ?? 0}
                      onChange={e => {
                        const v = parseInt(e.currentTarget.value);
                        setEditDisclaimerId(v === 0 ? null : v);
                      }}
                    >
                      <option value={0}>— Fără disclaimer —</option>
                      <For each={allDisclaimers()}>
                        {(d) => <option value={d.id}>{d.title}</option>}
                      </For>
                    </select>
                  </div>
                </Show>

                <Show when={!assocLoad.loading() && allDepartments().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header cfg-assoc-header--toggle" onClick={() => setDeptOpen(o => !o)}>
                      <span class="cfg-assoc-label">Departamente ({editDepartmentIds().size}/{allDepartments().length})</span>
                      <span class="cfg-accordion-arrow">{deptOpen() ? "▲" : "▼"}</span>
                    </div>
                    <Show when={deptOpen()}>
                      <div class="cfg-assoc-btns" style="margin-bottom:6px">
                        <button class="cfg-assoc-btn" onClick={() => setEditDepartmentIds(new Set(allDepartments().map(d => d.id)))}>Toate</button>
                        <button class="cfg-assoc-btn" onClick={() => setEditDepartmentIds(new Set<number>())}>Niciuna</button>
                      </div>
                      <div class="cfg-chip-grid">
                        <For each={allDepartments()}>
                          {(d) => (
                            <button
                              class="cfg-chip"
                              classList={{ "cfg-chip--active": editDepartmentIds().has(d.id) }}
                              onClick={() => setEditDepartmentIds(toggleNum(editDepartmentIds(), d.id))}
                            >{d.name}</button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={!assocLoad.loading() && allEmployees().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header cfg-assoc-header--toggle" onClick={() => setEmpOpen(o => !o)}>
                      <span class="cfg-assoc-label">Angajați ({editEmpIds().size}/{allEmployees().length})</span>
                      <span class="cfg-accordion-arrow">{empOpen() ? "▲" : "▼"}</span>
                    </div>
                    <Show when={empOpen()}>
                      <div class="cfg-assoc-btns" style="margin-bottom:6px">
                        <button class="cfg-assoc-btn" onClick={() => setEditEmpIds(new Set(allEmployees().map(e => e.id)))}>Toți</button>
                        <button class="cfg-assoc-btn" onClick={() => setEditEmpIds(new Set<number>())}>Niciunul</button>
                      </div>
                      <div class="cfg-chip-grid">
                        <For each={allEmployees()}>
                          {(e) => (
                            <button
                              class="cfg-chip"
                              classList={{ "cfg-chip--active": editEmpIds().has(e.id) }}
                              onClick={() => setEditEmpIds(toggleNum(editEmpIds(), e.id))}
                            >{e.name}</button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                <div class="cfg-employee-image-row">
                  <input
                    ref={locFileInputRef}
                    type="file"
                    accept="image/*"
                    style="display:none"
                    onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) void upload.run(loc.id, f); ev.currentTarget.value = ""; }}
                  />
                  <Show when={editImagePath()}>
                    <img src={editImagePath()!} class="cfg-employee-avatar" alt="avatar" />
                  </Show>
                  <button class="btn btn-sm btn-ghost" disabled={upload.loading()} onClick={() => locFileInputRef?.click()}>
                    {upload.loading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
                  </button>
                </div>

                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(loc)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || assocLoad.loading() || !editName().trim()} onClick={() => void save.run(loc.id)}>Salvează</button>
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
