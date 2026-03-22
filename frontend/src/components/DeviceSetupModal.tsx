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

  onMount(async () => {
    try {
      const res = await apiFetch("/api/locations?limit=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const locs: Location[] = data.items ?? [];
      if (locs.length === 1) {
        await registerDevice(locs[0].id);
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
      await registerDevice(id);
    } catch {
      setError("Eroare la salvare. Incearca din nou.");
      setSaving(false);
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
          <span class="device-modal-name">{pendingName}</span>
        </div>

        <div class="device-modal-section">
          <span class="device-modal-label">Selecteaza locatia</span>
          <Show when={loading()}>
            <p class="device-modal-hint">Se incarca locatiile...</p>
          </Show>
          <Show when={!loading() && locations().length === 0}>
            <p class="device-modal-hint">Nu exista locatii configurate.</p>
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
