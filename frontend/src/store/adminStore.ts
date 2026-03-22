import { createSignal } from "solid-js";

const ADMIN_KEY = "bs_admin_visible";
const TTL_MS = 24 * 60 * 60 * 1000;

function readFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return false;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) { localStorage.removeItem(ADMIN_KEY); return false; }
    return value === true;
  } catch { return false; }
}

const [adminVisible, setAdminVisibleSignal] = createSignal<boolean>(readFromStorage());

export function setAdminVisible(v: boolean) {
  setAdminVisibleSignal(v);
  if (v) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ value: true, ts: Date.now() }));
  } else {
    localStorage.removeItem(ADMIN_KEY);
  }
}

export { adminVisible };
