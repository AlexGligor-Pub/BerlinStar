import { getOwner, onCleanup } from "solid-js";

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const run = ((...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; const a = lastArgs!; lastArgs = null; fn(...a); }, ms);
  }) as Debounced<A>;
  run.cancel = () => { if (timer) clearTimeout(timer); timer = null; lastArgs = null; };
  run.flush = () => { if (timer && lastArgs) { const a = lastArgs; run.cancel(); fn(...a); } };
  if (getOwner()) onCleanup(run.cancel);
  return run;
}

export interface DebouncedSearchOptions<T> {
  fetch: (query: string, signal: AbortSignal) => Promise<T>;
  onResult: (result: T, query: string) => void;
  onError?: (err: unknown, query: string) => void;
  onPending?: (pending: boolean) => void;
  delay?: number;
}

export interface DebouncedSearch {
  search(query: string): void;
  searchNow(query: string): Promise<void>;
  cancel(): void;
}

/** Debounced server search: aborts the in-flight request and drops stale responses. */
export function createDebouncedSearch<T>(opts: DebouncedSearchOptions<T>): DebouncedSearch {
  let ctrl: AbortController | null = null;
  let seq = 0;

  async function searchNow(query: string): Promise<void> {
    debounced.cancel();
    ctrl?.abort();
    const mine = new AbortController();
    ctrl = mine;
    const id = ++seq;
    opts.onPending?.(true);
    try {
      const result = await opts.fetch(query, mine.signal);
      if (id === seq && !mine.signal.aborted) opts.onResult(result, query);
    } catch (err) {
      if (id === seq && !mine.signal.aborted) opts.onError?.(err, query);
    } finally {
      if (id === seq) { opts.onPending?.(false); ctrl = null; }
    }
  }

  const debounced = debounce((q: string) => { void searchNow(q); }, opts.delay ?? 300);

  function cancel() {
    debounced.cancel();
    ctrl?.abort();
    ctrl = null;
    seq++;
    opts.onPending?.(false);
  }

  if (getOwner()) onCleanup(cancel);
  return { search: (q) => debounced(q), searchNow, cancel };
}
