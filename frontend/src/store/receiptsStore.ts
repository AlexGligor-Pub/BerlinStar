import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";
import type { CartItem } from "./cartStore";

export interface Receipt {
  id: string;
  date: string;
  casier: string;
  titlu: string;
  descriere?: string;
  dateTehn?: string;
  metodaPlata?: string;
  partialPay?: number;
  items: CartItem[];
  total: number;
}

const CACHE_KEY = "bs_receipts";

function mapFromApi(r: any): Receipt {
  return {
    id: String(r.id),
    date: r.created_at,
    casier: r.casier,
    titlu: r.titlu,
    descriere: r.descriere ?? undefined,
    dateTehn: r.date_tehn ?? undefined,
    metodaPlata: r.pay_method !== "Neplatit" ? r.pay_method : undefined,
    partialPay: r.partial_pay != null ? parseFloat(r.partial_pay) : undefined,
    items: r.receipt_items.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: parseFloat(i.price),
      qty: i.qty,
      unit: i.unit,
    })),
    total: parseFloat(r.total),
  };
}

function loadCache(): Receipt[] {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const [receipts, setReceipts] = createSignal<Receipt[]>(loadCache());

export async function loadReceipts() {
  try {
    const res = await apiFetch("/api/receipts?limit=100&sort=-id");
    if (!res.ok) return;
    const data = await res.json();
    const mapped: Receipt[] = data.items.map(mapFromApi);
    setReceipts(mapped);
    localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
  } catch {
    // ramane cache-ul existent
  }
}

export async function saveReceipt(receipt: Omit<Receipt, "id">): Promise<Receipt> {
  const body = {
    casier: receipt.casier,
    titlu: receipt.titlu,
    descriere: receipt.descriere ?? null,
    date_tehn: receipt.dateTehn ?? null,
    pay_method: receipt.metodaPlata ?? "Neplatit",
    items: receipt.items.map((i) => ({
      name: i.name,
      price: i.price.toFixed(2),
      qty: i.qty,
      unit: i.unit,
    })),
    total: receipt.total.toFixed(2),
  };

  const res = await apiFetch("/api/receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Eroare la salvarea bonului.");
  const created = mapFromApi(await res.json());
  setReceipts([created, ...receipts()]);
  localStorage.setItem(CACHE_KEY, JSON.stringify(receipts()));
  return created;
}

export async function updateMetodaPlata(id: string, metodaPlata: string | null, partialPay?: number) {
  const pay_method = metodaPlata ?? "Neplatit";
  const res = await apiFetch(`/api/receipts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      pay_method,
      partial_pay: pay_method === "Platit Partial" ? (partialPay ?? 100) : null,
    }),
  });
  if (!res.ok) return;
  const updated = receipts().map((r) =>
    r.id === id ? {
      ...r,
      metodaPlata: pay_method !== "Neplatit" ? pay_method : undefined,
      partialPay: pay_method === "Platit Partial" ? (partialPay ?? 100) : undefined,
    } : r
  );
  setReceipts(updated);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export async function deleteReceipt(id: string) {
  await apiFetch(`/api/receipts/${id}`, { method: "DELETE" });
  const updated = receipts().filter((r) => r.id !== id);
  setReceipts(updated);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export { receipts };
