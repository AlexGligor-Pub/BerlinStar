/**
 * Cate randuri de import asteapta o decizie in contul curent, pe tipuri.
 *
 * Alimenteaza indicatorii din meniul Configurări › Import si bannerele din
 * panourile de import. Se reincarca dupa fiecare actiune pe randuri, ca numarul
 * sa scada pe loc, fara refresh de pagina.
 */
import { createSignal } from "solid-js";
import { importApi, type ImportKind, type PendingSummary } from "../api/imports";
import { can } from "./permissions";

const EMPTY = { sessions: 0, rows: 0 };
const [pending, setPending] = createSignal<PendingSummary>({});

/** Randurile de rezolvat pentru un tip de import (0 daca rolul nu il vede). */
export const importPending = (kind: ImportKind) => pending()[kind] ?? EMPTY;

export async function refreshImportPending(): Promise<void> {
  if (!can("settings")) return; // importurile stau in Configurari (admin + manager)
  try {
    setPending(await importApi.pending());
  } catch {
    // Indicatorul e informativ: o eroare aici nu trebuie sa strice pagina.
  }
}
