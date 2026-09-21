import { For, Show, Suspense, createMemo, createSignal, lazy, onMount, type Component } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { can, type Resource } from "../store/permissions";
import { Dynamic } from "solid-js/web";
import { importPending, refreshImportPending } from "../store/importPending";
import type { ImportKind } from "../api/imports";

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
    // Importuri in masa din fisiere. Clientii doar adminul contului; hotelul de
    // anvelope si managerul (serverul verifica rolul pe tip, /api/import/*).
    label: "Import",
    items: [
      { id: "import-clienti", label: "Clienți", requires: "users" },
      { id: "import-hotel",   label: "Hotel anvelope" },
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
  "import-clienti": lazy(() => import("./configurari/ImportClientiPanel")),
  "import-hotel": lazy(() => import("./configurari/ImportHotelPanel")),
  utilizatori: lazy(() => import("./configurari/UtilizatoriPanel")),
  "contul-meu": lazy(() => import("./configurari/ContulMeuPanel")),
  abonament: lazy(() => import("./configurari/AbonamentPanel")),
};

// Intrarile de import din meniu -> tipul importului (pentru indicatorul de actiuni).
const IMPORT_TOPICS: Partial<Record<string, ImportKind>> = { "import-clienti": "clienti", "import-hotel": "hotel" };

const TOPIC_IDS = new Set<string>(TOPIC_GROUPS.flatMap((g) => g.items.map((t) => t.id)));

export default function Configurari() {
  // `?topic=abonament` — deep-link folosit de return_url-ul Stripe si de bannerul de abonament.
  const [searchParams] = useSearchParams<{ topic?: string }>();
  const initial = searchParams.topic;
  const [active, setActive] = createSignal<TopicId | null>(
    initial && TOPIC_IDS.has(initial) ? (initial as TopicId) : null,
  );

  // Randurile de import care asteapta o decizie apar ca indicator in meniu,
  // ca adminul sa vada ca are ceva de facut fara sa deschida sectiunea.
  onMount(() => void refreshImportPending());

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
                  >
                    {t.label}
                    <Show when={IMPORT_TOPICS[t.id] && importPending(IMPORT_TOPICS[t.id]!).rows > 0}>
                      <span class="cfg-sidebar-badge" title="Rânduri de import de rezolvat">
                        {importPending(IMPORT_TOPICS[t.id]!).rows}
                      </span>
                    </Show>
                  </button>
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
