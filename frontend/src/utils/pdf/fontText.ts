/**
 * Textul scris in PDF trebuie sa contina doar caractere pe care fontul le are.
 *
 * jsPDF nu inlocuieste un glif lipsa: textul se opreste la primul caracter pe care
 * fontul nu il are si tot restul liniei dispare din PDF („Observații: café crème”
 * iesea „Observații: caf”). De aceea:
 *  - fontul NotoSans-Pdf.ttf acopera alfabetele latine (franceza, maghiara, germana,
 *    polona, ceha...), greaca, chirilica si punctuatia uzuala;
 *  - orice alt caracter (emoji, scrieri asiatice) e inlocuit inainte sa ajunga la
 *    jsPDF: cu litera de baza cand exista (ǩ -> k), altfel cu „?”.
 */

/** Caracterele din assets/fonts/NotoSans-Pdf.ttf (cmap), ca intervale inchise.
 *  Fontul e un subset din Noto Sans Regular 2.015 (OFL), generat cu:
 *  pyftsubset NotoSans-Regular.ttf --no-hinting --desubroutinize --layout-features=""
 *    --unicodes=U+0020-007E,U+00A0-024F,U+0259,U+02B0-02FF,U+0300-036F,U+0370-03FF,
 *    U+0400-052F,U+1E00-1EFF,U+2000-206F,U+20A0-20C0,U+2100-214F,U+2150-218B,
 *    U+2190-21FF,U+2200-22FF,U+2460-24FF,U+25A0-25FF,U+2600-26FF,U+2713-2714,
 *    U+2717-2718,U+FB00-FB06,U+FFFD
 *  La schimbarea fontului, intervalele se regenereaza din cmap-ul lui. */
const PDF_FONT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e], [0x00a0, 0x024f], [0x0259, 0x0259], [0x02b0, 0x0377],
  [0x037a, 0x037f], [0x0384, 0x038a], [0x038c, 0x038c], [0x038e, 0x03a1],
  [0x03a3, 0x03e1], [0x03f0, 0x052f], [0x1e00, 0x1eff], [0x2000, 0x2064],
  [0x2066, 0x206f], [0x20a0, 0x20c0], [0x2100, 0x215f], [0x2183, 0x2184],
  [0x2189, 0x2189], [0x2212, 0x2212], [0x25cc, 0x25cc], [0xfb00, 0xfb06],
  [0xfffd, 0xfffd],
];

/** Caracterele fonturilor standard jsPDF (Helvetica, WinAnsiEncoding): folosite
 *  doar cand fontul NotoSans nu s-a putut incarca. */
const WIN_ANSI_EXTRA = new Set(
  Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ").map((c) => c.codePointAt(0)!),
);

export type GlyphCoverage = (codePoint: number) => boolean;

export const inPdfFont: GlyphCoverage = (cp) => {
  let lo = 0;
  let hi = PDF_FONT_RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = PDF_FONT_RANGES[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
};

export const inStandardFont: GlyphCoverage = (cp) =>
  (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRA.has(cp);

// Echivalente ASCII pentru semnele care lipsesc din Helvetica sau din font.
const ASCII_FALLBACK: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", "•": "-", "·": ".", " ": " ", " ": " ", " ": " ",
};

// Caractere de formatare invizibile (joiner-ele din emoji, marcaje de directie,
// cratima conditionala): nu se vad, deci nu se scriu.
const FORMAT = /^\p{Cf}$/u;
// Semne fara forma proprie ramase dupa NFC (diacritice combinante, selectoare de
// varianta): se omit, nu devin „?”.
const INVISIBLE = /^[\p{M}\p{Cf}]$/u;

/** Textul cu fiecare caracter pe care fontul nu il are inlocuit (litera de baza,
 *  echivalent ASCII sau „?”). Literele scrise ca baza + accent separat sunt unite
 *  intai (NFC), fiindca jsPDF nu pozitioneaza accentele combinante. Liniile noi si
 *  tab-urile raman neschimbate. */
export function pdfSafeText(text: string, covered: GlyphCoverage = inPdfFont): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) { out += ch; continue; }
    if (FORMAT.test(ch)) continue;
    if (covered(cp) && !INVISIBLE.test(ch)) { out += ch; continue; }
    const base = ch.normalize("NFKD").replace(/\p{M}/gu, "");
    if (base && base !== ch && Array.from(base).every((c) => covered(c.codePointAt(0)!))) { out += base; continue; }
    const ascii = ASCII_FALLBACK[ch];
    if (ascii !== undefined && Array.from(ascii).every((c) => covered(c.codePointAt(0)!))) { out += ascii; continue; }
    if (INVISIBLE.test(ch)) continue;
    out += "?";
  }
  return out;
}

/** true daca textul se poate scrie exact, fara nicio inlocuire. */
export function isPdfTextExact(text: string, covered: GlyphCoverage = inPdfFont): boolean {
  return pdfSafeText(text, covered) === text;
}

type TextArg = string | string[] | unknown;

function clean(arg: TextArg, covered: GlyphCoverage): TextArg {
  if (typeof arg === "string") return pdfSafeText(arg, covered);
  if (Array.isArray(arg)) return arg.map((x) => (typeof x === "string" ? pdfSafeText(x, covered) : x));
  return arg;
}

/**
 * Face ca tot textul scris pe `doc` (inclusiv de jspdf-autotable, care foloseste
 * aceleasi metode ale documentului) sa treaca prin pdfSafeText. Masuratorile
 * (latime, impartire pe randuri) vad acelasi text ca scrierea, deci randurile se
 * rup corect. Se aplica o singura data per document.
 */
export function guardPdfText(doc: any, covered: GlyphCoverage = inPdfFont): void {
  if (doc.__pdfTextGuard) { doc.__pdfTextGuard = covered; return; }
  doc.__pdfTextGuard = covered;
  const cov = (): GlyphCoverage => doc.__pdfTextGuard;
  for (const name of ["text", "splitTextToSize", "getTextWidth", "getStringUnitWidth"]) {
    const orig = doc[name];
    if (typeof orig !== "function") continue;
    doc[name] = function (first: TextArg, ...rest: unknown[]) {
      return orig.call(this, clean(first, cov()), ...rest);
    };
  }
}
