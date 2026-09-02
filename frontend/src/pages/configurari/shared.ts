/**
 * Utilitati partajate intre panourile paginii Configurari:
 *  - compressToPng: comprima un File la PNG, sub o limita de bytes
 *  - esc / exportCSV / exportPDF: helpers de export tabelar
 */

/** Comprima o imagine la PNG, sub `maxBytes`. Scaleaza la max 1200px pe latura lunga. */
export function compressToPng(file: File, maxBytes = 100_000): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const outName = file.name.replace(/\.[^.]+$/, ".png");
      const tryDim = (scale: number) => {
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Compresie esuata.")); return; }
          if (blob.size <= maxBytes || scale <= 0.1) {
            resolve(new File([blob], outName, { type: "image/png" }));
          } else {
            tryDim(+(scale - 0.1).toFixed(2));
          }
        }, "image/png");
      };
      const initScale = Math.min(1, 1200 / Math.max(w, h, 1));
      tryDim(initScale);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagine invalida.")); };
    img.src = url;
  });
}

/** Escape minim pentru HTML output (export PDF). */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Descarca un fisier CSV cu BOM UTF-8 (Excel-friendly).
 *
 *  `preamble` scrie linii de context inainte de antet (ex. codul firmei), urmate
 *  de un rand gol. Excel le afiseaza ca text simplu, iar exportul ramane
 *  auto-explicativ cand fisierul e trimis mai departe.
 */
export function exportCSV(
  filename: string,
  headers: string[],
  rows: string[][],
  preamble?: string[][],
): void {
  const lines = preamble && preamble.length > 0
    ? [...preamble, [], headers, ...rows]
    : [headers, ...rows];
  const csv = lines
    .map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

export interface ExportHighlight {
  label: string;
  value: string;
}

/** Deschide o fereastra noua cu un tabel printabil (declanseaza print dialog).
 *
 *  `highlights` sunt afisate sus, in casete evidentiate (ex. codul firmei) —
 *  informatie de care cititorul are nevoie inainte de tabel.
 */
export function exportPDF(
  title: string,
  headers: string[],
  rows: string[][],
  highlights?: ExportHighlight[],
): void {
  const w = window.open("", "_blank", "width=960,height=700");
  if (!w) return;
  const date = new Date().toLocaleDateString("ro-RO");
  const thead = headers.map(h => `<th>${esc(h)}</th>`).join("");
  const highlightHtml = (highlights ?? []).length === 0 ? "" : `
  <div class="highlights">
    ${(highlights ?? []).map(h => `
    <div class="hl">
      <div class="hl-label">${esc(h.label)}</div>
      <div class="hl-value">${esc(h.value)}</div>
    </div>`).join("")}
  </div>`;
  const tbody = rows.map(r => `<tr>${r.map(c => `<td>${esc(c ?? "")}</td>`).join("")}</tr>`).join("");
  w.document.write(`<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; padding: 18mm 20mm; }
  h1 { font-size: 15pt; margin-bottom: 14px; }
  .highlights { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
  .hl { border:2px solid #333; border-radius:6px; padding:8px 16px; min-width:120px; }
  .hl-label { font-size:8pt; text-transform:uppercase; letter-spacing:0.08em; color:#555; }
  .hl-value { font-family:"Courier New",monospace; font-size:15pt; font-weight:700; letter-spacing:0.03em; }
  table { width:100%; border-collapse:collapse; margin-bottom:40px; }
  th { background:#f0f0f0; font-weight:600; border:1px solid #bbb; padding:12px 14px; text-align:left; }
  td { border:1px solid #ddd; padding:11px 14px; vertical-align:top; }
  tr:nth-child(even) td { background:#fafafa; }
  footer { position:fixed; bottom:8mm; left:20mm; right:20mm; font-size:8pt; color:#555;
           border-top:1px solid #ccc; padding-top:4px;
           display:flex; justify-content:space-between; }
  footer a { color:#4466cc; text-decoration:none; }
  @media print {
    body { padding: 0; }
    footer { position: fixed; bottom: 8mm; }
  }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${highlightHtml}
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <footer>
    <span>Exportat din Berlin Star &ndash; <a href="https://professorprime.ro">professorprime.ro</a></span>
    <span>${date}</span>
  </footer>
  <script>setTimeout(()=>{ window.print(); },400);</script>
</body>
</html>`);
  w.document.close();
}
