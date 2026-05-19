export interface CompanyMeta {
  company_id: number;
  name: string;
  cui: number | string;
  is_vat_payer: boolean | null;
  tva_percentage: number | null;
  locations: { id: number; name: string }[];
}

export interface ClientLite {
  id: number;
  tip: string;
  nume: string;
  cui: string | null;
  adresa: string | null;
  telefon: string | null;
  reprezentant: string | null;
  numar_masina: string | null;
}

export interface QuickInvoiceLine {
  lineId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  vatPercent: number;
}

export const VAT_OPTIONS = [0, 5, 9, 19] as const;

export function lineTotalNet(l: QuickInvoiceLine): number {
  return l.price * l.qty;
}

export function lineTotalGross(l: QuickInvoiceLine): number {
  return lineTotalNet(l) * (1 + l.vatPercent / 100);
}

export function sumGross(lines: QuickInvoiceLine[]): number {
  return lines.reduce((s, l) => s + lineTotalGross(l), 0);
}

export function todayPlusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function newLine(): QuickInvoiceLine {
  return {
    lineId: `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    qty: 1,
    unit: "buc",
    price: 0,
    vatPercent: 19,
  };
}
