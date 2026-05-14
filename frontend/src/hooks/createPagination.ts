import { createSignal, createMemo, type Accessor } from "solid-js";

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export interface PaginationApi {
  page: Accessor<number>;
  pageSize: Accessor<number>;
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
  reset: () => void;
  params: Accessor<PaginationParams>;
}

export interface CreatePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function createPagination(opts: CreatePaginationOptions = {}): PaginationApi {
  const initialPage = opts.initialPage ?? 1;
  const initialPageSize = opts.initialPageSize ?? 20;

  const [page, setPageRaw] = createSignal(initialPage);
  const [pageSize, setPageSizeRaw] = createSignal(initialPageSize);

  const params = createMemo<PaginationParams>(() => {
    const p = page();
    const s = pageSize();
    return { page: p, pageSize: s, offset: (p - 1) * s, limit: s };
  });

  function setPage(n: number): void {
    setPageRaw(Math.max(1, n));
  }

  function setPageSize(n: number): void {
    setPageSizeRaw(Math.max(1, n));
    setPageRaw(1);
  }

  function reset(): void {
    setPageRaw(1);
  }

  return { page, pageSize, setPage, setPageSize, reset, params };
}
