import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup, on } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { apiFetch, API_BASE } from "../utils/api";
import { adminVisible } from "../store/adminStore";
import { notify } from "../store/notificationsStore";
import { employees, loadEmployees } from "../store/employeesStore";
import { posHotelCtx, clearPosHotelCtx, setPendingPosReturn } from "../store/posHotelStore";
import { device } from "../store/deviceStore";
import {
  cazari, marci, dimensiuni, profiluri, coduriDot, locuriCazare, cazariHasMore, cazariLoadingMore,
  loadCazari, loadMoreCazari, loadMarci, loadDimensiuni, loadProfil, loadCoduriDot, loadLocuriCazare,
  invalidateLocuriCache, invalidateMarciCache, invalidateDimensiuniCache, invalidateProfilCache, invalidateCoduriDotCache,
  hotelImages, loadHotelImages, getCazareById, getVehiculForCazare,
  INDICE_VITEZA_SHORTCUTS, INDICE_SARCINA_SHORTCUTS,
  type Cazare, type Anvelopa, type TipAnvelopa,
} from "../store/hotelAnvelopeStore";
import { loadLatestMontajByPlate, POZITIE_LABELS, type MontajSuggestion } from "../store/montajRotiStore";

const SHORTCUT_BTN_STYLE = "font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer";

interface ClientVehicol {
  id: number;
  numar_masina: string;
  marca: string | null;
  model: string | null;
}
import { generateCazareCheckin, generateCazareCheckout, generateCazareScoatereIntroducere } from "../utils/generateDocuments";
import type { CompanyData } from "../utils/generateDocuments";
import { generalSettings, type GeneralSettingsData } from "../store/generalSettingsStore";

const hotelShowField = (key: keyof GeneralSettingsData): boolean => {
  const s = generalSettings();
  if (!s) return true;
  return s[key] !== false;
};

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

/** Construieste URL-uri same-origin pentru imaginile hotel (proxy backend), evitand CORS S3 in PDF. */
function buildHotelImageProxyUrls() {
  const h = hotelImages();
  return {
    cazare:   h.cazare   ? `${API_BASE}/api/global-settings/hotel-anvelope/image/cazare`   : null,
    scoatere: h.scoatere ? `${API_BASE}/api/global-settings/hotel-anvelope/image/scoatere` : null,
    montare:  h.montare  ? `${API_BASE}/api/global-settings/hotel-anvelope/image/montare`  : null,
  };
}

interface ClientItem {
  id: number;
  nume: string;
  cui: string | null;
  telefon: string | null;
  adresa: string | null;
  reprezentant: string | null;
  numar_masina: string | null;
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
  const [searched, setSearched] = createSignal(false);

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
  }

  return (
    <div style="position:relative">
      <div style="display:flex;gap:6px">
        <input
          class="input"
          placeholder="Caută client după nume sau nr. mașină..."
          value={q()}
          onInput={(e) => { setQ(e.currentTarget.value); search(e.currentTarget.value); }}
          onFocus={() => { if (results().length) setOpen(true); }}
        />
        <Show when={props.value}>
          <button class="btn btn-ghost btn-sm" onClick={clear} title="Șterge">✕</button>
        </Show>
      </div>
      <Show when={open() && results().length > 0}>
        <div class="client-search-dropdown" style="position:absolute;left:0;right:0;z-index:200;background:var(--surface,#fff);border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
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
      <Show when={searched() && !searching() && results().length === 0 && q().trim()}>
        <div style="position:absolute;left:0;right:0;z-index:200;background:var(--surface,#fff);border:1px solid var(--border);border-radius:6px;padding:10px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:13px">
          <span style="color:var(--text-muted)">Niciun client găsit. </span>
          <a href="/clienti" target="_blank" style="color:var(--primary);text-decoration:underline">Adaugă client nou →</a>
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

// ─── Sub-component: SearchableSelect ─────────────────────────────────────────

function SearchableSelect<T extends { id: number }>(props: {
  items: T[];
  value: number | "";
  onSelect: (id: number | "") => void;
  getLabel: (item: T) => string;
  placeholder: string;
  onAddNew?: (value: string) => Promise<void> | void;
}) {
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);

  const selected = () => props.items.find((i) => i.id === props.value) ?? null;

  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return props.items;
    return props.items.filter((i) => props.getLabel(i).toLowerCase().includes(q));
  });

  return (
    <div style="position:relative;flex:1">
      <input
        class="input"
        style="width:100%"
        placeholder={props.placeholder}
        value={open() ? query() : (selected() ? props.getLabel(selected()!) : "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <Show when={open()}>
        <div style="position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.2)">
          <div
            style="padding:5px 10px;font-size:12px;color:var(--text-muted);cursor:pointer"
            onMouseDown={(e) => { e.preventDefault(); props.onSelect(""); setOpen(false); }}
          >
            — {props.placeholder} —
          </div>
          <For each={filtered()}>
            {(item) => (
              <div
                style={`padding:6px 10px;font-size:13px;cursor:pointer;${props.value === item.id ? "font-weight:600;background:var(--primary-bg,rgba(99,102,241,.1))" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); props.onSelect(item.id); setOpen(false); setQuery(""); }}
              >
                {props.getLabel(item)}
              </div>
            )}
          </For>
          <Show when={filtered().length === 0}>
            <Show
              when={query().trim() && props.onAddNew}
              fallback={<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Niciun rezultat</div>}
            >
              <div
                style="padding:6px 10px;font-size:12px;color:var(--primary);cursor:pointer;font-weight:500"
                onMouseDown={async (e) => {
                  e.preventDefault();
                  await props.onAddNew!(query().trim());
                  setOpen(false);
                  setQuery("");
                }}
              >
                + Adaugă "{query()}"
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ─── Sub-component: AnvelopaForm (formular adăugare/editare anvelopă) ────────

function AnvelopaForm(props: {
  clientId: number;
  initialData?: Anvelopa;  // pre-populare pentru edit/copy
  onSaved: (a: Anvelopa) => void;
  onCancel: () => void;
  compact?: boolean;  // randare cu label-uri la stânga (folosit în acordeonul de edit)
}) {
  const [marcaId, setMarcaId] = createSignal<number | "">(props.initialData?.marcaId ?? "");
  const [dimensiuneId, setDimensiuneId] = createSignal<number | "">(props.initialData?.dimensiuneId ?? "");
  const [profilId, setProfilId] = createSignal<number | "">(props.initialData?.profilId ?? "");
  const [dotId, setDotId] = createSignal<number | "">(props.initialData?.dotId ?? "");
  const [tip, setTip] = createSignal<TipAnvelopa>(props.initialData?.tip ?? "vara");
  const [adancime, setAdancime] = createSignal(props.initialData?.adancime != null ? String(props.initialData.adancime) : "");
  const [indiceViteza, setIndiceViteza] = createSignal(props.initialData?.indiceViteza ?? "");
  const [indiceSarcina, setIndiceSarcina] = createSignal(props.initialData?.indiceSarcina != null ? String(props.initialData.indiceSarcina) : "");
  const [err, setErr] = createSignal("");

  onMount(() => {
    loadMarci();
    loadDimensiuni();
    loadProfil();
    loadCoduriDot();
  });

  async function addMarca(name: string) {
    const res = await apiFetch("/api/marci-anvelope", { method: "POST", body: JSON.stringify({ nume: name }) });
    if (res.ok) {
      const d = await res.json();
      invalidateMarciCache();
      await loadMarci(true);
      setMarcaId(d.id);
    }
  }

  async function addProfilInline(value: string) {
    const res = await apiFetch("/api/profiluri-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      const d = await res.json();
      invalidateProfilCache();
      await loadProfil(true);
      setProfilId(d.id);
    }
  }

  async function addDim(value: string) {
    const res = await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      const d = await res.json();
      invalidateDimensiuniCache();
      await loadDimensiuni(true);
      setDimensiuneId(d.id);
    }
  }

  async function addDotInline(value: string) {
    const res = await apiFetch("/api/coduri-dot-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      const d = await res.json();
      invalidateCoduriDotCache();
      await loadCoduriDot(true);
      setDotId(d.id);
    }
  }

  function confirm() {
    setErr("");
    const marcaOption = marci().find((m) => m.id === marcaId());
    const dimOption = dimensiuni().find((d) => d.id === dimensiuneId());
    const profilOption = profiluri().find((p) => p.id === profilId());
    const dotOption = coduriDot().find((d) => d.id === dotId());
    // ID negativ temporar — va fi creat pe server la save-ul cazării
    const tempId = -Date.now();
    props.onSaved({
      id: tempId,
      clientId: props.clientId,
      marcaId: marcaId() !== "" ? (marcaId() as number) : null,
      dimensiuneId: dimensiuneId() !== "" ? (dimensiuneId() as number) : null,
      profilId: profilId() !== "" ? (profilId() as number) : null,
      dotId: dotId() !== "" ? (dotId() as number) : null,
      tip: tip(),
      adancime: adancime() !== "" ? parseFloat(adancime()) : null,
      indiceViteza: indiceViteza().trim() !== "" ? indiceViteza().trim().toUpperCase() : null,
      indiceSarcina: indiceSarcina().trim() !== "" ? parseInt(indiceSarcina(), 10) : null,
      comments: null,
      marcaNume: marcaOption?.nume ?? null,
      dimensiuneValoare: dimOption?.valoare ?? null,
      profilValoare: profilOption?.valoare ?? null,
      dotValoare: dotOption?.valoare ?? null,
    });
  }

  const compact = () => !!props.compact;
  const gridStyle = () => compact()
    ? "display:grid;grid-template-columns:110px 1fr;gap:6px 10px;align-items:center"
    : "display:grid;gap:6px";
  const Label = (p: { children: any }) => (
    <Show when={compact()}>
      <span style="font-size:12px;color:var(--text-muted);text-align:right;padding-right:4px">{p.children}</span>
    </Show>
  );

  return (
    <div style={`background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:12px;${compact() ? "" : "margin-top:8px"}`}>
      <Show when={!compact()}>
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Anvelopă nouă</div>
      </Show>
      <div style={gridStyle()}>
        {/* Marcă */}
        <Label>Marcă</Label>
        <SearchableSelect items={marci()} value={marcaId()} onSelect={setMarcaId} getLabel={(m) => m.nume} placeholder="Marcă" onAddNew={addMarca} />
        {/* Profil */}
        <Show when={hotelShowField("hotelAnvelopeShowProfil")}>
          <Label>Profil</Label>
          <SearchableSelect items={profiluri()} value={profilId()} onSelect={setProfilId} getLabel={(p) => p.valoare} placeholder="Profil" onAddNew={addProfilInline} />
        </Show>
        {/* Dimensiune */}
        <Label>Dimensiune</Label>
        <SearchableSelect items={dimensiuni()} value={dimensiuneId()} onSelect={setDimensiuneId} getLabel={(d) => d.valoare} placeholder="Dimensiune" onAddNew={addDim} />
        {/* DOT */}
        <Show when={hotelShowField("hotelAnvelopeShowDot")}>
          <Label>DOT</Label>
          <SearchableSelect items={coduriDot()} value={dotId()} onSelect={setDotId} getLabel={(d) => d.valoare} placeholder="DOT" onAddNew={addDotInline} />
        </Show>
        {/* Adâncime */}
        <Show when={hotelShowField("hotelAnvelopeShowAdancime")}>
          <Label>Adâncime (mm)</Label>
          <input class="input" type="number" placeholder="Adâncime (mm)" value={adancime()} onInput={(e) => setAdancime(e.currentTarget.value)} min="0" step="0.1" />
        </Show>
        {/* Indice Viteza */}
        <Show when={hotelShowField("hotelAnvelopeShowIndiceViteza")}>
          <Label>Indice Viteză</Label>
          <div>
            <input
              class="input"
              style="width:100%"
              placeholder="Indice Viteză"
              maxLength={4}
              value={indiceViteza()}
              onInput={(e) => setIndiceViteza(e.currentTarget.value.toUpperCase())}
            />
            <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
              <For each={INDICE_VITEZA_SHORTCUTS}>
                {(v) => (
                  <button type="button" style={SHORTCUT_BTN_STYLE} onClick={() => setIndiceViteza(v)}>{v}</button>
                )}
              </For>
            </div>
          </div>
        </Show>
        {/* Indice Sarcina */}
        <Show when={hotelShowField("hotelAnvelopeShowIndiceSarcina")}>
          <Label>Indice Sarcină</Label>
          <div>
            <input
              class="input"
              style="width:100%"
              type="number"
              placeholder="Indice Sarcină"
              min="0"
              step="1"
              value={indiceSarcina()}
              onInput={(e) => setIndiceSarcina(e.currentTarget.value)}
            />
            <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
              <For each={INDICE_SARCINA_SHORTCUTS}>
                {(v) => (
                  <button type="button" style={SHORTCUT_BTN_STYLE} onClick={() => setIndiceSarcina(String(v))}>{v}</button>
                )}
              </For>
            </div>
          </div>
        </Show>
        {/* Tip */}
        <Show when={hotelShowField("hotelAnvelopeShowTip")}>
          <Label>Tip</Label>
          <select class="input" value={tip()} onChange={(e) => setTip(e.currentTarget.value as TipAnvelopa)}>
            <option value="iarna">Iarnă</option>
            <option value="vara">Vară</option>
            <option value="ms">M+S</option>
            <option value="altele">Altele</option>
          </select>
        </Show>
      </div>
      <Show when={err()}><p style="color:var(--danger);font-size:12px;margin:6px 0 0">{err()}</p></Show>
      <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onClick={props.onCancel}>Anulează</button>
        <button class="btn btn-primary btn-sm" onClick={confirm}>{compact() ? "Salvează" : "Adaugă"}</button>
      </div>
    </div>
  );
}

// ─── Sub-component: CazareCard ────────────────────────────────────────────────

function CazareCard(props: {
  cazare: Cazare;
  companyData: CompanyData | null;
  onCheckout: (c: Cazare) => void;
  onCheckoutNew: (c: Cazare) => void;
  onEdit: (c: Cazare) => void;
  onView: (c: Cazare) => void;
}) {
  const c = () => props.cazare;
  const [pdfLoading, setPdfLoading] = createSignal<"checkin" | "checkout" | "combined" | null>(null);

  async function handlePdf(type: "checkin" | "checkout") {
    setPdfLoading(type);
    try {
      await loadHotelImages();
      const imgs = buildHotelImageProxyUrls();
      const vehicle = await getVehiculForCazare(c());
      if (type === "checkin") {
        await generateCazareCheckin(c(), props.companyData, imgs, vehicle);
      } else {
        await generateCazareCheckout(c(), props.companyData, imgs, vehicle);
      }
    } finally { setPdfLoading(null); }
  }

  async function handleCombinedPdf() {
    const sucId = c().successorCazareId;
    if (sucId == null || !c().dataCheckout) return;
    setPdfLoading("combined");
    try {
      const [successor] = await Promise.all([getCazareById(sucId), loadHotelImages()]);
      if (!successor) return;
      const vehicle = await getVehiculForCazare(c());
      await generateCazareScoatereIntroducere(
        c(),
        successor,
        props.companyData,
        c().dataCheckout!,
        c().successorMontatePeMasina ?? successor.montatePeMasina ?? false,
        buildHotelImageProxyUrls(),
        vehicle,
      );
    } finally { setPdfLoading(null); }
  }

  return (
    <div
      class="rcard"
      style="padding:7px 12px;cursor:pointer"
      role="button"
      tabIndex={0}
      onClick={() => props.onView(c())}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), props.onView(c()))}
    >
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
        <span><strong>Cazare:</strong> {fmtDate(c().dataCheckin)}</span>
        <Show when={c().dataCheckout}><span><strong>Check-out:</strong> {fmtDate(c().dataCheckout)}</span></Show>
        <Show when={c().numarMasina}><span><strong>Mașină:</strong> {c().numarMasina}</span></Show>
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
                {item.anvelopa!.marcaNume ?? "—"} {item.anvelopa!.dimensiuneValoare ?? ""}<Show when={item.anvelopa!.profilValoare}> /{item.anvelopa!.profilValoare}</Show> · {TIP_LABELS[item.anvelopa!.tip]}
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
      <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap" onClick={(e) => e.stopPropagation()}>
        <Show when={!c().dataCheckout}>
          <button class="btn btn-primary btn-sm" onClick={() => props.onCheckout(c())}>Scoatere</button>
          <button class="btn btn-ghost btn-sm" onClick={() => props.onCheckoutNew(c())}>Scoatere și introducere nouă</button>
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
        <Show when={c().dataCheckout && c().successorCazareId != null}>
          <button class="btn btn-ghost btn-sm" onClick={handleCombinedPdf} disabled={pdfLoading() === "combined"}>
            {pdfLoading() === "combined" ? "..." : "PDF Scoatere + Introducere"}
          </button>
        </Show>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HotelAnvelope() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [scoatereFollowedByCazare, setScoatereFollowedByCazare] = createSignal(false);

  function returnToPos(action: "cazare" | "scoatere" | "scoatere_si_cazare") {
    const ctx = posHotelCtx();
    if (!ctx) return;
    setPendingPosReturn({ action, titlu: ctx.titlu });
    clearPosHotelCtx();
    navigate("/");
  }

  const [view, setView] = createSignal<"active" | "istoric">("active");
  const [loading, setLoading] = createSignal(false);
  const [companyData, setCompanyData] = createSignal<CompanyData | null>(null);
  const [viewOnlyCazare, setViewOnlyCazare] = createSignal<Cazare | null>(null);
  const [viewPdfLoading, setViewPdfLoading] = createSignal<"checkin" | "checkout" | "combined" | null>(null);
  const [pageSelectedClient, setPageSelectedClient] = createSignal<ClientItem | null>(null);

  async function viewModalPdf(type: "checkin" | "checkout" | "combined", c: Cazare) {
    setViewPdfLoading(type);
    try {
      await loadHotelImages();
      const imgs = buildHotelImageProxyUrls();
      const vehicle = await getVehiculForCazare(c);
      if (type === "checkin") {
        await generateCazareCheckin(c, companyData(), imgs, vehicle);
      } else if (type === "checkout") {
        await generateCazareCheckout(c, companyData(), imgs, vehicle);
      } else {
        if (c.successorCazareId == null || !c.dataCheckout) return;
        const successor = await getCazareById(c.successorCazareId);
        if (!successor) return;
        await generateCazareScoatereIntroducere(
          c,
          successor,
          companyData(),
          c.dataCheckout,
          c.successorMontatePeMasina ?? successor.montatePeMasina ?? false,
          imgs,
          vehicle,
        );
      }
    } finally { setViewPdfLoading(null); }
  }

  // ── Modal Cazare Nouă ──────────────────────────────────────────────────────
  const [showNewModal, setShowNewModal] = createSignal(false);
  const [newClient, setNewClient] = createSignal<ClientItem | null>(null);
  const [clientAnvelope, setClientAnvelope] = createSignal<Anvelopa[]>([]);
  const [selectedAnvIds, setSelectedAnvIds] = createSignal<Set<number>>(new Set());
  const [showAnvForm, setShowAnvForm] = createSignal(false);
  const [anvEditId, setAnvEditId] = createSignal<number | null>(null); // ID-ul anvelopei editate (null = adăugare)
  const [newLocId, setNewLocId] = createSignal<number | "">("");
  const [newEmpId, setNewEmpId] = createSignal<number | "">("");
  const [newCheckin, setNewCheckin] = createSignal(todayStr());
  const [newComments, setNewComments] = createSignal("");
  const [newDepAnvelope, setNewDepAnvelope] = createSignal(true);
  const [newDepCapace, setNewDepCapace] = createSignal(false);
  const [newDepRotiComplete, setNewDepRotiComplete] = createSignal(false);
  const [newDepAntifurturi, setNewDepAntifurturi] = createSignal(false);
  const [newDepPrezoane, setNewDepPrezoane] = createSignal(false);
  const [newReferintaCazareId, setNewReferintaCazareId] = createSignal<number | null>(null);
  const [newMontatePeMasina, setNewMontatePeMasina] = createSignal(false);
  const [clientCazariVechi, setClientCazariVechi] = createSignal<Array<{ id: number; dataCheckin: string }>>([]);
  const [newClientVehicole, setNewClientVehicole] = createSignal<ClientVehicol[]>([]);
  const [newSelectedVehicol, setNewSelectedVehicol] = createSignal<string | null>(null);
  const [_newVehicolLocked, setNewVehicolLocked] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [saveErr, setSaveErr] = createSignal("");
  const cazareImageUrl = () => hotelImages().cazare;
  const scoatereImageUrl = () => hotelImages().scoatere;
  const montareImageUrl = () => hotelImages().montare;

  // ── Modal Checkout ─────────────────────────────────────────────────────────
  const [checkoutCazare, setCheckoutCazare] = createSignal<Cazare | null>(null);
  const [checkoutDate, setCheckoutDate] = createSignal(todayStr());
  const [checkoutComments, setCheckoutComments] = createSignal("");
  const [checkoutSaving, setCheckoutSaving] = createSignal(false);
  const [checkoutMontatePeMasina, setCheckoutMontatePeMasina] = createSignal(true);

  // ── Modal Combined Scoatere + Introducere Nouă ─────────────────────────────
  const [combinedCazare, setCombinedCazare] = createSignal<Cazare | null>(null);
  const [combinedSaving, setCombinedSaving] = createSignal(false);
  const [combinedErr, setCombinedErr] = createSignal("");

  // ── Modal Sugestie Anvelope (din istoricul montajelor) ────────────────────
  const [montajSuggestion, setMontajSuggestion] = createSignal<MontajSuggestion | null>(null);

  // ── Prompt de intrare din POS → întreabă: Cazare nouă vs Caută în istoric ─
  // Se afiseaza ÎNAINTE de a deschide modalul de cazare nouă, ca utilizatorul
  // sa poata alege intentional sa scoata anvelope de la alt client (mod
  // "Cautare istoric") in loc sa fie tarat direct in cazare noua.
  const [entryChoicePrompt, setEntryChoicePrompt] = createSignal(false);

  // ── Mod "Căutare istoric" — afișează toate cazările active pentru scoatere
  const [historySearchMode, setHistorySearchMode] = createSignal(false);

  async function checkPastMounting(plate: string | null | undefined, target: "new" | "combined") {
    const p = (plate ?? "").trim();
    if (!p) return;
    try {
      const s = await loadLatestMontajByPlate(p);
      if (!s || s.wheels.length === 0) return;
      setMontajSuggestion(s);
      void target; // ramane in API pentru viitor (sugestii in newModal vs combined)
    } catch { /* silent */ }
  }

  async function enterHistorySearchMode() {
    setEntryChoicePrompt(false);
    setShowNewModal(false);
    setHistorySearchMode(true);
    setSearchName("");
    setFilterDim("");
    setFilterTip("");
    setView("active");
    // Încarcă toate cazările active (fără filtru de client) ca să poată căuta global
    await loadCazari({ activa: true, limit: 200 });
  }

  function exitHistorySearchMode() {
    setHistorySearchMode(false);
    setSearchName("");
    // Revine la cazările clientului curent dacă există context POS
    const ctx = posHotelCtx();
    if (ctx) void loadCazari({ clientId: ctx.clientId, activa: true, limit: 200 });
    else void fetchCazari();
  }

  function applySuggestion() {
    const s = montajSuggestion();
    if (!s) return;
    const clientId = newClient()?.id ?? null;
    const wheelsForCazare = s.wheels.filter((w) => w.pozitie !== "rezerva").slice(0, 4);
    const base = Date.now();
    const drafts: Anvelopa[] = wheelsForCazare.map((w, idx) => ({
      id: -(base + idx),
      clientId,
      marcaId: w.marcaId,
      marcaNume: w.marcaNume,
      dimensiuneId: w.dimensiuneId,
      dimensiuneValoare: w.dimensiuneValoare,
      profilId: w.profilId,
      profilValoare: w.profilValoare,
      dotId: w.dotId,
      dotValoare: w.dotValoare,
      tip: w.tip,
      adancime: w.adancime,
      indiceViteza: w.indiceViteza,
      indiceSarcina: w.indiceSarcina,
      comments: w.comments,
    }));
    setClientAnvelope((prev) => [...drafts, ...prev]);
    setSelectedAnvIds(new Set(drafts.map((d) => d.id)));
    setMontajSuggestion(null);
  }

  // Curăță sugestia când se închid ambele modale părinte
  createEffect(() => {
    if (!showNewModal() && combinedCazare() === null) {
      setMontajSuggestion(null);
    }
  });

  // ── Modal Delete ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = createSignal<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  // ── Modal Edit ─────────────────────────────────────────────────────────────
  const [editCazare, setEditCazare] = createSignal<Cazare | null>(null);
  const [editLocId, setEditLocId] = createSignal<number | "">("");
  const [editEmpId, setEditEmpId] = createSignal<number | "">("");
  const [editCheckin, setEditCheckin] = createSignal("");
  const [editComments, setEditComments] = createSignal("");
  const [editAnvelope, setEditAnvelope] = createSignal<Anvelopa[]>([]);
  const [editSelectedIds, setEditSelectedIds] = createSignal<Set<number>>(new Set());
  const [showEditAnvForm, setShowEditAnvForm] = createSignal(false);
  const [editAnvEditId, setEditAnvEditId] = createSignal<number | null>(null);
  const [editDepAnvelope, setEditDepAnvelope] = createSignal(true);
  const [editDepCapace, setEditDepCapace] = createSignal(false);
  const [editDepRotiComplete, setEditDepRotiComplete] = createSignal(false);
  const [editDepAntifurturi, setEditDepAntifurturi] = createSignal(false);
  const [editDepPrezoane, setEditDepPrezoane] = createSignal(false);
  const [editReferintaCazareId, setEditReferintaCazareId] = createSignal<number | null>(null);
  const [editMontatePeMasina, setEditMontatePeMasina] = createSignal(false);
  const [editClientCazariVechi, setEditClientCazariVechi] = createSignal<Array<{ id: number; dataCheckin: string }>>([]);
  const [editClientVehicole, setEditClientVehicole] = createSignal<ClientVehicol[]>([]);
  const [editSelectedVehicol, setEditSelectedVehicol] = createSignal<string | null>(null);
  const [editVehicolLocked, setEditVehicolLocked] = createSignal(true);
  const [editSaving, setEditSaving] = createSignal(false);
  const [editErr, setEditErr] = createSignal("");

  // ── Filtre ─────────────────────────────────────────────────────────────────
  const [searchName, setSearchName] = createSignal("");
  const [filterDim, setFilterDim] = createSignal("");
  const [filterTip, setFilterTip] = createSignal<TipAnvelopa | "">("");

  // ── Admin section ──────────────────────────────────────────────────────────
  const [adminTab, setAdminTab] = createSignal<"locuri" | "marci" | "dimensiuni" | "profiluri">("locuri");
  const [adminOpen, setAdminOpen] = createSignal(false);

  // admin forms - adăugare
  const [newLocNume, setNewLocNume] = createSignal("");
  const [newLocDesc, setNewLocDesc] = createSignal("");
  const [newMarcaNume, setNewMarcaNume] = createSignal("");
  const [newDimValoare, setNewDimValoare] = createSignal("");
  const [newProfilValoare, setNewProfilValoare] = createSignal("");

  // admin edit modals
  type AdminEditTarget =
    | { type: "loc"; id: number; nume: string; description: string }
    | { type: "marca"; id: number; nume: string }
    | { type: "dim"; id: number; valoare: string }
    | { type: "profil"; id: number; valoare: string }
    | null;
  const [editAdminTarget, setEditAdminTarget] = createSignal<AdminEditTarget>(null);
  const [editAdminVal1, setEditAdminVal1] = createSignal("");
  const [editAdminVal2, setEditAdminVal2] = createSignal("");
  const [editAdminSaving, setEditAdminSaving] = createSignal(false);

  // admin delete modal
  const [adminDeleteTarget, setAdminDeleteTarget] = createSignal<
    | { type: "loc"; id: number; label: string }
    | { type: "marca"; id: number; label: string }
    | { type: "dim"; id: number; label: string }
    | { type: "profil"; id: number; label: string }
    | null
  >(null);
  const [adminDeleting, setAdminDeleting] = createSignal(false);

  let sentinelRef: HTMLDivElement | undefined;

  onMount(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLocuriCazare(),
        loadEmployees(),
        fetchCompany(),
      ]);
    } finally { setLoading(false); }

    loadHotelImages();

    // Dacă vine din POS cu context activ → auto-selectează clientul și încarcă cazarile
    const ctx = posHotelCtx();
    if (ctx) {
      try {
        const res = await apiFetch(`/api/clienti/${ctx.clientId}`);
        if (res.ok) {
          const c = await res.json();
          const clientItem: ClientItem = {
            id: c.id, nume: c.nume, cui: c.cui ?? null,
            telefon: c.telefon ?? null, adresa: c.adresa ?? null,
            reprezentant: c.reprezentant ?? null, numar_masina: c.numar_masina ?? null,
          };
          setPageSelectedClient(clientItem);
          await loadCazari({ clientId: c.id, activa: true, limit: 200 });
        }
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : "Eroare la încărcare client.", "error");
      }
      // În loc să deschidem direct modalul "Cazare nouă", arătăm un prompt cu
      // opțiunile: cazare nouă vs căutare în istoric (scoatere de la alt client).
      setEntryChoicePrompt(true);
    } else {
      await fetchCazari();
    }

    // Dacă vine cu param viewCazare → deschide modal view-only
    const viewId = searchParams.viewCazare;
    if (viewId) {
      try {
        const res = await apiFetch(`/api/cazare-anvelope/${viewId}`);
        if (res.ok) {
          const d = await res.json();
          setViewOnlyCazare(mapCazare(d));
        }
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : "Eroare la încărcare cazare.", "error");
      }
    }

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreCazari(); },
      { threshold: 0.1 }
    );
    if (sentinelRef) observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  function mapCazare(d: any): Cazare {
    return {
      id: d.id,
      clientId: d.client_id ?? null,
      employeeId: d.employee_id ?? null,
      locCazareId: d.loc_cazare_id ?? null,
      locationId: d.location_id ?? null,
      locationName: d.location_name ?? null,
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
      numarMasina: d.numar_masina ?? null,
      depAnvelope: d.dep_anvelope ?? true,
      depCapace: d.dep_capace ?? false,
      depRotiComplete: d.dep_roti_complete ?? false,
      depAntifurturi: d.dep_antifurturi ?? false,
      depPrezoane: d.dep_prezoane ?? false,
      referintaCazareId: d.referinta_cazare_id ?? null,
      montatePeMasina: d.montate_pe_masina ?? false,
      successorCazareId: d.successor_cazare_id ?? null,
      successorMontatePeMasina: d.successor_montate_pe_masina ?? null,
      referintaCazareDataCheckin: d.referinta_cazare_data_checkin ?? null,
      referintaCazareItems: (d.referinta_cazare_items ?? []).map((item: any) => ({
        id: item.id, anvelopaId: item.anvelopa_id ?? null,
        anvelopa: item.anvelopa ? {
          id: item.anvelopa.id, clientId: item.anvelopa.client_id ?? null,
          marcaId: item.anvelopa.marca_id ?? null, dimensiuneId: item.anvelopa.dimensiune_id ?? null,
          tip: item.anvelopa.tip, adancime: item.anvelopa.adancime ?? null, comments: item.anvelopa.comments ?? null,
          indiceViteza: item.anvelopa.indice_viteza ?? null,
          indiceSarcina: item.anvelopa.indice_sarcina ?? null,
          marcaNume: item.anvelopa.marca_nume ?? null, dimensiuneValoare: item.anvelopa.dimensiune_valoare ?? null,
          profilValoare: item.anvelopa.profil_valoare ?? null,
          profilId: item.anvelopa.profil_id ?? null,
          dotId: item.anvelopa.dot_id ?? null,
          dotValoare: item.anvelopa.dot_valoare ?? null,
        } : null,
      })),
      items: (d.items ?? []).map((item: any) => ({
        id: item.id,
        anvelopaId: item.anvelopa_id ?? null,
        anvelopa: item.anvelopa ? {
          id: item.anvelopa.id, clientId: item.anvelopa.client_id ?? null,
          marcaId: item.anvelopa.marca_id ?? null, dimensiuneId: item.anvelopa.dimensiune_id ?? null,
          profilId: item.anvelopa.profil_id ?? null,
          dotId: item.anvelopa.dot_id ?? null,
          tip: item.anvelopa.tip, adancime: item.anvelopa.adancime ?? null, comments: item.anvelopa.comments ?? null,
          indiceViteza: item.anvelopa.indice_viteza ?? null,
          indiceSarcina: item.anvelopa.indice_sarcina ?? null,
          marcaNume: item.anvelopa.marca_nume ?? null, dimensiuneValoare: item.anvelopa.dimensiune_valoare ?? null,
          profilValoare: item.anvelopa.profil_valoare ?? null,
          dotValoare: item.anvelopa.dot_valoare ?? null,
        } : null,
      })),
    };
  }

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
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare date companie.", "error");
    }
  }

  async function fetchCazari() {
    const locId = device()?.locationId ?? undefined;
    if (view() === "active") {
      await loadCazari({ activa: true, limit: 200, locationId: locId });
    } else {
      await loadCazari({ activa: false, limit: 200, locationId: locId });
    }
  }

  // defer: true → sare prima rulare (onMount gestionează încărcarea inițială)
  createEffect(on(view, () => { fetchCazari(); }, { defer: true }));

  createEffect(() => {
    if (adminVisible()) {
      loadMarci();
      loadDimensiuni();
      loadProfil();
    }
  });

  const filtered = createMemo(() => {
    const name = searchName().toLowerCase().trim();
    const dim = filterDim().toLowerCase().trim();
    const tip = filterTip();
    return cazari().filter((c) => {
      if (name) {
        const matchClient = (c.clientNume ?? "").toLowerCase().includes(name);
        const matchPlate = (c.numarMasina ?? "").toLowerCase().includes(name);
        if (!matchClient && !matchPlate) return false;
      }
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

  function toggleAnv(id: number) {
    setSelectedAnvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelNewModal() {
    const wasCombo = scoatereFollowedByCazare();
    setScoatereFollowedByCazare(false);
    setShowNewModal(false);
    if (wasCombo && posHotelCtx()) returnToPos("scoatere");
  }

  function openNewModal() {
    setScoatereFollowedByCazare(false);
    const ctx = posHotelCtx();
    const preClient = ctx ? pageSelectedClient() : null;
    setNewClient(preClient);
    setClientAnvelope([]);
    setSelectedAnvIds(new Set<number>());
    setShowAnvForm(false);
    setNewLocId("");
    setNewEmpId(ctx?.employeeId ?? "");
    setNewCheckin(todayStr());
    setNewComments("");
    setNewDepAnvelope(true);
    setNewDepCapace(false);
    setNewDepRotiComplete(false);
    setNewDepAntifurturi(false);
    setNewDepPrezoane(false);
    setNewReferintaCazareId(null);
    setNewMontatePeMasina(false);
    setClientCazariVechi([]);
    setNewClientVehicole([]);
    setNewSelectedVehicol(null);
    setNewVehicolLocked(true);
    setSaveErr("");
    setShowNewModal(true);
    // Dacă avem context POS, încarcă datele clientului pre-setat
    if (preClient) {
      handleClientSelect(preClient);
    }
    // Sugestie anvelope din ultimul montaj pentru placa de pe POS context
    const plate = ctx?.titlu ?? null;
    if (plate) void checkPastMounting(plate, "new");
  }

  async function handleClientSelect(c: ClientItem | null) {
    setNewClient(c);
    setClientAnvelope([]);
    setSelectedAnvIds(new Set<number>());
    setNewReferintaCazareId(null);
    setNewMontatePeMasina(false);
    setNewClientVehicole([]);
    setNewSelectedVehicol(null);
    setNewVehicolLocked(true);
    if (c) {
      try {
        const [cazRes, vRes] = await Promise.all([
          apiFetch(`/api/cazare-anvelope?client_id=${c.id}&limit=20`),
          apiFetch(`/api/clienti/${c.id}/vehicole`),
        ]);
        if (cazRes.ok) {
          const data = await cazRes.json();
          setClientCazariVechi(data.items.map((caz: any) => ({ id: caz.id, dataCheckin: caz.data_checkin })));
        }
        if (vRes.ok) {
          const vData: ClientVehicol[] = await vRes.json();
          setNewClientVehicole(vData);
          if (vData.length > 0) {
            // Preferam placuta din contextul POS (cea pe care s-a deschis devizul),
            // altfel ar selecta mereu primul vehicol din lista clientului — care
            // de obicei NU e cel pe care lucreaza utilizatorul.
            const ctxPlate = (posHotelCtx()?.titlu ?? "").trim().toUpperCase().replace(/\s+/g, "");
            const matched = ctxPlate
              ? vData.find((v) => (v.numar_masina ?? "").trim().toUpperCase().replace(/\s+/g, "") === ctxPlate)
              : null;
            setNewSelectedVehicol((matched ?? vData[0]).numar_masina);
          }
        }
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : "Eroare la încărcare vehicule client.", "error");
      }
    } else {
      setClientCazariVechi([]);
    }
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
            profil_id: draft.profilId,
            dot_id: draft.dotId,
            tip: draft.tip,
            adancime: draft.adancime,
            indice_viteza: draft.indiceViteza,
            indice_sarcina: draft.indiceSarcina,
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

      const ctx = posHotelCtx();
      const body: Record<string, any> = {
        client_id: newClient()!.id,
        employee_id: newEmpId() !== "" ? newEmpId() : null,
        loc_cazare_id: newLocId() !== "" ? newLocId() : null,
        data_checkin: newCheckin(),
        comments: newComments().trim() || null,
        anvelopa_ids: finalIds,
        dep_anvelope: newDepAnvelope(),
        dep_capace: newDepCapace(),
        dep_roti_complete: newDepRotiComplete(),
        dep_antifurturi: newDepAntifurturi(),
        dep_prezoane: newDepPrezoane(),
        referinta_cazare_id: newReferintaCazareId(),
        montate_pe_masina: newMontatePeMasina(),
        numar_masina: newSelectedVehicol() || null,
        location_id: device()?.locationId ?? null,
      };
      if (ctx) body.receipt_id = parseInt(ctx.receiptId);
      const res = await apiFetch("/api/cazare-anvelope", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveErr(err.detail ?? "Eroare la salvare.");
        return;
      }
      setShowNewModal(false);
      await fetchCazari();
      if (ctx) {
        const wasCombo = scoatereFollowedByCazare();
        setScoatereFollowedByCazare(false);
        returnToPos(wasCombo ? "scoatere_si_cazare" : "cazare");
      }
    } finally { setSaving(false); }
  }

  const [checkoutAndNew, setCheckoutAndNew] = createSignal(false);

  function openCheckout(c: Cazare, andNew = false) {
    setCheckoutAndNew(andNew);
    setCheckoutCazare(c);
    setCheckoutDate(todayStr());
    setCheckoutComments(c.comments ?? "");
    setCheckoutMontatePeMasina(true);
  }

  async function openCombined(c: Cazare) {
    setCheckoutDate(todayStr());
    setCheckoutComments("");
    setClientAnvelope([]);
    setSelectedAnvIds(new Set<number>());
    setShowAnvForm(false);
    setAnvEditId(null);
    setNewLocId(c.locCazareId ?? "");
    setNewEmpId(posHotelCtx()?.employeeId ?? c.employeeId ?? "");
    setNewCheckin(todayStr());
    setNewComments("");
    setNewDepAnvelope(true);
    setNewDepCapace(false);
    setNewDepRotiComplete(false);
    setNewDepAntifurturi(false);
    setNewDepPrezoane(false);
    setNewMontatePeMasina(true);
    setNewReferintaCazareId(c.id);
    setSaveErr("");
    setCombinedErr("");
    // Pre-select clientul pentru noua cazare:
    //  - dacă venim din POS → clientul POS (cel nou, pentru care se face devizul)
    //  - altfel → clientul cazării vechi (comportamentul original)
    const ctx = posHotelCtx();
    const targetClientId = ctx?.clientId ?? c.clientId;
    if (targetClientId) {
      try {
        const r = await apiFetch(`/api/clienti/${targetClientId}`);
        if (r.ok) {
          const data = await r.json();
          const clientItem: ClientItem = {
            id: data.id,
            nume: data.nume,
            cui: data.cui ?? null,
            telefon: data.telefon ?? null,
            adresa: data.adresa ?? null,
            reprezentant: data.reprezentant ?? null,
            numar_masina: data.numar_masina ?? null,
          };
          await handleClientSelect(clientItem);
          setNewReferintaCazareId(c.id); // handleClientSelect resets it, restore
          setNewMontatePeMasina(true);   // handleClientSelect resets it, restore
        }
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : "Eroare la pregătire cazare combinată.", "error");
      }
    }
    setCombinedCazare(c);
    // Sugestie anvelope din ultimul montaj pentru placa de pe cazare sau context POS
    const plate = c.numarMasina ?? posHotelCtx()?.titlu ?? null;
    if (plate) void checkPastMounting(plate, "combined");
  }

  async function doCombinedCheckoutNew() {
    const c = combinedCazare();
    if (!c) return;
    if (!newClient()) { setCombinedErr("Clientul nu a putut fi preluat."); return; }
    if (selectedAnvIds().size === 0) { setCombinedErr("Selectați cel puțin o anvelopă pentru noua cazare."); return; }
    setCombinedSaving(true);
    setCombinedErr("");
    try {
      // Create draft anvelope (negative IDs) — same pattern as saveCazare
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
            profil_id: draft.profilId,
            dot_id: draft.dotId,
            tip: draft.tip,
            adancime: draft.adancime,
            indice_viteza: draft.indiceViteza,
            indice_sarcina: draft.indiceSarcina,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setCombinedErr(err.detail ?? "Eroare la salvare anvelopă.");
          return;
        }
        const d = await res.json();
        tempToReal.set(tempId, d.id);
      }

      const finalIds = Array.from(selectedAnvIds()).map((id) => tempToReal.get(id) ?? id);
      const ctx = posHotelCtx();
      const receiptId = ctx ? parseInt(ctx.receiptId) : null;

      // PATCH checkout
      const checkoutBody: Record<string, any> = {
        data_checkout: checkoutDate(),
        comments: checkoutComments().trim() || null,
      };
      if (receiptId != null) checkoutBody.receipt_id = receiptId;
      const checkoutRes = await apiFetch(`/api/cazare-anvelope/${c.id}/checkout`, {
        method: "PATCH",
        body: JSON.stringify(checkoutBody),
      });
      if (!checkoutRes.ok) {
        const err = await checkoutRes.json().catch(() => ({}));
        setCombinedErr(err.detail ?? "Eroare la scoatere din depozit.");
        return;
      }
      await checkoutRes.json();

      // POST new cazare
      const newBody: Record<string, any> = {
        client_id: newClient()!.id,
        employee_id: newEmpId() !== "" ? newEmpId() : null,
        loc_cazare_id: newLocId() !== "" ? newLocId() : null,
        data_checkin: newCheckin(),
        comments: newComments().trim() || null,
        anvelopa_ids: finalIds,
        dep_anvelope: newDepAnvelope(),
        dep_capace: newDepCapace(),
        dep_roti_complete: newDepRotiComplete(),
        dep_antifurturi: newDepAntifurturi(),
        dep_prezoane: newDepPrezoane(),
        referinta_cazare_id: c.id,
        montate_pe_masina: newMontatePeMasina(),
        numar_masina: null,
        location_id: device()?.locationId ?? null,
      };
      if (receiptId != null) newBody.receipt_id = receiptId;
      const newCazareRes = await apiFetch("/api/cazare-anvelope", {
        method: "POST",
        body: JSON.stringify(newBody),
      });
      if (!newCazareRes.ok) {
        const err = await newCazareRes.json().catch(() => ({}));
        setCombinedErr(err.detail ?? "Eroare la salvare cazare nouă.");
        return;
      }
      await newCazareRes.json();

      setCombinedCazare(null);
      await fetchCazari();
      if (ctx) returnToPos("scoatere_si_cazare");
    } catch (e: any) {
      setCombinedErr(e?.message ?? "Eroare necunoscută.");
    } finally {
      setCombinedSaving(false);
    }
  }

  async function openEdit(c: Cazare) {
    setEditCazare(c);
    setEditLocId(c.locCazareId ?? "");
    setEditEmpId(c.employeeId ?? "");
    setEditCheckin(c.dataCheckin);
    setEditComments(c.comments ?? "");
    setEditDepAnvelope(c.depAnvelope);
    setEditDepCapace(c.depCapace);
    setEditDepRotiComplete(c.depRotiComplete);
    setEditDepAntifurturi(c.depAntifurturi);
    setEditDepPrezoane(c.depPrezoane);
    setEditReferintaCazareId(c.referintaCazareId);
    setEditMontatePeMasina(c.montatePeMasina);
    setShowEditAnvForm(false);
    setEditErr("");
    setEditClientVehicole([]);
    setEditSelectedVehicol(c.numarMasina ?? null);
    setEditVehicolLocked(true);
    if (c.clientId) {
      try {
        const [cazRes, vRes] = await Promise.all([
          apiFetch(`/api/cazare-anvelope?client_id=${c.clientId}&limit=20`),
          apiFetch(`/api/clienti/${c.clientId}/vehicole`),
        ]);
        if (cazRes.ok) {
          const data = await cazRes.json();
          setEditClientCazariVechi(data.items.filter((caz: any) => caz.id !== c.id).map((caz: any) => ({ id: caz.id, dataCheckin: caz.data_checkin })));
        }
        if (vRes.ok) {
          const vData: ClientVehicol[] = await vRes.json();
          setEditClientVehicole(vData);
        }
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : "Eroare la încărcare cazări/vehicule.", "error");
      }
    } else {
      setEditClientCazariVechi([]);
      setEditClientVehicole([]);
    }
    // încarcă doar anvelopele din această cazare
    const anvs: Anvelopa[] = c.items
      .filter((i) => i.anvelopa != null)
      .map((i) => i.anvelopa!);
    setEditAnvelope(anvs);
    setEditSelectedIds(new Set(anvs.map((a) => a.id)));
  }

  async function doEdit() {
    const c = editCazare();
    if (!c) return;
    setEditErr("");
    if (editSelectedIds().size === 0) { setEditErr("Selectați cel puțin o anvelopă."); return; }
    setEditSaving(true);
    try {
      // creează draft-uri (ID negativ) dacă există
      const draftIds = Array.from(editSelectedIds()).filter((id) => id < 0);
      const tempToReal = new Map<number, number>();
      for (const tempId of draftIds) {
        const draft = editAnvelope().find((a) => a.id === tempId);
        if (!draft) continue;
        const res = await apiFetch("/api/anvelope", {
          method: "POST",
          body: JSON.stringify({
            client_id: draft.clientId,
            marca_id: draft.marcaId,
            dimensiune_id: draft.dimensiuneId,
            profil_id: draft.profilId,
            dot_id: draft.dotId,
            tip: draft.tip,
            adancime: draft.adancime,
            indice_viteza: draft.indiceViteza,
            indice_sarcina: draft.indiceSarcina,
          }),
        });
        if (!res.ok) { setEditErr("Eroare la salvare anvelopă."); return; }
        const d = await res.json();
        tempToReal.set(tempId, d.id);
      }
      const finalIds = Array.from(editSelectedIds()).map((id) => tempToReal.get(id) ?? id);

      const res = await apiFetch(`/api/cazare-anvelope/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          employee_id: editEmpId() !== "" ? editEmpId() : null,
          loc_cazare_id: editLocId() !== "" ? editLocId() : null,
          data_checkin: editCheckin() || null,
          comments: editComments().trim() || null,
          anvelopa_ids: finalIds,
          dep_anvelope: editDepAnvelope(),
          dep_capace: editDepCapace(),
          dep_roti_complete: editDepRotiComplete(),
          dep_antifurturi: editDepAntifurturi(),
          dep_prezoane: editDepPrezoane(),
          referinta_cazare_id: editReferintaCazareId(),
          montate_pe_masina: editMontatePeMasina(),
          numar_masina: editSelectedVehicol() || null,
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setEditErr(err.detail ?? "Eroare la salvare."); return; }
      setEditCazare(null);
      await fetchCazari();
    } finally { setEditSaving(false); }
  }

  async function doCheckout() {
    const andNew = checkoutAndNew();
    const c = checkoutCazare();
    if (!c) return;
    setCheckoutSaving(true);
    try {
      const ctx = posHotelCtx();
      const checkoutBody: Record<string, any> = {
        data_checkout: checkoutDate(),
        comments: checkoutComments().trim() || null,
        montate_pe_masina: checkoutMontatePeMasina(),
      };
      if (ctx) checkoutBody.receipt_id = parseInt(ctx.receiptId);
      const res = await apiFetch(`/api/cazare-anvelope/${c.id}/checkout`, {
        method: "PATCH",
        body: JSON.stringify(checkoutBody),
      });
      if (!res.ok) return;
      await res.json();
      setCheckoutCazare(null);
      await fetchCazari();
      if (andNew && c.clientId) {
        setClientAnvelope([]);
        setSelectedAnvIds(new Set<number>());
        setShowAnvForm(false);
        setNewLocId(c.locCazareId ?? "");
        setNewEmpId(posHotelCtx()?.employeeId ?? "");
        setNewCheckin(todayStr());
        setNewComments("");
        setNewDepAnvelope(true);
        setNewDepCapace(false);
        setNewDepRotiComplete(false);
        setNewDepAntifurturi(false);
        setNewDepPrezoane(false);
        setNewReferintaCazareId(c.id);
        setNewMontatePeMasina(true);
        setSaveErr("");
        // încarcă cazarile clientului pentru referință (include și cea curentă)
        try {
          const res = await apiFetch(`/api/cazare-anvelope?client_id=${c.clientId}&limit=20`);
          if (res.ok) {
            const data = await res.json();
            setClientCazariVechi(data.items.map((caz: any) => ({ id: caz.id, dataCheckin: caz.data_checkin })));
          }
        } catch { setClientCazariVechi([]); }
        const clientObj: ClientItem = {
          id: c.clientId,
          nume: c.clientNume ?? "",
          cui: c.clientCui,
          telefon: c.clientTelefon,
          adresa: c.clientAdresa,
          reprezentant: c.clientReprezentant,
          numar_masina: null,
        };
        setNewClient(clientObj);
        // fetch vehicles for this client
        try {
          const vRes = await apiFetch(`/api/clienti/${c.clientId}/vehicole`);
          if (vRes.ok) {
            const vData: ClientVehicol[] = await vRes.json();
            setNewClientVehicole(vData);
            // pre-select the vehicle from the old cazare if it still exists
            const existing = c.numarMasina ? vData.find((v) => v.numar_masina === c.numarMasina) : null;
            setNewSelectedVehicol(existing ? c.numarMasina! : (vData.length === 1 ? vData[0].numar_masina : null));
          }
        } catch { setNewClientVehicole([]); setNewSelectedVehicol(null); }
        setNewVehicolLocked(true);
        setShowNewModal(true);
        if (ctx) setScoatereFollowedByCazare(true);
      } else if (ctx) {
        returnToPos("scoatere");
      }
    } finally { setCheckoutSaving(false); }
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


  async function addLocInline(name: string) {
    const res = await apiFetch("/api/loc-cazare", {
      method: "POST",
      body: JSON.stringify({ nume: name, description: null }),
    });
    if (res.ok) {
      const d = await res.json();
      invalidateLocuriCache();
      await loadLocuriCazare(true);
      setNewLocId(d.id);
      setEditLocId(d.id);
    }
  }

  async function addMarca() {
    const n = newMarcaNume().trim();
    if (!n) return;
    await apiFetch("/api/marci-anvelope", { method: "POST", body: JSON.stringify({ nume: n }) });
    invalidateMarciCache();
    await loadMarci(true);
    setNewMarcaNume("");
  }


  async function addDim() {
    const v = newDimValoare().trim();
    if (!v) return;
    await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: v }) });
    invalidateDimensiuniCache();
    await loadDimensiuni(true);
    setNewDimValoare("");
  }

  async function addProfilAdmin() {
    const v = newProfilValoare().trim();
    if (!v) return;
    await apiFetch("/api/profiluri-anvelope", { method: "POST", body: JSON.stringify({ valoare: v }) });
    invalidateProfilCache();
    await loadProfil(true);
    setNewProfilValoare("");
  }


  // ── Admin Edit / Delete helpers ───────────────────────────────────────────

  function openAdminEdit(t: AdminEditTarget) {
    setEditAdminTarget(t);
    if (!t) return;
    if (t.type === "loc") { setEditAdminVal1(t.nume); setEditAdminVal2(t.description); }
    else if (t.type === "marca") { setEditAdminVal1(t.nume); setEditAdminVal2(""); }
    else if (t.type === "dim") { setEditAdminVal1(t.valoare); setEditAdminVal2(""); }
    else if (t.type === "profil") { setEditAdminVal1(t.valoare); setEditAdminVal2(""); }
  }

  async function saveAdminEdit() {
    const t = editAdminTarget();
    if (!t) return;
    setEditAdminSaving(true);
    try {
      if (t.type === "loc") {
        await apiFetch(`/api/loc-cazare/${t.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nume: editAdminVal1().trim(), description: editAdminVal2().trim() || null }),
        });
        invalidateLocuriCache();
        await loadLocuriCazare(true);
      } else if (t.type === "marca") {
        await apiFetch(`/api/marci-anvelope/${t.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nume: editAdminVal1().trim() }),
        });
        invalidateMarciCache();
        await loadMarci(true);
      } else if (t.type === "dim") {
        await apiFetch(`/api/dimensiuni-anvelope/${t.id}`, {
          method: "PATCH",
          body: JSON.stringify({ valoare: editAdminVal1().trim() }),
        });
        invalidateDimensiuniCache();
        await loadDimensiuni(true);
      } else if (t.type === "profil") {
        await apiFetch(`/api/profiluri-anvelope/${t.id}`, {
          method: "PATCH",
          body: JSON.stringify({ valoare: editAdminVal1().trim() }),
        });
        invalidateProfilCache();
        await loadProfil(true);
      }
      setEditAdminTarget(null);
    } finally { setEditAdminSaving(false); }
  }

  async function doAdminDelete() {
    const t = adminDeleteTarget();
    if (!t) return;
    setAdminDeleting(true);
    try {
      if (t.type === "loc") {
        await apiFetch(`/api/loc-cazare/${t.id}`, { method: "DELETE" });
        invalidateLocuriCache();
        await loadLocuriCazare(true);
      } else if (t.type === "marca") {
        await apiFetch(`/api/marci-anvelope/${t.id}`, { method: "DELETE" });
        invalidateMarciCache();
        await loadMarci(true);
      } else if (t.type === "dim") {
        await apiFetch(`/api/dimensiuni-anvelope/${t.id}`, { method: "DELETE" });
        invalidateDimensiuniCache();
        await loadDimensiuni(true);
      } else if (t.type === "profil") {
        await apiFetch(`/api/profiluri-anvelope/${t.id}`, { method: "DELETE" });
        invalidateProfilCache();
        await loadProfil(true);
      }
      setAdminDeleteTarget(null);
    } finally { setAdminDeleting(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div class="page-content">

      {/* ── Banner mod căutare istoric ── */}
      <Show when={historySearchMode()}>
        <div style="background:#fff4e5;border:1px solid #f0b400;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#b45309;flex-shrink:0">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <div style="flex:1;min-width:200px;font-size:13px;line-height:1.5;color:#8a5a00">
            <strong>Mod căutare istoric activ.</strong> Caută o cazare după plăcuță sau client și apasă <strong>Scoatere</strong>. Anvelopele scoase vor fi montate automat pe devizul curent
            <Show when={posHotelCtx()?.titlu}> (<strong>{posHotelCtx()!.titlu}</strong>)</Show>.
          </div>
          <button class="btn btn-ghost btn-sm" onClick={exitHistorySearchMode} style="flex-shrink:0">Renunță</button>
        </div>
      </Show>

      {/* ── Header ── */}
      <div class="page-header">
        <h1 class="page-title">Hotel Anvelope</h1>
        <div class="reception-header-right">
          <input
            class="input reception-search"
            type="search"
            placeholder={historySearchMode() ? "Caută plăcuță sau client..." : "Caută client..."}
            value={searchName()}
            onInput={(e) => setSearchName(e.currentTarget.value)}
            autofocus={historySearchMode()}
          />
          <select
            class="input hotel-header-select"
            value={filterDim()}
            onChange={(e) => setFilterDim(e.currentTarget.value)}
          >
            <option value="">— Dimensiune —</option>
            <For each={dimensiuni()}>{(d) => <option value={d.valoare}>{d.valoare}</option>}</For>
          </select>
          <select
            class="input hotel-header-select"
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
          <button class="btn btn-ghost btn-sm" title="Administrare" aria-label="Administrare" onClick={() => setAdminOpen(true)}>⚙</button>
        </div>
      </div>

      {/* ── Listă Cazări ── */}
      <div>
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
                onCheckoutNew={(c) => openCombined(c)}
                onEdit={openEdit}
                onView={(c) => setViewOnlyCazare(c)}
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

      {/* Modal: Administrare */}
      <Show when={adminOpen()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:520px;width:100%;max-height:90vh;display:flex;flex-direction:column">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Administrare</span>
              <button class="btn btn-ghost btn-sm" aria-label="Închide" onClick={() => setAdminOpen(false)}>✕</button>
            </div>
            <div class="sl-modal-body" style="padding:16px 20px;overflow-y:auto">
              {/* Tab-uri admin */}
              <div style="display:flex;gap:4px;margin-bottom:14px">
                <button class={`btn btn-sm ${adminTab() === "locuri" ? "btn-primary" : "btn-ghost"}`} style="flex:1" onClick={() => setAdminTab("locuri")}>Locuri</button>
                <button class={`btn btn-sm ${adminTab() === "marci" ? "btn-primary" : "btn-ghost"}`} style="flex:1" onClick={() => setAdminTab("marci")}>Mărci</button>
                <button class={`btn btn-sm ${adminTab() === "dimensiuni" ? "btn-primary" : "btn-ghost"}`} style="flex:1" onClick={() => setAdminTab("dimensiuni")}>Dimensiuni</button>
                <button class={`btn btn-sm ${adminTab() === "profiluri" ? "btn-primary" : "btn-ghost"}`} style="flex:1" onClick={() => setAdminTab("profiluri")}>Profiluri</button>
              </div>

              {/* Locuri */}
              <Show when={adminTab() === "locuri"}>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <input class="input" placeholder="Nume loc *" value={newLocNume()} onInput={(e) => setNewLocNume(e.currentTarget.value)} />
                  <input class="input" placeholder="Descriere" value={newLocDesc()} onInput={(e) => setNewLocDesc(e.currentTarget.value)} />
                  <button class="btn btn-primary btn-sm w-full" onClick={addLoc} disabled={!newLocNume().trim()}>+ Adaugă</button>
                  <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
                    <For each={locuriCazare()}>
                      {(loc) => (
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:13px">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"><strong>{loc.nume}</strong></span>
                          <button class="btn btn-ghost btn-sm" onClick={() => openAdminEdit({ type: "loc", id: loc.id, nume: loc.nume, description: loc.description ?? "" })}>Edit</button>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Mărci */}
              <Show when={adminTab() === "marci"}>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <input class="input" placeholder="Nume marcă *" value={newMarcaNume()} onInput={(e) => setNewMarcaNume(e.currentTarget.value)} />
                  <button class="btn btn-primary btn-sm w-full" onClick={addMarca} disabled={!newMarcaNume().trim()}>+ Adaugă</button>
                  <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
                    <For each={marci()}>
                      {(m) => (
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:13px">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">{m.nume}</span>
                          <button class="btn btn-ghost btn-sm" onClick={() => openAdminEdit({ type: "marca", id: m.id, nume: m.nume })}>Edit</button>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Dimensiuni */}
              <Show when={adminTab() === "dimensiuni"}>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <input class="input" placeholder="ex: 205/55 R16 *" value={newDimValoare()} onInput={(e) => setNewDimValoare(e.currentTarget.value)} />
                  <button class="btn btn-primary btn-sm w-full" onClick={addDim} disabled={!newDimValoare().trim()}>+ Adaugă</button>
                  <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
                    <For each={dimensiuni()}>
                      {(d) => (
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:13px">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">{d.valoare}</span>
                          <button class="btn btn-ghost btn-sm" onClick={() => openAdminEdit({ type: "dim", id: d.id, valoare: d.valoare })}>Edit</button>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Profiluri */}
              <Show when={adminTab() === "profiluri"}>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <input class="input" placeholder="ex: 60, 55, 45 *" value={newProfilValoare()} onInput={(e) => setNewProfilValoare(e.currentTarget.value)} />
                  <button class="btn btn-primary btn-sm w-full" onClick={addProfilAdmin} disabled={!newProfilValoare().trim()}>+ Adaugă</button>
                  <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
                    <For each={profiluri()}>
                      {(p) => (
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:13px">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">{p.valoare}</span>
                          <button class="btn btn-ghost btn-sm" onClick={() => openAdminEdit({ type: "profil", id: p.id, valoare: p.valoare })}>Edit</button>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setAdminOpen(false)}>Închide</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal: Confirmare Stergere */}
      <Show when={deleteTarget()}>
        {(t) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal">
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

      {/* Modal: Editare Cazare */}
      <Show when={editCazare()}>
        {(c) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:1100px;width:100%;max-height:90vh;overflow-y:auto">
              <div class="sl-modal-header">
                <span class="sl-modal-title">Editare Cazare — {c().clientNume ?? "—"}</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setEditCazare(null)}>✕</button>
              </div>

              <div class="sl-modal-body" style="padding:20px 24px">
                <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:16px;align-items:start">

                {/* ─ Coloana stânga: Client ─ */}
                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Client</div>
                  <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
                    <div><span style="color:var(--text-muted)">Nume:</span> <strong>{c().clientNume ?? "—"}</strong></div>
                    <Show when={c().clientCui}><div><span style="color:var(--text-muted)">CUI:</span> {c().clientCui}</div></Show>
                    <Show when={c().clientTelefon}><div><span style="color:var(--text-muted)">Tel:</span> {c().clientTelefon}</div></Show>
                  </div>
                  <Show when={editClientVehicole().length > 0}>
                    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <div style="font-size:12px;color:var(--text-muted)">Mașini client</div>
                        <Show when={editVehicolLocked() && editClientVehicole().length > 1}>
                          <button class="btn btn-ghost btn-sm" style="padding:1px 8px;font-size:11px" onClick={() => setEditVehicolLocked(false)}>Schimbă</button>
                        </Show>
                      </div>
                      <div style="display:flex;flex-direction:column;gap:3px">
                        <For each={editClientVehicole()}>
                          {(v) => (
                            <label style={`display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;font-size:13px;cursor:${editVehicolLocked() ? "default" : "pointer"};background:${editSelectedVehicol() === v.numar_masina ? "var(--primary-bg,rgba(99,102,241,.1))" : "var(--bg)"}`}>
                              <input
                                type="radio"
                                name="edit-vehicol"
                                checked={editSelectedVehicol() === v.numar_masina}
                                disabled={editVehicolLocked() && editClientVehicole().length > 1}
                                onChange={() => setEditSelectedVehicol(v.numar_masina)}
                              />
                              <strong>{v.numar_masina}</strong>
                              <Show when={v.marca || v.model}>
                                <span style="color:var(--text-muted);font-size:11px">{[v.marca, v.model].filter(Boolean).join(" ")}</span>
                              </Show>
                            </label>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                  <Show when={editReferintaCazareId() !== null}>
                    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Referință cazare anterioară</div>
                      <div style="display:flex;align-items:center;gap:6px;font-size:13px;padding:4px 8px;background:var(--bg);border-radius:6px">
                        <span style="flex:1">Cazare #{editReferintaCazareId()} — {editClientCazariVechi().find((c) => c.id === editReferintaCazareId())?.dataCheckin ?? ""}</span>
                        <button class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:11px" onClick={() => { setEditReferintaCazareId(null); setEditMontatePeMasina(false); }}>✕</button>
                      </div>
                      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;cursor:pointer">
                        <input
                          type="checkbox"
                          checked={editMontatePeMasina()}
                          onChange={(e) => setEditMontatePeMasina(e.currentTarget.checked)}
                        />
                        Anvelopele din cazarea veche au fost montate pe mașină
                      </label>
                    </div>
                  </Show>
                </div>

                {/* ─ Coloana dreapta: Anvelope + Date Cazare ─ */}
                <div style="display:flex;flex-direction:column;gap:16px">

                {/* ─ Anvelope ─ */}
                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Anvelope</div>
                  <div style="display:flex;flex-direction:column;gap:4px">
                    <For each={editAnvelope()}>
                      {(a) => (
                        <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;font-size:13px;background:var(--bg)">
                          <input
                            type="checkbox"
                            checked={editSelectedIds().has(a.id)}
                            onChange={() => setEditSelectedIds((prev) => {
                              const next = new Set(prev);
                              next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                              return next;
                            })}
                            style="flex-shrink:0"
                          />
                          <span style="flex:1;min-width:0">
                            <strong>{a.marcaNume ?? "—"}</strong>
                            <Show when={a.dimensiuneValoare}> {a.dimensiuneValoare}</Show>
                            <Show when={a.dotValoare}>{" · DOT "}{a.dotValoare}</Show>
                            {" · "}{TIP_LABELS[a.tip]}
                            <Show when={a.adancime != null}>{" · "}{a.adancime}mm</Show>
                            <Show when={a.id < 0}>
                              <span style="color:var(--primary);font-size:11px;margin-left:4px">(nou)</span>
                            </Show>
                          </span>
                          <button
                            class="btn btn-ghost btn-sm"
                            style="padding:1px 6px;font-size:11px;flex-shrink:0"
                            title="Editează"
                            onClick={() => { setEditAnvEditId(a.id); setShowEditAnvForm(true); }}
                          >Edit</button>
                          <button
                            class="btn btn-ghost btn-sm"
                            style="padding:1px 6px;font-size:11px;flex-shrink:0"
                            title="Copiază"
                            onClick={() => {
                              const tempId = -Date.now();
                              const copy = { ...a, id: tempId };
                              setEditAnvelope((prev) => [...prev, copy]);
                              setEditSelectedIds((prev) => new Set([...prev, tempId]));
                            }}
                          >Copy</button>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show when={!showEditAnvForm()}>
                    <button class="btn btn-ghost btn-sm" style="margin-top:8px" onClick={() => { setEditAnvEditId(null); setShowEditAnvForm(true); }}>+ Anvelopă nouă</button>
                  </Show>
                  <Show when={editAnvelope().length > 0}>
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">S-au lasat pentru depozitare urmatoarele:</div>
                      <div style="display:flex;flex-wrap:wrap;gap:10px 18px">
                        {([
                          ["Anvelope", editDepAnvelope, setEditDepAnvelope],
                          ["Capace", editDepCapace, setEditDepCapace],
                          ["Roti complete", editDepRotiComplete, setEditDepRotiComplete],
                          ["Antifurturi", editDepAntifurturi, setEditDepAntifurturi],
                          ["Prezoane", editDepPrezoane, setEditDepPrezoane],
                        ] as const).map(([label, get, set]) => (
                          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                            <input type="checkbox" checked={get()} onChange={() => set(v => !v)} style="width:15px;height:15px;cursor:pointer" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </Show>
                  <Show when={showEditAnvForm()}>
                    <AnvelopaForm
                      clientId={c().clientId ?? 0}
                      initialData={editAnvEditId() !== null ? editAnvelope().find((a) => a.id === editAnvEditId()) : undefined}
                      onSaved={(a) => {
                        if (editAnvEditId() !== null) {
                          const oldId = editAnvEditId()!;
                          setEditAnvelope((prev) => prev.map((x) => x.id === oldId ? a : x));
                          setEditSelectedIds((prev) => { const s = new Set(prev); s.delete(oldId); s.add(a.id); return s; });
                        } else {
                          setEditAnvelope((prev) => [...prev, a]);
                          setEditSelectedIds((prev) => new Set([...prev, a.id]));
                        }
                        setShowEditAnvForm(false);
                        setEditAnvEditId(null);
                      }}
                      onCancel={() => { setShowEditAnvForm(false); setEditAnvEditId(null); }}
                    />
                  </Show>
                </div>

                {/* ─ Date Cazare ─ */}
                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Date Cazare</div>
                  <div style="display:grid;gap:8px">
                    <SearchableSelect items={locuriCazare()} value={editLocId()} onSelect={setEditLocId} getLabel={(l) => l.nume} placeholder="Loc de cazare" onAddNew={addLocInline} />
                    <SearchableSelect items={employees()} value={editEmpId()} onSelect={setEditEmpId} getLabel={(e) => e.name} placeholder="Angajat" />
                    <div>
                      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data cazare</label>
                      <input class="input" type="date" value={editCheckin()} onInput={(e) => setEditCheckin(e.currentTarget.value)} />
                    </div>
                    <textarea class="input" rows={2} placeholder="Comentarii..." style="resize:vertical" value={editComments()} onInput={(e) => setEditComments(e.currentTarget.value)} />
                  </div>
                </div>

                <Show when={editErr()}>
                  <p style="color:var(--danger);font-size:13px;margin:0">{editErr()}</p>
                </Show>

                </div>{/* end coloana dreapta */}
                </div>{/* end grid */}
              </div>

              <div class="sl-modal-footer" style="justify-content:space-between">
                <Show when={adminVisible()}>
                  <button class="btn btn-danger btn-sm" onClick={() => { setDeleteTarget({ id: c().id, name: c().clientNume ?? "—" }); setEditCazare(null); }}>Șterge</button>
                </Show>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-ghost btn-sm" onClick={() => setEditCazare(null)}>Anulează</button>
                  <button class="btn btn-primary btn-sm" onClick={doEdit} disabled={editSaving()}>
                    {editSaving() ? "Se salvează..." : "Salvează"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Modal: Admin Edit */}
      <Show when={editAdminTarget()}>
        {(t) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:420px;width:100%">
              <div class="sl-modal-header">
                <span class="sl-modal-title">
                  {t().type === "loc" ? "Editare loc cazare" : t().type === "marca" ? "Editare marcă" : t().type === "dim" ? "Editare dimensiune" : "Editare profil"}
                </span>
                <button class="btn btn-ghost btn-sm" onClick={() => setEditAdminTarget(null)}>✕</button>
              </div>
              <div style="padding:16px 24px;display:flex;flex-direction:column;gap:8px">
                <input
                  class="input"
                  placeholder={t().type === "dim" ? "Valoare (ex: 205/55 R16)" : t().type === "profil" ? "Valoare profil (ex: 60)" : "Nume *"}
                  value={editAdminVal1()}
                  onInput={(e) => setEditAdminVal1(e.currentTarget.value)}
                />
                <Show when={t().type === "loc"}>
                  <input
                    class="input"
                    placeholder="Descriere"
                    value={editAdminVal2()}
                    onInput={(e) => setEditAdminVal2(e.currentTarget.value)}
                  />
                </Show>
              </div>
              <div class="sl-modal-footer" style="justify-content:space-between">
                <Show when={adminVisible()}>
                  <button
                    class="btn btn-danger btn-sm"
                    onClick={() => { setAdminDeleteTarget({ type: t().type, id: t().id, label: editAdminVal1() }); setEditAdminTarget(null); }}
                  >Șterge</button>
                </Show>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-ghost btn-sm" onClick={() => setEditAdminTarget(null)}>Anulează</button>
                    <button class="btn btn-primary btn-sm" onClick={saveAdminEdit} disabled={editAdminSaving() || !editAdminVal1().trim()}>
                      {editAdminSaving() ? "..." : "Salvează"}
                    </button>
                  </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Modal: Admin Delete */}
      <Show when={adminDeleteTarget()}>
        {(t) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal">
              <div class="sl-modal-header">
                <span class="sl-modal-title">Confirmare ștergere</span>
                <button class="btn btn-ghost btn-sm" onClick={() => setAdminDeleteTarget(null)}>✕</button>
              </div>
              <div style="padding:16px 24px;font-size:14px">
                Ștergi <strong>{t().label}</strong>? Acțiunea este ireversibilă.
              </div>
              <div class="sl-modal-footer">
                <button class="btn btn-ghost btn-sm" onClick={() => setAdminDeleteTarget(null)}>Anulează</button>
                <button class="btn btn-danger btn-sm" onClick={doAdminDelete} disabled={adminDeleting()}>
                  {adminDeleting() ? "..." : "Șterge definitiv"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Modal: Cazare Noua */}
      <Show when={showNewModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="width:98vw;max-width:none;height:96vh;padding:0;overflow:hidden;display:flex;flex-direction:column;gap:0">
            <div class="sl-modal-header" style="padding:14px 20px;border-bottom:1px solid var(--border);flex-shrink:0;margin-bottom:0">
              <span class="sl-modal-title">Cazare Nouă</span>
              <button class="btn btn-ghost btn-sm" onClick={cancelNewModal}>✕</button>
            </div>

            <div style="flex:1;overflow:hidden;display:grid;grid-template-columns:1fr 1.8fr 1.3fr;min-height:0">

              {/* ─ Coloana stânga: Client ─ */}
              <div style="overflow-y:auto;padding:16px;border-right:1px solid var(--border)">
              <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Client</div>
                <ClientSearch value={newClient()} onSelect={handleClientSelect} />
                <ClientInfoBlock client={newClient()} />
                <Show when={newClient() && newClientVehicole().length > 0}>
                  <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                    <div style="margin-bottom:4px">
                      <div style="font-size:12px;color:var(--text-muted)">Mașini client</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px">
                      <For each={newClientVehicole()}>
                        {(v) => (
                          <label style={`display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;font-size:13px;cursor:pointer;background:${newSelectedVehicol() === v.numar_masina ? "var(--primary-bg,rgba(99,102,241,.1))" : "var(--bg)"}`}>
                            <input
                              type="radio"
                              name="new-vehicol"
                              checked={newSelectedVehicol() === v.numar_masina}
                              onChange={() => setNewSelectedVehicol(v.numar_masina)}
                            />
                            <strong>{v.numar_masina}</strong>
                            <Show when={v.marca || v.model}>
                              <span style="color:var(--text-muted);font-size:11px">{[v.marca, v.model].filter(Boolean).join(" ")}</span>
                            </Show>
                          </label>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
                <Show when={newReferintaCazareId() !== null}>
                  <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Referință cazare anterioară</div>
                    <div style="display:flex;align-items:center;gap:6px;font-size:13px;padding:4px 8px;background:var(--bg);border-radius:6px">
                      <span style="flex:1">Cazare #{newReferintaCazareId()} — {clientCazariVechi().find((c) => c.id === newReferintaCazareId())?.dataCheckin ?? ""}</span>
                      <button class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:11px" onClick={() => { setNewReferintaCazareId(null); setNewMontatePeMasina(false); }}>✕</button>
                    </div>
                    <div style="margin-top:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Anvelopele scoase au fost</div>
                    <div style="display:flex;flex-direction:column;gap:6px">
                      <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${newMontatePeMasina() ? "#16a34a" : "var(--border)"};background:${newMontatePeMasina() ? "rgba(22,163,74,.08)" : "var(--bg)"}`}>
                        <input type="radio" name="new-montate" checked={newMontatePeMasina()} onChange={() => setNewMontatePeMasina(true)} />
                        <div>
                          <div style={`font-weight:600;font-size:13px;color:${newMontatePeMasina() ? "#16a34a" : "var(--text)"}`}>✓ Montate pe mașină</div>
                          <div style="font-size:11px;color:var(--text-muted)">Scoase și montate direct pe vehiculul clientului</div>
                        </div>
                      </label>
                      <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${!newMontatePeMasina() ? "#dc2626" : "var(--border)"};background:${!newMontatePeMasina() ? "rgba(220,38,38,.08)" : "var(--bg)"}`}>
                        <input type="radio" name="new-montate" checked={!newMontatePeMasina()} onChange={() => setNewMontatePeMasina(false)} />
                        <div>
                          <div style={`font-weight:600;font-size:13px;color:${!newMontatePeMasina() ? "#dc2626" : "var(--text)"}`}>✗ Predate clientului</div>
                          <div style="font-size:11px;color:var(--text-muted)">Scoase și predate fără a fi montate</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </Show>
              </div>
              </div>

              {/* ─ Coloana mijloc: Anvelope + Date Cazare ─ */}
              <div style="overflow-y:auto;padding:16px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:16px">

              {/* ─ Zona: Anvelope ─ */}
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
                      {(a, idx) => (
                        <div style="display:flex;flex-direction:column">
                          <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;font-size:13px;background:var(--bg)">
                            <input
                              type="checkbox"
                              checked={selectedAnvIds().has(a.id)}
                              onChange={() => toggleAnv(a.id)}
                              style="flex-shrink:0"
                            />
                            <span style="color:var(--text-muted);font-weight:600;flex-shrink:0;min-width:18px;text-align:right">{idx() + 1}.</span>
                            <span style="flex:1;min-width:0">
                              <strong>{a.marcaNume ?? "—"}</strong>
                              <Show when={a.dimensiuneValoare}> {a.dimensiuneValoare}</Show>
                              <Show when={a.dotValoare}>{" · DOT "}{a.dotValoare}</Show>
                              {" · "}{TIP_LABELS[a.tip]}
                              <Show when={a.adancime != null}>{" · "}{a.adancime}mm</Show>
                              <Show when={a.id < 0}>
                                <span style="color:var(--primary);font-size:11px;margin-left:4px">(nou)</span>
                              </Show>
                            </span>
                            <button
                              class="btn btn-ghost btn-sm"
                              style={`padding:1px 6px;font-size:11px;flex-shrink:0;${anvEditId() === a.id ? "background:var(--primary-bg,rgba(99,102,241,.12))" : ""}`}
                              title="Editează"
                              onClick={() => {
                                if (anvEditId() === a.id) { setShowAnvForm(false); setAnvEditId(null); }
                                else { setAnvEditId(a.id); setShowAnvForm(true); }
                              }}
                            >{anvEditId() === a.id ? "▾ Edit" : "Edit"}</button>
                            <button
                              class="btn btn-ghost btn-sm"
                              style="padding:1px 6px;font-size:11px;flex-shrink:0"
                              title="Copiază"
                              onClick={() => {
                                const tempId = -Date.now();
                                const copy = { ...a, id: tempId };
                                setClientAnvelope((prev) => [...prev, copy]);
                                setSelectedAnvIds((prev) => new Set([...prev, tempId]));
                              }}
                            >Copy</button>
                          </div>
                          <Show when={showAnvForm() && anvEditId() === a.id}>
                            <div style="margin:4px 0 4px 24px;padding:10px;border-left:2px solid var(--primary);background:var(--surface2,rgba(99,102,241,.04));border-radius:0 8px 8px 0">
                              <AnvelopaForm
                                clientId={newClient()!.id}
                                initialData={a}
                                compact={true}
                                onSaved={(saved) => {
                                  const oldId = a.id;
                                  setClientAnvelope((prev) => prev.map((x) => x.id === oldId ? saved : x));
                                  setSelectedAnvIds((prev) => { const s = new Set(prev); s.delete(oldId); s.add(saved.id); return s; });
                                  setShowAnvForm(false);
                                  setAnvEditId(null);
                                }}
                                onCancel={() => { setShowAnvForm(false); setAnvEditId(null); }}
                              />
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show when={!showAnvForm()}>
                    <button class="btn btn-ghost btn-sm" style="margin-top:8px" onClick={() => { setAnvEditId(null); setShowAnvForm(true); }}>+ Anvelopă nouă</button>
                  </Show>
                  <Show when={clientAnvelope().length > 0}>
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">S-au lasat pentru depozitare urmatoarele:</div>
                      <div style="display:flex;flex-wrap:wrap;gap:10px 18px">
                        {([
                          ["Anvelope", newDepAnvelope, setNewDepAnvelope],
                          ["Capace", newDepCapace, setNewDepCapace],
                          ["Roti complete", newDepRotiComplete, setNewDepRotiComplete],
                          ["Antifurturi", newDepAntifurturi, setNewDepAntifurturi],
                          ["Prezoane", newDepPrezoane, setNewDepPrezoane],
                        ] as const).map(([label, get, set]) => (
                          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                            <input type="checkbox" checked={get()} onChange={() => set(v => !v)} style="width:15px;height:15px;cursor:pointer" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </Show>
                  <Show when={showAnvForm() && anvEditId() === null}>
                    <AnvelopaForm
                      clientId={newClient()!.id}
                      initialData={undefined}
                      onSaved={(a) => {
                        setClientAnvelope((prev) => [...prev, a]);
                        setSelectedAnvIds((prev) => new Set([...prev, a.id]));
                        setShowAnvForm(false);
                        setAnvEditId(null);
                      }}
                      onCancel={() => { setShowAnvForm(false); setAnvEditId(null); }}
                    />
                  </Show>
                </Show>
              </div>

              {/* ─ Date Cazare ─ */}
              <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Date Cazare</div>
                <div style="display:grid;gap:8px">
                  <SearchableSelect items={locuriCazare()} value={newLocId()} onSelect={setNewLocId} getLabel={(l) => l.nume} placeholder="Loc de cazare" onAddNew={addLocInline} />
                  <SearchableSelect items={employees()} value={newEmpId()} onSelect={setNewEmpId} getLabel={(e) => e.name} placeholder="Angajat" />
                  <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data cazare</label>
                    <input class="input" type="date" value={newCheckin()} onInput={(e) => setNewCheckin(e.currentTarget.value)} />
                  </div>
                  <textarea class="input" rows={4} placeholder="Comentarii..." style="resize:vertical" value={newComments()} onInput={(e) => setNewComments(e.currentTarget.value)} />
                </div>
              </div>

              <Show when={saveErr()}>
                <p style="color:var(--danger);font-size:13px;margin:0">{saveErr()}</p>
              </Show>

              </div>{/* end coloana mijloc */}

              {/* ─ Coloana dreapta: Imagine Cazare Roti ─ */}
              <div style="overflow:hidden;position:relative">
                <Show
                  when={cazareImageUrl()}
                  fallback={
                    <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--surface2)">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--border)">
                        <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M4 16l4-4 4 4 4-6 4 6"/>
                      </svg>
                      <span style="font-size:13px;color:var(--text-muted)">Nicio imagine configurată</span>
                    </div>
                  }
                >
                  <img src={cazareImageUrl()!} alt="Cazare Roti" style="width:100%;height:100%;object-fit:cover;display:block" />
                </Show>
              </div>

            </div>

            <div class="sl-modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0;margin-top:0">
              <button class="btn btn-ghost btn-sm" onClick={cancelNewModal}>Anulează</button>
              <button class="btn btn-primary btn-sm" onClick={saveCazare} disabled={saving()}>
                {saving() ? "Se salvează..." : "Salvează Cazarea"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal: Sugestie anvelope din ultimul montaj */}
      <Show when={montajSuggestion()}>
        {(_) => {
          const s = montajSuggestion()!;
          const currentClientId = () => newClient()?.id ?? pageSelectedClient()?.id ?? null;
          const clientMismatch = () => s.clientId !== null && currentClientId() !== null && s.clientId !== currentClientId();
          const dateStr = () => (s.montajCreatedAt ? s.montajCreatedAt.slice(0, 10) : null);
          return (
            <div class="sl-modal-overlay" style="z-index:1100">
              <div class="sl-modal" style="width:min(900px,96vw);max-height:90vh;padding:0;overflow:hidden;display:flex;flex-direction:column;gap:0">
                <div class="sl-modal-header" style="padding:14px 20px;border-bottom:1px solid var(--border);flex-shrink:0;margin-bottom:0">
                  <span class="sl-modal-title">Sugestie cazare</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setMontajSuggestion(null)}>✕</button>
                </div>

                <div style="padding:16px 20px;overflow:auto;display:flex;flex-direction:column;gap:12px">
                  <div style="font-size:14px;line-height:1.5">
                    Pentru plăcuța <strong>{s.numarMasina}</strong> am identificat un montaj din data <strong>{fmtDate(dateStr())}</strong>.
                    Confirmă dacă acestea sunt anvelopele care se doresc cazate.
                  </div>

                  <Show when={clientMismatch()}>
                    <div style="background:#fff4e5;border:1px solid #f0b400;color:#8a5a00;padding:8px 10px;border-radius:6px;font-size:13px">
                      Atenție: clientul de pe receipt-ul anterior (<strong>{s.clientNume ?? "necunoscut"}</strong>) diferă de clientul curent.
                    </div>
                  </Show>

                  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
                    <For each={s.wheels.slice(0, 5)}>
                      {(w) => (
                        <div style="border:1px solid var(--border);border-radius:6px;padding:10px;background:var(--surface)">
                          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px">
                            <strong style="font-size:13px">{POZITIE_LABELS[w.pozitie]}</strong>
                            <span style="font-size:11px;color:var(--text-muted);background:var(--bg-alt,#f5f5f5);padding:2px 6px;border-radius:4px">{TIP_LABELS[w.tip]}</span>
                          </div>
                          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:12px">
                            <span style="color:var(--text-muted)">Marcă:</span><span>{w.marcaNume ?? "—"}</span>
                            <span style="color:var(--text-muted)">Dimensiune:</span><span>{w.dimensiuneValoare ?? "—"}</span>
                            <span style="color:var(--text-muted)">Profil:</span><span>{w.profilValoare ?? "—"}</span>
                            <span style="color:var(--text-muted)">DOT:</span><span>{w.dotValoare ?? "—"}</span>
                            <span style="color:var(--text-muted)">Adâncime:</span><span>{w.adancime != null ? `${w.adancime} mm` : "—"}</span>
                            <span style="color:var(--text-muted)">Indice viteză:</span><span>{w.indiceViteza ?? "—"}</span>
                            <span style="color:var(--text-muted)">Indice sarcină:</span><span>{w.indiceSarcina ?? "—"}</span>
                            <Show when={w.comments}>
                              <span style="color:var(--text-muted)">Note:</span><span>{w.comments}</span>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>

                  <Show when={s.wheels.filter((w) => w.pozitie !== "rezerva").length === 0}>
                    <div style="font-size:12px;color:var(--text-muted)">Atenție: toate roțile din montajul anterior sunt marcate ca rezervă. Niciuna nu va fi pre-populată automat.</div>
                  </Show>
                </div>

                <div class="sl-modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0;margin-top:0;display:flex;justify-content:flex-end;gap:8px">
                  <button class="btn btn-ghost btn-sm" onClick={() => setMontajSuggestion(null)}>Introduc manual</button>
                  <button
                    class="btn btn-primary btn-sm"
                    disabled={s.wheels.filter((w) => w.pozitie !== "rezerva").length === 0}
                    onClick={applySuggestion}
                  >
                    Folosește aceste anvelope
                  </button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* Prompt de intrare din POS → întrebare cazare nouă sau căutare istoric */}
      <Show when={entryChoicePrompt()}>
        <div class="sl-modal-overlay" style="z-index:1100">
          <div class="sl-modal" style="max-width:560px;width:100%;text-align:center">
            <div class="sl-modal-header" style="justify-content:center;border-bottom:none;padding-bottom:0">
              <span class="sl-modal-title">Cum continuați?</span>
            </div>
            <div style="padding:16px 24px 8px;display:flex;flex-direction:column;align-items:center;gap:12px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style="color:var(--text);font-size:15px;line-height:1.5;margin:0">
                Pentru plăcuța <strong>{posHotelCtx()?.titlu}</strong> alegeți acțiunea dorită:
              </p>
            </div>
            <div class="sl-modal-footer" style="justify-content:center;gap:16px;padding:20px 24px 24px;border-top:none;flex-wrap:wrap">
              <button
                class="btn btn-ghost"
                style="min-width:180px;min-height:96px;font-size:15px;font-weight:600;border-radius:10px;border:2px solid var(--border)"
                onClick={() => { setEntryChoicePrompt(false); openNewModal(); }}
              >
                Cazare nouă
                <div style="font-size:11px;font-weight:400;color:var(--text-muted);margin-top:4px">Adăugați anvelope noi</div>
              </button>
              <button
                class="btn btn-primary"
                style="min-width:180px;min-height:96px;font-size:15px;font-weight:700;border-radius:10px"
                onClick={enterHistorySearchMode}
              >
                Caută în istoric
                <div style="font-size:11px;font-weight:400;opacity:.85;margin-top:4px">Scoate anvelope de la alt client</div>
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal: Scoatere și Introducere Nouă */}
      <Show when={combinedCazare() !== null}>
        {(_) => {
          const c = combinedCazare()!;
          return (
            <div class="sl-modal-overlay">
              <div class="sl-modal" style="width:98vw;max-width:none;height:96vh;padding:0;overflow:hidden;display:flex;flex-direction:column;gap:0">
                <div class="sl-modal-header" style="padding:14px 20px;border-bottom:1px solid var(--border);flex-shrink:0;margin-bottom:0">
                  <span class="sl-modal-title">Scoatere și Introducere Nouă</span>
                  <button class="btn btn-ghost btn-sm" onClick={() => setCombinedCazare(null)}>✕</button>
                </div>

                <div style="flex:1;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;min-height:0">

                  {/* ─ Stânga: View scoatere ─ */}
                  <div style="overflow-y:auto;padding:16px;border-right:2px solid #1e3a8a;display:flex;flex-direction:column;gap:12px">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1e3a8a;padding-bottom:6px;border-bottom:2px solid #1e3a8a">
                      Scoatere din depozit
                    </div>

                    {/* Row: Client + S-a depozitat */}
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                      {/* Client info */}
                      <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Client</div>
                        <div style="display:grid;gap:4px;font-size:13px">
                          <div><span style="color:var(--text-muted)">Nume:</span> <strong>{c.clientNume ?? "—"}</strong></div>
                          <Show when={c.clientCui}><div><span style="color:var(--text-muted)">CUI:</span> {c.clientCui}</div></Show>
                          <Show when={c.clientTelefon}><div><span style="color:var(--text-muted)">Tel:</span> {c.clientTelefon}</div></Show>
                          <Show when={c.numarMasina}><div><span style="color:var(--text-muted)">Mașină:</span> {c.numarMasina}</div></Show>
                        </div>
                      </div>

                      {/* Dep items */}
                      <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">S-a depozitat</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">
                          <For each={[
                            [c.depAnvelope, "Anvelope"],
                            [c.depCapace, "Capace"],
                            [c.depRotiComplete, "Roți complete"],
                            [c.depAntifurturi, "Antifurturi"],
                            [c.depPrezoane, "Prezoane"],
                          ] as [boolean, string][]}>
                            {([val, label]) => (
                              <Show when={val}>
                                <span style="padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af">{label}</span>
                              </Show>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>

                    {/* Tires table */}
                    <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Anvelope ({c.items.length})</div>
                      <Show when={c.items.length > 0}>
                        <div style="overflow-x:auto">
                          <table style="width:100%;border-collapse:collapse;font-size:12px">
                            <thead>
                              <tr style="background:#1e3a8a;color:white">
                                <th style="padding:5px 8px;text-align:left;font-weight:600">Marcă</th>
                                <th style="padding:5px 8px;text-align:left;font-weight:600">Dimensiune</th>
                                <th style="padding:5px 8px;text-align:left;font-weight:600">DOT</th>
                                <th style="padding:5px 8px;text-align:left;font-weight:600">Tip</th>
                                <th style="padding:5px 8px;text-align:left;font-weight:600">Adânc.</th>
                              </tr>
                            </thead>
                            <tbody>
                              <For each={c.items.filter(i => i.anvelopa)}>
                                {(item, idx) => (
                                  <tr style={`background:${idx() % 2 === 0 ? "var(--bg)" : "transparent"}`}>
                                    <td style="padding:4px 8px">{item.anvelopa!.marcaNume ?? "—"}</td>
                                    <td style="padding:4px 8px">{item.anvelopa!.dimensiuneValoare ?? "—"}</td>
                                    <td style="padding:4px 8px">{item.anvelopa!.dotValoare ?? "—"}</td>
                                    <td style="padding:4px 8px">{TIP_LABELS[item.anvelopa!.tip]}</td>
                                    <td style="padding:4px 8px">{item.anvelopa!.adancime != null ? `${item.anvelopa!.adancime}mm` : "—"}</td>
                                  </tr>
                                )}
                              </For>
                            </tbody>
                          </table>
                        </div>
                      </Show>
                      <Show when={c.items.length === 0}>
                        <p style="color:var(--text-muted);font-size:12px;margin:0">—</p>
                      </Show>
                    </div>

                    {/* Row: Anvelopele scoase au fost + Date scoatere */}
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                      {/* Anvelopele scoase au fost (montate/predate) */}
                      <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Anvelopele scoase au fost</div>
                        <div style="display:flex;flex-direction:column;gap:6px">
                          <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${newMontatePeMasina() ? "#16a34a" : "var(--border)"};background:${newMontatePeMasina() ? "rgba(22,163,74,.08)" : "var(--bg)"}`}>
                            <input type="radio" name="combined-montate" checked={newMontatePeMasina()} onChange={() => setNewMontatePeMasina(true)} />
                            <div>
                              <div style={`font-weight:600;font-size:13px;color:${newMontatePeMasina() ? "#16a34a" : "var(--text)"}`}>✓ Montate pe mașină</div>
                              <div style="font-size:11px;color:var(--text-muted)">Scoase și montate direct pe vehicul</div>
                            </div>
                          </label>
                          <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${!newMontatePeMasina() ? "#dc2626" : "var(--border)"};background:${!newMontatePeMasina() ? "rgba(220,38,38,.08)" : "var(--bg)"}`}>
                            <input type="radio" name="combined-montate" checked={!newMontatePeMasina()} onChange={() => setNewMontatePeMasina(false)} />
                            <div>
                              <div style={`font-weight:600;font-size:13px;color:${!newMontatePeMasina() ? "#dc2626" : "var(--text)"}`}>✗ Predate clientului</div>
                              <div style="font-size:11px;color:var(--text-muted)">Scoase și predate fără a fi montate</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Checkout date + comments */}
                      <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Date scoatere</div>
                        <div style="display:grid;gap:8px">
                          <div>
                            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data scoatere</label>
                            <input class="input" type="date" value={checkoutDate()} onInput={(e) => setCheckoutDate(e.currentTarget.value)} />
                          </div>
                          <textarea class="input" rows={2} placeholder="Comentarii scoatere..." style="resize:vertical" value={checkoutComments()} onInput={(e) => setCheckoutComments(e.currentTarget.value)} />
                        </div>
                      </div>
                    </div>

                    {/* Imagine ghidare: Montare / Scoatere roți */}
                    <div style="flex:1 1 auto;min-height:200px;border:1px solid var(--border);border-radius:8px;overflow:hidden;position:relative;background:var(--surface2)">
                      <Show
                        when={newMontatePeMasina() ? montareImageUrl() : scoatereImageUrl()}
                        fallback={
                          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--border)">
                              <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M4 16l4-4 4 4 4-6 4 6"/>
                            </svg>
                            <span style="font-size:13px;color:var(--text-muted)">Nicio imagine configurată</span>
                          </div>
                        }
                      >
                        <img
                          src={(newMontatePeMasina() ? montareImageUrl() : scoatereImageUrl())!}
                          alt={newMontatePeMasina() ? "Montare Roti" : "Scoatere Roti"}
                          style="width:100%;height:100%;object-fit:contain;display:block"
                        />
                      </Show>
                    </div>
                  </div>

                  {/* ─ Dreapta: Cazare nouă ─ */}
                  <div style="overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#065f46;padding-bottom:6px;border-bottom:2px solid #059669">
                      Introducere nouă la depozitare
                    </div>

                    {/* Client pre-filled */}
                    <Show when={newClient()}>
                      <div style="border:1px solid #059669;border-radius:8px;padding:10px 12px;background:rgba(5,150,105,.06)">
                        <div style="font-size:14px;font-weight:700;color:#065f46">
                          Client <span>{newClient()!.nume}</span> preluat
                        </div>
                        <Show when={newClient()!.telefon}><div style="font-size:12px;color:var(--text-muted);margin-top:2px">{newClient()!.telefon}</div></Show>
                      </div>
                    </Show>

                    {/* Tires */}
                    <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Anvelope de introdus</div>
                      <Show when={!newClient()}>
                        <p style="color:var(--text-muted);font-size:13px;margin:0">Se încarcă clientul...</p>
                      </Show>
                      <Show when={newClient()}>
                        <Show when={clientAnvelope().length === 0 && !showAnvForm()}>
                          <p style="color:var(--text-muted);font-size:13px;margin:0 0 8px">Nicio anvelopă înregistrată.</p>
                        </Show>
                        <div style="display:flex;flex-direction:column;gap:4px">
                          <For each={clientAnvelope()}>
                            {(a, idx) => (
                              <div style="display:flex;flex-direction:column">
                                <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;font-size:13px;background:var(--bg)">
                                  <input type="checkbox" checked={selectedAnvIds().has(a.id)} onChange={() => toggleAnv(a.id)} style="flex-shrink:0" />
                                  <span style="color:var(--text-muted);font-weight:600;flex-shrink:0;min-width:18px;text-align:right">{idx() + 1}.</span>
                                  <span style="flex:1;min-width:0">
                                    <strong>{a.marcaNume ?? "—"}</strong>
                                    <Show when={a.dimensiuneValoare}> {a.dimensiuneValoare}</Show>
                                    <Show when={a.dotValoare}>{" · DOT "}{a.dotValoare}</Show>
                                    {" · "}{TIP_LABELS[a.tip]}
                                    <Show when={a.adancime != null}>{" · "}{a.adancime}mm</Show>
                                    <Show when={a.id < 0}><span style="color:var(--primary);font-size:11px;margin-left:4px">(nou)</span></Show>
                                  </span>
                                  <button
                                    class="btn btn-ghost btn-sm"
                                    style={`padding:1px 6px;font-size:11px;${anvEditId() === a.id ? "background:var(--primary-bg,rgba(99,102,241,.12))" : ""}`}
                                    onClick={() => {
                                      if (anvEditId() === a.id) { setShowAnvForm(false); setAnvEditId(null); }
                                      else { setAnvEditId(a.id); setShowAnvForm(true); }
                                    }}
                                  >{anvEditId() === a.id ? "▾ Edit" : "Edit"}</button>
                                  <button class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:11px" onClick={() => { const tempId = -Date.now(); setClientAnvelope(p => [...p, {...a, id: tempId}]); setSelectedAnvIds(p => new Set([...p, tempId])); }}>Copy</button>
                                </div>
                                <Show when={showAnvForm() && anvEditId() === a.id}>
                                  <div style="margin:4px 0 4px 24px;padding:10px;border-left:2px solid var(--primary);background:var(--surface2,rgba(99,102,241,.04));border-radius:0 8px 8px 0">
                                    <AnvelopaForm
                                      clientId={newClient()!.id}
                                      initialData={a}
                                      compact={true}
                                      onSaved={(saved) => {
                                        const oldId = a.id;
                                        setClientAnvelope(p => p.map(x => x.id === oldId ? saved : x));
                                        setSelectedAnvIds(p => { const s = new Set(p); s.delete(oldId); s.add(saved.id); return s; });
                                        setShowAnvForm(false); setAnvEditId(null);
                                      }}
                                      onCancel={() => { setShowAnvForm(false); setAnvEditId(null); }}
                                    />
                                  </div>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={!showAnvForm()}>
                          <button class="btn btn-ghost btn-sm" style="margin-top:8px" onClick={() => { setAnvEditId(null); setShowAnvForm(true); }}>+ Anvelopă nouă</button>
                        </Show>
                        <Show when={showAnvForm() && anvEditId() === null}>
                          <AnvelopaForm
                            clientId={newClient()!.id}
                            initialData={undefined}
                            onSaved={(a) => {
                              setClientAnvelope(p => [...p, a]);
                              setSelectedAnvIds(p => new Set([...p, a.id]));
                              setShowAnvForm(false); setAnvEditId(null);
                            }}
                            onCancel={() => { setShowAnvForm(false); setAnvEditId(null); }}
                          />
                        </Show>
                        {/* Dep items */}
                        <Show when={clientAnvelope().length > 0}>
                          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">S-au lăsat pentru depozitare:</div>
                            <div style="display:flex;flex-wrap:wrap;gap:10px 18px">
                              {([
                                ["Anvelope", newDepAnvelope, setNewDepAnvelope],
                                ["Capace", newDepCapace, setNewDepCapace],
                                ["Roti complete", newDepRotiComplete, setNewDepRotiComplete],
                                ["Antifurturi", newDepAntifurturi, setNewDepAntifurturi],
                                ["Prezoane", newDepPrezoane, setNewDepPrezoane],
                              ] as const).map(([label, get, set]) => (
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                                  <input type="checkbox" checked={get()} onChange={() => set(v => !v)} style="width:15px;height:15px;cursor:pointer" />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        </Show>
                      </Show>
                    </div>

                    {/* Cazare details */}
                    <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Date cazare nouă</div>
                      <div style="display:grid;gap:8px">
                        <SearchableSelect items={locuriCazare()} value={newLocId()} onSelect={setNewLocId} getLabel={(l) => l.nume} placeholder="Loc de cazare" onAddNew={addLocInline} />
                        <SearchableSelect items={employees()} value={newEmpId()} onSelect={setNewEmpId} getLabel={(e) => e.name} placeholder="Angajat" />
                        <div>
                          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Data cazare</label>
                          <input class="input" type="date" value={newCheckin()} onInput={(e) => setNewCheckin(e.currentTarget.value)} />
                        </div>
                        <textarea class="input" rows={3} placeholder="Comentarii..." style="resize:vertical" value={newComments()} onInput={(e) => setNewComments(e.currentTarget.value)} />
                      </div>
                    </div>

                    <Show when={combinedErr()}>
                      <p style="color:var(--danger);font-size:13px;margin:0">{combinedErr()}</p>
                    </Show>

                    {/* Imagine ghidare: Cazare Roti */}
                    <div style="flex:1 1 auto;min-height:200px;border:1px solid var(--border);border-radius:8px;overflow:hidden;position:relative;background:var(--surface2)">
                      <Show
                        when={cazareImageUrl()}
                        fallback={
                          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--border)">
                              <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M4 16l4-4 4 4 4-6 4 6"/>
                            </svg>
                            <span style="font-size:13px;color:var(--text-muted)">Nicio imagine configurată</span>
                          </div>
                        }
                      >
                        <img src={cazareImageUrl()!} alt="Cazare Roti" style="width:100%;height:100%;object-fit:contain;display:block" />
                      </Show>
                    </div>
                  </div>
                </div>

                <div class="sl-modal-footer" style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0;margin-top:0">
                  <button class="btn btn-ghost btn-sm" onClick={() => setCombinedCazare(null)}>Anulează</button>
                  <button class="btn btn-primary btn-sm" onClick={doCombinedCheckoutNew} disabled={combinedSaving()}>
                    {combinedSaving() ? "Se procesează..." : "Confirmă Scoaterea și Introducerea"}
                  </button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* Modal: Checkout */}
      <Show when={checkoutCazare()}>
        {(c) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto">
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
                            <th style="padding:4px 8px;text-align:left">DOT</th>
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
                                  <td style="padding:4px 8px">{item.anvelopa!.dotValoare ?? "—"}</td>
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
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Anvelopele scoase au fost</div>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${checkoutMontatePeMasina() ? "#16a34a" : "var(--border)"};background:${checkoutMontatePeMasina() ? "rgba(22,163,74,.08)" : "var(--bg)"}`}>
                      <input type="radio" name="checkout-montate" checked={checkoutMontatePeMasina()} onChange={() => setCheckoutMontatePeMasina(true)} />
                      <div>
                        <div style={`font-weight:600;font-size:13px;color:${checkoutMontatePeMasina() ? "#16a34a" : "var(--text)"}`}>✓ Montate pe mașină</div>
                        <div style="font-size:11px;color:var(--text-muted)">Scoase și montate direct pe vehicul</div>
                      </div>
                    </label>
                    <label style={`display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:2px solid ${!checkoutMontatePeMasina() ? "#dc2626" : "var(--border)"};background:${!checkoutMontatePeMasina() ? "rgba(220,38,38,.08)" : "var(--bg)"}`}>
                      <input type="radio" name="checkout-montate" checked={!checkoutMontatePeMasina()} onChange={() => setCheckoutMontatePeMasina(false)} />
                      <div>
                        <div style={`font-weight:600;font-size:13px;color:${!checkoutMontatePeMasina() ? "#dc2626" : "var(--text)"}`}>✗ Predate clientului</div>
                        <div style="font-size:11px;color:var(--text-muted)">Scoase și predate fără a fi montate</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px">Date Cazare</div>
                  <div style="display:grid;gap:8px;font-size:13px">
                    <Show when={c().locCazareNume}><div><span style="color:var(--text-muted)">Loc:</span> {c().locCazareNume}</div></Show>
                    <Show when={c().employeeName}><div><span style="color:var(--text-muted)">Angajat:</span> {c().employeeName}</div></Show>
                    <div><span style="color:var(--text-muted)">Cazare:</span> {fmtDate(c().dataCheckin)}</div>
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
                <button class="btn btn-primary btn-sm" onClick={() => doCheckout()} disabled={checkoutSaving()}>
                  {checkoutSaving() ? "Se procesează..." : "Confirmă Scoaterea"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Modal View-Only Cazare */}
      <Show when={viewOnlyCazare()}>
        {(c) => (
          <div class="sl-modal-overlay">
            <div class="sl-modal" style="max-width:700px;width:95%;max-height:90vh;overflow-y:auto">
              <div class="sl-modal-header">
                <span class="sl-modal-title">
                  {c().dataCheckout ? "Scoatere Anvelope" : "Cazare Anvelope"} — Vizualizare
                </span>
                <button class="btn btn-ghost btn-sm" onClick={() => setViewOnlyCazare(null)}>✕</button>
              </div>
              <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:14px">

                {/* Client + Date Cazare (pe aceeasi linie) */}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                  {/* Client + Mașină */}
                  <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Client</div>
                    <div style="display:grid;gap:5px;font-size:13px">
                      <Show when={c().clientNume}>
                        <div><span style="color:var(--text-muted)">Nume:</span> <strong>{c().clientNume}</strong></div>
                      </Show>
                      <Show when={c().clientCui}>
                        <div><span style="color:var(--text-muted)">CUI:</span> {c().clientCui}</div>
                      </Show>
                      <Show when={c().clientTelefon}>
                        <div><span style="color:var(--text-muted)">Telefon:</span> {c().clientTelefon}</div>
                      </Show>
                      <Show when={c().clientAdresa}>
                        <div><span style="color:var(--text-muted)">Adresă:</span> {c().clientAdresa}</div>
                      </Show>
                      <Show when={c().clientReprezentant}>
                        <div><span style="color:var(--text-muted)">Reprezentant:</span> {c().clientReprezentant}</div>
                      </Show>
                      <Show when={c().numarMasina}>
                        <div><span style="color:var(--text-muted)">Nr. mașină:</span> <strong>{c().numarMasina}</strong></div>
                      </Show>
                    </div>
                  </div>

                  {/* Date Cazare */}
                  <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Date Cazare</div>
                    <div style="display:grid;gap:5px;font-size:13px">
                      <div><span style="color:var(--text-muted)">Check-in:</span> <strong>{fmtDate(c().dataCheckin)}</strong></div>
                      <Show when={c().dataCheckout}>
                        <div><span style="color:var(--text-muted)">Check-out:</span> <strong>{fmtDate(c().dataCheckout)}</strong></div>
                        <div style="font-weight:600;color:var(--primary)">Durată: {daysBetween(c().dataCheckin, c().dataCheckout!)} zile</div>
                      </Show>
                      <Show when={c().locCazareNume}>
                        <div><span style="color:var(--text-muted)">Loc:</span> {c().locCazareNume}</div>
                      </Show>
                      <Show when={c().employeeName}>
                        <div><span style="color:var(--text-muted)">Angajat:</span> {c().employeeName}</div>
                      </Show>
                      <Show when={c().comments}>
                        <div><span style="color:var(--text-muted)">Comentarii:</span> {c().comments}</div>
                      </Show>
                    </div>
                  </div>
                </div>

                {/* Depozitare */}
                <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">S-au lăsat la depozitare</div>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    <span style={`padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;${c().depAnvelope ? "background:#d1fae5;color:#065f46" : "background:var(--bg);color:var(--text-muted);text-decoration:line-through"}`}>Anvelope</span>
                    <span style={`padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;${c().depCapace ? "background:#d1fae5;color:#065f46" : "background:var(--bg);color:var(--text-muted);text-decoration:line-through"}`}>Capace</span>
                    <span style={`padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;${c().depRotiComplete ? "background:#d1fae5;color:#065f46" : "background:var(--bg);color:var(--text-muted);text-decoration:line-through"}`}>Roți complete</span>
                    <span style={`padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;${c().depAntifurturi ? "background:#d1fae5;color:#065f46" : "background:var(--bg);color:var(--text-muted);text-decoration:line-through"}`}>Antifurturi</span>
                    <span style={`padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;${c().depPrezoane ? "background:#d1fae5;color:#065f46" : "background:var(--bg);color:var(--text-muted);text-decoration:line-through"}`}>Prezoane</span>
                  </div>
                </div>

                {/* Anvelope */}
                <Show when={c().items.length > 0}>
                  <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px">Anvelope ({c().items.length})</div>
                    <div style="overflow-x:auto">
                      <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead>
                          <tr style="background:var(--bg);color:var(--text-muted)">
                            <th style="padding:5px 8px;text-align:left;font-weight:600">#</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">Marcă</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">Dimensiune</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">Profil</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">DOT</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">Tip</th>
                            <th style="padding:5px 8px;text-align:left;font-weight:600">Adâncime</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={c().items}>
                            {(item, idx) => (
                              <Show when={item.anvelopa}>
                                <tr style={`border-top:1px solid var(--border);${idx() % 2 === 1 ? "background:var(--bg)" : ""}`}>
                                  <td style="padding:5px 8px;color:var(--text-muted)">{idx() + 1}</td>
                                  <td style="padding:5px 8px;font-weight:600">{item.anvelopa!.marcaNume ?? "—"}</td>
                                  <td style="padding:5px 8px">{item.anvelopa!.dimensiuneValoare ?? "—"}</td>
                                  <td style="padding:5px 8px">{item.anvelopa!.profilValoare ?? "—"}</td>
                                  <td style="padding:5px 8px">{item.anvelopa!.dotValoare ?? "—"}</td>
                                  <td style="padding:5px 8px">{TIP_LABELS[item.anvelopa!.tip]}</td>
                                  <td style="padding:5px 8px">{item.anvelopa!.adancime != null ? `${item.anvelopa!.adancime} mm` : "—"}</td>
                                </tr>
                              </Show>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Show>

              </div>
              <div class="sl-modal-footer" style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onClick={() => viewModalPdf("checkin", c())} disabled={viewPdfLoading() === "checkin"}>
                  {viewPdfLoading() === "checkin" ? "..." : "PDF Cazare"}
                </button>
                <Show when={c().dataCheckout}>
                  <button class="btn btn-ghost btn-sm" onClick={() => viewModalPdf("checkout", c())} disabled={viewPdfLoading() === "checkout"}>
                    {viewPdfLoading() === "checkout" ? "..." : "PDF Scoatere"}
                  </button>
                </Show>
                <Show when={c().dataCheckout && c().successorCazareId != null}>
                  <button class="btn btn-ghost btn-sm" onClick={() => viewModalPdf("combined", c())} disabled={viewPdfLoading() === "combined"}>
                    {viewPdfLoading() === "combined" ? "..." : "PDF Scoatere + Cazare"}
                  </button>
                </Show>
                <div style="flex:1"></div>
                <button class="btn btn-ghost btn-sm" onClick={() => setViewOnlyCazare(null)}>Închide</button>
              </div>
            </div>
          </div>
        )}
      </Show>

    </div>
  );
}
