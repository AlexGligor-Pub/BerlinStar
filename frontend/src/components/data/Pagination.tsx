import { For, Show } from "solid-js";
import type { PaginationApi } from "../../hooks/createPagination";

export interface PaginationProps {
  api: PaginationApi;
  total?: number;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
}

function buildPageList(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "…")[] = [];
  const push = (n: number | "…") => { if (out[out.length - 1] !== n) out.push(n); };
  push(1);
  if (current > 4) push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(totalPages - 1, current + 1); p++) push(p);
  if (current < totalPages - 3) push("…");
  push(totalPages);
  return out;
}

export default function Pagination(props: PaginationProps) {
  const totalPages = (): number => {
    if (props.total === undefined) return 0;
    return Math.max(1, Math.ceil(props.total / props.api.pageSize()));
  };

  return (
    <nav class="pagination" aria-label="Paginare">
      <div class="pagination-controls">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={props.api.page() <= 1}
          onClick={() => props.api.setPage(props.api.page() - 1)}
          aria-label="Pagina anterioară"
        >
          ‹
        </button>
        <Show
          when={props.total !== undefined}
          fallback={
            <span class="pagination-info">Pagina {props.api.page()}</span>
          }
        >
          <For each={buildPageList(props.api.page(), totalPages())}>
            {(p) => (
              <Show
                when={p !== "…"}
                fallback={<span class="pagination-ellipsis">…</span>}
              >
                <button
                  type="button"
                  class={`btn btn-sm ${p === props.api.page() ? "btn-primary" : "btn-ghost"}`}
                  aria-current={p === props.api.page() ? "page" : undefined}
                  onClick={() => props.api.setPage(p as number)}
                >
                  {p}
                </button>
              </Show>
            )}
          </For>
        </Show>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={props.total !== undefined && props.api.page() >= totalPages()}
          onClick={() => props.api.setPage(props.api.page() + 1)}
          aria-label="Pagina următoare"
        >
          ›
        </button>
      </div>
      <Show when={props.showPageSize !== false}>
        <label class="pagination-pagesize">
          <span>Per pagină:</span>
          <select
            class="input input-sm"
            value={String(props.api.pageSize())}
            onChange={(e) => props.api.setPageSize(Number(e.currentTarget.value))}
            aria-label="Elemente pe pagină"
          >
            <For each={props.pageSizeOptions ?? [10, 20, 50, 100]}>
              {(opt) => <option value={String(opt)}>{opt}</option>}
            </For>
          </select>
        </label>
      </Show>
      <Show when={props.total !== undefined}>
        <span class="pagination-total">{props.total} înregistrări</span>
      </Show>
    </nav>
  );
}
