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

  it("drops the amounts that no longer fit after an earlier advance", () => {
    expect(avansShortcuts({ total: 850, rest: 250 })).toEqual([100, 200]);
    expect(avansShortcuts({ total: 850, rest: 300 })).toEqual([100, 200, 300]);
    expect(avansShortcuts({ total: 850, rest: 0 })).toEqual([]);
  });

  it("offers all of them on a receipt without lines yet", () => {
    expect(avansShortcuts({ total: 0, rest: 0 })).toEqual([100, 200, 300, 400, 500]);
  });

  it("every offered amount passes validation", () => {
    for (const deviz of [{ total: 850, rest: 850 }, { total: 850, rest: 250 }, { total: 120, rest: 120 }, { total: 0, rest: 0 }]) {
      for (const v of avansShortcuts(deviz)) expect(validateAvans(String(v), deviz).ok).toBe(true);
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
    for (const text of ["", "0", "0,00", "-5", "abc", "12,5,3", "10,123"]) {
      expect(validateAvans(text, deviz).ok, text).toBe(false);
    }
  });

  it("does not allow more than the remaining balance", () => {
    const peste = validateAvans("850,01", deviz);
    expect(peste.ok).toBe(false);
    expect(peste.ok === false && peste.message).toContain("850.00 lei");
    expect(validateAvans("850", deviz).ok).toBe(true);
    // dupa un avans de 200, restul e 650
    expect(validateAvans("650,01", { total: 850, rest: 650 }).ok).toBe(false);
    expect(validateAvans("650", { total: 850, rest: 650 }).ok).toBe(true);
  });

  it("compares in whole bani, not in floating point", () => {
    expect(validateAvans("0,30", { total: 1, rest: 0.1 + 0.2 }).ok).toBe(true);
  });

  it("refuses an advance on a fully collected receipt", () => {
    const r = validateAvans("10", { total: 850, rest: 0 });
    expect(r.ok === false && r.message).toBe("Devizul este deja încasat integral.");
  });

  it("accepts any positive amount on a receipt without lines yet", () => {
    expect(validateAvans("500", { total: 0, rest: 0 })).toEqual({ ok: true, amount: 500 });
  });
});
