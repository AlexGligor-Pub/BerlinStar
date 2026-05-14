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
    bank_name?: string | null;
    iban?: string | null;
    capital_social?: number | null;
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
// jsPDF standard (Helvetica) = Latin-1; diacriticele romanesti nu sunt in Latin-1.
// Folosim NotoSans-Regular.ttf de pe jsDelivr (cu cache localStorage) pentru suport complet.

function ro(s: string | null | undefined): string {
  if (!s) return "";
  // fallback pentru Helvetica: inlocuieste diacriticele care nu sunt in Latin-1
  return s
    .replace(/ă/g, "a").replace(/Ă/g, "A")
    .replace(/[șşȘŞ]/g, (c) => /[A-Z]/.test(c) ? "S" : "s")
    .replace(/[țţȚŢ]/g, (c) => /[A-Z]/.test(c) ? "T" : "t");
}

// ─── Romanian font loader ─────────────────────────────────────────────────────

const _FONT_CACHE_KEY = "bs_ro_font_b64_v2";
const _FONT_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 zile

let _roFontB64: string | null | false = false; // false = neincercat, null = esec

function _bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length))));
  }
  return btoa(chunks.join(""));
}

async function loadRoFontBase64(): Promise<string | null> {
  if (_roFontB64 !== false) return _roFontB64;

  // 1. Incearca cache localStorage
  try {
    const cached = localStorage.getItem(_FONT_CACHE_KEY);
    if (cached) {
      const { ts, b64 } = JSON.parse(cached);
      if (Date.now() - ts < _FONT_CACHE_TTL && typeof b64 === "string" && b64.length > 5_000) {
        _roFontB64 = b64;
        return b64;
      }
    }
  } catch {}

  // 2. Font local (subset NotoSans cu diacritice romanesti, generat din Google Fonts)
  try {
    const resp = await fetch("/fonts/NotoSans-Ro.ttf");
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > 5_000) {
        const b64 = _bufToB64(buf);
        _roFontB64 = b64;
        try { localStorage.setItem(_FONT_CACHE_KEY, JSON.stringify({ ts: Date.now(), b64 })); } catch {}
        return b64;
      }
    }
  } catch {}

  _roFontB64 = null;
  return null;
}

function registerRoFont(doc: any, base64: string): void {
  doc.addFileToVFS("NotoSans-Ro.ttf", base64);
  doc.addFont("NotoSans-Ro.ttf", "NotoSans", "normal");
  doc.addFont("NotoSans-Ro.ttf", "NotoSans", "bold");
}

// t() — text helper: lasa textul neschimbat daca avem font roman, altfel ro()
function makeT(hasFont: boolean) {
  return (s: string | null | undefined): string => hasFont ? (s ?? "") : ro(s);
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
function drawHeader(doc: any, title: string, serie: string, nr: number, date: string, font = "helvetica"): number {
  let y = MT;

  // Titlu document
  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.black);
  doc.text(title, ML, y);

  // Serie + Nr + Data — stanga, sub titlu
  doc.setFont(font, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.black);
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
  doc.setTextColor(...C.black);
  doc.text(ro(label).toUpperCase(), x, y);
  y += 3.5;

  if (!company) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
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
  doc.setTextColor(...C.black);
  if (company.cui) { doc.text(`CUI: ${company.cui}`, x, y); y += 3.5; }
  if (company.nr_reg_com) { doc.text(`Reg.Com.: ${ro(company.nr_reg_com)}`, x, y); y += 3.5; }
  if (company.address) {
    const al: string[] = doc.splitTextToSize(ro(company.address), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (company.phone) { doc.text(`Tel: ${ro(company.phone)}`, x, y); y += 3.5; }
  if (company.bank_name) { doc.text(`Banca: ${ro(company.bank_name)}`, x, y); y += 3.5; }
  if (company.iban) { doc.text(`IBAN: ${company.iban}`, x, y); y += 3.5; }
  if (company.capital_social != null) { doc.text(`Capital social: ${company.capital_social.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`, x, y); y += 3.5; }
  return y;
}

/** Bloc client */
function drawClientBlock(
  doc: any, label: string, r: Receipt,
  x: number, y: number, bw: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.black);
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
  doc.setTextColor(...C.black);
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
function drawItemsTable(doc: any, autoTable: any, r: Receipt, y: number, tvaPct: number, showTehnician = false): number {
  const rows = r.items.map((item, idx) => {
    const total = item.price * item.qty;
    const net = total / (1 + tvaPct / 100);
    const tva = total - net;
    const row = [
      String(idx + 1),
      ro(item.name),
    ];
    if (showTehnician) {
      const teh = item.employeeName ? ro(item.employeeName).slice(0, 15) : "";
      row.push(teh);
    }
    row.push(
      String(item.qty),
      ro(item.unit),
      item.price.toFixed(2),
      net.toFixed(2),
      tva.toFixed(2),
      total.toFixed(2),
    );
    return row;
  });

  const head = showTehnician
    ? [["#", "Denumire", "Tehnician", "Cant.", "U.M.", "Pret unit.", "Val. net", "Val. TVA", "Total"]]
    : [["#", "Denumire", "Cant.", "U.M.", "Pret unit.", "Val. net", "Val. TVA", "Total"]];

  const columnStyles: Record<number, any> = showTehnician
    ? {
        0: { halign: "center", cellWidth: 8, textColor: [...C.black] },
        1: { cellWidth: "auto" },
        2: { cellWidth: 22 },
        3: { halign: "center", cellWidth: 11 },
        4: { halign: "center", cellWidth: 11 },
        5: { halign: "right", cellWidth: 20 },
        6: { halign: "right", cellWidth: 20 },
        7: { halign: "right", cellWidth: 20 },
        8: { halign: "right", cellWidth: 22, fontStyle: "bold" },
      }
    : {
        0: { halign: "center", cellWidth: 8, textColor: [...C.black] },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 11 },
        3: { halign: "center", cellWidth: 11 },
        4: { halign: "right", cellWidth: 22 },
        5: { halign: "right", cellWidth: 22 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "right", cellWidth: 24, fontStyle: "bold" },
      };

  autoTable(doc, {
    startY: y,
    head,
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
      textColor: [...C.black],
      lineColor: [...C.black],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...C.veryLight],
      textColor: [...C.black],
      fontSize: 7,
      fontStyle: "bold",
      lineColor: [...C.black],
      lineWidth: 0.2,
    },
    alternateRowStyles: {},
    columnStyles,
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
  const totalFinal = r.total;
  const net = totalFinal / (1 + pct / 100);
  const tvaAmt = totalFinal - net;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.black);

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
    doc.setTextColor(...C.black);
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
    doc.setTextColor(...C.black);
    doc.text(ro(disclaimer.title).toUpperCase(), ML, y);
    y += 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.black);
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

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + colW, y);
  doc.line(col2X, y, col2X + colW, y);

  doc.setFontSize(7.5);
  doc.setTextColor(...C.black);
  doc.text(leftLabel, ML, y + 4);
  doc.text(rightLabel, col2X, y + 4);

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

/** Incarca o imagine via fetch (bypass-eaza taint-ul de canvas) si o intoarce ca dataURL + dimensiuni naturale. */
async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/** Deseneaza o imagine intr-o caseta (boxW x boxH), pastrand aspect-ratio si centrand. */
async function drawSideImage(
  doc: any,
  url: string | null | undefined,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): Promise<void> {
  if (!url || boxH <= 0 || boxW <= 0) return;
  const loaded = await fetchImageAsDataUrl(url);
  if (!loaded) return;
  try {
    const ratio = loaded.w / loaded.h;
    let w = boxW;
    let h = w / ratio;
    if (h > boxH) { h = boxH; w = h * ratio; }
    const x = boxX + (boxW - w) / 2;
    const y = boxY + (boxH - h) / 2;
    // Determina format-ul din mime type (JPEG vs PNG). jsPDF accepta dataURL direct.
    const fmt = loaded.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(loaded.dataUrl, fmt, x, y, w, h, undefined, "FAST");
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
    doc.setTextColor(...C.black);
    doc.text(`Generat: ${now}`, ML, h - 5.5);
    doc.text(`Pagina ${i} / ${n}`, PAGE_W - MR, h - 5.5, { align: "right" });

    if (website) {
      doc.setFontSize(6.5);
      doc.setTextColor(...C.black);
      doc.text(website, PAGE_W / 2, h - 5.5, { align: "center" });
    }

    if (qr && i === 1) {
      const qrSize = 12;
      doc.addImage(qr, "PNG", PAGE_W / 2 - qrSize / 2, h - 10 - qrSize - 1, qrSize, qrSize, undefined, "FAST");
    }
  }
}

// ─── DEVIZ ────────────────────────────────────────────────────────────────────

export async function generateDeviz(r: Receipt, ctx: DocContext, showTehnician = false, append?: AppendOptions): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  if (append && !append.isFirst) doc.addPage();
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
  let y2 = drawClientBlock(doc, "Client", r, col2X, y, bw);

  // Vehicol sub datele clientului
  const veh = r.vehicol;
  if (veh) {
    y2 += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.black);
    doc.text("VEHICUL", col2X, y2);
    y2 += 3.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(ro(veh.numarMasina), col2X, y2);
    y2 += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (veh.marca || veh.model) {
      doc.text([ro(veh.marca), ro(veh.model)].filter(Boolean).join(" "), col2X, y2);
      y2 += 3.5;
    }
    const kmVin: string[] = [];
    if (veh.numarKilometrii != null) kmVin.push(`Km: ${veh.numarKilometrii.toLocaleString("ro-RO")}`);
    if (veh.vin) kmVin.push(`VIN: ${veh.vin}`);
    if (kmVin.length) { doc.text(kmVin.join("  ·  "), col2X, y2); y2 += 3.5; }
    if (veh.observatii?.trim()) {
      const ol: string[] = doc.splitTextToSize(ro(veh.observatii.trim()), bw);
      doc.text(ol, col2X, y2);
      y2 += ol.length * 3.5;
    }
  }

  y = Math.max(y1, y2) + 4;

  hline(doc, y, C.lightGray, 0.2);
  y += 4;

  y = drawItemsTable(doc, autoTable, r, y, tvaPct, showTehnician);
  y = drawTotals(doc, r, y, tvaPct);

  if (r.descriere?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.black);
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
    doc.setTextColor(...C.black);
    doc.text("OBSERVATII", ML, y);
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
    const totalFinal2 = r.total;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(`Rest de plata: ${lei(totalFinal2 - r.partialPay)}`, ML, y + 5);
    y += 12;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y);
  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y);
  await drawFooterWithBranding(doc, ctx.company?.website);

  if (!append) doc.save(docFilename("deviz", r.titlu));
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
    doc.setTextColor(...C.black);
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
  const totalFinal = r.total;
  const totalNet = totalFinal / (1 + tvaPct / 100);
  const tvaAmt = totalFinal - totalNet;
  const date = fmtDate(r.date);

  await drawBackground(doc, ctx.company?.background_path);
  await drawLogo(doc, ctx.company?.logo_path, MT);

  let y = drawHeader(doc, "CHITANTA", ctx.serie, ctx.nr, date);
  y += 4;

  // Am primit de la
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  doc.text("Am primit de la", ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.black);
  doc.text(ro(r.clientNume ?? "-"), ML + 40, y);
  if (r.clientTip === "juridic" && r.clientCui) {
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
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
  doc.setTextColor(...C.black);
  doc.text("Suma de", ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.black);
  doc.text(lei(totalFinal), ML + 26, y);
  y += 6;

  // TVA breakdown
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.black);
  doc.text(`(din care: net ${lei(totalNet)}, TVA ${tvaPct}% = ${lei(tvaAmt)})`, ML + 26, y);
  y += 4;

  // In litere
  const inLitere = sumInLitere(totalFinal);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.black);
  doc.text(`(${ro(inLitere)})`, ML, y);
  y += 9;

  hline(doc, y, C.veryLight, 0.2);
  y += 4;

  // Reprezentand
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
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
    doc.setTextColor(...C.black);
    doc.text(`Modalitate: ${ro(r.metodaPlata)}`, ML, y);
    y += 6;
  }

  if (r.facturaNr > 0) {
    const facturaRef = r.facturaSerie
      ? `Factura nr. ${r.facturaSerie}${r.facturaNr}`
      : `Factura nr. ${r.facturaNr}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
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

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + colW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.black);
  doc.text("Casier / Operator", ML, y + 4);

  if (ctx.company) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(ro(ctx.company.name), col2X, y - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.black);
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

// ─── Hotel Anvelope ───────────────────────────────────────────────────────────

export interface CompanyData {
  name: string;
  cui: string | number;
  address?: string | null;
  nr_reg_com?: string | null;
  phone?: string | null;
  tva_percentage?: number | null;
  logo_path?: string | null;
  background_path?: string | null;
  website?: string | null;
  bank_name?: string | null;
  iban?: string | null;
  capital_social?: number | null;
}

interface CazareForPdf {
  id: number;
  dataCheckin: string;
  dataCheckout?: string | null;
  clientNume: string | null;
  clientCui: string | null;
  clientTelefon: string | null;
  clientAdresa: string | null;
  clientReprezentant: string | null;
  employeeName: string | null;
  locCazareNume: string | null;
  locationName?: string | null;
  numarMasina?: string | null;
  comments: string | null;
  depAnvelope?: boolean;
  depCapace?: boolean;
  depRotiComplete?: boolean;
  depAntifurturi?: boolean;
  depPrezoane?: boolean;
  referintaCazareId?: number | null;
  montatePeMasina?: boolean;
  referintaCazareDataCheckin?: string | null;
  referintaCazareItems?: Array<{
    anvelopa: {
      marcaNume: string | null;
      dimensiuneValoare: string | null;
      profilValoare?: string | null;
      tip: string;
      adancime: number | null;
    } | null;
  }>;
  items: Array<{
    anvelopa: {
      marcaNume: string | null;
      dimensiuneValoare: string | null;
      profilValoare?: string | null;
      tip: string;
      adancime: number | null;
    } | null;
  }>;
}

const TIP_PDF_LABELS: Record<string, string> = {
  iarna: "Iarna",
  vara: "Vara",
  ms: "M+S",
  altele: "Altele",
};

export interface VehiculForPdf {
  numarMasina: string | null;
  marca?: string | null;
  model?: string | null;
  numarKilometrii?: number | null;
  vin?: string | null;
  observatii?: string | null;
}

const CARD_PAD = 3.5;
const CARD_BORDER: [number, number, number] = [180, 180, 180];
const CARDS_GAP_X = 8;
const CARDS_GAP_Y = 3;

function drawCard(doc: any, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "S");
}

function _measureCompanyContent(doc: any, company: any, bw: number, font: string): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  let h = 3.5; // label
  if (!company) return h + 4;

  doc.setFontSize(9);
  const nameLines: string[] = doc.splitTextToSize(ro(company.name), bw);
  h += nameLines.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  if (company.cui) h += 3.5;
  if (company.nr_reg_com) h += 3.5;
  if (company.address) {
    const al: string[] = doc.splitTextToSize(ro(company.address), bw);
    h += al.length * 3.5;
  }
  if (company.phone) h += 3.5;
  if (company.bank_name) h += 3.5;
  if (company.iban) h += 3.5;
  if (company.capital_social != null) h += 3.5;
  return h;
}

export interface ClientInfoForPdf {
  clientNume: string | null;
  clientCui: string | null;
  clientReprezentant: string | null;
  clientAdresa: string | null;
  clientTelefon: string | null;
}

function _measureClientContent(doc: any, ci: ClientInfoForPdf, bw: number, t: (s: string | null | undefined) => string, font: string): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  let h = 3.5; // label

  doc.setFontSize(9);
  const nameLines: string[] = doc.splitTextToSize(t(ci.clientNume ?? "-"), bw);
  h += nameLines.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  if (ci.clientCui)          h += 3.5;
  if (ci.clientReprezentant) h += 3.5;
  if (ci.clientAdresa) {
    const al: string[] = doc.splitTextToSize(t(ci.clientAdresa), bw);
    h += al.length * 3.5;
  }
  if (ci.clientTelefon) h += 3.5;
  return h;
}

function _measureVehiculContent(doc: any, veh: VehiculForPdf, bw: number, t: (s: string | null | undefined) => string, font: string): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  let h = 3.5; // label

  doc.setFontSize(9);
  const plate: string[] = doc.splitTextToSize(t(veh.numarMasina ?? "-"), bw);
  h += plate.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  const mm = [veh.marca, veh.model].filter(Boolean).join(" ");
  if (mm)                        h += 3.5;
  if (veh.numarKilometrii != null) h += 3.5;
  if (veh.vin)                   h += 3.5;
  if (veh.observatii) {
    const ol: string[] = doc.splitTextToSize(t(veh.observatii), bw);
    h += ol.length * 3.5;
  }
  return h;
}

function drawCompanyBlockFont(
  doc: any, label: string, company: any,
  x: number, y: number, bw: number, font: string,
): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.black);
  doc.text(ro(label).toUpperCase(), x, y);
  y += 3.5;

  if (!company) {
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.text("-", x, y);
    return y + 4;
  }

  doc.setFontSize(9);
  const nameLines: string[] = doc.splitTextToSize(ro(company.name), bw);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  if (company.cui)         { doc.text(`CUI: ${company.cui}`, x, y); y += 3.5; }
  if (company.nr_reg_com)  { doc.text(`Reg.Com.: ${ro(company.nr_reg_com)}`, x, y); y += 3.5; }
  if (company.address) {
    const al: string[] = doc.splitTextToSize(ro(company.address), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (company.phone)       { doc.text(`Tel: ${ro(company.phone)}`, x, y); y += 3.5; }
  if (company.bank_name)   { doc.text(`Banca: ${ro(company.bank_name)}`, x, y); y += 3.5; }
  if (company.iban)        { doc.text(`IBAN: ${company.iban}`, x, y); y += 3.5; }
  if (company.capital_social != null) {
    doc.text(`Capital social: ${company.capital_social.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`, x, y);
    y += 3.5;
  }
  return y;
}

function drawVehiculBlock(
  doc: any, veh: VehiculForPdf,
  x: number, y: number, bw: number, t: (s: string | null | undefined) => string, font: string,
): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.black);
  doc.text("VEHICUL", x, y);
  y += 3.5;

  doc.setFontSize(9);
  const plate: string[] = doc.splitTextToSize(t(veh.numarMasina ?? "-"), bw);
  doc.text(plate, x, y);
  y += plate.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  const mm = [veh.marca, veh.model].filter(Boolean).join(" ");
  if (mm)                          { doc.text(t(mm), x, y); y += 3.5; }
  if (veh.numarKilometrii != null) { doc.text(`Km: ${veh.numarKilometrii.toLocaleString("ro-RO")}`, x, y); y += 3.5; }
  if (veh.vin)                     { doc.text(`VIN: ${veh.vin}`, x, y); y += 3.5; }
  if (veh.observatii) {
    const ol: string[] = doc.splitTextToSize(t(veh.observatii), bw);
    doc.text(ol, x, y);
    y += ol.length * 3.5;
  }
  return y;
}

function drawCazareClientBlock(doc: any, ci: ClientInfoForPdf, x: number, y: number, bw: number, t: (s: string | null | undefined) => string, font = "helvetica"): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.black);
  doc.text("CLIENT", x, y);
  y += 3.5;

  doc.setFontSize(9);
  const nameLines: string[] = doc.splitTextToSize(t(ci.clientNume ?? "-"), bw);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.2;

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  if (ci.clientCui)          { doc.text(`CUI: ${ci.clientCui}`, x, y); y += 3.5; }
  if (ci.clientReprezentant) { doc.text(`Repr.: ${t(ci.clientReprezentant)}`, x, y); y += 3.5; }
  if (ci.clientAdresa) {
    const al: string[] = doc.splitTextToSize(t(ci.clientAdresa), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (ci.clientTelefon) { doc.text(`Tel: ${ci.clientTelefon}`, x, y); y += 3.5; }
  return y;
}

/** Top section: Prestator card (left col) + Client + optional Vehicle cards (right col). */
function drawCazareTopCards(
  doc: any,
  company: any,
  client: ClientInfoForPdf,
  vehicle: VehiculForPdf | null,
  leftX: number,
  rightX: number,
  y: number,
  bw: number,
  t: (s: string | null | undefined) => string,
  font: string,
): number {
  const innerW = bw - CARD_PAD * 2;
  const compH    = _measureCompanyContent(doc, company, innerW, font);
  const clientH  = _measureClientContent(doc, client, innerW, t, font);
  const vehH     = vehicle ? _measureVehiculContent(doc, vehicle, innerW, t, font) : 0;

  const compCardH   = compH + CARD_PAD * 2;
  const clientCardH = clientH + CARD_PAD * 2;
  const vehCardH    = vehicle ? vehH + CARD_PAD * 2 : 0;
  const rightStackH = clientCardH + (vehicle ? CARDS_GAP_Y + vehCardH : 0);
  const blockH = Math.max(compCardH, rightStackH);

  drawCard(doc, leftX, y, bw, compCardH);
  drawCompanyBlockFont(doc, "Prestator", company, leftX + CARD_PAD, y + CARD_PAD, innerW, font);

  drawCard(doc, rightX, y, bw, clientCardH);
  drawCazareClientBlock(doc, client, rightX + CARD_PAD, y + CARD_PAD, innerW, t, font);

  if (vehicle) {
    const vY = y + clientCardH + CARDS_GAP_Y;
    drawCard(doc, rightX, vY, bw, vehCardH);
    drawVehiculBlock(doc, vehicle, rightX + CARD_PAD, vY + CARD_PAD, innerW, t, font);
  }

  return y + blockH;
}

/** Cazare — Hotel Anvelope */
export async function generateCazareCheckin(
  cazare: CazareForPdf,
  company: CompanyData | null,
  images: { cazare: string | null; scoatere: string | null; montare: string | null } | null = null,
  vehicle: VehiculForPdf | null = null,
  append?: AppendOptions,
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (append && !append.isFirst) doc.addPage();

  const fontB64 = await loadRoFontBase64();
  if (fontB64) registerRoFont(doc, fontB64);
  const FONT = fontB64 ? "NotoSans" : "helvetica";
  const t = makeT(!!fontB64);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);
  await drawLogo(doc, company?.logo_path, MT);

  let y = drawHeader(doc, "Hotel Anvelope - Cazare", "", cazare.id, fmtDate(cazare.dataCheckin), FONT);
  y += 2;
  hline(doc, y);
  y += 6;

  // Prestator (left) + Client + Vehicul (right, stacked) — fiecare in propriul card
  const bw = (CW - CARDS_GAP_X) / 2;
  const leftX = ML;
  const rightX = ML + bw + CARDS_GAP_X;

  y = drawCazareTopCards(doc, company ?? null, cazare, vehicle, leftX, rightX, y, bw, t, FONT) + 4;

  hline(doc, y);
  y += 6;

  // ─── Section: CAZARE (marine green) ────────────────────────────────────────
  const marineGreen: [number, number, number] = [5, 150, 105];

  setF("bold", 10);
  doc.setTextColor(...marineGreen);
  doc.text("CAZARE", ML, y);
  y += 5;

  // Detalii cazare (2 coloane: locatie/angajat | data)
  const colW = (CW - 8) / 2;
  const col1X = ML;
  const col2X = ML + colW + 8;

  setF("normal", 8.5);
  doc.setTextColor(...C.black);
  let yL = y;
  let yR = y;
  if (cazare.locationName)  { doc.text(`Locație: ${t(cazare.locationName)}`, col1X, yL);  yL += 4.5; }
  if (cazare.locCazareNume) { doc.text(`Loc depozitare: ${t(cazare.locCazareNume)}`, col1X, yL); yL += 4.5; }
  if (cazare.employeeName)  { doc.text(`Angajat: ${t(cazare.employeeName)}`, col1X, yL);  yL += 4.5; }
  doc.text(`Data cazare: ${fmtDate(cazare.dataCheckin)}`, col2X, yR); yR += 4.5;
  y = Math.max(yL, yR) + 1;

  // Depozitate
  const depItemsIn: string[] = [];
  if (cazare.depAnvelope)     depItemsIn.push("Anvelope");
  if (cazare.depCapace)       depItemsIn.push("Capace");
  if (cazare.depRotiComplete) depItemsIn.push("Roți complete");
  if (cazare.depAntifurturi)  depItemsIn.push("Antifurturi");
  if (cazare.depPrezoane)     depItemsIn.push("Prezoane");
  if (depItemsIn.length > 0) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    doc.text(`Depozitate: ${depItemsIn.join(", ")}`, ML, y);
    y += 5;
  }

  // Observații
  if (cazare.comments) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    const cl: string[] = doc.splitTextToSize(`Observații: ${t(cazare.comments)}`, CW);
    doc.text(cl, ML, y);
    y += cl.length * 4 + 1;
  }

  // Tabel anvelope cu imagine in dreapta (Cazare Roti)
  const SIDE_IMG_W = 55;
  const SIDE_GAP = 5;
  const tableW = CW - SIDE_IMG_W - SIDE_GAP;

  const tireRows = cazare.items
    .filter((item) => item.anvelopa != null)
    .map((item, idx) => {
      const a = item.anvelopa!;
      return [
        String(idx + 1),
        t(a.marcaNume ?? "—"),
        t(a.dimensiuneValoare ?? "—"),
        t(a.profilValoare ?? "—"),
        TIP_PDF_LABELS[a.tip] ?? a.tip,
        a.adancime != null ? `${a.adancime} mm` : "—",
      ];
    });

  if (tireRows.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: [["#", "Marcă", "Dimensiune", "Profil", "Tip", "Adâncime"]],
      body: tireRows,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: marineGreen, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 18 },
      },
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = (doc as any).lastAutoTable.finalY;
    const tableH = tableEndY - tableStartY;

    await drawSideImage(doc, images?.cazare ?? null, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  if (cazare.referintaCazareId) {
    const isMontate = !!cazare.montatePeMasina;
    const refColor: [number, number, number] = isMontate ? [22, 163, 74] : [220, 38, 38];
    const refDate = cazare.referintaCazareDataCheckin ? ` (intrare: ${fmtDate(cazare.referintaCazareDataCheckin)})` : "";

    hline(doc, y);
    y += 5;

    setF("bold", 8);
    doc.setTextColor(...C.black);
    doc.text("ANVELOPE SCOASE DIN DEPOZIT — CAZAREA ANTERIOARĂ", ML, y);
    y += 5;

    setF("normal", 8.5);
    doc.setTextColor(...refColor);
    const descText = isMontate
      ? `Anvelopele din cazarea anterioară #${cazare.referintaCazareId}${refDate} au fost scoase din depozit și MONTATE PE MAȘINA CLIENTULUI. ` +
        `Acestea au înlocuit anvelopele de sezon care sunt depozitate acum. Clientul a plecat cu anvelopele montate pe vehicul.`
      : `Anvelopele din cazarea anterioară #${cazare.referintaCazareId}${refDate} au fost scoase din depozit și PREDATE CLIENTULUI fără a fi montate. ` +
        `Clientul a ridicat anvelopele și le va monta separat. Anvelopele depozitate acum reprezintă un set diferit.`;
    const descLines: string[] = doc.splitTextToSize(descText, CW);
    doc.text(descLines, ML, y);
    y += descLines.length * 4.2 + 4;
    doc.setTextColor(...C.black);

    const oldItems = (cazare.referintaCazareItems ?? []).filter((i) => i.anvelopa != null);
    if (oldItems.length > 0) {
      const oldRows = oldItems.map((item, idx) => {
        const a = item.anvelopa!;
        return [
          String(idx + 1),
          t(a.marcaNume ?? "—"),
          t(a.dimensiuneValoare ?? "—"),
          t(a.profilValoare ?? "—"),
          TIP_PDF_LABELS[a.tip] ?? a.tip,
          a.adancime != null ? `${a.adancime} mm` : "—",
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [["#", "Marcă", "Dimensiune", "Profil", "Tip", "Adâncime"]],
        body: oldRows,
        theme: "grid",
        styles: { font: FONT },
        headStyles: { fillColor: refColor, textColor: 255, fontSize: 7, fontStyle: "bold", cellPadding: 2 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 3: { halign: "center", cellWidth: 16 }, 4: { halign: "center", cellWidth: 16 }, 5: { halign: "center", cellWidth: 20 } },
        margin: { left: ML, right: MR },
        tableWidth: CW,
      });
      y = (doc as any).lastAutoTable.finalY + 3;
    }
    y += 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website);

  const clientSlug = (cazare.clientNume ?? "client").replace(/\s+/g, "_").slice(0, 30);
  if (!append) doc.save(docFilename("cazare", clientSlug));
}

/** Bon Scoatere și Introducere Nouă — Hotel Anvelope */
export async function generateCazareScoatereIntroducere(
  checkoutCazare: CazareForPdf,
  newCazare: CazareForPdf,
  company: CompanyData | null,
  checkoutDate: string,
  montatePeMasina: boolean,
  images: { cazare: string | null; scoatere: string | null; montare: string | null } | null = null,
  vehicle: VehiculForPdf | null = null,
  append?: AppendOptions,
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (append && !append.isFirst) doc.addPage();

  const fontB64 = await loadRoFontBase64();
  if (fontB64) registerRoFont(doc, fontB64);
  const FONT = fontB64 ? "NotoSans" : "helvetica";
  const t = makeT(!!fontB64);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);
  await drawLogo(doc, company?.logo_path, MT);

  let y = drawHeader(doc, "Hotel Anvelope - Scoatere și cazare nouă", "", checkoutCazare.id, fmtDate(checkoutDate), FONT);
  y += 2;
  hline(doc, y);
  y += 6;

  // Prestator (left) + Client + Vehicul (right, stacked) — fiecare in propriul card
  const bw = (CW - CARDS_GAP_X) / 2;
  const leftX = ML;
  const rightX = ML + bw + CARDS_GAP_X;

  y = drawCazareTopCards(doc, company ?? null, checkoutCazare, vehicle, leftX, rightX, y, bw, t, FONT) + 4;

  hline(doc, y);
  y += 6;

  // ─── Section 1: SCOATERE DIN CAZARE (dark navy blue) ───────────────────────
  const navyBlue: [number, number, number] = [30, 58, 138];

  setF("bold", 10);
  doc.setTextColor(...navyBlue);
  doc.text("SCOATERE DIN CAZARE", ML, y);
  y += 5;

  // Detalii cazare — checkout (2 coloane: locație/angajat | date)
  const colW = (CW - 8) / 2;
  const col1X = ML;
  const col2X = ML + colW + 8;

  setF("normal", 8.5);
  doc.setTextColor(...C.black);
  let yL = y;
  let yR = y;
  if (checkoutCazare.locationName)  { doc.text(`Locație: ${t(checkoutCazare.locationName)}`, col1X, yL);  yL += 4.5; }
  if (checkoutCazare.locCazareNume) { doc.text(`Loc depozitare: ${t(checkoutCazare.locCazareNume)}`, col1X, yL); yL += 4.5; }
  if (checkoutCazare.employeeName)  { doc.text(`Angajat: ${t(checkoutCazare.employeeName)}`, col1X, yL);  yL += 4.5; }
  doc.text(`Data intrare: ${fmtDate(checkoutCazare.dataCheckin)}`, col2X, yR); yR += 4.5;
  doc.text(`Data ieșire: ${fmtDate(checkoutDate)}`, col2X, yR); yR += 4.5;
  const zile = Math.round(
    (new Date(checkoutDate).getTime() - new Date(checkoutCazare.dataCheckin).getTime()) / 86_400_000
  );
  setF("bold", 9);
  doc.text(`Durată depozitare: ${zile} zile`, col2X, yR);
  yR += 5;
  y = Math.max(yL, yR) + 1;

  // Dep items for checkout cazare
  const depItemsOut: string[] = [];
  if (checkoutCazare.depAnvelope)     depItemsOut.push("Anvelope");
  if (checkoutCazare.depCapace)       depItemsOut.push("Capace");
  if (checkoutCazare.depRotiComplete) depItemsOut.push("Roți complete");
  if (checkoutCazare.depAntifurturi)  depItemsOut.push("Antifurturi");
  if (checkoutCazare.depPrezoane)     depItemsOut.push("Prezoane");
  if (depItemsOut.length > 0) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    doc.text(`Ridicate: ${depItemsOut.join(", ")}`, ML, y);
    y += 5;
  }

  // Observatii — checkout cazare
  if (checkoutCazare.comments) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    const cl: string[] = doc.splitTextToSize(`Observații: ${t(checkoutCazare.comments)}`, CW);
    doc.text(cl, ML, y);
    y += cl.length * 4 + 1;
  }

  // Note about montate pe masina
  setF("normal", 8);
  const noteColor: [number, number, number] = montatePeMasina ? [22, 163, 74] : [220, 38, 38];
  doc.setTextColor(...noteColor);
  const noteText = montatePeMasina
    ? "Anvelopele scoase din depozit au fost MONTATE PE MAȘINA CLIENTULUI."
    : "Anvelopele scoase din depozit au fost PREDATE CLIENTULUI fără a fi montate.";
  const noteLines: string[] = doc.splitTextToSize(noteText, CW);
  doc.text(noteLines, ML, y);
  y += noteLines.length * 4 + 3;
  doc.setTextColor(...C.black);

  // Tire table — checkout cazare (with side image)
  const SIDE_IMG_W = 55;
  const SIDE_GAP = 5;
  const tableW = CW - SIDE_IMG_W - SIDE_GAP;

  const checkoutRows = checkoutCazare.items
    .filter((item) => item.anvelopa != null)
    .map((item, idx) => {
      const a = item.anvelopa!;
      return [
        String(idx + 1),
        t(a.marcaNume ?? "—"),
        t(a.dimensiuneValoare ?? "—"),
        t(a.profilValoare ?? "—"),
        TIP_PDF_LABELS[a.tip] ?? a.tip,
        a.adancime != null ? `${a.adancime} mm` : "—",
      ];
    });

  if (checkoutRows.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: [["#", "Marcă", "Dimensiune", "Profil", "Tip", "Adâncime"]],
      body: checkoutRows,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: navyBlue, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 18 },
      },
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = (doc as any).lastAutoTable.finalY;
    const tableH = tableEndY - tableStartY;

    // Side image: montare if mounted on car, otherwise scoatere (fallback to the other if missing)
    const sideUrl = montatePeMasina
      ? (images?.montare ?? images?.scoatere)
      : (images?.scoatere ?? images?.montare);
    await drawSideImage(doc, sideUrl, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  hline(doc, y);
  y += 6;

  // ─── Section 2: CAZARE NOUĂ (marine green) ─────────────────────────────────
  const marineGreen: [number, number, number] = [5, 150, 105];

  setF("bold", 10);
  doc.setTextColor(...marineGreen);
  doc.text("CAZARE NOUĂ", ML, y);
  y += 5;

  // Detalii — new cazare (2 coloane: locație/angajat | date)
  setF("normal", 8.5);
  doc.setTextColor(...C.black);
  let yL2 = y;
  let yR2 = y;
  if (newCazare.locationName)  { doc.text(`Locație: ${t(newCazare.locationName)}`, col1X, yL2);  yL2 += 4.5; }
  if (newCazare.locCazareNume) { doc.text(`Loc depozitare: ${t(newCazare.locCazareNume)}`, col1X, yL2); yL2 += 4.5; }
  if (newCazare.employeeName)  { doc.text(`Angajat: ${t(newCazare.employeeName)}`, col1X, yL2);  yL2 += 4.5; }
  doc.text(`Data cazare: ${fmtDate(newCazare.dataCheckin)}`, col2X, yR2); yR2 += 4.5;
  y = Math.max(yL2, yR2) + 1;

  // Dep items for new cazare
  const depItemsIn: string[] = [];
  if (newCazare.depAnvelope)     depItemsIn.push("Anvelope");
  if (newCazare.depCapace)       depItemsIn.push("Capace");
  if (newCazare.depRotiComplete) depItemsIn.push("Roți complete");
  if (newCazare.depAntifurturi)  depItemsIn.push("Antifurturi");
  if (newCazare.depPrezoane)     depItemsIn.push("Prezoane");
  if (depItemsIn.length > 0) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    doc.text(`Depozitate: ${depItemsIn.join(", ")}`, ML, y);
    y += 5;
  }

  // Observatii — new cazare
  if (newCazare.comments) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    const cl: string[] = doc.splitTextToSize(`Observații: ${t(newCazare.comments)}`, CW);
    doc.text(cl, ML, y);
    y += cl.length * 4 + 1;
  }

  // Tire table — new cazare (with side image: cazare roti)
  const newRows = newCazare.items
    .filter((item) => item.anvelopa != null)
    .map((item, idx) => {
      const a = item.anvelopa!;
      return [
        String(idx + 1),
        t(a.marcaNume ?? "—"),
        t(a.dimensiuneValoare ?? "—"),
        t(a.profilValoare ?? "—"),
        TIP_PDF_LABELS[a.tip] ?? a.tip,
        a.adancime != null ? `${a.adancime} mm` : "—",
      ];
    });

  if (newRows.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: [["#", "Marcă", "Dimensiune", "Profil", "Tip", "Adâncime"]],
      body: newRows,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: marineGreen, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 18 },
      },
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = (doc as any).lastAutoTable.finalY;
    const tableH = tableEndY - tableStartY;

    await drawSideImage(doc, images?.cazare ?? null, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website);

  if (!append) doc.save(docFilename("scoatere_introducere", checkoutCazare.clientNume ?? "client"));
}

/** Scoatere din cazare — Hotel Anvelope */
export async function generateCazareCheckout(
  cazare: CazareForPdf,
  company: CompanyData | null,
  images: { cazare: string | null; scoatere: string | null; montare: string | null } | null = null,
  vehicle: VehiculForPdf | null = null,
  append?: AppendOptions,
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (append && !append.isFirst) doc.addPage();

  const fontB64 = await loadRoFontBase64();
  if (fontB64) registerRoFont(doc, fontB64);
  const FONT = fontB64 ? "NotoSans" : "helvetica";
  const t = makeT(!!fontB64);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);
  await drawLogo(doc, company?.logo_path, MT);

  const checkoutDate = cazare.dataCheckout ?? new Date().toISOString().slice(0, 10);
  let y = drawHeader(doc, "Hotel Anvelope - Scoatere din cazare", "", cazare.id, fmtDate(checkoutDate), FONT);
  y += 2;
  hline(doc, y);
  y += 6;

  // Prestator (left) + Client + Vehicul (right, stacked) — fiecare in propriul card
  const bw = (CW - CARDS_GAP_X) / 2;
  const leftX = ML;
  const rightX = ML + bw + CARDS_GAP_X;

  y = drawCazareTopCards(doc, company ?? null, cazare, vehicle, leftX, rightX, y, bw, t, FONT) + 4;

  hline(doc, y);
  y += 6;

  // ─── Section: SCOATERE DIN CAZARE (navy blue) ─────────────────────────────
  const navyBlue: [number, number, number] = [30, 58, 138];

  setF("bold", 10);
  doc.setTextColor(...navyBlue);
  doc.text("SCOATERE DIN CAZARE", ML, y);
  y += 5;

  // Detalii cazare (2 coloane: locatie/angajat | date)
  const colW = (CW - 8) / 2;
  const col1X = ML;
  const col2X = ML + colW + 8;

  setF("normal", 8.5);
  doc.setTextColor(...C.black);
  let yL = y;
  let yR = y;
  if (cazare.locationName)  { doc.text(`Locație: ${t(cazare.locationName)}`, col1X, yL);  yL += 4.5; }
  if (cazare.locCazareNume) { doc.text(`Loc depozitare: ${t(cazare.locCazareNume)}`, col1X, yL); yL += 4.5; }
  if (cazare.employeeName)  { doc.text(`Angajat: ${t(cazare.employeeName)}`, col1X, yL);  yL += 4.5; }
  doc.text(`Data intrare: ${fmtDate(cazare.dataCheckin)}`, col2X, yR); yR += 4.5;
  doc.text(`Data ieșire: ${fmtDate(checkoutDate)}`, col2X, yR); yR += 4.5;
  const zile = Math.round(
    (new Date(checkoutDate).getTime() - new Date(cazare.dataCheckin).getTime()) / 86_400_000
  );
  setF("bold", 9);
  doc.text(`Durată depozitare: ${zile} zile`, col2X, yR);
  yR += 5;
  y = Math.max(yL, yR) + 1;

  // Ridicate
  const depItemsOut: string[] = [];
  if (cazare.depAnvelope)     depItemsOut.push("Anvelope");
  if (cazare.depCapace)       depItemsOut.push("Capace");
  if (cazare.depRotiComplete) depItemsOut.push("Roți complete");
  if (cazare.depAntifurturi)  depItemsOut.push("Antifurturi");
  if (cazare.depPrezoane)     depItemsOut.push("Prezoane");
  if (depItemsOut.length > 0) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    doc.text(`Ridicate: ${depItemsOut.join(", ")}`, ML, y);
    y += 5;
  }

  // Observații
  if (cazare.comments) {
    setF("normal", 8.5);
    doc.setTextColor(...C.black);
    const cl: string[] = doc.splitTextToSize(`Observații: ${t(cazare.comments)}`, CW);
    doc.text(cl, ML, y);
    y += cl.length * 4 + 1;
  }

  // Tabel anvelope cu imagine in dreapta (Scoatere Roti)
  const SIDE_IMG_W = 55;
  const SIDE_GAP = 5;
  const tableW = CW - SIDE_IMG_W - SIDE_GAP;

  const checkoutRows = cazare.items
    .filter((item) => item.anvelopa != null)
    .map((item, idx) => {
      const a = item.anvelopa!;
      return [
        String(idx + 1),
        t(a.marcaNume ?? "—"),
        t(a.dimensiuneValoare ?? "—"),
        t(a.profilValoare ?? "—"),
        TIP_PDF_LABELS[a.tip] ?? a.tip,
        a.adancime != null ? `${a.adancime} mm` : "—",
      ];
    });

  if (checkoutRows.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: [["#", "Marcă", "Dimensiune", "Profil", "Tip", "Adâncime"]],
      body: checkoutRows,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: navyBlue, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 18 },
      },
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = (doc as any).lastAutoTable.finalY;
    const tableH = tableEndY - tableStartY;

    const sideUrl = images?.scoatere ?? images?.montare ?? null;
    await drawSideImage(doc, sideUrl, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website);

  const clientSlug = (cazare.clientNume ?? "client").replace(/\s+/g, "_").slice(0, 30);
  if (!append) doc.save(docFilename("scoatere_cazare", clientSlug));
}

// ─── Montaj Roti ──────────────────────────────────────────────────────────────

/** Mod "merge": cand e furnizat, generatorul scrie in `doc` deja existent in loc sa creeze unul nou.
 *  `isFirst`: true daca e prima sectiune (nu adauga pagina noua); false pentru sectiunile urmatoare. */
export type AppendOptions = { doc: any; isFirst: boolean };

export interface MontajRotaRow {
  pozitie: string;
  presiune: number | null;
  marcaNume: string | null;
  dimensiuneValoare: string | null;
  profilValoare: string | null;
  tip: string;
  adancime: number | null;
  cupluStrangere: number | null;
}

const _POZITIE_LABELS_PDF: Record<string, string> = {
  dreapta_fata: "Dreapta Față",
  stanga_fata: "Stânga Față",
  dreapta_spate: "Dreapta Spate",
  stanga_spate: "Stânga Spate",
  rezerva: "Rezervă",
  nespecificat: "Nespecificat",
};

/** PDF — Montare Roți */
export async function generateMontajRoti(
  receipt: Receipt,
  company: CompanyData | null,
  rows: MontajRotaRow[],
  montareImageUrl: string | null,
  vehicle: VehiculForPdf | null = null,
  append?: AppendOptions,
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (append && !append.isFirst) doc.addPage();

  const fontB64 = await loadRoFontBase64();
  if (fontB64) registerRoFont(doc, fontB64);
  const FONT = fontB64 ? "NotoSans" : "helvetica";
  const t = makeT(!!fontB64);
  doc.setFont(FONT, "normal");

  await drawBackground(doc, company?.background_path);
  await drawLogo(doc, company?.logo_path, MT);

  const fmtReceiptDate = (() => {
    try { return fmtDate(receipt.date); } catch { return ""; }
  })();
  let y = drawHeader(doc, "Montare Roți", "", receipt.id as unknown as number, fmtReceiptDate, FONT);
  y += 2;
  hline(doc, y);
  y += 6;

  const client: ClientInfoForPdf = {
    clientNume: receipt.clientNume ?? null,
    clientCui: (receipt as any).clientCui ?? null,
    clientReprezentant: (receipt as any).clientReprezentant ?? null,
    clientAdresa: (receipt as any).clientAdresa ?? null,
    clientTelefon: (receipt as any).clientTelefon ?? null,
  };

  const bw = (CW - CARDS_GAP_X) / 2;
  const leftX = ML;
  const rightX = ML + bw + CARDS_GAP_X;
  y = drawCazareTopCards(doc, company ?? null, client, vehicle, leftX, rightX, y, bw, t, FONT) + 4;

  hline(doc, y);
  y += 6;

  // Tabel roți cu imagine în dreapta
  const SIDE_IMG_W = 55;
  const SIDE_GAP = 5;
  const tableW = CW - SIDE_IMG_W - SIDE_GAP;

  const navyBlue: [number, number, number] = [30, 58, 138];

  const body = rows.map((r, idx) => {
    const dim = t(r.dimensiuneValoare ?? "—");
    const profil = t(r.profilValoare ?? "—");
    const tip = TIP_PDF_LABELS[r.tip] ?? r.tip;
    const pozitie = _POZITIE_LABELS_PDF[r.pozitie] ?? r.pozitie;
    const marca = t(r.marcaNume ?? "—");
    return [
      String(idx + 1),
      `${pozitie}\n${marca}`,
      `${dim}\n${profil}\n${tip}`,
      r.adancime != null ? `${r.adancime} mm` : "—",
      r.presiune != null ? `${r.presiune.toFixed(1)} bar` : "—",
      r.cupluStrangere != null ? `${r.cupluStrangere} Nm` : "—",
    ];
  });

  if (body.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: [["#", "Poziție / Marcă", "Dimensiune / Profil / Tip", "Adâncime", "Presiune", "Cuplu"]],
      body,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2, valign: "middle" },
      headStyles: { fillColor: navyBlue, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2, halign: "center" },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "center", cellWidth: 16 },
        4: { halign: "center", cellWidth: 16 },
        5: { halign: "center", cellWidth: 16 },
      },
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = (doc as any).lastAutoTable.finalY;
    const tableH = tableEndY - tableStartY;

    await drawSideImage(doc, montareImageUrl, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  // ── Condiții tehnice de lucru ──────────────────────────────────────────────
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.black);
  doc.text(t("CONDIȚII TEHNICE DE LUCRU"), ML, y);
  y += 3;

  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray);
  const paragrafe = [
    "Strângerea prezoanelor de roată s-a efectuat cu cheie dinamometrică, la momentul de strângere specificat în manualul tehnic al vehiculului, conform indicațiilor producătorului autovehiculului sau conform valorilor înscrise pe eticheta situată pe stâlpul ușii șoferului.",
    "Presiunea pneurilor a fost reglată conform valorilor recomandate de producătorul autovehiculului, indicate pe eticheta de pe stâlpul caroseriei, în manualul de utilizare sau pe capacul rezervorului de combustibil.",
  ];
  for (const p of paragrafe) {
    const lines: string[] = doc.splitTextToSize(t(p), CW);
    doc.text(lines, ML, y);
    y += lines.length * 2.6 + 1.5;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.black);
  const atentie = "Atenție: Clientul este sfătuit să verifice strângerea prezoanelor după primii 50 pana la 100 km parcurși de la montaj, la un service autorizat sau cu o cheie dinamometrică calibrată.";
  const atLines: string[] = doc.splitTextToSize(t(atentie), CW);
  doc.text(atLines, ML, y);
  y += atLines.length * 2.6 + 4;
  doc.setTextColor(...C.black);

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website);

  const clientSlug = (receipt.clientNume ?? "client").replace(/\s+/g, "_").slice(0, 30);
  if (!append) doc.save(docFilename("montaj_roti", clientSlug));
}

// ─── Orchestrator: Deviz + Operații ───────────────────────────────────────────

export type CazareSection =
  | { type: "checkin"; cazare: CazareForPdf }
  | { type: "checkout"; cazare: CazareForPdf; checkoutDate: string }
  | { type: "combined"; checkout: CazareForPdf; newCazare: CazareForPdf; checkoutDate: string; montatePeMasina: boolean };

/** Merge: PDF combinat = Deviz complet + Montaj Roti complet + fiecare Cazare completa,
 *  fiecare cu propriul header/logo/top-cards/footer (ca si cum ar fi descarcate individual). */
export async function generateDevizPlusOperatii(
  r: Receipt,
  ctx: DocContext,
  vehicle: VehiculForPdf | null,
  montajRoti: MontajRotaRow[],
  cazariSections: CazareSection[],
  images: { cazare: string | null; scoatere: string | null; montare: string | null } | null,
  showTehnician = false,
): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  // Inregistreaza fontul o data — generatoarele apelate vor reincarca cache-ul si vor reapela
  // registerRoFont pe acelasi doc (idempotent).
  const fontB64 = await loadRoFontBase64();
  if (fontB64) registerRoFont(doc, fontB64);

  let isFirst = true;
  const append = () => {
    const opts: AppendOptions = { doc, isFirst };
    isFirst = false;
    return opts;
  };

  await generateDeviz(r, ctx, showTehnician, append());

  if (montajRoti.length > 0) {
    await generateMontajRoti(r, ctx.company ?? null, montajRoti, images?.montare ?? null, vehicle, append());
  }

  for (const section of cazariSections) {
    if (section.type === "checkin") {
      await generateCazareCheckin(section.cazare, ctx.company ?? null, images, vehicle, append());
    } else if (section.type === "checkout") {
      await generateCazareCheckout(section.cazare, ctx.company ?? null, images, vehicle, append());
    } else {
      await generateCazareScoatereIntroducere(
        section.checkout, section.newCazare, ctx.company ?? null,
        section.checkoutDate, section.montatePeMasina, images, vehicle, append(),
      );
    }
  }

  const clientSlug = (r.clientNume ?? "client").replace(/\s+/g, "_").slice(0, 30);
  doc.save(docFilename("deviz_operatii", clientSlug));
}
