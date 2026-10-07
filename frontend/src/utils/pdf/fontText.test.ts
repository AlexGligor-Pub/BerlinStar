import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import fontDataUrl from "../../assets/fonts/NotoSans-Pdf.ttf?inline";
import { guardPdfText, inPdfFont, inStandardFont, isPdfTextExact, pdfSafeText } from "./fontText";

const fontB64 = fontDataUrl.slice(fontDataUrl.indexOf(",") + 1);

function docWithFont() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSans-Pdf.ttf", fontB64);
  doc.addFont("NotoSans-Pdf.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans", "normal");
  return doc;
}

const LIMBI = [
  "Observații: mașină, țeavă, înșurubat, Ăă Ââ Îî Șș Țț",
  "Français: café crème, garçon, élève, Noël, cœur, « déjà » où ça",
  "Magyar: Győr, Kőszeg, ünnepély, Örs, Ű ő ű á é í ó ö ú ü",
  "Deutsch: Müller, Straße, Ärger",
  "Polski/Čeština: łódź, Źródło, příliš žluťoučký kůň",
  "Ελληνικά, Русский текст, Українська ї є",
  "Semne: „citat” – lung — 25 °C ± 1, 5 × 3, 100 €, № 7, … •",
];

describe("pdfSafeText", () => {
  it("leaves every European text the font covers unchanged", () => {
    for (const t of LIMBI) expect(pdfSafeText(t)).toBe(t);
    for (const t of LIMBI) expect(isPdfTextExact(t)).toBe(true);
  });

  it("replaces only what the font lacks and keeps the rest of the text", () => {
    expect(pdfSafeText("Merci 😀 pentru tot")).toBe("Merci ? pentru tot");
    // Secventa de emoji cu joiner-e: un „?” pe emoji, joiner-ele dispar.
    expect(pdfSafeText("a 👨‍👩‍👧 b")).toBe("a ??? b");
    expect(pdfSafeText("ok ✔️ gata")).toBe("ok ? gata");
    expect(pdfSafeText("漢字 test")).toBe("?? test");
    expect(isPdfTextExact("Merci 😀")).toBe(false);
  });

  it("uses the base letter when the character decomposes", () => {
    expect(pdfSafeText("ＡＢＣ ① ②")).toBe("ABC 1 2");
  });

  it("joins a base letter with a separate accent and drops invisible marks", () => {
    expect(pdfSafeText("cafe\u0301 Gyo\u030br")).toBe("café Győr");
    expect(pdfSafeText("a\u200bb\u00adc\u0301")).toBe("abć");
  });

  it("keeps line breaks and tabs", () => {
    expect(pdfSafeText("rand 1\nrand 2\tcol")).toBe("rand 1\nrand 2\tcol");
  });

  it("maps to Latin-1 for the standard font used when NotoSans does not load", () => {
    expect(pdfSafeText("Győr ș ț ă é ç", inStandardFont)).toBe("Gyor s t a é ç");
    expect(pdfSafeText("„citat” – €", inStandardFont)).toBe("„citat” – €");
    expect(pdfSafeText("Ω 😀", inStandardFont)).toBe("? ?");
  });
});

describe("coverage table", () => {
  it("matches the glyphs of NotoSans-Pdf.ttf exactly", () => {
    const doc = docWithFont();
    // jsPDF citeste cmap-ul fontului la addFont; il comparam cu tabela din fontText.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const font = (doc as any).internal.getFont("NotoSans", "normal");
    const codeMap: Record<string, number> = font.metadata.cmap.unicode.codeMap;
    const inFont = new Set(Object.keys(codeMap).map(Number).filter((cp) => codeMap[cp] > 0 && cp >= 0x20));
    const mismatches: number[] = [];
    for (let cp = 0x20; cp <= 0xffff; cp++) {
      if (inPdfFont(cp) !== inFont.has(cp)) mismatches.push(cp);
    }
    expect(mismatches.map((c) => c.toString(16))).toEqual([]);
  });
});

describe("guardPdfText", () => {
  it("cleans text, wrapping and widths on the document", () => {
    const doc = docWithFont();
    guardPdfText(doc);
    const lines: string[] = doc.splitTextToSize("Observații: café 😀 crème, Győr — tot textul rămâne", 60);
    expect(lines.join(" ")).toBe("Observații: café ? crème, Győr — tot textul rămâne");
    expect(doc.getTextWidth("ab😀")).toBe(doc.getTextWidth("ab?"));
    expect(() => doc.text(["a 😀", "Kőszeg"], 10, 10)).not.toThrow();
  });

  it("is installed once even when called again", () => {
    const doc = docWithFont();
    guardPdfText(doc);
    const text = doc.text;
    guardPdfText(doc, inStandardFont);
    expect(doc.text).toBe(text);
    expect(doc.splitTextToSize("ő", 50)).toEqual(["o"]);
  });
});
