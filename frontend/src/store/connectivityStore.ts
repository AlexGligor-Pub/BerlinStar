import { createSignal } from "solid-js";

// Conectivitate: online/offline din browser + rezultatele apiFetch; /api/health e lovit
// doar cat timp serverul e inaccesibil (backoff 5s->60s, pauza cu tab-ul ascuns).

// Duplicat din utils/api.ts ca sa evitam importul circular.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HEALTH_URL = `${API_BASE}/api/health`;

export type ConnectivityStatus = "online" | "no-internet" | "server-down";

const initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
const [online, setOnline] = createSignal(initialOnline);
const [serverReachable, setServerReachable] = createSignal(true);

/** Statusul agregat, folosit de UI. */
export function connectivityStatus(): ConnectivityStatus {
  if (!online()) return "no-internet";
  if (!serverReachable()) return "server-down";
  return "online";
}

/** true cand totul e ok (internet + server). */
export function isConnected(): boolean {
  return connectivityStatus() === "online";
}

const DEGRADED_POLL_MIN_MS = 5_000;
const DEGRADED_POLL_MAX_MS = 60_000;
const PING_TIMEOUT_MS = 5_000;
const FAILURE_PING_THROTTLE_MS = 10_000;

let pingInFlight = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let degradedDelay = DEGRADED_POLL_MIN_MS;
let lastFailurePingAt = 0;
let started = false;

/** Lovește /api/health si actualizeaza serverReachable. Returneaza true daca serverul raspunde. */
export async function pingHealth(): Promise<boolean> {
  if (pingInFlight) return serverReachable();
  pingInFlight = true;
  try {
    const res = await fetch(HEALTH_URL, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    setServerReachable(res.ok);
    if (res.ok) setOnline(true);
    return res.ok;
  } catch {
    setServerReachable(false);
    return false;
  } finally {
    pingInFlight = false;
    if (connectivityStatus() === "online") stopDegradedPolling();
    else scheduleDegradedPoll();
  }
}

/** Buton "Reincearca" din banner. */
export function retryConnectivity(): Promise<boolean> {
  return pingHealth();
}

function stopDegradedPolling(): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  degradedDelay = DEGRADED_POLL_MIN_MS;
}

function scheduleDegradedPoll(): void {
  if (pollTimer || typeof document === "undefined") return;
  if (document.hidden || !online()) return;
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    degradedDelay = Math.min(degradedDelay * 2, DEGRADED_POLL_MAX_MS);
    await pingHealth();
  }, degradedDelay);
}

/** Apelat din apiFetch cand un request a primit raspuns de la server (orice status HTTP). */
export function reportServerReachable(): void {
  if (!serverReachable()) setServerReachable(true);
  if (!online()) setOnline(true);
  stopDegradedPolling();
}

/** Din apiFetch la eroare de retea: confirmam cu un ping, cel mult unul la 10s. */
export function reportServerUnreachable(): void {
  const now = Date.now();
  if (now - lastFailurePingAt < FAILURE_PING_THROTTLE_MS) return;
  lastFailurePingAt = now;
  void pingHealth();
}

/** Porneste listeners-ii. Idempotent — apelat o singura data din App. */
export function initConnectivity(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => {
    setOnline(true);
    void pingHealth();
  });
  window.addEventListener("offline", () => {
    setOnline(false);
    stopDegradedPolling();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopDegradedPolling();
    else if (connectivityStatus() !== "online") void pingHealth();
  });
}

export { online, serverReachable };
