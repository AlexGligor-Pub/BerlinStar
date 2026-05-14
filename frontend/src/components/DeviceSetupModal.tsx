import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../utils/api";
import { pendingName, registerDevice } from "../store/deviceStore";

interface Location {
  id: number;
  name: string;
  description: string | null;
}

export default function DeviceSetupModal() {
  const [locations, setLocations] = createSignal<Location[]>([]);
  const [loading, setLoading]     = createSignal(true);
  const [saving, setSaving]       = createSignal(false);
  const [error, setError]         = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal(false);
  const [deviceName, setDeviceName]   = createSignal(pendingName);

  const [addingLocation, setAddingLocation] = createSignal(false);
  const [newLocName, setNewLocName]         = createSignal("");
  const [addingLocSaving, setAddingLocSaving] = createSignal(false);

  onMount(async () => {
    try {
      const res = await apiFetch("/api/locations?limit=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const locs: Location[] = data.items ?? [];
      if (locs.length === 1) {
        await registerDevice(locs[0].id, deviceName());
        return;
      }
      setLocations(locs);
    } catch {
      setError("Nu s-au putut incarca locatiile.");
    } finally {
      setLoading(false);
    }
  });

  async function selectLocation(id: number) {
    setSaving(true);
    setError(null);
    try {
      await registerDevice(id, deviceName());
    } catch {
      setError("Eroare la salvare. Incearca din nou.");
      setSaving(false);
    }
  }

  async function handleAddLocation(e: Event) {
    e.preventDefault();
    const name = newLocName().trim();
    if (!name) return;
    setAddingLocSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/locations", {
        method: "POST",
        body: JSON.stringify({ name, description: null, disclaimer_id: null, register_id: null, company_id: null }),
      });
      if (!res.ok) throw new Error();
      const loc: Location = await res.json();
      setLocations((prev) => [...prev, loc]);
      setNewLocName("");
      setAddingLocation(false);
    } catch {
      setError("Eroare la crearea locatiei. Incearca din nou.");
    } finally {
      setAddingLocSaving(false);
    }
  }

  return (
    <div class="device-modal-overlay">
      <div class="device-modal">
        <div class="device-modal-header">
          <h2 class="device-modal-title">Inregistrare dispozitiv</h2>
        </div>

        <div class="device-modal-name-row">
          <span class="device-modal-label">Numele dispozitivului</span>
          <Show when={!editingName()} fallback={
            <div class="device-name-edit-row">
              <input
                class="input device-name-input"
                value={deviceName()}
                onInput={(e) => setDeviceName(e.currentTarget.value)}
                autofocus
              />
              <button
                class="btn btn-sm btn-primary"
                onClick={() => {
                  if (deviceName().trim()) setDeviceName(deviceName().trim());
                  setEditingName(false);
                }}
              >OK</button>
            </div>
          }>
            <div class="device-name-display-row">
              <span class="device-modal-name">{deviceName()}</span>
              <button
                class="btn btn-sm btn-ghost device-name-edit-btn"
                title="Editeaza numele"
                aria-label="Editează numele dispozitivului"
                onClick={() => setEditingName(true)}
              >✏️</button>
            </div>
          </Show>
        </div>

        <div class="device-modal-section">
          <div class="device-section-title-row">
            <span class="device-modal-label">Selecteaza locatia</span>
            <button
              class="btn btn-sm btn-ghost"
              onClick={() => { setAddingLocation(true); setError(null); }}
            >+ Adauga locatie</button>
          </div>

          <Show when={addingLocation()}>
            <form class="device-add-loc-form" onSubmit={handleAddLocation}>
              <input
                class="input"
                placeholder="Numele locatiei"
                value={newLocName()}
                onInput={(e) => setNewLocName(e.currentTarget.value)}
                required
                autofocus
              />
              <div class="device-add-loc-actions">
                <button class="btn btn-primary btn-sm" type="submit" disabled={addingLocSaving()}>
                  {addingLocSaving() ? "Se salveaza..." : "Salveaza"}
                </button>
                <button class="btn btn-ghost btn-sm" type="button" onClick={() => { setAddingLocation(false); setNewLocName(""); }}>
                  Anuleaza
                </button>
              </div>
            </form>
          </Show>

          <Show when={loading()}>
            <p class="device-modal-hint">Se incarca locatiile...</p>
          </Show>
          <Show when={!loading() && locations().length === 0 && !addingLocation()}>
            <p class="device-modal-hint">Nu exista locatii. Adauga una pentru a continua.</p>
          </Show>
          <Show when={!loading() && locations().length > 0}>
            <div class="device-location-grid">
              <For each={locations()}>
                {(loc) => (
                  <button
                    class="device-location-btn"
                    disabled={saving()}
                    onClick={() => selectLocation(loc.id)}
                  >
                    <span class="device-location-name">{loc.name}</span>
                    <Show when={loc.description}>
                      <span class="device-location-desc">{loc.description}</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={error()}>
          <p class="device-modal-error">{error()}</p>
        </Show>
      </div>
    </div>
  );
}
