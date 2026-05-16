import { createStore } from "solid-js/store";
import { setAdminVisible } from "./adminStore";

interface AuthState {
  user: string | null;
  token: string | null;
  isLocked: boolean;
  lockedAt: string | null; // ISO string
}

const STORAGE_KEY = "bs_auth";

function loadAuth(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { isLocked: false, lockedAt: null, ...JSON.parse(saved) };
  } catch {}
  return { user: null, token: null, isLocked: false, lockedAt: null };
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
  const next: AuthState = { user, token, isLocked, lockedAt };
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
  const next: AuthState = { user, token, isLocked, lockedAt };
  setAuth(next);
  persist(next);
  // Hard reload pentru ca toate store-urile Solid sa se reinitializeze de la zero.
  window.location.assign(target);
}

export function logout(redirectTo: string | null = "/login") {
  setAdminVisible(false);
  const next: AuthState = { user: null, token: null, isLocked: false, lockedAt: null };
  setAuth(next);
  clearAllStorage();
  if (redirectTo) {
    // Hard reload pentru a sterge si starea in-memory a store-urilor Solid.
    window.location.assign(redirectTo);
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
