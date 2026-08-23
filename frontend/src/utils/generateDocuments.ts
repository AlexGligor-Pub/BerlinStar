/**
 * generateDocuments.ts — Deviz, Factura fiscala, Chitanta
 * Design print-friendly: fara fundal inchis, cerneala minima.
 * Caractere romane convertite la ASCII pentru compatibilitate jsPDF.
 */

import type { Receipt } from "../store/receiptsStore";
import {
  COLORS, PAGE, CONTENT_WIDTH,
  lastTableY,
  fmtDate, lei, docFilename, asciifyDiacritics,
  hline, drawBackground, drawSideImage,
  drawFooterWithBranding,
  fetchImageAsDataUrl, loadImageAsDataUrl,
  drawItemsTable, drawTotals, drawDisclaimer, drawSignatures, SIGNATURES_PIN_Y,
  drawPaymentsHistory, type PaymentRowForPdf,
} from "./pdf";
// Importat ca asset Vite → primeste hash in nume la build, deci nu mai sufera de
// cache stale la nivel de nginx/CDN cand schimbam continutul fontului.
import roFontUrl from "../assets/fonts/NotoSans-Ro.ttf";

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

// ─── Culori si margini ────────────────────────────────────────────────────────
// Aliase locale catre constantele partajate din ./pdf — au ramas in nume scurte
// pentru compactness, dar single source of truth e in pdf/constants.ts.

const C = COLORS;
const ML = PAGE.marginLeft;
const MR = PAGE.marginRight;
const CW = CONTENT_WIDTH;
const MT = PAGE.marginTop;

// ─── Encoding helper ──────────────────────────────────────────────────────────
// jsPDF standard (Helvetica) = Latin-1; diacriticele romanesti nu sunt in Latin-1.
// Folosim NotoSans-Regular.ttf de pe jsDelivr (cu cache localStorage) pentru suport complet.

// Flag module-level: cand un generator a inregistrat NotoSans pe doc si l-a
// alias-at peste "helvetica", lasam diacriticele neschimbate.
let _keepDiacritics = false;

function ro(s: string | null | undefined): string {
  if (!s) return "";
  if (_keepDiacritics) return s;
  // fallback pentru Helvetica: inlocuieste diacriticele care nu sunt in Latin-1
  return asciifyDiacritics(s);
}

/**
 * Activeaza fontul NotoSans pe `doc` si redirecteaza apelurile setFont("helvetica", ...)
 * catre "NotoSans". Returneaza un cleanup ce trebuie apelat la final pentru a
 * restaura starea (in caz de append intr-un doc partajat).
 */
async function enableRomanianFont(doc: any): Promise<() => void> {
  const b64 = await loadRoFontBase64();
  if (!b64) return () => {};
  registerRoFont(doc, b64);
  // Alias "helvetica" -> NotoSans astfel incat tot codul existent care apeleaza
  // doc.setFont("helvetica", "bold|normal|italic") sa foloseasca glyph-urile cu
  // diacritice. "italic" cade pe "normal" cand nu exista variants italic.
  const orig = doc.setFont.bind(doc);
  doc.setFont = function (family: string, style?: string) {
    if (family === "helvetica") {
      const s = style === "italic" ? "normal" : (style ?? "normal");
      return orig("NotoSans", s);
    }
    return orig(family, style);
  };
  const prev = _keepDiacritics;
  _keepDiacritics = true;
  return () => {
    _keepDiacritics = prev;
    // nu restaurez doc.setFont — documentul este de obicei descarcat imediat dupa
  };
}

// ─── Romanian font loader ─────────────────────────────────────────────────────

// Fontul e importat ca asset Vite (roFontUrl) → URL-ul are hash in nume, deci
// invalidarea cache-ului se face automat la fiecare schimbare de continut.
// Tinem cache-ul in memorie (per sesiune) ca sa nu re-incarcam la fiecare PDF.
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
  try {
    const resp = await fetch(roFontUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > 5_000) {
        const b64 = _bufToB64(buf);
        _roFontB64 = b64;
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
  // Folosim acelasi fisier si pentru bold (fontul nu are variant bold separat,
  // dar nu apare spatiat — singura diferenta vizibila e ca "bold" e mai subtire decat Helvetica Bold).
  doc.addFont("NotoSans-Ro.ttf", "NotoSans", "bold");
}

// t() — text helper: lasa textul neschimbat daca avem font roman, altfel ro()
function makeT(hasFont: boolean) {
  return (s: string | null | undefined): string => hasFont ? (s ?? "") : ro(s);
}

// ─── Format helpers ───────────────────────────────────────────────────────────
// fmtDate, fmtNow, lei, docFilename sunt importate din ./pdf — partajate cu
// generateReceiptPdf si orice generator viitor.

async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

// ─── DEVIZ ────────────────────────────────────────────────────────────────────

export async function generateDeviz(r: Receipt, ctx: DocContext, showTehnician = false, append?: AppendOptions, montajRoti?: MontajRotaRow[], payments?: PaymentRowForPdf[]): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  if (append && !append.isFirst) doc.addPage();
  await enableRomanianFont(doc);
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const date = fmtDate(r.date);

  // Background
  await drawBackground(doc, ctx.company?.background_path);

  const t = makeT(true);
  const client: ClientInfoForPdf = {
    clientNume: r.clientNume,
    clientCui: r.clientCui,
    clientReprezentant: r.clientReprezentant,
    clientAdresa: r.clientAdresa,
    clientTelefon: r.clientTelefon,
  };
  const veh = r.vehicol;
  const vehicleForPdf: VehiculForPdf | null = veh
    ? {
        numarMasina: veh.numarMasina,
        marca: veh.marca,
        model: veh.model,
        numarKilometrii: veh.numarKilometrii,
        anFabricatie: veh.anFabricatie,
        vin: veh.vin,
        observatii: veh.observatii,
      }
    : null;

  let y = await drawDocHeader3Col(
    doc, ctx.company ?? null, client, vehicleForPdf,
    { title: "DEVIZ", serie: ctx.serie, nr: ctx.nr, dateStr: date },
    t, "helvetica",
  ) + 3;

  y = drawItemsTable(doc, autoTable, r.items, y, tvaPct, ro, showTehnician);
  y = drawTotals(doc, r, y, tvaPct, r.items, { skipTopLine: true, inlineSubtotals: true });
  // Istoricul miscarilor de bani (avans / restituire / plata), cand exista.
  if (payments && payments.length > 0) {
    y = drawPaymentsHistory(doc, payments, r.total, y);
  }

  if (r.descriere?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 1;
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
    y += dl.length * 4 + 1;
  }

  if (r.dateTehn?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 1;
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
    y += dtl.length * 4 + 1;
  }

  if (r.metodaPlata === "Platit Partial" && r.partialPay != null) {
    hline(doc, y, C.veryLight, 0.1);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.black);
    doc.text(`Platit partial / Avans: ${lei(r.partialPay)}`, ML, y);
    const totalFinal2 = r.total;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.black);
    doc.text(`Rest de plata: ${lei(totalFinal2 - r.partialPay)}`, ML, y + 5);
    y += 10;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y, ro, { compact: true });

  // Daca receiptul are montaj roti, anexam corpul (grid + Conditii Tehnice + Atentie):
  // - pe aceeasi pagina cu deviz-ul daca incape deasupra zonei de semnatura,
  // - altfel pe pagina noua.
  if (montajRoti && montajRoti.length > 0) {
    const montajTitleH = 7;
    const montajHlineH = 6;
    const estH = estimateMontajRotiBodyHeight(montajRoti) + montajTitleH + montajHlineH;
    const buffer = 4;
    if (y + estH + buffer > SIGNATURES_PIN_Y) {
      doc.addPage();
      await drawBackground(doc, ctx.company?.background_path);
      y = MT;
    } else {
      y += 4;
    }
    // Linie orizontala separator inainte de Montare Roti
    hline(doc, y, C.veryLight, 0.2);
    y += montajHlineH;
    // Titlu sectiune (bold, centrat, pe o singura linie)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.black);
    doc.text(
      t(`Montare Roți   Nr.: ${r.id}   Data: ${fmtDate(r.date)}`),
      PAGE.width / 2, y, { align: "center" },
    );
    y += montajTitleH;
    y = await drawMontajRotiBody(doc, montajRoti, y, t, "helvetica");
  }

  // Semnaturile la baza paginii curente (dupa montaj daca exista).
  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y, { pinToBottom: true });
  await drawFooterWithBranding(doc, ctx.company?.website, { itemCount: r.items.length });

  if (!append) doc.save(docFilename("deviz", r.titlu));
}

// ─── FISA DE LUCRU (FDL) ─────────────────────────────────────────────────────
// Document de estimare: pretul si timpul de manopera sunt orientative.
// Identificator: FDL-{id} (nu intra in plaja de devize pana la conversie).

export async function generateFisaDeLucru(
  r: Receipt,
  company: CompanyData | null,
  disclaimerText?: string | null,
): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await enableRomanianFont(doc);
  const tvaPct = company?.tva_percentage ?? 0;
  const date = fmtDate(r.date);

  await drawBackground(doc, company?.background_path);

  const t = makeT(true);
  const client: ClientInfoForPdf = {
    clientNume: r.clientNume,
    clientCui: r.clientCui,
    clientReprezentant: r.clientReprezentant,
    clientAdresa: r.clientAdresa,
    clientTelefon: r.clientTelefon,
  };
  const veh = r.vehicol;
  const vehicleForPdf: VehiculForPdf | null = veh
    ? {
        numarMasina: veh.numarMasina,
        marca: veh.marca,
        model: veh.model,
        numarKilometrii: veh.numarKilometrii,
        anFabricatie: veh.anFabricatie,
        vin: veh.vin,
        observatii: veh.observatii,
      }
    : null;

  let y = await drawDocHeader3Col(
    doc, company ?? null, client, vehicleForPdf,
    { title: "FISA DE LUCRU", nr: `FDL-${r.id}`, dateStr: date },
    t, "helvetica",
  ) + 4;

  // Helper: header colorat pentru fiecare sectiune (titlu pe banda de culoare cu
  // bara verticala stanga). Returneaza y-ul de unde poate incepe continutul.
  function drawFdlSectionHeader(title: string, accent: [number, number, number]): number {
    const headerH = 7;
    const padX = 4;
    const [ar, ag, ab] = accent;
    // Fundal light tint
    doc.setFillColor(
      Math.min(255, ar + (255 - ar) * 0.88),
      Math.min(255, ag + (255 - ag) * 0.88),
      Math.min(255, ab + (255 - ab) * 0.88),
    );
    doc.rect(ML, y, CW, headerH, "F");
    // Bara verticala accent
    doc.setFillColor(ar, ag, ab);
    doc.rect(ML, y, 1.5, headerH, "F");
    // Titlu
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(ar, ag, ab);
    doc.text(ro(title), ML + padX, y + 4.8);
    return y + headerH + 1;
  }

  // Helper: bullet list sub o sectiune. Curata "• / - / *" din inceput.
  function drawFdlBullets(body: string): void {
    const linii = body.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linii.length === 0) return;

    const lineH = 4.6;
    const padX = 5;
    const bulletIndent = 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.black);

    for (const linie of linii) {
      let clean = linie.replace(/^[•\-\*]\s*/, "");
      // Prima literă mare — convertim doar primul caracter alfabetic.
      clean = clean.charAt(0).toLocaleUpperCase("ro-RO") + clean.slice(1);
      const lines: string[] = doc.splitTextToSize(ro(clean), CW - padX * 2 - bulletIndent);
      doc.text("•", ML + padX, y + 3.5);
      doc.text(lines, ML + padX + bulletIndent, y + 3.5);
      y += lines.length * lineH;
    }
    y += 1;
  }

  // 1) Constatări — culoare albastră (informativ)
  if (r.constatari?.trim()) {
    y = drawFdlSectionHeader("CONSTATĂRI", [37, 99, 235]);
    drawFdlBullets(r.constatari);
    y += 2;
  }

  // 2) Sugestii / Recomandări — culoare portocalie (atenție client)
  if (r.sugestii?.trim()) {
    y = drawFdlSectionHeader("SUGESTII / RECOMANDĂRI", [234, 88, 12]);
    drawFdlBullets(r.sugestii);
    y += 2;
  }

  // 3) Produse și servicii — header colorat + tabel + totaluri (doar dacă există linii)
  if (r.items.length > 0) {
    y = drawFdlSectionHeader("PRODUSE ȘI SERVICII", [34, 197, 94]);
    y = drawItemsTable(doc, autoTable, r.items, y, tvaPct, ro);
    y = drawTotals(doc, r, y, tvaPct, r.items, { skipTopLine: true, inlineSubtotals: true });
  }

  // 4) Timp estimat manoperă
  if (r.timpEstimatOre != null && r.timpEstimatOre > 0) {
    hline(doc, y, C.veryLight, 0.1);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.black);
    doc.text(`Timp estimat manoperă: ${r.timpEstimatOre.toFixed(2)} ore`, ML, y);
    y += 5;
  }

  // 5) Observații libere (date_tehn) — opțional
  if (r.dateTehn?.trim()) {
    hline(doc, y, C.veryLight, 0.1);
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.black);
    doc.text("OBSERVATII", ML, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const dtl: string[] = doc.splitTextToSize(ro(r.dateTehn.trim()), CW);
    doc.text(dtl, ML, y);
    y += dtl.length * 4 + 1;
  }

  // Disclaimer specific FDL — text configurabil din Setări generale.
  // Dacă utilizatorul nu a personalizat textul (NULL în DB), folosim valoarea
  // default din generalSettingsStore. Suportă diacritice prin font NotoSans.
  const FDL_DEFAULT_DISCLAIMER =
    "Acest document reprezintă o estimare a costurilor și timpului de manoperă pe baza constatărilor inițiale. " +
    "Valorile sunt orientative și pot fi modificate la executarea efectivă a lucrării, în funcție de starea " +
    "reală a pieselor și descoperirile pe parcursul lucrului. Devizul final cu valorile reale se emite la " +
    "finalizarea lucrării.";
  const disclaimer = disclaimerText?.trim() || FDL_DEFAULT_DISCLAIMER;
  y = drawDisclaimer(doc, {
    title: "Document de estimare",
    text: disclaimer,
  }, y, ro, { compact: true });

  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y, { pinToBottom: true });
  await drawFooterWithBranding(doc, company?.website, { itemCount: r.items.length });

  doc.save(docFilename("fisa-de-lucru", r.titlu));
}

// ─── FACTURA ──────────────────────────────────────────────────────────────────

export async function generateFactura(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await enableRomanianFont(doc);
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const date = fmtDate(r.date);

  await drawBackground(doc, ctx.company?.background_path);

  const t = makeT(true);
  const client: ClientInfoForPdf = {
    clientNume: r.clientNume,
    clientCui: r.clientCui,
    clientReprezentant: r.clientReprezentant,
    clientAdresa: r.clientAdresa,
    clientTelefon: r.clientTelefon,
  };
  const veh = r.vehicol;
  const vehicleForPdf: VehiculForPdf | null = veh
    ? {
        numarMasina: veh.numarMasina,
        marca: veh.marca,
        model: veh.model,
        numarKilometrii: veh.numarKilometrii,
        anFabricatie: veh.anFabricatie,
        vin: veh.vin,
        observatii: veh.observatii,
      }
    : null;

  let y = await drawDocHeader3Col(
    doc, ctx.company ?? null, client, vehicleForPdf,
    { title: "FACTURA FISCALA", serie: ctx.serie, nr: ctx.nr, dateStr: date },
    t, "helvetica",
  ) + 4;

  y = drawItemsTable(doc, autoTable, r.items, y, tvaPct, ro);
  y = drawTotals(doc, r, y, tvaPct, r.items, { skipTopLine: true });

  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
    doc.text(`Modalitate plata: ${ro(r.metodaPlata)}`, ML, y);
    y += 5;
  }

  if (r.dueDate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
    doc.text(`Data scadenta: ${fmtDate(r.dueDate)}`, ML, y);
    y += 5;
  }

  y = drawDisclaimer(doc, ctx.disclaimer, y, ro);
  y = drawSignatures(doc, "Semnatura Angajat", "Semnatura Client", y);
  await drawFooterWithBranding(doc, ctx.company?.website, { itemCount: r.items.length });

  doc.save(docFilename("factura", r.titlu));
}

// ─── CHITANTA ────────────────────────────────────────────────────────────────

export async function generateChitanta(r: Receipt, ctx: DocContext): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await enableRomanianFont(doc);
  const tvaPct = ctx.company?.tva_percentage ?? 0;
  const totalFinal = r.total;
  const totalNet = totalFinal / (1 + tvaPct / 100);
  const tvaAmt = totalFinal - totalNet;
  const date = fmtDate(r.date);

  await drawBackground(doc, ctx.company?.background_path);

  // Chitanta ocupa numai jumatatea de sus a paginii A4 (~138mm inaltime).
  // Chenar exterior care incadreaza intregul continut, inclusiv logo-ul.
  const frameX = ML;
  const frameY = MT;
  const frameW = CW;
  const frameH = 138; // se opreste inainte de mijlocul paginii (148.5mm)
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.5);
  doc.rect(frameX, frameY, frameW, frameH);

  // padding intern in chenar
  const innerPad = 6;
  const innerX = frameX + innerPad;
  const innerW = frameW - 2 * innerPad;
  const centerX = frameX + frameW / 2;

  // Logo centrat sus, in interiorul chenarului
  const logoSize = 16;
  let y = frameY + innerPad;
  if (ctx.company?.logo_path) {
    try {
      const dataUrl = await loadImageAsDataUrl(ctx.company.logo_path);
      if (dataUrl) {
        doc.addImage(dataUrl, "PNG", centerX - logoSize / 2, y, logoSize, logoSize, undefined, "FAST");
      }
    } catch { /* ignore */ }
  }
  y += logoSize + 3;

  // Titlu CHITANȚĂ centrat (faux-bold via overprint, NotoSans nu are bold real)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.black);
  doc.text(ro("CHITANȚĂ"), centerX, y, { align: "center" });
  doc.text(ro("CHITANȚĂ"), centerX + 0.2, y, { align: "center" });
  y += 5;

  // Serie + Nr + Data, centrate pe acelasi rand
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  const nrStr = String(ctx.nr).padStart(5, "0");
  const meta = ctx.serie
    ? `Seria ${ctx.serie}   Nr. ${nrStr}   Data: ${date}`
    : `Nr. ${nrStr}   Data: ${date}`;
  doc.text(meta, centerX, y, { align: "center" });
  y += 5;

  // Linie despartitoare
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.2);
  doc.line(innerX, y, innerX + innerW, y);
  y += 4;

  // Casier + companie + "am primit de la" — propozitie compacta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  const companyName = ctx.company?.name ?? "-";
  const companyCui = ctx.company?.cui ? `, CUI ${ctx.company.cui}` : "";
  const introLine = ro(`Subsemnatul, casier al societății ${companyName}${companyCui}, am primit astăzi de la:`);
  const introLines: string[] = doc.splitTextToSize(introLine, innerW);
  doc.text(introLines, innerX, y);
  y += introLines.length * 4 + 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(ro(r.clientNume ?? "-"), innerX + 4, y);
  y += 4.5;
  if (r.clientTip === "juridic" && r.clientCui) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`CUI: ${r.clientCui}`, innerX + 4, y);
    y += 4.5;
  }

  y += 1;
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.2);
  doc.line(innerX, y, innerX + innerW, y);
  y += 4.5;

  // Suma de
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(ro("suma de:"), innerX, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const sumaX = innerX + 20;
  doc.text(lei(totalFinal), sumaX, y);
  doc.text(lei(totalFinal), sumaX + 0.2, y); // overprint faux-bold
  y += 5.5;

  // In litere
  const inLitere = sumInLitere(totalFinal);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const litereLines: string[] = doc.splitTextToSize(ro(`(adică ${inLitere})`), innerW);
  doc.text(litereLines, innerX, y);
  y += litereLines.length * 3.8 + 1;

  // TVA breakdown verbos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const tvaLine = ro(`din care: valoare netă ${lei(totalNet)} + TVA ${tvaPct}% în valoare de ${lei(tvaAmt)}.`);
  const tvaLines: string[] = doc.splitTextToSize(tvaLine, innerW);
  doc.text(tvaLines, innerX, y);
  y += tvaLines.length * 4 + 2;

  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.2);
  doc.line(innerX, y, innerX + innerW, y);
  y += 4.5;

  // Reprezentand
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ro("reprezentând contravaloarea:"), innerX, y);
  y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const repLines: string[] = doc.splitTextToSize(ro(r.titlu), innerW - 4);
  doc.text(repLines, innerX + 4, y);
  y += repLines.length * 4.5 + 2;

  if (r.metodaPlata) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(ro(`Modalitate de plată: ${r.metodaPlata}`), innerX, y);
    y += 4.5;
  }

  if (r.facturaNr > 0) {
    const facturaRef = r.facturaSerie
      ? `${r.facturaSerie}${r.facturaNr}`
      : `${r.facturaNr}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const prefix = ro("Achitată conform facturii nr. ");
    doc.text(prefix, innerX, y);
    const prefixW = doc.getTextWidth(prefix);
    doc.setFont("helvetica", "bold");
    doc.text(facturaRef, innerX + prefixW, y);
    y += 4.5;
  }

  // Footer in chenar: semnatura casier (stanga) + date companie (dreapta)
  const colW = (innerW - 10) / 2;
  const col2X = innerX + colW + 10;
  // Plasam blocul jos in chenar, lasand 10mm pana la marginea de jos
  const footerY = frameY + frameH - innerPad - 10;

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.3);
  doc.line(innerX, footerY, innerX + colW, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text(ro("Semnătura și ștampila casierului"), innerX, footerY + 3.5);

  if (ctx.company) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.black);
    doc.text(ro(ctx.company.name), col2X, footerY - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    let cy = footerY - 3.5;
    if (ctx.company.cui) { doc.text(`CUI: ${ctx.company.cui}`, col2X, cy); cy += 4; }
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

export interface CazareForPdf {
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
      dotValoare?: string | null;
      tip: string;
      adancime: number | null;
      indiceViteza?: string | null;
      indiceSarcina?: number | null;
    } | null;
  }>;
  items: Array<{
    anvelopa: {
      marcaNume: string | null;
      dimensiuneValoare: string | null;
      profilValoare?: string | null;
      dotValoare?: string | null;
      tip: string;
      adancime: number | null;
      indiceViteza?: string | null;
      indiceSarcina?: number | null;
    } | null;
  }>;
}

const TIP_PDF_LABELS: Record<string, string> = {
  iarna: "Iarna",
  vara: "Vara",
  ms: "M+S",
  altele: "Altele",
};

interface AnvelopaForTable {
  marcaNume: string | null;
  dimensiuneValoare: string | null;
  profilValoare?: string | null;
  dotValoare?: string | null;
  tip: string;
  adancime: number | null;
  indiceViteza?: string | null;
  indiceSarcina?: number | null;
}

interface AnvelopaTableConfig {
  head: string[][];
  body: string[][];
  columnStyles: Record<number, Record<string, unknown>>;
}

/** Construieste configul autoTable pentru tabelul de anvelope, omitand coloanele
 *  unde nici o intrare nu are valoare (ex: daca nici un rand nu are DOT, coloana
 *  DOT nu apare). Coloana # e mereu prezenta. */
function buildAnvelopaTable(
  items: AnvelopaForTable[],
  t: (s: string | null | undefined) => string,
  widths: { dim: number; dot: number; profil: number; tip: number; adancime: number; indice?: number },
): AnvelopaTableConfig {
  const hasMarca    = items.some((a) => !!a.marcaNume?.trim());
  const hasDim      = items.some((a) => !!a.dimensiuneValoare?.trim());
  const hasDot      = items.some((a) => !!a.dotValoare?.trim());
  const hasProfil   = items.some((a) => !!a.profilValoare?.trim());
  const hasTip      = items.some((a) => !!a.tip?.trim() && (TIP_PDF_LABELS[a.tip] ?? a.tip) !== "");
  const hasAdancime = items.some((a) => a.adancime != null);
  const hasIndice   = items.some((a) => fmtIndiceVitezaSarcina(a.indiceViteza, a.indiceSarcina) != null);

  const cols: Array<{ head: string; cell: (a: AnvelopaForTable, idx: number) => string; style: Record<string, unknown> }> = [];
  cols.push({ head: "#", cell: (_a, idx) => String(idx + 1), style: { halign: "center", cellWidth: 8 } });
  if (hasMarca)    cols.push({ head: "Marcă",      cell: (a) => t(a.marcaNume ?? "—"),                             style: { cellWidth: "auto" } });
  if (hasDim)      cols.push({ head: "Dimensiune", cell: (a) => t(a.dimensiuneValoare ?? "—"),                     style: { cellWidth: widths.dim } });
  if (hasDot)      cols.push({ head: "DOT",        cell: (a) => t(a.dotValoare ?? "—"),                            style: { halign: "center", cellWidth: widths.dot } });
  if (hasProfil)   cols.push({ head: "Profil",     cell: (a) => t(a.profilValoare ?? "—"),                         style: { halign: "center", cellWidth: widths.profil } });
  if (hasTip)      cols.push({ head: "Tip",        cell: (a) => TIP_PDF_LABELS[a.tip] ?? a.tip,                    style: { halign: "center", cellWidth: widths.tip } });
  if (hasAdancime) cols.push({ head: "Adâncime",   cell: (a) => a.adancime != null ? `${a.adancime} mm` : "—",     style: { halign: "center", cellWidth: widths.adancime } });
  if (hasIndice)   cols.push({ head: "Ind. V/S",   cell: (a) => fmtIndiceVitezaSarcina(a.indiceViteza, a.indiceSarcina) ?? "—", style: { halign: "center", cellWidth: widths.indice ?? 16 } });

  const head = [cols.map((c) => c.head)];
  const body = items.map((a, idx) => cols.map((c) => c.cell(a, idx)));
  const columnStyles: Record<number, Record<string, unknown>> = {};
  cols.forEach((c, i) => { columnStyles[i] = c.style; });
  return { head, body, columnStyles };
}

export interface VehiculForPdf {
  numarMasina: string | null;
  marca?: string | null;
  model?: string | null;
  numarKilometrii?: number | null;
  anFabricatie?: number | null;
  vin?: string | null;
  observatii?: string | null;
}

const CARD_PAD = 3.5;
const CARD_BORDER: [number, number, number] = [180, 180, 180];
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
  if (veh.anFabricatie != null)  h += 3.5;
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
  if (veh.anFabricatie != null)    { doc.text(`An fab.: ${veh.anFabricatie}`, x, y); y += 3.5; }
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

/** Top section: Prestator card (left col) + Client + optional Vehicle cards (right col).
 *
 *  Cu `opts.clientVehiculInline` = true, Client si Vehicul sunt asezate alaturat
 *  (split pe coloana dreapta), nu stivuit vertical.
 */
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
  opts?: { clientVehiculInline?: boolean },
): number {
  const innerW = bw - CARD_PAD * 2;
  const hasClient = !!(
    client.clientNume?.trim() ||
    client.clientCui?.trim() ||
    client.clientReprezentant?.trim() ||
    client.clientAdresa?.trim() ||
    client.clientTelefon?.trim()
  );
  // Functiile de masurare insumeaza incrementele de linie inclusiv pe cel de DUPA ultima
  // linie (pregatit pentru "urmatoarea linie", care nu exista). Scadem acel increment
  // (3.5mm pentru 7.5pt) ca sa nu apara un rand gol vizibil in josul cardului.
  const trailingLineGap = 3.5;
  const compH = Math.max(0, _measureCompanyContent(doc, company, innerW, font) - trailingLineGap);
  const compCardH = compH + CARD_PAD * 2;

  // Layout inline: Client si Vehicul lipite pe coloana dreapta (jumatate-jumatate).
  if (opts?.clientVehiculInline && hasClient && vehicle) {
    const subGap = 2;
    const subW = (bw - subGap) / 2;
    const subInnerW = subW - CARD_PAD * 2;
    const clientH = Math.max(0, _measureClientContent(doc, client, subInnerW, t, font) - trailingLineGap);
    const vehH    = Math.max(0, _measureVehiculContent(doc, vehicle, subInnerW, t, font) - trailingLineGap);
    const subCardH = Math.max(clientH, vehH) + CARD_PAD * 2;
    const blockH = Math.max(compCardH, subCardH);

    drawCard(doc, leftX, y, bw, compCardH);
    drawCompanyBlockFont(doc, "Prestator", company, leftX + CARD_PAD, y + CARD_PAD, innerW, font);

    drawCard(doc, rightX, y, subW, subCardH);
    drawCazareClientBlock(doc, client, rightX + CARD_PAD, y + CARD_PAD, subInnerW, t, font);

    const vehX = rightX + subW + subGap;
    drawCard(doc, vehX, y, subW, subCardH);
    drawVehiculBlock(doc, vehicle, vehX + CARD_PAD, y + CARD_PAD, subInnerW, t, font);

    return y + blockH;
  }

  // Layout default (stivuit): Client deasupra, Vehicul dedesubt.
  const clientH  = hasClient ? Math.max(0, _measureClientContent(doc, client, innerW, t, font) - trailingLineGap) : 0;
  const vehH     = vehicle ? Math.max(0, _measureVehiculContent(doc, vehicle, innerW, t, font) - trailingLineGap) : 0;

  const clientCardH = hasClient ? clientH + CARD_PAD * 2 : 0;
  const vehCardH    = vehicle ? vehH + CARD_PAD * 2 : 0;
  const rightStackH = clientCardH + (hasClient && vehicle ? CARDS_GAP_Y : 0) + vehCardH;
  const blockH = Math.max(compCardH, rightStackH);

  drawCard(doc, leftX, y, bw, compCardH);
  drawCompanyBlockFont(doc, "Prestator", company, leftX + CARD_PAD, y + CARD_PAD, innerW, font);

  if (hasClient) {
    drawCard(doc, rightX, y, bw, clientCardH);
    drawCazareClientBlock(doc, client, rightX + CARD_PAD, y + CARD_PAD, innerW, t, font);
  }

  if (vehicle) {
    const vY = y + (hasClient ? clientCardH + CARDS_GAP_Y : 0);
    drawCard(doc, rightX, vY, bw, vehCardH);
    drawVehiculBlock(doc, vehicle, rightX + CARD_PAD, vY + CARD_PAD, innerW, t, font);
  }

  return y + blockH;
}

/** Header 3 coloane pentru Deviz / Factura / Montare Roți:
 *  Prestator (stanga) | Logo + titlu (16pt) + Serie/Nr + Data (mijloc) |
 *  Client + Vehicul inline (dreapta). Serie/Nr trec prin splitTextToSize ca sa
 *  nu deborde middleW cand seria + numarul sunt lungi.
 *  Returneaza y-ul de la baza headerului. */
async function drawDocHeader3Col(
  doc: any,
  company: any,
  client: ClientInfoForPdf,
  vehicle: VehiculForPdf | null,
  opts: { title: string; serie?: string; nr: number | string; dateStr: string; middleW?: number },
  t: (s: string | null | undefined) => string,
  FONT: string,
): Promise<number> {
  const middleW = opts.middleW ?? 34;
  const sideGap = 5;
  const sideW = (CW - middleW - 2 * sideGap) / 2;
  const leftX = ML;
  const middleX = ML + sideW + sideGap;
  const rightX = middleX + middleW + sideGap;

  const logoSize = 20;
  const logoX = middleX + (middleW - logoSize) / 2;
  const logoY = MT;
  if (company?.logo_path) {
    try {
      const dataUrl = await loadImageAsDataUrl(company.logo_path);
      if (dataUrl) {
        doc.addImage(dataUrl, "PNG", logoX, logoY, logoSize, logoSize, undefined, "FAST");
      }
    } catch { /* ignore */ }
  }

  let midY = logoY + logoSize + 4;
  const midCenterX = middleX + middleW / 2;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.black);
  const titleLines: string[] = doc.splitTextToSize(t(opts.title), middleW);
  doc.text(titleLines, midCenterX, midY, { align: "center" });
  midY += titleLines.length * 6;

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.black);
  const nrTxt = String(opts.nr).padStart(2, "0");
  const serieNr = opts.serie ? `Serie: ${opts.serie}   Nr.: ${nrTxt}` : `Nr.: ${nrTxt}`;
  const serieLines: string[] = doc.splitTextToSize(serieNr, middleW);
  doc.text(serieLines, midCenterX, midY, { align: "center" });
  midY += serieLines.length * 4;
  doc.text(`Data: ${opts.dateStr}`, midCenterX, midY, { align: "center" });
  midY += 2;

  const cardsBottomY = drawCazareTopCards(
    doc, company ?? null, client, vehicle, leftX, rightX, MT, sideW, t, FONT,
    { clientVehiculInline: true },
  );

  return Math.max(midY, cardsBottomY);
}

/** Header 3 coloane pentru documentele de Hotel Anvelope, in stilul Deviz:
 *  Prestator (stanga) | Logo + titlu + Nr/Data (mijloc) | Client + Vehicul inline (dreapta).
 *  Returneaza y-ul de la baza headerului. */
async function drawCazareHeader3Col(
  doc: any,
  company: any,
  client: ClientInfoForPdf,
  vehicle: VehiculForPdf | null,
  subtitle: string,
  idNumber: number,
  dateStr: string,
  t: (s: string | null | undefined) => string,
  FONT: string,
): Promise<number> {
  const middleW = 50;
  const sideGap = 5;
  const sideW = (CW - middleW - 2 * sideGap) / 2;
  const leftX = ML;
  const middleX = ML + sideW + sideGap;
  const rightX = middleX + middleW + sideGap;

  const logoSize = 20;
  const logoX = middleX + (middleW - logoSize) / 2;
  const logoY = MT;
  if (company?.logo_path) {
    try {
      const dataUrl = await loadImageAsDataUrl(company.logo_path);
      if (dataUrl) {
        doc.addImage(dataUrl, "PNG", logoX, logoY, logoSize, logoSize, undefined, "FAST");
      }
    } catch { /* ignore */ }
  }

  let midY = logoY + logoSize + 4;
  const midCenterX = middleX + middleW / 2;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.black);
  doc.text(t("PROCES VERBAL"), midCenterX, midY, { align: "center" });
  midY += 5;

  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  const subtitleLines: string[] = doc.splitTextToSize(t(subtitle), middleW);
  doc.text(subtitleLines, midCenterX, midY, { align: "center" });
  midY += subtitleLines.length * 4 + 1;

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.text(`Nr.: ${String(idNumber).padStart(2, "0")}`, midCenterX, midY, { align: "center" });
  midY += 4;
  doc.text(`Data: ${dateStr}`, midCenterX, midY, { align: "center" });
  midY += 3;

  const cardsBottomY = drawCazareTopCards(
    doc, company ?? null, client, vehicle, leftX, rightX, MT, sideW, t, FONT,
    { clientVehiculInline: true },
  );

  return Math.max(midY, cardsBottomY);
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

  await enableRomanianFont(doc);
  const FONT = "helvetica";
  const t = makeT(true);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);

  let y = await drawCazareHeader3Col(
    doc, company ?? null, cazare, vehicle,
    "Cazare", cazare.id, fmtDate(cazare.dataCheckin), t, FONT,
  ) + 3;

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
  const vehMakeModelIn = [vehicle?.marca, vehicle?.model].filter(Boolean).join(" ").trim();
  const vehLabelIn = [cazare.numarMasina, vehMakeModelIn].filter((x) => x && x !== "").join(" - ");
  if (vehLabelIn) { doc.text(`Vehicul: ${t(vehLabelIn)}`, col1X, yL); yL += 4.5; }
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

  const tireItems = cazare.items
    .filter((item) => item.anvelopa != null)
    .map((item) => item.anvelopa!);
  const tireTable = buildAnvelopaTable(tireItems, t, { dim: 24, dot: 16, profil: 20, tip: 12, adancime: 16 });

  if (tireTable.body.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: tireTable.head,
      body: tireTable.body,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: marineGreen, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: tireTable.columnStyles,
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = lastTableY(doc);
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

    const oldAnvelope = (cazare.referintaCazareItems ?? [])
      .filter((i) => i.anvelopa != null)
      .map((i) => i.anvelopa!);
    if (oldAnvelope.length > 0) {
      const oldTable = buildAnvelopaTable(oldAnvelope, t, { dim: 24, dot: 18, profil: 22, tip: 16, adancime: 20 });
      autoTable(doc, {
        startY: y,
        head: oldTable.head,
        body: oldTable.body,
        theme: "grid",
        styles: { font: FONT },
        headStyles: { fillColor: refColor, textColor: 255, fontSize: 7, fontStyle: "bold", cellPadding: 2 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: oldTable.columnStyles,
        margin: { left: ML, right: MR },
        tableWidth: CW,
      });
      y = lastTableY(doc) + 3;
    }
    y += 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website, { itemCount: tireItems.length });

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

  await enableRomanianFont(doc);
  const FONT = "helvetica";
  const t = makeT(true);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);

  // Header — folosim clientul cazării noi (destinatarul documentului); dacă scoaterea
  // se face de la alt client, acel client e menționat explicit în secțiunea SCOATERE.
  const differentClient =
    (checkoutCazare.clientNume ?? "").trim() !== "" &&
    (newCazare.clientNume ?? "").trim() !== "" &&
    (checkoutCazare.clientNume ?? "").trim() !== (newCazare.clientNume ?? "").trim();

  let y = await drawCazareHeader3Col(
    doc, company ?? null, newCazare, vehicle,
    "Scoatere și cazare nouă", checkoutCazare.id, fmtDate(checkoutDate), t, FONT,
  ) + 3;

  hline(doc, y);
  y += 6;

  // ─── Section 1: SCOATERE DIN CAZARE (dark navy blue) ───────────────────────
  const navyBlue: [number, number, number] = [30, 58, 138];

  setF("bold", 10);
  doc.setTextColor(...navyBlue);
  doc.text("SCOATERE DIN CAZARE", ML, y);
  y += 5;

  // Notă: anvelopele scoase aparțin altui client decât destinatarul documentului
  if (differentClient) {
    setF("bold", 9);
    doc.setTextColor(...navyBlue);
    const ownerLines: string[] = doc.splitTextToSize(
      `Anvelopele au fost scoase de la clientul: ${t(checkoutCazare.clientNume ?? "")}`,
      CW,
    );
    doc.text(ownerLines, ML, y);
    y += ownerLines.length * 4 + 2;
    doc.setTextColor(...C.black);
  }

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
  const vehMakeModelOut = [vehicle?.marca, vehicle?.model].filter(Boolean).join(" ").trim();
  const vehPlateOut = checkoutCazare.numarMasina ?? newCazare.numarMasina ?? null;
  const vehLabelOut = [vehPlateOut, vehMakeModelOut].filter((x) => x && x !== "").join(" - ");
  if (vehLabelOut) { doc.text(`Vehicul: ${t(vehLabelOut)}`, col1X, yL); yL += 4.5; }
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

  const checkoutAnvelope = checkoutCazare.items
    .filter((item) => item.anvelopa != null)
    .map((item) => item.anvelopa!);
  const checkoutTable = buildAnvelopaTable(checkoutAnvelope, t, { dim: 24, dot: 16, profil: 20, tip: 12, adancime: 16 });

  if (checkoutTable.body.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: checkoutTable.head,
      body: checkoutTable.body,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: navyBlue, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: checkoutTable.columnStyles,
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = lastTableY(doc);
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
  const vehPlateNew = newCazare.numarMasina ?? checkoutCazare.numarMasina ?? null;
  const vehLabelNew = [vehPlateNew, vehMakeModelOut].filter((x) => x && x !== "").join(" - ");
  if (vehLabelNew) { doc.text(`Vehicul: ${t(vehLabelNew)}`, col1X, yL2); yL2 += 4.5; }
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
  const newAnvelope = newCazare.items
    .filter((item) => item.anvelopa != null)
    .map((item) => item.anvelopa!);
  const newTable = buildAnvelopaTable(newAnvelope, t, { dim: 24, dot: 16, profil: 20, tip: 12, adancime: 16 });

  if (newTable.body.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: newTable.head,
      body: newTable.body,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: marineGreen, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: newTable.columnStyles,
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = lastTableY(doc);
    const tableH = tableEndY - tableStartY;

    await drawSideImage(doc, images?.cazare ?? null, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website, { itemCount: checkoutAnvelope.length + newAnvelope.length });

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

  await enableRomanianFont(doc);
  const FONT = "helvetica";
  const t = makeT(true);
  doc.setFont(FONT, "normal");

  const setF = (style: "normal" | "bold", size: number) => {
    doc.setFont(FONT, style);
    doc.setFontSize(size);
  };

  await drawBackground(doc, company?.background_path);

  const checkoutDate = cazare.dataCheckout ?? new Date().toISOString().slice(0, 10);

  let y = await drawCazareHeader3Col(
    doc, company ?? null, cazare, vehicle,
    "Scoatere din cazare", cazare.id, fmtDate(checkoutDate), t, FONT,
  ) + 3;

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
  const vehMakeModel = [vehicle?.marca, vehicle?.model].filter(Boolean).join(" ").trim();
  const vehLabel = [cazare.numarMasina, vehMakeModel].filter((x) => x && x !== "").join(" - ");
  if (vehLabel) { doc.text(`Vehicul: ${t(vehLabel)}`, col1X, yL); yL += 4.5; }
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

  const checkoutAnvelope = cazare.items
    .filter((item) => item.anvelopa != null)
    .map((item) => item.anvelopa!);
  const checkoutTable = buildAnvelopaTable(checkoutAnvelope, t, { dim: 24, dot: 16, profil: 20, tip: 12, adancime: 16 });

  if (checkoutTable.body.length > 0) {
    const tableStartY = y;
    autoTable(doc, {
      startY: y,
      head: checkoutTable.head,
      body: checkoutTable.body,
      theme: "grid",
      styles: { font: FONT, fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: navyBlue, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: checkoutTable.columnStyles,
      margin: { left: ML, right: MR + SIDE_IMG_W + SIDE_GAP },
      tableWidth: tableW,
    });
    const tableEndY = lastTableY(doc);
    const tableH = tableEndY - tableStartY;

    const sideUrl = images?.scoatere ?? images?.montare ?? null;
    await drawSideImage(doc, sideUrl, ML + tableW + SIDE_GAP, tableStartY, SIDE_IMG_W, tableH);

    y = tableEndY + 4;
  }

  y = drawSignatures(doc, "Semnătură Prestator", "Semnătură Client", y);
  await drawFooterWithBranding(doc, company?.website, { itemCount: checkoutAnvelope.length });

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
  dotValoare: string | null;
  tip: string;
  adancime: number | null;
  cupluStrangere: number | null;
  indiceViteza?: string | null;
  indiceSarcina?: number | null;
  /** URL pentru imaginea specifica acestei pozitii (folosit in cardul din PDF). */
  imageUrl?: string | null;
}

/** Format "H98" combinand indicele de viteza (litera) cu cel de sarcina (numar).
 *  Returneaza null daca ambele lipsesc. */
function fmtIndiceVitezaSarcina(iv: string | null | undefined, is: number | null | undefined): string | null {
  const v = iv != null && iv !== "" ? iv : "";
  const s = is != null ? String(is) : "";
  if (!v && !s) return null;
  return `${v}${s}`;
}

const _POZITIE_LABELS_PDF: Record<string, string> = {
  dreapta_fata: "Dreapta Față",
  stanga_fata: "Stânga Față",
  dreapta_spate: "Dreapta Spate",
  stanga_spate: "Stânga Spate",
  rezerva: "Rezervă",
  nespecificat: "Nespecificat",
};

/** Are macar un camp completat de utilizator (marca / dimensiune / profil /
 *  presiune / adancime / cuplu)? Bonurile importate din legacy au adesea doar
 *  presiune/adancime/tip salvate cu defaults — vrem totusi sa apara in PDF. */
function _montajRotaHasData(r: MontajRotaRow): boolean {
  return (
    (r.marcaNume != null && r.marcaNume !== "") ||
    (r.dimensiuneValoare != null && r.dimensiuneValoare !== "") ||
    (r.profilValoare != null && r.profilValoare !== "") ||
    (r.dotValoare != null && r.dotValoare !== "") ||
    r.presiune != null ||
    r.adancime != null ||
    r.cupluStrangere != null ||
    (r.indiceViteza != null && r.indiceViteza !== "") ||
    r.indiceSarcina != null
  );
}

/** Card cu imagine + text pentru pozitiile principale; imagineSide = "left" sau "right".
 *  Textul e aliniat catre imagine (in oglinda fata de pozitia roti in masina).
 *  Daca rotata nu are date completate, deseneaza doar imaginea.
 *
 *  Imaginea se extinde pana la marginile exterioare ale cardului (sus, jos, si latura
 *  catre cardul vecin) pentru ca imaginile cardurilor adiacente sa fie lipite unele de
 *  altele, fara spatiu intre ele. Doar latura dinspre text are un mic padding. */
async function drawMontajRotaCard(
  doc: any,
  r: MontajRotaRow,
  x: number, y: number, w: number, h: number,
  imageSide: "left" | "right",
  gridRow: "top" | "bottom",
  t: (s: string | null | undefined) => string,
  FONT: string,
): Promise<void> {
  const navyBlue: [number, number, number] = [30, 58, 138];
  const imgW = Math.min(40, w * 0.42);
  const innerPad = 2; // spatiu intre imagine si text (in interiorul cardului)
  // Imaginea se intinde pe lateral pana la marginea exterioara (lipita de cardul vecin)
  // si vertical pana la marginile de sus/jos.
  const imgX = imageSide === "left" ? x : x + w - imgW + innerPad;
  const imgBoxW = imgW - innerPad;
  const textX = imageSide === "left" ? x + imgW : x;
  const textW = w - imgW;
  // Text aliniat catre imagine
  const align: "left" | "right" = imageSide === "left" ? "left" : "right";
  const anchorX = align === "right" ? textX + textW : textX;

  // Imagine — aspect ratio pastrat, aliniata catre coltul interior al cardului (spre
  // cardul vecin pe orizontala si verticala). Asta face ca imaginile cardurilor adiacente
  // sa fie lipite fara distorsionare; eventualul "whitespace" din aspect-ratio ajunge
  // pe partea exterioara (lipita de marginea paginii sau de zona de text), nu intre carduri.
  if (r.imageUrl) {
    const loaded = await fetchImageAsDataUrl(r.imageUrl);
    if (loaded) {
      const fmt = loaded.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      const boxW = imgBoxW;
      const boxH = h;
      const ratio = loaded.w / loaded.h;
      let iw = boxW;
      let ih = iw / ratio;
      if (ih > boxH) { ih = boxH; iw = ih * ratio; }
      // Aliniere orizontala: imaginea spre interior (cardul vecin de pe acelasi rand)
      const px = imageSide === "right"
        ? imgX + (boxW - iw)   // align right (catre dreapta cardului)
        : imgX;                 // align left (catre stanga cardului)
      // Aliniere verticala: imaginea spre interior (cardul vecin de pe celalalt rand)
      const py = gridRow === "top"
        ? y + (boxH - ih)       // randul de sus → imagine la baza casetei
        : y;                    // randul de jos → imagine in partea de sus a casetei
      try {
        doc.addImage(loaded.dataUrl, fmt, px, py, iw, ih, undefined, "FAST");
      } catch { /* ignore */ }
    }
  }

  // Daca rotata nu are date, randam pozitia + textul "Nu s-a executat montajul roții"
  if (!_montajRotaHasData(r)) {
    let ty = y + 4.5;
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...navyBlue);
    doc.text(t(_POZITIE_LABELS_PDF[r.pozitie] ?? r.pozitie), anchorX, ty, { align });
    ty += 6;
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    const msg = t("Nu s-a executat montajul roții");
    const lines = doc.splitTextToSize(msg, textW) as string[];
    doc.text(lines, anchorX, ty, { align });
    return;
  }

  let ty = y + 4.5;

  // Titlu pozitie
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navyBlue);
  doc.text(t(_POZITIE_LABELS_PDF[r.pozitie] ?? r.pozitie), anchorX, ty, { align });
  ty += 5;

  // Marca (bold)
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  const marcaLines = doc.splitTextToSize(t(r.marcaNume ?? "—"), textW) as string[];
  doc.text(marcaLines, anchorX, ty, { align });
  ty += Math.max(1, marcaLines.length) * 4.2;

  // Dimensiune — splitTextToSize forțează încadrarea în lățimea de text (`textW`).
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  const dim = t(r.dimensiuneValoare ?? "—");
  const dimLines = doc.splitTextToSize(dim, textW) as string[];
  doc.text(dimLines, anchorX, ty, { align });
  ty += Math.max(1, dimLines.length) * 3.6;

  // Profil
  if (r.profilValoare) {
    const profilLines = doc.splitTextToSize(`Profil: ${t(r.profilValoare)}`, textW) as string[];
    doc.text(profilLines, anchorX, ty, { align });
    ty += Math.max(1, profilLines.length) * 3.6;
  }

  // DOT
  if (r.dotValoare) {
    const dotLines = doc.splitTextToSize(`DOT: ${t(r.dotValoare)}`, textW) as string[];
    doc.text(dotLines, anchorX, ty, { align });
    ty += Math.max(1, dotLines.length) * 3.6;
  }

  // Tip
  const tipLines = doc.splitTextToSize(`Tip: ${t(TIP_PDF_LABELS[r.tip] ?? r.tip)}`, textW) as string[];
  doc.text(tipLines, anchorX, ty, { align });
  ty += Math.max(1, tipLines.length) * 4.5;

  // Adancime / Presiune / Cuplu — label bold + valoare normal, aliniate catre imagine
  doc.setTextColor(...C.black);
  const drawKV = (label: string, value: string) => {
    doc.setFontSize(7.5);
    const lblText = `${label}: `;
    doc.setFont(FONT, "bold");
    const lblW = doc.getTextWidth(lblText);
    doc.setFont(FONT, "normal");
    const valW = doc.getTextWidth(value);
    const startX = align === "right" ? anchorX - lblW - valW : textX;
    doc.setFont(FONT, "bold");
    doc.text(lblText, startX, ty);
    doc.setFont(FONT, "normal");
    doc.text(value, startX + lblW, ty);
    ty += 3.8;
  };
  if (r.adancime != null) drawKV(t("Adâncime"), `${r.adancime} mm`);
  if (r.presiune != null) drawKV("Presiune", `${r.presiune.toFixed(1)} bar`);
  if (r.cupluStrangere != null) drawKV("Cuplu", `${r.cupluStrangere} Nm`);
  const indVitSarc = fmtIndiceVitezaSarcina(r.indiceViteza, r.indiceSarcina);
  if (indVitSarc) drawKV(t("Indice Viteză/Sarcină"), indVitSarc);
}

/** Rand text-only pentru Rezerva / Nespecificat: titlu bold + detalii in propozitie
 *  cu virgula (fara imagine, full-width). */
function drawMontajRotaRowTextOnly(
  doc: any,
  r: MontajRotaRow,
  x: number, y: number, w: number,
  t: (s: string | null | undefined) => string,
  FONT: string,
): number {
  const navyBlue: [number, number, number] = [30, 58, 138];
  const pad = 2;
  const lineY = y + 3.5;

  // Masuram titlul (bold, navy)
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  const title = `${t(_POZITIE_LABELS_PDF[r.pozitie] ?? r.pozitie)}:`;
  const titleW = doc.getTextWidth(title);

  // Detalii ca propozitie cu virgula
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  const parts: string[] = [];
  if (r.marcaNume) parts.push(t(r.marcaNume));
  if (r.dimensiuneValoare) parts.push(`dimensiune ${t(r.dimensiuneValoare)}`);
  if (r.profilValoare) parts.push(`profil ${t(r.profilValoare)}`);
  if (r.dotValoare) parts.push(`DOT ${t(r.dotValoare)}`);
  parts.push(`tip ${t(TIP_PDF_LABELS[r.tip] ?? r.tip)}`);
  if (r.adancime != null) parts.push(`${t("adâncime")} ${r.adancime} mm`);
  if (r.presiune != null) parts.push(`presiune ${r.presiune.toFixed(1)} bar`);
  const indVitSarc = fmtIndiceVitezaSarcina(r.indiceViteza, r.indiceSarcina);
  if (indVitSarc) parts.push(`${t("indice viteză/sarcină")} ${indVitSarc}`);
  const sentence = parts.length > 0 ? parts.join(", ") + "." : "—";

  // Daca incape totul pe un singur rand, centram orizontal title + sentence.
  const sentenceW = doc.getTextWidth(sentence);
  const inlineW = titleW + 2 + sentenceW;
  const usableW = w - 2 * pad;

  if (inlineW <= usableW) {
    const startX = x + (w - inlineW) / 2;
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...navyBlue);
    doc.text(title, startX, lineY);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.black);
    doc.text(sentence, startX + titleW + 2, lineY);
    return lineY + 2;
  }

  // Fallback: titlu stanga, sentence wrap pe restul latimii (left-aligned).
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navyBlue);
  doc.text(title, x + pad, lineY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  const dx = x + pad + titleW + 2;
  const maxW = w - (dx - x) - pad;
  const lines = doc.splitTextToSize(sentence, maxW) as string[];
  doc.text(lines, dx, lineY);
  return lineY + (lines.length - 1) * 3.6 + 2;
}

/** Estimeaza inaltimea pe care o va ocupa corpul Montare Roti, ca sa decidem
 *  daca incape pe pagina curenta sau trebuie pe pagina noua. */
function estimateMontajRotiBodyHeight(rows: MontajRotaRow[]): number {
  const byPoz: Partial<Record<string, MontajRotaRow>> = {};
  for (const row of rows) {
    if (!(row.pozitie in byPoz)) byPoz[row.pozitie] = row;
  }
  const hasMainWheels = !!(byPoz.stanga_fata || byPoz.dreapta_fata || byPoz.stanga_spate || byPoz.dreapta_spate);
  let totalH = 0;
  if (hasMainWheels) {
    const cardH = 42;
    const gridH = cardH * 2;
    // Coloana dreapta (Conditii + 2 paragrafe + Atentie la 6.5pt pe ~43mm) — estimat conservativ.
    const rightH = 55;
    totalH = Math.max(gridH, rightH);
  }
  if (byPoz.rezerva) totalH += 6;
  if (byPoz.nespecificat) totalH += 6;
  return totalH;
}

/** Corpul PDF-ului Montare Roți: grid 2x2 cu carduri (stanga 75%) +
 *  text Conditii Tehnice + Atentie (dreapta 25%) + Rezerva/Nespecificat full-width.
 *  Nu deseneaza header, top cards, hline-uri sau footer — folosit atat in
 *  PDF-ul standalone cat si ca anexa la sfarsitul Devizului. */
async function drawMontajRotiBody(
  doc: any,
  rows: MontajRotaRow[],
  y: number,
  t: (s: string | null | undefined) => string,
  FONT: string,
): Promise<number> {
  const byPoz: Partial<Record<string, MontajRotaRow>> = {};
  for (const row of rows) {
    if (!(row.pozitie in byPoz)) byPoz[row.pozitie] = row;
  }

  const hasMainWheels = !!(byPoz.stanga_fata || byPoz.dreapta_fata || byPoz.stanga_spate || byPoz.dreapta_spate);

  if (hasMainWheels) {
    // Layout 2 coloane (75/25): stanga = grid 2x2 cu roti, dreapta = text Conditii Tehnice + Atentie.
    const colGapMain = 6;
    const leftW = (CW - colGapMain) * 0.75;
    const rightW = (CW - colGapMain) * 0.25;
    const leftHalfX = ML;
    const rightHalfX = ML + leftW + colGapMain;

    // Grid stanga: cardurile sunt lipite intre ele (fara spatii) pentru ca imaginile
    // cardurilor adiacente sa fie aliniate edge-to-edge.
    const colGap = 0;
    const rowGap = 0;
    const cardW = (leftW - colGap) / 2;
    const cardH = 42;

    const gridStartY = y;
    let leftY = gridStartY;

    // URL-urile imaginilor per-pozitie au pattern fix (`.../image/<pozitie>`);
    // extragem baza dintr-un rand existent ca sa putem popula imaginea si la
    // pozitiile lipsa (cele cu placeholder "Nu s-a executat").
    let urlBase: string | null = null;
    for (const r of rows) {
      if (r.imageUrl) {
        const idx = r.imageUrl.lastIndexOf("/");
        if (idx > 0) { urlBase = r.imageUrl.slice(0, idx + 1); break; }
      }
    }

    // Toate cele 4 pozitii principale sunt mereu randate; pentru cele lipsa/empty
    // afisam un card-placeholder cu "Nu s-a executat montajul roții".
    const rowFor = (pozitie: string): MontajRotaRow => byPoz[pozitie] ?? {
      pozitie,
      presiune: null,
      marcaNume: null,
      dimensiuneValoare: null,
      profilValoare: null,
      dotValoare: null,
      tip: "",
      adancime: null,
      cupluStrangere: null,
      imageUrl: urlBase ? urlBase + pozitie : null,
    };

    const drawPair = async (leftKey: string, rightKey: string, gridRow: "top" | "bottom") => {
      const left = rowFor(leftKey);
      const right = rowFor(rightKey);
      await drawMontajRotaCard(doc, left,  leftHalfX,                 leftY, cardW, cardH, "right", gridRow, t, FONT);
      await drawMontajRotaCard(doc, right, leftHalfX + cardW + colGap, leftY, cardW, cardH, "left",  gridRow, t, FONT);
      leftY += cardH + rowGap;
    };

    await drawPair("stanga_fata", "dreapta_fata", "top");
    await drawPair("stanga_spate", "dreapta_spate", "bottom");

    // Coloana dreapta: Conditii Tehnice + Atentie, incepe la acelasi y ca grid-ul.
    let rightY = gridStartY;

    doc.setFont(FONT, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.black);
    doc.text(t("CONDIȚII TEHNICE DE LUCRU"), rightHalfX, rightY);
    rightY += 3;

    doc.setFont(FONT, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.gray);
    const paragrafe = [
      "Strângerea prezoanelor de roată s-a efectuat cu cheie dinamometrică, la momentul de strângere specificat în manualul tehnic al vehiculului, conform indicațiilor producătorului autovehiculului sau conform valorilor înscrise pe eticheta situată pe stâlpul ușii șoferului.",
      "Presiunea pneurilor a fost reglată conform valorilor recomandate de producătorul autovehiculului, indicate pe eticheta de pe stâlpul caroseriei, în manualul de utilizare sau pe capacul rezervorului de combustibil.",
    ];
    for (const p of paragrafe) {
      const lines: string[] = doc.splitTextToSize(t(p), rightW);
      doc.text(lines, rightHalfX, rightY);
      rightY += lines.length * 2.6 + 1.5;
    }

    doc.setFont(FONT, "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.black);
    const atentie = "Atenție: Clientul este sfătuit să verifice strângerea prezoanelor după primii 50 pana la 100 km parcurși de la montaj, la un service autorizat sau cu o cheie dinamometrică calibrată.";
    const atLines: string[] = doc.splitTextToSize(t(atentie), rightW);
    doc.text(atLines, rightHalfX, rightY);
    rightY += atLines.length * 2.6 + 4;
    doc.setTextColor(...C.black);

    // Continuam de la baza celei mai inalte coloane.
    y = Math.max(leftY, rightY);
  }

  // Rezerva / Nespecificat sunt lipite de grid-ul de mai sus (fara padding extra)
  // si compacte pe verticala.
  if (byPoz.rezerva) {
    y = drawMontajRotaRowTextOnly(doc, byPoz.rezerva, ML, y, CW, t, FONT);
  }
  if (byPoz.nespecificat) {
    y = drawMontajRotaRowTextOnly(doc, byPoz.nespecificat, ML, y, CW, t, FONT);
  }

  return y;
}

/** PDF — Montare Roți */
export async function generateMontajRoti(
  receipt: Receipt,
  company: CompanyData | null,
  rows: MontajRotaRow[],
  vehicle: VehiculForPdf | null = null,
  append?: AppendOptions,
): Promise<void> {
  const { jsPDF } = await loadPdf();
  const doc = append ? append.doc : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (append && !append.isFirst) doc.addPage();

  await enableRomanianFont(doc);
  const FONT = "helvetica";
  const t = makeT(true);
  doc.setFont(FONT, "normal");

  await drawBackground(doc, company?.background_path);

  const fmtReceiptDate = (() => {
    try { return fmtDate(receipt.date); } catch { return ""; }
  })();

  const client: ClientInfoForPdf = {
    clientNume: receipt.clientNume ?? null,
    clientCui: (receipt as any).clientCui ?? null,
    clientReprezentant: (receipt as any).clientReprezentant ?? null,
    clientAdresa: (receipt as any).clientAdresa ?? null,
    clientTelefon: (receipt as any).clientTelefon ?? null,
  };

  let y = await drawDocHeader3Col(
    doc, company ?? null, client, vehicle,
    { title: "Montare Roți", nr: receipt.id, dateStr: fmtReceiptDate },
    t, FONT,
  );

  hline(doc, y, C.veryLight, 0.2);
  y += 2;

  y = await drawMontajRotiBody(doc, rows, y, t, FONT);

  await drawFooterWithBranding(doc, company?.website, { itemCount: rows.length });

  const clientSlug = (receipt.clientNume ?? "client").replace(/\s+/g, "_").slice(0, 30);
  if (!append) doc.save(docFilename("montaj_roti", clientSlug));
}

