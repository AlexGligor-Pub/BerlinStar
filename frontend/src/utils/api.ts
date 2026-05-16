import { auth, logout } from "../store/authStore";

export const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Dispatch un eveniment global pe care App.tsx il prinde si redirectioneaza la /login. */
function emitUnauthorized(): void {
  try {
    window.dispatchEvent(new CustomEvent("bs:unauthorized"));
  } catch {
    // window may be unavailable (SSR/test); safe to ignore
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Token alternativ (ex. token admin elevat). Daca lipseste, foloseste auth.token. */
  authToken?: string | null;
  /** Daca true (default), un raspuns 401 declanseaza logout + emit "bs:unauthorized". */
  handleUnauthorized?: boolean;
}

function buildHeaders(options: ApiFetchOptions): Record<string, string> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const body = options.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  const tok = options.authToken !== undefined ? options.authToken : auth.token;
  if (tok) {
    headers["Authorization"] = `Bearer ${tok}`;
  }
  return headers;
}

export function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const handleUnauthorized = options.handleUnauthorized !== false;
  const headers = buildHeaders(options);
  const { authToken: _at, handleUnauthorized: _hu, ...init } = options;
  return fetch(API_BASE + url, { ...init, headers }).then((res) => {
    if (handleUnauthorized && res.status === 401 && auth.token) {
      logout();
      emitUnauthorized();
    }
    return res;
  });
}

/**
 * Helper pentru upload multipart/form-data prin apiFetch.
 * Nu seta Content-Type — browserul ataseaza boundary automat.
 */
export function apiUpload(
  url: string,
  formData: FormData,
  options: Omit<ApiFetchOptions, "body" | "method"> & { method?: "POST" | "PUT" | "PATCH" } = {},
): Promise<Response> {
  const { method = "POST", ...rest } = options;
  return apiFetch(url, { ...rest, method, body: formData });
}

interface PydanticValidationError {
  loc?: unknown[];
  msg?: string;
  message?: string;
}

/**
 * Extrage un mesaj uman-readable dintr-un raspuns FastAPI.
 * - String -> as-is
 * - Array (422 Pydantic) -> "loc: msg" join
 * - Object cu .detail -> recurseaza
 */
export function parseApiError(detail: unknown, fallback = "Eroare necunoscuta."): string {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((entry) => {
      const e = entry as PydanticValidationError;
      const loc = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null;
      const msg = e?.msg || e?.message || JSON.stringify(e);
      return loc ? `${String(loc)}: ${msg}` : String(msg);
    });
    return parts.join("; ") || fallback;
  }
  if (typeof detail === "object") {
    const obj = detail as { detail?: unknown; message?: unknown };
    if (obj.detail !== undefined) return parseApiError(obj.detail, fallback);
    if (obj.message) return String(obj.message);
  }
  return fallback;
}

/** Citeste body-ul ca JSON si returneaza mesajul de eroare formatat. */
export async function readApiError(res: Response, fallback = "Eroare la procesare."): Promise<string> {
  try {
    const data = await res.json();
    return parseApiError(data?.detail ?? data, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Citeste body-ul ca JSON, dar daca parsing-ul esueaza intoarce un obiect gol.
 * Utilizeaza-l cand vrei doar sa extragi un eventual .detail dintr-un raspuns eroare.
 */
export async function readJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Fetch + parse JSON, typed. Pe error arunca un Error cu mesaj prelucrat din raspuns.
 * Util cand vrei `const data = await apiFetchJson<MyType>("/api/x")` fara boilerplate.
 */
export async function apiFetchJson<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(url, options);
  if (!res.ok) {
    const msg = await readApiError(res, `Eroare HTTP ${res.status}`);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
