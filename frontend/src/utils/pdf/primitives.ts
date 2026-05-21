/**
 * Primitive de desenare PDF refolosibile intre generatoarele de documente.
 * Toate functiile sunt pure (sau au efecte doar pe doc-ul primit) si nu depind
 * de starea module-level din generateDocuments / generateReceiptPdf.
 */

import type { jsPDF } from "jspdf";
import { COLORS, PAGE } from "./constants";
import { pageCount } from "./types";

type RGB = readonly [number, number, number];

// ─── Image helpers ────────────────────────────────────────────────────────────

/** Incarca o imagine remote ca dataURL (via Image + canvas, fara CORS fetch). */
export async function loadImageAsDataUrl(url: string): Promise<string | null> {
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

/**
 * Incarca o imagine via fetch (bypass-eaza taint-ul de canvas) si o intoarce
 * ca dataURL + dimensiuni naturale.
 */
export async function fetchImageAsDataUrl(
  url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
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

// ─── Drawing primitives ───────────────────────────────────────────────────────

/** Linie orizontala subtire intre marginile paginii. */
export function hline(
  doc: jsPDF,
  y: number,
  color: RGB = COLORS.lightGray,
  w = 0.2,
): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
}

/** Deseneaza fundalul cu opacitate redusa pe pagina curenta. */
export async function drawBackground(
  doc: jsPDF,
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    if (!dataUrl) return;
    const img = new Image();
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => res();
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 794; canvas.height = 1123; // ~A4 la 96dpi
    const ctx2d = canvas.getContext("2d")!;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    ctx2d.globalAlpha = 0.5;
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const faded = canvas.toDataURL("image/png");
    doc.addImage(faded, "PNG", 0, 0, PAGE.width, PAGE.height, "bg", "FAST");
  } catch { /* ignore */ }
}

/** Deseneaza logo-ul in coltul din dreapta-sus, 20x20 mm. */
export async function drawLogo(
  doc: jsPDF,
  url: string | null | undefined,
  y: number,
): Promise<void> {
  if (!url) return;
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    if (!dataUrl) return;
    const logoH = 20;
    const logoW = 20;
    const x = PAGE.width - PAGE.marginRight - logoW;
    doc.addImage(dataUrl, "PNG", x, y, logoW, logoH, undefined, "FAST");
  } catch { /* ignore */ }
}

/** Deseneaza o imagine intr-o caseta (boxW x boxH), pastrand aspect-ratio si centrand. */
export async function drawSideImage(
  doc: jsPDF,
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
    const fmt = loaded.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(loaded.dataUrl, fmt, x, y, w, h, undefined, "FAST");
  } catch { /* ignore */ }
}

/** Genereaza QR code ca data URL. */
export async function qrDataUrl(text: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode");
    return await QRCode.toDataURL(text, { width: 80, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

/**
 * Footer pe toate paginile: linie subtire, data generare, numar pagina,
 * (optional) website la centru si QR code pe prima pagina.
 *
 * Daca `opts.itemCount` > 10, QR-ul nu se afiseaza ca sa lase mai mult loc pe pagina.
 */
export async function drawFooterWithBranding(
  doc: jsPDF,
  website: string | null | undefined,
  opts?: { itemCount?: number },
): Promise<void> {
  const n = pageCount(doc);
  const showQr = opts?.itemCount == null || opts.itemCount <= 10;
  const qr = website && showQr ? await qrDataUrl(website) : null;

  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();

    // Footer lipit de marginea de jos: text aproape de baza paginii, QR direct deasupra textului.
    const websiteBaselineY = h - 2;

    if (website) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.black);
      doc.text(website, PAGE.width / 2, websiteBaselineY, { align: "center" });
    }

    if (qr && i === 1) {
      const qrSize = 12;
      // QR-ul se aseaza imediat deasupra textului (top-ul textului ~2.3mm peste baseline + 0.5mm gap).
      const qrY = websiteBaselineY - 3 - qrSize;
      doc.addImage(qr, "PNG", PAGE.width / 2 - qrSize / 2, qrY, qrSize, qrSize, undefined, "FAST");
    }
  }
}
