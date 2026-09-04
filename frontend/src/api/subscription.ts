import { http } from "./client";

export interface CheckoutCustomer {
  nume: string;
  tip: "juridic" | "fizic";
  cui: string | null;
  email: string;
  telefon: string | null;
  street: string | null;
  city: string | null;
  county_code: string | null;
  postal_code: string | null;
  country_code: string;
}

export interface AmountsOut {
  payment_id: number;
  amount_ron: number;
  amount_eur: number;
  vat_amount_ron: number;
  fx_rate: number;
  fx_date: string;
  currency: string;
  test_mode: boolean;
}

export interface CheckoutResponse extends AmountsOut {
  client_secret: string;
  payment_intent_id: string;
  publishable_key: string;
}

export interface CheckoutSessionResponse extends AmountsOut {
  session_id: string;
  url: string;
  expires_at: string;
}

export interface PaymentItem {
  id: number;
  status: string;
  paid_at: string | null;
  amount_ron: number;
  amount_eur: number;
  payment_method: string | null;
  period_start: string | null;
  period_end: string | null;
  failure_reason: string | null;
  invoice_number: string | null;
  invoice_issue_date: string | null;
  anaf_status: string | null;
  pdf_available: boolean;
  zip_available: boolean;
}

export const subscriptionApi = {
  meRaw: () => http.raw("/api/subscription/me"),
  paymentsRaw: () => http.raw("/api/subscription/payments"),
  invoicePdfUrl: (paymentId: number) => `/api/subscription/invoices/${paymentId}/pdf`,
  invoiceAnafZipUrl: (paymentId: number) => `/api/subscription/invoices/${paymentId}/anaf-zip`,
  /** Descarcare autentificata (blob); apelantul face URL.createObjectURL. */
  download: (url: string) => http.raw(url),
  checkout: (customer: CheckoutCustomer) =>
    http.post<CheckoutResponse>("/api/subscription/checkout", { customer }),
  /** Pagina Stripe hosted (QR): card / Google Pay / Apple Pay / PayPal. */
  checkoutSession: (customer: CheckoutCustomer, returnUrl: string) =>
    http.post<CheckoutSessionResponse>("/api/subscription/checkout-session", { customer, return_url: returnUrl }),
  payment: (paymentId: number) => http.get<PaymentItem>(`/api/subscription/payments/${paymentId}`),
  /** Reconciliere cu Stripe fara webhook (dev local, QR platit pe telefon). */
  syncPayment: (paymentId: number) => http.post<PaymentItem>(`/api/subscription/payments/${paymentId}/sync`),
};

export function paymentMethodLabel(m: string | null | undefined): string {
  switch (m) {
    case "card": return "Card";
    case "google_pay": return "Google Pay";
    case "apple_pay": return "Apple Pay";
    case "paypal": return "PayPal";
    case "link": return "Link";
    case null:
    case undefined:
    case "": return "—";
    default: return m;
  }
}
