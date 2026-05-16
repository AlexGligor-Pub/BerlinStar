import { Show, createSignal, onMount } from "solid-js";
import { generalSettings, loadGeneralSettings, updateGeneralSettings } from "../../store/generalSettingsStore";

export default function SetariGeneralePanel() {
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  onMount(() => { loadGeneralSettings(); });

  async function handleChange(patch: Partial<{ useFactura: boolean; useAviz: boolean; afiseazaTehnicianDeviz: boolean; dezactiveazaHotelAnvelope: boolean }>) {
    setSaving(true);
    setMsg(null);
    try {
      await updateGeneralSettings(patch);
      setMsg({ ok: true, text: "Salvat." });
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? "Eroare la salvare." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Setări generale</h2>
      <div style="display:flex;flex-direction:column;gap:20px;max-width:520px">
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input
              type="checkbox"
              checked={generalSettings()?.useFactura !== false}
              disabled={saving()}
              onChange={(e) => handleChange({ useFactura: e.currentTarget.checked })}
            />
            <span style="font-weight:500">Activează Factură și Chitanță</span>
          </label>
          <p class="cfg-hint" style="margin:0 0 0 26px">
            Controlează vizibilitatea butoanelor de <strong>Factură</strong> și <strong>Chitanță</strong> din pagina
            <strong> Recepție</strong>. Când este dezactivat, aceste butoane sunt ascunse și nu pot fi generate documente
            de factură sau chitanță. De asemenea, ascunde câmpurile de serie și număr pentru Factură și Chitanță din
            secțiunea <strong>Registre</strong> (Configurări).
          </p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input
              type="checkbox"
              checked={generalSettings()?.useAviz !== false}
              disabled={saving()}
              onChange={(e) => handleChange({ useAviz: e.currentTarget.checked })}
            />
            <span style="font-weight:500">Activează Aviz de însoțire</span>
          </label>
          <p class="cfg-hint" style="margin:0 0 0 26px">
            Controlează vizibilitatea funcționalității de <strong>Aviz de însoțire a mărfii</strong>. Când este
            dezactivat, câmpurile de serie și număr pentru Aviz sunt ascunse din secțiunea
            <strong> Registre</strong> (Configurări). Funcționalitatea de generare aviz urmează să fie implementată.
          </p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input
              type="checkbox"
              checked={generalSettings()?.afiseazaTehnicianDeviz === true}
              disabled={saving()}
              onChange={(e) => handleChange({ afiseazaTehnicianDeviz: e.currentTarget.checked })}
            />
            <span style="font-weight:500">Afișează angajat/tehnician pe deviz</span>
          </label>
          <p class="cfg-hint" style="margin:0 0 0 26px">
            Când este activat, devizul generat va include o coloană <strong>Tehnician</strong> cu numele angajatului
            asociat fiecărui produs/serviciu.
          </p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input
              type="checkbox"
              checked={generalSettings()?.dezactiveazaHotelAnvelope === true}
              disabled={saving()}
              onChange={(e) => handleChange({ dezactiveazaHotelAnvelope: e.currentTarget.checked })}
            />
            <span style="font-weight:500">Dezactivează Hotel Anvelope</span>
          </label>
          <p class="cfg-hint" style="margin:0 0 0 26px">
            Când este activat, butonul <strong>Hotel Anvelope</strong> dispare din meniu și butonul
            <strong> Cazare Anvelope</strong> dispare din POS. Datele existente nu sunt șterse.
          </p>
        </div>
        <Show when={msg()}>
          <div style={{ color: msg()!.ok ? "var(--success, #3ea96a)" : "var(--danger)" }}>
            {msg()!.text}
          </div>
        </Show>
      </div>
    </div>
  );
}
