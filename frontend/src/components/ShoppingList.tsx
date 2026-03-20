import { For, Show, createSignal, onMount } from "solid-js";
import { cart, updateQty, clearCart, cartTotal, replaceCart } from "../store/cartStore";
import { auth } from "../store/authStore";
import { saveReceipt } from "../store/receiptsStore";
import { consumeResume } from "../store/resumeStore";

type ModalType = "descriere" | "dateTehn" | null;

export default function ShoppingList() {
  const [titlu, setTitlu] = createSignal("");
  const [descriere, setDescriere] = createSignal("");
  const [dateTehn, setDateTehn] = createSignal("");
  const [modal, setModal] = createSignal<ModalType>(null);
  const [modalDraft, setModalDraft] = createSignal("");
  const [showTitluWarn, setShowTitluWarn] = createSignal(false);
  const [showSuccess, setShowSuccess] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  onMount(() => {
    const r = consumeResume();
    if (r) {
      setTitlu(r.titlu);
      setDescriere(r.descriere);
      setDateTehn(r.dateTehn);
      replaceCart(r.items);
    }
  });

  let warnTimer: ReturnType<typeof setTimeout>;
  let successTimer: ReturnType<typeof setTimeout>;
  function triggerTitluWarn() {
    setShowTitluWarn(true);
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => setShowTitluWarn(false), 3000);
  }

  function openModal(type: ModalType) {
    setModalDraft(type === "descriere" ? descriere() : dateTehn());
    setModal(type);
  }

  function confirmModal() {
    const m = modal();
    if (m === "descriere") setDescriere(modalDraft());
    else if (m === "dateTehn") setDateTehn(modalDraft());
    setModal(null);
  }

  async function handleFinalize() {
    if (cart.items.length === 0) return;
    if (titlu().trim() === "") { triggerTitluWarn(); return; }
    try {
      await saveReceipt({
        date: new Date().toISOString(),
        casier: auth.user ?? "—",
        titlu: titlu().trim(),
        descriere: descriere().trim() || undefined,
        dateTehn: dateTehn().trim() || undefined,
        items: [...cart.items],
        total: cartTotal(),
      });
      clearCart();
      setTitlu("");
      setDescriere("");
      setDateTehn("");
      setShowSuccess(true);
      clearTimeout(successTimer);
      successTimer = setTimeout(() => setShowSuccess(false), 1000);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Eroare necunoscuta.");
    }
  }

  return (
    <div class="shopping-list">
      <div class="shopping-list-header">
        <span class="shopping-list-title">Lista</span>
        <Show when={cart.items.length > 0}>
          <button class="btn btn-ghost btn-sm" onClick={clearCart}>Sterge tot</button>
        </Show>
      </div>

      <div class="shopping-list-titlu">
        <input
          class="input-titlu"
          type="text"
          placeholder="Titlu *"
          maxlength={200}
          value={titlu()}
          onInput={(e) => setTitlu(e.currentTarget.value)}
        />
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": descriere().trim() !== "" }}
          onClick={() => openModal("descriere")}
          title="Descriere"
        >
          Desc.
        </button>
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": dateTehn().trim() !== "" }}
          onClick={() => openModal("dateTehn")}
          title="Date tehnice"
        >
          Tehn.
        </button>
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
          onClick={handleFinalize}
        >
          Finalizeaza
        </button>
      </div>

      {/* Error modal */}
      <Show when={errorMsg() !== null}>
        <div class="sl-modal-overlay" onClick={() => setErrorMsg(null)}>
          <div class="sl-error-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-error-modal-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Eroare la salvare</span>
            </div>
            <p class="sl-error-modal-msg">{errorMsg()}</p>
            <button class="btn btn-primary btn-sm" onClick={() => setErrorMsg(null)}>OK</button>
          </div>
        </div>
      </Show>

      {/* Success modal */}
      <Show when={showSuccess()}>
        <div class="sl-modal-overlay sl-success-overlay">
          <div class="sl-success-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Bon salvat cu succes!</span>
          </div>
        </div>
      </Show>

      {/* Titlu warning toast */}
      <Show when={showTitluWarn()}>
        <div class="titlu-warn-toast">
          Scrie un titlu pentru a finaliza!
        </div>
      </Show>

      {/* Modal */}
      <Show when={modal() !== null}>
        <div class="sl-modal-overlay" onClick={() => setModal(null)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">
                {modal() === "descriere" ? "Descriere" : "Date tehnice"}
              </span>
              <button class="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <textarea
              class="sl-modal-textarea"
              placeholder={modal() === "descriere" ? "Scrie o descriere..." : "Date tehnice..."}
              maxlength={200}
              value={modalDraft()}
              onInput={(e) => setModalDraft(e.currentTarget.value)}
              rows={10}
              autofocus
            />
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Anuleaza</button>
              <button class="btn btn-primary btn-sm" onClick={confirmModal}>Salveaza</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
