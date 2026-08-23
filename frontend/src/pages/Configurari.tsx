import { For, Switch, Match, createMemo, createSignal } from "solid-js";
import { can, type Resource } from "../store/permissions";
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
import UtilizatoriPanel from "./configurari/UtilizatoriPanel";

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
      // `requires` = resursa ceruta; lipsa ei inseamna „vizibil tuturor
      // rolurilor care ajung in Configurări" (adica admin + manager).
      { id: "utilizatori", label: "Utilizatori", requires: "users" },
      { id: "contul-meu",  label: "Contul Meu" },
      { id: "abonament",   label: "Abonament", requires: "users" },
    ],
  },
] as const;

type TopicId = typeof TOPIC_GROUPS[number]["items"][number]["id"];

export default function Configurari() {
  const [active, setActive] = createSignal<TopicId | null>(null);

  // Ascundem intrarile pe care rolul curent nu le poate deschide (serverul le
  // respinge oricum cu 403) si grupurile ramase goale.
  const visibleGroups = createMemo(() =>
    TOPIC_GROUPS
      .map((g) => ({
        label: g.label,
        items: g.items.filter((t) => !("requires" in t) || can(t.requires as Resource)),
      }))
      .filter((g) => g.items.length > 0),
  );

  return (
    <div class="cfg-layout">
      <aside class="cfg-sidebar">
        <div class="cfg-sidebar-title">Configurări</div>
        <For each={visibleGroups()}>
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
          <Match when={active() === "utilizatori"}><UtilizatoriPanel /></Match>
          <Match when={active() === "contul-meu"}><ContulMeuPanel /></Match>
          <Match when={active() === "abonament"}><AbonamentPanel /></Match>
        </Switch>
      </main>
    </div>
  );
}
