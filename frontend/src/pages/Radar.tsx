import { For, Show, createResource } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { radarApi } from "../api/radar";
import SurseTab from "./radar/SurseTab";
import ConcurentiTab from "./radar/ConcurentiTab";
import FocusTab from "./radar/FocusTab";
import RapoarteTab from "./radar/RapoarteTab";
import ConsumTab from "./radar/ConsumTab";
import "./radar/radar.css";

const TABS = [
  { id: "surse", label: "Surse" },
  { id: "concurenti", label: "Concurenți" },
  { id: "focus", label: "Focus" },
  { id: "rapoarte", label: "Rapoarte" },
  { id: "consum", label: "Consum AI" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Radar() {
  const [params, setParams] = useSearchParams<{ tab?: string }>();
  const [settings, { mutate }] = createResource(() => radarApi.settings());

  const tab = (): TabId => {
    const t = params.tab;
    return TABS.some((x) => x.id === t) ? (t as TabId) : "surse";
  };

  const configured = () => settings()?.ai_configured === true;

  return (
    <div class="radar-page">
      <header class="radar-head">
        <div>
          <h1>Radar AI</h1>
          <p class="radar-lead">
            Urmărește concurența și piața: alegi sursele, scrii ce te interesează, iar AI-ul îți livrează
            un raport de decizie cu semnale, recomandări și opțiuni.
          </p>
        </div>
        <Show when={!settings.loading}>
          <span class="radar-status" classList={{ "radar-status--off": !configured() }}>
            <span class="radar-status-dot" />
            {configured() ? "AI configurat" : "AI neconfigurat"}
          </span>
        </Show>
      </header>

      <Show when={!settings.loading && !configured()}>
        <div class="radar-banner">
          Radarul nu poate rula încă: cheia AI nu este configurată pe platformă. Roagă administratorul
          platformei să o adauge din <b>Admin → Radar AI</b>. Între timp poți adăuga surse și îți poți
          scrie focusul — se salvează normal.
        </div>
      </Show>

      <div class="cfg-tabs" role="tablist">
        <For each={TABS}>
          {(t) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === t.id}
              class="cfg-tab"
              classList={{ "cfg-tab--active": tab() === t.id }}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
            >
              {t.label}
            </button>
          )}
        </For>
      </div>

      <Show when={tab() === "surse"}>
        <SurseTab placesConfigured={settings()?.places_configured === true} />
      </Show>
      <Show when={tab() === "concurenti"}>
        <ConcurentiTab
          aiConfigured={configured()}
          placesConfigured={settings()?.places_configured === true}
          onOpenTab={(t) => setParams({ tab: t }, { replace: true })}
        />
      </Show>
      <Show when={tab() === "focus"}>
        <FocusTab settings={settings()} aiConfigured={configured()} onSaved={(s) => mutate(s)} />
      </Show>
      <Show when={tab() === "rapoarte"}>
        <RapoarteTab aiConfigured={configured()} />
      </Show>
      <Show when={tab() === "consum"}>
        <ConsumTab />
      </Show>
    </div>
  );
}
