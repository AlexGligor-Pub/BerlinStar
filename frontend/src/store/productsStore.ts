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
// Catalogul vine in pagini de 300 (plafonul serverului). Cat timp nu s-au adus
// toate paginile (sau cat timp nu s-a incarcat nimic de la server), absenta unui
// produs din lista NU inseamna ca nu exista — vezi mesajul „departament fara
// produse" din POS.
const [productsComplete, setProductsComplete] = createSignal(false);

const PAGE_SIZE = 300;
// Plasa de siguranta impotriva unui cursor care nu avanseaza (15.000 de articole).
const MAX_PAGES = 50;

function mapItem(item: RawItem): Product {
  return {
    id: item.id,
    name: item.name,
    price: typeof item.price === "number" ? item.price : parseFloat(item.price),
    unit: item.unit,
    category: item.category_name ?? "",
    type: item.type ?? "Produs",
    departmentId: item.department_id ?? null,
    imagePath: item.image_path ?? null,
  };
}

export async function loadProducts(): Promise<void> {
  // Fara nimic afisat (prima deschidere, fara cache) aratam paginile pe masura ce
  // sosesc. Cu o lista deja afisata o inlocuim abia la final, altfel produsele din
  // paginile urmatoare ar disparea din POS pana se termina incarcarea.
  const progressive = products().length === 0;
  try {
    const mapped: Product[] = [];
    const seen = new Set<number>();
    let cursor: number | null = null;
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      // Sortarea implicita din /api/items e pe id, deci `last_id` e un keyset corect.
      const qs: string = cursor == null ? "" : `&last_id=${cursor}`;
      const res = await apiFetch(`/api/items?limit=${PAGE_SIZE}${qs}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("API error");
      const data = (await res.json()) as { items: RawItem[]; next_cursor: number | null };
      for (const item of data.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        mapped.push(mapItem(item));
      }
      cursor = data.next_cursor ?? null;
      if (cursor == null) { complete = true; break; }
      if (progressive) {
        setProductsComplete(false);
        setProducts([...mapped]);
      }
    }
    setProducts(mapped);
    setProductsComplete(complete);
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
  setProductsComplete(false);
  try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

export { products, isOffline, productsComplete };
