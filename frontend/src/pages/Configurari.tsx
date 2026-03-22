import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../utils/api";

interface Location  { id: number; name: string; description: string | null; }
interface LocationDetail extends Location { theme_ids: number[]; employee_ids: number[]; }
interface Theme     { id: number; name: string; }
interface Employee  { id: number; name: string; }

// ─── Locatii panel ───────────────────────────────────────────────────────────

function LocatiiPanel() {
  const [locations, setLocations] = createSignal<Location[]>([]);
  const [loading, setLoading]     = createSignal(true);

  // edit state
  const [editId, setEditId]               = createSignal<number | null>(null);
  const [editName, setEditName]           = createSignal("");
  const [editDesc, setEditDesc]           = createSignal("");
  const [editThemeIds, setEditThemeIds]   = createSignal<Set<number>>(new Set<number>());
  const [editEmpIds, setEditEmpIds]       = createSignal<Set<number>>(new Set<number>());
  const [allThemes, setAllThemes]         = createSignal<Theme[]>([]);
  const [allEmployees, setAllEmployees]   = createSignal<Employee[]>([]);
  const [editLoading, setEditLoading]     = createSignal(false);
  let cachedThemes:    Theme[]    | null = null;
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
    setAllThemes([]);
    setAllEmployees([]);
    setEditThemeIds(new Set<number>());
    setEditEmpIds(new Set<number>());
    setEditLoading(true);
    try {
      const fetches: Promise<Response>[] = [apiFetch(`/api/locations/${loc.id}`)];
      if (!cachedThemes)    fetches.push(apiFetch("/api/themes?limit=200"));
      if (!cachedEmployees) fetches.push(apiFetch("/api/employees?limit=200"));

      const results = await Promise.all(fetches);
      if (results.some(r => !r.ok)) throw new Error();
      const jsons = await Promise.all(results.map(r => r.json()));

      const detail: LocationDetail = jsons[0];
      let idx = 1;
      if (!cachedThemes)    { cachedThemes    = jsons[idx++].items ?? []; }
      if (!cachedEmployees) { cachedEmployees = jsons[idx++].items ?? []; }

      setEditThemeIds(new Set(detail.theme_ids));
      setEditEmpIds(new Set(detail.employee_ids));
      setAllThemes(cachedThemes!);
      setAllEmployees(cachedEmployees!);
    } catch {
      setError("Eroare la incarcarea datelor.");
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
        apiFetch(`/api/locations/${id}/themes`, {
          method: "PUT",
          body: JSON.stringify({ ids: Array.from(editThemeIds()) }),
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
      {/* Delete confirm modal */}
      <Show when={deleteTarget()}>
        <div class="cfg-confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div class="cfg-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p class="cfg-confirm-text">
              Stergi locatia <strong>{deleteTarget()!.name}</strong>?
            </p>
            <div class="cfg-confirm-actions">
              <button class="btn btn-sm btn-ghost" onClick={() => setDeleteTarget(null)}>Anuleaza</button>
              <button class="btn btn-sm btn-danger" disabled={saving()} onClick={confirmDelete}>Sterge</button>
            </div>
          </div>
        </div>
      </Show>

      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Locatii</h2>
        <button class="btn btn-sm btn-primary" onClick={() => { setAddMode(true); setEditId(null); }}>
          + Adauga
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
            <button class="btn btn-sm btn-primary" disabled={saving() || !newName().trim()} onClick={addLocation}>Salveaza</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anuleaza</button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="cfg-hint">Se incarca...</p>
      </Show>
      <Show when={!loading() && locations().length === 0}>
        <p class="cfg-hint">Nu exista locatii. Apasa "+ Adauga" pentru a crea una.</p>
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
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(loc)}>Editeaza</button>
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(loc)}>Sterge</button>
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
                  <p class="cfg-hint">Se incarca teme si angajati...</p>
                </Show>

                <Show when={!editLoading() && allThemes().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Teme</span>
                      <div class="cfg-assoc-btns">
                        <button class="cfg-assoc-btn" onClick={() => setEditThemeIds(new Set(allThemes().map(t => t.id)))}>Toate</button>
                        <button class="cfg-assoc-btn" onClick={() => setEditThemeIds(new Set<number>())}>Niciuna</button>
                      </div>
                    </div>
                    <div class="cfg-chip-grid">
                      <For each={allThemes()}>
                        {(t) => (
                          <button
                            class="cfg-chip"
                            classList={{ "cfg-chip--active": editThemeIds().has(t.id) }}
                            onClick={() => setEditThemeIds(toggleNum(editThemeIds(), t.id))}
                          >{t.name}</button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={!editLoading() && allEmployees().length > 0}>
                  <div class="cfg-assoc-section">
                    <div class="cfg-assoc-header">
                      <span class="cfg-assoc-label">Angajati</span>
                      <div class="cfg-assoc-btns">
                        <button class="cfg-assoc-btn" onClick={() => setEditEmpIds(new Set(allEmployees().map(e => e.id)))}>Toti</button>
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
                  <button class="btn btn-sm btn-primary" disabled={saving() || editLoading() || !editName().trim()} onClick={saveEdit}>Salveaza</button>
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anuleaza</button>
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
  { id: "locatii", label: "Locatii", panel: LocatiiPanel },
] as const;

type TopicId = typeof TOPICS[number]["id"];

function WelcomePanel() {
  return (
    <div class="cfg-welcome">
      <h2 class="cfg-welcome-title">Configurari sistem</h2>
      <p class="cfg-welcome-text">
        Aceasta sectiune iti permite sa configurezi elementele de baza ale aplicatiei.
        Selecteaza un topic din meniul din stanga pentru a incepe.
      </p>
      <div class="cfg-welcome-items">
        <div class="cfg-welcome-item">
          <span class="cfg-welcome-item-title">Locatii</span>
          <span class="cfg-welcome-item-desc">
            Gestioneaza locatiile fizice ale afacerii. Fiecare locatie poate fi asociata cu teme si angajati specifici, si va fi legata de dispozitivele inregistrate.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Configurari() {
  const [active, setActive] = createSignal<TopicId | null>(null);
  const ActivePanel = () => {
    const a = active();
    if (!a) return <WelcomePanel />;
    return TOPICS.find((t) => t.id === a)!.panel();
  };

  return (
    <div class="cfg-layout">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurari</div>
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
        <ActivePanel />
      </main>
    </div>
  );
}
