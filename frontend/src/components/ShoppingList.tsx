import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { cart, updateQty, clearCart, cartTotal, replaceCart, updateItemPrice, setItemQty, removeFromCart, addManualItem, type CartItem } from "../store/cartStore";
import { saveReceipt, updateReceiptContent, updateReceiptClient, saveReceiptVehicol, type VehicolData } from "../store/receiptsStore";
import { consumeResume, pendingLoad, clearPendingLoad } from "../store/resumeStore";
import { selectedEmployee, selectEmployee } from "../store/employeesStore";
import { apiFetch } from "../utils/api";
import { device } from "../store/deviceStore";

type ModalType = "descriere" | "dateTehn" | null;

// ─── Cart meta persistence ────────────────────────────────────────────────────

const META_KEY = "bs_cart_meta";

interface CartMeta {
  titlu: string;
  descriere: string;
  dateTehn: string;
  client: ClientItem | null;
  vehicol: VehicolData | null;
}

function saveCartMeta(m: CartMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

function loadCartMeta(): CartMeta | null {
  try {
    const s = localStorage.getItem(META_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function clearCartMeta() {
  localStorage.removeItem(META_KEY);
}

interface ClientItem {
  id: number;
  nume: string;
  cui: string | null;
  tip: string;
  numar_masina: string | null;
}

function emptyClientForm() {
  return { tip: "fizic" as "fizic" | "juridic", nume: "", description: "", cui: "", reprezentant: "", telefon: "", email: "", adresa: "", numar_masina: "", comments: "" };
}

// ─── PosClientSearch ──────────────────────────────────────────────────────────

function PosClientSearch(props: {
  value: ClientItem | null;
  onSelect: (c: ClientItem | null) => void;
  onAddNew: () => void;
}) {
  const [q, setQ] = createSignal("");
  const [results, setResults] = createSignal<ClientItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const [searched, setSearched] = createSignal(false);

  createEffect(() => {
    if (props.value) {
      setQ(props.value.nume);
      setSearched(false);
      setResults([]);
      setOpen(false);
    } else {
      setQ("");
    }
  });

  async function search(val: string) {
    if (!val.trim()) { setResults([]); setOpen(false); setSearched(false); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/clienti?q=${encodeURIComponent(val)}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.items ?? []);
      setSearched(true);
      setOpen(true);
    } finally { setSearching(false); }
  }

  function pick(c: ClientItem) {
    props.onSelect(c);
    setQ(c.nume);
    setOpen(false);
    setResults([]);
    setSearched(false);
  }

  function clear() {
    props.onSelect(null);
    setQ("");
    setResults([]);
    setOpen(false);
    setSearched(false);
  }

  return (
    <div style="position:relative;margin-top:4px">
      <div style="display:flex;gap:6px">
        <input
          class="input"
          style="flex:1;font-size:13px"
          placeholder="Caută client după nume, CUI sau nr. mașină..."
          value={q()}
          onInput={(e) => { setQ(e.currentTarget.value); if (!props.value) search(e.currentTarget.value); }}
          onFocus={() => { if (props.value) return; if (results().length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onClick={() => { if (props.value) { clear(); } }}
        />
        <Show when={props.value}>
          <button class="btn btn-ghost btn-sm" style="padding:0 8px" onClick={clear} title="Șterge client">✕</button>
        </Show>
        <Show when={searching()}>
          <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">...</span>
        </Show>
      </div>
      <Show when={props.value}>
        <div style="font-size:11px;color:var(--text-muted);padding:2px 2px 0">
          {props.value!.tip === "juridic" ? "Juridică" : "Fizică"}
          <Show when={props.value!.numar_masina}> · {props.value!.numar_masina}</Show>
          <Show when={props.value!.cui}> · CUI: {props.value!.cui}</Show>
        </div>
      </Show>
      <Show when={open() && results().length > 0}>
        <div style="position:absolute;left:0;right:0;z-index:300;background:var(--surface,#fff);border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
          <For each={results()}>
            {(c) => (
              <button
                style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:13px"
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              >
                <span style="font-weight:600">{c.nume}</span>
                <Show when={c.numar_masina}><span style="color:var(--text-muted);margin-left:8px;font-size:11px">{c.numar_masina}</span></Show>
                <Show when={c.cui}><span style="color:var(--text-muted);margin-left:8px;font-size:11px">CUI: {c.cui}</span></Show>
                <span style="color:var(--text-muted);margin-left:6px;font-size:11px">{c.tip === "juridic" ? "Juridică" : "Fizică"}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={searched() && !searching() && results().length === 0 && q().trim()}>
        <div style="position:absolute;left:0;right:0;z-index:300;background:var(--surface,#fff);border:1px solid var(--border);border-radius:6px;padding:8px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:13px;display:flex;align-items:center;gap:8px">
          <span style="color:var(--text-muted)">Niciun client găsit.</span>
          <button class="btn btn-sm btn-primary" onMouseDown={(e) => { e.preventDefault(); props.onAddNew(); setOpen(false); }}>+ Adaugă client</button>
        </div>
      </Show>
    </div>
  );
}

// ─── AddClientModal ───────────────────────────────────────────────────────────

function AddClientModal(props: {
  onSaved: (c: ClientItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = createSignal(emptyClientForm());
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError] = createSignal<string | null>(null);

  const pf = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  async function searchAnaf() {
    const cui = parseInt(form().cui.replace(/\D/g, ""));
    if (!cui) return;
    setAnafLoading(true);
    setAnafError(null);
    try {
      const res = await apiFetch(`/api/companies/anaf/${cui}`);
      if (res.status === 404) { setAnafError("CUI-ul nu a fost găsit în ANAF."); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((f) => ({
        ...f,
        nume: data.name ?? f.nume,
        adresa: data.address ?? f.adresa,
        reprezentant: data.representative ?? f.reprezentant,
      }));
    } catch {
      setAnafError("Eroare la interogarea ANAF.");
    } finally {
      setAnafLoading(false);
    }
  }

  async function handleSave() {
    const f = form();
    if (!f.nume.trim()) { setError("Numele este obligatoriu."); return; }
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: f.tip, nume: f.nume.trim(),
          description: f.description.trim() || null,
          cui: f.cui.trim() || null, reprezentant: f.reprezentant.trim() || null,
          telefon: f.telefon.trim() || null, email: f.email.trim() || null,
          adresa: f.adresa.trim() || null, numar_masina: f.numar_masina.trim() || null,
          comments: f.comments.trim() || null,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.detail ?? "Eroare la salvare."); return; }
      const created: ClientItem = await res.json();
      props.onSaved(created);
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" style="max-width:420px;width:100%">
        <div class="sl-modal-header">
          <span class="sl-modal-title">Adaugă client</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div style="padding:12px;display:grid;gap:8px;overflow-y:auto;max-height:60vh">
          <div style="display:flex;gap:8px">
            <button class={`btn btn-sm ${form().tip === "fizic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "fizic")}>Persoană fizică</button>
            <button class={`btn btn-sm ${form().tip === "juridic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "juridic")}>Persoană juridică</button>
          </div>
          <Show when={form().tip === "fizic"}>
            <input class="input" placeholder="Număr mașină" value={form().numar_masina} onInput={(e) => pf("numar_masina", e.currentTarget.value.toUpperCase())} />
          </Show>
          <Show when={form().tip === "juridic"}>
            <div style="display:flex;gap:6px">
              <input
                class="input"
                style="flex:1"
                placeholder="CUI"
                value={form().cui}
                onInput={(e) => pf("cui", e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && searchAnaf()}
              />
              <button class="btn btn-sm btn-ghost" onClick={searchAnaf} disabled={anafLoading()}>
                {anafLoading() ? "..." : "ANAF"}
              </button>
            </div>
            <Show when={anafError()}>
              <span style="color:var(--danger,#ef4444);font-size:12px">{anafError()}</span>
            </Show>
            <input class="input" placeholder="Număr mașină" value={form().numar_masina} onInput={(e) => pf("numar_masina", e.currentTarget.value.toUpperCase())} />
          </Show>
          <input class="input" placeholder="Nume *" value={form().nume} onInput={(e) => pf("nume", e.currentTarget.value)} />
          <input class="input" placeholder="Descriere" value={form().description} onInput={(e) => pf("description", e.currentTarget.value)} />
          <Show when={form().tip === "juridic"}>
            <input class="input" placeholder="Reprezentant" value={form().reprezentant} onInput={(e) => pf("reprezentant", e.currentTarget.value)} />
          </Show>
          <input class="input" placeholder="Telefon" value={form().telefon} onInput={(e) => pf("telefon", e.currentTarget.value)} />
          <input class="input" placeholder="Email" value={form().email} onInput={(e) => pf("email", e.currentTarget.value)} />
          <input class="input" placeholder="Adresă" value={form().adresa} onInput={(e) => pf("adresa", e.currentTarget.value)} />
          <Show when={error()}>
            <span style="color:var(--danger,#ef4444);font-size:12px">{error()}</span>
          </Show>
        </div>
        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button class="btn btn-primary btn-sm" disabled={saving()} onClick={handleSave}>
            {saving() ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ShoppingList ─────────────────────────────────────────────────────────────

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

  const [vehicol, setVehicol] = createSignal<VehicolData | null>(null);
  const [showVehicolModal, setShowVehicolModal] = createSignal(false);
  const [vehicolDraft, setVehicolDraft] = createSignal<VehicolData>({ numarMasina: "" });

  const [loadedReceiptId, setLoadedReceiptId] = createSignal<string | null>(null);
  const [loadedProgramareId, setLoadedProgramareId] = createSignal<number | null>(null);
  const [selectedClient, setSelectedClient] = createSignal<ClientItem | null>(null);
  const [showAddClientModal, setShowAddClientModal] = createSignal(false);
  const [showResumeModal, setShowResumeModal] = createSignal(false);

  // Guard: don't save meta before onMount decides what to load
  let metaSaveEnabled = false;

  // Save titlu/descriere/dateTehn/client/vehicol to localStorage whenever they change (after mount)
  createEffect(() => {
    const t = titlu(), d = descriere(), dt = dateTehn(), c = selectedClient(), v = vehicol();
    if (!metaSaveEnabled) return;
    saveCartMeta({ titlu: t, descriere: d, dateTehn: dt, client: c, vehicol: v });
  });

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

  function loadResumeClient(r: { clientId?: number | null; clientNume?: string | null; clientCui?: string | null; clientTip?: string | null }) {
    if (r.clientId) {
      setSelectedClient({ id: r.clientId, nume: r.clientNume ?? "", cui: r.clientCui ?? null, tip: r.clientTip ?? "fizic", numar_masina: null });
    } else {
      setSelectedClient(null);
    }
  }

  onMount(() => {
    const r = consumeResume();
    if (r) {
      setLoadedReceiptId(r.id ?? null);
      setTitlu(r.titlu);
      setDescriere(r.descriere);
      setDateTehn(r.dateTehn);
      replaceCart(r.items);
      loadResumeClient(r);
      setVehicol(r.vehicol ?? null);
      metaSaveEnabled = true;
    } else if (cart.items.length > 0) {
      // Există o listă salvată — arată modalul de alegere
      setShowResumeModal(true);
      metaSaveEnabled = true;
    } else {
      metaSaveEnabled = true;
    }
  });

  function handleContinuaLista() {
    const meta = loadCartMeta();
    if (meta) {
      setTitlu(meta.titlu ?? "");
      setDescriere(meta.descriere ?? "");
      setDateTehn(meta.dateTehn ?? "");
      setSelectedClient(meta.client ?? null);
      setVehicol(meta.vehicol ?? null);
    }
    setShowResumeModal(false);
  }

  function handleListaNoua() {
    clearCart();
    clearCartMeta();
    setTitlu("");
    setDescriere("");
    setDateTehn("");
    setSelectedClient(null);
    setVehicol(null);
    setLoadedReceiptId(null);
    setShowResumeModal(false);
  }

  createEffect(() => {
    const d = pendingLoad();
    if (!d) return;
    clearPendingLoad();
    setLoadedReceiptId(d.id ?? null);
    setLoadedProgramareId(d.programareId ?? null);
    setTitlu(d.titlu);
    setDescriere(d.descriere);
    setDateTehn(d.dateTehn);
    replaceCart(d.items);
    loadResumeClient(d);
    setVehicol(d.vehicol ?? null);
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
    const receiptId = loadedReceiptId();
    const receiptData = {
      date: new Date().toISOString(),
      titlu: titlu().trim(),
      clientId: null,
      clientNume: null,
      clientCui: null, clientAdresa: null, clientTelefon: null, clientTip: null, clientReprezentant: null, clientNumarMasina: null,
      descriere: descriere().trim() || undefined,
      dateTehn: dateTehn().trim() || undefined,
      items: [...cart.items],
      total: cartTotal(),
      devizSerie: "", devizNr: 0,
      facturaSerie: "", facturaNr: 0,
      chitantaSerie: "", chitantaNr: 0,
      programareId: loadedProgramareId(),
      locationId: device()?.locationId ?? null,
    };
    let saved;
    try {
      if (receiptId !== null) {
        saved = await updateReceiptContent(receiptId, receiptData);
      } else {
        saved = await saveReceipt(receiptData);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Eroare necunoscuta.");
      return;
    }

    const warns: string[] = [];

    const client = selectedClient();
    if (client !== null) {
      try { await updateReceiptClient(saved.id, client.id); }
      catch { warns.push("clientul nu a putut fi asociat"); }
    }

    const veh = vehicol();
    if (veh !== null) {
      try { await saveReceiptVehicol(saved.id, veh); }
      catch { warns.push("vehicolul nu a putut fi asociat"); }
    }

    clearCart();
    clearCartMeta();
    selectEmployee(null);
    setTitlu("");
    setDescriere("");
    setDateTehn("");
    setVehicol(null);
    setLoadedReceiptId(null);
    setLoadedProgramareId(null);
    setSelectedClient(null);

    if (warns.length > 0) {
      setErrorMsg(`Bon salvat, dar ${warns.join(" și ")}. Poți edita din Recepție.`);
    } else {
      setShowSuccess(true);
      clearTimeout(successTimer);
      successTimer = setTimeout(() => setShowSuccess(false), 1000);
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
          placeholder="Nr. masina ex: B 100 TST"
          maxlength={200}
          value={titlu()}
          onInput={(e) => setTitlu(e.currentTarget.value)}
        />
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": vehicol() !== null }}
          onClick={() => {
            const draft = vehicol() ?? { numarMasina: titlu().trim() };
            setVehicolDraft({ ...draft });
            setShowVehicolModal(true);
          }}
          title="Vehicol"
        >
          Masina
        </button>
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": dateTehn().trim() !== "" }}
          onClick={() => openModal("dateTehn")}
          title="Observatii"
        >
          Obs.
        </button>
      </div>

      <div style="padding:0 8px 4px">
        <PosClientSearch
          value={selectedClient()}
          onSelect={setSelectedClient}
          onAddNew={() => setShowAddClientModal(true)}
        />
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

      {/* Resume modal */}
      <Show when={showResumeModal()}>
        <div class="sl-modal-overlay" style="z-index:400">
          <div class="sl-modal" style="max-width:360px;width:100%;text-align:center">
            <div class="sl-modal-header" style="justify-content:center;border-bottom:none;padding-bottom:0">
              <span class="sl-modal-title">Listă în lucru</span>
            </div>
            <p style="padding:12px 16px 4px;color:var(--text-muted);font-size:13px">
              Există o listă deja începută. Ce vrei să faci?
            </p>
            <div class="sl-modal-footer" style="justify-content:center;gap:12px;padding-top:8px">
              <button class="btn btn-ghost btn-sm" onClick={handleListaNoua}>Listă nouă</button>
              <button class="btn btn-primary btn-sm" onClick={handleContinuaLista}>Continuă lista</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Add client modal */}
      <Show when={showAddClientModal()}>
        <AddClientModal
          onSaved={(c) => { setSelectedClient(c); setShowAddClientModal(false); }}
          onClose={() => setShowAddClientModal(false)}
        />
      </Show>

      {/* Clear confirm modal */}
      <Show when={showClearConfirm()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
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
        <div class="sl-modal-overlay">
          <div class="sl-modal">
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
        <div class="sl-modal-overlay">
          <div class="sl-error-modal">
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
        <div class="sl-modal-overlay">
          <div class="sl-modal">
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
                {[2,3,4,5,6,7,8,10, 50, 100].map(v => (
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

      {/* Vehicol modal */}
      <Show when={showVehicolModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:420px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Vehicol</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowVehicolModal(false)}>✕</button>
            </div>
            <div style="padding:12px;display:grid;gap:8px;overflow-y:auto;max-height:60vh">
              <input
                class="input"
                placeholder="Număr mașină *"
                value={vehicolDraft().numarMasina}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, numarMasina: e.currentTarget.value.toUpperCase() }))}
              />
              <input
                class="input"
                placeholder="Marcă"
                value={vehicolDraft().marca ?? ""}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, marca: e.currentTarget.value || null }))}
              />
              <input
                class="input"
                placeholder="Model"
                value={vehicolDraft().model ?? ""}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, model: e.currentTarget.value || null }))}
              />
              <input
                class="input"
                type="number"
                min="0"
                placeholder="Număr kilometri"
                value={vehicolDraft().numarKilometrii ?? ""}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, numarKilometrii: e.currentTarget.value ? parseInt(e.currentTarget.value) : null }))}
              />
              <input
                class="input"
                placeholder="VIN"
                maxlength={17}
                value={vehicolDraft().vin ?? ""}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, vin: e.currentTarget.value.toUpperCase() || null }))}
              />
              <textarea
                class="sl-modal-textarea"
                placeholder="Observații..."
                rows={4}
                value={vehicolDraft().observatii ?? ""}
                onInput={(e) => setVehicolDraft((d) => ({ ...d, observatii: e.currentTarget.value || null }))}
              />
            </div>
            <div class="sl-modal-footer">
              <Show when={vehicol() !== null}>
                <button class="btn btn-ghost btn-sm" onClick={() => { setVehicol(null); setShowVehicolModal(false); }}>Șterge</button>
              </Show>
              <div style="flex:1" />
              <button class="btn btn-ghost btn-sm" onClick={() => setShowVehicolModal(false)}>Anulează</button>
              <button
                class="btn btn-primary btn-sm"
                disabled={vehicolDraft().numarMasina.trim() === ""}
                onClick={() => { setVehicol({ ...vehicolDraft() }); setShowVehicolModal(false); }}
              >
                Salvează
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal */}
      <Show when={modal() !== null}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">
                {modal() === "descriere" ? "Descriere" : "Observații"}
              </span>
              <button class="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <textarea
              class="sl-modal-textarea"
              placeholder={modal() === "descriere" ? "Scrie o descriere..." : "Observații ..."}
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
