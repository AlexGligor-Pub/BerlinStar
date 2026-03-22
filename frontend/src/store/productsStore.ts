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

const CACHE_KEY = "bs_products_cache_v2";

function getCached(): Product[] | null {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

const [products, setProducts] = createSignal<Product[]>(getCached() ?? []);
const [isOffline, setIsOffline] = createSignal(false);

export async function loadProducts() {
  try {
    const res = await apiFetch("/api/items?limit=100", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const mapped: Product[] = data.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price),
      unit: item.unit,
      category: item.category_name ?? "",
      type: item.type ?? "Produs",
      departmentId: item.department_id ?? null,
      imagePath: item.image_path ?? null,
    }));
    setProducts(mapped);
    localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
    setIsOffline(false);
  } catch {
    setIsOffline(true);
  }
}

export { products, isOffline };
