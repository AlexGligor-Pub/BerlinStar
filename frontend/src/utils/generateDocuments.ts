/**
 * generateDocuments.ts
 *
 * Generator PDF pentru Deviz, Factură fiscală, Chitanță — Berlin Star.
 * Paletă Tesla-like: negru/alb/gri, minimalist profesional.
 * Format: A4 portret, jsPDF + jspdf-autotable.
 */

import type { Receipt } from "../store/receiptsStore";

// ─── Context documente ────────────────────────────────────────────────────────

export interface DocContext {
  serie: string;
  nr: number;
  company: {
    id?: number;
    name: string;
    cui: string | number;
    address?: string | null;
    nr_reg_com?: string | null;
    phone?: string | null;
  } | null;
  disclaimer: { title: string; text: string } | null;
}

// ─── Culori Tesla-like ────────────────────────────────────────────────────────

const C = {
  black:     [10, 10, 10]     as [number, number, number],
  darkGray:  [28, 28, 30]     as [number, number, number],
  midGray:   [110, 110, 115]  as [number, number, number],
  lightGray: [245, 245, 247]  as [number, number, number],
  separator: [229, 229, 229]  as [number, number, number],
  white:     [255, 255, 255]  as [number, number, number],
};

const ML = 18;
const MR = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - ML - MR;
const MT = 18;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO");
}

function fmtNow() {
  return new Date().toLocaleDateString("ro-RO");
}

function drawSeparator(doc: any, y: number, width = 0.3): number {
  doc.setDrawColor(...C.separator);
  doc.setLineWidth(width);
  doc.line(ML, y, PAGE_W - MR, y);
  return y + 4;
}

function drawHeaderBand(doc: any, title: string, serie: string, nr: number, date: string): number {
  // Fundal negru header band
  doc.setFillColor(...C.black);
  doc.rect(0, 0, PAGE_W, 26, "F");

  // Titlu document (stânga)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text(title, ML, 17);

  // Serie + Nr (dreapta sus)
  const serieNr = `${serie ? serie + " " : ""}Nr. ${nr}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(serieNr, PAGE_W - MR, 12, { align: "right" });
  doc.text(`Data: ${date}`, PAGE_W - MR, 18, { align: "right" });

  return 34;
}

function drawCompanyBlock(doc: any, label: string, company: DocContext["company"], x: number, y: number, blockW: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.midGray);
  doc.text(label.toUpperCase(), x, y);
  y += 4;

  if (!company) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.midGray);
    doc.text("—", x, y);
    return y + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  const nameLines: string[] = doc.splitTextToSize(company.name, blockW);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.darkGray);

  if (company.cui) { doc.text(`CUI: ${company.cui}`, x, y); y += 4; }
  if (company.nr_reg_com) { doc.text(`Nr.Reg.Com.: ${company.nr_reg_com}`, x, y); y += 4; }
  if (company.address) {
    const addrLines: string[] = doc.splitTextToSize(company.address, blockW);
    doc.text(addrLines, x, y);
    y += addrLines.length * 4;
  }
  if (company.phone) { doc.text(`Tel: ${company.phone}`, x, y); y += 4; }

  return y;
}

function drawClientBlock(doc: any, label: string, clientNume: string | null, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.midGray);
  doc.text(label.toUpperCase(), x, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  doc.text(clientNume ?? "—", x, y);
  y += 5;

  return y;
}

function drawItemsTable(doc: any, autoTable: any, r: Receipt, y: number): number {
  const rows = r.items.map((item) => [
    item.name,
    String(item.qty),
    item.unit,
    `${item.price.toFixed(2)} lei`,
    `${(item.price * item.qty).toFixed(2)} lei`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Denumire", "Cant.", "U.M.", "Preț unitar", "Total"]],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [...C.black] },
    headStyles: {
      fillColor: [...C.black],
      textColor: [...C.white],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [...C.lightGray] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 30, fontStyle: "bold" },
    },
    margin: { left: ML, right: MR },
    tableLineColor: [...C.separator],
    tableLineWidth: 0.2,
  });

  return (doc as any).lastAutoTable.finalY + 4;
}

function drawTotalRow(doc: any, r: Receipt, y: number): number {
  // Fundal negru pentru total
  doc.setFillColor(...C.black);
  doc.rect(ML, y, CONTENT_W, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text("TOTAL DE PLATĂ", ML + 4, y + 7);
  doc.text(`${r.total.toFixed(2)} lei`, PAGE_W - MR - 2, y + 7, { align: "right" });
  y += 14;

  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.midGray);
    doc.text(`Avans achitat: ${r.partialPay.toFixed(2)} lei`, ML, y);
    const rest = r.total - r.partialPay;
    doc.text(`Rest de plată: ${rest.toFixed(2)} lei`, PAGE_W - MR, y, { align: "right" });
    y += 6;
  }

  return y + 2;
}

function drawDisclaimer(doc: any, disclaimer: DocContext["disclaimer"], y: number): number {
  if (!disclaimer?.text) return y;
  if (y > 240) { doc.addPage(); y = MT; }

  y = drawSeparator(doc, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.midGray);
  doc.text((disclaimer.title || "DISCLAIMER").toUpperCase(), ML, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.midGray);
  const lines: string[] = doc.splitTextToSize(disclaimer.text, CONTENT_W);
  doc.text(lines, ML, y);
  y += lines.length * 3.8 + 4;

  return y;
}

function drawSignatureRow(doc: any, y: number): number {
  if (y > 248) { doc.addPage(); y = MT; }
  y += 6;

  const colW = CONTENT_W / 2 - 6;
  const col2X = ML + colW + 12;

  // Linii semnătură
  doc.setDrawColor(...C.separator);
  doc.setLineWidth(0.4);
  doc.line(ML, y, ML + colW, y);
  doc.line(col2X, y, col2X + colW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.midGray);
  doc.text("Semnătură Angajat", ML, y + 4.5);
  doc.text("Semnătură Client", col2X, y + 4.5);

  return y + 12;
}

function drawFooter(doc: any) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const now = fmtNow();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...C.separator);
    doc.setLineWidth(0.2);
    doc.line(ML, h - 12, PAGE_W - MR, h - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.midGray);
    doc.text(`Generat: ${now}`, ML, h - 7);
    doc.text(`Pagina ${i} / ${pageCount}`, PAGE_W - MR, h - 7, { align: "right" });
  }
}

// ─── Helper: încarcă jsPDF + autoTable ───────────────────────────────────────

async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

// ─── DEVIZ ────────────────────────────────────────────────────────────────────

export async function generateDeviz(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const date = fmtDate(r.date);
  let y = drawHeaderBand(doc, "DEVIZ", ctx.serie, ctx.nr, date);

  // Titlu bon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text(r.titlu, ML, y);
  y += 7;

  // Companie + Client — 2 coloane
  const blockW = CONTENT_W / 2 - 4;
  const col2X = ML + blockW + 8;
  const yCompany = drawCompanyBlock(doc, "Prestator", ctx.company, ML, y, blockW);
  const yClient  = drawClientBlock(doc, "Beneficiar", r.clientNume, col2X, y);
  y = Math.max(yCompany, yClient) + 4;

  y = drawSeparator(doc, y);
  y = drawItemsTable(doc, autoTable, r, y);
  y = drawTotalRow(doc, r, y);

  if (r.descriere?.trim()) {
    y = drawSeparator(doc, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.midGray);
    doc.text("DESCRIERE", ML, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    const lines: string[] = doc.splitTextToSize(r.descriere.trim(), CONTENT_W);
    doc.text(lines, ML, y);
    y += lines.length * 4.5 + 4;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y);
  y = drawSignatureRow(doc, y);
  drawFooter(doc);

  doc.save(`deviz-${ctx.serie || "BS"}${ctx.nr}-${date.replace(/\./g, "-")}.pdf`);
}

// ─── FACTURĂ ──────────────────────────────────────────────────────────────────

export async function generateFactura(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const date = fmtDate(r.date);
  let y = drawHeaderBand(doc, "FACTURĂ FISCALĂ", ctx.serie, ctx.nr, date);

  // Titlu bon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text(r.titlu, ML, y);
  y += 7;

  // Furnizor + Cumpărător — 2 coloane
  const blockW = CONTENT_W / 2 - 4;
  const col2X = ML + blockW + 8;
  const yFurnizor   = drawCompanyBlock(doc, "Furnizor", ctx.company, ML, y, blockW);
  const yCumparator = drawClientBlock(doc, "Cumpărător", r.clientNume, col2X, y);
  y = Math.max(yFurnizor, yCumparator) + 4;

  y = drawSeparator(doc, y);
  y = drawItemsTable(doc, autoTable, r, y);
  y = drawTotalRow(doc, r, y);

  // Metodă plată
  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.midGray);
    doc.text(`Modalitate de plată: ${r.metodaPlata}`, ML, y);
    y += 6;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y);
  y = drawSignatureRow(doc, y);
  drawFooter(doc);

  doc.save(`factura-${ctx.serie || "BS"}${ctx.nr}-${date.replace(/\./g, "-")}.pdf`);
}

// ─── CHITANȚĂ ────────────────────────────────────────────────────────────────

export async function generateChitanta(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const date = fmtDate(r.date);
  let y = drawHeaderBand(doc, "CHITANȚĂ", ctx.serie, ctx.nr, date);

  // Corp chitanță
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.darkGray);
  doc.text("Am primit de la", ML, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text(r.clientNume ?? "—", ML + 38, y);
  y += 10;

  // Linie separator sub "Am primit de la ..."
  drawSeparator(doc, y, 0.2);
  y += 2;

  // Suma în cifre
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.darkGray);
  doc.text("Suma de", ML, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.black);
  doc.text(`${r.total.toFixed(2)} lei`, ML + 24, y);
  y += 8;

  // Suma în litere
  const inLitere = sumInLitere(r.total);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...C.midGray);
  doc.text(`(${inLitere})`, ML, y);
  y += 10;

  // Reprezentând
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.darkGray);
  doc.text("Reprezentând", ML, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  const repLines: string[] = doc.splitTextToSize(r.titlu, CONTENT_W - 36);
  doc.text(repLines, ML + 34, y);
  y += repLines.length * 5.5 + 6;

  y = drawSeparator(doc, y);

  // Metodă plată
  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.midGray);
    doc.text(`Modalitate: ${r.metodaPlata}`, ML, y);
    y += 6;
  }

  y += 10;

  // Rubrică casier + semnătură companie
  const colW = CONTENT_W / 2 - 6;
  doc.setDrawColor(...C.separator);
  doc.setLineWidth(0.4);
  doc.line(ML, y, ML + colW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.midGray);
  doc.text("Casier / Operator", ML, y + 4.5);

  // Date companie jos-dreapta
  if (ctx.company) {
    const col2X = ML + colW + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ctx.company.name, col2X, y - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.midGray);
    if (ctx.company.cui) { doc.text(`CUI: ${ctx.company.cui}`, col2X, y - 4); }
    if (ctx.company.address) {
      const addrLines: string[] = doc.splitTextToSize(ctx.company.address, colW);
      doc.text(addrLines, col2X, y);
    }
  }

  drawFooter(doc);

  doc.save(`chitanta-${ctx.serie || "BS"}${ctx.nr}-${date.replace(/\./g, "-")}.pdf`);
}

// ─── Suma în litere ───────────────────────────────────────────────────────────

function sumInLitere(n: number): string {
  const total = Math.round(n);
  const bani = Math.round((n - total) * 100);
  const s = numarInLitere(total);
  if (bani > 0) return `${s} lei și ${numarInLitere(bani)} bani`;
  return `${s} lei`;
}

function numarInLitere(n: number): string {
  if (n === 0) return "zero";
  const unitati = ["", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă",
    "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece",
    "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
  const zeci = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

  function sub100(x: number): string {
    if (x < 20) return unitati[x];
    const z = Math.floor(x / 10);
    const u = x % 10;
    return u === 0 ? zeci[z] : `${zeci[z]} și ${unitati[u]}`;
  }

  function sub1000(x: number): string {
    if (x < 100) return sub100(x);
    const h = Math.floor(x / 100);
    const rest = x % 100;
    const prefix = h === 1 ? "o sută" : h === 2 ? "două sute" : `${sub100(h)} sute`;
    return rest === 0 ? prefix : `${prefix} ${sub100(rest)}`;
  }

  let result = "";
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    result += `${sub1000(m)} ${m === 1 ? "milion" : "milioane"} `;
    n %= 1000000;
  }
  if (n >= 1000) {
    const k = Math.floor(n / 1000);
    result += `${sub1000(k)} ${k === 1 ? "mie" : "mii"} `;
    n %= 1000;
  }
  if (n > 0) result += sub1000(n);
  return result.trim();
}
