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

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Nu seta Content-Type pentru FormData (lasa browserul sa puna boundary-ul).
  const body = options.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && !headers["Content-Type"] && body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (auth.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  return fetch(API_BASE + url, { ...options, headers }).then((res) => {
    if (res.status === 401 && auth.token) {
      logout();
      emitUnauthorized();
    }
    return res;
  });
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
