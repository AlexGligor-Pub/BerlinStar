import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

interface AuthState {
  user: string | null;
  token: string | null;
}

const STORAGE_KEY = "bs_auth";

function loadAuth(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { user: null, token: null };
}

const [auth, setAuth] = createStore<AuthState>(loadAuth());

// Sincronizare automata cu localStorage
createEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: auth.user, token: auth.token }));
});

export function login(user: string, token: string) {
  setAuth({ user, token });
}

export function logout() {
  setAuth({ user: null, token: null });
}

export { auth };
