import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { selectedEmployeeId, selectedEmployeeName } from "./employeesStore";

export interface CartItem {
  id: number;           // product catalog id (sau negativ pentru itemi manuali)
  lineId: string;       // unique per line: `${id}_${employeeId ?? ''}`
  name: string;
  price: number;
  unit: string;
  qty: number;
  employeeId: number | null;
  employeeName: string | null;
  employeeTargetPct: number | null;
  itemId: number | null;        // FK către items.id în backend (null pentru itemi manuali)
  itemType: string | null;      // "Produs" | "Service" — snapshot din POS pentru rapoarte
  vatPercent?: number | null;   // TVA per linie (folosit de Factura Rapida pentru ANAF)
  /** Pretul dinainte de reducere. null/undefined = linia nu are reducere.
   *  Reducerea se scade din `price` (vezi DiscountModal), ca atribuirea pe
   *  angajat/produs si TVA-ul pe linie sa ramana corecte. */
  originalPrice?: number | null;
}

interface CartState {
  items: CartItem[];
}

const STORAGE_KEY = "bs_cart";

function loadCart(): CartState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { items: [] };
}

const [cart, setCart] = createStore<CartState>(loadCart());

createEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: cart.items }));
});

export function addToCart(product: Pick<CartItem, "id" | "name" | "price" | "unit"> & { type?: string | null }) {
  const empId = selectedEmployeeId();
  const empName = selectedEmployeeName();
  const lineId = `${product.id}_${empId ?? ""}`;
  const existing = cart.items.findIndex((i) => i.lineId === lineId);
  if (existing >= 0) {
    setCart("items", existing, "qty", (q) => q + 1);
  } else {
    setCart("items", (items) => [
      ...items,
      {
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        lineId,
        qty: 1,
        employeeId: empId,
        employeeName: empName,
        employeeTargetPct: null,
        itemId: product.id > 0 ? product.id : null,
        itemType: product.type ?? null,
      },
    ]);
  }
}

export function removeFromCart(lineId: string) {
  setCart("items", (items) => items.filter((i) => i.lineId !== lineId));
}

export function updateQty(lineId: string, delta: number) {
  const idx = cart.items.findIndex((i) => i.lineId === lineId);
  if (idx < 0) return;
  const newQty = cart.items[idx].qty + delta;
  if (newQty <= 0) {
    removeFromCart(lineId);
  } else {
    setCart("items", idx, "qty", newQty);
  }
}

export function clearCart() {
  setCart("items", []);
}

export function replaceCart(items: CartItem[]) {
  setCart("items", [...items]);
}

export function updateItemPrice(lineId: string, price: number) {
  const idx = cart.items.findIndex((i) => i.lineId === lineId);
  if (idx >= 0) setCart("items", idx, "price", price);
}

export function setItemQty(lineId: string, qty: number) {
  if (qty <= 0) { removeFromCart(lineId); return; }
  const idx = cart.items.findIndex((i) => i.lineId === lineId);
  if (idx >= 0) setCart("items", idx, "qty", qty);
}

/**
 * Schimba angajatul asociat unei linii din cos. Pastram `lineId` neschimbat —
 * el ramane unic in cos. Daca exista o linie identica (acelasi produs, acelasi
 * angajat nou), `addToCart` viitor o va merge-ui pe lineId-ul ei propriu;
 * aici doar actualizam linia curenta fara fuziuni implicite, ca user-ul sa
 * vada exact ce a modificat (fara surpriza ca linia "dispare" si cantitatea
 * sare in alta linie).
 */
export function updateItemEmployee(
  lineId: string,
  employeeId: number | null,
  employeeName: string | null,
): void {
  const idx = cart.items.findIndex((i) => i.lineId === lineId);
  if (idx < 0) return;
  setCart("items", idx, "employeeId", employeeId);
  setCart("items", idx, "employeeName", employeeName);
}

let _manualCounter = 0;

export function addManualItem(
  name: string,
  qty: number,
  price: number,
  unit: string,
  itemType: string | null = null,
) {
  const empId = selectedEmployeeId();
  const empName = selectedEmployeeName();
  const uniqueId = -(++_manualCounter);
  const lineId = `manual_${uniqueId}_${empId ?? ""}`;
  setCart("items", (items) => [
    ...items,
    { id: uniqueId, lineId, name, price, unit, qty, employeeId: empId, employeeName: empName, employeeTargetPct: null, itemId: null, itemType },
  ]);
}

export function cartTotal() {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount() {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

export { cart };
