/**
 * Generator PDF pentru afisarea/printarea facturilor PRIMITE prin e-Factura SPV.
 *
 * Foloseste detaliile parsate de backend (UBL Invoice/CreditNote) si genereaza
 * un PDF A4 portret cu: header, parti (emitent/beneficiar), meta, linii produs,
 * breakdown TVA, totaluri.
 */
import roFontUrl from "../../assets/fonts/NotoSans-Ro.ttf";
import { COLORS, PAGE, CONTENT_WIDTH } from "./constants";
import { lastTableY } from "./types";

export interface InvoiceDetailsReceived {
  doc_type: string;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  invoice_type_code: string | null;
  note: string | null;
  supplier: PartyInfo;
  customer: PartyInfo;
  payment_iban: string | null;
  payment_bank: string | null;
  payment_terms: string | null;
  lines: InvoiceLine[];
  tax_breakdown: TaxSubtotal[];
  total_without_vat: string | null;
  total_vat: string | null;
  total_with_vat: string | null;
  payable_amount: string | null;
  prepaid_amount: string | null;
}

export interface PartyInfo {
  name: string | null;
  cui: string | null;
  registration_id: string | null;
  address_line: string | null;
  city: string | null;
  country_subentity: string | null;
  country_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface InvoiceLine {
  line_id: string | null;
  description: string | null;
  quantity: string | null;
  unit_code: string | null;
  unit_price: string | null;
  line_net: string | null;
  vat_percent: string | null;
  vat_category: string | null;
}

export interface TaxSubtotal {
  taxable_amount: string | null;
  tax_amount: string | null;
  percent: string | null;
  category: string | null;
}

let _fontB64: string | null | false = false;

function _bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length))));
  }
  return btoa(chunks.join(""));
}

async function loadFont(): Promise<string | null> {
  if (_fontB64 !== false) return _fontB64;
  try {
    const resp = await fetch(roFontUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > 5_000) {
        _fontB64 = _bufToB64(buf);
        return _fontB64;
      }
    }
  } catch {}
  _fontB64 = null;
  return null;
}

function fmtMoney(s: string | null | undefined, currency: string | null = null): string {
  if (s == null || s === "") return "—";
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  const formatted = n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function fmtQty(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("ro-RO", { maximumFractionDigits: 3 });
}

export async function printInvoiceReceivedPdf(d: InvoiceDetailsReceived): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const fontB64 = await loadFont();
  let FONT = "helvetica";
  if (fontB64) {
    doc.addFileToVFS("NotoSans-Ro.ttf", fontB64);
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Ro.ttf", "NotoSans", "bold");
    FONT = "NotoSans";
  }

  const ML = PAGE.marginLeft;
  const MR = PAGE.marginRight;
  const CW = CONTENT_WIDTH;
  let y: number = PAGE.marginTop;

  // Header
  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.black);
  const title = d.doc_type === "CreditNote" ? "NOTA DE CREDIT (primita)" : "FACTURA (primita)";
  doc.text(title, ML, y);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  y += 6;
  if (d.invoice_number) doc.text(`Numar: ${d.invoice_number}`, ML, y);
  doc.text(`Data emiterii: ${d.issue_date ?? "—"}`, ML + 90, y);
  y += 4.5;
  if (d.due_date) doc.text(`Scadenta: ${d.due_date}`, ML + 90, y);
  if (d.currency) doc.text(`Moneda: ${d.currency}`, ML, y);
  y += 6;

  // Parti
  const colW = (CW - 6) / 2;
  const yStart = y;
  y = drawParty(doc, FONT, "EMITENT", d.supplier, ML, y, colW);
  const ySupplier = y;
  y = drawParty(doc, FONT, "BENEFICIAR", d.customer, ML + colW + 6, yStart, colW);
  y = Math.max(ySupplier, y) + 4;

  // Plata
  if (d.payment_iban || d.payment_bank || d.payment_terms) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.text("DETALII PLATA", ML, y);
    y += 4;
    doc.setFont(FONT, "normal");
    doc.setFontSize(8.5);
    if (d.payment_iban) { doc.text(`IBAN: ${d.payment_iban}`, ML, y); y += 4; }
    if (d.payment_bank) { doc.text(`Banca: ${d.payment_bank}`, ML, y); y += 4; }
    if (d.payment_terms) {
      const lines = doc.splitTextToSize(`Termeni: ${d.payment_terms}`, CW);
      doc.text(lines, ML, y);
      y += lines.length * 4;
    }
    y += 2;
  }

  // Linii
  const cur = d.currency ?? "";
  const lineRows = d.lines.map((l, idx) => [
    String(idx + 1),
    l.description ?? "—",
    fmtQty(l.quantity),
    l.unit_code ?? "",
    fmtMoney(l.unit_price),
    fmtMoney(l.line_net),
    l.vat_percent ? `${Number(l.vat_percent).toLocaleString("ro-RO")}%` : "—",
  ]);

  if (lineRows.length) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Descriere", "Cant.", "U.M.", "Pret unit.", "Val. net", "TVA %"]],
      body: lineRows,
      styles: {
        font: FONT,
        fontSize: 7.5,
        cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
        textColor: [...COLORS.black],
        lineColor: [...COLORS.black],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [...COLORS.veryLight],
        textColor: [...COLORS.black],
        fontSize: 7,
        fontStyle: "bold",
        lineColor: [...COLORS.black],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: "auto" },
        2: { halign: "right", cellWidth: 16 },
        3: { halign: "center", cellWidth: 12 },
        4: { halign: "right", cellWidth: 22 },
        5: { halign: "right", cellWidth: 24, fontStyle: "bold" },
        6: { halign: "center", cellWidth: 14 },
      },
      margin: { left: ML, right: MR },
      tableWidth: CW,
    });
    y = lastTableY(doc) + 4;
  } else {
    doc.setFontSize(9);
    doc.setFont(FONT, "italic");
    doc.text("Fara linii detaliate in factura.", ML, y);
    y += 6;
  }

  // Breakdown TVA
  if (d.tax_breakdown.length) {
    autoTable(doc, {
      startY: y,
      head: [["Cota TVA", "Categorie", "Baza", "TVA"]],
      body: d.tax_breakdown.map((t) => [
        t.percent != null ? `${Number(t.percent).toLocaleString("ro-RO")}%` : "—",
        t.category ?? "—",
        fmtMoney(t.taxable_amount),
        fmtMoney(t.tax_amount),
      ]),
      styles: {
        font: FONT,
        fontSize: 8,
        cellPadding: 1.6,
        lineColor: [...COLORS.black],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [...COLORS.veryLight],
        textColor: [...COLORS.black],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 20 },
        1: { halign: "center", cellWidth: 22 },
        2: { halign: "right", cellWidth: "auto" },
        3: { halign: "right", cellWidth: 30 },
      },
      margin: { left: ML, right: MR },
      tableWidth: CW / 2 + 20,
    });
    y = lastTableY(doc) + 4;
  }

  // Totaluri
  const rightX = PAGE.width - MR;
  const labelX = rightX - 70;
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  if (d.total_without_vat) { doc.text("Total fara TVA:", labelX, y); doc.text(fmtMoney(d.total_without_vat, cur), rightX, y, { align: "right" }); y += 4.5; }
  if (d.total_vat)         { doc.text("TVA total:",      labelX, y); doc.text(fmtMoney(d.total_vat, cur),         rightX, y, { align: "right" }); y += 4.5; }
  if (d.total_with_vat)    {
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text("Total cu TVA:", labelX, y);
    doc.text(fmtMoney(d.total_with_vat, cur), rightX, y, { align: "right" });
    y += 5;
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
  }
  if (d.payable_amount)    {
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text("DE PLATA:", labelX, y);
    doc.text(fmtMoney(d.payable_amount, cur), rightX, y, { align: "right" });
    y += 6;
  }

  if (d.note) {
    doc.setFont(FONT, "italic");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(`Mentiuni: ${d.note}`, CW);
    doc.text(lines, ML, y);
    y += lines.length * 3.2 + 4;
  }

  // Footer
  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Document generat din BerlinStar e-Factura. Sursa: ANAF SPV (UBL ${d.doc_type}).`,
    ML,
    PAGE.height - 8,
  );

  const fname = `factura_primita_${(d.invoice_number ?? "spv").replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;
  doc.save(fname);
}

function drawParty(
  doc: any,
  font: string,
  label: string,
  p: PartyInfo,
  x: number,
  y: number,
  w: number,
): number {
  doc.setFont(font, "bold");
  doc.setFontSize(7);
  doc.text(label.toUpperCase(), x, y);
  y += 3.8;
  doc.setFont(font, "bold");
  doc.setFontSize(9);
  const nameLines = doc.splitTextToSize(p.name ?? "—", w);
  doc.text(nameLines, x, y);
  y += nameLines.length * 4.2;
  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  if (p.cui)            { doc.text(`CUI: ${p.cui}`, x, y); y += 3.5; }
  if (p.registration_id && p.registration_id !== p.cui) { doc.text(`Reg.: ${p.registration_id}`, x, y); y += 3.5; }
  if (p.address_line)   { const al = doc.splitTextToSize(p.address_line, w); doc.text(al, x, y); y += al.length * 3.5; }
  if (p.city)           { doc.text(`${p.city}${p.country_subentity ? ", " + p.country_subentity : ""}${p.country_code ? ", " + p.country_code : ""}`, x, y); y += 3.5; }
  if (p.contact_email)  { doc.text(`Email: ${p.contact_email}`, x, y); y += 3.5; }
  if (p.contact_phone)  { doc.text(`Tel: ${p.contact_phone}`, x, y); y += 3.5; }
  return y;
}
