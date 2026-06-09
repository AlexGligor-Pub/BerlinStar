import { createSignal } from "solid-js";

/**
 * Store global de conectivitate.
 *
 * Distinge intre doua tipuri de probleme client-side:
 *  - "no-internet"  -> browserul raporteaza offline (navigator.onLine === false)
 *  - "server-down"  -> avem internet, dar serverul nostru nu raspunde
 *
 * Sursele de semnal:
 *  1. evenimentele `online`/`offline` ale browserului
 *  2. raportarile din apiFetch (reportServerReachable / reportServerUnreachable)
 *  3. un health-check periodic pe /api/health (recuperare automata + detectie
 *     proactiva cand nu exista activitate de la user)
 */

// Acelasi calcul ca API_BASE din utils/api.ts, recalculat aici ca sa evitam
// un import circular (api.ts importa functiile de raportare din acest store).
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

const HEALTHY_POLL_MS = 30_000; // verificare lejera cand totul e ok
const DEGRADED_POLL_MS = 7_000; // verificare deasa cand incercam sa ne recuperam
const PING_TIMEOUT_MS = 5_000;

let pingInFlight = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
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
    const ok = res.ok;
    setServerReachable(ok);
    if (ok) setOnline(true);
    return ok;
  } catch {
    // Eroare de retea / timeout -> serverul e inaccesibil din acest client.
    setServerReachable(false);
    return false;
  } finally {
    pingInFlight = false;
  }
}

/** Buton "Reincearca" din banner. */
export function retryConnectivity(): Promise<boolean> {
  return pingHealth();
}

function scheduleNextPoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  const delay = connectivityStatus() === "online" ? HEALTHY_POLL_MS : DEGRADED_POLL_MS;
  pollTimer = setTimeout(async () => {
    // Daca browserul stie ca e offline, nu mai are sens sa lovim reteaua;
    // asteptam evenimentul `online`.
    if (online()) await pingHealth();
    scheduleNextPoll();
  }, delay);
}

/** Apelat din apiFetch cand un request a primit raspuns de la server (orice status HTTP). */
export function reportServerReachable(): void {
  if (!serverReachable()) setServerReachable(true);
  if (!online()) setOnline(true);
}

/**
 * Apelat din apiFetch cand un request a esuat la nivel de retea (server inaccesibil).
 * Nu marcam direct offline dintr-un singur esec (poate fi un request anulat sau o
 * eroare punctuala) — confirmam printr-un ping pe /api/health.
 */
export function reportServerUnreachable(): void {
  void pingHealth();
}

/** Porneste listeners-ii + polling-ul. Idempotent — apelat o singura data din App. */
export function initConnectivity(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => {
    setOnline(true);
    void pingHealth();
  });
  window.addEventListener("offline", () => {
    setOnline(false);
  });

  void pingHealth();
  scheduleNextPoll();
}

export { online, serverReachable };
