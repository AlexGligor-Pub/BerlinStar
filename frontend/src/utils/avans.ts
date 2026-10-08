import { parseDecimal } from "./decimal";

export type AvansCheck =
  | { ok: true; amount: number }
  | { ok: false; message: string };

function lei(n: number): string {
  return `${n.toFixed(2)} lei`;
}

/** Plafon de bun-simt pe un deviz inca fara total (unde restul nu limiteaza). */
const AVANS_MAX = 1_000_000;

/** Sumele rotunde oferite ca scurtaturi in fereastra de avans din POS. */
export const AVANS_SHORTCUTS = [100, 200, 300, 400, 500] as const;

/**
 * Scurtaturile care au sens pentru devizul curent: doar sumele mai mici decat
 * totalul si decat restul de plata (dupa un avans anterior, o suma care atinge
 * restul ar fi oricum refuzata, vezi validateAvans). Un deviz inca fara linii (total 0) nu are plafon,
 * deci le arata pe toate.
 */
export function avansShortcuts(deviz: { total: number; rest: number }): number[] {
  if (!(deviz.total > 0)) return [...AVANS_SHORTCUTS];
  return AVANS_SHORTCUTS.filter(
    (v) => v < deviz.total && Math.round(v * 100) < Math.round(deviz.rest * 100),
  );
}

/**
 * Suma unui avans introdus in POS, verificata inainte de a ajunge la server.
 *
 * `total` si `rest` sunt ale devizului salvat (din registrul de plati). Pe un
 * deviz cu total, avansul trebuie sa fie STRICT mai mic decat restul de plata:
 *  - serverul nu il plafoneaza (in Receptie se poate incasa in avans si peste
 *    total), dar in POS o suma peste rest e aproape sigur o greseala de tastare;
 *  - o suma egala cu restul ar inchide bonul ca platit integral: nu mai e un
 *    avans, iar registrul se inchide, deci nu ar mai putea fi sters din POS.
 * Un deviz inca fara linii (total 0) accepta orice suma pozitiva rezonabila.
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
    // Comparam in bani intregi, nu in virgula mobila (0.7 - 0.4 e sub 0.3).
    if (Math.round(amount * 100) >= Math.round(deviz.rest * 100)) {
      return {
        ok: false,
        message: `Avansul trebuie să fie mai mic decât restul de plată (${lei(deviz.rest)}). Plata integrală se face din Recepție.`,
      };
    }
  }
  if (amount > AVANS_MAX) {
    return { ok: false, message: "Suma este prea mare." };
  }
  return { ok: true, amount };
}
