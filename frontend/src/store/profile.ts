/**
 * Sincronizarea profilului (cont + utilizator + rol) cu serverul.
 *
 * Sta separat de authStore ca sa evitam un import circular: `utils/api` are
 * nevoie de token din authStore, deci authStore nu poate importa `utils/api`.
 */
import { auth, logout, setProfile } from "./authStore";
import { apiFetch } from "../utils/api";

export interface MeResponse {
  id: number;
  name: string;
  username: string;
  description: string | null;
  email: string | null;
  image_url: string | null;
  code: string | null;
  user_id: number | null;
  user_name: string | null;
  user_username: string | null;
  role: string | null;
  resources: string[];
}

// `Protected` se re-monteaza la fiecare navigare intre rute; fara acest flag am
// lovi /api/auth/me la fiecare click de meniu.
let fetchedThisLoad = false;

/** Aduce rolul, resursele si codul firmei de la server si le pune in store.
 * Apelata la fiecare intrare in aplicatie: daca adminul a schimbat rolul,
 * UI-ul se aliniaza la primul refresh, fara re-login.
 *
 * `force: true` reface apelul chiar daca a fost deja facut in acest page load
 * (ex. dupa ce adminul isi schimba propriul rol din pagina Utilizatori). */
export async function refreshProfile(opts: { force?: boolean } = {}): Promise<void> {
  if (!auth.token) return;
  if (fetchedThisLoad && !opts.force) return;
  try {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) return;
    const d = (await res.json()) as MeResponse;
    setProfile({
      name: d.name ?? null,
      code: d.code ?? null,
      role: d.role ?? null,
      resources: d.resources ?? [],
      userName: d.user_name ?? null,
    });
    // Marcam abia dupa un raspuns bun: daca statia a pornit offline, urmatoarea
    // navigare mai incearca o data. Cu flagul setat inainte de `await`, un
    // singur esec de retea ar fi lasat rolul invechit pana la reload.
    fetchedThisLoad = true;
  } catch {
    // offline — pastram ce avem in localStorage
  }
}

/** Logout „curat": revoca sesiunea pe server (ca token-ul sa nu mai fie
 * folosibil) si abia apoi goleste starea locala. Daca serverul nu raspunde,
 * facem oricum logout local. */
export async function logoutEverywhere(redirectTo: string | null = "/login"): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", handleUnauthorized: false });
  } catch {
    // ignoram: important e sa nu blocam userul in aplicatie
  }
  logout(redirectTo);
}
