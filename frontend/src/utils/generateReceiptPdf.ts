/**
 * generateReceiptPdf.ts
 *
 * Generator PDF pentru bonuri Berlin Star.
 * Format: A4 portret, jsPDF + jspdf-autotable.
 *
 * Structura documentului:
 *   1. Header    — logo + date companie
 *   2. Meta      — titlu bon, data, casier, metoda plata
 *   3. Separator
 *   4. Tabel items
 *   5. Total + plata partiala (daca e cazul)
 *   6. Descriere (optional)
 *   7. Date tehnice (optional)
 *   8. Footer    — nr pagina + data generare
 */

import type { Receipt } from "../store/receiptsStore";
import { lastTableY, pageCount } from "./pdf/types";

// ─── Configurare vizuala ──────────────────────────────────────────────────────

const PDF_CONFIG = {
  margin: { left: 20, right: 20, top: 20 },
  colors: {
    accent:    [37, 99, 235]  as [number, number, number],
    dark:      [30, 30, 30]   as [number, number, number],
    muted:     [120, 120, 120] as [number, number, number],
    border:    [210, 210, 210] as [number, number, number],
    rowAlt:    [247, 249, 252] as [number, number, number],
    danger:    [220, 53, 69]  as [number, number, number],
    success:   [22, 163, 74]  as [number, number, number],
  },
  company: {
    name:    "Berlin Star",
    tagline: "Powered by Professor Prime S.R.L.",
  },
} as const;

const ML = PDF_CONFIG.margin.left;
const MR = PDF_CONFIG.margin.right;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - ML - MR;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ro-RO"),
    time: d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }),
    full: d.toLocaleString("ro-RO"),
  };
}

function payMethodColor(metoda: string | undefined): [number, number, number] {
  if (!metoda || metoda === "Neplatit") return PDF_CONFIG.colors.danger;
  if (metoda === "Platit Partial")       return [234, 88, 12];
  return PDF_CONFIG.colors.success;
}

// ─── Sectiuni document ────────────────────────────────────────────────────────

function drawHeader(doc: any, logoDataUrl: string | null): number {
  let y = PDF_CONFIG.margin.top;
  const { colors, company } = PDF_CONFIG;

  // Logo (daca e disponibil)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", ML, y, 18, 18);
  }

  const textX = logoDataUrl ? ML + 22 : ML;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.accent);
  doc.text(company.name, textX, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.muted);
  doc.text(company.tagline, textX, y + 14);

  // Linie separatoare header
  y += 24;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.5);
  doc.line(ML, y, PAGE_W - MR, y);

  return y + 6;
}

function drawMeta(doc: any, r: Receipt, y: number): number {
  const { colors } = PDF_CONFIG;
  const { date, time } = formatDate(r.date);

  // Titlu bon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...colors.dark);
  doc.text(r.titlu, ML, y);
  y += 8;

  // Grid 2 coloane: stanga info, dreapta status
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);

  const col2X = PAGE_W - MR - 50;

  doc.text(`Data: ${date}  ${time}`, ML, y);

  // Status plata (dreapta, colorat)
  const metoda = r.metodaPlata ?? "Neplatit";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...payMethodColor(r.metodaPlata));
  doc.text(metoda, col2X, y, { align: "left" });

  // Plata partiala
  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(`Avans: ${r.partialPay.toFixed(2)} lei`, col2X, y + 6);
  }

  y += 16;

  // Linie subtire
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PAGE_W - MR, y);

  return y + 6;
}

function drawItemsTable(doc: any, autoTable: any, r: Receipt, y: number): number {
  const { colors } = PDF_CONFIG;

  const rows = r.items.map((item) => [
    item.name,
    String(item.qty),
    item.unit,
    `${item.price.toFixed(2)} lei`,
    `${(item.price * item.qty).toFixed(2)} lei`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Denumire", "Cant.", "U.M.", "Pret unitar", "Total"]],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [...colors.dark],
    },
    headStyles: {
      fillColor: [...colors.accent],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [...colors.rowAlt],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30, fontStyle: "bold" },
    },
    margin: { left: ML, right: MR },
    tableLineColor: [...colors.border],
    tableLineWidth: 0.2,
  });

  return lastTableY(doc) + 4;
}

function drawTotal(doc: any, r: Receipt, y: number): number {
  const { colors } = PDF_CONFIG;
  const rightX = PAGE_W - MR;

  // Linie deasupra totalului
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.5);
  doc.line(ML, y, rightX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...colors.dark);
  doc.text("TOTAL", ML, y);
  doc.text(`${r.total.toFixed(2)} lei`, rightX, y, { align: "right" });
  y += 7;

  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    const rest = r.total - r.partialPay;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text(`Avans achitat: ${r.partialPay.toFixed(2)} lei`, ML, y);
    doc.setTextColor(...colors.danger);
    doc.text(`Rest de plata: ${rest.toFixed(2)} lei`, rightX, y, { align: "right" });
    y += 6;
  }

  return y + 4;
}

function drawTextBlock(doc: any, title: string, content: string, y: number): number {
  const { colors } = PDF_CONFIG;

  // Verifica spatiu pagina
  if (y > 250) {
    doc.addPage();
    y = PDF_CONFIG.margin.top;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);
  doc.text(title.toUpperCase(), ML, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.dark);

  const lines: string[] = doc.splitTextToSize(content, CONTENT_W);
  doc.text(lines, ML, y);
  y += lines.length * 5 + 4;

  return y;
}

function drawFooter(doc: any, pageCount: number) {
  const { colors } = PDF_CONFIG;
  const now = new Date().toLocaleString("ro-RO");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(ML, pageH - 14, PAGE_W - MR, pageH - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text(`Generat: ${now}`, ML, pageH - 8);
    doc.text(`Pagina ${i} / ${pageCount}`, PAGE_W - MR, pageH - 8, { align: "right" });
  }
}

// ─── Functie principala ───────────────────────────────────────────────────────

export async function generateReceiptPdf(r: Receipt): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Incarca logo in paralel
  let logoB64: string | null = null;
  try {
    const resp = await fetch(import.meta.env.BASE_URL + "logo.png");
    const blob = await resp.blob();
    logoB64 = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    // fara logo daca nu se poate incarca
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = drawHeader(doc, logoB64);
  y = drawMeta(doc, r, y);
  y = drawItemsTable(doc, autoTable, r, y);
  y = drawTotal(doc, r, y);

  if (r.descriere?.trim()) {
    y = drawTextBlock(doc, "Descriere", r.descriere.trim(), y);
  }

  if (r.dateTehn?.trim()) {
    y = drawTextBlock(doc, "Observații", r.dateTehn.trim(), y);
  }

  drawFooter(doc, pageCount(doc));

  const { date } = formatDate(r.date);
  doc.save(`berlin-star-bon-${date.replace(/\./g, "-")}-${r.id}.pdf`);
}
