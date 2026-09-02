import { describe, expect, it } from "vitest";
import { asciifyDiacritics, docFilename, lei } from "./format";

describe("pdf format helpers", () => {
  it("lei formats with two decimals", () => {
    expect(lei(10)).toBe("10.00 lei");
    expect(lei(0.1 + 0.2)).toBe("0.30 lei");
    expect(lei(1234.567)).toBe("1234.57 lei");
  });

  it("docFilename slugifies the title and appends a timestamp", () => {
    const name = docFilename("Factura", "Ștefan Țărănescu / SRL");
    expect(name).toMatch(/^Factura_Stefan_Taranescu_SRL_\d{14}\.pdf$/);
  });

  it("docFilename caps the slug at 60 chars", () => {
    const name = docFilename("X", "a".repeat(100));
    expect(name.split("_")[1]).toHaveLength(60);
  });

  it("asciifyDiacritics maps Romanian letters and handles null", () => {
    expect(asciifyDiacritics("ăĂșȘțȚşţ")).toBe("aAsStTst");
    expect(asciifyDiacritics(null)).toBe("");
    expect(asciifyDiacritics("plain")).toBe("plain");
  });
});
