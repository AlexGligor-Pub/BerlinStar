import { createStore } from "solid-js/store";
import { setAdminVisible } from "./adminStore";

interface AuthState {
  user: string | null;
  token: string | null;
  isLocked: boolean;
  lockedAt: string | null; // ISO string
}

const STORAGE_KEY = "bs_auth";

// Cheile localStorage care contin date utilizator legate de cont si trebuie
// curatate la logout. NU le sterge cu localStorage.clear() — pastram theme,
// device setup, etc.
const ACCOUNT_SCOPED_KEYS = [
  STORAGE_KEY,
  "bs_products_cache_v2",
  "bs_cart",
  "bs_emp_view_mode",
  "bs_resume",
  "bs_admin_token",
];

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

export function login(user: string, token: string, isLocked = false, lockedAt: string | null = null) {
  const next: AuthState = { user, token, isLocked, lockedAt };
  setAuth(next);
  persist(next);
}

export function logout() {
  setAdminVisible(false);
  const next: AuthState = { user: null, token: null, isLocked: false, lockedAt: null };
  setAuth(next);
  // Sterge doar cheile legate de cont, nu intregul localStorage.
  for (const k of ACCOUNT_SCOPED_KEYS) {
    try { localStorage.removeItem(k); } catch {}
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
