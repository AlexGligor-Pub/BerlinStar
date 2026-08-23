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

export interface ReceiptItemForTable {
  name: string;
  qty: number;
  price: number;
  unit: string;
  employeeName?: string | null;
  // TVA per linie (Factura Rapida). Cand e setat, suprascrie tvaPct global din PDF.
  vatPercent?: number | null;
  /** Pretul de lista, cand linia are o reducere aplicata (vezi DiscountModal). */
  originalPrice?: number | null;
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
    // Cand linia are reducere, aratam si pretul de lista sub cel practicat:
    // altfel clientul nu vede de ce plateste 336 in loc de 420.
    const priceCell = item.originalPrice != null && item.originalPrice > item.price
      ? `${item.price.toFixed(2)}\n(${item.originalPrice.toFixed(2)})`
      : item.price.toFixed(2);
    row.push(
      String(item.qty),
      t(item.unit),
      priceCell,
      net.toFixed(2),
      tva.toFixed(2),
      total.toFixed(2),
    );
    return row;
  });

  // Header coloanei TVA: daca toate articolele au aceeasi cota, scrie "TVA X%".
  // Altfel (cote mixte in Factura Rapida) ramane generic "TVA".
  const rates = Array.from(new Set(items.map((it) => it.vatPercent ?? tvaPct)));
  const tvaHeader = rates.length === 1 ? `TVA ${rates[0]}%` : "TVA";

  const head = showTehnician
    ? [["#", "Denumire", "Tehnician", "Cant.", "U.M.", "Pret unit.", "Val. net", tvaHeader, "Total"]]
    : [["#", "Denumire", "Cant.", "U.M.", "Pret unit.", "Val. net", tvaHeader, "Total"]];

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

  // Reducerea e deja scazuta din preturile liniilor; o aratam explicit, altfel
  // pe document nu s-ar vedea niciunde ca s-a acordat una.
  const discount = (items ?? []).reduce(
    (sum, it) => sum + (it.originalPrice != null && it.originalPrice > it.price
      ? (it.originalPrice - it.price) * it.qty
      : 0),
    0,
  );

  if (!opts?.skipTopLine) {
    hline(doc, y, COLORS.lightGray, 0.2);
    y += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.black);

  if (discount > 0.004) {
    const before = totalFinal + discount;
    const pctOff = before > 0 ? (discount / before) * 100 : 0;
    doc.text("Valoare inainte de reducere:", labelX, y);
    doc.text(lei(before), rightX, y, { align: "right" });
    y += 4.5;
    doc.text(`Reducere (${pctOff.toFixed(pctOff % 1 === 0 ? 0 : 2)}%):`, labelX, y);
    doc.text(`-${lei(discount)}`, rightX, y, { align: "right" });
    y += 4.5;
  }

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

/** Situatie plati: istoricul miscarilor de bani (avans / plata / restituire).
 *
 *  Se deseneaza doar cand exista miscari. Scopul e ca devizul sa arate tot
 *  traseul banilor (ex. avans 100 incasat, apoi restituit, apoi plata 500),
 *  fara sa atinga valoarea prestatiei — un avans nu e reducere.
 */
export interface PaymentRowForPdf {
  kind: "avans" | "plata" | "restituire";
  amount: string | number;
  method: string;
  paid_at: string;
  note?: string | null;
}

export function drawPaymentsHistory(
  doc: jsPDF,
  payments: PaymentRowForPdf[],
  totalBon: number,
  y: number,
): number {
  if (!payments || payments.length === 0) return y;

  const KIND_LABEL: Record<string, string> = {
    avans: "Avans incasat",
    plata: "Plata",
    restituire: "Restituire client",
  };

  // Salt de pagina daca nu mai incape (titlu + rânduri + sumar).
  const needed = 12 + payments.length * 4.5 + 10;
  // Marginea de jos nu e exportata in constants; folosim aceeasi valoare ca sus.
  if (y + needed > PAGE_H - PAGE.marginTop) {
    doc.addPage();
    y = PAGE.marginTop;
  }

  y += 3;
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.2);
  doc.line(ML, y, PAGE_W - MR, y);
  y += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  doc.text("SITUATIE PLATI", ML, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const amountX = ML + 105;
  let incasat = 0;
  let restituit = 0;

  for (const p of payments) {
    const val = parseFloat(String(p.amount)) || 0;
    const isOut = p.kind === "restituire";
    if (isOut) restituit += val;
    else incasat += val;

    const d = new Date(p.paid_at);
    // Data SI ora: pe un deviz cu mai multe incasari in aceeasi zi, ziua
    // singura nu spune in ce ordine au intrat banii.
    const dateStr = isNaN(d.getTime())
      ? ""
      : `${d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;

    doc.setTextColor(...COLORS.gray);
    doc.text(dateStr, ML, y);
    doc.setTextColor(...COLORS.black);
    const label = KIND_LABEL[p.kind] ?? p.kind;
    const suffix = p.method ? ` (${p.method})` : "";
    doc.text(`${label}${suffix}`, ML + 34, y);
    if (p.note) {
      doc.setTextColor(...COLORS.gray);
      doc.text(String(p.note).slice(0, 36), ML + 78, y);
    }
    doc.setTextColor(...COLORS.black);
    doc.text(`${isOut ? "-" : "+"}${lei(val)}`, amountX + 40, y, { align: "right" });
    y += 4.2;
  }

  const net = incasat - restituit;
  const rest = totalBon - net;

  y += 1;
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(ML + 24, y, amountX + 40, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Total incasat:", ML + 24, y);
  doc.text(lei(net), amountX + 40, y, { align: "right" });
  y += 4.2;
  doc.text("Rest de plata:", ML + 24, y);
  doc.text(lei(rest), amountX + 40, y, { align: "right" });
  y += 2;

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

/** Y-ul liniei de semnatura cand `pinToBottom: true` — exportat ca apelantii sa-l
 *  poata folosi pentru a verifica daca alt continut incape deasupra. */
export const SIGNATURES_PIN_Y = PAGE_H - 22;

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
    y = SIGNATURES_PIN_Y;
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
