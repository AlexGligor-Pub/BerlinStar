import { For, Show, createEffect, createSignal } from "solid-js";
import { Button } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { radarApi, type RadarSchedule, type RadarSettings } from "../../api/radar";
import { errMsg } from "./shared";

const EXAMPLES = [
  "Ce echipamente noi cumpără concurenții și ce servicii lansează?",
  "Cum se mișcă prețurile și promoțiile din zona mea?",
  "Ce reclamă clienții la concurenți și unde pot câștiga eu?",
];

const SCHEDULES: { value: RadarSchedule; label: string }[] = [
  { value: "off", label: "Oprit — rulez manual" },
  { value: "weekly", label: "Săptămânal — luni dimineața" },
  { value: "monthly", label: "Lunar — prima luni din lună" },
];

export default function FocusTab(props: {
  settings: RadarSettings | undefined;
  aiConfigured: boolean;
  onSaved: (s: RadarSettings) => void;
}) {
  const [context, setContext] = createSignal("");
  const [focus, setFocus] = createSignal("");
  const [schedule, setSchedule] = createSignal<RadarSchedule>("off");
  const [suggesting, setSuggesting] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const s = props.settings;
    if (!s) return;
    setContext(s.business_context);
    setFocus(s.focus_prompt);
    setSchedule(s.schedule);
  });

  async function suggest() {
    setSuggesting(true);
    try {
      const r = await radarApi.suggestContext();
      setContext(r.business_context);
      notify("Descriere generată. Verific-o și apasă Salvează.", "success");
    } catch (e) {
      notify(errMsg(e, "Nu am putut genera descrierea."), "error");
    } finally {
      setSuggesting(false);
    }
  }

  function addExample(text: string) {
    const cur = focus().trim();
    setFocus(cur ? `${cur}\n${text}` : text);
  }

  async function save() {
    setSaving(true);
    try {
      const s = await radarApi.updateSettings({
        business_context: context(),
        focus_prompt: focus(),
        schedule: schedule(),
      });
      props.onSaved(s);
      notify("Setările Radar au fost salvate.", "success");
    } catch (e) {
      notify(errMsg(e, "Eroare la salvare."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="radar-panel">
      <section class="radar-card">
        <h2>Afacerea mea</h2>
        <p class="radar-card-hint">
          Ce faci, pentru cine și cu ce te diferențiezi. AI-ul folosește acest context ca să judece
          semnalele din piață prin prisma afacerii tale.
        </p>
        <div class="radar-card-body">
          <textarea
            class="input radar-textarea"
            value={context()}
            placeholder="Ex: Service auto și vulcanizare în Timișoara, 6 angajați, clienți persoane fizice și flote mici…"
            onInput={(e) => setContext(e.currentTarget.value)}
          />
          <div class="radar-toolbar">
            <Button variant="ghost" loading={suggesting()} disabled={!props.aiConfigured} onClick={() => void suggest()}>
              Generează cu AI
            </Button>
            <span class="radar-muted">Generarea folosește tokeni din consumul contului tău.</span>
          </div>
        </div>
      </section>

      <section class="radar-card">
        <h2>Ce urmăresc (Focus)</h2>
        <p class="radar-card-hint">
          Scrie în cuvintele tale ce vrei să afli din surse. Cu cât e mai concret, cu atât raportul e mai util.
        </p>
        <div class="radar-card-body">
          <textarea
            class="input radar-textarea"
            value={focus()}
            placeholder="Ex: vreau să știu ce echipamente noi apar la concurenți și ce reclamă clienții lor."
            onInput={(e) => setFocus(e.currentTarget.value)}
          />
          <div class="radar-filters">
            <For each={EXAMPLES}>
              {(ex) => (
                <button type="button" class="radar-chip" onClick={() => addExample(ex)}>+ {ex}</button>
              )}
            </For>
          </div>
        </div>
      </section>

      <section class="radar-card">
        <h2>Rulare automată</h2>
        <p class="radar-card-hint">Poți lăsa radarul să ruleze singur; oricând poți porni o analiză manual.</p>
        <div class="radar-card-body">
          <select
            class="input radar-select"
            value={schedule()}
            onChange={(e) => setSchedule(e.currentTarget.value as RadarSchedule)}
          >
            <For each={SCHEDULES}>{(s) => <option value={s.value}>{s.label}</option>}</For>
          </select>
        </div>
      </section>

      <div class="radar-toolbar">
        <span class="radar-spacer" />
        <Show when={props.settings === undefined}><span class="radar-muted">Se încarcă…</span></Show>
        <Button loading={saving()} disabled={props.settings === undefined} onClick={() => void save()}>
          Salvează
        </Button>
      </div>
    </div>
  );
}
