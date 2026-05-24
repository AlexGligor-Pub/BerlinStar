import { For, Switch, Match, createSignal } from "solid-js";
import WelcomePanel from "./configurari/WelcomePanel";
import LocatiiPanel from "./configurari/LocatiiPanel";
import DepartamentePanel from "./configurari/DepartamentePanel";
import AngajatiPanel from "./configurari/AngajatiPanel";
import DisclaimersPanel from "./configurari/DisclaimersPanel";
import ProduseSiServiciiPanel from "./configurari/ProduseSiServiciiPanel";
import CompaniiPanel from "./configurari/CompaniiPanel";
import RegisterPanel from "./configurari/RegisterPanel";
import DispozitivulMeuPanel from "./configurari/DispozitivulMeuPanel";
import SetariGeneralePanel from "./configurari/SetariGeneralePanel";
import EFacturaPanel from "./configurari/EFacturaPanel";
import ContulMeuPanel from "./configurari/ContulMeuPanel";
import AbonamentPanel from "./configurari/AbonamentPanel";

const TOPIC_GROUPS = [
  {
    label: "Organizație",
    items: [
      { id: "companii",     label: "Companiile mele" },
      { id: "locatii",      label: "Locații"         },
      { id: "departamente", label: "Departamente"    },
      { id: "angajati",     label: "Angajați"        },
    ],
  },
  {
    label: "Operațiuni",
    items: [
      { id: "produse",     label: "Produse și Servicii" },
      { id: "disclaimers", label: "Disclaimers"         },
      { id: "registre",    label: "Registre"            },
    ],
  },
  {
    label: "Sistem",
    items: [
      { id: "setari-generale", label: "Setări generale"  },
      { id: "dispozitiv",      label: "Dispozitivul meu" },
      { id: "efactura",        label: "eFactura ANAF"    },
    ],
  },
  {
    label: "Cont",
    items: [
      { id: "contul-meu", label: "Contul Meu" },
      { id: "abonament",  label: "Abonament"  },
    ],
  },
] as const;

type TopicId = typeof TOPIC_GROUPS[number]["items"][number]["id"];

export default function Configurari() {
  const [active, setActive] = createSignal<TopicId | null>(null);

  return (
    <div class="cfg-layout">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurări</div>
        <For each={TOPIC_GROUPS}>
          {(group) => (
            <div class="cfg-sidebar-group">
              <div class="cfg-sidebar-group-label">{group.label}</div>
              <For each={group.items}>
                {(t) => (
                  <button
                    class="cfg-sidebar-item"
                    classList={{ "cfg-sidebar-item--active": active() === t.id }}
                    onClick={() => setActive(t.id)}
                  >{t.label}</button>
                )}
              </For>
            </div>
          )}
        </For>
      </aside>
      <main class="cfg-content">
        <Switch fallback={<WelcomePanel />}>
          <Match when={active() === "locatii"}><LocatiiPanel /></Match>
          <Match when={active() === "departamente"}><DepartamentePanel /></Match>
          <Match when={active() === "angajati"}><AngajatiPanel /></Match>
          <Match when={active() === "produse"}><ProduseSiServiciiPanel /></Match>
          <Match when={active() === "companii"}><CompaniiPanel /></Match>
          <Match when={active() === "disclaimers"}><DisclaimersPanel /></Match>
          <Match when={active() === "registre"}><RegisterPanel /></Match>
          <Match when={active() === "dispozitiv"}><DispozitivulMeuPanel /></Match>
          <Match when={active() === "setari-generale"}><SetariGeneralePanel /></Match>
          <Match when={active() === "efactura"}><EFacturaPanel /></Match>
          <Match when={active() === "contul-meu"}><ContulMeuPanel /></Match>
          <Match when={active() === "abonament"}><AbonamentPanel /></Match>
        </Switch>
      </main>
    </div>
  );
}
