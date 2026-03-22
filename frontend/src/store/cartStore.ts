import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { selectedEmployeeId, selectedEmployeeName } from "./employeesStore";

export interface CartItem {
  id: number;           // product catalog id
  lineId: string;       // unique per line: `${id}_${employeeId ?? ''}`
  name: string;
  price: number;
  unit: string;
  qty: number;
  employeeId: number | null;
  employeeName: string | null;
  employeeTargetPct: number | null;
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

export function addToCart(product: Pick<CartItem, "id" | "name" | "price" | "unit">) {
  const empId = selectedEmployeeId();
  const empName = selectedEmployeeName();
  const lineId = `${product.id}_${empId ?? ""}`;
  const existing = cart.items.findIndex((i) => i.lineId === lineId);
  if (existing >= 0) {
    setCart("items", existing, "qty", (q) => q + 1);
  } else {
    setCart("items", (items) => [
      ...items,
      { ...product, lineId, qty: 1, employeeId: empId, employeeName: empName, employeeTargetPct: null },
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

let _manualCounter = 0;

export function addManualItem(name: string, qty: number, price: number, unit: string) {
  const empId = selectedEmployeeId();
  const empName = selectedEmployeeName();
  const uniqueId = -(++_manualCounter);
  const lineId = `manual_${uniqueId}_${empId ?? ""}`;
  setCart("items", (items) => [
    ...items,
    { id: uniqueId, lineId, name, price, unit, qty, employeeId: empId, employeeName: empName, employeeTargetPct: null },
  ]);
}

export function cartTotal() {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount() {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

export { cart };
