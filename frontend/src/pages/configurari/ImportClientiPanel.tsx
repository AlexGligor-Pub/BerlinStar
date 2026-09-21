import { Match, Show, Switch, createResource, createSignal, onMount } from "solid-js";
import { importApi, type ImportSession } from "../../api/imports";
import { importPending, refreshImportPending } from "../../store/importPending";
import ImportHistory from "./import/ImportHistory";
import ImportSessionView from "./import/ImportSessionView";
import NewImport from "./import/NewImport";

type View = { kind: "new" } | { kind: "history" } | { kind: "session"; id: number };

export default function ImportClientiPanel() {
  const [format] = createResource(importApi.clientiFormat);
  const [view, setView] = createSignal<View>({ kind: "new" });

  onMount(() => void refreshImportPending());

  function onCreated(session: ImportSession) {
    void refreshImportPending();
    setView({ kind: "session", id: session.id });
  }

  const tab = () => (view().kind === "new" ? "new" : "history");

  return (
    <div class="cfg-panel">
      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Import › Clienți</h2>
      </div>

      <Show when={importPending("clienti").rows > 0 && view().kind !== "session"}>
        <div class="import-callout import-pending-banner">
          <span>
            <strong>Ai acțiuni de făcut:</strong> {importPending("clienti").rows} rânduri așteaptă să le completezi sau să le respingi,
            în {importPending("clienti").sessions} {importPending("clienti").sessions === 1 ? "sesiune" : "sesiuni"} de import.
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
          <Show when={importPending("clienti").sessions > 0}>
            <span class="cfg-tab-count import-count--warn">{importPending("clienti").sessions}</span>
          </Show>
        </button>
      </div>

      <Switch>
        <Match when={view().kind === "new"}>
          <NewImport format={format} onCreated={onCreated} onOpenSession={(id) => setView({ kind: "session", id })} />
        </Match>
        <Match when={view().kind === "history"}>
          <ImportHistory kind="clienti" onOpen={(id) => setView({ kind: "session", id })} />
        </Match>
        <Match when={view().kind === "session" && (view() as { id: number }).id} keyed>
          {(id) => (
            <ImportSessionView sessionId={id} format={format} onBack={() => setView({ kind: "history" })} />
          )}
        </Match>
      </Switch>
    </div>
  );
}
