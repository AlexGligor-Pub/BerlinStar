/**
 * Interpretarea textului tastat intr-un camp numeric (sume, preturi, cantitati).
 *
 * Campurile sunt `type="text"`, nu `type="number"`: un `type="number"` raporteaza
 * `value === ""` pentru orice text intermediar (ex. „12."), iar semnalul scris
 * inapoi stergea ce s-a tastat — 150.5 ajungea 5, fara nicio eroare. Aici textul
 * ramane al utilizatorului si e doar citit.
 *
 * Reguli (aceleasi ca in modalul de editare din Stocuri):
 *   - separator zecimal „," sau „.", cel mult unul;
 *   - fara separator de mii („1.234,56" e respins, nu ghicit);
 *   - textul gol e valid si inseamna „fara valoare" (null), nu zero.
 */

export interface DecimalOptions {
  /** Doar numere intregi (fara separator zecimal). */
  integer?: boolean;
  /** Numarul maxim de zecimale acceptate. */
  maxDecimals?: number;
  /** Implicit numerele negative sunt respinse. */
  allowNegative?: boolean;
}

export interface DecimalParse {
  /** Numarul citit; null daca textul e gol sau invalid. */
  value: number | null;
  /** false = textul nu e un numar acceptat. Textul gol e valid. */
  valid: boolean;
  empty: boolean;
  /** Text invalid doar pentru ca nu e terminat (ex. „12," sau „-"): campul nu
   *  trebuie marcat ca gresit cat timp utilizatorul inca tasteaza. */
  incomplete: boolean;
}

function invalid(incomplete = false): DecimalParse {
  return { value: null, valid: false, empty: false, incomplete };
}

export function parseDecimal(raw: string | null | undefined, opts: DecimalOptions = {}): DecimalParse {
  const s = (raw ?? "").trim();
  if (s === "") return { value: null, valid: true, empty: true, incomplete: false };

  const negative = opts.allowNegative === true;
  if (negative && s === "-") return invalid(true);

  const m = /^(-?)(\d+)(?:([.,])(\d*))?$/.exec(s);
  if (!m) return invalid();
  if (m[1] !== "" && !negative) return invalid();

  const frac = m[4] ?? "";
  if (m[3] !== undefined) {
    if (opts.integer) return invalid();
    if (frac === "") return invalid(true);
    if (opts.maxDecimals != null && frac.length > opts.maxDecimals) return invalid();
  }

  const value = Number(`${m[1]}${m[2]}${frac !== "" ? `.${frac}` : ""}`);
  if (!Number.isFinite(value)) return invalid();
  // `value === 0 ? 0` evita „-0".
  return { value: value === 0 ? 0 : value, valid: true, empty: false, incomplete: false };
}

/** Numarul citit din text sau null (gol / invalid). */
export function decimalValue(raw: string | null | undefined, opts: DecimalOptions = {}): number | null {
  return parseDecimal(raw, opts).value;
}

/** Textul cu care se umple un camp dintr-un numar: fara zerouri de umplutura,
 *  cu punct zecimal (ca `String(n)`); null / NaN = camp gol. */
export function formatDecimal(n: number | null | undefined, maxDecimals?: number): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(maxDecimals == null ? n : Number(n.toFixed(maxDecimals)));
}
