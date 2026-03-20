import { For, Show } from "solid-js";
import { cart, updateQty, clearCart, cartTotal } from "../store/cartStore";
import { useNavigate } from "@solidjs/router";

export default function ShoppingList() {
  const navigate = useNavigate();

  return (
    <div class="shopping-list">
      <div class="shopping-list-header">
        <span class="shopping-list-title">Lista</span>
        <Show when={cart.items.length > 0}>
          <button class="btn btn-ghost btn-sm" onClick={clearCart}>Sterge tot</button>
        </Show>
      </div>

      <div class="shopping-list-body">
        <Show
          when={cart.items.length > 0}
          fallback={<div class="empty-list">Niciun produs selectat</div>}
        >
          <For each={cart.items}>
            {(item) => (
              <div class="list-item">
                <span class="list-item-name">{item.name}</span>
                <div class="list-item-qty">
                  <button class="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                  <span class="qty-value">{item.qty}</span>
                  <button class="qty-btn" onClick={() => updateQty(item.id, +1)}>+</button>
                </div>
                <span class="list-item-price">{(item.price * item.qty).toFixed(2)}</span>
              </div>
            )}
          </For>
        </Show>
      </div>

      <div class="shopping-list-footer">
        <div class="total-row">
          <span>Total</span>
          <span class="text-accent">{cartTotal().toFixed(2)} lei</span>
        </div>
        <button
          class="btn btn-primary w-full"
          disabled={cart.items.length === 0}
          onClick={() => navigate("/receptie")}
        >
          Finalizeaza
        </button>
      </div>
    </div>
  );
}
