import { createSignal } from "solid-js";

export interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  category: string;
}

// Date demo — vor fi inlocuite cu date din API in Faza 2
const DEMO_PRODUCTS: Product[] = [
  { id: 1, name: "Coca-Cola 0.5L", price: 5.5, unit: "buc", category: "Bauturi" },
  { id: 2, name: "Apa Plata 0.5L", price: 2.0, unit: "buc", category: "Bauturi" },
  { id: 3, name: "Bere Ursus 0.5L", price: 7.0, unit: "buc", category: "Bauturi" },
  { id: 4, name: "Suc Portocale 1L", price: 9.5, unit: "buc", category: "Bauturi" },
  { id: 5, name: "Paine Alba", price: 4.0, unit: "buc", category: "Alimente" },
  { id: 6, name: "Lapte 1L", price: 8.5, unit: "buc", category: "Alimente" },
  { id: 7, name: "Oua (10 buc)", price: 14.0, unit: "cutie", category: "Alimente" },
  { id: 8, name: "Cascaval 200g", price: 18.0, unit: "pac", category: "Alimente" },
  { id: 9, name: "Chips Lays", price: 7.5, unit: "buc", category: "Snacks" },
  { id: 10, name: "Ciocolata Milka", price: 12.0, unit: "buc", category: "Snacks" },
  { id: 11, name: "Guma Orbit", price: 5.0, unit: "buc", category: "Snacks" },
  { id: 12, name: "Baton KitKat", price: 6.0, unit: "buc", category: "Snacks" },
];

const CACHE_KEY = "bs_products_cache";

function getCached(): Product[] | null {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

const cached = getCached();
const [products, setProducts] = createSignal<Product[]>(cached ?? DEMO_PRODUCTS);
const [isOffline, setIsOffline] = createSignal(false);

export async function loadProducts() {
  // Incarca din cache imediat (deja facut la initializare)
  // Incearca sa actualizeze din API
  try {
    const res = await fetch("/api/products", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("API error");
    const data: Product[] = await res.json();
    setProducts(data);
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    setIsOffline(false);
  } catch {
    // Backend indisponibil — folosim cache sau datele demo
    setIsOffline(true);
  }
}

export { products, isOffline };
