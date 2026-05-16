import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch, apiUpload } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { Location, Department, Employee } from "./types";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function LocatiiPanel() {
  const [locations, setLocations] = createSignal<Location[]>([]);
  const [loading, setLoading]     = createSignal(true);
  const [search, setSearch]       = createSignal("");

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
  const [allDisclaimers, setAllDisclaimers] = createSignal<{ id: number; title: string; text: string }[]>([]);
  const [allRegisters, setAllRegisters]   = createSignal<{ id: number; name: string; company_id: number | null }[]>([]);
  const [allCompanies, setAllCompanies]   = createSignal<{ id: number; name: string; cui: number }[]>([]);
  const [editLoading, setEditLoading]     = createSignal(false);
  const [deptOpen, setDeptOpen]           = createSignal(false);
  const [empOpen, setEmpOpen]             = createSignal(false);
  let cachedDepartments: Department[] | null = null;
  let cachedEmployees: Employee[] | null = null;
  let cachedDisclaimers: { id: number; title: string; text: string }[] | null = null;
  let cachedRegisters: { id: number; name: string; company_id: number | null }[] | null = null;
  let cachedCompanies: { id: number; name: string; cui: number }[] | null = null;

  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  const [deleteTarget, setDeleteTarget] = createSignal<Location | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);
  const [editImagePath, setEditImagePath] = createSignal<string | null>(null);
  const [imageUploading, setImageUploading] = createSignal(false);
  let locFileInputRef: HTMLInputElement | undefined;

  async function handleLocImageFile(file: File) {
    const id = editId();
    if (!id) return;
    setImageUploading(true);
    setError(null);
    try {
      const compressed = await compressToPng(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await apiUpload(`/api/locations/${id}/image`, fd);
      if (!res.ok) throw new Error("Eroare la upload imagine.");
      const updated = await res.json() as { image_path: string | null };
      setEditImagePath(updated.image_path ?? null);
      setLocations(locations().map(l => l.id === id ? { ...l, image_path: updated.image_path ?? null } : l));
    } catch (ex: any) {
      setError(ex?.message ?? "Eroare la upload.");
    } finally {
      setImageUploading(false);
    }
  }

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? locations().filter(l => l.name.toLowerCase().includes(q) || (l.description ?? "").toLowerCase().includes(q)) : locations();
  });

  async function loadLocations() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/locations?limit=200");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLocations(data.items ?? []);
    } catch {
      setError("Eroare la incarcare.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDisclaimersCache() {
    if (cachedDisclaimers) { setAllDisclaimers(cachedDisclaimers); return; }
    try {
      const res = await apiFetch("/api/disclaimers?limit=200");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Array<{ id: number; title: string; text: string }> };
      cachedDisclaimers = (data.items ?? []).map((d) => ({ id: d.id, title: d.title, text: d.text }));
      setAllDisclaimers(cachedDisclaimers!);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare disclaimere.", "error");
    }
  }

  async function loadRegistersCache() {
    if (cachedRegisters) { setAllRegisters(cachedRegisters); return; }
    try {
      const res = await apiFetch("/api/registers?limit=200");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Array<{ id: number; name: string; company_id?: number | null }> };
      cachedRegisters = (data.items ?? []).map((r) => ({ id: r.id, name: r.name, company_id: r.company_id ?? null }));
      setAllRegisters(cachedRegisters!);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare registre.", "error");
    }
  }

  onMount(() => { loadLocations(); loadDisclaimersCache(); loadRegistersCache(); });

  async function startEdit(loc: Location) {
    setEditId(loc.id);
    setEditName(loc.name);
    setEditDesc(loc.description ?? "");
    setEditDisclaimerId(loc.disclaimer_id);
    setEditRegisterId(loc.register_id);
    setAddMode(false);
    setError(null);
    setEditImagePath(loc.image_path ?? null);
    setEditDepartmentIds(new Set(loc.department_ids));
    setEditEmpIds(new Set(loc.employee_ids));
    setEditCompanyId(loc.company_id);
    setDeptOpen(false);
    setEmpOpen(false);

    if (cachedDepartments && cachedEmployees && cachedDisclaimers && cachedRegisters && cachedCompanies) {
      setAllDepartments(cachedDepartments);
      setAllEmployees(cachedEmployees);
      setAllDisclaimers(cachedDisclaimers);
      setAllRegisters(cachedRegisters);
      setAllCompanies(cachedCompanies);
      return;
    }

    setAllDepartments([]);
    setAllEmployees([]);
    setAllDisclaimers([]);
    setAllCompanies([]);
    setEditLoading(true);
    try {
      const fetches: Promise<Response>[] = [];
      if (!cachedDepartments) fetches.push(apiFetch("/api/departments?limit=200"));
      if (!cachedEmployees)   fetches.push(apiFetch("/api/employees?limit=200"));
      if (!cachedDisclaimers) fetches.push(apiFetch("/api/disclaimers?limit=200"));
      if (!cachedRegisters)   fetches.push(apiFetch("/api/registers?limit=200"));
      if (!cachedCompanies)   fetches.push(apiFetch("/api/companies?limit=200"));

      const results = await Promise.all(fetches);
      if (results.some(r => !r.ok)) throw new Error();
      const jsons = await Promise.all(results.map(r => r.json()));

      let idx = 0;
      if (!cachedDepartments) { cachedDepartments = jsons[idx++].items ?? []; }
      if (!cachedEmployees)   { cachedEmployees   = jsons[idx++].items ?? []; }
      if (!cachedDisclaimers) { cachedDisclaimers = (jsons[idx++].items ?? []).map((d: any) => ({ id: d.id, title: d.title, text: d.text })); }
      if (!cachedRegisters)   { cachedRegisters   = (jsons[idx++].items ?? []).map((r: any) => ({ id: r.id, name: r.name, company_id: r.company_id ?? null })); }
      if (!cachedCompanies)   { cachedCompanies   = (jsons[idx++].items ?? []).map((c: any) => ({ id: c.id, name: c.name, cui: c.cui })); }

      setAllDepartments(cachedDepartments!);
      setAllEmployees(cachedEmployees!);
      setAllDisclaimers(cachedDisclaimers!);
      setAllRegisters(cachedRegisters!);
      setAllCompanies(cachedCompanies!);
    } catch {
      setError("Eroare la încărcarea datelor.");
    } finally {
      setEditLoading(false);
    }
  }

  function cancelEdit() { setEditId(null); }

  function toggleNum(set: Set<number>, val: number): Set<number> {
    const s = new Set(set);
    s.has(val) ? s.delete(val) : s.add(val);
    return s;
  }

  async function saveEdit() {
    if (!editName().trim()) return;
    setSaving(true);
    setError(null);
    try {
      const id = editId()!;
      await Promise.all([
        apiFetch(`/api/locations/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: editName().trim(), description: editDesc().trim() || null, disclaimer_id: editDisclaimerId(), register_id: editRegisterId(), company_id: editCompanyId() }),
        }),
        apiFetch(`/api/locations/${id}/departments`, {
          method: "PUT",
          body: JSON.stringify({ ids: Array.from(editDepartmentIds()) }),
        }),
        apiFetch(`/api/locations/${id}/employees`, {
          method: "PUT",
          body: JSON.stringify({ ids: Array.from(editEmpIds()) }),
        }),
      ]);
      setEditId(null);
      await loadLocations();
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const loc = deleteTarget();
    if (!loc) return;
    setSaving(true);
    setError(null);
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/locations/${loc.id}`, { method: "DELETE" });
      await loadLocations();
    } catch {
      setError("Eroare la stergere.");
    } finally {
      setSaving(false);
    }
  }

  async function addLocation() {
    if (!newName().trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/locations", {
        method: "POST",
        body: JSON.stringify({ name: newName().trim(), description: newDesc().trim() || null }),
      });
      setNewName(""); setNewDesc(""); setAddMode(false);
      await loadLocations();
    } catch {
      setError("Eroare la adaugare.");
    } finally {
      setSaving(false);
    }
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
            <button class="btn btn-sm btn-primary" disabled={saving() || !newName().trim()} onClick={addLocation}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>
      <Show when={!loading() && filtered().length === 0}>
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

                <Show when={editLoading()}>
                  <p class="cfg-hint">Se încarcă departamente și angajați...</p>
                </Show>

                <Show when={!editLoading()}>
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

                <Show when={!editLoading() && allDepartments().length > 0}>
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

                <Show when={!editLoading() && allEmployees().length > 0}>
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
                    onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) handleLocImageFile(f); ev.currentTarget.value = ""; }}
                  />
                  <Show when={editImagePath()}>
                    <img src={editImagePath()!} class="cfg-employee-avatar" alt="avatar" />
                  </Show>
                  <button class="btn btn-sm btn-ghost" disabled={imageUploading()} onClick={() => locFileInputRef?.click()}>
                    {imageUploading() ? "..." : editImagePath() ? "Schimbă poza" : "Adaugă poză"}
                  </button>
                </div>

                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(loc)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || editLoading() || !editName().trim()} onClick={saveEdit}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
