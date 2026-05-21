import { For, Show, createSignal, onMount } from "solid-js";
import {
  generalSettings,
  loadGeneralSettings,
  updateGeneralSettings,
} from "../../store/generalSettingsStore";
import type { GeneralSettingsData, GeneralSettingsPatch } from "../../store/generalSettingsStore";

type MontareRotiField = {
  key: keyof GeneralSettingsData;
  label: string;
  hint: string;
};

const MONTARE_ROTI_FIELDS: MontareRotiField[] = [
  { key: "montareRotiShowPresiune", label: "Presiune (bar)", hint: "Presiunea la care e umflată anvelopa, cu scurtături 2.2/2.5/2.8/3.0." },
  { key: "montareRotiShowMarca", label: "Marcă", hint: "Marca anvelopei (ex.: Michelin)." },
  { key: "montareRotiShowProfil", label: "Profil", hint: "Profilul anvelopei (ex.: Pilot Sport 4)." },
  { key: "montareRotiShowDimensiune", label: "Dimensiune", hint: "Dimensiunea anvelopei (ex.: 225/45 R17)." },
  { key: "montareRotiShowDot", label: "DOT", hint: "Codul DOT (săptămâna/anul fabricației)." },
  { key: "montareRotiShowTip", label: "Tip", hint: "Iarnă / Vară / M+S / Altele." },
  { key: "montareRotiShowAdancime", label: "Adâncime (mm)", hint: "Adâncimea profilului, cu scurtături." },
  { key: "montareRotiShowCuplu", label: "Cuplu strângere (Nm)", hint: "Cuplul recomandat de strângere a piulițelor." },
];

const HOTEL_ANVELOPE_FIELDS: MontareRotiField[] = [
  { key: "hotelAnvelopeShowProfil", label: "Profil", hint: "Profilul anvelopei (ex.: Pilot Sport 4)." },
  { key: "hotelAnvelopeShowDot", label: "DOT", hint: "Codul DOT (săptămâna/anul fabricației)." },
  { key: "hotelAnvelopeShowAdancime", label: "Adâncime (mm)", hint: "Adâncimea profilului anvelopei." },
  { key: "hotelAnvelopeShowTip", label: "Tip", hint: "Iarnă / Vară / M+S / Altele." },
];

export default function SetariGeneralePanel() {
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  onMount(() => { loadGeneralSettings(); });

  async function handleChange(patch: GeneralSettingsPatch) {
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

  const isChecked = (key: keyof GeneralSettingsData): boolean => {
    const s = generalSettings();
    if (!s) return true;
    return s[key] !== false;
  };

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

        <div style="display:flex;flex-direction:column;gap:10px;border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface)">
          <div>
            <h3 style="margin:0 0 4px;font-size:14px;font-weight:600">Afișare câmpuri Montare Roți</h3>
            <p class="cfg-hint" style="margin:0">
              Bifează câmpurile pe care vrei să le vezi în fereastra <strong>Montare Roți</strong> din POS.
              <strong> Poziția</strong> este mereu vizibilă.
            </p>
          </div>
          <For each={MONTARE_ROTI_FIELDS}>
            {(f) => (
              <div style="display:flex;flex-direction:column;gap:2px">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                  <input
                    type="checkbox"
                    checked={isChecked(f.key)}
                    disabled={saving()}
                    onChange={(e) => handleChange({ [f.key]: e.currentTarget.checked } as GeneralSettingsPatch)}
                  />
                  <span style="font-weight:500">{f.label}</span>
                </label>
                <p class="cfg-hint" style="margin:0 0 0 26px">{f.hint}</p>
              </div>
            )}
          </For>
        </div>

        <Show when={!generalSettings()?.dezactiveazaHotelAnvelope}>
          <div style="display:flex;flex-direction:column;gap:10px;border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface)">
            <div>
              <h3 style="margin:0 0 4px;font-size:14px;font-weight:600">Afișare câmpuri Hotel Anvelope</h3>
              <p class="cfg-hint" style="margin:0">
                Bifează câmpurile pe care vrei să le vezi când adaugi o anvelopă nouă în <strong>Hotel</strong>.
                <strong> Marca</strong> și <strong>Dimensiunea</strong> sunt mereu vizibile.
              </p>
            </div>
            <For each={HOTEL_ANVELOPE_FIELDS}>
              {(f) => (
                <div style="display:flex;flex-direction:column;gap:2px">
                  <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                    <input
                      type="checkbox"
                      checked={isChecked(f.key)}
                      disabled={saving()}
                      onChange={(e) => handleChange({ [f.key]: e.currentTarget.checked } as GeneralSettingsPatch)}
                    />
                    <span style="font-weight:500">{f.label}</span>
                  </label>
                  <p class="cfg-hint" style="margin:0 0 0 26px">{f.hint}</p>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={msg()}>
          <div style={{ color: msg()!.ok ? "var(--success, #3ea96a)" : "var(--danger)" }}>
            {msg()!.text}
          </div>
        </Show>
      </div>
    </div>
  );
}
