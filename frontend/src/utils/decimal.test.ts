import { describe, expect, it } from "vitest";

import { decimalValue, formatDecimal, parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("accepts both decimal separators", () => {
    expect(parseDecimal("150.5")).toEqual({ value: 150.5, valid: true, empty: false, incomplete: false });
    expect(parseDecimal("150,5").value).toBe(150.5);
    expect(parseDecimal("0,05").value).toBe(0.05);
    expect(parseDecimal("12").value).toBe(12);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDecimal("  12,50 ").value).toBe(12.5);
  });

  it("treats empty text as valid with no value", () => {
    expect(parseDecimal("")).toEqual({ value: null, valid: true, empty: true, incomplete: false });
    expect(parseDecimal("   ").empty).toBe(true);
    expect(parseDecimal(null).empty).toBe(true);
    expect(parseDecimal(undefined).valid).toBe(true);
  });

  it("flags a trailing separator as incomplete, not as a number", () => {
    expect(parseDecimal("12.")).toEqual({ value: null, valid: false, empty: false, incomplete: true });
    expect(parseDecimal("12,").incomplete).toBe(true);
  });

  it("rejects text that is not a plain number", () => {
    for (const s of ["abc", "12a", "1e3", "1.2.3", "1,2,3", "1.234,56", "1 234", ".5", ",5", "+5", "--5", "0x10"]) {
      const r = parseDecimal(s);
      expect(r.valid, s).toBe(false);
      expect(r.value, s).toBeNull();
      expect(r.incomplete, s).toBe(false);
    }
  });

  it("rejects negative numbers unless allowed", () => {
    expect(parseDecimal("-5").valid).toBe(false);
    expect(parseDecimal("-").valid).toBe(false);
    expect(parseDecimal("-").incomplete).toBe(false);
    expect(parseDecimal("-5,5", { allowNegative: true }).value).toBe(-5.5);
    expect(parseDecimal("-", { allowNegative: true })).toEqual({
      value: null, valid: false, empty: false, incomplete: true,
    });
  });

  it("never returns negative zero", () => {
    expect(Object.is(parseDecimal("-0", { allowNegative: true }).value, 0)).toBe(true);
  });

  it("enforces the maximum number of decimals", () => {
    expect(parseDecimal("12,34", { maxDecimals: 2 }).value).toBe(12.34);
    expect(parseDecimal("12.3", { maxDecimals: 2 }).value).toBe(12.3);
    expect(parseDecimal("12,345", { maxDecimals: 2 }).valid).toBe(false);
    expect(parseDecimal("12,345").value).toBe(12.345);
  });

  it("integer mode accepts digits only", () => {
    expect(parseDecimal("120", { integer: true }).value).toBe(120);
    expect(parseDecimal("0", { integer: true }).value).toBe(0);
    expect(parseDecimal("2.5", { integer: true }).valid).toBe(false);
    expect(parseDecimal("2,0", { integer: true }).valid).toBe(false);
    const trailing = parseDecimal("2.", { integer: true });
    expect(trailing.valid).toBe(false);
    expect(trailing.incomplete).toBe(false);
  });
});

describe("decimalValue", () => {
  it("returns the number or null", () => {
    expect(decimalValue("99,99", { maxDecimals: 2 })).toBe(99.99);
    expect(decimalValue("")).toBeNull();
    expect(decimalValue("12.")).toBeNull();
    expect(decimalValue("abc")).toBeNull();
  });
});

describe("formatDecimal", () => {
  it("formats numbers the way String() does", () => {
    expect(formatDecimal(12.5)).toBe("12.5");
    expect(formatDecimal(120)).toBe("120");
    expect(formatDecimal(0)).toBe("0");
  });

  it("returns an empty string when there is no value", () => {
    expect(formatDecimal(null)).toBe("");
    expect(formatDecimal(undefined)).toBe("");
    expect(formatDecimal(NaN)).toBe("");
    expect(formatDecimal(Infinity)).toBe("");
  });

  it("rounds to maxDecimals without padding zeros", () => {
    expect(formatDecimal(12.345, 2)).toBe("12.35");
    expect(formatDecimal(12.5, 2)).toBe("12.5");
    expect(formatDecimal(12, 2)).toBe("12");
    expect(formatDecimal(0.1 + 0.2, 2)).toBe("0.3");
  });

  it("round-trips through parseDecimal", () => {
    for (const n of [0, 1, 2.3, 99.99, 150.5, 1234.56]) {
      expect(parseDecimal(formatDecimal(n)).value).toBe(n);
    }
  });
});
