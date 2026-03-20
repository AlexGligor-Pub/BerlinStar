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
    metodaPlata: r.metoda_plata ?? undefined,
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
    metoda_plata: receipt.metodaPlata ?? null,
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

export async function deleteReceipt(id: string) {
  await apiFetch(`/api/receipts/${id}`, { method: "DELETE" });
  const updated = receipts().filter((r) => r.id !== id);
  setReceipts(updated);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
}

export { receipts };
