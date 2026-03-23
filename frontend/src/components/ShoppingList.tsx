import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { cart, updateQty, clearCart, cartTotal, replaceCart, updateItemPrice, setItemQty, removeFromCart, addManualItem, type CartItem } from "../store/cartStore";
import { saveReceipt } from "../store/receiptsStore";
import { consumeResume, pendingLoad, clearPendingLoad } from "../store/resumeStore";
import { selectedEmployee, selectEmployee } from "../store/employeesStore";

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
  const [editItem, setEditItem] = createSignal<CartItem | null>(null);
  const [editQty, setEditQty] = createSignal("1");
  const [editPrice, setEditPrice] = createSignal("0");

  const [showClearConfirm, setShowClearConfirm] = createSignal(false);

  const [showManual, setShowManual] = createSignal(false);
  const [manualName, setManualName] = createSignal("");
  const [manualQty, setManualQty] = createSignal("1");
  const [manualPrice, setManualPrice] = createSignal("");
  const [manualTip, setManualTip] = createSignal("Produs");
  const [manualUnit, setManualUnit] = createSignal("buc");

  function openManual() {
    setManualName("");
    setManualQty("1");
    setManualPrice("");
    setManualTip("Produs");
    setManualUnit("buc");
    setShowManual(true);
  }

  function confirmManual() {
    const name = manualName().trim();
    if (!name) return;
    const qty = parseInt(manualQty()) || 1;
    const price = parseFloat(manualPrice()) || 0;
    addManualItem(name, qty, price, manualUnit().trim() || "buc");
    setShowManual(false);
  }

  function openEditItem(item: CartItem) {
    setEditItem(item);
    setEditQty(String(item.qty));
    setEditPrice(String(item.price));
  }

  function confirmEditItem() {
    const item = editItem();
    if (!item) return;
    const qty = parseInt(editQty()) || 0;
    const price = parseFloat(editPrice()) || 0;
    updateItemPrice(item.lineId, price);
    setItemQty(item.lineId, qty);
    setEditItem(null);
  }

  onMount(() => {
    const r = consumeResume();
    if (r) {
      setTitlu(r.titlu);
      setDescriere(r.descriere);
      setDateTehn(r.dateTehn);
      replaceCart(r.items);
    }
  });

  createEffect(() => {
    const d = pendingLoad();
    if (!d) return;
    clearPendingLoad();
    setTitlu(d.titlu);
    setDescriere(d.descriere);
    setDateTehn(d.dateTehn);
    replaceCart(d.items);
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
        titlu: titlu().trim(),
        clientId: null,
        clientNume: null,
        clientCui: null, clientAdresa: null, clientTelefon: null, clientTip: null, clientReprezentant: null,
        descriere: descriere().trim() || undefined,
        dateTehn: dateTehn().trim() || undefined,
        items: [...cart.items],
        total: cartTotal(),
        devizSerie: "", devizNr: 0,
        facturaSerie: "", facturaNr: 0,
        chitantaSerie: "", chitantaNr: 0,
      });
      clearCart();
      selectEmployee(null);
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
        <div class="sl-header-left">
          <Show when={selectedEmployee() !== null}>
            {(() => {
              const e = selectedEmployee()!;
              return (
                <span class="sl-employee-badge">
                  <Show when={e.imagePath}>
                    <img src={e.imagePath!} class="sl-employee-badge-avatar" alt={e.name} />
                  </Show>
                  <span class="sl-employee-badge-info">
                    <span class="sl-employee-badge-name">{e.name}</span>
                    <Show when={e.target > 0}>
                      <span class="sl-employee-badge-pct">
                        {Math.round(e.currentTargetAccumulation / e.target * 100)}%
                      </span>
                    </Show>
                  </span>
                </span>
              );
            })()}
          </Show>
        </div>
        <div class="sl-header-right">
          <button class="btn btn-ghost btn-sm sl-extra-btn" onClick={openManual} title="Adauga produs manual">+ Manual</button>
          <Show when={cart.items.length > 0}>
            <button class="btn btn-ghost btn-sm sl-extra-btn" onClick={() => setShowClearConfirm(true)}>Sterge tot</button>
          </Show>
        </div>
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
              <div class="list-item" onClick={() => openEditItem(item)}>
                <div class="list-item-info">
                  <span class="list-item-name">{item.name}</span>
                  <Show when={item.employeeName}>
                    <span class="list-item-employee">{item.employeeName}</span>
                  </Show>
                </div>
                <div class="list-item-qty" onClick={(e) => e.stopPropagation()}>
                  <button class="qty-btn" onClick={() => updateQty(item.lineId, -1)}>−</button>
                  <span class="qty-value">{item.qty}</span>
                  <button class="qty-btn" onClick={() => updateQty(item.lineId, +1)}>+</button>
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

      {/* Clear confirm modal */}
      <Show when={showClearConfirm()}>
        <div class="sl-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Șterge tot</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowClearConfirm(false)}>✕</button>
            </div>
            <p style="padding:16px 0;text-align:center;color:var(--text-muted)">Ești sigur că vrei să ștergi toate produsele din coș?</p>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowClearConfirm(false)}>Anulează</button>
              <button class="btn btn-danger btn-sm" onClick={() => { clearCart(); setShowClearConfirm(false); }}>Șterge tot</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit item modal */}
      <Show when={editItem() !== null}>
        <div class="sl-modal-overlay" onClick={() => setEditItem(null)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">{editItem()!.name}</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <div class="sl-edit-item-body">
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Cantitate</label>
                <input
                  class="input sl-edit-input"
                  type="number"
                  min="1"
                  step="1"
                  value={editQty()}
                  onInput={(e) => setEditQty(e.currentTarget.value)}
                  autofocus
                />
              </div>
              <div class="sl-qty-presets">
                {[10, 50, 100, 200, 300, 500, 1000].map(v => (
                  <button class="btn btn-ghost btn-xs sl-qty-preset-btn" onClick={() => setEditQty(String(v))}>{v}</button>
                ))}
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Pret (lei)</label>
                <input
                  class="input sl-edit-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPrice()}
                  onInput={(e) => setEditPrice(e.currentTarget.value)}
                />
              </div>
              <div class="sl-edit-item-total">
                Total: {((parseFloat(editPrice()) || 0) * (parseInt(editQty()) || 0)).toFixed(2)} lei
              </div>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-danger btn-sm" onClick={() => { removeFromCart(editItem()!.lineId); setEditItem(null); }}>Sterge</button>
              <div style="flex:1" />
              <button class="btn btn-ghost btn-sm" onClick={() => setEditItem(null)}>Anuleaza</button>
              <button class="btn btn-primary btn-sm" onClick={confirmEditItem}>Salveaza</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Error modal */}
      <Show when={errorMsg() !== null}>
        <div class="sl-modal-overlay" onClick={() => setErrorMsg(null)}>
          <div class="sl-error-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-error-modal-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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

      {/* Manual item modal */}
      <Show when={showManual()}>
        <div class="sl-modal-overlay" onClick={() => setShowManual(false)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Adauga produs manual</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowManual(false)}>✕</button>
            </div>
            <div class="sl-edit-item-body">
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Nume *</label>
                <input
                  class="input sl-edit-input"
                  type="text"
                  placeholder="Ex: Transport, Consultanta..."
                  value={manualName()}
                  onInput={(e) => setManualName(e.currentTarget.value)}
                  autofocus
                />
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Tip</label>
                <select
                  class="input sl-edit-input"
                  value={manualTip()}
                  onChange={(e) => {
                    setManualTip(e.currentTarget.value);
                    setManualUnit(e.currentTarget.value === "Serviciu" ? "ora" : "buc");
                  }}
                >
                  <option value="Produs">Produs</option>
                  <option value="Serviciu">Serviciu</option>
                </select>
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">U.M.</label>
                <input
                  class="input sl-edit-input"
                  type="text"
                  placeholder="buc, ora, kg, m..."
                  value={manualUnit()}
                  onInput={(e) => setManualUnit(e.currentTarget.value)}
                />
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Cantitate</label>
                <input
                  class="input sl-edit-input"
                  type="number"
                  min="1"
                  step="1"
                  value={manualQty()}
                  onInput={(e) => setManualQty(e.currentTarget.value)}
                />
              </div>
              <div class="sl-qty-presets">
                {[10, 50, 100, 200, 300, 500, 1000].map(v => (
                  <button class="btn btn-ghost btn-xs sl-qty-preset-btn" onClick={() => setManualQty(String(v))}>{v}</button>
                ))}
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Pret (lei)</label>
                <input
                  class="input sl-edit-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={manualPrice()}
                  onInput={(e) => setManualPrice(e.currentTarget.value)}
                />
              </div>
              <div class="sl-edit-item-total">
                Total: {((parseFloat(manualPrice()) || 0) * (parseInt(manualQty()) || 0)).toFixed(2)} lei
              </div>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowManual(false)}>Anuleaza</button>
              <button
                class="btn btn-primary btn-sm"
                disabled={manualName().trim() === ""}
                onClick={confirmManual}
              >
                Adauga
              </button>
            </div>
          </div>
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
