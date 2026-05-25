import { For, Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { cart, updateQty, clearCart, cartTotal, replaceCart, updateItemPrice, setItemQty, removeFromCart, addManualItem, type CartItem } from "../store/cartStore";
import { saveReceipt, updateReceiptContent, updateReceiptClient, saveReceiptVehicol, type VehicolData } from "../store/receiptsStore";
import { consumeResume, pendingLoad, clearPendingLoad, newDevizTick } from "../store/resumeStore";
import { selectedEmployee, selectEmployee } from "../store/employeesStore";
import { apiFetch } from "../utils/api";
import { device } from "../store/deviceStore";
import { savePosHotelCtx, consumePendingPosReturn, clearPosHotelCtx } from "../store/posHotelStore";
import { notify } from "../store/notificationsStore";
import { generalSettings } from "../store/generalSettingsStore";
import MontareRotiModal from "./MontareRotiModal";
import SplitName from "./SplitName";
import { loadMontajRotiByReceipt, bulkUpsertMontajRoti, defaultPozitieForIndex, type MontajRotaDraft, type MontajRota } from "../store/montajRotiStore";
import { loadActiveCazariByPlate, type Cazare, type TipAnvelopa } from "../store/hotelAnvelopeStore";

type ModalType = "descriere" | "dateTehn" | null;

// ─── Cart meta persistence ────────────────────────────────────────────────────

const META_KEY = "bs_cart_meta";

interface CartMeta {
  titlu: string;
  descriere: string;
  dateTehn: string;
  client: ClientItem | null;
  vehicol: VehicolData | null;
  receiptId: string | null;
  // FDL flag + câmpuri — persistate ca să nu pierdem starea la reîncărcare/Hotel
  fdlMode?: boolean;
  constatari?: string;
  sugestii?: string;
  timpEstimatOre?: string;
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

interface VehicolWithClient {
  vehicol: {
    id: number;
    numar_masina: string;
    marca: string | null;
    model: string | null;
    numar_kilometrii: number | null;
    vin: string | null;
    observatii: string | null;
  };
  client: {
    id: number;
    nume: string;
    tip: string;
    cui: string | null;
    numar_masina: string | null;
  };
}

// ─── PosClientSearch ──────────────────────────────────────────────────────────

function PosClientSearch(props: {
  value: ClientItem | null;
  onSelect: (c: ClientItem | null) => void;
  onAddNew?: () => void;
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
          placeholder="Caută client după nume ..."
          value={q()}
          onInput={(e) => { setQ(e.currentTarget.value); if (!props.value) search(e.currentTarget.value); }}
          onFocus={() => { if (props.value) return; if (results().length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onClick={() => { if (props.value) { clear(); } }}
        />
        <Show when={props.value}>
          <button class="btn btn-ghost btn-sm" style="padding:0 8px" onClick={clear} title="Șterge client" aria-label="Șterge clientul selectat">✕</button>
        </Show>
        <Show when={searching()}>
          <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">...</span>
        </Show>
      </div>
      <Show when={props.value}>
        <div style="font-size:11px;color:var(--text-muted);padding:2px 2px 0">
          {props.value!.tip === "juridic" ? "Juridică" : "Fizică"}
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
          <Show when={props.onAddNew}>
            <button class="btn btn-sm btn-primary" onMouseDown={(e) => { e.preventDefault(); props.onAddNew!(); setOpen(false); }}>+ Adaugă client</button>
          </Show>
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
      <div class="sl-modal" style="max-width:560px;width:100%">
        <div class="sl-modal-header">
          <span class="sl-modal-title">Adaugă client</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div style="padding:12px;display:grid;gap:8px;overflow-y:auto;max-height:70vh">
          <PosClientSearch
            value={null}
            onSelect={(c) => { if (c) props.onSaved(c); }}
          />
          <div style="border-top:1px solid var(--border);margin:2px 0" />
          <div style="display:flex;gap:8px">
            <button class={`btn btn-sm ${form().tip === "fizic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "fizic")}>Persoană fizică</button>
            <button class={`btn btn-sm ${form().tip === "juridic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "juridic")}>Persoană juridică</button>
          </div>
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

// ─── EditClientModal ──────────────────────────────────────────────────────────

function EditClientModal(props: {
  clientId: number;
  onSaved: (c: ClientItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = createSignal(emptyClientForm());
  const [saving, setSaving] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError] = createSignal<string | null>(null);

  const pf = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  onMount(async () => {
    const res = await apiFetch(`/api/clienti/${props.clientId}`);
    if (res.ok) {
      const data = await res.json();
      setForm({
        tip: data.tip ?? "fizic",
        nume: data.nume ?? "",
        description: data.description ?? "",
        cui: data.cui ?? "",
        reprezentant: data.reprezentant ?? "",
        telefon: data.telefon ?? "",
        email: data.email ?? "",
        adresa: data.adresa ?? "",
        numar_masina: data.numar_masina ?? "",
        comments: data.comments ?? "",
      });
    }
    setLoading(false);
  });

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
      const res = await apiFetch(`/api/clienti/${props.clientId}`, {
        method: "PATCH",
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
      const updated = await res.json();
      props.onSaved({ id: updated.id, nume: updated.nume, cui: updated.cui ?? null, tip: updated.tip, numar_masina: updated.numar_masina ?? null });
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" style="max-width:560px;width:100%">
        <div class="sl-modal-header">
          <span class="sl-modal-title">Editează client</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <Show when={loading()}>
          <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.875rem">Se încarcă...</div>
        </Show>
        <Show when={!loading()}>
          <div style="padding:12px;display:grid;gap:8px;overflow-y:auto;max-height:70vh">
            <PosClientSearch
              value={null}
              onSelect={(c) => { if (c) props.onSaved(c); }}
            />
            <div style="border-top:1px solid var(--border);margin:2px 0" />
            <div style="display:flex;gap:8px">
              <button class={`btn btn-sm ${form().tip === "fizic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "fizic")}>Persoană fizică</button>
              <button class={`btn btn-sm ${form().tip === "juridic" ? "btn-primary" : "btn-ghost"}`} onClick={() => pf("tip", "juridic")}>Persoană juridică</button>
            </div>
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
        </Show>
      </div>
    </div>
  );
}

// ─── Bullet textarea helpers ──────────────────────────────────────────────────
// Folosite pe câmpurile FDL (constatări, sugestii) ca să formateze automat
// liniile cu "• ". La focus pe câmp gol → pune un singur bullet; la Enter →
// adaugă newline + bullet pe linia nouă; la input liber → curăță liniile fără
// bullet (excepție: linia activă în curs de scriere).

const BULLET = "• ";

function ensureBulletPrefix(
  setter: (v: string) => void,
  getter: () => string,
): (e: FocusEvent) => void {
  return () => {
    if (getter().trim() === "") setter(BULLET);
  };
}

function handleBulletKeyDown(setter: (v: string) => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ta = e.currentTarget as HTMLTextAreaElement;
    const { value, selectionStart, selectionEnd } = ta;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const insertion = "\n" + BULLET;
    const next = before + insertion + after;
    setter(next);
    queueMicrotask(() => {
      const pos = (before + insertion).length;
      ta.selectionStart = ta.selectionEnd = pos;
      autoGrowTextarea(ta);
    });
  };
}

function handleBulletInput(
  setter: (v: string) => void,
  _getter: () => string,
): (e: InputEvent) => void {
  return (e) => {
    const ta = e.currentTarget as HTMLTextAreaElement;
    setter(ta.value);
    autoGrowTextarea(ta);
  };
}

/** Crește înălțimea unei textarea pe măsură ce se scrie text.
 *  Resetează la „auto" întâi (ca să se poată micșora la ștergere), apoi setează
 *  la scrollHeight ca să cuprindă tot conținutul fără scrollbar intern. */
function autoGrowTextarea(ta: HTMLTextAreaElement): void {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight}px`;
}

// ─── ShoppingList ─────────────────────────────────────────────────────────────

interface CazareBasic {
  id: number;
  data_checkin: string;
  data_checkout: string | null;
  numar_masina: string | null;
}

interface CazareAnvelopaPayload {
  marca_id: number | null;
  dimensiune_id: number | null;
  profil_id: number | null;
  dot_id: number | null;
  tip: TipAnvelopa;
  adancime: number | null;
  indice_viteza: string | null;
  indice_sarcina: number | null;
}

interface CazareItemPayload {
  anvelopa: CazareAnvelopaPayload | null;
}

interface CazareDetail extends CazareBasic {
  montate_pe_masina: boolean | null;
  successor_montate_pe_masina: boolean | null;
  referinta_cazare_id: number | null;
  referinta_cazare_items: CazareItemPayload[];
  items: CazareItemPayload[];
}

interface CazariResponse {
  items: CazareDetail[];
}

export default function ShoppingList(props: { onEmployeeBadgeClick?: () => void } = {}) {
  const navigate = useNavigate();
  const [titlu, setTitlu] = createSignal("");
  const [descriere, setDescriere] = createSignal("");
  const [dateTehn, setDateTehn] = createSignal("");
  const [modal, setModal] = createSignal<ModalType>(null);
  const [modalDraft, setModalDraft] = createSignal("");
  const [modalUppercase, setModalUppercase] = createSignal(true);
  const [showTitluWarn, setShowTitluWarn] = createSignal(false);
  const [showSuccess, setShowSuccess] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [warnMsg, setWarnMsg] = createSignal<string | null>(null);
  const [editItem, setEditItem] = createSignal<CartItem | null>(null);
  const [editQty, setEditQty] = createSignal("1");
  const [editPrice, setEditPrice] = createSignal("0");

  const [showClearConfirm, setShowClearConfirm] = createSignal(false);

  const [vehicol, setVehicol] = createSignal<VehicolData | null>(null);
  const [showVehicolModal, setShowVehicolModal] = createSignal(false);
  const [vehicolDraft, setVehicolDraft] = createSignal<VehicolData>({ numarMasina: "" });
  const [obsUppercase, setObsUppercase] = createSignal(true);

  const [loadedReceiptId, setLoadedReceiptId] = createSignal<string | null>(null);
  const [loadedProgramareId, setLoadedProgramareId] = createSignal<number | null>(null);
  // FDL mode: când e activ, „Finalizează" salvează un FDL (source="fdl") și
  // afișează câmpurile dedicate (constatări, sugestii, timp estimat).
  const [fdlMode, setFdlMode] = createSignal(false);
  const [constatari, setConstatari] = createSignal("");
  const [sugestii, setSugestii] = createSignal("");
  const [timpEstimatOre, setTimpEstimatOre] = createSignal("");
  const [showFdlModal, setShowFdlModal] = createSignal(false);
  const [selectedClient, setSelectedClient] = createSignal<ClientItem | null>(null);
  const [showAddClientModal, setShowAddClientModal] = createSignal(false);
  const [showEditClientModal, setShowEditClientModal] = createSignal(false);
  const [showResumeModal, setShowResumeModal] = createSignal(false);
  const [finalizing, setFinalizing] = createSignal(false);

  const [linkedCazari, setLinkedCazari] = createSignal<CazareBasic[]>([]);
  const [goingToHotel, setGoingToHotel] = createSignal(false);

  // Cand utilizatorul vrea sa intre in Hotel Anvelope dar placuta are deja
  // cazari active (la acelasi sau alt client), afisam un prompt cu optiuni
  // ca sa nu creeze accidental o cazare duplicat.
  const [activeHotelPrompt, setActiveHotelPrompt] = createSignal<Cazare[] | null>(null);

  // Guard: don't save meta before onMount decides what to load
  let metaSaveEnabled = false;

  // Save titlu/descriere/dateTehn/client/vehicol to localStorage whenever they change (after mount)
  createEffect(() => {
    const t = titlu(), d = descriere(), dt = dateTehn(), c = selectedClient(), v = vehicol();
    const rid = loadedReceiptId();
    const fm = fdlMode(), cs = constatari(), sg = sugestii(), tm = timpEstimatOre();
    if (!metaSaveEnabled) return;
    saveCartMeta({
      titlu: t, descriere: d, dateTehn: dt, client: c, vehicol: v, receiptId: rid,
      fdlMode: fm, constatari: cs, sugestii: sg, timpEstimatOre: tm,
    });
  });

  const [plateSearching, setPlateSearching] = createSignal(false);
  const [vehicolPickList, setVehicolPickList] = createSignal<VehicolWithClient[]>([]);
  const [showVehicolPickModal, setShowVehicolPickModal] = createSignal(false);

  function applyVehicolWithClient(item: VehicolWithClient) {
    setVehicol({
      numarMasina: item.vehicol.numar_masina,
      marca: item.vehicol.marca ?? null,
      model: item.vehicol.model ?? null,
      numarKilometrii: item.vehicol.numar_kilometrii ?? null,
      vin: item.vehicol.vin ?? null,
      observatii: item.vehicol.observatii ?? null,
    });
    setSelectedClient({
      id: item.client.id,
      nume: item.client.nume,
      cui: item.client.cui ?? null,
      tip: item.client.tip,
      numar_masina: item.client.numar_masina ?? null,
    });
  }

  async function handlePlateBlur() {
    if (plateSearching()) return;
    const plate = titlu().trim().toUpperCase();
    if (!plate) return;
    if (vehicol()?.numarMasina === plate) return;
    setPlateSearching(true);
    try {
      const res = await apiFetch(`/api/clienti/vehicole-by-plate?q_masina=${encodeURIComponent(plate)}`);
      if (!res.ok) return;
      const results: VehicolWithClient[] = await res.json();
      if (results.length === 1) {
        applyVehicolWithClient(results[0]);
      } else if (results.length > 1) {
        setVehicolPickList(results);
        setShowVehicolPickModal(true);
      }
    } finally {
      setPlateSearching(false);
    }
  }

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

  // Flag setat la unmount — auto-save din POS-Hotel ruleaza in fundal dupa
  // întoarcerea din Hotel Anvelope; daca utilizatorul navigheaza imediat,
  // nu mai vrem sa mutam state-ul componentei dezmembrate sau sa notificam.
  let autoSaveAborted = false;
  onCleanup(() => { autoSaveAborted = true; });

  async function autoSaveMountedTiresFromHotel(receiptId: number) {
    try {
      const existing = await loadMontajRotiByReceipt(receiptId);
      if (autoSaveAborted) return;
      if (existing.length > 0) return; // nu suprascriem montaj-ul deja salvat de utilizator
      const res = await apiFetch(`/api/cazare-anvelope?receipt_id=${receiptId}&limit=10`);
      if (autoSaveAborted || !res.ok) return;
      const data = await res.json() as CazariResponse;
      if (autoSaveAborted) return;
      const cazari = data?.items ?? [];
      let mountedItems: CazareItemPayload[] | null = null;
      // 1) Scoatere simplă: cazarea are data_checkout + montate_pe_masina=true
      // 2) Combinată: cazarea veche are data_checkout + successor_montate_pe_masina=true
      for (const c of cazari) {
        if (c.data_checkout && (c.montate_pe_masina || c.successor_montate_pe_masina)) {
          mountedItems = c.items ?? [];
          break;
        }
      }
      // 3) Fallback: cazarea nouă cu referinta_cazare_id și montate_pe_masina=true
      if (!mountedItems) {
        for (const c of cazari) {
          if (c.referinta_cazare_id != null && c.montate_pe_masina && (c.referinta_cazare_items?.length ?? 0) > 0) {
            mountedItems = c.referinta_cazare_items ?? [];
            break;
          }
        }
      }
      if (!mountedItems || mountedItems.length === 0) return;
      const drafts: MontajRotaDraft[] = mountedItems
        .filter((it): it is CazareItemPayload & { anvelopa: CazareAnvelopaPayload } => !!it.anvelopa)
        .map((it, i) => ({
          pozitie: defaultPozitieForIndex(i),
          presiune: 2.3,
          ordine: i,
          marcaId: it.anvelopa.marca_id ?? null,
          dimensiuneId: it.anvelopa.dimensiune_id ?? null,
          profilId: it.anvelopa.profil_id ?? null,
          dotId: it.anvelopa.dot_id ?? null,
          tip: it.anvelopa.tip,
          adancime: it.anvelopa.adancime ?? null,
          cupluStrangere: null,
          indiceViteza: it.anvelopa.indice_viteza ?? null,
          indiceSarcina: it.anvelopa.indice_sarcina ?? null,
          comments: null,
        }));
      if (drafts.length === 0) return;
      await bulkUpsertMontajRoti(receiptId, drafts);
      if (autoSaveAborted) return;
      await refreshLinkedMontaje();
      if (autoSaveAborted) return;
      notify("Rotile montate pe mașină au fost adăugate la deviz.", "success");
    } catch { /* silent — userul poate deschide manual Montare Roți */ }
  }

  onMount(() => {
    const pending = consumePendingPosReturn();
    if (pending) {
      // Întoarcere automată din Hotel Anvelope — restaurează meta și sari peste resume modal.
      const meta = loadCartMeta();
      if (meta) {
        setTitlu(meta.titlu ?? "");
        setDescriere(meta.descriere ?? "");
        setDateTehn(meta.dateTehn ?? "");
        setSelectedClient(meta.client ?? null);
        setVehicol(meta.vehicol ?? null);
        setLoadedReceiptId(meta.receiptId ?? null);
        setFdlMode(meta.fdlMode ?? false);
        setConstatari(meta.constatari ?? "");
        setSugestii(meta.sugestii ?? "");
        setTimpEstimatOre(meta.timpEstimatOre ?? "");
      }
      metaSaveEnabled = true;
      const msg = pending.action === "scoatere_si_cazare"
        ? "Scoaterea și cazarea au fost adăugate la deviz."
        : pending.action === "scoatere"
        ? "Scoaterea a fost adăugată la deviz."
        : "Cazarea a fost adăugată la deviz.";
      notify(msg, "success");
      // Dacă scoaterea a marcat „Montate pe mașină", salvăm automat rotile ca montaj la deviz.
      if ((pending.action === "scoatere" || pending.action === "scoatere_si_cazare") && meta?.receiptId) {
        void autoSaveMountedTiresFromHotel(Number(meta.receiptId));
      }
      return;
    }
    const r = consumeResume();
    if (r) {
      setLoadedReceiptId(r.id ?? null);
      setTitlu(r.titlu);
      setDescriere(r.descriere);
      setDateTehn(r.dateTehn);
      replaceCart(r.items);
      loadResumeClient(r);
      setVehicol(r.vehicol ?? null);
      setFdlMode(r.source === "fdl");
      setConstatari(r.constatari ?? "");
      setSugestii(r.sugestii ?? "");
      setTimpEstimatOre(r.timpEstimatOre != null ? String(r.timpEstimatOre) : "");
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
      setLoadedReceiptId(meta.receiptId ?? null);
      setFdlMode(meta.fdlMode ?? false);
      setConstatari(meta.constatari ?? "");
      setSugestii(meta.sugestii ?? "");
      setTimpEstimatOre(meta.timpEstimatOre ?? "");
    }
    setShowResumeModal(false);
  }

  function handleListaNoua() {
    clearCart();
    clearCartMeta();
    clearPosHotelCtx();
    setTitlu("");
    setDescriere("");
    setDateTehn("");
    setSelectedClient(null);
    setVehicol(null);
    setLoadedReceiptId(null);
    setFdlMode(false);
    setConstatari("");
    setSugestii("");
    setTimpEstimatOre("");
    setShowResumeModal(false);
  }

  // Trigger extern din POS (buton "Deviz Nou") — defer pentru a evita run-ul inițial
  createEffect(on(newDevizTick, () => { handleListaNoua(); }, { defer: true }));

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
    setFdlMode(d.source === "fdl");
    setConstatari(d.constatari ?? "");
    setSugestii(d.sugestii ?? "");
    setTimpEstimatOre(d.timpEstimatOre != null ? String(d.timpEstimatOre) : "");
  });

  // Încarcă cazarile legate de receiptul curent. Folosim AbortController + flag
  // pentru a anula request-uri în zbor la schimbare de receipt sau unmount.
  let cazariAbort: AbortController | null = null;
  createEffect(() => {
    const rId = loadedReceiptId();
    if (cazariAbort) { cazariAbort.abort(); cazariAbort = null; }
    if (!rId) { setLinkedCazari([]); return; }
    const controller = new AbortController();
    cazariAbort = controller;
    (async () => {
      try {
        const res = await apiFetch(`/api/cazare-anvelope?receipt_id=${rId}&limit=10`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json() as CazariResponse;
          if (controller.signal.aborted) return;
          setLinkedCazari(data.items ?? []);
        }
      } catch {
        // ignoră erori de rețea / abort
      }
    })();
  });
  onCleanup(() => { if (cazariAbort) cazariAbort.abort(); });

  const [linkedMontaje, setLinkedMontaje] = createSignal<MontajRota[]>([]);
  async function refreshLinkedMontaje() {
    const rId = loadedReceiptId();
    if (!rId) { setLinkedMontaje([]); return; }
    try {
      const items = await loadMontajRotiByReceipt(Number(rId));
      setLinkedMontaje(items);
    } catch {
      // ignoră erori
    }
  }
  createEffect(() => {
    loadedReceiptId();
    refreshLinkedMontaje();
  });

  const [montareRotiOpen, setMontareRotiOpen] = createSignal(false);
  const [montareRotiInitial, setMontareRotiInitial] = createSignal<MontajRotaDraft[]>([]);
  const [montareRotiReceiptId, setMontareRotiReceiptId] = createSignal<number | null>(null);
  const [openingMontareRoti, setOpeningMontareRoti] = createSignal(false);

  async function handleMontareRoti() {
    const client = selectedClient();
    if (!titlu().trim()) {
      setWarnMsg("Mai este un pas — introduceți numărul mașinii (titlul devizului) înainte de Montare Roți.");
      return;
    }
    if (!client) {
      setWarnMsg("Mai este un pas — adăugați un client înainte de Montare Roți.");
      return;
    }
    if (openingMontareRoti()) return;
    setOpeningMontareRoti(true);

    let rId = loadedReceiptId();
    if (rId === null && cart.items.length === 0) {
      setWarnMsg("Adăugați cel puțin un produs în deviz sau salvați bonul înainte de Montare Roți.");
      setOpeningMontareRoti(false);
      return;
    }

    try {
      if (cart.items.length > 0) {
        const receiptData = {
          date: new Date().toISOString(),
          titlu: titlu().trim(),
          clientId: null,
          clientNume: null, clientCui: null, clientAdresa: null, clientTelefon: null, clientTip: null, clientReprezentant: null, clientNumarMasina: null,
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
        const saved = rId !== null
          ? await updateReceiptContent(rId, receiptData)
          : await saveReceipt(receiptData);
        rId = saved.id;
        setLoadedReceiptId(rId);
        try { await updateReceiptClient(rId, client.id); } catch { /* ignoră */ }
        const veh = vehicol();
        if (veh !== null) {
          try { await saveReceiptVehicol(rId, veh); } catch { /* ignoră */ }
        }
      }
    } catch {
      setErrorMsg("Eroare la salvarea devizului.");
      setOpeningMontareRoti(false);
      return;
    }

    const receiptIdNum = Number(rId);
    let initial: MontajRotaDraft[] = [];
    try {
      const existing = await loadMontajRotiByReceipt(receiptIdNum);
      if (existing.length > 0) {
        initial = existing.map((r, i) => ({
          pozitie: r.pozitie,
          presiune: r.presiune,
          ordine: r.ordine ?? i,
          marcaId: r.marcaId,
          dimensiuneId: r.dimensiuneId,
          profilId: r.profilId,
          dotId: r.dotId,
          tip: r.tip,
          adancime: r.adancime,
          cupluStrangere: r.cupluStrangere,
          indiceViteza: r.indiceViteza,
          indiceSarcina: r.indiceSarcina,
          comments: r.comments,
        }));
      } else {
        const res = await apiFetch(`/api/cazare-anvelope?receipt_id=${receiptIdNum}&limit=10`);
        if (res.ok) {
          const data = await res.json() as CazariResponse;
          const cazari = data?.items ?? [];
          // Caută o scoatere atașată devizului unde rotile au fost bifate ca montate pe mașină.
          // 1) Scoatere simplă: cazarea are data_checkout + montate_pe_masina=true (flag original).
          // 2) Scoatere + introducere combinată: cazarea veche are data_checkout +
          //    successor_montate_pe_masina=true (bifa „Montate pe mașină" de la scoatere).
          // 3) Fallback — cazarea nouă (referinta_cazare_id!=null, montate_pe_masina=true);
          //    rotile montate sunt în referinta_cazare_items (cele scoase din vechea cazare).
          let mountedItems: CazareItemPayload[] | null = null;
          for (const c of cazari) {
            if (c.data_checkout && (c.montate_pe_masina || c.successor_montate_pe_masina)) {
              mountedItems = c.items ?? [];
              break;
            }
          }
          if (!mountedItems) {
            for (const c of cazari) {
              if (c.referinta_cazare_id != null && c.montate_pe_masina && (c.referinta_cazare_items?.length ?? 0) > 0) {
                mountedItems = c.referinta_cazare_items ?? [];
                break;
              }
            }
          }
          if (mountedItems) {
            initial = mountedItems
              .filter((it): it is CazareItemPayload & { anvelopa: CazareAnvelopaPayload } => !!it.anvelopa)
              .map((it, i) => ({
                pozitie: defaultPozitieForIndex(i),
                presiune: 2.3,
                ordine: i,
                marcaId: it.anvelopa.marca_id ?? null,
                dimensiuneId: it.anvelopa.dimensiune_id ?? null,
                profilId: it.anvelopa.profil_id ?? null,
                dotId: it.anvelopa.dot_id ?? null,
                tip: it.anvelopa.tip,
                adancime: it.anvelopa.adancime ?? null,
                cupluStrangere: null,
                indiceViteza: it.anvelopa.indice_viteza ?? null,
                indiceSarcina: it.anvelopa.indice_sarcina ?? null,
                comments: null,
              }));
          }
        }
      }
    } catch { /* fallback la modal gol */ }

    setMontareRotiReceiptId(receiptIdNum);
    setMontareRotiInitial(initial);
    setMontareRotiOpen(true);
    setOpeningMontareRoti(false);
  }

  async function handleGoToHotel() {
    const client = selectedClient();
    if (!titlu().trim()) {
      setWarnMsg("Mai este un pas — introduceți numărul mașinii (titlul devizului) înainte de a merge la Hotel Anvelope.");
      return;
    }
    if (!client) {
      setWarnMsg("Mai este un pas — adăugați un client înainte de a merge la Hotel Anvelope.");
      return;
    }
    if (goingToHotel()) return;

    // Pre-flight: daca placuta are deja cazari active (la acest client sau la altul),
    // afisam prompt-ul si lasam utilizatorul sa decida ce face.
    try {
      const active = await loadActiveCazariByPlate(titlu().trim());
      // Daca o cazare activa pentru placuta e deja atasata acestui deviz, nu mai
      // intram in prompt (cazarea va aparea oricum in pagina Hotel pentru client).
      const rId = loadedReceiptId();
      const relevant = rId != null
        ? active.filter((c) => String(c.id) !== String(rId) && active.length > 0)
        : active;
      if (relevant.length > 0) {
        setActiveHotelPrompt(relevant);
        return;
      }
    } catch { /* ignora — daca lookup-ul esueaza, continua fluxul normal */ }

    await proceedToHotelNew();
  }

  /** Continua fluxul "creeaza cazare noua / vezi cazarile clientului in Hotel".
   *  Extras separat ca sa fie reutilizat dupa rezolvarea prompt-ului de cazare activa.
   *  `skipEntryPrompt`: cand utilizatorul a confirmat deja "cazare noua" in prompt-ul
   *  din POS, suprimam prompt-ul echivalent din pagina Hotel ("Cum continuati?"). */
  async function proceedToHotelNew(skipEntryPrompt: boolean = false) {
    const client = selectedClient();
    if (!client) return;
    setGoingToHotel(true);

    let rId = loadedReceiptId();

    if (rId === null && cart.items.length === 0) {
      setWarnMsg("Mai este un pas — adăugați cel puțin un produs în deviz înainte de a merge la Hotel Anvelope.");
      setGoingToHotel(false);
      return;
    }

    try {
      if (cart.items.length > 0) {
        const receiptData = {
          date: new Date().toISOString(),
          titlu: titlu().trim(),
          clientId: null,
          clientNume: null, clientCui: null, clientAdresa: null, clientTelefon: null, clientTip: null, clientReprezentant: null, clientNumarMasina: null,
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
        if (rId !== null) {
          saved = await updateReceiptContent(rId, receiptData);
        } else {
          saved = await saveReceipt(receiptData);
        }
        rId = saved.id;
        setLoadedReceiptId(rId);
        try { await updateReceiptClient(rId, client.id); } catch { /* ignoră */ }
      }
    } catch {
      setErrorMsg("Eroare la salvarea devizului.");
      setGoingToHotel(false);
      return;
    }

    savePosHotelCtx({
      receiptId: String(rId),
      titlu: titlu().trim(),
      clientId: client.id,
      clientNume: client.nume,
      employeeId: selectedEmployee()?.id ?? null,
      skipEntryPrompt,
    });
    setGoingToHotel(false);
    navigate("/hotel-anvelope");
  }

  let warnTimer: ReturnType<typeof setTimeout>;
  let successTimer: ReturnType<typeof setTimeout>;
  function triggerTitluWarn() {
    setShowTitluWarn(true);
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => setShowTitluWarn(false), 3000);
  }

  function openModal(type: ModalType) {
    setModalDraft(type === "descriere" ? descriere() : dateTehn());
    setModalUppercase(true);
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
    if (finalizing()) return;
    setFinalizing(true);
    const receiptId = loadedReceiptId();
    const isFdl = fdlMode();
    const timpRaw = parseFloat(timpEstimatOre());
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
      source: isFdl ? "fdl" : undefined,
      constatari: isFdl ? (constatari().trim() || null) : null,
      sugestii: isFdl ? (sugestii().trim() || null) : null,
      timpEstimatOre: isFdl && !isNaN(timpRaw) && timpRaw > 0 ? timpRaw : null,
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
      setFinalizing(false);
      return;
    }

    const warns: string[] = [];

    const client = selectedClient();
    if (client !== null) {
      try { await updateReceiptClient(saved.id, client.id); }
      catch { warns.push("clientul nu a putut fi asociat"); }
    }

    const veh = vehicol() ?? (titlu().trim() !== "" ? { numarMasina: titlu().trim() } : null);
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
    setFdlMode(false);
    setConstatari("");
    setSugestii("");
    setTimpEstimatOre("");

    setFinalizing(false);
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
                <span
                  class="sl-employee-badge"
                  role={props.onEmployeeBadgeClick ? "button" : undefined}
                  tabIndex={props.onEmployeeBadgeClick ? 0 : undefined}
                  style={props.onEmployeeBadgeClick ? "cursor:pointer" : undefined}
                  onClick={props.onEmployeeBadgeClick}
                  onKeyDown={(ev) => {
                    if (props.onEmployeeBadgeClick && (ev.key === "Enter" || ev.key === " ")) {
                      ev.preventDefault();
                      props.onEmployeeBadgeClick();
                    }
                  }}
                >
                  <Show when={e.imagePath}>
                    <img src={e.imagePath!} class="sl-employee-badge-avatar" alt={e.name} />
                  </Show>
                  <span class="sl-employee-badge-info">
                    <SplitName name={e.name} class="sl-employee-badge-name" />
                    <Show when={e.target > 0}>
                      <span class="sl-employee-badge-pct">
                        {Math.round(e.currentTargetAccumulation / e.target * 100)}%
                      </span>
                    </Show>
                  </span>
                  <Show when={e.target > 0 && Math.round(e.currentTargetAccumulation / e.target * 100) > 100}>
                    <span class="sl-employee-badge-crown" title="Target depasit">👑</span>
                  </Show>
                </span>
              );
            })()}
          </Show>
        </div>
        <div class="sl-header-right">
          <button class="btn btn-ghost btn-sm sl-extra-btn sl-extra-btn--stacked" onClick={openManual} title="Adaugă produs/serviciu manual">
            <span class="sl-extra-btn-sub">Introducere manuala</span>
            <span class="sl-extra-btn-main">Produs/Serviciu</span>
          </button>
        </div>
      </div>

      <div class="shopping-list-titlu">
        <div style="position:relative;flex:7;min-width:0">
          <input
            class="input-titlu"
            type="text"
            placeholder="Nr. masina ex: B 100 TST"
            maxlength={100}
            value={titlu()}
            onInput={(e) => setTitlu(e.currentTarget.value.replace(/\s/g, "").toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handlePlateBlur(); }}
            onBlur={handlePlateBlur}
          />
          <Show when={plateSearching()}>
            <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--text-muted);pointer-events:none">...</span>
          </Show>
        </div>
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": vehicol() !== null }}
          onClick={() => {
            const draft = vehicol() ?? { numarMasina: titlu().trim() };
            setVehicolDraft({ ...draft });
            setObsUppercase(true);
            setShowVehicolModal(true);
          }}
          title="Vehicul"
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
        <button
          class="btn btn-ghost btn-sm sl-extra-btn"
          classList={{ "sl-extra-btn--active": selectedClient() !== null }}
          onClick={() => selectedClient() ? setShowEditClientModal(true) : setShowAddClientModal(true)}
          title="Client"
        >
          Client
        </button>
      </div>

      <Show when={vehicol() !== null || selectedClient() !== null}>
        <div style="padding:2px 10px 4px;display:grid;gap:1px">
          <Show when={vehicol() !== null}>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              {[
                vehicol()!.numarMasina,
                vehicol()!.marca,
                vehicol()!.model,
                vehicol()!.numarKilometrii != null ? `${vehicol()!.numarKilometrii} km` : null,
                vehicol()!.vin,
              ].filter(Boolean).join(" · ")}
            </div>
          </Show>
          <Show when={selectedClient() !== null}>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              {[
                selectedClient()!.nume,
                selectedClient()!.tip === "juridic" ? "Juridică" : "Fizică",
                selectedClient()!.cui ? `CUI: ${selectedClient()!.cui}` : null,
              ].filter(Boolean).join(" · ")}
            </div>
          </Show>
        </div>
      </Show>

      <Show when={linkedCazari().length > 0}>
        <div style="padding:2px 10px 4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11px;color:var(--text-muted)">Hotel:</span>
          <For each={linkedCazari()}>
            {(c) => {
              const label = c.data_checkout ? "Scoatere" : "Cazare";
              return (
                <button
                  style="font-size:11px;color:var(--accent);text-decoration:underline;cursor:pointer;background:none;border:none;padding:0"
                  onClick={() => navigate(`/hotel-anvelope?viewCazare=${c.id}`)}
                >
                  {label}
                </button>
              );
            }}
          </For>
        </div>
      </Show>

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
        <div class="sl-square-actions">
          <Show when={!generalSettings()?.dezactiveazaHotelAnvelope}>
            <button
              class="sl-square-btn"
              classList={{ "sl-square-btn--done": linkedCazari().length > 0 }}
              disabled={goingToHotel()}
              onClick={handleGoToHotel}
            >
              {goingToHotel() ? "..." : "Cazare Anvelope"}
            </button>
          </Show>
          <Show when={generalSettings()?.activeazaFisaDeLucru === true}>
            <button
              class="sl-square-btn"
              classList={{ "sl-square-btn--fdl-active": fdlMode() }}
              onClick={() => { setFdlMode(true); setShowFdlModal(true); }}
              title={fdlMode() ? "Fișa de Lucru activă — apasă pentru a edita" : "Activează mod Fișa de Lucru"}
            >
              {fdlMode() ? "FDL activă" : "Fișă de Lucru"}
            </button>
          </Show>
          <button
            class="sl-square-btn"
            classList={{ "sl-square-btn--done": linkedMontaje().length > 0 }}
            disabled={openingMontareRoti()}
            onClick={handleMontareRoti}
          >
            {openingMontareRoti() ? "..." : "Montare Roți"}
          </button>
        </div>
        <div class="total-row">
          <span>{fdlMode() ? "Total estimat" : "Total"}</span>
          <span class="text-accent">{cartTotal().toFixed(2)} lei</span>
        </div>
        <button
          class="btn btn-primary w-full"
          classList={{ "btn-fdl": fdlMode() }}
          disabled={cart.items.length === 0 || finalizing()}
          onClick={handleFinalize}
        >
          {finalizing()
            ? "Se salvează..."
            : (fdlMode() ? "Salvează Fișa de Lucru" : "Finalizeaza")}
        </button>
      </div>

      <Show when={montareRotiOpen() && montareRotiReceiptId() !== null}>
        <MontareRotiModal
          receiptId={montareRotiReceiptId()!}
          initialItems={montareRotiInitial()}
          onSaved={() => { setMontareRotiOpen(false); refreshLinkedMontaje(); }}
          onClose={() => setMontareRotiOpen(false)}
        />
      </Show>

      {/* Active hotel cazare prompt — placuta are deja anvelope in depozit */}
      <Show when={activeHotelPrompt() !== null}>
        <div class="sl-modal-overlay" style="z-index:450">
          <div class="sl-modal" style="max-width:480px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Cazare activă pentru {titlu().trim()}</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setActiveHotelPrompt(null)}>✕</button>
            </div>
            <div style="padding:12px 16px;font-size:13px;color:var(--text)">
              <p style="margin:0 0 10px 0">
                Plăcuța <strong>{titlu().trim()}</strong> are deja anvelope în depozit. Ce vrei să faci?
              </p>
              <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto">
                <For each={activeHotelPrompt() ?? []}>
                  {(c) => (
                    <div style="border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12px">
                      <div style="display:flex;justify-content:space-between;gap:8px">
                        <strong>{c.clientNume ?? "—"}</strong>
                        <span style="color:var(--text-muted)">Cazare #{c.id}</span>
                      </div>
                      <div style="color:var(--text-muted);margin-top:2px">
                        Intrare: {new Date(c.dataCheckin).toLocaleDateString("ro-RO")}
                        <Show when={c.locCazareNume}> · Loc: {c.locCazareNume}</Show>
                        <Show when={c.items.length > 0}> · {c.items.length} anvelope</Show>
                      </div>
                      <div style="margin-top:6px">
                        <button
                          class="btn btn-primary btn-sm"
                          onClick={() => {
                            setActiveHotelPrompt(null);
                            navigate(`/hotel-anvelope?viewCazare=${c.id}`);
                          }}
                        >
                          Vezi cazarea
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <div class="sl-modal-footer" style="justify-content:space-between;gap:8px">
              <button class="btn btn-ghost btn-sm" onClick={() => setActiveHotelPrompt(null)}>Anulează</button>
              <button
                class="btn btn-primary btn-sm"
                onClick={async () => {
                  setActiveHotelPrompt(null);
                  await proceedToHotelNew(true);
                }}
              >
                Continuă oricum (cazare nouă)
              </button>
            </div>
          </div>
        </div>
      </Show>

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

      {/* Edit client modal */}
      <Show when={showEditClientModal() && selectedClient() !== null}>
        <EditClientModal
          clientId={selectedClient()!.id}
          onSaved={(c) => { setSelectedClient(c); setShowEditClientModal(false); }}
          onClose={() => setShowEditClientModal(false)}
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

      {/* Warning modal */}
      <Show when={warnMsg() !== null}>
        <div class="sl-modal-overlay">
          <div class="sl-error-modal">
            <div class="sl-error-modal-header" style="color: #f97316;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Un pas înainte</span>
            </div>
            <p class="sl-error-modal-msg">{warnMsg()}</p>
            <button class="btn btn-primary btn-sm" onClick={() => setWarnMsg(null)}>OK</button>
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
          Scrie un număr de mașină pentru a finaliza!
        </div>
      </Show>

      {/* Manual item modal */}
      <Show when={showManual()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Adaugă produs/serviciu manual</span>
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
                  onInput={(e) => setManualName(e.currentTarget.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmManual(); }}
                  autofocus
                />
              </div>
              <div class="sl-edit-item-row">
                <label class="sl-edit-label">Tip</label>
                <div class="sl-tip-toggle">
                  <button
                    class={`btn btn-sm${manualTip() === "Produs" ? " btn-primary" : " btn-ghost"}`}
                    onClick={() => { setManualTip("Produs"); setManualUnit("buc"); }}
                    type="button"
                  >Produs</button>
                  <button
                    class={`btn btn-sm${manualTip() === "Serviciu" ? " btn-primary" : " btn-ghost"}`}
                    onClick={() => { setManualTip("Serviciu"); setManualUnit("ora"); }}
                    type="button"
                  >Serviciu</button>
                </div>
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

      {/* Vehicol pick modal — multiple results for plate search */}
      <Show when={showVehicolPickModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:480px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Selectează vehiculul</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowVehicolPickModal(false)}>✕</button>
            </div>
            <div style="padding:8px;display:grid;gap:6px;overflow-y:auto;max-height:60vh">
              <For each={vehicolPickList()}>
                {(item) => (
                  <button
                    style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;text-align:left;width:100%"
                    onClick={() => { applyVehicolWithClient(item); setShowVehicolPickModal(false); }}
                  >
                    <div>
                      <div style="font-weight:600;font-size:14px">{item.vehicol.numar_masina}</div>
                      <div style="font-size:12px;color:var(--text-muted)">
                        {[item.vehicol.marca, item.vehicol.model].filter(Boolean).join(" ") || "—"}
                      </div>
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);text-align:right">
                      <div>{item.client.nume}</div>
                      <Show when={item.client.cui}>
                        <div>CUI: {item.client.cui}</div>
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowVehicolPickModal(false)}>Anulează</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Vehicol modal */}
      <Show when={showVehicolModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:600px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Vehicul</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowVehicolModal(false)}>✕</button>
            </div>
            <div style="padding:12px;display:grid;gap:8px;overflow-y:auto;max-height:75vh">
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
                rows={10}
                style={obsUppercase() ? "text-transform:uppercase" : ""}
                value={vehicolDraft().observatii ?? ""}
                onInput={(e) => {
                  const val = obsUppercase() ? e.currentTarget.value.toUpperCase() : e.currentTarget.value;
                  setVehicolDraft((d) => ({ ...d, observatii: val || null }));
                }}
              />
              <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;cursor:pointer;user-select:none">
                <input
                  type="checkbox"
                  checked={!obsUppercase()}
                  onChange={(e) => setObsUppercase(!e.currentTarget.checked)}
                />
                Scriere normală (litere mici/mari)
              </label>
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

      {/* FDL modal — câmpuri specifice Fișa de Lucru */}
      <Show when={showFdlModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal sl-modal--fdl">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Fișă de Lucru</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowFdlModal(false)}>✕</button>
            </div>
            <div class="sl-fdl-body">
              <p class="sl-fdl-intro">
                Fișa de Lucru este o <strong>estimare</strong> — nu intră în totaluri sau rapoarte
                până nu este transformată în deviz din Recepție.
              </p>

              <div class="sl-fdl-grid">
                {/* Coloana stânga: sumar Vehicul + Client (vertical) */}
                <div class="sl-fdl-left">
                <div class="sl-fdl-info-card">
                  <div class="sl-fdl-info-card-header">
                    <span class="sl-fdl-info-card-title">Vehicul</span>
                    <button
                      class="btn btn-ghost btn-xs"
                      onClick={() => {
                        const draft = vehicol() ?? { numarMasina: titlu().trim() };
                        setVehicolDraft({ ...draft });
                        setObsUppercase(true);
                        // FDL state (constatari/sugestii/timp) e deja persistat
                        // în signals + localStorage; închidem fereastra FDL ca să
                        // se vadă clar modalul nou de Vehicul.
                        setShowFdlModal(false);
                        setShowVehicolModal(true);
                      }}
                    >
                      {vehicol() ? "Editează" : "Adaugă"}
                    </button>
                  </div>
                  <Show
                    when={vehicol()}
                    fallback={<div class="sl-fdl-info-card-body sl-fdl-info-card-body--empty">Niciun vehicul asociat.</div>}
                  >
                    <div class="sl-fdl-info-card-body">
                      <div class="sl-fdl-info-row">
                        <span class="sl-fdl-info-row-key">Nr. mașină:</span>
                        <span class="sl-fdl-info-row-val"><strong>{vehicol()!.numarMasina}</strong></span>
                      </div>
                      <Show when={vehicol()!.marca || vehicol()!.model}>
                        <div class="sl-fdl-info-row">
                          <span class="sl-fdl-info-row-key">Marcă / Model:</span>
                          <span class="sl-fdl-info-row-val">
                            {[vehicol()!.marca, vehicol()!.model].filter(Boolean).join(" ")}
                          </span>
                        </div>
                      </Show>
                      <Show when={vehicol()!.numarKilometrii != null}>
                        <div class="sl-fdl-info-row">
                          <span class="sl-fdl-info-row-key">Kilometri:</span>
                          <span class="sl-fdl-info-row-val">{vehicol()!.numarKilometrii} km</span>
                        </div>
                      </Show>
                      <Show when={vehicol()!.vin}>
                        <div class="sl-fdl-info-row">
                          <span class="sl-fdl-info-row-key">VIN:</span>
                          <span class="sl-fdl-info-row-val">{vehicol()!.vin}</span>
                        </div>
                      </Show>
                      <Show when={vehicol()!.observatii}>
                        <div class="sl-fdl-info-row">
                          <span class="sl-fdl-info-row-key">Obs.:</span>
                          <span class="sl-fdl-info-row-val">{vehicol()!.observatii}</span>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="sl-fdl-info-card">
                  <div class="sl-fdl-info-card-header">
                    <span class="sl-fdl-info-card-title">Client</span>
                    <button
                      class="btn btn-ghost btn-xs"
                      onClick={() => {
                        // Închidem FDL ca să se vadă modalul de client.
                        setShowFdlModal(false);
                        if (selectedClient()) setShowEditClientModal(true);
                        else setShowAddClientModal(true);
                      }}
                    >
                      {selectedClient() ? "Editează" : "Adaugă"}
                    </button>
                  </div>
                  <Show
                    when={selectedClient()}
                    fallback={<div class="sl-fdl-info-card-body sl-fdl-info-card-body--empty">Niciun client asociat.</div>}
                  >
                    <div class="sl-fdl-info-card-body">
                      <div class="sl-fdl-info-row">
                        <span class="sl-fdl-info-row-key">Nume:</span>
                        <span class="sl-fdl-info-row-val"><strong>{selectedClient()!.nume}</strong></span>
                      </div>
                      <div class="sl-fdl-info-row">
                        <span class="sl-fdl-info-row-key">Tip:</span>
                        <span class="sl-fdl-info-row-val">
                          {selectedClient()!.tip === "juridic" ? "Juridică" : "Fizică"}
                        </span>
                      </div>
                      <Show when={selectedClient()!.cui}>
                        <div class="sl-fdl-info-row">
                          <span class="sl-fdl-info-row-key">CUI:</span>
                          <span class="sl-fdl-info-row-val">{selectedClient()!.cui}</span>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
                </div>

                {/* Coloana dreapta: câmpurile FDL */}
                <div class="sl-fdl-right">
              <div class="sl-fdl-field">
                <label class="sl-fdl-label">Constatări (observații tehnician)</label>
                <textarea
                  ref={(el) => createEffect(() => { constatari(); queueMicrotask(() => autoGrowTextarea(el)); })}
                  class="sl-modal-textarea sl-fdl-textarea"
                  placeholder="• discuri uzate&#10;• suspensie defectă&#10;• lichid de frână sub nivel"
                  rows={6}
                  value={constatari()}
                  onFocus={ensureBulletPrefix(setConstatari, constatari)}
                  onInput={handleBulletInput(setConstatari, constatari)}
                  onKeyDown={handleBulletKeyDown(setConstatari)}
                />
              </div>
              <div class="sl-fdl-field">
                <label class="sl-fdl-label">Sugestii / Recomandări către client</label>
                <textarea
                  ref={(el) => createEffect(() => { sugestii(); queueMicrotask(() => autoGrowTextarea(el)); })}
                  class="sl-modal-textarea sl-fdl-textarea"
                  placeholder="• înlocuire plăcuțe + discuri față&#10;• schimb ulei cutie"
                  rows={5}
                  value={sugestii()}
                  onFocus={ensureBulletPrefix(setSugestii, sugestii)}
                  onInput={handleBulletInput(setSugestii, sugestii)}
                  onKeyDown={handleBulletKeyDown(setSugestii)}
                />
              </div>
              <div class="sl-fdl-field">
                <label class="sl-fdl-label">Timp estimat manoperă (ore)</label>
                <input
                  class="input sl-fdl-time-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Ex: 2.5"
                  value={timpEstimatOre()}
                  onInput={(e) => setTimpEstimatOre(e.currentTarget.value)}
                />
                <div class="sl-fdl-time-presets">
                  <For each={[0.5, 1, 1.5, 2, 2.5, 3, 4, 5]}>
                    {(v) => (
                      <button
                        class="btn btn-ghost btn-xs sl-fdl-time-preset-btn"
                        classList={{ "sl-fdl-time-preset-btn--active": parseFloat(timpEstimatOre()) === v }}
                        onClick={() => setTimpEstimatOre(String(v))}
                        type="button"
                      >
                        {v}h
                      </button>
                    )}
                  </For>
                </div>
              </div>
                </div>
              </div>
            </div>
            <div class="sl-modal-footer" style="justify-content:space-between">
              <button
                class="btn btn-danger-outline btn-sm"
                onClick={() => {
                  setFdlMode(false);
                  setConstatari("");
                  setSugestii("");
                  setTimpEstimatOre("");
                  setShowFdlModal(false);
                }}
                title="Renunță la modul Fișă de Lucru — bonul va fi salvat ca deviz normal"
              >
                Anulează Fișa de Lucru
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => setShowFdlModal(false)}>
                Salvează în Fișă
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal */}
      <Show when={modal() !== null}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:600px;width:100%">
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
              onInput={(e) => {
                const val = modal() === "dateTehn" && modalUppercase() ? e.currentTarget.value.toUpperCase() : e.currentTarget.value;
                setModalDraft(val);
              }}
              rows={14}
              style={modal() === "dateTehn" && modalUppercase() ? "text-transform:uppercase" : ""}
              autofocus
            />
            <Show when={modal() === "dateTehn"}>
              <div style="padding:4px 12px 8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;cursor:pointer;user-select:none">
                  <input
                    type="checkbox"
                    checked={!modalUppercase()}
                    onChange={(e) => setModalUppercase(!e.currentTarget.checked)}
                  />
                  Scriere normală (litere mici/mari)
                </label>
              </div>
            </Show>
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
