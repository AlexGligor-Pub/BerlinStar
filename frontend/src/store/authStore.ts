import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

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

// Sincronizare automata cu localStorage
createEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    user: auth.user,
    token: auth.token,
    isLocked: auth.isLocked,
    lockedAt: auth.lockedAt,
  }));
});

export function login(user: string, token: string, isLocked = false, lockedAt: string | null = null) {
  setAuth({ user, token, isLocked, lockedAt });
}

export function logout() {
  setAuth({ user: null, token: null, isLocked: false, lockedAt: null });
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
