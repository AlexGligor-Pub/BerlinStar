import { describe, expect, it } from "vitest";
import { avansShortcuts, validateAvans } from "./avans";

const deviz = { total: 850, rest: 850 };

describe("avansShortcuts", () => {
  it("offers only the amounts below the receipt total", () => {
    expect(avansShortcuts({ total: 850, rest: 850 })).toEqual([100, 200, 300, 400, 500]);
    expect(avansShortcuts({ total: 350, rest: 350 })).toEqual([100, 200, 300]);
    // egal cu totalul nu e „mai mic”: 300 nu apare pe un deviz de 300
    expect(avansShortcuts({ total: 300, rest: 300 })).toEqual([100, 200]);
    expect(avansShortcuts({ total: 100, rest: 100 })).toEqual([]);
    expect(avansShortcuts({ total: 99.5, rest: 99.5 })).toEqual([]);
  });

  it("drops the amounts that reach or exceed the rest after an earlier advance", () => {
    expect(avansShortcuts({ total: 850, rest: 250 })).toEqual([100, 200]);
    // 300 ar inchide bonul ca platit integral
    expect(avansShortcuts({ total: 850, rest: 300 })).toEqual([100, 200]);
    expect(avansShortcuts({ total: 850, rest: 300.01 })).toEqual([100, 200, 300]);
    expect(avansShortcuts({ total: 850, rest: 0 })).toEqual([]);
    expect(avansShortcuts({ total: 850, rest: -50 })).toEqual([]);
  });

  it("offers all of them on a receipt without lines yet", () => {
    expect(avansShortcuts({ total: 0, rest: 0 })).toEqual([100, 200, 300, 400, 500]);
    // dupa un avans pe un deviz gol, restul e negativ
    expect(avansShortcuts({ total: 0, rest: -500 })).toEqual([100, 200, 300, 400, 500]);
  });

  it("every offered amount passes validation", () => {
    for (const d of [{ total: 850, rest: 850 }, { total: 850, rest: 250 }, { total: 850, rest: 300 }, { total: 120, rest: 120 }, { total: 0, rest: 0 }]) {
      for (const v of avansShortcuts(d)) expect(validateAvans(String(v), d).ok).toBe(true);
    }
  });
});

describe("validateAvans", () => {
  it("accepts comma or dot and returns the amount", () => {
    expect(validateAvans("200", deviz)).toEqual({ ok: true, amount: 200 });
    expect(validateAvans("150,50", deviz)).toEqual({ ok: true, amount: 150.5 });
    expect(validateAvans(" 150.5 ", deviz)).toEqual({ ok: true, amount: 150.5 });
  });

  it("rejects empty, zero, negative and malformed amounts", () => {
    for (const text of ["", "0", "0,00", "-5", "abc", "12,5,3", "10,123", "12,", "1e3", "0,005"]) {
      expect(validateAvans(text, deviz).ok, text).toBe(false);
    }
  });

  it("must stay strictly below the remaining balance", () => {
    // egal cu restul = plata integrala: bonul s-ar inchide si avansul nu s-ar mai putea sterge
    const egal = validateAvans("850", deviz);
    expect(egal.ok).toBe(false);
    expect(egal.ok === false && egal.message).toContain("850.00 lei");
    expect(egal.ok === false && egal.message).toContain("Recepție");
    expect(validateAvans("850,01", deviz).ok).toBe(false);
    expect(validateAvans("849,99", deviz).ok).toBe(true);
    // dupa un avans de 200, restul e 650
    expect(validateAvans("650", { total: 850, rest: 650 }).ok).toBe(false);
    expect(validateAvans("649,99", { total: 850, rest: 650 }).ok).toBe(true);
  });

  it("compares in whole bani, not in floating point", () => {
    // 0.7 - 0.4 = 0.29999999999999993: fara rotunjire, 0,29 ar trece si 0,30 ar parea „peste”
    const rest = 0.7 - 0.4;
    expect(validateAvans("0,29", { total: 1, rest }).ok).toBe(true);
    expect(validateAvans("0,30", { total: 1, rest }).ok).toBe(false);
    // 0.1 + 0.2 = 0.30000000000000004: 0,30 nu e „sub” rest
    expect(validateAvans("0,30", { total: 1, rest: 0.1 + 0.2 }).ok).toBe(false);
  });

  it("refuses an advance on a fully collected or over-collected receipt", () => {
    for (const rest of [0, -100]) {
      const r = validateAvans("10", { total: 850, rest });
      expect(r.ok === false && r.message).toBe("Devizul este deja încasat integral.");
    }
  });

  it("accepts any reasonable positive amount on a receipt without lines yet", () => {
    expect(validateAvans("500", { total: 0, rest: 0 })).toEqual({ ok: true, amount: 500 });
    expect(validateAvans("500", { total: 0, rest: -500 })).toEqual({ ok: true, amount: 500 });
    expect(validateAvans("1000000", { total: 0, rest: 0 }).ok).toBe(true);
    const mare = validateAvans("1000000,01", { total: 0, rest: 0 });
    expect(mare.ok === false && mare.message).toBe("Suma este prea mare.");
    expect(validateAvans("9".repeat(30), { total: 0, rest: 0 }).ok).toBe(false);
  });
});
