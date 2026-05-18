/**
 * Token pentru pagina Rapoarte: emis de POST /api/auth/reports/verify,
 * scope="reports", valabil 1h. Persistat in localStorage cu propria expirare
 * (data absoluta) — pe care o validam la fiecare acces.
 *
 * Cand exista un token valid, reportsFetch il injecteaza in Authorization.
 * Cand expira, gate-ul din Rapoarte.tsx redeschide ecranul de parola.
 */
import { apiFetch, type ApiFetchOptions } from "../../utils/api";

const TOKEN_KEY = "reports_token";
const TOKEN_EXP_KEY = "reports_token_exp";

let _reportsToken: string | null = null;

function _readPersisted(): string | null {
  try {
    const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) ?? 0);
    if (!exp || Date.now() >= exp) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setReportsToken(t: string | null, expiresInSec?: number): void {
  _reportsToken = t;
  try {
    if (t) {
      const ttl = (expiresInSec ?? 3600) * 1000;
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + ttl));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
    }
  } catch {
    // ignoram quota/storage indisponibil — tokenul ramane doar in memorie
  }
}

export function getReportsToken(): string | null {
  if (_reportsToken) {
    const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) ?? 0);
    if (!exp || Date.now() >= exp) {
      _reportsToken = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXP_KEY);
      } catch {}
      return null;
    }
    return _reportsToken;
  }
  _reportsToken = _readPersisted();
  return _reportsToken;
}

export function hasValidReportsToken(): boolean {
  return getReportsToken() !== null;
}

/** Wrapper peste apiFetch care injecteaza tokenul de Rapoarte (cand exista). */
export function reportsFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const tok = getReportsToken();
  return apiFetch(url, { ...options, authToken: tok, handleUnauthorized: false });
}
