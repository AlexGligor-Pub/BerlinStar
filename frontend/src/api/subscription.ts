import { http } from "./client";

export const subscriptionApi = {
  meRaw: () => http.raw("/api/subscription/me"),
  paymentsRaw: () => http.raw("/api/subscription/payments"),
  invoicePdfUrl: (paymentId: number) => `/api/subscription/invoices/${paymentId}/pdf`,
  invoiceAnafZipUrl: (paymentId: number) => `/api/subscription/invoices/${paymentId}/anaf-zip`,
  /** Descarcare autentificata (blob); apelantul face URL.createObjectURL. */
  download: (url: string) => http.raw(url),
  checkout: <T>(body: unknown) => http.post<T>("/api/subscription/checkout", body),
};
