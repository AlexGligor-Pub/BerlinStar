import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { apiFetch } from "../utils/api";
import { employees, loadEmployees } from "../store/employeesStore";
import {
  cazari, marci, dimensiuni, locuriCazare, cazariHasMore, cazariLoadingMore,
  loadCazari, loadMoreCazari, loadAnvelope, loadMarci, loadDimensiuni, loadLocuriCazare,
  invalidateLocuriCache, invalidateMarciCache, invalidateDimensiuniCache,
  type Cazare, type Anvelopa, type TipAnvelopa,
} from "../store/hotelAnvelopeStore";
import { generateCazareCheckin, generateCazareCheckout } from "../utils/generateDocuments";
import type { CompanyData } from "../utils/generateDocuments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIP_LABELS: Record<TipAnvelopa, string> = {
  iarna: "Iarnă",
  vara: "Vară",
  ms: "M+S",
  altele: "Altele",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

interface ClientItem {
  id: number;
  nume: string;
  cui: string | null;
  telefon: string | null;
  adresa: string | null;
  reprezentant: string | null;
}

// ─── Sub-component: ClientSearch ─────────────────────────────────────────────

function ClientSearch(props: {
  value: ClientItem | null;
  onSelect: (c: ClientItem | null) => void;
}) {
  const [q, setQ] = createSignal("");
  const [results, setResults] = createSignal<ClientItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [open, setOpen] = createSignal(false);

  async function search(val: string) {
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/clienti?q=${encodeURIComponent(val)}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.items ?? []);
      setOpen(true);
    } finally { setSearching(false); }
  }

  function pick(c: ClientItem) {
    props.onSelect(c);
    setQ(c.nume);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    props.onSelect(null);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div style="position:relative">
      <div style="display:flex;gap:6px">
        <input
          class="input"
          placeholder="Caută client după nume..."
          value={q()}
          onInput={(e) => { setQ(e.currentTarget.value); search(e.currentTarget.value); }}
          onFocus={() => { if (results().length) setOpen(true); }}
        />
        <Show when={props.value}>
          <button class="btn btn-ghost btn-sm" onClick={clear} title="Șterge">✕</button>
        </Show>
      </div>
      <Show when={open() && results().length > 0}>
        <div class="client-search-dropdown" style="position:absolute;left:0;right:0;z-index:200;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
          <For each={results()}>
            {(c) => (
              <button
                class="client-search-item"
                style="display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;cursor:pointer;font-size:13px"
                onMouseDown={() => pick(c)}
              >
                <span style="font-weight:600">{c.nume}</span>
                <Show when={c.cui}><span style="color:var(--text-muted);margin-left:8px;font-size:11px">CUI: {c.cui}</span></Show>
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={searching()}>
        <span style="position:absolute;right:40px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px">...</span>
      </Show>
    </div>
  );
}

// ─── Sub-component: ClientInfoBlock ──────────────────────────────────────────

function ClientInfoBlock(props: { client: ClientItem | null }) {
  return (
    <Show when={props.client}>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;background:var(--bg);border-radius:6px;padding:8px 10px;font-size:13px">
        <div><span style="color:var(--text-muted)">Nume:</span> <strong>{props.client!.nume}</strong></div>
        <Show when={props.client!.cui}><div><span style="color:var(--text-muted)">CUI:</span> {props.client!.cui}</div></Show>
        <Show when={props.client!.telefon}><div><span style="color:var(--text-muted)">Tel:</span> {props.client!.telefon}</div></Show>
        <Show when={props.client!.adresa}><div><span style="color:var(--text-muted)">Adresă:</span> {props.client!.adresa}</div></Show>
      </div>
    </Show>
  );
}

// ─── Sub-component: AnvelopaForm (formular adăugare anvelopă nouă) ────────────

function AnvelopaForm(props: {
  clientId: number;
  onSaved: (a: Anvelopa) => void;
  onCancel: () => void;
}) {
  const [marcaId, setMarcaId] = createSignal<number | "">("");
  const [dimensiuneId, setDimensiuneId] = createSignal<number | "">("");
  const [tip, setTip] = createSignal<TipAnvelopa>("vara");
  const [adancime, setAdancime] = createSignal("");
  const [err, setErr] = createSignal("");
  // inline adaugare marca/dimensiune noua
  const [newMarca, setNewMarca] = createSignal("");
  const [newDim, setNewDim] = createSignal("");

  async function addMarca() {
    const n = newMarca().trim();
    if (!n) return;
    const res = await apiFetch("/api/marci-anvelope", { method: "POST", body: JSON.stringify({ nume: n }) });
    if (res.ok) {
      const d = await res.json();
      invalidateMarciCache();
      await loadMarci(true);
      setMarcaId(d.id);
      setNewMarca("");
    }
  }

  async function addDim() {
    const v = newDim().trim();
    if (!v) return;
    const res = await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: v }) });
    if (res.ok) {
      const d = await res.json();
      invalidateDimensiuniCache();
      await loadDimensiuni(true);
      setDimensiuneId(d.id);
      setNewDim("");
    }
  }

  function confirm() {
    setErr("");
    const marcaOption = marci().find((m) => m.id === marcaId());
    const dimOption = dimensiuni().find((d) => d.id === dimensiuneId());
    // ID negativ temporar — va fi creat pe server la save-ul cazării
    const tempId = -Date.now();
    props.onSaved({
      id: tempId,
      clientId: props.clientId,
      marcaId: marcaId() !== "" ? (marcaId() as number) : null,
      dimensiuneId: dimensiuneId() !== "" ? (dimensiuneId() as number) : null,
      tip: tip(),
      adancime: adancime() !== "" ? parseFloat(adancime()) : null,
      comments: null,
      marcaNume: marcaOption?.nume ?? null,
      dimensiuneValoare: dimOption?.valoare ?? null,
    });
  }

  return (
    <div style="background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:12px;margin-top:8px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Anvelopă nouă</div>
      <div style="display:grid;gap:6px">
        {/* Marcă */}
        <div style="display:flex;gap:6px;align-items:center">
          <select class="input" style="flex:1" value={marcaId()} onChange={(e) => setMarcaId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
            <option value="">— Marcă —</option>
            <For each={marci()}>{(m) => <option value={m.id}>{m.nume}</option>}</For>
          </select>
          <input class="input" style="flex:1" placeholder="Marcă nouă..." value={newMarca()} onInput={(e) => setNewMarca(e.currentTarget.value)} />
          <button class="btn btn-ghost btn-sm" onClick={addMarca} disabled={!newMarca().trim()}>+</button>
        </div>
        {/* Dimensiune */}
        <div style="display:flex;gap:6px;align-items:center">
          <select class="input" style="flex:1" value={dimensiuneId()} onChange={(e) => setDimensiuneId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
            <option value="">— Dimensiune —</option>
            <For each={dimensiuni()}>{(d) => <option value={d.id}>{d.valoare}</option>}</For>
          </select>
          <input class="input" style="flex:1" placeholder="Dimensiune nouă..." value={newDim()} onInput={(e) => setNewDim(e.currentTarget.value)} />
          <button class="btn btn-ghost btn-sm" onClick={addDim} disabled={!newDim().trim()}>+</button>
        </div>
        {/* Tip + Adâncime */}
        <div style="display:flex;gap:6px">
          <select class="input" style="flex:1" value={tip()} onChange={(e) => setTip(e.currentTarget.value as TipAnvelopa)}>
            <option value="iarna">Iarnă</option>
            <option value="vara">Vară</option>
            <option value="ms">M+S</option>
            <option value="altele">Altele</option>
          </select>
          <input class="input" type="number" style="flex:1" placeholder="Adâncime (mm)" value={adancime()} onInput={(e) => setAdancime(e.currentTarget.value)} min="0" step="0.1" />
        </div>
      </div>
      <Show when={err()}><p style="color:var(--danger);font-size:12px;margin:6px 0 0">{err()}</p></Show>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" onClick={props.onCancel}>Anulează</button>
        <button class="btn btn-primary btn-sm" onClick={confirm}>Adaugă</button>
      </div>
    </div>
  );
}

// ─── Sub-component: CazareCard ────────────────────────────────────────────────

function CazareCard(props: {
  cazare: Cazare;
  companyData: CompanyData | null;
  onCheckout: (c: Cazare) => void;
  onEdit: (c: Cazare) => void;
  onDeleted: (id: number) => void;
  onDeleteRequest: (id: number, name: string) => void;
}) {
  const c = () => props.cazare;
  const [pdfLoading, setPdfLoading] = createSignal<"checkin" | "checkout" | null>(null);

  async function handlePdf(type: "checkin" | "checkout") {
    setPdfLoading(type);
    try {
      if (type === "checkin") await generateCazareCheckin(c(), props.companyData);
      else await generateCazareCheckout(c(), props.companyData);
    } finally { setPdfLoading(null); }
  }

  return (
    <div class="rcard" style="padding:7px 12px">
      {/* Header card */}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{c().clientNume ?? "—"}</div>
          <Show when={c().clientTelefon}><div style="font-size:11px;color:var(--text-muted);white-space:nowrap">{c().clientTelefon}</div></Show>
        </div>
        <Show
          when={c().dataCheckout}
          fallback={<span style="background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap">În cazare</span>}
        >
          <span style="background:var(--bg);color:var(--text-muted);padding:1px 7px;border-radius:12px;font-size:11px;white-space:nowrap">Ieșit</span>
        </Show>
      </div>

      {/* Info row */}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:3px;font-size:11px;color:var(--text-muted)">
        <span><strong>Check-in:</strong> {fmtDate(c().dataCheckin)}</span>
        <Show when={c().dataCheckout}><span><strong>Check-out:</strong> {fmtDate(c().dataCheckout)}</span></Show>
        <Show when={c().locCazareNume}><span><strong>Loc:</strong> {c().locCazareNume}</span></Show>
        <Show when={c().employeeName}><span><strong>Angajat:</strong> {c().employeeName}</span></Show>
        <Show when={c().dataCheckout}>
          <span style="font-weight:600;color:var(--primary)">{daysBetween(c().dataCheckin, c().dataCheckout!)} zile</span>
        </Show>
      </div>

      {/* Anvelope + comentarii pe același rând */}
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:3px">
        <For each={c().items}>
          {(item) => (
            <Show when={item.anvelopa}>
              <span style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:10px">
                {item.anvelopa!.marcaNume ?? "—"} {item.anvelopa!.dimensiuneValoare ?? ""} · {TIP_LABELS[item.anvelopa!.tip]}
                <Show when={item.anvelopa!.adancime != null}> · {item.anvelopa!.adancime}mm</Show>
              </span>
            </Show>
          )}
        </For>
        <Show when={c().comments}>
          <span style="font-size:11px;color:var(--text-muted);font-style:italic">{c().comments}</span>
        </Show>
      </div>

      {/* Acțiuni */}
      <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
        <Show when={!c().dataCheckout}>
          <button class="btn btn-primary btn-sm" onClick={() => props.onCheckout(c())}>Scoatere</button>
          <button class="btn btn-ghost btn-sm" onClick={() => props.onEdit(c())}>Editează</button>
        </Show>
        <button class="btn btn-ghost btn-sm" onClick={() => handlePdf("checkin")} disabled={pdfLoading() === "checkin"}>
          {pdfLoading() === "checkin" ? "..." : "PDF Intrare"}
        </button>
        <Show when={c().dataCheckout}>
          <button class="btn btn-ghost btn-sm" onClick={() => handlePdf("checkout")} disabled={pdfLoading() === "checkout"}>
            {pdfLoading() === "checkout" ? "..." : "PDF Ieșire"}
          </button>
        </Show>
        <button class="btn btn-danger btn-sm" onClick={() => props.onDeleteRequest(c().id, c().clientNume ?? "—")}>
          Șterge
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HotelAnvelope() {
  const [view, setView] = createSignal<"active" | "istoric">("active");
  const [loading, setLoading] = createSignal(false);
  const [companyData, setCompanyData] = createSignal<CompanyData | null>(null);

  // ── Modal Cazare Nouă ──────────────────────────────────────────────────────
  const [showNewModal, setShowNewModal] = createSignal(false);
  const [newClient, setNewClient] = createSignal<ClientItem | null>(null);
  const [clientAnvelope, setClientAnvelope] = createSignal<Anvelopa[]>([]);
  const [selectedAnvIds, setSelectedAnvIds] = createSignal<Set<number>>(new Set());
  const [showAnvForm, setShowAnvForm] = createSignal(false);
  const [newLocId, setNewLocId] = createSignal<number | "">("");
  const [newEmpId, setNewEmpId] = createSignal<number | "">("");
  const [newCheckin, setNewCheckin] = createSignal(todayStr());
  const [newComments, setNewComments] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [saveErr, setSaveErr] = createSignal("");

  // ── Modal Checkout ─────────────────────────────────────────────────────────
  const [checkoutCazare, setCheckoutCazare] = createSignal<Cazare | null>(null);
  const [checkoutDate, setCheckoutDate] = createSignal(todayStr());
  const [checkoutComments, setCheckoutComments] = createSignal("");
  const [checkoutSaving, setCheckoutSaving] = createSignal(false);

  // ── Modal Delete ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = createSignal<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  // ── Modal Edit ─────────────────────────────────────────────────────────────
  const [editCazare, setEditCazare] = createSignal<Cazare | null>(null);
  const [editLocId, setEditLocId] = createSignal<number | "">("");
  const [editEmpId, setEditEmpId] = createSignal<number | "">("");
  const [editCheckin, setEditCheckin] = createSignal("");
  const [editComments, setEditComments] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);

  // ── Filtre ─────────────────────────────────────────────────────────────────
  const [searchName, setSearchName] = createSignal("");
  const [filterDim, setFilterDim] = createSignal("");
  const [filterTip, setFilterTip] = createSignal<TipAnvelopa | "">("");

  // ── Admin section ──────────────────────────────────────────────────────────
  const [adminTab, setAdminTab] = createSignal<"locuri" | "marci" | "dimensiuni">("locuri");

  // admin forms
  const [newLocNume, setNewLocNume] = createSignal("");
  const [newLocDesc, setNewLocDesc] = createSignal("");
  const [newMarcaNume, setNewMarcaNume] = createSignal("");
  const [newDimValoare, setNewDimValoare] = createSignal("");

  let sentinelRef: HTMLDivElement | undefined;

  onMount(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCazari(),
        loadMarci(),
        loadDimensiuni(),
        loadLocuriCazare(),
        loadEmployees(),
        fetchCompany(),
      ]);
    } finally { setLoading(false); }

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreCazari(); },
      { threshold: 0.1 }
    );
    if (sentinelRef) observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  async function fetchCompany() {
    try {
      const res = await apiFetch("/api/companies?limit=1");
      if (!res.ok) return;
      const data = await res.json();
      if (data.items?.length > 0) {
        const co = data.items[0];
        setCompanyData({
          name: co.name, cui: String(co.cui),
          address: co.address ?? null, nr_reg_com: co.nr_reg_com ?? null,
          phone: co.phone ?? null, tva_percentage: co.tva_percentage ?? null,
          logo_path: co.logo_path ?? null, background_path: co.background_path ?? null,
          website: co.website ?? null,
        });
      }
    } catch {}
  }

  async function fetchCazari() {
    if (view() === "active") {
      await loadCazari({ activa: true, limit: 30 });
    } else {
      await loadCazari({ activa: false, limit: 30 });
    }
  }

  createEffect(() => {
    const v = view();
    void v;
    fetchCazari();
  });

  const filtered = createMemo(() => {
    const name = searchName().toLowerCase().trim();
    const dim = filterDim().toLowerCase().trim();
    const tip = filterTip();
    return cazari().filter((c) => {
      if (name && !(c.clientNume ?? "").toLowerCase().includes(name)) return false;
      if (dim) {
        const hasDim = c.items.some((item) =>
          (item.anvelopa?.dimensiuneValoare ?? "").toLowerCase().includes(dim)
        );
        if (!hasDim) return false;
      }
      if (tip) {
        const hasTip = c.items.some((item) => item.anvelopa?.tip === tip);
        if (!hasTip) return false;
      }
      return true;
    });
  });

  async function loadClientAnvelope(clientId: number) {
    const anvs = await loadAnvelope(clientId);
    setClientAnvelope(anvs);
    // selectăm toate implicit
    setSelectedAnvIds(new Set(anvs.map((a) => a.id)));
  }

  function toggleAnv(id: number) {
    setSelectedAnvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNewModal() {
    setNewClient(null);
    setClientAnvelope([]);
    setSelectedAnvIds(new Set<number>());
    setShowAnvForm(false);
    setNewLocId("");
    setNewEmpId("");
    setNewCheckin(todayStr());
    setNewComments("");
    setSaveErr("");
    setShowNewModal(true);
  }

  async function handleClientSelect(c: ClientItem | null) {
    setNewClient(c);
    if (c) await loadClientAnvelope(c.id);
    else { setClientAnvelope([]); setSelectedAnvIds(new Set<number>()); }
  }

  async function saveCazare() {
    setSaveErr("");
    if (!newClient()) { setSaveErr("Selectați un client."); return; }
    if (selectedAnvIds().size === 0) { setSaveErr("Selectați cel puțin o anvelopă."); return; }
    setSaving(true);
    try {
      // Creăm mai întâi anvelopele draft (ID negativ temporar)
      const draftIds = Array.from(selectedAnvIds()).filter((id) => id < 0);
      const tempToReal = new Map<number, number>();
      for (const tempId of draftIds) {
        const draft = clientAnvelope().find((a) => a.id === tempId);
        if (!draft) continue;
        const res = await apiFetch("/api/anvelope", {
          method: "POST",
          body: JSON.stringify({
            client_id: draft.clientId,
            marca_id: draft.marcaId,
            dimensiune_id: draft.dimensiuneId,
            tip: draft.tip,
            adancime: draft.adancime,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setSaveErr(err.detail ?? "Eroare la salvare anvelopă.");
          return;
        }
        const d = await res.json();
        tempToReal.set(tempId, d.id);
      }

      const finalIds = Array.from(selectedAnvIds()).map((id) => tempToReal.get(id) ?? id);

      const body = {
        client_id: newClient()!.id,
        employee_id: newEmpId() !== "" ? newEmpId() : null,
        loc_cazare_id: newLocId() !== "" ? newLocId() : null,
        data_checkin: newCheckin(),
        comments: newComments().trim() || null,
        anvelopa_ids: finalIds,
      };
      const res = await apiFetch("/api/cazare-anvelope", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveErr(err.detail ?? "Eroare la salvare.");
        return;
      }
      setShowNewModal(false);
      await fetchCazari();
    } finally { setSaving(false); }
  }

  function openCheckout(c: Cazare) {
    setCheckoutCazare(c);
    setCheckoutDate(todayStr());
    setCheckoutComments(c.comments ?? "");
  }

  function openEdit(c: Cazare) {
    setEditCazare(c);
    setEditLocId(c.locCazareId ?? "");
    setEditEmpId(c.employeeId ?? "");
    setEditCheckin(c.dataCheckin);
    setEditComments(c.comments ?? "");
  }

  async function doEdit() {
    const c = editCazare();
    if (!c) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/cazare-anvelope/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          employee_id: editEmpId() !== "" ? editEmpId() : null,
          loc_cazare_id: editLocId() !== "" ? editLocId() : null,
          data_checkin: editCheckin() || null,
          comments: editComments().trim() || null,
        }),
      });
      if (!res.ok) return;
      setEditCazare(null);
      await fetchCazari();
    } finally { setEditSaving(false); }
  }

  async function doCheckout(andNew = false) {
    const c = checkoutCazare();
    if (!c) return;
    setCheckoutSaving(true);
    try {
      const res = await apiFetch(`/api/cazare-anvelope/${c.id}/checkout`, {
        method: "PATCH",
        body: JSON.stringify({ data_checkout: checkoutDate(), comments: checkoutComments().trim() || null }),
      });
      if (!res.ok) return;
      const updated: Cazare = await res.json().then((d: any) => ({
        id: d.id,
        clientId: d.client_id ?? null,
        employeeId: d.employee_id ?? null,
        locCazareId: d.loc_cazare_id ?? null,
        dataCheckin: d.data_checkin,
        dataCheckout: d.data_checkout ?? null,
        comments: d.comments ?? null,
        createdAt: d.created_at,
        clientNume: d.client_nume ?? null,
        clientCui: d.client_cui ?? null,
        clientTelefon: d.client_telefon ?? null,
        clientAdresa: d.client_adresa ?? null,
        clientReprezentant: d.client_reprezentant ?? null,
        employeeName: d.employee_name ?? null,
        locCazareNume: d.loc_cazare_nume ?? null,
        items: (d.items ?? []).map((item: any) => ({
          id: item.id,
          anvelopaId: item.anvelopa_id ?? null,
          anvelopa: item.anvelopa ? {
            id: item.anvelopa.id, clientId: item.anvelopa.client_id ?? null,
            marcaId: item.anvelopa.marca_id ?? null, dimensiuneId: item.anvelopa.dimensiune_id ?? null,
            tip: item.anvelopa.tip, adancime: item.anvelopa.adancime ?? null, comments: item.anvelopa.comments ?? null,
            marcaNume: item.anvelopa.marca_nume ?? null, dimensiuneValoare: item.anvelopa.dimensiune_valoare ?? null,
          } : null,
        })),
      }));
      setCheckoutCazare(null);
      await generateCazareCheckout(updated, companyData());
      await fetchCazari();
      if (andNew && c.clientId) {
        setClientAnvelope([]);
        setSelectedAnvIds(new Set<number>());
        setShowAnvForm(false);
        setNewLocId("");
        setNewEmpId("");
        setNewCheckin(todayStr());
        setNewComments("");
        setSaveErr("");
        setNewClient({
          id: c.clientId,
          nume: c.clientNume ?? "",
          cui: c.clientCui,
          telefon: c.clientTelefon,
          adresa: c.clientAdresa,
          reprezentant: c.clientReprezentant,
        });
        setShowNewModal(true);
        await loadClientAnvelope(c.clientId);
      }
    } finally { setCheckoutSaving(false); }
  }

  function removeCazare(_id: number) {
    fetchCazari();
  }

  async function doDelete() {
    const t = deleteTarget();
    if (!t) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/cazare-anvelope/${t.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setDeleteTarget(null);
        await fetchCazari();
      }
    } finally { setDeleting(false); }
  }

  // ── Admin CRUD helpers ────────────────────────────────────────────────────

  async function addLoc() {
    const n = newLocNume().trim();
    if (!n) return;
    await apiFetch("/api/loc-cazare", {
      method: "POST",
      body: JSON.stringify({ nume: n, description: newLocDesc().trim() || null }),
    });
    invalidateLocuriCache();
    await loadLocuriCazare(true);
    setNewLocNume(""); setNewLocDesc("");
  }

  async function deleteLoc(id: number) {
    await apiFetch(`/api/loc-cazare/${id}`, { method: "DELETE" });
    invalidateLocuriCache();
    await loadLocuriCazare(true);
  }

  async function addMarca() {
    const n = newMarcaNume().trim();
    if (!n) return;
    await apiFetch("/api/marci-anvelope", { method: "POST", body: JSON.stringify({ nume: n }) });
    invalidateMarciCache();
    await loadMarci(true);
    setNewMarcaNume("");
  }

  async function deleteMarca(id: number) {
    await apiFetch(`/api/marci-anvelope/${id}`, { method: "DELETE" });
    invalidateMarciCache();
    await loadMarci(true);
  }

  async function addDim() {
    const v = newDimValoare().trim();
    if (!v) return;
    await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: v }) });
    invalidateDimensiuniCache();
    await loadDimensiuni(true);
    setNewDimValoare("");
  }

  async function deleteDim(id: number) {
    await apiFetch(`/api/dimensiuni-anvelope/${id}`, { method: "DELETE" });
    invalidateDimensiuniCache();
    await loadDimensiuni(true);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div class="page-content">

      {/* ── Header ── */}
      <div class="page-header">
        <h1 class="page-title">Hotel Anvelope</h1>
        <div class="reception-header-right">
          <input
            class="input reception-search"
            type="search"
            placeholder="Caută client..."
            value={searchName()}
            onInput={(e) => setSearchName(e.currentTarget.value)}
          />
          <select
            class="input"
            style="width:160px;font-size:13px"
            value={filterDim()}
            onChange={(e) => setFilterDim(e.currentTarget.value)}
          >
            <option value="">— Dimensiune —</option>
            <For each={dimensiuni()}>{(d) => <option value={d.valoare}>{d.valoare}</option>}</For>
          </select>
          <select
            class="input"
            style="width:130px;font-size:13px"
            value={filterTip()}
            onChange={(e) => setFilterTip(e.currentTarget.value as TipAnvelopa | "")}
          >
            <option value="">— Tip —</option>
            <option value="iarna">Iarnă</option>
            <option value="vara">Vară</option>
            <option value="ms">M+S</option>
            <option value="altele">Altele</option>
          </select>
          <span class="reception-count">{filtered().length} / {cazari().length} cazări</span>
          <button class="btn btn-primary btn-sm" onClick={openNewModal}>+ Cazare Nouă</button>
        </div>
      </div>

      {/* ── Layout: stânga=Admin, dreapta=Listă ── */}
      <div style="display:flex;gap:16px;align-items:flex-start">

        {/* ══ Coloana Stânga: Administrare ══ */}
        <div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:0">
          <div class="rcard" style="padding:14px 16px">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:12px">Administrare</div>

            {/* Tab-uri admin */}
            <div style="display:flex;gap:4px;margin-bottom:12px">
              <button class={`btn btn-sm ${adminTab() === "locuri" ? "btn-primary" : "btn-ghost"}`} style="flex:1;font-size:11px" onClick={() => setAdminTab("locuri")}>Locuri</button>
              <button class={`btn btn-sm ${adminTab() === "marci" ? "btn-primary" : "btn-ghost"}`} style="flex:1;font-size:11px" onClick={() => setAdminTab("marci")}>Mărci</button>
              <button class={`btn btn-sm ${adminTab() === "dimensiuni" ? "btn-primary" : "btn-ghost"}`} style="flex:1;font-size:11px" onClick={() => setAdminTab("dimensiuni")}>Dim.</button>
            </div>

            {/* Locuri */}
            <Show when={adminTab() === "locuri"}>
              <div style="display:flex;flex-direction:column;gap:6px">
                <input class="input" style="font-size:12px" placeholder="Nume loc *" value={newLocNume()} onInput={(e) => setNewLocNume(e.currentTarget.value)} />
                <input class="input" style="font-size:12px" placeholder="Descriere" value={newLocDesc()} onInput={(e) => setNewLocDesc(e.currentTarget.value)} />
                <button class="btn btn-primary btn-sm w-full" onClick={addLoc} disabled={!newLocNume().trim()}>+ Adaugă</button>
                <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
                  <For each={locuriCazare()}>
                    {(loc) => (
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg);border-radius:5px;font-size:12px">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"><strong>{loc.nume}</strong></span>
                        <button class="btn btn-danger btn-sm" style="padding:1px 6px;font-size:11px;margin-left:4px" onClick={() => deleteLoc(loc.id)}>✕</button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Mărci */}
            <Show when={adminTab() === "marci"}>
              <div style="display:flex;flex-direction:column;gap:6px">
                <input class="input" style="font-size:12px" placeholder="Nume marcă *" value={newMarcaNume()} onInput={(e) => setNewMarcaNume(e.currentTarget.value)} />
                <button class="btn btn-primary btn-sm w-full" onClick={addMarca} disabled={!newMarcaNume().trim()}>+ Adaugă</button>
                <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
                  <For each={marci()}>
                    {(m) => (
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg);border-radius:5px;font-size:12px">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">{m.nume}</span>
                        <button class="btn btn-danger btn-sm" style="padding:1px 6px;font-size:11px;margin-left:4px" onClick={() => deleteMarca(m.id)}>✕</button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Dimensiuni */}
            <Show when={adminTab() === "dimensiuni"}>
              <div style="display:flex;flex-direction:column;gap:6px">
                <input class="input" style="font-size:12px" placeholder="ex: 205/55 R16 *" value={newDimValoare()} onInput={(e) => setNewDimValoare(e.currentTarget.value)} />
                <button class="btn btn-primary btn-sm w-full" onClick={addDim} disabled={!newDimValoare().trim()}>+ Adaugă</button>
                <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
                  <For each={dimensiuni()}>
                    {(d) => (
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg);border-radius:5px;font-size:12px">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">{d.valoare}</span>
                        <button class="btn btn-danger btn-sm" style="padding:1px 6px;font-size:11px;margin-left:4px" onClick={() => deleteDim(d.id)}>✕</button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* ══ Coloana Dreapta: Lista Cazări ══ */}
        <div style="flex:1;min-width:0">
          {/* Tab Active / Istoric */}
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class={`btn btn-sm ${view() === "active" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("active")}>Active</button>
            <button class={`btn btn-sm ${view() === "istoric" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("istoric")}>Istoric</button>
          </div>

          <Show when={loading()}>
            <p style="color:var(--text-muted)">Se încarcă...</p>
          </Show>

          <Show when={!loading() && filtered().length === 0}>
            <div class="rcard" style="text-align:center;padding:40px 16px">
              <div style="color:var(--text-muted)">
                {cazari().length === 0
                  ? `Nicio cazare ${view() === "active" ? "activă" : "în istoric"}.`
                  : "Niciun rezultat pentru filtrul selectat."}
              </div>
            </div>
          </Show>

          <div class="rcard-list">
            <For each={filtered()}>
              {(c) => (
                <CazareCard
                  cazare={c}
                  companyData={companyData()}
                  onCheckout={openCheckout}
                  onEdit={openEdit}
                  onDeleted={removeCazare}
                  onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
                />
              )}
            </For>
          </div>

          {/* Sentinel pentru infinite scroll */}
          <div ref={sentinelRef} style="height:40px;display:flex;align-items:center;justify-content:center">
            <Show when={cazariLoadingMore()}>
              <span style="color:var(--text-muted);font-size:13px">Se încarcă...</span>
            </Show>
            <Show when={!cazariHasMore() && !cazariLoadingMore() && cazari().length > 0}>
              <span style="color:var(--text-muted);font-size:12px">— toate cazările încărcate —</span>
            </Show>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Confirmare Ștergere
      ══════════════════════════════════════════════════════════════════════ */}
      <Show when={deleteTarget()}>
        {(t) => (
          <div class="sl-modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
              <div class="sl-modal-header">
                <span class="sl-modal-title">Șterge cazare</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
              </div>
              <div style="padding:16px 24px;font-size:14px">
                Ești sigur că vrei să ștergi cazarea lui <strong>{t().name}</strong>? Acțiunea este ireversibilă.
              </div>
              <div class="sl-modal-footer">
                <button class="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>Anulează</button>
                <button class="btn btn-danger btn-sm" onClick={doDelete} disabled={deleting()}>
                  {deleting() ? "..." : "Șterge definitiv"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Cazare Nouă
      ══════════════════════════════════════════════════════════════════════ */}
      <Show when={showNewModal()}>
        <div class="sl-modal-overlay" onClick={() => setShowNewModal(false)}>
          <div class="sl-modal" style="max-width:560px;width:100%;max-height:90vh;overflow-y:auto" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Cazare Nouă</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowNewModal(false)}>✕</button>
            </div>

            <div class="sl-modal-body" style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">

              {/* ─ Zona 1: Client ─ */}
              <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Client</div>
                <ClientSearch value={newClient()} onSelect={handleClientSelect} />
                <ClientInfoBlock client={newClient()} />
              </div>

              {/* ─ Zona 2: Anvelope ─ */}
              <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Anvelope</div>
                <Show when={!newClient()}>
                  <p style="color:var(--text-muted);font-size:13px;margin:0">Selectați un client mai întâi.</p>
                </Show>
                <Show when={newClient()}>
                  <Show when={clientAnvelope().length === 0 && !showAnvForm()}>
                    <p style="color:var(--text-muted);font-size:13px;margin:0 0 8px">Clientul nu are anvelope înregistrate.</p>
                  </Show>
                  <div style="display:flex;flex-direction:column;gap:4px">
                    <For each={clientAnvelope()}>
                      {(a) => (
                        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;background:var(--bg)">
                          <input
                            type="checkbox"
                            checked={selectedAnvIds().has(a.id)}
                            onChange={() => toggleAnv(a.id)}
                          />
                          <span>
                            <strong>{a.marcaNume ?? "—"}</strong>
                            <Show when={a.dimensiuneValoare}> {a.dimensiuneValoare}</Show>
                            {" · "}{TIP_LABELS[a.tip]}
                            <Show when={a.adancime != null}>{" · "}{a.adancime}mm</Show>
                            <Show when={a.id < 0}>
                              <span style="color:var(--primary);font-size:11px;margin-left:4px">(nou)</span>
                            </Show>
                          </span>
                        </label>
                      )}
                    </For>
                  </div>
                  <Show when={!showAnvForm()}>
                    <button class="btn btn-ghost btn-sm" style="margin-top:8px" onClick={() => setShowAnvForm(true)}>+ Anvelopă nouă</button>
                  </Show>
                  <Show when={showAnvForm()}>
                    <AnvelopaForm
                      clientId={newClient()!.id}
                      onSaved={(a) => {
                        setClientAnvelope((prev) => [...prev, a]);
                        setSelectedAnvIds((prev) => new Set([...prev, a.id]));
                        setShowAnvForm(false);
                      }}
                      onCancel={() => setShowAnvForm(false)}
                    />
                  </Show>
                </Show>
              </div>

              {/* ─ Zona 3: Date Cazare ─ */}
              <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Date Cazare</div>
                <div style="display:grid;gap:8px">
                  <select class="input" value={newLocId()} onChange={(e) => setNewLocId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
                    <option value="">— Loc de cazare —</option>
                    <For each={locuriCazare()}>{(l) => <option value={l.id}>{l.nume}</option>}</For>
                  </select>
                  <select class="input" value={newEmpId()} onChange={(e) => setNewEmpId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
                    <option value="">— Angajat —</option>
                    <For each={employees()}>{(e) => <option value={e.id}>{e.name}</option>}</For>
                  </select>
                  <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data check-in</label>
                    <input class="input" type="date" value={newCheckin()} onInput={(e) => setNewCheckin(e.currentTarget.value)} />
                  </div>
                  <textarea class="input" rows={2} placeholder="Comentarii..." style="resize:vertical" value={newComments()} onInput={(e) => setNewComments(e.currentTarget.value)} />
                </div>
              </div>

              <Show when={saveErr()}>
                <p style="color:var(--danger);font-size:13px;margin:0">{saveErr()}</p>
              </Show>
            </div>

            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowNewModal(false)}>Anulează</button>
              <button class="btn btn-primary btn-sm" onClick={saveCazare} disabled={saving()}>
                {saving() ? "Se salvează..." : "Salvează Cazarea"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Checkout
      ══════════════════════════════════════════════════════════════════════ */}
      <Show when={checkoutCazare()}>
        {(c) => (
          <div class="sl-modal-overlay" onClick={() => setCheckoutCazare(null)}>
            <div class="sl-modal" style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto" onClick={(e) => e.stopPropagation()}>
              <div class="sl-modal-header">
                <span class="sl-modal-title">Scoatere Anvelope</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setCheckoutCazare(null)}>✕</button>
              </div>

              <div class="sl-modal-body" style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">

                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Client</div>
                  <div style="display:grid;gap:6px;font-size:13px">
                    <div><span style="color:var(--text-muted)">Nume:</span> <strong>{c().clientNume ?? "—"}</strong></div>
                    <Show when={c().clientCui}><div><span style="color:var(--text-muted)">CUI:</span> {c().clientCui}</div></Show>
                    <Show when={c().clientTelefon}><div><span style="color:var(--text-muted)">Telefon:</span> {c().clientTelefon}</div></Show>
                    <Show when={c().clientAdresa}><div><span style="color:var(--text-muted)">Adresă:</span> {c().clientAdresa}</div></Show>
                  </div>
                </div>

                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Anvelope</div>
                  <Show when={c().items.length === 0}>
                    <p style="color:var(--text-muted);font-size:13px;margin:0">—</p>
                  </Show>
                  <Show when={c().items.length > 0}>
                    <div style="overflow-x:auto">
                      <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead>
                          <tr style="background:var(--bg);color:var(--text-muted)">
                            <th style="padding:4px 8px;text-align:left">Marcă</th>
                            <th style="padding:4px 8px;text-align:left">Dimensiune</th>
                            <th style="padding:4px 8px;text-align:left">Tip</th>
                            <th style="padding:4px 8px;text-align:left">Adâncime</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={c().items}>
                            {(item) => (
                              <Show when={item.anvelopa}>
                                <tr>
                                  <td style="padding:4px 8px">{item.anvelopa!.marcaNume ?? "—"}</td>
                                  <td style="padding:4px 8px">{item.anvelopa!.dimensiuneValoare ?? "—"}</td>
                                  <td style="padding:4px 8px">{TIP_LABELS[item.anvelopa!.tip]}</td>
                                  <td style="padding:4px 8px">{item.anvelopa!.adancime != null ? `${item.anvelopa!.adancime} mm` : "—"}</td>
                                </tr>
                              </Show>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </div>

                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Date Cazare</div>
                  <div style="display:grid;gap:8px;font-size:13px">
                    <Show when={c().locCazareNume}><div><span style="color:var(--text-muted)">Loc:</span> {c().locCazareNume}</div></Show>
                    <Show when={c().employeeName}><div><span style="color:var(--text-muted)">Angajat:</span> {c().employeeName}</div></Show>
                    <div><span style="color:var(--text-muted)">Check-in:</span> {fmtDate(c().dataCheckin)}</div>
                    <div>
                      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data check-out</label>
                      <input class="input" type="date" value={checkoutDate()} onInput={(e) => setCheckoutDate(e.currentTarget.value)} />
                    </div>
                    <Show when={checkoutDate()}>
                      <div style="font-weight:600;color:var(--primary);font-size:14px">
                        Durată: {daysBetween(c().dataCheckin, checkoutDate())} zile
                      </div>
                    </Show>
                    <textarea class="input" rows={2} placeholder="Comentarii..." style="resize:vertical" value={checkoutComments()} onInput={(e) => setCheckoutComments(e.currentTarget.value)} />
                  </div>
                </div>
              </div>

              <div class="sl-modal-footer">
                <button class="btn btn-ghost btn-sm" onClick={() => setCheckoutCazare(null)}>Anulează</button>
                <button class="btn btn-ghost btn-sm" onClick={() => doCheckout(true)} disabled={checkoutSaving()}>
                  {checkoutSaving() ? "..." : "Scoatere și introducere nouă"}
                </button>
                <button class="btn btn-primary btn-sm" onClick={() => doCheckout()} disabled={checkoutSaving()}>
                  {checkoutSaving() ? "Se procesează..." : "Confirmă Scoaterea"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Editare Cazare
      ══════════════════════════════════════════════════════════════════════ */}
      <Show when={editCazare()}>
        <div class="sl-modal-overlay" onClick={() => setEditCazare(null)}>
          <div class="sl-modal" style="max-width:460px;width:100%" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Editare Cazare — {editCazare()!.clientNume ?? "—"}</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setEditCazare(null)}>✕</button>
            </div>
            <div class="sl-modal-body" style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Loc de cazare</label>
                <select class="input" value={editLocId()} onChange={(e) => setEditLocId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
                  <option value="">— fără loc —</option>
                  <For each={locuriCazare()}>{(l) => <option value={l.id}>{l.nume}</option>}</For>
                </select>
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Angajat</label>
                <select class="input" value={editEmpId()} onChange={(e) => setEditEmpId(e.currentTarget.value !== "" ? parseInt(e.currentTarget.value) : "")}>
                  <option value="">— fără angajat —</option>
                  <For each={employees()}>{(e) => <option value={e.id}>{e.name}</option>}</For>
                </select>
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data check-in</label>
                <input class="input" type="date" value={editCheckin()} onInput={(e) => setEditCheckin(e.currentTarget.value)} />
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Comentarii</label>
                <textarea class="input" rows={2} style="resize:vertical" value={editComments()} onInput={(e) => setEditComments(e.currentTarget.value)} />
              </div>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setEditCazare(null)}>Anulează</button>
              <button class="btn btn-primary btn-sm" onClick={doEdit} disabled={editSaving()}>
                {editSaving() ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
