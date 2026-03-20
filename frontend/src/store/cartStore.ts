import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  qty: number;
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

// Sincronizare automata cu localStorage
createEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: cart.items }));
});

export function addToCart(product: Omit<CartItem, "qty">) {
  const existing = cart.items.findIndex((i) => i.id === product.id);
  if (existing >= 0) {
    setCart("items", existing, "qty", (q) => q + 1);
  } else {
    setCart("items", (items) => [...items, { ...product, qty: 1 }]);
  }
}

export function removeFromCart(id: number) {
  setCart("items", (items) => items.filter((i) => i.id !== id));
}

export function updateQty(id: number, delta: number) {
  const idx = cart.items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const newQty = cart.items[idx].qty + delta;
  if (newQty <= 0) {
    removeFromCart(id);
  } else {
    setCart("items", idx, "qty", newQty);
  }
}

export function clearCart() {
  setCart("items", []);
}

export function cartTotal() {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount() {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

export { cart };
