import { createStore } from "solid-js/store";
import { setAdminVisible } from "./adminStore";
import { setReportsToken } from "../pages/rapoarte/reports-auth";

interface AuthState {
  user: string | null;
  token: string | null;
  isLocked: boolean;
  lockedAt: string | null; // ISO string
  /** Numele afisabil al contului (account.name). Diferit de `user` (username).
   * Populat la mount-ul NavBar via /api/auth/me; actualizat din ContulMeuPanel. */
  displayName: string | null;
}

const STORAGE_KEY = "bs_auth";

// Vite serveste appul sub `base` (in productie `/berlinstar/`). Router-ul stie
// de base, dar `window.location.assign` interpreteaza caile absolute fata de
// origin, deci `/login` ar duce la `https://host/login` in loc de
// `https://host/berlinstar/login`. Prefixam manual base-ul pentru hard reloads.
function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!base) return path;
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path === base || path.startsWith(base + "/")) return path;
  return base + path;
}

function loadAuth(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { isLocked: false, lockedAt: null, displayName: null, ...JSON.parse(saved) };
  } catch {}
  return { user: null, token: null, isLocked: false, lockedAt: null, displayName: null };
}

/** Actualizeaza numele afisabil al contului si il persista. Folosit dupa
 * /api/auth/me sau dupa editarea profilului din Configurari -> Contul Meu. */
export function setDisplayName(name: string | null): void {
  setAuth("displayName", name);
  persist({ ...auth, displayName: name });
}

const [auth, setAuth] = createStore<AuthState>(loadAuth());

function persist(state: AuthState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearAllStorage() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
}

export function login(user: string, token: string, isLocked = false, lockedAt: string | null = null) {
  clearAllStorage();
  const next: AuthState = { user, token, isLocked, lockedAt, displayName: null };
  setAuth(next);
  persist(next);
}

export function loginAndRedirect(
  user: string,
  token: string,
  isLocked: boolean,
  lockedAt: string | null,
  target: string,
) {
  clearAllStorage();
  const next: AuthState = { user, token, isLocked, lockedAt, displayName: null };
  setAuth(next);
  persist(next);
  // Hard reload pentru ca toate store-urile Solid sa se reinitializeze de la zero.
  window.location.assign(withBase(target));
}

// Folosita de AdminV2 la "Ofera support tehnic" — logheaza super-adminul ca user
// tinta si activeaza vizibilitatea admin (Rapoarte + Configurari) imediat dupa
// reload, ca sa vada toate paginile.
export function loginAsImpersonatedUser(
  user: string,
  token: string,
  isLocked: boolean,
  lockedAt: string | null,
  target: string,
) {
  clearAllStorage();
  const next: AuthState = { user, token, isLocked, lockedAt, displayName: null };
  setAuth(next);
  persist(next);
  // Setam direct flag-ul adminVisible in localStorage (cheia/formatul din
  // adminStore.ts) — la hard reload, adminStore citeste si activeaza tile-urile
  // Rapoarte + Configurari fara sa fie nevoie sa retrecem prin modalul de parola.
  try {
    localStorage.setItem(
      "bs_admin_visible",
      JSON.stringify({ value: true, ts: Date.now() }),
    );
  } catch {
    // storage quota/disabled — ignoram, userul oricum poate activa manual.
  }
  window.location.assign(withBase(target));
}

export function logout(redirectTo: string | null = "/login") {
  setAdminVisible(false);
  // Invalidam explicit si tokenul de Rapoarte inainte de clearAllStorage —
  // setReportsToken(null) sterge si copia in-memory, nu doar storage-ul.
  try { setReportsToken(null); } catch {}
  const next: AuthState = { user: null, token: null, isLocked: false, lockedAt: null, displayName: null };
  setAuth(next);
  clearAllStorage();
  if (redirectTo) {
    // Hard reload pentru a sterge si starea in-memory a store-urilor Solid.
    window.location.assign(withBase(redirectTo));
  }
}

export const TRIAL_DAYS = 7;

export function trialRemainingMs(): number {
  if (!auth.isLocked || !auth.lockedAt) return Infinity;
  const expiry = new Date(auth.lockedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return expiry - Date.now();
}

export function trialExpired(): boolean {
  return auth.isLocked && trialRemainingMs() <= 0;
}

export { auth };
