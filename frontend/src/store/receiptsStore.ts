import { createSignal } from "solid-js";
import type { CartItem } from "./cartStore";

export interface Receipt {
  id: string;
  date: string; // ISO string
  casier: string;
  titlu: string;
  descriere?: string;
  dateTehn?: string;
  items: CartItem[];
  total: number;
}

const STORAGE_KEY = "bs_receipts";

function load(): Receipt[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

const [receipts, setReceipts] = createSignal<Receipt[]>(load());

export function saveReceipt(receipt: Omit<Receipt, "id">) {
  const newReceipt: Receipt = { ...receipt, id: Date.now().toString() };
  const updated = [newReceipt, ...receipts()];
  setReceipts(updated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newReceipt;
}

export function deleteReceipt(id: string) {
  const updated = receipts().filter((r) => r.id !== id);
  setReceipts(updated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export { receipts };
