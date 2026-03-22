import { For, Show, Switch, Match, createSignal, onMount } from "solid-js";
import { apiFetch } from "../utils/api";

interface Location { id: number; name: string; description: string | null; department_ids: number[]; employee_ids: number[]; }
interface Department { id: number; name: string; description: string | null; }
interface Employee  { id: number; name: string; }
interface EmployeeItem { id: number; name: string; description: string | null; target: string; }

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

  // edit state
  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editDepartmentIds, setEditDepartmentIds] = createSignal<Set<number>>(new Set<number>());
  const [editEmpIds, setEditEmpIds]       = createSignal<Set<number>>(new Set<number>());
  const [allDepartments, setAllDepartments] = createSignal<Department[]>([]);
  const [allEmployees, setAllEmployees]   = createSignal<Employee[]>([]);
  const [editLoading, setEditLoading]     = createSignal(false);
  let cachedDepartments: Department[] | null = null;
  let cachedEmployees: Employee[] | null = null;

  // add form
  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  // delete confirm modal
  const [deleteTarget, setDeleteTarget] = createSignal<Location | null>(null);

  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

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

  onMount(loadLocations);

  async function startEdit(loc: Location) {
    setEditId(loc.id);
    setEditName(loc.name);
    setEditDesc(loc.description ?? "");
    setAddMode(false);
    setError(null);
    setEditDepartmentIds(new Set(loc.department_ids));
    setEditEmpIds(new Set(loc.employee_ids));

    if (cachedDepartments && cachedEmployees) {
      setAllDepartments(cachedDepartments);
      setAllEmployees(cachedEmployees);
      return;
    }

    setAllDepartments([]);
    setAllEmployees([]);
    setEditLoading(true);
    try {
      const fetches: Promise<Response>[] = [];
      if (!cachedDepartments) fetches.push(apiFetch("/api/departments?limit=200"));
      if (!cachedEmployees)   fetches.push(apiFetch("/api/employees?limit=200"));

      const results = await Promise.all(fetches);
      if (results.some(r => !r.ok)) throw new Error();
      const jsons = await Promise.all(results.map(r => r.json()));

      let idx = 0;
      if (!cachedDepartments) { cachedDepartments = jsons[idx++].items ?? []; }
      if (!cachedEmployees)   { cachedEmployees   = jsons[idx++].items ?? []; }

      setAllDepartments(cachedDepartments!);
      setAllEmployees(cachedEmployees!);
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
          body: JSON.stringify({ name: editName().trim(), description: editDesc().trim() || null }),
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
      <Show when={!loading() && locations().length === 0}>
        <p class="cfg-hint">Nu există locații. Apasă "+ Adaugă" pentru a crea una.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={locations()}>
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

                <Show when={!editLoading() && allDepartments().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Departamente</span>
                      <div class="cfg-assoc-btns">
                        <button class="cfg-assoc-btn" onClick={() => setEditDepartmentIds(new Set(allDepartments().map(d => d.id)))}>Toate</button>
                        <button class="cfg-assoc-btn" onClick={() => setEditDepartmentIds(new Set<number>())}>Niciuna</button>
                      </div>
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
                  </div>
                </Show>

                <Show when={!editLoading() && allEmployees().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Angajați</span>
                      <div class="cfg-assoc-btns">
                        <button class="cfg-assoc-btn" onClick={() => setEditEmpIds(new Set(allEmployees().map(e => e.id)))}>Toți</button>
                        <button class="cfg-assoc-btn" onClick={() => setEditEmpIds(new Set<number>())}>Niciunul</button>
                      </div>
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
  const [items, setItems]   = createSignal<Department[]>([]);
  const [loading, setLoading] = createSignal(true);

  const [editId, setEditId]       = createSignal<number | null>(null);
  const [editName, setEditName]   = createSignal("");
  const [editDesc, setEditDesc]   = createSignal("");

  const [addMode, setAddMode] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");

  const [deleteTarget, setDeleteTarget] = createSignal<Department | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError]   = createSignal<string | null>(null);

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
      <Show when={!loading() && items().length === 0}>
        <p class="cfg-hint">Nu există departamente. Apasă "+ Adaugă" pentru a crea unul.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={items()}>
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
      <Show when={!loading() && items().length === 0}>
        <p class="cfg-hint">Nu există angajați. Apasă "+ Adaugă" pentru a crea unul.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={items()}>
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

// ─── Topics ──────────────────────────────────────────────────────────────────

const TOPICS = [
  { id: "locatii",       label: "Locații",       panel: LocatiiPanel },
  { id: "departamente",  label: "Departamente",  panel: DepartamentePanel },
  { id: "angajati",      label: "Angajați",      panel: AngajatiPanel },
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
        </Switch>
      </main>
    </div>
  );
}
