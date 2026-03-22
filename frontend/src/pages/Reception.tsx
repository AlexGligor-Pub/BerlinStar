import { For, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { receipts, deleteReceipt, loadReceipts, updateMetodaPlata, updateReceiptClient, connectSSE, disconnectSSE, posCount, type Receipt } from "../store/receiptsStore";
import { generateReceiptPdf } from "../utils/generateReceiptPdf";
import { setResume } from "../store/resumeStore";
import { apiFetch } from "../utils/api";

interface ClientItem {
  id: number;
  tip: "fizic" | "juridic";
  nume: string;
  cui: string | null;
  reprezentant: string | null;
  telefon: string | null;
  email: string | null;
  adresa: string | null;
  description: string | null;
  comments: string | null;
}

function emptyClientForm() {
  return { tip: "fizic" as "fizic" | "juridic", nume: "", description: "", cui: "", reprezentant: "", telefon: "", email: "", adresa: "", comments: "" };
}

type ClientForm = ReturnType<typeof emptyClientForm>;

const METODE = ["Platit cash", "Platit cu cardul", "Platit prin OP", "Platit Partial"];

function ClientFormFields(props: { f: ClientForm; setF: (v: ClientForm) => void }) {
  const f = () => props.f;
  const s = (patch: Partial<ClientForm>) => props.setF({ ...f(), ...patch });
  return (
    <div class="cfg-location-fields" style="gap:6px">
      <div style="display:flex;gap:6px">
        <button class={`btn btn-sm ${f().tip === "fizic" ? "btn-primary" : "btn-ghost"}`} onClick={() => s({ tip: "fizic" })}>Persoană fizică</button>
        <button class={`btn btn-sm ${f().tip === "juridic" ? "btn-primary" : "btn-ghost"}`} onClick={() => s({ tip: "juridic" })}>Persoană juridică</button>
      </div>
      <input class="input" placeholder="Nume *" value={f().nume} onInput={e => s({ nume: e.currentTarget.value })} />
      <input class="input" placeholder="Descriere" value={f().description} onInput={e => s({ description: e.currentTarget.value })} />
      <Show when={f().tip === "juridic"}>
        <input class="input" placeholder="CUI" value={f().cui} onInput={e => s({ cui: e.currentTarget.value })} />
        <input class="input" placeholder="Reprezentant" value={f().reprezentant} onInput={e => s({ reprezentant: e.currentTarget.value })} />
      </Show>
      <input class="input" placeholder="Telefon" value={f().telefon} onInput={e => s({ telefon: e.currentTarget.value })} />
      <input class="input" placeholder="Email" value={f().email} onInput={e => s({ email: e.currentTarget.value })} />
      <input class="input" placeholder="Adresă" value={f().adresa} onInput={e => s({ adresa: e.currentTarget.value })} />
      <textarea class="input" placeholder="Comentarii" rows={2} style="resize:vertical" value={f().comments} onInput={e => s({ comments: e.currentTarget.value })} />
    </div>
  );
}

function ClientSection(props: { receipt: Receipt }) {
  const r = () => props.receipt;
  const [search, setSearch] = createSignal("");
  const [results, setResults] = createSignal<ClientItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);
  const [modalForm, setModalForm] = createSignal(emptyClientForm());
  const [saving, setSaving] = createSignal(false);
  const [modalError, setModalError] = createSignal<string | null>(null);
  const [anafLoading, setAnafLoading] = createSignal(false);

  let debounce: ReturnType<typeof setTimeout>;

  function onInput(val: string) {
    setSearch(val);
    clearTimeout(debounce);
    if (!val.trim()) { setResults([]); return; }
    debounce = setTimeout(() => doSearch(val.trim()), 300);
  }

  async function doSearch(q: string) {
    setSearching(true);
    try {
      const isCui = /^\d+$/.test(q);
      const url = isCui
        ? `/api/clienti?cui=${encodeURIComponent(q)}&limit=20`
        : `/api/clienti?q=${encodeURIComponent(q)}&limit=20`;
      const res = await apiFetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.items ?? []);
    } finally { setSearching(false); }
  }

  async function assign(client: ClientItem) {
    await updateReceiptClient(r().id, client.id);
    setSearch(""); setResults([]);
  }

  async function remove() {
    await updateReceiptClient(r().id, null);
  }

  async function openAddModal() {
    const q = search().trim();
    const form = emptyClientForm();
    if (/^\d{4,10}$/.test(q)) {
      setAnafLoading(true);
      try {
        const res = await apiFetch(`/api/companies/anaf/${q}`);
        if (res.ok) {
          const d = await res.json();
          form.tip = "juridic";
          form.nume = d.name ?? "";
          form.cui = String(d.cui ?? q);
          form.adresa = d.address ?? "";
        }
      } catch {} finally { setAnafLoading(false); }
    }
    setModalForm(form);
    setModalError(null);
    setShowModal(true);
  }

  async function saveNewClient() {
    const f = modalForm();
    if (!f.nume.trim()) { setModalError("Numele este obligatoriu."); return; }
    setSaving(true); setModalError(null);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: f.tip, nume: f.nume.trim(),
          description: f.description.trim() || null,
          cui: f.cui.trim() || null, reprezentant: f.reprezentant.trim() || null,
          telefon: f.telefon.trim() || null, email: f.email.trim() || null,
          adresa: f.adresa.trim() || null, comments: f.comments.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: ClientItem = await res.json();
      await assign(created);
      setShowModal(false);
    } catch { setModalError("Eroare la salvare."); } finally { setSaving(false); }
  }

  return (
    <div class="rcard-extra-card">
      <div class="rcard-extra-title">Client</div>

      <Show when={r().clientId !== null}>
        <div class="rclient-assigned">
          <div class="rclient-name">{r().clientNume}</div>
          <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px" onClick={remove}>✕ Elimină</button>
        </div>
      </Show>

      <Show when={r().clientId === null}>
        <div class="rclient-search-wrap">
          <input
            class="input"
            style="font-size:0.82rem"
            placeholder="Caută după nume sau CUI..."
            value={search()}
            onInput={e => onInput(e.currentTarget.value)}
          />
          <Show when={searching()}>
            <div class="rclient-hint">Se caută...</div>
          </Show>
          <Show when={!searching() && results().length > 0}>
            <div class="rclient-results">
              <For each={results()}>
                {(c) => (
                  <button class="rclient-result-item" onClick={() => assign(c)}>
                    <span class="rclient-result-name">{c.nume}</span>
                    <Show when={c.cui}><span class="rclient-result-meta">CUI {c.cui}</span></Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={!searching() && search().trim().length > 0 && results().length === 0}>
            <div class="rclient-no-results">
              <span class="rclient-hint">Niciun rezultat.</span>
              <button
                class="btn btn-sm btn-ghost"
                style="font-size:0.78rem"
                disabled={anafLoading()}
                onClick={openAddModal}
              >
                {anafLoading() ? "Se interogează ANAF..." : "+ Adaugă client nou"}
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Modal adăugare client */}
      <Show when={showModal()}>
        <div class="sl-modal-overlay" onClick={() => setShowModal(false)}>
          <div class="sl-modal" style="max-width:420px;width:100%" onClick={e => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Client nou</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style="padding:0 16px 8px">
              <ClientFormFields f={modalForm()} setF={setModalForm} />
              <Show when={modalError()}>
                <p class="cfg-error" style="margin-top:6px">{modalError()}</p>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Anulează</button>
              <button class="btn btn-primary btn-sm" disabled={saving()} onClick={saveNewClient}>
                {saving() ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

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
          <span class="rcard-meta">{dateStr} {timeStr}</span>
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
            <ClientSection receipt={r} />
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
