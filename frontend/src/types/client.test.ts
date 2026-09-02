import { describe, expect, it } from "vitest";
import { CNP_PLACEHOLDER, cnpError, cnpForSave, normalizeCnp } from "./client";

describe("CNP helpers", () => {
  it("normalizeCnp strips spaces, dots and dashes", () => {
    expect(normalizeCnp("1 900101-123.456")).toBe("1900101123456");
  });

  it("cnpForSave sends the placeholder when empty", () => {
    expect(cnpForSave("")).toBe(CNP_PLACEHOLDER);
    expect(cnpForSave("  ")).toBe(CNP_PLACEHOLDER);
    expect(cnpForSave("1900101123456")).toBe("1900101123456");
  });

  it("cnpError accepts empty and 13-digit values only", () => {
    expect(cnpError("")).toBeNull();
    expect(cnpError("1900101123456")).toBeNull();
    expect(cnpError("123")).toMatch(/13 cifre/);
    expect(cnpError("19001011234567")).toMatch(/13 cifre/);
    expect(cnpError("19001011234ab")).toMatch(/13 cifre/);
  });
});
