/**
 * Helper-e de formatare folosite de toate generatoarele PDF.
 */

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO");
}

export function fmtNow(): string {
  return new Date().toLocaleDateString("ro-RO");
}

/** Format moneda ron, doua zecimale. */
export function lei(n: number): string {
  return `${n.toFixed(2)} lei`;
}

/** Nume fisier PDF: `{prefix}_{slug}_{YYYYMMDDHHmmss}.pdf`. */
export function docFilename(prefix: string, titlu: string): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const slug = titlu
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // diacritice
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim().replace(/\s+/g, "_")
    .slice(0, 60);
  return `${prefix}_${slug}_${ts}.pdf`;
}

/** Inlocuieste diacriticele care nu sunt in Latin-1 cu echivalente ASCII. */
export function asciifyDiacritics(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/ă/g, "a").replace(/Ă/g, "A")
    .replace(/[șşȘŞ]/g, (c) => /[A-Z]/.test(c) ? "S" : "s")
    .replace(/[țţȚŢ]/g, (c) => /[A-Z]/.test(c) ? "T" : "t");
}
