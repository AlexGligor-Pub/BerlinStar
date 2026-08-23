/**
 * Registrul de plati al unui bon: avans / plata / restituire.
 *
 * Liniile bonului spun CE s-a vandut; aceste miscari spun CAND si CUM au circulat
 * banii. Un avans nu micsoreaza totalul bonului — de aceea nu e o linie negativa,
 * ci o inregistrare separata (altfel ar scadea baza de TVA in eFactura).
 */
import { createSignal } from "solid-js";
import { apiFetch, readApiError } from "../utils/api";

export type PaymentKind = "avans" | "plata" | "restituire";
export type PaymentMethod = "Cash" | "Card" | "OP" | "Alta";

export interface Payment {
  id: number;
  receipt_id: number;
  kind: PaymentKind;
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  employee_id: number | null;
  employee_name: string | null;
  note: string | null;
}

export interface PaymentSummary {
  total_bon: string;
  avansuri: string;
  incasat_brut: string;
  restituit: string;
  incasat_net: string;
  rest_de_plata: string;
}

export interface PaymentsResponse {
  payments: Payment[];
  summary: PaymentSummary;
}

/** Semnul cu care miscarea intra in casa: restituirea scade. */
export function paymentSign(kind: PaymentKind): 1 | -1 {
  return kind === "restituire" ? -1 : 1;
}

export const KIND_LABEL: Record<PaymentKind, string> = {
  avans: "Avans",
  plata: "Plată",
  restituire: "Restituire",
};

// Cache per bon, ca sa nu re-cerem la fiecare deschidere de card.
const [cache, setCache] = createSignal<Record<number, PaymentsResponse>>({});
export { cache as paymentsCache };

export function cachedPayments(receiptId: number | string): PaymentsResponse | undefined {
  return cache()[Number(receiptId)];
}

function store(receiptId: number | string, data: PaymentsResponse): PaymentsResponse {
  setCache({ ...cache(), [Number(receiptId)]: data });
  return data;
}

export async function loadPayments(receiptId: number | string): Promise<PaymentsResponse> {
  const res = await apiFetch(`/api/receipts/${receiptId}/payments`);
  if (!res.ok) throw new Error(await readApiError(res, "Eroare la încărcarea plăților."));
  return store(receiptId, await res.json());
}

export async function addPayment(
  receiptId: number | string,
  body: { kind: PaymentKind; amount: string; method: PaymentMethod; note?: string | null; employee_id?: number | null },
): Promise<PaymentsResponse> {
  const res = await apiFetch(`/api/receipts/${receiptId}/payments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Eroare la înregistrarea plății."));
  return store(receiptId, await res.json());
}

export async function deletePayment(
  receiptId: number | string,
  paymentId: number,
): Promise<PaymentsResponse> {
  const res = await apiFetch(`/api/receipts/${receiptId}/payments/${paymentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readApiError(res, "Eroare la ștergerea plății."));
  return store(receiptId, await res.json());
}
