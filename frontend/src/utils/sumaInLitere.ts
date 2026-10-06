/**
 * Suma in litere pentru documentele de incasare (chitanta).
 *
 * Lucreaza in bani intregi. Leii si banii se citesc din aceeasi rotunjire la
 * doua zecimale cu care e tiparita suma in cifre (`toFixed(2)`, vezi `lei()` din
 * utils/pdf/format.ts), ca cifrele si literele de pe document sa nu poata
 * diferi: 150.75 -> 150 lei si 75 bani, nu 151 lei si 75 bani.
 */

/** Suma rotunjita la bani, ca intreg; 0 pentru valori care nu sunt numere finite. */
export function sumaInBani(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const [leiStr, baniStr] = Math.abs(amount).toFixed(2).split(".");
  const bani = Number(leiStr) * 100 + Number(baniStr);
  if (!Number.isSafeInteger(bani)) return 0;
  return amount < 0 ? -bani : bani;
}

export function sumaInLitere(amount: number): string {
  const totalBani = sumaInBani(amount);
  const abs = Math.abs(totalBani);
  const lei = Math.floor(abs / 100);
  const bani = abs % 100;
  const semn = totalBani < 0 ? "minus " : "";
  const s = numarInLitere(lei);
  if (bani > 0) return `${semn}${s} lei si ${numarInLitere(bani)} bani`;
  return `${semn}${s} lei`;
}

export function numarInLitere(n: number): string {
  if (n === 0) return "zero";
  const u = ["", "unu", "doi", "trei", "patru", "cinci", "sase", "sapte", "opt", "noua",
    "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece",
    "saisprezece", "saptesprezece", "optsprezece", "nouasprezece"];
  const z = ["", "", "douazeci", "treizeci", "patruzeci", "cincizeci", "saizeci", "saptezeci", "optzeci", "nouazeci"];

  function sub100(x: number): string {
    if (x < 20) return u[x];
    const zd = Math.floor(x / 10), ud = x % 10;
    return ud === 0 ? z[zd] : `${z[zd]} si ${u[ud]}`;
  }

  function sub1000(x: number): string {
    if (x < 100) return sub100(x);
    const h = Math.floor(x / 100), rest = x % 100;
    const prefix = h === 1 ? "o suta" : h === 2 ? "doua sute" : `${sub100(h)} sute`;
    return rest === 0 ? prefix : `${prefix} ${sub100(rest)}`;
  }

  let result = "";
  if (n >= 1_000_000) { const m = Math.floor(n / 1_000_000); result += `${sub1000(m)} ${m === 1 ? "milion" : "milioane"} `; n %= 1_000_000; }
  if (n >= 1_000)     { const k = Math.floor(n / 1_000);     result += `${sub1000(k)} ${k === 1 ? "mie" : "mii"} `;     n %= 1_000; }
  if (n > 0) result += sub1000(n);
  return result.trim();
}
