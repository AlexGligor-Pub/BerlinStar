/**
 * Permisiuni pe rol — oglinda lui backend/app/permissions.py.
 *
 * ATENTIE: aici doar ASCUNDEM UI. Autorizarea reala se face pe server
 * (`require_resource` / `get_*_account_id` din app/dependencies.py), care
 * verifica rolul din baza de date la fiecare request. Daca modifici matricea
 * de mai jos, modifica-o si in backend — altfel userul vede butoane care
 * intorc 403.
 */
import { auth } from "./authStore";

export type Role = "admin" | "manager" | "worker";

export type Resource =
  | "operations" // POS, Receptie, Clienti, Programari, Hotel, Concedii
  | "settings"   // Configurari
  | "advanced"   // Stocuri, e-Factura, Factura Rapida, fisa angajat
  | "reports"    // Rapoarte
  | "users";     // gestionarea utilizatorilor contului

/** Fallback local, folosit doar daca serverul nu ne-a trimit lista de resurse. */
const ROLE_RESOURCES: Record<Role, Resource[]> = {
  admin: ["operations", "settings", "advanced", "reports", "users"],
  manager: ["operations", "settings", "advanced"],
  worker: ["operations"],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  manager: "Manager",
  worker: "Lucrător",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Acces complet, inclusiv Rapoarte și gestionarea utilizatorilor.",
  manager: "Acces la tot, în afară de Rapoarte și utilizatori.",
  worker: "Doar zona operațională: POS, Recepție, Clienți, Programări, Concedii.",
};

export const ALL_ROLES: Role[] = ["admin", "manager", "worker"];

export function role(): Role | null {
  return auth.role;
}

export function roleLabel(): string {
  const r = auth.role;
  return r ? ROLE_LABEL[r] : "";
}

/** `true` cand profilul (rol + resurse) a fost incarcat de la server. */
export function permissionsLoaded(): boolean {
  return auth.role !== null;
}

export function can(resource: Resource): boolean {
  // Lista trimisa de server la login / /api/auth/me — sursa preferata.
  const list = auth.resources;
  if (list && list.length > 0) return list.includes(resource);

  const r = auth.role;
  if (r && ROLE_RESOURCES[r]) return ROLE_RESOURCES[r].includes(resource);

  // Profil neincarcat inca (primul render dupa un refresh de pagina):
  // permitem optimist, ca sa nu aruncam userul de pe ruta pe care e deja.
  // Serverul respinge oricum cu 403 daca rolul nu are dreptul.
  return true;
}

export const canReports  = () => can("reports");
export const canSettings = () => can("settings");
export const canAdvanced = () => can("advanced");
export const canUsers    = () => can("users");

/**
 * Acțiuni privilegiate din paginile operaționale (ștergere client/programare,
 * aprobare concediu, editare bon blocat, administrare nomenclatoare hotel).
 * Inainte erau ascunse de "Vizibilitate Admin" (parola contului); acum sunt
 * pentru admin + manager, la fel ca zona de setari.
 */
export const canManage = () => can("settings");
