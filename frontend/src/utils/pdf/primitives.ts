/**
 * Primitive de desenare PDF refolosibile intre generatoarele de documente.
 * Toate functiile sunt pure (sau au efecte doar pe doc-ul primit) si nu depind
 * de starea module-level din generateDocuments / generateReceiptPdf.
 */

import type { jsPDF } from "jspdf";
import { COLORS, PAGE } from "./constants";
import { pageCount } from "./types";
import { apiFetch } from "../api";

type RGB = readonly [number, number, number];

// ─── Image helpers ────────────────────────────────────────────────────────────

/** Deseneaza imaginea de la `src` pe un canvas si o intoarce ca dataURL PNG. */
async function imageToPngDataUrl(src: string, crossOrigin: boolean): Promise<string | null> {
  try {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = src;
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

/** Aceeasi imagine, adusa prin server (/api/companies/image-proxy), ca dataURL. */
async function fetchViaServerAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await apiFetch(`/api/companies/image-proxy?url=${encodeURIComponent(url)}`, { handleUnauthorized: false });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Incarca o imagine remote (logo / fundal de firma) ca dataURL PNG.
 *
 * Intai direct din bucket (Image + canvas). Bucket-ul permite accesul CORS doar
 * adresei de productie, deci de pe alta adresa (QA, IP local) incarcarea directa
 * esueaza; atunci imaginea se aduce prin server, de pe adresa aplicatiei. Fara
 * asta documentul iesea, fara niciun mesaj, fara logo.
 */
export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  const direct = await imageToPngDataUrl(url, true);
  if (direct) return direct;
  if (!/^https?:\/\//i.test(url)) return null;
  const viaServer = await fetchViaServerAsDataUrl(url);
  return viaServer ? imageToPngDataUrl(viaServer, false) : null;
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
