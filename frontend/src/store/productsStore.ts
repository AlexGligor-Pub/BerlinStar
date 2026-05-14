import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  category: string;
  type: string;
  departmentId: number | null;
  imagePath: string | null;
}

interface RawItem {
  id: number;
  name: string;
  price: string | number;
  unit: string;
  category_name?: string | null;
  type?: string | null;
  department_id?: number | null;
  image_path?: string | null;
}

const CACHE_KEY = "bs_products_cache_v2";

function getCached(): Product[] | null {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved) as Product[];
  } catch {
    // localStorage may be unavailable or corrupted; treat as cache miss
  }
  return null;
}

const [products, setProducts] = createSignal<Product[]>(getCached() ?? []);
const [isOffline, setIsOffline] = createSignal(false);

export async function loadProducts(): Promise<void> {
  try {
    const res = await apiFetch("/api/items?limit=300", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("API error");
    const data = (await res.json()) as { items: RawItem[] };
    const mapped: Product[] = data.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: typeof item.price === "number" ? item.price : parseFloat(item.price),
      unit: item.unit,
      category: item.category_name ?? "",
      type: item.type ?? "Produs",
      departmentId: item.department_id ?? null,
      imagePath: item.image_path ?? null,
    }));
    setProducts(mapped);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(mapped)); } catch {
      // quota or storage disabled — keep in-memory cache regardless
    }
    setIsOffline(false);
  } catch {
    setIsOffline(true);
  }
}

export function clearProducts(): void {
  setProducts([]);
  try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

export { products, isOffline };
