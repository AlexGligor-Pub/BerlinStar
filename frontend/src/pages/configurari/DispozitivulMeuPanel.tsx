import { For, Show, createSignal, onMount } from "solid-js";
import { locationsApi, type LocationDetail } from "../../api/locations";
import { createListResource, useAction } from "../../hooks";
import { device, updateDevice } from "../../store/deviceStore";

export default function DispozitivulMeuPanel() {
  const locations = createListResource<LocationDetail>({ fetcher: () => locationsApi.listAll() });
  const [selectedLoc, setSelectedLoc] = createSignal<number | "">(device()?.locationId ?? "");
  const [msg, setMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  onMount(() => setSelectedLoc(device()?.locationId ?? ""));

  const currentLocationName = () => {
    const d = device();
    const loc = locations.items().find(l => l.id === d?.locationId);
    return loc ? loc.name : d?.locationId != null ? `ID ${d.locationId}` : "—";
  };

  const save = useAction({
    fn: (locId: number | null) => updateDevice(locId),
    onSuccess: () => setMsg({ ok: true, text: "Locație actualizată cu succes." }),
    onError: (err) => setMsg({ ok: false, text: err }),
    silentError: true,
  });

  function handleSave() {
    setMsg(null);
    const locId = selectedLoc() === "" ? null : Number(selectedLoc());
    void save.run(locId);
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
              <For each={locations.items()}>
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
            <button class="btn btn-sm btn-primary" onClick={handleSave} disabled={save.loading()}>
              {save.loading() ? "Se salvează..." : "Salvează locația"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
