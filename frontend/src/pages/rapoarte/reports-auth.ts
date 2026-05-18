/**
 * Token pentru pagina Rapoarte: emis de POST /api/auth/reports/verify,
 * scope="reports", valabil 1h. Persistat in sessionStorage (NU localStorage)
 * cu propria expirare absoluta — pe care o validam la fiecare acces.
 *
 * Motiv sessionStorage: reduce window-ul de impact al unui XSS pe acelasi
 * domeniu — token-ul dispare la inchiderea tab-ului. Token-ul de login
 * principal e oricum tot in localStorage prin authStore.
 *
 * Cand exista un token valid, reportsFetch il injecteaza in Authorization.
 * Cand expira / e respins de backend, gate-ul din Rapoarte.tsx redeschide
 * ecranul de parola.
 */
import { apiFetch, type ApiFetchOptions } from "../../utils/api";

const TOKEN_KEY = "reports_token";
const TOKEN_EXP_KEY = "reports_token_exp";

let _reportsToken: string | null = null;

function _store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function _readPersisted(): string | null {
  const s = _store();
  if (!s) return null;
  try {
    const exp = Number(s.getItem(TOKEN_EXP_KEY) ?? 0);
    if (!exp || Date.now() >= exp) {
      s.removeItem(TOKEN_KEY);
      s.removeItem(TOKEN_EXP_KEY);
      return null;
    }
    return s.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setReportsToken(t: string | null, expiresInSec?: number): void {
  _reportsToken = t;
  const s = _store();
  if (!s) return;
  try {
    if (t) {
      const ttl = (expiresInSec ?? 3600) * 1000;
      s.setItem(TOKEN_KEY, t);
      s.setItem(TOKEN_EXP_KEY, String(Date.now() + ttl));
    } else {
      s.removeItem(TOKEN_KEY);
      s.removeItem(TOKEN_EXP_KEY);
    }
  } catch {
    // ignoram quota/storage indisponibil — tokenul ramane doar in memorie
  }
}

export function getReportsToken(): string | null {
  const s = _store();
  if (_reportsToken) {
    if (s) {
      try {
        const exp = Number(s.getItem(TOKEN_EXP_KEY) ?? 0);
        if (!exp || Date.now() >= exp) {
          _reportsToken = null;
          s.removeItem(TOKEN_KEY);
          s.removeItem(TOKEN_EXP_KEY);
          return null;
        }
      } catch {}
    }
    return _reportsToken;
  }
  _reportsToken = _readPersisted();
  return _reportsToken;
}

export function hasValidReportsToken(): boolean {
  return getReportsToken() !== null;
}

/** Wrapper peste apiFetch care injecteaza tokenul de Rapoarte (cand exista).
 *  Daca backendul raspunde 401, invalidam tokenul local — gate-ul din
 *  Rapoarte.tsx va redeschide ecranul de parola la urmatorul render.
 */
export async function reportsFetch(
  url: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const tok = getReportsToken();
  const resp = await apiFetch(url, {
    ...options,
    authToken: tok,
    handleUnauthorized: false,
  });
  if (resp.status === 401 && tok) {
    setReportsToken(null);
    try {
      window.dispatchEvent(new Event("bs:reports-locked"));
    } catch {}
  }
  return resp;
}
