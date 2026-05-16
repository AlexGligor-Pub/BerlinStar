/**
 * Primitive partajate pentru generatoarele PDF (deviz, factura, chitanta, cazare,
 * montaj roti, receipt POS, etc).
 *
 * Adaugarea unui nou tip de document trebuie sa porneasca de aici, nu sa duplice
 * constante/helpere locale in fisierul nou.
 */

export { COLORS, PAGE, CONTENT_WIDTH } from "./constants";
export { ext, lastTableY, pageCount, type JsPdfExt } from "./types";
export { fmtDate, fmtNow, lei, docFilename, asciifyDiacritics } from "./format";
export {
  hline, drawBackground, drawLogo, drawSideImage,
  qrDataUrl, drawFooterWithBranding,
  loadImageAsDataUrl, fetchImageAsDataUrl,
} from "./primitives";
export {
  drawHeader, drawCompanyBlock, drawClientBlock,
  drawItemsTable, drawTotals, drawDisclaimer, drawSignatures,
  type TextTransform, type CompanyInfo, type ClientInfo,
  type ReceiptItemForTable, type ReceiptTotals, type DisclaimerInfo,
} from "./documents";
