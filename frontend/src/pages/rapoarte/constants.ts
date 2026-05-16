/** Paleta de culori folosita ciclic pentru chart-urile categorice. */
export const PALETTE = [
  "#5b7cfa", "#3ea96a", "#f5a623", "#a855f7", "#ef4444",
  "#06b6d4", "#e8441a", "#8b5cf6", "#10b981", "#ec4899",
  "#f59e0b", "#3b82f6",
] as const;

export function colorByIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/** Etichete romanesti pentru luni — pozitia 0 = Ianuarie, pozitia 11 = Decembrie. */
export const RO_MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Formateaza "YYYY-MM" la "MMM YYYY" (ex: "2026-05" → "Mai 2026"). */
export function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${RO_MONTHS[m - 1]} ${y}`;
}

/** Zilele saptamanii in romana, indexate la 0=Duminica conform Date.getDay(). */
export const RO_DOW = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"] as const;
export const RO_DOW_SHORT = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"] as const;

/** Paleta plata vs ne-plata folosita in raportul Locatii. */
export const PAY_COLORS = ["#5b7cfa", "#3ea96a", "#a855f7", "#f5a623", "#ef4444"] as const;
