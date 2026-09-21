import { Match, Show, Switch, createResource, createSignal, onMount } from "solid-js";
import { importApi, type ImportSession } from "../../api/imports";
import { importPending, refreshImportPending } from "../../store/importPending";
import HotelSessionView from "./import/HotelSessionView";
import ImportHistory from "./import/ImportHistory";
import NewHotelImport from "./import/NewHotelImport";

type View = { kind: "new" } | { kind: "history" } | { kind: "session"; id: number };

/** Configurări › Import › Hotel anvelope (admin + manager). */
export default function ImportHotelPanel() {
  const [format] = createResource(importApi.hotelFormat);
  const [view, setView] = createSignal<View>({ kind: "new" });
  const pending = () => importPending("hotel");

  onMount(() => void refreshImportPending());

  function onCreated(session: ImportSession) {
    void refreshImportPending();
    setView({ kind: "session", id: session.id });
  }

  const tab = () => (view().kind === "new" ? "new" : "history");

  return (
    <div class="cfg-panel">
      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Import › Hotel anvelope</h2>
      </div>

      <Show when={pending().rows > 0 && view().kind !== "session"}>
        <div class="import-callout import-pending-banner">
          <span>
            <strong>Ai acțiuni de făcut:</strong> {pending().rows} cazări așteaptă să alegi clientul, să confirmi sau să le respingi,
            în {pending().sessions} {pending().sessions === 1 ? "sesiune" : "sesiuni"} de import.
          </span>
          <Show when={view().kind !== "history"}>
            <button class="btn btn-sm btn-primary" onClick={() => setView({ kind: "history" })}>Vezi sesiunile</button>
          </Show>
        </div>
      </Show>

      <div class="cfg-tabs">
        <button class="cfg-tab" classList={{ "cfg-tab--active": tab() === "new" }} onClick={() => setView({ kind: "new" })}>
          Import nou
        </button>
        <button class="cfg-tab" classList={{ "cfg-tab--active": tab() === "history" }} onClick={() => setView({ kind: "history" })}>
          Istoric importuri
          <Show when={pending().sessions > 0}>
            <span class="cfg-tab-count import-count--warn">{pending().sessions}</span>
          </Show>
        </button>
      </div>

      <Switch>
        <Match when={view().kind === "new"}>
          <NewHotelImport format={format} onCreated={onCreated} onOpenSession={(id) => setView({ kind: "session", id })} />
        </Match>
        <Match when={view().kind === "history"}>
          <ImportHistory kind="hotel" onOpen={(id) => setView({ kind: "session", id })} />
        </Match>
        <Match when={view().kind === "session" && (view() as { id: number }).id} keyed>
          {(id) => <HotelSessionView sessionId={id} onBack={() => setView({ kind: "history" })} />}
        </Match>
      </Switch>
    </div>
  );
}
