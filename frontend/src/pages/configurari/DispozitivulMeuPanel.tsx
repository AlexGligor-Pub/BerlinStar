import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../../utils/api";
import { device, updateDevice } from "../../store/deviceStore";
import type { Location } from "./types";

export default function DispozitivulMeuPanel() {
  const [locations, setLocations] = createSignal<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = createSignal<number | "">(device()?.locationId ?? "");
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  onMount(async () => {
    const res = await apiFetch("/api/locations?limit=200");
    if (res.ok) {
      const data = await res.json();
      setLocations(data.items ?? data);
    }
    setSelectedLoc(device()?.locationId ?? "");
  });

  const currentLocationName = () => {
    const d = device();
    const loc = locations().find(l => l.id === d?.locationId);
    return loc ? loc.name : d?.locationId != null ? `ID ${d.locationId}` : "—";
  };

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const locId = selectedLoc() === "" ? null : Number(selectedLoc());
      await updateDevice(locId);
      setMsg({ ok: true, text: "Locație actualizată cu succes." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? "Eroare la salvare." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Dispozitivul meu</h2>
      <Show when={!device()}>
        <p style="color:var(--text2)">Dispozitivul nu este înregistrat în această sesiune.</p>
      </Show>
      <Show when={device()}>
        <div style="display:flex;flex-direction:column;gap:12px;max-width:400px">
          <div>
            <div class="cfg-assoc-label">Nume dispozitiv</div>
            <div style="margin-top:4px;font-size:0.95rem">{device()!.name}</div>
          </div>
          <div>
            <div class="cfg-assoc-label">Locație curentă</div>
            <div style="margin-top:4px;font-size:0.95rem">{currentLocationName()}</div>
          </div>
          <div>
            <div class="cfg-assoc-label" style="margin-bottom:6px">Schimbă locația</div>
            <select
              class="input"
              value={selectedLoc()}
              onInput={(e) => setSelectedLoc(e.currentTarget.value === "" ? "" : Number(e.currentTarget.value))}
            >
              <option value="">— fără locație —</option>
              <For each={locations()}>
                {(loc) => <option value={loc.id}>{loc.name}</option>}
              </For>
            </select>
          </div>
          <Show when={msg()}>
            <div style={{ color: msg()!.ok ? "var(--success, #3ea96a)" : "var(--danger)" }}>
              {msg()!.text}
            </div>
          </Show>
          <div>
            <button class="btn btn-sm btn-primary" onClick={handleSave} disabled={saving()}>
              {saving() ? "Se salvează..." : "Salvează locația"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
