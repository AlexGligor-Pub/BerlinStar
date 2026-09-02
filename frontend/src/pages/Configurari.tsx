import { For, Show, Suspense, createMemo, createSignal, lazy, type Component } from "solid-js";
import { can, type Resource } from "../store/permissions";
import { Dynamic } from "solid-js/web";

const WelcomePanel = lazy(() => import("./configurari/WelcomePanel"));

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

const PANELS: Record<TopicId, Component> = {
  companii: lazy(() => import("./configurari/CompaniiPanel")),
  locatii: lazy(() => import("./configurari/LocatiiPanel")),
  departamente: lazy(() => import("./configurari/DepartamentePanel")),
  angajati: lazy(() => import("./configurari/AngajatiPanel")),
  produse: lazy(() => import("./configurari/ProduseSiServiciiPanel")),
  disclaimers: lazy(() => import("./configurari/DisclaimersPanel")),
  registre: lazy(() => import("./configurari/RegisterPanel")),
  "setari-generale": lazy(() => import("./configurari/SetariGeneralePanel")),
  dispozitiv: lazy(() => import("./configurari/DispozitivulMeuPanel")),
  efactura: lazy(() => import("./configurari/EFacturaPanel")),
  utilizatori: lazy(() => import("./configurari/UtilizatoriPanel")),
  "contul-meu": lazy(() => import("./configurari/ContulMeuPanel")),
  abonament: lazy(() => import("./configurari/AbonamentPanel")),
};

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
        <Suspense fallback={<p class="cfg-hint">Se încarcă...</p>}>
          <Show when={active()} fallback={<WelcomePanel />} keyed>
            {(id) => <Dynamic component={PANELS[id]} />}
          </Show>
        </Suspense>
      </main>
    </div>
  );
}
