import type { jsPDF } from "jspdf";

/**
 * jsPDF + jspdf-autotable augumentat la runtime cu campuri ce nu apar
 * in types-urile oficiale (lastAutoTable, internal.getNumberOfPages, etc).
 * Folosim un singur cast tipat aici in loc sa risipim `as any` peste tot.
 */
export interface JsPdfExt extends jsPDF {
  lastAutoTable?: { finalY: number };
  internal: jsPDF["internal"] & {
    getNumberOfPages(): number;
  };
}

/** Cast tipat: foloseste asta in loc de `(doc as any)`. */
export function ext(doc: jsPDF): JsPdfExt {
  return doc as JsPdfExt;
}

/** Ultimul Y de la autoTable. Throw daca nu s-a desenat inca o tabela — defensive. */
export function lastTableY(doc: jsPDF): number {
  const last = ext(doc).lastAutoTable;
  if (!last) throw new Error("lastAutoTable nu este setat — apel inainte de autoTable.");
  return last.finalY;
}

/** Numarul total de pagini din document. */
export function pageCount(doc: jsPDF): number {
  return ext(doc).internal.getNumberOfPages();
}
