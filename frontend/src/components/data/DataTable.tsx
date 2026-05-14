import { For, Show, type JSX } from "solid-js";
import EmptyState from "../ui/EmptyState";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => JSX.Element;
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: readonly T[];
  loading?: boolean;
  error?: string | null;
  rowKey: (row: T) => string | number;
  empty?: JSX.Element;
  caption?: string;
}

export default function DataTable<T>(props: DataTableProps<T>) {
  return (
    <div class="data-table-wrap">
      <Show when={props.error}>
        <div class="data-table-error" role="alert">{props.error}</div>
      </Show>
      <Show when={props.loading}>
        <div class="data-table-loading" aria-live="polite">Se încarcă…</div>
      </Show>
      <Show
        when={!props.loading && props.data.length > 0}
        fallback={
          <Show when={!props.loading}>
            {props.empty ?? <EmptyState message="Nu există date." />}
          </Show>
        }
      >
        <table class="data-table">
          <Show when={props.caption}>
            <caption>{props.caption}</caption>
          </Show>
          <thead>
            <tr>
              <For each={props.columns}>
                {(c) => (
                  <th class={c.className} style={c.width ? `width:${c.width}` : undefined}>
                    {c.header}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.data}>
              {(row) => (
                <tr>
                  <For each={props.columns}>
                    {(c) => (
                      <td class={c.className}>
                        {c.render
                          ? c.render(row)
                          : String((row as Record<string, unknown>)[c.key] ?? "")}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
