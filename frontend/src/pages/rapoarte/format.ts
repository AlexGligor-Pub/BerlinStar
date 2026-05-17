/** Helpers pure de formatare pentru pagina Rapoarte. */

export function toNumber(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoneyInt(n: number): string {
  return Math.round(n).toLocaleString("ro-RO", { maximumFractionDigits: 0 });
}

export function firstOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtRoDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}
