import { For, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { receipts, deleteReceipt, loadReceipts, updateMetodaPlata, connectSSE, disconnectSSE, posCount, type Receipt } from "../store/receiptsStore";
import { generateReceiptPdf } from "../utils/generateReceiptPdf";
import { setResume } from "../store/resumeStore";

const METODE = ["Platit cash", "Platit cu cardul", "Platit prin OP", "Platit Partial"];

function ReceiptCard(props: { receipt: Receipt }) {
  const navigate = useNavigate();
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
          <Show when={!r.metodaPlata}>
            <button
              class="btn btn-sm btn-primary rcard-continua-btn"
              onClick={(e) => {
                e.stopPropagation();
                setResume({
                  titlu: r.titlu,
                  descriere: r.descriere ?? "",
                  dateTehn: r.dateTehn ?? "",
                  items: r.items,
                });
                navigate("/");
              }}
            >
              →POS
            </button>
          </Show>
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

const FILTER_OPTIONS = ["Neplatit", ...METODE];

export default function Reception() {
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");

  onMount(() => {
    loadReceipts();
    connectSSE();
  });

  onCleanup(() => disconnectSSE());

  function toggleOption(opt: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      return next;
    });
  }

  function onOutside(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest(".filter-dropdown")) setMenuOpen(false);
  }
  document.addEventListener("click", onOutside);
  onCleanup(() => document.removeEventListener("click", onOutside));

  const filtered = createMemo(() => {
    const sel = selected();
    const q = search().toLowerCase().trim();
    return receipts().filter((r) => {
      const matchMetoda = sel.size === 0 || sel.has(r.metodaPlata ?? "Neplatit");
      const matchSearch = !q || r.titlu.toLowerCase().includes(q);
      return matchMetoda && matchSearch;
    });
  });

  const hasFilter = () => selected().size > 0;

  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Receptie</h1>
        <div class="reception-header-right">
          <input
            class="input reception-search"
            type="search"
            placeholder="Cauta dupa titlu..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <div class="filter-dropdown">
            <button
              class="btn btn-sm btn-ghost filter-dropdown-btn"
              classList={{ "filter-dropdown-btn--active": hasFilter() }}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              Filtru
              {hasFilter() && <span class="filter-badge">{selected().size}</span>}
              <span class="filter-chevron">{menuOpen() ? "▲" : "▼"}</span>
            </button>

            <Show when={menuOpen()}>
              <div class="filter-menu">
                <For each={FILTER_OPTIONS}>
                  {(opt) => (
                    <button
                      class="filter-menu-item"
                      classList={{ "filter-menu-item--active": selected().has(opt) }}
                      onClick={() => toggleOption(opt)}
                    >
                      {opt}
                    </button>
                  )}
                </For>
                <Show when={hasFilter()}>
                  <button
                    class="btn btn-ghost btn-sm filter-clear-btn"
                    onClick={() => setSelected(new Set())}
                  >
                    Sterge filtre
                  </button>
                </Show>
              </div>
            </Show>
          </div>
          <span class="reception-count">{filtered().length} / {receipts().length} bonuri</span>
          <span class="reception-pos-count" title="POS-uri active">· {posCount()} POS</span>
        </div>
      </div>


      <Show
        when={filtered().length > 0}
        fallback={
          <div class="card" style="text-align:center;padding:48px 16px">
            <div class="text-muted">
              {receipts().length === 0 ? "Nu exista bonuri inregistrate." : "Niciun bon pentru filtrul selectat."}
            </div>
          </div>
        }
      >
        <div class="rcard-list">
          <For each={filtered()}>
            {(r) => <ReceiptCard receipt={r} />}
          </For>
        </div>
      </Show>

    </div>
  );
}
