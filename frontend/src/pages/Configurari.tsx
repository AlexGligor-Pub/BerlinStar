import { For, Show, Switch, Match, createEffect, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { apiFetch } from "../utils/api";

interface Location { id: number; name: string; description: string | null; disclaimer_id: number | null; register_id: number | null; company_id: number | null; department_ids: number[]; employee_ids: number[]; }
interface CompanyItem { id: number; cui: number; name: string; address: string | null; nr_reg_com: string | null; phone: string | null; postal_code: string | null; is_vat_payer: boolean | null; registration_status: string | null; description: string | null; comments: string | null; }
interface Department { id: number; name: string; description: string | null; }
interface Employee  { id: number; name: string; }
interface EmployeeItem { id: number; name: string; description: string | null; target: string; }
interface Category { id: number; name: string; department_id: number; }
interface Item { id: number; name: string; description: string | null; price: string; unit: string; type: string; category_id: number; category_name: string | null; }

// ─── Export helpers ───────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(title: string, headers: string[], rows: string[][]) {
  const w = window.open("", "_blank", "width=960,height=700");
  if (!w) return;
  const date = new Date().toLocaleDateString("ro-RO");
  const thead = headers.map(h => `<th>${esc(h)}</th>`).join("");
  const tbody = rows.map(r => `<tr>${r.map(c => `<td>${esc(c ?? "")}</td>`).join("")}</tr>`).join("");
  w.document.write(`<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; padding: 18mm 20mm; }
  h1 { font-size: 15pt; margin-bottom: 14px; }
  table { width:100%; border-collapse:collapse; margin-bottom:40px; }
  th { background:#f0f0f0; font-weight:600; border:1px solid #bbb; padding:7px 10px; text-align:left; }
  td { border:1px solid #ddd; padding:6px 10px; }
  tr:nth-child(even) td { background:#fafafa; }
  footer { position:fixed; bottom:8mm; left:20mm; right:20mm; font-size:8pt; color:#555;
           border-top:1px solid #ccc; padding-top:4px;
           display:flex; justify-content:space-between; }
  footer a { color:#4466cc; text-decoration:none; }
  @media print {
    body { padding: 0; }
    footer { position: fixed; bottom: 8mm; }
  }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <footer>
    <span>Exportat din Berlin Star &ndash; <a href="https://professorprime.ro">professorprime.ro</a></span>
    <span>${date}</span>
  </footer>
  <script>setTimeout(()=>{ window.print(); },400);<\/script>
</body>
</html>`);
  w.document.close();
}

// ─── Export menu component ────────────────────────────────────────────────────

function ExportMenu(props: { onCSV: () => void; onPDF: () => void }) {
  const [open, setOpen] = createSignal(false);
  let wrap: HTMLDivElement | undefined;

  function onOutside(e: MouseEvent) {
    if (wrap && !wrap.contains(e.target as Node)) setOpen(false);
  }

  onMount(() => document.addEventListener("mousedown", onOutside));
  onCleanup(() => document.removeEventListener("mousedown", onOutside));

  return (
    <div class="cfg-export-wrap" ref={wrap}>
      <button class="btn btn-sm btn-ghost" onClick={() => setOpen(o => !o)}>
        Export ▾
      </button>
      <Show when={open()}>
        <div class="cfg-export-menu">
          <button class="cfg-export-item" onClick={() => { props.onPDF(); setOpen(false); }}>PDF</button>
          <button class="cfg-export-item" onClick={() => { props.onCSV(); setOpen(false); }}>CSV</button>
        </div>
      </Show>
    </div>
  );
}

// ─── Generic delete confirm modal ────────────────────────────────────────────

function DeleteModal(props: { label: string; onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div class="cfg-confirm-overlay" onClick={props.onCancel}>
      <div class="cfg-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p class="cfg-confirm-text">
          Stergi <strong>{props.label}</strong>?
        </p>
        <div class="cfg-confirm-actions">
          <button class="btn btn-sm btn-ghost" onClick={props.onCancel}>Anuleaza</button>
          <button class="btn btn-sm btn-danger" disabled={props.saving} onClick={props.onConfirm}>Sterge</button>
        </div>
      </div>
    </div>
  );
}

// ─── Locații panel ────────────────────────────────────────────────────────────

function LocatiiPanel() {
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
      const data = await res.json();
      cachedDisclaimers = (data.items ?? []).map((d: any) => ({ id: d.id, title: d.title, text: d.text }));
      setAllDisclaimers(cachedDisclaimers!);
    } catch {}
  }

  async function loadRegistersCache() {
    if (cachedRegisters) { setAllRegisters(cachedRegisters); return; }
    try {
      const res = await apiFetch("/api/registers?limit=200");
      if (!res.ok) return;
      const data = await res.json();
      cachedRegisters = (data.items ?? []).map((r: any) => ({ id: r.id, name: r.name, company_id: r.company_id ?? null }));
      setAllRegisters(cachedRegisters!);
    } catch {}
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
                    <span class="cfg-location-name">{loc.name}</span>
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
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(loc)}>Șterge</button>
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

                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-primary" disabled={saving() || editLoading() || !editName().trim()} onClick={saveEdit}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Departamente panel ───────────────────────────────────────────────────────

function DepartamentePanel() {
  const [items, setItems]     = createSignal<Department[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]       = createSignal<number | null>(null);
  const [editName, setEditName]   = createSignal("");
  const [editDesc, setEditDesc]   = createSignal("");

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
    setAddMode(false);
    setError(null);
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
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{d.name}</span>
                    <Show when={d.description}>
                      <span class="cfg-location-desc">{d.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(d)}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(d)}>Șterge</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields">
                  <input class="input" placeholder="Nume *" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editName().trim()} onClick={saveEdit}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Angajați panel ───────────────────────────────────────────────────────────

function AngajatiPanel() {
  const [items, setItems]     = createSignal<EmployeeItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  const [editId, setEditId]         = createSignal<number | null>(null);
  const [editName, setEditName]     = createSignal("");
  const [editDesc, setEditDesc]     = createSignal("");
  const [editTarget, setEditTarget] = createSignal("");

  const [addMode, setAddMode]     = createSignal(false);
  const [newName, setNewName]     = createSignal("");
  const [newDesc, setNewDesc]     = createSignal("");
  const [newTarget, setNewTarget] = createSignal("0");

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
    setAddMode(false);
    setError(null);
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
        }),
      });
      if (!res.ok) throw new Error();
      setNewName(""); setNewDesc(""); setNewTarget("0"); setAddMode(false);
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
            <input class="input" placeholder="Nume *" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
            <input class="input" placeholder="Descriere (opțional)" value={newDesc()} onInput={(e) => setNewDesc(e.currentTarget.value)} />
            <input class="input" type="number" placeholder="Target lunar (0 = fără)" value={newTarget()} onInput={(e) => setNewTarget(e.currentTarget.value)} />
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
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{e.name}</span>
                    <Show when={e.description}>
                      <span class="cfg-location-desc">{e.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(e)}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(e)}>Șterge</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields">
                  <input class="input" placeholder="Nume *" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
                  <input class="input" type="number" placeholder="Target lunar" value={editTarget()} onInput={(e) => setEditTarget(e.currentTarget.value)} />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editName().trim()} onClick={saveEdit}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Disclaimers panel ────────────────────────────────────────────────────────

interface DisclaimerItem { id: number; title: string; text: string; }

function DisclaimersPanel() {
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
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(d)}>Șterge</button>
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
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editTitle().trim()} onClick={() => saveEdit(d.id)}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Produse și Servicii panel ────────────────────────────────────────────────

function ProduseSiServiciiPanel() {
  // ── shared ──
  const [departments, setDepartments] = createSignal<Department[]>([]);
  const [filterDeptId, setFilterDeptId] = createSignal<number | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // ── tabs ──
  const [activeTab, setActiveTab] = createSignal<"categorii" | "produse">("categorii");

  // ── categories ──
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [catsLoading, setCatsLoading] = createSignal(false);
  const [catEditId, setCatEditId] = createSignal<number | null>(null);
  const [catEditName, setCatEditName] = createSignal("");
  const [catEditDeptId, setCatEditDeptId] = createSignal<number | null>(null);
  const [catAddMode, setCatAddMode] = createSignal(false);
  const [catNewName, setCatNewName] = createSignal("");
  const [catNewDeptId, setCatNewDeptId] = createSignal<number | null>(null);
  const [catDeleteTarget, setCatDeleteTarget] = createSignal<Category | null>(null);

  // ── items ──
  const [items, setItems] = createSignal<Item[]>([]);
  const [itemsLoading, setItemsLoading] = createSignal(false);
  const [itemFilterCatId, setItemFilterCatId] = createSignal<number | null>(null);
  const [itemFilterType, setItemFilterType] = createSignal<"all" | "Produs" | "Service">("all");
  const [itemEditId, setItemEditId] = createSignal<number | null>(null);
  const [itemEditForm, setItemEditForm] = createSignal({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: 0 });
  const [itemAddMode, setItemAddMode] = createSignal(false);
  const [itemNewForm, setItemNewForm] = createSignal({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: 0 });
  const [itemDeleteTarget, setItemDeleteTarget] = createSignal<Item | null>(null);

  async function loadDepartments() {
    try {
      const res = await apiFetch("/api/departments?limit=200");
      if (!res.ok) return;
      const data = await res.json();
      const depts: Department[] = data.items ?? [];
      setDepartments(depts);
      if (catNewDeptId() === null && depts.length > 0) setCatNewDeptId(depts[0].id);
    } catch {}
  }

  async function loadCategories() {
    setCatsLoading(true);
    try {
      const dq = filterDeptId() != null ? `&department_id=${filterDeptId()}` : "";
      const res = await apiFetch(`/api/categories?limit=200${dq}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories(data.items ?? []);
    } catch {
      setError("Eroare la încărcarea categoriilor.");
    } finally {
      setCatsLoading(false);
    }
  }

  async function loadItems() {
    setItemsLoading(true);
    try {
      const cq = itemFilterCatId() != null ? `&category_id=${itemFilterCatId()}` : "";
      const tq = itemFilterType() !== "all" ? `&type=${itemFilterType()}` : "";
      const dq = filterDeptId() != null ? `&department_id=${filterDeptId()}` : "";
      const res = await apiFetch(`/api/items?limit=200${cq}${tq}${dq}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("Eroare la încărcarea produselor.");
    } finally {
      setItemsLoading(false);
    }
  }

  function switchTab(tab: "categorii" | "produse") {
    setActiveTab(tab);
    if (tab === "categorii") loadCategories();
    // produse tab: user must press Caută
  }

  onMount(() => { loadDepartments(); loadCategories(); });

  // When dept filter changes: refresh category list + reset cat filter
  createEffect(() => {
    filterDeptId();
    setItemFilterCatId(null);
    loadCategories();
  });

  // ── categories CRUD ──
  async function saveCatEdit() {
    if (!catEditName().trim() || !catEditDeptId()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/categories/${catEditId()}`, {
        method: "PATCH",
        body: JSON.stringify({ name: catEditName().trim(), department_id: catEditDeptId() }),
      });
      if (!res.ok) throw new Error();
      setCatEditId(null);
      await loadCategories();
    } catch { setError("Eroare la salvare."); } finally { setSaving(false); }
  }

  async function saveCatAdd() {
    if (!catNewName().trim() || !catNewDeptId()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: catNewName().trim(), department_id: catNewDeptId() }),
      });
      if (!res.ok) throw new Error();
      setCatNewName(""); setCatAddMode(false);
      await loadCategories();
    } catch { setError("Eroare la adăugare."); } finally { setSaving(false); }
  }

  async function confirmCatDelete() {
    const c = catDeleteTarget(); if (!c) return;
    setSaving(true); setError(null); setCatDeleteTarget(null);
    try {
      await apiFetch(`/api/categories/${c.id}`, { method: "DELETE" });
      await loadCategories();
    } catch { setError("Eroare la ștergere."); } finally { setSaving(false); }
  }

  // ── items CRUD ──
  async function saveItemEdit() {
    const f = itemEditForm();
    if (!f.name.trim() || !f.price || !f.unit.trim() || !f.category_id) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/items/${itemEditId()}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: f.name.trim(), description: f.description.trim() || null,
          price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
        }),
      });
      if (!res.ok) throw new Error();
      setItemEditId(null);
      await loadItems();
    } catch { setError("Eroare la salvare."); } finally { setSaving(false); }
  }

  async function saveItemAdd() {
    const f = itemNewForm();
    if (!f.name.trim() || !f.price || !f.unit.trim() || !f.category_id) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({
          name: f.name.trim(), description: f.description.trim() || null,
          price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
        }),
      });
      if (!res.ok) throw new Error();
      setItemNewForm({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: itemNewForm().category_id });
      setItemAddMode(false);
      await loadItems();
    } catch { setError("Eroare la adăugare."); } finally { setSaving(false); }
  }

  async function confirmItemDelete() {
    const it = itemDeleteTarget(); if (!it) return;
    setSaving(true); setError(null); setItemDeleteTarget(null);
    try {
      await apiFetch(`/api/items/${it.id}`, { method: "DELETE" });
      await loadItems();
    } catch { setError("Eroare la ștergere."); } finally { setSaving(false); }
  }

  // ── export helpers ──
  function filterLabel() {
    const parts: string[] = [];
    const dept = filterDeptId();
    if (dept !== null) parts.push("Departament: " + (departments().find(d => d.id === dept)?.name ?? dept));
    const cat = itemFilterCatId();
    if (cat !== null) parts.push("Categorie: " + (categories().find(c => c.id === cat)?.name ?? cat));
    if (itemFilterType() !== "all") parts.push("Tip: " + (itemFilterType() === "Service" ? "Servicii" : "Produse"));
    return parts.length > 0 ? parts.join(" | ") : "Toate";
  }

  function doCatCSV() {
    const label = filterLabel();
    exportCSV("Categorii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Categorie", "Departament"],
      categories().map(c => [c.name, departments().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doCatPDF() {
    const label = filterLabel();
    exportPDF("Categorii" + (label !== "Toate" ? " — " + label : ""),
      ["Categorie", "Departament"],
      categories().map(c => [c.name, departments().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doItemCSV() {
    const label = filterLabel();
    exportCSV("Produse_si_Servicii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }
  function doItemPDF() {
    const label = filterLabel();
    exportPDF("Produse și Servicii" + (label !== "Toate" ? " — " + label : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }

  function ItemForm(props: { f: typeof itemNewForm extends () => infer T ? T : never; setF: (v: any) => void; }) {
    return (
      <div class="cfg-location-fields">
        <input class="input" placeholder="Nume *" value={props.f.name} onInput={e => props.setF({ ...props.f, name: e.currentTarget.value })} />
        <input class="input" placeholder="Descriere" value={props.f.description} onInput={e => props.setF({ ...props.f, description: e.currentTarget.value })} />
        <div style="display:flex;gap:8px">
          <input class="input" style="flex:1" type="number" step="0.01" min="0" placeholder="Preț *" value={props.f.price} onInput={e => props.setF({ ...props.f, price: e.currentTarget.value })} />
          <input class="input" style="width:100px" placeholder="UM *" value={props.f.unit} onInput={e => props.setF({ ...props.f, unit: e.currentTarget.value })} />
        </div>
        <div style="display:flex;gap:8px">
          <button class={`btn btn-sm ${props.f.type === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Produs" })}>Produs</button>
          <button class={`btn btn-sm ${props.f.type === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Service" })}>Serviciu</button>
        </div>
        <select class="input" value={props.f.category_id} onChange={e => props.setF({ ...props.f, category_id: parseInt(e.currentTarget.value) })}>
          <option value={0} disabled>Selectează categorie *</option>
          <For each={categories()}>
            {(c) => <option value={c.id}>{c.name}</option>}
          </For>
        </select>
      </div>
    );
  }

  return (
    <div class="cfg-panel">
      <Show when={catDeleteTarget()}>
        <DeleteModal label={catDeleteTarget()!.name} saving={saving()} onConfirm={confirmCatDelete} onCancel={() => setCatDeleteTarget(null)} />
      </Show>
      <Show when={itemDeleteTarget()}>
        <DeleteModal label={itemDeleteTarget()!.name} saving={saving()} onConfirm={confirmItemDelete} onCancel={() => setItemDeleteTarget(null)} />
      </Show>

      {/* ── Header ── */}
      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Produse și Servicii</h2>
        <Show when={activeTab() === "categorii"}>
          <ExportMenu onCSV={doCatCSV} onPDF={doCatPDF} />
          <button class="btn btn-sm btn-primary" onClick={() => { setCatAddMode(true); setCatEditId(null); setError(null); }}>+ Adaugă</button>
        </Show>
        <Show when={activeTab() === "produse"}>
          <ExportMenu onCSV={doItemCSV} onPDF={doItemPDF} />
          <button class="btn btn-sm btn-primary" onClick={() => { setItemAddMode(true); setItemEditId(null); setError(null); }}>+ Adaugă</button>
        </Show>
      </div>

      {/* ── Filters (all at top) ── */}
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        <Show when={departments().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${filterDeptId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(null)}>Toate departamentele</button>
            <For each={departments()}>
              {(d) => <button class={`btn btn-sm ${filterDeptId() === d.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(d.id)}>{d.name}</button>}
            </For>
          </div>
        </Show>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class={`btn btn-sm ${itemFilterType() === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("all")}>Toate</button>
          <button class={`btn btn-sm ${itemFilterType() === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Produs")}>Produse</button>
          <button class={`btn btn-sm ${itemFilterType() === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Service")}>Servicii</button>
        </div>
        <Show when={categories().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${itemFilterCatId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(null)}>Toate categoriile</button>
            <For each={categories()}>
              {(c) => <button class={`btn btn-sm ${itemFilterCatId() === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(c.id)}>{c.name}</button>}
            </For>
          </div>
        </Show>
        <Show when={activeTab() === "produse"}>
          <div><button class="btn btn-sm btn-primary" onClick={loadItems}>Caută</button></div>
        </Show>
      </div>

      {/* ── Tabs ── */}
      <div class="cfg-tabs">
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "categorii" }} onClick={() => switchTab("categorii")}>
          Categorii <span class="cfg-tab-count">{categories().length}</span>
        </button>
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "produse" }} onClick={() => switchTab("produse")}>
          Produse și Servicii <span class="cfg-tab-count">{items().length}</span>
        </button>
      </div>

      <Show when={error()}><p class="cfg-error" style="margin-top:8px">{error()}</p></Show>

      {/* ── Categorii tab ── */}
      <Show when={activeTab() === "categorii"}>
        <Show when={catAddMode()}>
          <div class="cfg-location-row cfg-location-row--edit" style="margin-top:12px">
            <div class="cfg-location-fields">
              <input class="input" placeholder="Nume categorie *" value={catNewName()} onInput={e => setCatNewName(e.currentTarget.value)} />
              <select class="input" value={catNewDeptId() ?? 0} onChange={e => setCatNewDeptId(parseInt(e.currentTarget.value))}>
                <option value={0} disabled>Selectează departament *</option>
                <For each={departments()}>
                  {(d) => <option value={d.id}>{d.name}</option>}
                </For>
              </select>
            </div>
            <div class="cfg-location-actions" style="margin-top:8px">
              <button class="btn btn-sm btn-ghost" onClick={() => { setCatAddMode(false); setError(null); }}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving() || !catNewName().trim() || !catNewDeptId()} onClick={saveCatAdd}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={catsLoading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!catsLoading() && categories().length === 0}>
          <p class="cfg-hint">Nu există categorii{filterDeptId() ? " pentru acest departament" : ""}.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={categories()}>
            {(c) => (
              <Show when={catEditId() === c.id} fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{c.name}</span>
                    <span class="cfg-location-desc">{departments().find(d => d.id === c.department_id)?.name ?? ""}</span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => { setCatEditId(c.id); setCatEditName(c.name); setCatEditDeptId(c.department_id); setError(null); }}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setCatDeleteTarget(c)}>Șterge</button>
                  </div>
                </div>
              }>
                <div class="cfg-location-row cfg-location-row--edit">
                  <div class="cfg-location-fields">
                    <input class="input" placeholder="Nume *" value={catEditName()} onInput={e => setCatEditName(e.currentTarget.value)} />
                    <select class="input" value={catEditDeptId() ?? 0} onChange={e => setCatEditDeptId(parseInt(e.currentTarget.value))}>
                      <For each={departments()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
                    </select>
                  </div>
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost" onClick={() => setCatEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving() || !catEditName().trim()} onClick={saveCatEdit}>Salvează</button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>

      {/* ── Produse tab ── */}
      <Show when={activeTab() === "produse"}>
        <Show when={itemAddMode()}>
          <div class="cfg-location-row cfg-location-row--edit" style="margin-top:12px;margin-bottom:12px">
            <ItemForm f={itemNewForm()} setF={setItemNewForm} />
            <div class="cfg-location-actions" style="margin-top:8px">
              <button class="btn btn-sm btn-ghost" onClick={() => { setItemAddMode(false); setError(null); }}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveItemAdd}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={itemsLoading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!itemsLoading() && items().length === 0}>
          <p class="cfg-hint">Apasă "Caută" pentru a încărca produsele și serviciile.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={items()}>
            {(it) => (
              <Show when={itemEditId() === it.id} fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">
                      {it.name}
                      <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": it.type === "Service" }}>
                        {it.type === "Service" ? "Serviciu" : "Produs"}
                      </span>
                    </span>
                    <span class="cfg-location-desc">{it.category_name ?? ""} · {parseFloat(it.price).toFixed(2)} RON / {it.unit}</span>
                    <Show when={it.description}>
                      <span class="cfg-location-desc" style="font-style:italic">{it.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => {
                      setItemEditId(it.id);
                      setItemEditForm({ name: it.name, description: it.description ?? "", price: it.price, unit: it.unit, type: it.type, category_id: it.category_id });
                      setError(null);
                    }}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setItemDeleteTarget(it)}>Șterge</button>
                  </div>
                </div>
              }>
                <div class="cfg-location-row cfg-location-row--edit">
                  <ItemForm f={itemEditForm()} setF={setItemEditForm} />
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost" onClick={() => setItemEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveItemEdit}>Salvează</button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ─── Companii panel ───────────────────────────────────────────────────────────

function CompaniiPanel() {
  const [items, setItems]     = createSignal<CompanyItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch]   = createSignal("");

  // Add form state
  const [addMode, setAddMode] = createSignal(false);
  const [cuiInput, setCuiInput]   = createSignal("");
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError]     = createSignal<string | null>(null);
  const [form, setForm] = createSignal<Partial<CompanyItem>>({});

  // Edit state
  const [editId, setEditId] = createSignal<number | null>(null);
  const [editForm, setEditForm] = createSignal<Partial<CompanyItem>>({});

  const [deleteTarget, setDeleteTarget] = createSignal<CompanyItem | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? items().filter(c =>
      c.name.toLowerCase().includes(q) ||
      String(c.cui).includes(q) ||
      (c.nr_reg_com ?? "").toLowerCase().includes(q)
    ) : items();
  });

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/companies?limit=200");
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

  async function searchAnaf() {
    const cui = parseInt(cuiInput().replace(/\D/g, ""));
    if (!cui) return;
    setAnafLoading(true);
    setAnafError(null);
    try {
      const res = await apiFetch(`/api/companies/anaf/${cui}`);
      if (res.status === 404) { setAnafError("CUI-ul nu a fost găsit în ANAF."); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm(data);
    } catch {
      setAnafError("Eroare la interogarea ANAF. Verificați conexiunea.");
    } finally {
      setAnafLoading(false);
    }
  }

  function patchForm(key: keyof CompanyItem, val: string | boolean | null) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function patchEditForm(key: keyof CompanyItem, val: string | boolean | null) {
    setEditForm(f => ({ ...f, [key]: val }));
  }

  async function addItem() {
    const f = form();
    if (!f.name?.trim() || !f.cui) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/companies", {
        method: "POST",
        body: JSON.stringify({ ...f, name: f.name!.trim() }),
      });
      if (!res.ok) throw new Error();
      setAddMode(false); setForm({}); setCuiInput(""); setAnafError(null);
      await load();
    } catch {
      setError("Eroare la adăugare.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: CompanyItem) {
    setEditId(c.id);
    setEditForm({ ...c });
    setAddMode(false); setError(null);
  }

  async function saveEdit() {
    const f = editForm();
    if (!f.name?.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/companies/${editId()}`, {
        method: "PATCH",
        body: JSON.stringify({ ...f, name: f.name!.trim() }),
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
    const c = deleteTarget();
    if (!c) return;
    setSaving(true); setError(null); setDeleteTarget(null);
    try {
      await apiFetch(`/api/companies/${c.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Eroare la ștergere.");
    } finally {
      setSaving(false);
    }
  }

  function doExportCSV() {
    exportCSV("Companii",
      ["#", "CUI", "Denumire", "Nr. Reg. Com.", "Adresă", "Telefon", "Cod poștal", "Plătitor TVA", "Descriere", "Comentarii"],
      filtered().map((c, i) => [
        String(i + 1), String(c.cui), c.name, c.nr_reg_com ?? "", c.address ?? "",
        c.phone ?? "", c.postal_code ?? "",
        c.is_vat_payer === true ? "Da" : c.is_vat_payer === false ? "Nu" : "",
        c.description ?? "", c.comments ?? "",
      ]));
  }
  function doExportPDF() {
    exportPDF("Companii",
      ["#", "CUI", "Denumire", "Nr. Reg. Com.", "Adresă", "TVA"],
      filtered().map((c, i) => [
        String(i + 1), String(c.cui), c.name, c.nr_reg_com ?? "", c.address ?? "",
        c.is_vat_payer === true ? "Da" : c.is_vat_payer === false ? "Nu" : "",
      ]));
  }

  const f = () => form();
  const ef = () => editForm();

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
        <h2 class="cfg-panel-title">Companii</h2>
        <input class="input cfg-search" placeholder="Caută CUI / denumire..." value={search()} onInput={e => setSearch(e.currentTarget.value)} />
        <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
        <button class="btn btn-sm btn-primary" onClick={() => { setAddMode(true); setEditId(null); setForm({}); setCuiInput(""); setAnafError(null); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      {/* ── Add form ── */}
      <Show when={addMode()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <div class="cfg-anaf-row">
            <input
              class="input"
              placeholder="CUI (fără RO) *"
              value={cuiInput()}
              onInput={e => setCuiInput(e.currentTarget.value)}
              onKeyDown={e => e.key === "Enter" && searchAnaf()}
            />
            <button class="btn btn-sm btn-ghost" disabled={anafLoading() || !cuiInput().trim()} onClick={searchAnaf}>
              {anafLoading() ? "Se caută..." : "Caută în ANAF"}
            </button>
          </div>
          <Show when={anafError()}>
            <p class="cfg-hint cfg-hint--warn">{anafError()}</p>
          </Show>
          <div class="cfg-location-fields cfg-company-fields">
            <input class="input" placeholder="Denumire *" value={f().name ?? ""} onInput={e => patchForm("name", e.currentTarget.value)} />
            <input class="input" placeholder="Adresă" value={f().address ?? ""} onInput={e => patchForm("address", e.currentTarget.value)} />
            <input class="input" placeholder="Nr. Reg. Comerțului" value={f().nr_reg_com ?? ""} onInput={e => patchForm("nr_reg_com", e.currentTarget.value)} />
            <input class="input" placeholder="Telefon" value={f().phone ?? ""} onInput={e => patchForm("phone", e.currentTarget.value)} />
            <input class="input" placeholder="Cod poștal" value={f().postal_code ?? ""} onInput={e => patchForm("postal_code", e.currentTarget.value)} />
            <input class="input" placeholder="Status înregistrare" value={f().registration_status ?? ""} onInput={e => patchForm("registration_status", e.currentTarget.value)} />
            <label class="cfg-checkbox-row">
              <input type="checkbox" checked={f().is_vat_payer ?? false} onChange={e => patchForm("is_vat_payer", e.currentTarget.checked)} />
              Plătitor TVA
            </label>
            <textarea class="input cfg-textarea" placeholder="Descriere" value={f().description ?? ""} onInput={e => patchForm("description", e.currentTarget.value)} />
            <textarea class="input cfg-textarea" placeholder="Comentarii" value={f().comments ?? ""} onInput={e => patchForm("comments", e.currentTarget.value)} />
          </div>
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !f().name?.trim() || !f().cui} onClick={addItem}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!loading() && filtered().length === 0}>
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există companii. Apasă \"+ Adaugă\" pentru a crea una."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(c) => (
            <Show
              when={editId() === c.id}
              fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{c.name}</span>
                    <span class="cfg-location-desc">
                      CUI: {c.cui}
                      {c.nr_reg_com ? ` · ${c.nr_reg_com}` : ""}
                      {c.is_vat_payer ? " · Plătitor TVA" : ""}
                    </span>
                    <Show when={c.address}>
                      <span class="cfg-location-desc">{c.address}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(c)}>Șterge</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields cfg-company-fields">
                  <input class="input" placeholder="CUI *" value={ef().cui ?? ""} onInput={e => patchEditForm("cui", e.currentTarget.value)} />
                  <input class="input" placeholder="Denumire *" value={ef().name ?? ""} onInput={e => patchEditForm("name", e.currentTarget.value)} />
                  <input class="input" placeholder="Adresă" value={ef().address ?? ""} onInput={e => patchEditForm("address", e.currentTarget.value)} />
                  <input class="input" placeholder="Nr. Reg. Comerțului" value={ef().nr_reg_com ?? ""} onInput={e => patchEditForm("nr_reg_com", e.currentTarget.value)} />
                  <input class="input" placeholder="Telefon" value={ef().phone ?? ""} onInput={e => patchEditForm("phone", e.currentTarget.value)} />
                  <input class="input" placeholder="Cod poștal" value={ef().postal_code ?? ""} onInput={e => patchEditForm("postal_code", e.currentTarget.value)} />
                  <input class="input" placeholder="Status înregistrare" value={ef().registration_status ?? ""} onInput={e => patchEditForm("registration_status", e.currentTarget.value)} />
                  <label class="cfg-checkbox-row">
                    <input type="checkbox" checked={ef().is_vat_payer ?? false} onChange={e => patchEditForm("is_vat_payer", e.currentTarget.checked)} />
                    Plătitor TVA
                  </label>
                  <textarea class="input cfg-textarea" placeholder="Descriere" value={ef().description ?? ""} onInput={e => patchEditForm("description", e.currentTarget.value)} />
                  <textarea class="input cfg-textarea" placeholder="Comentarii" value={ef().comments ?? ""} onInput={e => patchEditForm("comments", e.currentTarget.value)} />
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-primary" disabled={saving() || !ef().name?.trim()} onClick={saveEdit}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Register panel ───────────────────────────────────────────────────────────

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

function RegisterPanel() {
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

          <span class="cfg-register-label">Factură</span>
          <input class="input" placeholder="Serie" value={f().factura_serie} onInput={e => s({ factura_serie: e.currentTarget.value })} />
          <input class="input" type="number" min="0" placeholder="Număr" value={f().factura_numar} onInput={e => s({ factura_numar: parseInt(e.currentTarget.value) || 0 })} />

          <span class="cfg-register-label">Chitanță</span>
          <input class="input" placeholder="Serie" value={f().chitanta_serie} onInput={e => s({ chitanta_serie: e.currentTarget.value })} />
          <input class="input" type="number" min="0" placeholder="Număr" value={f().chitanta_numar} onInput={e => s({ chitanta_numar: parseInt(e.currentTarget.value) || 0 })} />

          <span class="cfg-register-label">Aviz însoțire</span>
          <input class="input" placeholder="Serie" value={f().aviz_serie} onInput={e => s({ aviz_serie: e.currentTarget.value })} />
          <input class="input" type="number" min="0" placeholder="Număr" value={f().aviz_numar} onInput={e => s({ aviz_numar: parseInt(e.currentTarget.value) || 0 })} />
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
                      Deviz: {r.deviz_serie || "—"} / {r.deviz_numar} &nbsp;·&nbsp;
                      Factură: {r.factura_serie || "—"} / {r.factura_numar} &nbsp;·&nbsp;
                      Chitanță: {r.chitanta_serie || "—"} / {r.chitanta_numar} &nbsp;·&nbsp;
                      Aviz însoțire: {r.aviz_serie || "—"} / {r.aviz_numar}
                    </span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(r)}>Editează</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(r)}>Șterge</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <RegFormFields f={editForm()} setF={setEditForm} />
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-primary" disabled={saving() || !editForm().name.trim() || !editForm().company_id} onClick={() => saveEdit(r.id)}>Salvează</button>
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Topics ──────────────────────────────────────────────────────────────────

const TOPICS = [
  { id: "locatii",        label: "Locații",             panel: LocatiiPanel },
  { id: "departamente",   label: "Departamente",         panel: DepartamentePanel },
  { id: "angajati",       label: "Angajați",             panel: AngajatiPanel },
  { id: "produse",        label: "Produse și Servicii",  panel: ProduseSiServiciiPanel },
  { id: "companii",       label: "Companiile mele",       panel: CompaniiPanel },
  { id: "disclaimers",    label: "Disclaimers",             panel: DisclaimersPanel },
  { id: "registre",       label: "Registre",                panel: RegisterPanel },
] as const;

type TopicId = typeof TOPICS[number]["id"];

function WelcomePanel() {
  return (
    <div class="cfg-welcome">
      <h2 class="cfg-welcome-title">Configurări sistem</h2>
      <p class="cfg-welcome-text">
        Această secțiune îți permite să configurezi elementele de bază ale aplicației.
        Selectează un topic din meniul din stânga pentru a începe.
      </p>
      <div class="cfg-welcome-items">
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Locații</span>
          <span class="cfg-welcome-item-desc">
            Gestionează locațiile fizice ale afacerii. Fiecare locație poate fi asociată cu departamente și angajați specifici, și va fi legată de dispozitivele înregistrate.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Departamente</span>
          <span class="cfg-welcome-item-desc">
            Organizează produsele și serviciile pe departamente. Departamentele pot fi alocate locațiilor și sunt folosite pentru filtrarea catalogului în POS.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Angajați</span>
          <span class="cfg-welcome-item-desc">
            Gestionează angajații: adaugă, modifică sau șterge angajați și setează targetul lunar al fiecăruia.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Produse și Servicii</span>
          <span class="cfg-welcome-item-desc">
            Gestionează categoriile, produsele și serviciile din catalog. Filtrează după departament, categorie sau tip.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Companii</span>
          <span class="cfg-welcome-item-desc">
            Gestionează companiile partenere sau furnizori. Caută automat datele firmei după CUI prin serviciul ANAF.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Disclaimers</span>
          <span class="cfg-welcome-item-desc">
            Gestionează disclaimerele afișate pe bonuri sau documente. Adaugă, modifică sau șterge disclaimerele.
          </span>
        </div>
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Registre</span>
          <span class="cfg-welcome-item-desc">
            Gestionează seriile și numerele curente pentru Devize, Facturi, Chitanțe și Avize de însoțire a mărfii.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Configurari() {
  const [active, setActive] = createSignal<TopicId | null>(null);

  return (
    <div class="cfg-layout">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurări</div>
        <For each={TOPICS}>
          {(t) => (
            <button
              class="cfg-sidebar-item"
              classList={{ "cfg-sidebar-item--active": active() === t.id }}
              onClick={() => setActive(t.id)}
            >{t.label}</button>
          )}
        </For>
      </aside>
      <main class="cfg-content">
        <Switch fallback={<WelcomePanel />}>
          <Match when={active() === "locatii"}><LocatiiPanel /></Match>
          <Match when={active() === "departamente"}><DepartamentePanel /></Match>
          <Match when={active() === "angajati"}><AngajatiPanel /></Match>
          <Match when={active() === "produse"}><ProduseSiServiciiPanel /></Match>
          <Match when={active() === "companii"}><CompaniiPanel /></Match>
          <Match when={active() === "disclaimers"}><DisclaimersPanel /></Match>
          <Match when={active() === "registre"}><RegisterPanel /></Match>
        </Switch>
      </main>
    </div>
  );
}
