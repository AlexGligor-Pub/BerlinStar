import { describe, expect, it } from "vitest";
import { lei } from "./pdf/format";
import { numarInLitere, sumaInBani, sumaInLitere } from "./sumaInLitere";

describe("sumaInLitere", () => {
  it("nu mai adauga un leu cand banii sunt >= 50", () => {
    expect(sumaInLitere(0.5)).toBe("zero lei si cincizeci bani");
    expect(sumaInLitere(150.5)).toBe("o suta cincizeci lei si cincizeci bani");
    expect(sumaInLitere(150.75)).toBe("o suta cincizeci lei si saptezeci si cinci bani");
    expect(sumaInLitere(99.99)).toBe("nouazeci si noua lei si nouazeci si noua bani");
  });

  it("pastreaza formatul pentru sumele care erau deja corecte", () => {
    expect(sumaInLitere(0)).toBe("zero lei");
    expect(sumaInLitere(0.49)).toBe("zero lei si patruzeci si noua bani");
    expect(sumaInLitere(100)).toBe("o suta lei");
    expect(sumaInLitere(150.49)).toBe("o suta cincizeci lei si patruzeci si noua bani");
  });

  it("trece rotunjirea banilor in lei, niciodata «100 bani»", () => {
    expect(sumaInLitere(199.995)).toBe("doua sute lei");
    expect(sumaInLitere(99.995)).toBe("o suta lei");
  });

  // Formele pentru mii si milioane sunt cele tiparite si pana acum.
  it("mii si milioane", () => {
    expect(sumaInLitere(1000)).toBe("unu mie lei");
    expect(sumaInLitere(1_234_567.89)).toBe(
      "unu milion doua sute treizeci si patru mii cinci sute saizeci si sapte lei si optzeci si noua bani",
    );
  });

  it("valorile negative si cele care nu sunt numere nu produc text stricat", () => {
    expect(sumaInLitere(-5.5)).toBe("minus cinci lei si cincizeci bani");
    expect(sumaInLitere(-0.001)).toBe("zero lei");
    expect(sumaInLitere(NaN)).toBe("zero lei");
    expect(sumaInLitere(Infinity)).toBe("zero lei");
  });

  it("literele descriu exact suma tiparita in cifre", () => {
    for (const n of [0.49, 0.5, 10.995, 150.75, 199.995, 1000, 1_234_567.89]) {
      const bani = sumaInBani(n);
      expect(`${Math.floor(bani / 100)}.${String(bani % 100).padStart(2, "0")} lei`).toBe(lei(n));
    }
  });
});

describe("sumaInBani", () => {
  it("rotunjeste la bani intregi", () => {
    expect(sumaInBani(0.49)).toBe(49);
    expect(sumaInBani(150.75)).toBe(15075);
    expect(sumaInBani(1_234_567.89)).toBe(123456789);
    expect(sumaInBani(-5.5)).toBe(-550);
    expect(sumaInBani(NaN)).toBe(0);
  });
});

describe("numarInLitere", () => {
  it("unitati, zeci si sute", () => {
    expect(numarInLitere(0)).toBe("zero");
    expect(numarInLitere(19)).toBe("nouasprezece");
    expect(numarInLitere(40)).toBe("patruzeci");
    expect(numarInLitere(200)).toBe("doua sute");
    expect(numarInLitere(999)).toBe("noua sute nouazeci si noua");
  });
});
