import { parseDecimal } from "./decimal";

export type AvansCheck =
  | { ok: true; amount: number }
  | { ok: false; message: string };

function lei(n: number): string {
  return `${n.toFixed(2)} lei`;
}

/**
 * Suma unui avans introdus in POS, verificata inainte de a ajunge la server.
 *
 * `total` si `rest` sunt ale devizului salvat (din registrul de plati). Pe un
 * deviz cu total, avansul nu poate depasi restul de plata: serverul nu il
 * plafoneaza (in Receptie se poate incasa in avans si peste total), dar in POS
 * o suma mai mare decat restul e aproape sigur o greseala de tastare. Un deviz
 * inca fara linii (total 0) accepta orice suma pozitiva.
 */
export function validateAvans(text: string, deviz: { total: number; rest: number }): AvansCheck {
  const parsed = parseDecimal(text, { maxDecimals: 2 });
  if (!parsed.valid) {
    return { ok: false, message: "Suma nu este un număr valid. Folosește cel mult 2 zecimale (ex. 150,50)." };
  }
  const amount = parsed.value;
  if (amount == null || amount <= 0) {
    return { ok: false, message: "Introdu o sumă mai mare decât zero." };
  }
  if (deviz.total > 0) {
    if (deviz.rest <= 0) {
      return { ok: false, message: "Devizul este deja încasat integral." };
    }
    // Comparam in bani intregi: 0.1 + 0.2 nu trebuie sa „depaseasca” 0.3.
    if (Math.round(amount * 100) > Math.round(deviz.rest * 100)) {
      return { ok: false, message: `Avansul nu poate depăși restul de plată (${lei(deviz.rest)}).` };
    }
  }
  return { ok: true, amount };
}
