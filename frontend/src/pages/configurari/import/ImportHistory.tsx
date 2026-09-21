import { For, Show, createEffect, createResource, createSignal, onCleanup } from "solid-js";
import { importApi, type ImportKind } from "../../../api/imports";
import { formatDateTime, sessionStatusBadge, sessionStatusLabel } from "./labels";

const PAGE = 25;

export default function ImportHistory(props: { kind: ImportKind; onOpen: (sessionId: number) => void }) {
  const kind = props.kind; // eslint-disable-line solid/reactivity
  const [offset, setOffset] = createSignal(0);
  const [data, { refetch }] = createResource(offset, (o) => importApi.sessions(kind, { limit: PAGE, offset: o }));

  // O resursa in eroare arunca la citire in Solid; citim prin `list()`, care
  // intoarce `undefined`, si aratam un mesaj cu reincercare.
  const list = () => (data.error ? undefined : data());
  const retry = () => void Promise.resolve(refetch()).catch(() => {});

  // Un import in curs isi actualizeaza procentul in lista, fara refresh manual.
  createEffect(() => {
    if (!list()?.items.some(s => s.state === "processing")) return;
    const timer = setTimeout(retry, 2000);
    onCleanup(() => clearTimeout(timer));
  });

  return (
    <>
      <Show when={data.error}>
        <p class="cfg-error">
          Istoricul nu a putut fi încărcat.{" "}
          <button class="btn btn-sm btn-ghost" onClick={retry}>Reîncearcă</button>
        </p>
      </Show>
      <Show when={data.loading && !list()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={list() && list()!.items.length === 0}>
        <p class="cfg-hint">Nu există încă niciun import. Începe din tab-ul „Import nou".</p>
      </Show>

      <Show when={list() && list()!.items.length > 0}>
        <div class="data-table-wrap">
          <table class="data-table import-table import-history">
            <thead>
              <tr>
                <th>Data</th><th>Fișier</th><th>De către</th><th>Rânduri</th>
                <th>Importați</th><th>De rezolvat</th><th>Respinși</th><th>Stare</th>
              </tr>
            </thead>
            <tbody>
              <For each={list()!.items}>
                {(s) => (
                  <tr class="import-clickable">
                    <td>{formatDateTime(s.created_at)}</td>
                    <td>
                      <button class="import-link" onClick={() => props.onOpen(s.id)}>
                        {s.filename ?? `Import #${s.id}`}
                      </button>
                    </td>
                    <td>{s.created_by ?? "—"}</td>
                    <td>{s.total_rows}</td>
                    <td>{s.imported}</td>
                    <td><Show when={s.pending > 0} fallback="0"><strong>{s.pending}</strong></Show></td>
                    <td>{s.rejected}</td>
                    <td><span class={`badge ${sessionStatusBadge(s)}`}>{sessionStatusLabel(s)}</span></td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <Show when={list()!.total > PAGE}>
          <div class="import-actions import-pager">
            <button class="btn btn-sm btn-ghost" disabled={offset() === 0} onClick={() => setOffset(Math.max(0, offset() - PAGE))}>‹ Mai noi</button>
            <span class="cfg-hint">{offset() + 1}–{Math.min(offset() + PAGE, list()!.total)} din {list()!.total}</span>
            <button class="btn btn-sm btn-ghost" disabled={offset() + PAGE >= list()!.total} onClick={() => setOffset(offset() + PAGE)}>Mai vechi ›</button>
          </div>
        </Show>
      </Show>
    </>
  );
}
