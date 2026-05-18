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

export function toLocalISO(d: Date): string {
  // YYYY-MM-DD in fusul orar local — evita ofsetul UTC din toISOString()
  // care, in Romania (UTC+2/+3), face ca "azi" la 01:00 noaptea sa devina "ieri".
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstOfMonthISO(): string {
  const d = new Date();
  return toLocalISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

export function fmtRoDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}
