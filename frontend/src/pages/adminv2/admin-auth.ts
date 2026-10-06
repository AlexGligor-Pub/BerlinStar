/**
 * Token de admin pentru sectiunile sensibile din AdminV2.
 *
 * Persistat in localStorage cu TTL 24h. La acces, daca tokenul a expirat il
 * stergem si cadem inapoi pe tokenul de user (auth.token) — astfel utilizatorul
 * vede in continuare datele de cont, dar operatii admin-only vor primi 403.
 *
 * Stergerea din browser nu ajunge: pe server sesiunea AdminV2 traieste 30 de
 * zile. De aceea la logout si la expirarea TTL-ului o si revocam
 * (POST /api/auth/logout cu tokenul admin), ca o copie a lui sa nu mai valoreze nimic.
 */

import { apiFetch, apiUpload } from "../../utils/api";
import { auth } from "../../store/authStore";

const _ADMIN_TOKEN_KEY = "adminv2_token";
const _ADMIN_TOKEN_EXP_KEY = "adminv2_token_exp";
const _ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

let _adminToken: string | null = null;

/** Revoca pe server sesiunea din spatele unui token admin. Best-effort. */
function _revokeOnServer(token: string | null): void {
  // Niciodata tokenul de user: asta ar inchide sesiunea aplicatiei principale.
  if (!token || token === auth.token) return;
  // `handleUnauthorized: false`: un 401 aici inseamna doar ca sesiunea admin
  // era deja moarta, nu ca userul trebuie scos din aplicatie.
  void apiFetch("/api/auth/logout", {
    method: "POST",
    authToken: token,
    handleUnauthorized: false,
    keepalive: true,
  }).catch(() => undefined);
}

function _readPersistedAdminToken(): string | null {
  try {
    const exp = Number(localStorage.getItem(_ADMIN_TOKEN_EXP_KEY) ?? 0);
    if (!exp || Date.now() >= exp) {
      _revokeOnServer(localStorage.getItem(_ADMIN_TOKEN_KEY));
      localStorage.removeItem(_ADMIN_TOKEN_KEY);
      localStorage.removeItem(_ADMIN_TOKEN_EXP_KEY);
      return null;
    }
    return localStorage.getItem(_ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Salveaza un token admin (sau il sterge daca primeste null). */
export function setAdminToken(t: string | null): void {
  _adminToken = t;
  try {
    if (t) {
      localStorage.setItem(_ADMIN_TOKEN_KEY, t);
      localStorage.setItem(_ADMIN_TOKEN_EXP_KEY, String(Date.now() + _ADMIN_TOKEN_TTL_MS));
    } else {
      localStorage.removeItem(_ADMIN_TOKEN_KEY);
      localStorage.removeItem(_ADMIN_TOKEN_EXP_KEY);
    }
  } catch {
    // storage quota/disabled — token ramane doar in-memory
  }
}

/** Logout AdminV2: revoca sesiunea pe server, apoi uita tokenul local. */
export function revokeAdminToken(): void {
  let token = _adminToken;
  if (!token) {
    try {
      token = localStorage.getItem(_ADMIN_TOKEN_KEY);
    } catch {
      token = null;
    }
  }
  _revokeOnServer(token);
  setAdminToken(null);
}

/** `true` daca exista un token admin persistat si inca valabil (<24h).
 *  Unul expirat este revocat pe server si sters pe loc. */
export function hasValidAdminToken(): boolean {
  return _readPersistedAdminToken() !== null;
}

/** Tokenul admin daca exista si nu a expirat, altfel tokenul user, altfel null. */
export function getBearerToken(): string | null {
  if (_adminToken) return _adminToken;
  const persisted = _readPersistedAdminToken();
  if (persisted) _adminToken = persisted;
  return _adminToken ?? auth.token ?? null;
}

/** Wrapper peste apiFetch care injecteaza tokenul admin elevat (cu fallback la token-ul de user). */
export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(url, { ...options, authToken: getBearerToken() });
}

/** Wrapper peste apiUpload care injecteaza tokenul admin elevat. */
export function adminUpload(url: string, formData: FormData): Promise<Response> {
  return apiUpload(url, formData, { authToken: getBearerToken() });
}
