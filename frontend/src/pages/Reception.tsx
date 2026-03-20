import { For, Show, createSignal, onMount } from "solid-js";
import { receipts, deleteReceipt, loadReceipts, updateMetodaPlata, type Receipt } from "../store/receiptsStore";
import { generateReceiptPdf } from "../utils/generateReceiptPdf";

const METODE = ["Platit cash", "Platit cu cardul", "Platit prin OP", "Platit Partial"];

function ReceiptCard(props: { receipt: Receipt }) {
  const [expanded, setExpanded] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [metodaDraft, setMetodaDraft] = createSignal(props.receipt.metodaPlata ?? "");
  const [partialDraft, setPartialDraft] = createSignal(
    props.receipt.partialPay?.toFixed(2) ?? "100.00"
  );
  const [saving, setSaving] = createSignal(false);
  const r = props.receipt;

  const isPartial = () => metodaDraft() === "Platit Partial";
  const metodaChanged = () =>
    metodaDraft() !== (r.metodaPlata ?? "") ||
    (isPartial() && partialDraft() !== (r.partialPay?.toFixed(2) ?? "100.00"));

  async function handleSaveMetoda() {
    setSaving(true);
    const partial = isPartial() ? parseFloat(partialDraft()) || 100 : undefined;
    await updateMetodaPlata(r.id, metodaDraft() || null, partial);
    setSaving(false);
  }
  const date = new Date(r.date);
  const dateStr = date.toLocaleDateString("ro-RO");
  const timeStr = date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div class="rcard" classList={{ "rcard--open": expanded() }}>
      {/* Header card — click pentru expand */}
      <div class="rcard-header" onClick={() => setExpanded((v) => !v)}>
        <div class="rcard-info">
          <span class="rcard-titlu">{r.titlu}</span>
          <span class="rcard-meta">{dateStr} {timeStr} &middot; {r.casier}</span>
        </div>
        <div class="rcard-right">
          <div class="rcard-right-col">
            <span class="rcard-total">{r.total.toFixed(2)} lei</span>
            <span class="rcard-metoda" classList={{ "rcard-metoda--neplatit": !r.metodaPlata }}>
              {r.metodaPlata ?? "Neplatit"}
            </span>
          </div>
          <span class="rcard-chevron">{expanded() ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Receipt detaliat */}
      <Show when={expanded()}>
        <div class="rcard-body">
          <div class="rcard-body-inner">
          <div class="receipt">
            <div class="receipt-divider" />

            <div class="receipt-items">
              <For each={r.items}>
                {(item) => (
                  <div class="receipt-item">
                    <span class="receipt-item-name">{item.name}</span>
                    <span class="receipt-item-qty">{item.qty} x {item.price.toFixed(2)}</span>
                    <span class="receipt-item-total">{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="receipt-divider" />

            <div class="receipt-total">
              <span>TOTAL</span>
              <span>{r.total.toFixed(2)} lei</span>
            </div>

            {r.metodaPlata && (
              <div class="receipt-plata">
                <span>Metoda de plata</span>
                <span>{r.metodaPlata}</span>
              </div>
            )}

            <div class="receipt-divider receipt-divider--dashed" />

            <div class="receipt-actions">
              <button class="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                Sterge
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => generateReceiptPdf(r)}>
                Descarca PDF
              </button>
            </div>

          </div>

          {/* Coloana dreapta */}
          <div class="rcard-extra-col">
            {/* Status plata */}
            <div class="rcard-extra-card">
              <div class="rcard-extra-title">Status plata</div>
              <select
                class="rcard-plata-select"
                value={metodaDraft()}
                onChange={(e) => setMetodaDraft(e.currentTarget.value)}
              >
                <option value="">Neplatit</option>
                <For each={METODE}>
                  {(m) => <option value={m}>{m}</option>}
                </For>
              </select>
              <Show when={isPartial()}>
                <div style="margin-top:8px;display:flex;align-items:center;gap:6px">
                  <input
                    class="rcard-plata-select"
                    type="number"
                    min="0"
                    step="10"
                    value={partialDraft()}
                    onInput={(e) => setPartialDraft(e.currentTarget.value)}
                    style="flex:1"
                  />
                  <span style="font-size:0.82rem;white-space:nowrap">lei</span>
                </div>
              </Show>
              <Show when={metodaChanged()}>
                <button
                  class="btn btn-primary btn-sm w-full"
                  style="margin-top:8px"
                  disabled={saving()}
                  onClick={handleSaveMetoda}
                >
                  {saving() ? "Se salveaza..." : "Salveaza"}
                </button>
              </Show>
            </div>

            <Show when={!!r.descriere}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Descriere</div>
                <div class="rcard-extra-text">{r.descriere}</div>
              </div>
            </Show>
            <Show when={!!r.dateTehn}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Date tehnice</div>
                <div class="rcard-extra-text">{r.dateTehn}</div>
              </div>
            </Show>
          </div>

          </div>
        </div>
      </Show>

      {/* Modal confirmare stergere */}
      <Show when={confirmDelete()}>
        <div class="sl-modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Sterge bon</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>✕</button>
            </div>
            <p style="font-size:0.88rem">
              Esti sigur ca vrei sa stergi bonul <strong>{r.titlu}</strong>? Actiunea este ireversibila.
            </p>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Anuleaza</button>
              <button class="btn btn-danger btn-sm" onClick={() => deleteReceipt(r.id)}>Sterge definitiv</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default function Reception() {
  onMount(() => { loadReceipts(); });
  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Receptie</h1>
        <span class="text-muted" style="font-size:0.85rem">{receipts().length} bonuri</span>
      </div>

      <Show
        when={receipts().length > 0}
        fallback={
          <div class="card" style="text-align:center;padding:48px 16px">
            <div class="text-muted">Nu exista bonuri inregistrate.</div>
          </div>
        }
      >
        <div class="rcard-list">
          <For each={receipts()}>
            {(r) => <ReceiptCard receipt={r} />}
          </For>
        </div>
      </Show>
    </div>
  );
}
