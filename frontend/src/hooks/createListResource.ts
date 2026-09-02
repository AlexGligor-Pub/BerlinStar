import { createEffect, createSignal, on, onCleanup, onMount, type Accessor } from "solid-js";
import type { CursorQuery, Page, Query, RequestOptions } from "../api/client";
import type { PaginationApi } from "./createPagination";

export interface ListFetchCtx {
  signal: AbortSignal;
  limit: number;
  /** Cursorul paginii urmatoare (null la prima pagina / reload). */
  lastId: number | null;
  offset: number;
  page: number;
}

export interface CreateListResourceOptions<T> {
  fetcher: (ctx: ListFetchCtx) => Promise<Page<T> | T[]>;
  /** Cand se schimba, lista se reincarca de la zero. */
  deps?: Accessor<unknown>;
  /** Paginare server pe offset (createPagination); schimbarea paginii reincarca. */
  pagination?: PaginationApi;
  limit?: number;
  autoLoad?: boolean;
  errorMessage?: string;
}

export interface ListResource<T> {
  items: Accessor<T[]>;
  loading: Accessor<boolean>;
  loadingMore: Accessor<boolean>;
  error: Accessor<string | null>;
  total: Accessor<number | undefined>;
  hasMore: Accessor<boolean>;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  mutate: (fn: (prev: T[]) => T[]) => void;
  setItems: (items: T[]) => void;
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

export function createListResource<T>(opts: CreateListResourceOptions<T>): ListResource<T> {
  const [items, setItems] = createSignal<T[]>([]);
  const [loading, setLoading] = createSignal(opts.autoLoad !== false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [total, setTotal] = createSignal<number | undefined>(undefined);
  const [nextCursor, setNextCursor] = createSignal<number | null>(null);

  let controller: AbortController | null = null;

  async function run(mode: "reload" | "more"): Promise<void> {
    controller?.abort();
    const ctl = new AbortController();
    controller = ctl;
    const setBusy = mode === "more" ? setLoadingMore : setLoading;
    setBusy(true);
    setError(null);
    try {
      const p = opts.pagination?.params();
      const limit = opts.limit ?? p?.limit ?? 50;
      const res = await opts.fetcher({
        signal: ctl.signal,
        limit,
        lastId: mode === "more" ? nextCursor() : null,
        offset: p?.offset ?? 0,
        page: p?.page ?? 1,
      });
      if (ctl.signal.aborted) return;
      const page: Page<T> = Array.isArray(res) ? { items: res } : res;
      const got = page.items ?? [];
      setItems((prev) => (mode === "more" ? [...prev, ...got] : got));
      setNextCursor(got.length === 0 ? null : (page.next_cursor ?? null));
      setTotal(typeof page.total === "number" ? page.total : undefined);
    } catch (e: unknown) {
      if (ctl.signal.aborted || isAbort(e)) return;
      setError(e instanceof Error && e.message ? e.message : (opts.errorMessage ?? "Eroare la încărcare."));
    } finally {
      if (!ctl.signal.aborted) setBusy(false);
    }
  }

  if (opts.deps) createEffect(on(opts.deps, () => void run("reload"), { defer: true }));
  if (opts.pagination) createEffect(on(() => opts.pagination!.params(), () => void run("reload"), { defer: true }));
  if (opts.autoLoad !== false) onMount(() => void run("reload"));
  onCleanup(() => controller?.abort());

  return {
    items,
    loading,
    loadingMore,
    error,
    total,
    hasMore: () => nextCursor() !== null,
    reload: () => run("reload"),
    loadMore: () => (nextCursor() === null ? Promise.resolve() : run("more")),
    mutate: (fn) => setItems((prev) => fn(prev)),
    setItems: (next) => setItems(() => next),
  };
}

/** Fetcher pentru API-urile cu cursor (`limit` + `last_id`), ex. crudApi().list. */
export function cursorFetcher<T, Q extends CursorQuery>(
  list: (query: Q, opts: RequestOptions) => Promise<Page<T>>,
  extra?: Query | Accessor<Query>,
): (ctx: ListFetchCtx) => Promise<Page<T>> {
  return ({ signal, limit, lastId }) => {
    const q = typeof extra === "function" ? extra() : (extra ?? {});
    return list({ ...q, limit, last_id: lastId } as Q, { signal });
  };
}
