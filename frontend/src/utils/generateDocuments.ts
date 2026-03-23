/**
 * generateDocuments.ts — Deviz, Factura fiscala, Chitanta
 * Design print-friendly: fara fundal inchis, cerneala minima.
 * Caractere romane convertite la ASCII pentru compatibilitate jsPDF.
 */

import type { Receipt } from "../store/receiptsStore";

// ─── Context ──────────────────────────────────────────────────────────────────

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
    tva_percentage?: number | null;
    logo_path?: string | null;
    background_path?: string | null;
    website?: string | null;
  } | null;
  disclaimer: { title: string; text: string } | null;
}

// ─── Culori ───────────────────────────────────────────────────────────────────

const C = {
  black:     [20, 20, 20]      as [number, number, number],
  gray:      [100, 100, 100]   as [number, number, number],
  lightGray: [180, 180, 180]   as [number, number, number],
  veryLight: [240, 240, 240]   as [number, number, number],  // header tabel
  white:     [255, 255, 255]   as [number, number, number],
};

const ML = 15;
const MR = 15;
const PAGE_W = 210;
const CW = PAGE_W - ML - MR;  // content width
const MT = 14;
const PAGE_H = 297;

// ─── Encoding helper ──────────────────────────────────────────────────────────
// jsPDF standard (Helvetica) = Latin-1; diacriticele romanesti nu sunt in Latin-1

function ro(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[ăÅ£]/g, (c) => c === c.toLowerCase() ? "a" : "A")
    .replace(/Ă/g, "A")
    .replace(/ă/g, "a")
    .replace(/â/g, "a").replace(/Â/g, "A")
    .replace(/î/g, "i").replace(/Î/g, "I")
    .replace(/[șşȘŞ]/g, (c) => /[A-Z]/.test(c) ? "S" : "s")
    .replace(/[țţȚŢ]/g, (c) => /[A-Z]/.test(c) ? "T" : "t");
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ro-RO");
}

function fmtNow() {
  return new Date().toLocaleDateString("ro-RO");
}

function docFilename(prefix: string, titlu: string): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHmmss
  const slug = titlu
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // scoate diacritice
    .replace(/[^a-zA-Z0-9 _-]/g, "")                 // scoate caractere speciale
    .trim().replace(/\s+/g, "_")
    .slice(0, 60);
  return `${prefix}_${slug}_${ts}.pdf`;
}

function lei(n: number) {
  return `${n.toFixed(2)} lei`;
}

// ─── Componente desenare ──────────────────────────────────────────────────────

/** Linie orizontala subtire */
function hline(doc: any, y: number, color = C.lightGray, w = 0.2): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(ML, y, PAGE_W - MR, y);
}

/** Header document: titlu + serie/nr + data (stanga), logo (dreapta via drawLogo) */
function drawHeader(doc: any, title: string, serie: string, nr: number, date: string): number {
  let y = MT;

  // Titlu document
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.black);
  doc.text(ro(title), ML, y);

  // Serie + Nr + Data — stanga, sub titlu
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray);
  y += 6;
  if (serie) {
    doc.text(`Serie: ${serie}   Nr.: ${String(nr).padStart(2, "0")}`, ML, y);
  } else {
    doc.text(`Nr.: ${String(nr).padStart(2, "0")}`, ML, y);
  }
  y += 4;
  doc.text(`Data: ${date}`, ML, y);

  y += 5;
  return y + 5;
}

/** Bloc companie: eticheta + camp info */
function drawCompanyBlock(
  doc: any, label: string, company: DocContext["company"],
  x: number, y: number, bw: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(ro(label).toUpperCase(), x, y);
  y += 3.5;

  if (!company) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.lightGray);
    doc.text("-", x, y);
    return y + 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  const nameLines: string[] = doc.splitTextToSize(ro(company.name), bw);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  if (company.cui) { doc.text(`CUI: ${company.cui}`, x, y); y += 3.5; }
  if (company.nr_reg_com) { doc.text(`Reg.Com.: ${ro(company.nr_reg_com)}`, x, y); y += 3.5; }
  if (company.address) {
    const al: string[] = doc.splitTextToSize(ro(company.address), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (company.phone) { doc.text(`Tel: ${ro(company.phone)}`, x, y); y += 3.5; }
  return y;
}

/** Bloc client */
function drawClientBlock(
  doc: any, label: string, r: Receipt,
  x: number, y: number, bw: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(ro(label).toUpperCase(), x, y);
  y += 3.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  const lines: string[] = doc.splitTextToSize(ro(r.clientNume ?? "-"), bw);
  doc.text(lines, x, y);
  y += lines.length * 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  if (r.clientCui)          { doc.text(`CUI: ${r.clientCui}`, x, y); y += 3.5; }
  if (r.clientReprezentant) { doc.text(`Repr.: ${ro(r.clientReprezentant)}`, x, y); y += 3.5; }
  if (r.clientAdresa) {
    const al: string[] = doc.splitTextToSize(ro(r.clientAdresa), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (r.clientTelefon) { doc.text(`Tel: ${r.clientTelefon}`, x, y); y += 3.5; }
  return y;
}

/** Tabel articole cu TVA per linie */
function drawItemsTable(doc: any, autoTable: any, r: Receipt, y: number, tvaPct: number): number {
  const rows = r.items.map((item, idx) => {
    const net = item.price * item.qty;
    const tva = net * (tvaPct / 100);
    const total = net + tva;
    return [
      String(idx + 1),
      ro(item.name),
      String(item.qty),
      ro(item.unit),
      item.price.toFixed(2),
      net.toFixed(2),
      tva.toFixed(2),
      total.toFixed(2),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Denumire", "Cant.", "U.M.", "Pret unit.", "Val. net", "Val. TVA", "Total"]],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
      textColor: [...C.black],
      lineColor: [...C.lightGray],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...C.veryLight],
      textColor: [...C.black],
      fontSize: 7,
      fontStyle: "bold",
      lineColor: [...C.lightGray],
      lineWidth: 0.2,
    },
    alternateRowStyles: {},
    columnStyles: {
      0: { halign: "center", cellWidth: 8, textColor: [...C.gray] },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 11 },
      3: { halign: "center", cellWidth: 11 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", cellWidth: 24, fontStyle: "bold" },
    },
    margin: { left: ML, right: MR },
    tableWidth: CW,
  });

  return (doc as any).lastAutoTable.finalY + 3;
}

/** Sectiune totale — TVA afisat intotdeauna (0% daca nu e platitor TVA) */
function drawTotals(
  doc: any, r: Receipt, y: number, tvaPct: number | null | undefined
): number {
  const rightX = PAGE_W - MR;
  const labelX = rightX - 60;

  const pct = tvaPct ?? 0;
  const net = r.total;
  const tvaAmt = net * (pct / 100);
  const totalFinal = net + tvaAmt;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray);

  // Subtotal fara TVA
  doc.text("Subtotal (fara TVA):", labelX, y);
  doc.text(lei(net), rightX, y, { align: "right" });
  y += 4.5;

  // TVA
  doc.text(`TVA ${pct}%:`, labelX, y);
  doc.text(lei(tvaAmt), rightX, y, { align: "right" });
  y += 4.5;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  // Total de plata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text("TOTAL DE PLATA:", labelX, y);
  doc.text(lei(totalFinal), rightX, y, { align: "right" });
  y += 5;

  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    const restVal = totalFinal - r.partialPay;
    doc.text(`Avans: ${lei(r.partialPay)}`, labelX, y);
    doc.text(`Rest: ${lei(restVal)}`, rightX, y, { align: "right" });
    y += 4.5;
  }

  return y + 2;
}

/** Disclaimer — 6pt, gri deschis */
function drawDisclaimer(doc: any, disclaimer: DocContext["disclaimer"], y: number): number {
  if (!disclaimer?.text) return y;
  if (y > PAGE_H - 30) { doc.addPage(); y = MT; }

  hline(doc, y, C.veryLight, 0.2);
  y += 3;

  if (disclaimer.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...C.lightGray);
    doc.text(ro(disclaimer.title).toUpperCase(), ML, y);
    y += 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.lightGray);
  const lines: string[] = doc.splitTextToSize(ro(disclaimer.text), CW);
  doc.text(lines, ML, y);
  y += lines.length * 2.8 + 3;
  return y;
}

/** Doua rubrici de semnatura */
function drawSignatures(doc: any, leftLabel: string, rightLabel: string, y: number): number {
  if (y > PAGE_H - 22) { doc.addPage(); y = MT; }
  y += 8;

  const colW = CW / 2 - 8;
  const col2X = ML + colW + 16;

  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + colW, y);
  doc.line(col2X, y, col2X + colW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text(ro(leftLabel), ML, y + 4);
  doc.text(ro(rightLabel), col2X, y + 4);

  return y + 12;
}


async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

/** Incarca o imagine remote ca dataURL (via Image + canvas, fara CORS fetch) */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 300;
    canvas.height = img.naturalHeight || 300;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Deseneaza fundalul cu 20% opacitate pe pagina curenta (apeleaza inainte de orice alt continut) */
async function drawBackground(doc: any, url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    if (!dataUrl) return;
    const img = new Image();
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = dataUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = 794; canvas.height = 1123; // ~A4 la 96dpi
    const ctx2d = canvas.getContext("2d")!;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    ctx2d.globalAlpha = 0.5;
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const faded = canvas.toDataURL("image/png");
    doc.addImage(faded, "PNG", 0, 0, PAGE_W, PAGE_H, "bg", "FAST");
  } catch { /* ignore */ }
}

/** Deseneaza logo-ul in coltul din dreapta-sus */
async function drawLogo(doc: any, url: string | null | undefined, y: number): Promise<void> {
  if (!url) return;
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    if (!dataUrl) return;
    const logoH = 20;
    const logoW = 20;
    const x = PAGE_W - MR - logoW;
    doc.addImage(dataUrl, "PNG", x, y, logoW, logoH, undefined, "FAST");
  } catch { /* ignore */ }
}

/** Genereaza QR code ca data URL */
async function qrDataUrl(text: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(text, { width: 80, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

/** Footer cu website + QR code */
async function drawFooterWithBranding(doc: any, website: string | null | undefined): Promise<void> {
  const n = (doc as any).internal.getNumberOfPages();
  const now = fmtNow();
  const qr = website ? await qrDataUrl(website) : null;

  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    hline(doc, h - 10, C.veryLight, 0.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.lightGray);
    doc.text(`Generat: ${now}`, ML, h - 5.5);
    doc.text(`Pagina ${i} / ${n}`, PAGE_W - MR, h - 5.5, { align: "right" });

    if (website) {
      doc.setFontSize(6.5);
      doc.setTextColor(...C.gray);
      doc.text(website, PAGE_W / 2, h - 5.5, { align: "center" });
    }

    if (qr && i === 1) {
      const qrSize = 12;
      doc.addImage(qr, "PNG", PAGE_W / 2 - qrSize / 2, h - 10 - qrSize - 1, qrSize, qrSize, undefined, "FAST");
    }
  }
}

// ─── DEVIZ ────────────────────────────────────────────────────────────────────

export async function generateDeviz(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const date = fmtDate(r.date);

  // Background si logo
  await drawBackground(doc, ctx.company?.background_path);
  await drawLogo(doc, ctx.company?.logo_path, MT);

  let y = drawHeader(doc, "DEVIZ", ctx.serie, ctx.nr, date);

  // Titlu bon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  const titluLines: string[] = doc.splitTextToSize(ro(r.titlu), CW);
  doc.text(titluLines, ML, y);
  y += titluLines.length * 4.5 + 3;

  // Prestator + Beneficiar
  const bw = CW / 2 - 5;
  const col2X = ML + bw + 10;
  const y1 = drawCompanyBlock(doc, "Prestator", ctx.company, ML, y, bw);
  const y2 = drawClientBlock(doc, "Beneficiar", r, col2X, y, bw);
  y = Math.max(y1, y2) + 4;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  y = drawItemsTable(doc, autoTable, r, y, tvaPct);
  y = drawTotals(doc, r, y, tvaPct);

  if (r.descriere?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text("DESCRIERE", ML, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
    const dl: string[] = doc.splitTextToSize(ro(r.descriere.trim()), CW);
    doc.text(dl, ML, y);
    y += dl.length * 4 + 3;
  }

  if (r.dateTehn?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text("DATE TEHNICE", ML, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
    const dtl: string[] = doc.splitTextToSize(ro(r.dateTehn.trim()), CW);
    doc.text(dtl, ML, y);
    y += dtl.length * 4 + 3;
  }

  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    hline(doc, y, C.veryLight, 0.1);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.black);
    doc.text(`Platit partial / Avans: ${lei(r.partialPay)}`, ML, y);
    const tvaPct2 = ctx.company?.tva_percentage ?? 0;
    const totalFinal2 = r.total + r.total * (tvaPct2 / 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray);
    doc.text(`Rest de plata: ${lei(totalFinal2 - r.partialPay)}`, ML, y + 5);
    y += 12;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y);
  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y);
  await drawFooterWithBranding(doc, ctx.company?.website);

  doc.save(docFilename("deviz", r.titlu));
}

// ─── FACTURA ──────────────────────────────────────────────────────────────────

export async function generateFactura(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const date = fmtDate(r.date);

  await drawBackground(doc, ctx.company?.background_path);
  await drawLogo(doc, ctx.company?.logo_path, MT);

  let y = drawHeader(doc, "FACTURA FISCALA", ctx.serie, ctx.nr, date);

  // Titlu bon
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  const titluLines: string[] = doc.splitTextToSize(ro(r.titlu), CW);
  doc.text(titluLines, ML, y);
  y += titluLines.length * 4.5 + 3;

  // Furnizor + Cumparator
  const bw = CW / 2 - 5;
  const col2X = ML + bw + 10;
  const y1 = drawCompanyBlock(doc, "Furnizor", ctx.company, ML, y, bw);
  const y2 = drawClientBlock(doc, "Cumparator", r, col2X, y, bw);
  y = Math.max(y1, y2) + 4;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  y = drawItemsTable(doc, autoTable, r, y, tvaPct);
  y = drawTotals(doc, r, y, tvaPct);

  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text(`Modalitate plata: ${ro(r.metodaPlata)}`, ML, y);
    y += 5;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y);
  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y);
  await drawFooterWithBranding(doc, ctx.company?.website);

  doc.save(docFilename("factura", r.titlu));
}

// ─── CHITANTA ────────────────────────────────────────────────────────────────

export async function generateChitanta(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const totalNet = r.total;
  const tvaAmt = totalNet * (tvaPct / 100);
  const totalFinal = totalNet + tvaAmt;
  const date = fmtDate(r.date);

  await drawBackground(doc, ctx.company?.background_path);
  await drawLogo(doc, ctx.company?.logo_path, MT);

  let y = drawHeader(doc, "CHITANTA", ctx.serie, ctx.nr, date);
  y += 4;

  // Am primit de la
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.gray);
  doc.text("Am primit de la", ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text(ro(r.clientNume ?? "-"), ML + 40, y);
  if (r.clientTip === "juridic" && r.clientCui) {
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text(`CUI: ${r.clientCui}`, ML + 40, y);
    y += 5.5;
  } else {
    y += 9;
  }

  hline(doc, y, C.veryLight, 0.2);
  y += 4;

  // Suma
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.gray);
  doc.text("Suma de", ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.black);
  doc.text(lei(totalFinal), ML + 26, y);
  y += 6;

  // TVA breakdown
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text(`(din care: net ${lei(totalNet)}, TVA ${tvaPct}% = ${lei(tvaAmt)})`, ML + 26, y);
  y += 4;

  // In litere
  const inLitere = sumInLitere(totalFinal);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray);
  doc.text(`(${ro(inLitere)})`, ML, y);
  y += 9;

  hline(doc, y, C.veryLight, 0.2);
  y += 4;

  // Reprezentand
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.gray);
  doc.text("Reprezentand", ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  const repLines: string[] = doc.splitTextToSize(ro(r.titlu), CW - 38);
  doc.text(repLines, ML + 36, y);
  y += repLines.length * 5 + 4;

  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray);
    doc.text(`Modalitate: ${ro(r.metodaPlata)}`, ML, y);
    y += 6;
  }

  if (r.facturaNr > 0) {
    const facturaRef = r.facturaSerie
      ? `Factura nr. ${r.facturaSerie}${r.facturaNr}`
      : `Factura nr. ${r.facturaNr}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray);
    doc.text("Achita conform", ML, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.black);
    doc.text(facturaRef, ML + 34, y);
    y += 6;
  }

  y += 8;

  // Casier + date companie
  const colW = CW / 2 - 6;
  const col2X = ML + colW + 12;

  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + colW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text("Casier / Operator", ML, y + 4);

  if (ctx.company) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ro(ctx.company.name), col2X, y - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    let cy = y - 2;
    if (ctx.company.cui) { doc.text(`CUI: ${ctx.company.cui}`, col2X, cy); cy += 3.5; }
    if (ctx.company.address) {
      const al: string[] = doc.splitTextToSize(ro(ctx.company.address), colW);
      doc.text(al, col2X, cy);
    }
  }

  await drawFooterWithBranding(doc, ctx.company?.website);
  doc.save(docFilename("chitanta", r.titlu));
}

// ─── Suma in litere ───────────────────────────────────────────────────────────

function sumInLitere(n: number): string {
  const total = Math.round(n);
  const bani = Math.round((n - Math.floor(n)) * 100);
  const s = numarInLitere(total);
  if (bani > 0) return `${s} lei si ${numarInLitere(bani)} bani`;
  return `${s} lei`;
}

function numarInLitere(n: number): string {
  if (n === 0) return "zero";
  const u = ["", "unu", "doi", "trei", "patru", "cinci", "sase", "sapte", "opt", "noua",
    "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece",
    "saisprezece", "saptesprezece", "optsprezece", "nouasprezece"];
  const z = ["", "", "douazeci", "treizeci", "patruzeci", "cincizeci", "saizeci", "saptezeci", "optzeci", "nouazeci"];

  function sub100(x: number): string {
    if (x < 20) return u[x];
    const zd = Math.floor(x / 10), ud = x % 10;
    return ud === 0 ? z[zd] : `${z[zd]} si ${u[ud]}`;
  }

  function sub1000(x: number): string {
    if (x < 100) return sub100(x);
    const h = Math.floor(x / 100), rest = x % 100;
    const prefix = h === 1 ? "o suta" : h === 2 ? "doua sute" : `${sub100(h)} sute`;
    return rest === 0 ? prefix : `${prefix} ${sub100(rest)}`;
  }

  let result = "";
  if (n >= 1_000_000) { const m = Math.floor(n / 1_000_000); result += `${sub1000(m)} ${m === 1 ? "milion" : "milioane"} `; n %= 1_000_000; }
  if (n >= 1_000)     { const k = Math.floor(n / 1_000);     result += `${sub1000(k)} ${k === 1 ? "mie" : "mii"} `;     n %= 1_000; }
  if (n > 0) result += sub1000(n);
  return result.trim();
}
