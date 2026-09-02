import { apiFetch, apiUpload, readApiError, type ApiFetchOptions } from "../utils/api";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type Paths = paths;

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export interface Page<T> {
  items: T[];
  next_cursor?: number | null;
  total?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function buildQuery(q?: Query): string {
  if (!q) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface RequestOptions extends Omit<ApiFetchOptions, "body" | "method"> {
  query?: Query;
  errorMessage?: string;
}

export async function ensureOk(res: Response, fallback = "Eroare la procesare."): Promise<Response> {
  if (res.ok) return res;
  throw new ApiError(res.status, await readApiError(res, `${fallback} (HTTP ${res.status})`));
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function send<T>(method: Method, url: string, body: unknown, opts: RequestOptions): Promise<T> {
  const { query, errorMessage, ...init } = opts;
  const res = await apiFetch(url + buildQuery(query), {
    ...init,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await ensureOk(res, errorMessage);
  return parseJson<T>(res);
}

export const http = {
  get: <T>(url: string, opts: RequestOptions = {}) => send<T>("GET", url, undefined, opts),
  post: <T>(url: string, body?: unknown, opts: RequestOptions = {}) => send<T>("POST", url, body, opts),
  patch: <T>(url: string, body?: unknown, opts: RequestOptions = {}) => send<T>("PATCH", url, body, opts),
  put: <T>(url: string, body?: unknown, opts: RequestOptions = {}) => send<T>("PUT", url, body, opts),
  delete: <T = void>(url: string, opts: RequestOptions = {}) => send<T>("DELETE", url, undefined, opts),
  async upload<T>(url: string, formData: FormData, opts: RequestOptions = {}): Promise<T> {
    const { query, errorMessage, ...init } = opts;
    const res = await apiUpload(url + buildQuery(query), formData, init);
    await ensureOk(res, errorMessage ?? "Eroare la upload.");
    return parseJson<T>(res);
  },
  /** Raspunsul brut, pentru download-uri sau tratare speciala a statusului. */
  raw: (url: string, opts: ApiFetchOptions & { query?: Query } = {}): Promise<Response> => {
    const { query, ...init } = opts;
    return apiFetch(url + buildQuery(query), init);
  },
};

export interface CursorQuery extends Query {
  limit?: number;
  last_id?: number | null;
}

export interface CrudApi<TRead, TCreate, TUpdate, TQuery extends CursorQuery = CursorQuery> {
  base: string;
  list(query?: TQuery, opts?: RequestOptions): Promise<Page<TRead>>;
  listAll(query?: TQuery, opts?: RequestOptions & { maxPages?: number }): Promise<TRead[]>;
  get(id: number, opts?: RequestOptions): Promise<TRead>;
  create(body: TCreate, opts?: RequestOptions): Promise<TRead>;
  update(id: number, body: TUpdate, opts?: RequestOptions): Promise<TRead>;
  remove(id: number, opts?: RequestOptions): Promise<void>;
}

export function crudApi<TRead, TCreate, TUpdate = Partial<TCreate>, TQuery extends CursorQuery = CursorQuery>(
  base: string,
  cfg: { updateMethod?: "PATCH" | "PUT" } = {},
): CrudApi<TRead, TCreate, TUpdate, TQuery> {
  const updateMethod = cfg.updateMethod ?? "PATCH";
  const list = (query?: TQuery, opts: RequestOptions = {}) =>
    http.get<Page<TRead>>(base, { ...opts, query: { ...opts.query, ...query } });
  return {
    base,
    list,
    async listAll(query, opts = {}) {
      const { maxPages = 25, ...rest } = opts;
      const limit = query?.limit ?? 200;
      const out: TRead[] = [];
      let lastId: number | null = null;
      for (let i = 0; i < maxPages; i++) {
        const page = await list({ ...(query as TQuery), limit, last_id: lastId }, rest);
        out.push(...page.items);
        if (page.next_cursor == null || page.items.length === 0) break;
        lastId = page.next_cursor;
      }
      return out;
    },
    get: (id, opts) => http.get<TRead>(`${base}/${id}`, opts),
    create: (body, opts) => http.post<TRead>(base, body, { errorMessage: "Eroare la adăugare.", ...opts }),
    update: (id, body, opts) =>
      updateMethod === "PUT"
        ? http.put<TRead>(`${base}/${id}`, body, { errorMessage: "Eroare la salvare.", ...opts })
        : http.patch<TRead>(`${base}/${id}`, body, { errorMessage: "Eroare la salvare.", ...opts }),
    remove: (id, opts) => http.delete(`${base}/${id}`, { errorMessage: "Eroare la ștergere.", ...opts }),
  };
}
