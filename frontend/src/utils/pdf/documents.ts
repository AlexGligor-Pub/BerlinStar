/**
 * Primitive document-level: header, blocuri companie/client, tabel articole,
 * totale, disclaimer, semnaturi. Reutilizabile intre deviz/factura/chitanta.
 *
 * Toate functiile primesc `t` (text transform) ca parametru — apelantul decide
 * daca aplica conversie de diacritice (Helvetica) sau lasa textul ca atare
 * (NotoSans cu suport romanesc). Asta decupleaza primitivele de starea
 * module-level din generateDocuments.
 */

import type { jsPDF } from "jspdf";
import { COLORS, PAGE, CONTENT_WIDTH } from "./constants";
import { lei } from "./format";
import { lastTableY } from "./types";
import { hline } from "./primitives";

const ML = PAGE.marginLeft;
const MR = PAGE.marginRight;
const PAGE_W = PAGE.width;
const PAGE_H = PAGE.height;
const CW = CONTENT_WIDTH;

/** Text transform: ia un string (sau null) si intoarce stringul gata de doc.text(). */
export type TextTransform = (s: string | null | undefined) => string;

// ─── Tipuri minimale pentru blocurile de document ─────────────────────────────

export interface CompanyInfo {
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
}

export interface ClientInfo {
  clientNume: string | null;
  clientCui: string | null;
  clientReprezentant: string | null;
  clientAdresa: string | null;
  clientTelefon: string | null;
}

export interface ReceiptItemForTable {
  name: string;
  qty: number;
  price: number;
  unit: string;
  employeeName?: string | null;
  // TVA per linie (Factura Rapida). Cand e setat, suprascrie tvaPct global din PDF.
  vatPercent?: number | null;
}

export interface ReceiptTotals {
  total: number;
  metodaPlata?: string | null;
  partialPay?: number | null;
}

export interface DisclaimerInfo {
  title: string;
  text: string;
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

/** Header document: titlu + serie/nr + data (stanga). */
export function drawHeader(
  doc: jsPDF,
  title: string,
  serie: string,
  nr: number,
  date: string,
  font = "helvetica",
): number {
  let y = PAGE.marginTop;

  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.black);
  doc.text(title, ML, y);

  doc.setFont(font, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.black);
  y += 6;
  doc.text(
    serie ? `Serie: ${serie}   Nr.: ${String(nr).padStart(2, "0")}` : `Nr.: ${String(nr).padStart(2, "0")}`,
    ML,
    y,
  );
  y += 4;
  doc.text(`Data: ${date}`, ML, y);

  y += 5;
  return y + 5;
}

/** Bloc companie: eticheta + camp info. */
export function drawCompanyBlock(
  doc: jsPDF,
  label: string,
  company: CompanyInfo | null,
  x: number, y: number, bw: number,
  t: TextTransform,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.black);
  doc.text(t(label).toUpperCase(), x, y);
  y += 3.5;

  if (!company) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    doc.text("-", x, y);
    return y + 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  const nameLines: string[] = doc.splitTextToSize(t(company.name), bw);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.black);
  if (company.cui) { doc.text(`CUI: ${company.cui}`, x, y); y += 3.5; }
  if (company.nr_reg_com) { doc.text(`Reg.Com.: ${t(company.nr_reg_com)}`, x, y); y += 3.5; }
  if (company.address) {
    const al: string[] = doc.splitTextToSize(t(company.address), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (company.phone) { doc.text(`Tel: ${t(company.phone)}`, x, y); y += 3.5; }
  if (company.bank_name) { doc.text(`Banca: ${t(company.bank_name)}`, x, y); y += 3.5; }
  if (company.iban) { doc.text(`IBAN: ${company.iban}`, x, y); y += 3.5; }
  if (company.capital_social != null) {
    const cap = company.capital_social.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(`Capital social: ${cap} lei`, x, y); y += 3.5;
  }
  return y;
}

/** Bloc client. */
export function drawClientBlock(
  doc: jsPDF,
  label: string,
  client: ClientInfo,
  x: number, y: number, bw: number,
  t: TextTransform,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.black);
  doc.text(t(label).toUpperCase(), x, y);
  y += 3.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  const lines: string[] = doc.splitTextToSize(t(client.clientNume ?? "-"), bw);
  doc.text(lines, x, y);
  y += lines.length * 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.black);
  if (client.clientCui)          { doc.text(`CUI: ${client.clientCui}`, x, y); y += 3.5; }
  if (client.clientReprezentant) { doc.text(`Repr.: ${t(client.clientReprezentant)}`, x, y); y += 3.5; }
  if (client.clientAdresa) {
    const al: string[] = doc.splitTextToSize(t(client.clientAdresa), bw);
    doc.text(al, x, y);
    y += al.length * 3.5;
  }
  if (client.clientTelefon) { doc.text(`Tel: ${client.clientTelefon}`, x, y); y += 3.5; }
  return y;
}

/** Tabel articole cu TVA per linie. autoTable = referinta la jspdf-autotable. */
export function drawItemsTable(
  doc: jsPDF,
  autoTable: (doc: jsPDF, opts: Record<string, unknown>) => void,
  items: ReceiptItemForTable[],
  y: number,
  tvaPct: number,
  t: TextTransform,
  showTehnician = false,
): number {
  const rows = items.map((item, idx) => {
    // Linie cu TVA propriu (Factura Rapida) ⇒ pretul e net si totalul = net*(1+vat).
    // Linie clasica (POS/recepție) ⇒ pretul e gross cu TVA-ul firmei inclus.
    const itemVat = item.vatPercent ?? null;
    const subtotal = item.price * item.qty;
    let net: number;
    let total: number;
    let tva: number;
    if (itemVat != null) {
      net = subtotal;
      tva = subtotal * (itemVat / 100);
      total = net + tva;
    } else {
      total = subtotal;
      net = total / (1 + tvaPct / 100);
      tva = total - net;
    }
    const row: string[] = [String(idx + 1), t(item.name)];
    if (showTehnician) {
      const teh = item.employeeName ? t(item.employeeName).slice(0, 15) : "";
      row.push(teh);
    }
    row.push(
      String(item.qty),
      t(item.unit),
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

  const columnStyles: Record<number, Record<string, unknown>> = showTehnician
    ? {
        0: { halign: "center", cellWidth: 8, textColor: [...COLORS.black] },
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
        0: { halign: "center", cellWidth: 8, textColor: [...COLORS.black] },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 11 },
        3: { halign: "center", cellWidth: 11 },
        4: { halign: "right", cellWidth: 22 },
        5: { halign: "right", cellWidth: 22 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "right", cellWidth: 24, fontStyle: "bold" },
      };

  // Faux bold pe header: NotoSans nu are variant bold real, deci re-desenam textul
  // cu offset orizontal mic (overprint) in didDrawCell — efectul vizual e text "ingrosat".
  autoTable(doc, {
    startY: y,
    head,
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
      textColor: [...COLORS.black],
      lineColor: [...COLORS.black],
      lineWidth: 0.1,
      fillColor: false,
    },
    headStyles: {
      fillColor: false,
      textColor: [...COLORS.black],
      fontSize: 7,
      fontStyle: "bold",
      lineColor: [...COLORS.black],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fillColor: false,
    },
    alternateRowStyles: {
      fillColor: false,
    },
    columnStyles,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    didDrawCell: (data: any) => {
      if (data.section !== "head") return;
      const cell = data.cell;
      const text = Array.isArray(cell.text) ? cell.text.join(" ") : String(cell.text ?? cell.raw ?? "");
      if (!text) return;

      const halign: "left" | "center" | "right" = cell.styles.halign || "left";
      const pad = cell.styles.cellPadding;
      const padLeft  = typeof pad === "object" ? (pad.left  ?? 1.5) : (pad ?? 1.5);
      const padRight = typeof pad === "object" ? (pad.right ?? 1.5) : (pad ?? 1.5);
      let x: number;
      if (halign === "center") x = cell.x + cell.width / 2;
      else if (halign === "right") x = cell.x + cell.width - padRight;
      else x = cell.x + padLeft;

      const fontSize = cell.styles.fontSize ?? 7;
      const y2 = cell.y + cell.height / 2 + (fontSize * 0.3528) * 0.35;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      doc.setTextColor(...COLORS.black);
      doc.text(text, x + 0.15, y2, { align: halign });
    },
  });

  return lastTableY(doc) + 3;
}

/** Sectiune totale — TVA afisat intotdeauna (0% daca nu e platitor TVA).
 *
 *  Daca `items` e trimis si fiecare linie are `vatPercent`, recalculam net/TVA per
 *  linie (Factura Rapida cu cote mixte). Altfel folosim `tvaPct` global pe total.
 */
export function drawTotals(
  doc: jsPDF,
  totals: ReceiptTotals,
  y: number,
  tvaPct: number | null | undefined,
  items?: ReceiptItemForTable[],
  opts?: { skipTopLine?: boolean; inlineSubtotals?: boolean },
): number {
  const rightX = PAGE_W - MR;
  const labelX = rightX - 60;

  const pct = tvaPct ?? 0;
  const totalFinal = totals.total;
  let net: number;
  let tvaAmt: number;
  const allLinesHaveVat = items != null && items.length > 0 && items.every((it) => it.vatPercent != null);
  if (allLinesHaveVat) {
    net = 0;
    tvaAmt = 0;
    for (const it of items!) {
      const sub = it.price * it.qty;
      net += sub;
      tvaAmt += sub * ((it.vatPercent ?? 0) / 100);
    }
  } else {
    net = totalFinal / (1 + pct / 100);
    tvaAmt = totalFinal - net;
  }

  if (!opts?.skipTopLine) {
    hline(doc, y, COLORS.lightGray, 0.2);
    y += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.black);

  // Pentru linii cu cote diferite afisam un total agregat; defalcatul pe rate ramane in tabel.
  const distinctVats = allLinesHaveVat
    ? Array.from(new Set(items!.map((it) => it.vatPercent ?? 0)))
    : [pct];
  const vatLabel = distinctVats.length === 1 ? `TVA ${distinctVats[0]}%:` : "TVA (cote multiple):";

  if (opts?.inlineSubtotals) {
    // Doua coloane pe acelasi rand: TVA primul (stanga), Subtotal Net al doilea (dreapta).
    // Pozitii fixe ca sa garantam ca toate cele 4 elemente (2 labels + 2 valori) sunt vizibile.
    const tvaValueX = rightX - 70;
    const tvaLabelX = tvaValueX - 35;
    // TVA bold via overprint (faux-bold, NotoSans nu are bold real).
    doc.setFont("helvetica", "bold");
    doc.text(vatLabel, tvaLabelX, y);
    doc.text(vatLabel, tvaLabelX + 0.2, y);
    doc.text(lei(tvaAmt), tvaValueX, y, { align: "right" });
    doc.text(lei(tvaAmt), tvaValueX + 0.2, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal (fara TVA):", tvaValueX + 6, y);
    doc.text(lei(net), rightX, y, { align: "right" });
    y += 2.25;
  } else {
    doc.text("Subtotal (fara TVA):", labelX, y);
    doc.text(lei(net), rightX, y, { align: "right" });
    y += 4.5;

    doc.text(vatLabel, labelX, y);
    doc.text(lei(tvaAmt), rightX, y, { align: "right" });
    y += 4.5;
  }

  hline(doc, y, COLORS.lightGray, 0.2);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  // Faux-bold via overprint (NotoSans nu are bold real).
  doc.text("TOTAL DE PLATA:", labelX, y);
  doc.text("TOTAL DE PLATA:", labelX + 0.2, y);
  doc.text(lei(totalFinal), rightX, y, { align: "right" });
  doc.text(lei(totalFinal), rightX + 0.2, y, { align: "right" });
  y += 5;

  if (totals.metodaPlata === "Platit Partial" && totals.partialPay != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    const restVal = totalFinal - totals.partialPay;
    doc.text(`Avans: ${lei(totals.partialPay)}`, labelX, y);
    doc.text(`Rest: ${lei(restVal)}`, rightX, y, { align: "right" });
    y += 4.5;
  }

  return y + 1;
}

/** Disclaimer — 6pt, gri deschis, salt de pagina daca nu mai e loc.
 *  `compact: true` reduce padding-urile interne pentru un layout mai stramt. */
export function drawDisclaimer(
  doc: jsPDF,
  disclaimer: DisclaimerInfo | null,
  y: number,
  t: TextTransform,
  opts?: { compact?: boolean },
): number {
  if (!disclaimer?.text) return y;
  if (y > PAGE_H - 30) { doc.addPage(); y = PAGE.marginTop; }

  const padHline = opts?.compact ? 0.75 : 1.5;
  const padTitle = opts?.compact ? 3 : 3;
  const padAfter = opts?.compact ? 1 : 3;

  hline(doc, y, COLORS.veryLight, 0.2);
  y += padHline;

  if (disclaimer.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.black);
    doc.text(t(disclaimer.title).toUpperCase(), ML, y);
    y += padTitle;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.black);
  const lines: string[] = doc.splitTextToSize(t(disclaimer.text), CW);
  doc.text(lines, ML, y);
  y += lines.length * 2.8 + padAfter;
  return y;
}

/** Doua rubrici de semnatura (linie + label).
 *  `pinToBottom: true` plaseaza semnaturile la baza paginii (deasupra footer-ului),
 *  indiferent de y-ul primit. */
export function drawSignatures(
  doc: jsPDF,
  leftLabel: string,
  rightLabel: string,
  y: number,
  opts?: { pinToBottom?: boolean },
): number {
  if (opts?.pinToBottom) {
    // Footer-ul incepe la PAGE_H - 10. Plasam linia semnaturii la ~22mm de baza,
    // ca labelurile (linie + 4mm) sa stea confortabil deasupra footer-ului.
    y = PAGE_H - 22;
  } else {
    if (y > PAGE_H - 22) { doc.addPage(); y = PAGE.marginTop; }
    y += 8;
  }

  const colW = CW / 2 - 8;
  const col2X = ML + colW + 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.black);
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);

  // Linie intrerupta la mijloc, cu textul centrat in interval (vertical-centrat pe linie).
  // Linia ocupa jumate din latimea coloanei, centrata sub label.
  const gap = 1.5; // mm spatiu liber pe fiecare parte a textului
  const textBaselineY = y + 1; // offset baseline pentru centrare vizuala pe linie
  const lineW = colW / 2;

  const leftMid = ML + colW / 2;
  const leftTextW = doc.getTextWidth(leftLabel);
  doc.line(leftMid - lineW / 2, y, leftMid - leftTextW / 2 - gap, y);
  doc.line(leftMid + leftTextW / 2 + gap, y, leftMid + lineW / 2, y);
  doc.text(leftLabel, leftMid, textBaselineY, { align: "center" });

  const rightMid = col2X + colW / 2;
  const rightTextW = doc.getTextWidth(rightLabel);
  doc.line(rightMid - lineW / 2, y, rightMid - rightTextW / 2 - gap, y);
  doc.line(rightMid + rightTextW / 2 + gap, y, rightMid + lineW / 2, y);
  doc.text(rightLabel, rightMid, textBaselineY, { align: "center" });

  return y;
}
