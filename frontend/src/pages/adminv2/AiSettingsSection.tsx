import { Show, createResource, createSignal } from "solid-js";
import { Button } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { aiAdminApi, type AiSettings, type AiSettingsUpdate } from "../../api/radar";
import { errMsg } from "../radar/shared";
import "../radar/radar.css";

export default function AiSettingsSection() {
  const [settings, { mutate }] = createResource(() => aiAdminApi.settings());
  const [anthropicKey, setAnthropicKey] = createSignal("");
  const [placesKey, setPlacesKey] = createSignal("");
  const [model, setModel] = createSignal<string | null>(null);
  const [priceIn, setPriceIn] = createSignal<string | null>(null);
  const [priceOut, setPriceOut] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  const modelValue = () => model() ?? settings()?.ai_model ?? "";
  const priceInValue = () => priceIn() ?? String(settings()?.ai_price_in_usd_mtok ?? "");
  const priceOutValue = () => priceOut() ?? String(settings()?.ai_price_out_usd_mtok ?? "");

  function flag(set: boolean) {
    return <span class={set ? "badge badge--success" : "badge badge--danger"}>{set ? "setată" : "lipsă"}</span>;
  }

  async function save() {
    setSaving(true);
    try {
      const body: AiSettingsUpdate = {
        ai_model: modelValue().trim() || undefined,
        ai_price_in_usd_mtok: Number(priceInValue()) || 0,
        ai_price_out_usd_mtok: Number(priceOutValue()) || 0,
      };
      if (anthropicKey().trim()) body.anthropic_api_key = anthropicKey().trim();
      if (placesKey().trim()) body.google_places_api_key = placesKey().trim();
      const s: AiSettings = await aiAdminApi.saveSettings(body);
      mutate(s);
      setAnthropicKey("");
      setPlacesKey("");
      setModel(null);
      setPriceIn(null);
      setPriceOut(null);
      notify("Setări AI salvate.", "success");
    } catch (e) {
      notify(errMsg(e, "Eroare la salvarea setărilor AI."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="radar-page">
      <header class="radar-head">
        <div>
          <h1>AI Radar — chei și tarife</h1>
          <p class="radar-lead">
            Cheile sunt criptate în baza de date și nu se mai afișează după salvare. Lasă câmpul gol
            ca să păstrezi cheia existentă.
          </p>
        </div>
      </header>

      <Show when={settings()} fallback={<p class="radar-center">{settings.error ? "Indisponibil." : "Se încarcă…"}</p>}>
        {(s) => (
          <>
            <section class="radar-card">
              <h2>Chei API</h2>
              <div class="radar-card-body">
                <div class="radar-field">
                  <label class="form-label" for="ai-anthropic">Anthropic API key {flag(s().anthropic_api_key_set)}</label>
                  <input
                    id="ai-anthropic"
                    class="input"
                    type="password"
                    autocomplete="off"
                    value={anthropicKey()}
                    placeholder={s().anthropic_api_key_set ? "•••••••• (lasă gol = păstrează)" : "sk-ant-…"}
                    onInput={(e) => setAnthropicKey(e.currentTarget.value)}
                  />
                </div>
                <div class="radar-field">
                  <label class="form-label" for="ai-places">Google Places API key {flag(s().google_places_api_key_set)}</label>
                  <input
                    id="ai-places"
                    class="input"
                    type="password"
                    autocomplete="off"
                    value={placesKey()}
                    placeholder={s().google_places_api_key_set ? "•••••••• (lasă gol = păstrează)" : "AIza…"}
                    onInput={(e) => setPlacesKey(e.currentTarget.value)}
                  />
                  <span class="radar-muted">Necesară doar pentru sursele „Google Business” (recenzii).</span>
                </div>
              </div>
            </section>

            <section class="radar-card">
              <h2>Model și tarife</h2>
              <div class="radar-card-body">
                <div class="radar-field">
                  <label class="form-label" for="ai-model">Model</label>
                  <input
                    id="ai-model"
                    class="input"
                    value={modelValue()}
                    placeholder="claude-sonnet-5"
                    onInput={(e) => setModel(e.currentTarget.value)}
                  />
                  <span class="radar-muted">Implicit: claude-sonnet-5.</span>
                </div>
                <div class="radar-field">
                  <label class="form-label" for="ai-price-in">Preț input (USD / 1M tokeni)</label>
                  <input
                    id="ai-price-in"
                    class="input"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={priceInValue()}
                    onInput={(e) => setPriceIn(e.currentTarget.value)}
                  />
                </div>
                <div class="radar-field">
                  <label class="form-label" for="ai-price-out">Preț output (USD / 1M tokeni)</label>
                  <input
                    id="ai-price-out"
                    class="input"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={priceOutValue()}
                    onInput={(e) => setPriceOut(e.currentTarget.value)}
                  />
                </div>
              </div>
            </section>

            <div class="radar-toolbar">
              <span class="radar-spacer" />
              <Button loading={saving()} onClick={() => void save()}>Salvează</Button>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
