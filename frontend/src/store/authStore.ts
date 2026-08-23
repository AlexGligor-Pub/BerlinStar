import { createStore } from "solid-js/store";
import type { Resource, Role } from "./permissions";

interface AuthState {
  user: string | null;
  token: string | null;
  isLocked: boolean;
  lockedAt: string | null; // ISO string
  /** Numele afisabil al contului (account.name). Diferit de `user` (username).
   * Populat la mount-ul NavBar via /api/auth/me; actualizat din ContulMeuPanel. */
  displayName: string | null;
  /** Rolul utilizatorului logat (nu al contului). `null` = neincarcat inca. */
  role: Role | null;
  /** Resursele permise, trimise de server la login si la /api/auth/me. */
  resources: Resource[];
  /** Codul firmei — necesar la login, fiindca username-ul e unic doar in cont. */
  code: string | null;
  /** Numele utilizatorului logat (user.name), pentru afisare in NavBar. */
  userName: string | null;
}

const STORAGE_KEY = "bs_auth";
/** Codul firmei folosit la ultimul login, pastrat separat ca sa supravietuiasca
 * logout-ului: pe un POS de atelier nu vrem sa fie retastat la fiecare tura. */
const LAST_CODE_KEY = "bs_last_code";

// Vite serveste appul sub `base` (in productie `/berlinstar/`). Router-ul stie
// de base, dar `window.location.assign` interpreteaza caile absolute fata de
// origin, deci `/login` ar duce la `https://host/login` in loc de
// `https://host/berlinstar/login`. Prefixam manual base-ul pentru hard reloads.
function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  // Daca primim accidental // la inceput, normalizam la / inainte de orice
  // prefixare (altfel ar deveni /berlinstar//login).
  if (path.startsWith("//")) path = path.replace(/^\/+/, "/");
  if (!base) return path;
  if (!path.startsWith("/")) return path;
  if (path === base || path.startsWith(base + "/")) return path;
  return base + path;
}

function emptyState(): AuthState {
  return {
    user: null, token: null, isLocked: false, lockedAt: null,
    displayName: null, role: null, resources: [], code: null, userName: null,
  };
}

function loadAuth(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...emptyState(), ...JSON.parse(saved) };
  } catch {}
  return emptyState();
}

const [auth, setAuth] = createStore<AuthState>(loadAuth());

function persist(state: AuthState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/** Actualizeaza numele afisabil al contului si il persista. Folosit dupa
 * /api/auth/me sau dupa editarea profilului din Configurari -> Contul Meu. */
export function setDisplayName(name: string | null): void {
  setAuth("displayName", name);
  persist({ ...auth, displayName: name });
}

/** Aplica datele venite de la /api/auth/me (rol, resurse, cod firma, nume).
 * Apelata la fiecare boot de aplicatie: un rol schimbat de admin se reflecta in
 * UI la primul refresh, fara re-login. */
export function setProfile(p: {
  name?: string | null;
  code?: string | null;
  role?: string | null;
  resources?: string[];
  userName?: string | null;
}): void {
  const patch: Partial<AuthState> = {};
  if (p.name !== undefined) patch.displayName = p.name;
  if (p.code !== undefined) patch.code = p.code;
  if (p.role !== undefined) patch.role = (p.role as Role | null) ?? null;
  if (p.resources !== undefined) patch.resources = (p.resources ?? []) as Resource[];
  if (p.userName !== undefined) patch.userName = p.userName;
  setAuth(patch);
  persist({ ...auth, ...patch });
}

/** Chei care NU tin de utilizatorul logat, ci de browserul/dispozitivul asta. */
const KEEP_THEME  = "bs_theme";   // preferinta vizuala a statiei
const KEEP_DEVICE = "bs_device";  // POS-ul inregistrat (id + locatie)

/**
 * Goleste stocarea locala, pastrand DOAR cheile primite.
 *
 * Abordarea e „sterge tot, apoi pune la loc exceptiile", nu „sterge cheile
 * cunoscute": orice cache adaugat in viitor (produse, bonuri, nomenclatoare…)
 * dispare automat la schimbarea utilizatorului, fara sa fie nevoie ca cineva
 * sa-si aminteasca sa-l adauge intr-o lista.
 */
function purgeStorage(keep: string[]): void {
  try {
    const saved = new Map<string, string>();
    for (const k of keep) {
      const v = localStorage.getItem(k);
      if (v !== null) saved.set(k, v);
    }
    localStorage.clear();
    for (const [k, v] of saved) localStorage.setItem(k, v);
  } catch {
    // storage indisponibil (private mode / quota) — nu blocam autentificarea
  }
  // sessionStorage nu contine nimic care sa merite pastrat intre utilizatori.
  try { sessionStorage.clear(); } catch {}
}

/** Codul firmei folosit ultima data, pentru precompletarea formularului de login. */
export function lastCompanyCode(): string {
  try { return localStorage.getItem(LAST_CODE_KEY) ?? ""; } catch { return ""; }
}

function rememberCompanyCode(code: string | null): void {
  if (!code) return;
  try { localStorage.setItem(LAST_CODE_KEY, code); } catch {}
}

export interface LoginResult {
  role?: string | null;
  resources?: string[];
  code?: string | null;
}

function buildState(
  user: string,
  token: string,
  isLocked: boolean,
  lockedAt: string | null,
  extra: LoginResult = {},
): AuthState {
  return {
    ...emptyState(),
    user,
    token,
    isLocked,
    lockedAt,
    role: (extra.role as Role | null) ?? null,
    resources: (extra.resources ?? []) as Resource[],
    code: extra.code ?? null,
  };
}

/**
 * Pregateste stocarea pentru un utilizator nou.
 *
 * Dispozitivul inregistrat se pastreaza doar daca ne logam la ACEEASI firma:
 * `bs_device` refera un rand din `devices` care apartine unui cont anume, iar
 * pastrarea lui la schimbarea firmei ar lega sesiunea noua de dispozitivul
 * altui cont. La aceeasi firma il pastram intentionat — altfel fiecare
 * logout/login ar inregistra un POS nou si lista de dispozitive s-ar umple.
 */
function prepareStorageForLogin(code: string | null): void {
  const sameCompany = !!code && code === lastCompanyCode();
  purgeStorage(sameCompany ? [KEEP_THEME, KEEP_DEVICE] : [KEEP_THEME]);
}

export function login(
  user: string,
  token: string,
  isLocked = false,
  lockedAt: string | null = null,
  extra: LoginResult = {},
) {
  prepareStorageForLogin(extra.code ?? null);
  const next = buildState(user, token, isLocked, lockedAt, extra);
  setAuth(next);
  persist(next);
  rememberCompanyCode(next.code);
}

export function loginAndRedirect(
  user: string,
  token: string,
  isLocked: boolean,
  lockedAt: string | null,
  target: string,
  extra: LoginResult = {},
) {
  prepareStorageForLogin(extra.code ?? null);
  const next = buildState(user, token, isLocked, lockedAt, extra);
  setAuth(next);
  persist(next);
  rememberCompanyCode(next.code);
  // Hard reload: goleste si starea in-memory a store-urilor Solid (cos, bonuri,
  // cache-uri), care nu tine de localStorage.
  window.location.assign(withBase(target));
}

// Folosita de AdminV2 la "Ofera support tehnic". Backendul emite un token de
// sesiune reala pentru adminul contului tinta, deci rolul si resursele vin cu el
// si nu mai avem nevoie de flag-uri locale de vizibilitate.
export function loginAsImpersonatedUser(
  user: string,
  token: string,
  isLocked: boolean,
  lockedAt: string | null,
  target: string,
  extra: LoginResult = {},
) {
  // Suportul intra in contul altcuiva: nu pastram nici dispozitivul, nici codul.
  purgeStorage([KEEP_THEME]);
  const next = buildState(user, token, isLocked, lockedAt, extra);
  setAuth(next);
  persist(next);
  window.location.assign(withBase(target));
}

export function logout(redirectTo: string | null = "/login") {
  const code = auth.code || lastCompanyCode();
  setAuth(emptyState());
  // Pastram doar tema si dispozitivul (proprietati ale statiei, nu ale omului).
  // Tot restul — token, rol, cos, bonuri, cache-uri de nomenclatoare — dispare.
  purgeStorage([KEEP_THEME, KEEP_DEVICE]);
  // Codul firmei nu e secret si e acelasi pe toata durata vietii unui POS;
  // il rescriem dupa golire ca ecranul de login sa fie precompletat.
  rememberCompanyCode(code);
  if (redirectTo) {
    // Hard reload pentru a sterge si starea in-memory a store-urilor Solid.
    window.location.assign(withBase(redirectTo));
  }
}

export const TRIAL_DAYS = 30;

export function trialRemainingMs(): number {
  if (!auth.isLocked || !auth.lockedAt) return Infinity;
  const expiry = new Date(auth.lockedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return expiry - Date.now();
}

export function trialExpired(): boolean {
  return auth.isLocked && trialRemainingMs() <= 0;
}

export { auth };
