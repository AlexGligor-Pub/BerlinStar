import { For, Show, createMemo, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { adminVisible } from "../store/adminStore";
import { notify } from "../store/notificationsStore";
import { useNavigate } from "@solidjs/router";
import { receipts, deleteReceipt, loadReceipts, loadMoreReceipts, hasMore, loadingMore, updateMetodaPlata, updateReceiptClient, assignFacturaNumber, applyDocNumber, uploadToSpv, retryEFactura, connectSSE, disconnectSSE, posCount, convertFdlToDeviz, finalizeFdl, type Receipt } from "../store/receiptsStore";
import { generateDeviz, generateFactura, generateChitanta, generateFisaDeLucru, generateCazareCheckin, generateCazareCheckout, generateCazareScoatereIntroducere, generateMontajRoti } from "../utils/generateDocuments";
import type { DocContext, CompanyData, MontajRotaRow } from "../utils/generateDocuments";
import { hotelImages, loadHotelImages, getCazareById } from "../store/hotelAnvelopeStore";
import {
  loadMontajRotiByReceipt, loadMontareRotiImages, buildMontareRotiProxyUrls,
  type MontajRota, type PozitieRoata,
} from "../store/montajRotiStore";
import { setResume } from "../store/resumeStore";
import { apiFetch, API_BASE, readApiError } from "../utils/api";
import { device } from "../store/deviceStore";
import { generalSettings, loadGeneralSettings } from "../store/generalSettingsStore";

const RO_MONTHS_FULL = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const RO_MONTHS_SHORT = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];
const RO_DAYS_SHORT = ["Lu","Ma","Mi","Jo","Vi","Sâ","Du"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateShort(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  return `${d.getDate()} ${RO_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function MiniCalendar(props: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  maxDate: string;
}) {
  const initDate = new Date(props.value + "T12:00:00");
  const [viewYear, setViewYear] = createSignal(initDate.getFullYear());
  const [viewMonth, setViewMonth] = createSignal(initDate.getMonth());

  function prevMonth() {
    if (viewMonth() === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const max = new Date(props.maxDate + "T12:00:00");
    if (viewYear() === max.getFullYear() && viewMonth() >= max.getMonth()) return;
    if (viewMonth() === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells = createMemo(() => {
    const year = viewYear(), month = viewMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: Array<{ day: number | null; date: string | null }> = [];
    for (let i = 0; i < firstDow; i++) arr.push({ day: null, date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, date: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    }
    return arr;
  });

  const canNext = createMemo(() => {
    const max = new Date(props.maxDate + "T12:00:00");
    return !(viewYear() === max.getFullYear() && viewMonth() === max.getMonth());
  });

  const todayYMD = toYMD(new Date());

  return (
    <div class="mini-cal">
      <div class="mini-cal-header">
        <button class="mini-cal-nav" type="button" onClick={prevMonth}>‹</button>
        <span class="mini-cal-title">{RO_MONTHS_FULL[viewMonth()]} {viewYear()}</span>
        <button class="mini-cal-nav" type="button" onClick={nextMonth} disabled={!canNext()}>›</button>
      </div>
      <div class="mini-cal-grid">
        <For each={RO_DAYS_SHORT}>{(d) => <span class="mini-cal-dow">{d}</span>}</For>
        <For each={cells()}>
          {(cell) => {
            if (!cell.date) return <span />;
            const disabled = () =>
              cell.date! > props.maxDate ||
              (props.minDate !== undefined && cell.date! < props.minDate);
            return (
              <button
                type="button"
                class="mini-cal-day"
                classList={{
                  "mini-cal-day--selected": cell.date === props.value,
                  "mini-cal-day--today": cell.date === todayYMD && cell.date !== props.value,
                  "mini-cal-day--disabled": disabled(),
                }}
                disabled={disabled()}
                onClick={() => props.onChange(cell.date!)}
              >{cell.day}</button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

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
  numar_masina: string | null;
}

function emptyClientForm() {
  return { tip: "fizic" as "fizic" | "juridic", nume: "", description: "", cui: "", reprezentant: "", telefon: "", email: "", adresa: "", comments: "" };
}

type ClientForm = ReturnType<typeof emptyClientForm>;

const METODE = ["Platit cash", "Platit cu cardul", "Platit prin OP", "Platit Partial"];

/** Mapeaza valoarea stocata in DB (fara diacritice) la textul afisat (cu diacritice). */
function displayMetoda(m: string | null | undefined): string {
  switch (m) {
    case "Platit cash":        return "Plătit cash";
    case "Platit cu cardul":   return "Plătit cu cardul";
    case "Platit prin OP":     return "Plătit prin OP";
    case "Platit Partial":     return "Plătit parțial";
    case null: case undefined: case "": return "Neplătit";
    default: return m;
  }
}

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

function ClientSection(props: { receipt: Receipt; readOnly?: boolean }) {
  const r = () => props.receipt;
  const readOnly = () => props.readOnly === true;
  const [tipFilter, setTipFilter] = createSignal<"fizic" | "juridic" | null>(null);
  const [searchCui, setSearchCui] = createSignal("");
  const [searchNume, setSearchNume] = createSignal("");
  const [resultsCui, setResultsCui] = createSignal<ClientItem[]>([]);
  const [resultsNume, setResultsNume] = createSignal<ClientItem[]>([]);
  const [searchingCui, setSearchingCui] = createSignal(false);
  const [searchingNume, setSearchingNume] = createSignal(false);
  const [anafResult, setAnafResult] = createSignal<{ name: string; cui: string; adresa: string } | null>(null);
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);
  const [modalForm, setModalForm] = createSignal(emptyClientForm());
  const [saving, setSaving] = createSignal(false);
  const [modalError, setModalError] = createSignal<string | null>(null);

  // track whether a search was already triggered (to know when to show "no results")
  const [searchedCui, setSearchedCui] = createSignal(false);
  const [searchedNume, setSearchedNume] = createSignal(false);

  function clearSearch() {
    setSearchCui(""); setResultsCui([]); setAnafResult(null); setSearchedCui(false);
    setSearchNume(""); setResultsNume([]); setSearchedNume(false);
  }

  function changeTip(tip: "fizic" | "juridic") {
    setTipFilter(prev => prev === tip ? null : tip);
    clearSearch();
  }

  async function searchByCui() {
    const cui = searchCui().trim();
    if (!cui) return;
    setResultsCui([]); setAnafResult(null); setSearchedCui(false);
    setSearchingCui(true);
    try {
      const res = await apiFetch(`/api/clienti?cui=${encodeURIComponent(cui)}&limit=20`);
      if (!res.ok) return;
      const items: ClientItem[] = (await res.json()).items ?? [];
      setResultsCui(items);
      setSearchedCui(true);
      if (items.length === 0 && /^\d{4,10}$/.test(cui)) {
        fetchAnaf(cui);
      }
    } finally { setSearchingCui(false); }
  }

  async function fetchAnaf(cui: string) {
    setAnafLoading(true);
    try {
      const res = await apiFetch(`/api/companies/anaf/${cui}`);
      if (res.ok) {
        const d = await res.json();
        setAnafResult({ name: d.name ?? "", cui: String(d.cui ?? cui), adresa: d.address ?? "" });
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la interogarea ANAF.", "error");
    } finally {
      setAnafLoading(false);
    }
  }

  async function searchByNume() {
    const q = searchNume().trim();
    if (!q) return;
    setResultsNume([]); setSearchedNume(false);
    setSearchingNume(true);
    try {
      const tip = tipFilter();
      const url = `/api/clienti?q=${encodeURIComponent(q)}&limit=20${tip ? `&tip=${tip}` : ""}`;
      const res = await apiFetch(url);
      if (!res.ok) return;
      setResultsNume((await res.json()).items ?? []);
      setSearchedNume(true);
    } finally { setSearchingNume(false); }
  }

  async function assign(client: ClientItem) {
    await updateReceiptClient(r().id, client.id);
    clearSearch(); setEditing(false);
  }

  async function remove() {
    await updateReceiptClient(r().id, null);
    setEditing(false);
  }

  function openAddModalFromAnaf() {
    const af = anafResult();
    const form = emptyClientForm();
    form.tip = "juridic";
    if (af) { form.nume = af.name; form.cui = af.cui; form.adresa = af.adresa; }
    setModalForm(form); setModalError(null); setShowModal(true);
  }

  function openAddModal() {
    const form = emptyClientForm();
    form.tip = tipFilter() ?? "fizic";
    setModalForm(form); setModalError(null); setShowModal(true);
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

      <Show when={r().clientId !== null && !editing()}>
        <div class="rclient-assigned">
          <div class="rclient-name">
            {r().clientNume}
          </div>
          <Show when={!readOnly()}>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px" onClick={() => { clearSearch(); setEditing(true); }}>✎ Schimbă</button>
              <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px" onClick={remove}>✕ Elimină</button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!readOnly() && (r().clientId === null || editing())}>
        <div class="rclient-search-wrap">

          {/* Toggle tip persoana */}
          <div class="rclient-tip-toggle">
            <button class={`btn btn-sm ${tipFilter() === "fizic" ? "btn-primary" : "btn-ghost"}`} onClick={() => changeTip("fizic")}>Pers. fizică</button>
            <button class={`btn btn-sm ${tipFilter() === "juridic" ? "btn-primary" : "btn-ghost"}`} onClick={() => changeTip("juridic")}>Pers. juridică</button>
          </div>

          {/* CUI — doar pentru juridic */}
          <Show when={tipFilter() === "juridic"}>
            <div class="rclient-search-row">
              <input class="input" style="font-size:0.82rem" placeholder="CUI..." value={searchCui()}
                onInput={e => { setSearchCui(e.currentTarget.value); setResultsCui([]); setAnafResult(null); setSearchedCui(false); }}
                onKeyDown={e => e.key === "Enter" && searchByCui()}
              />
              <button class="btn btn-sm btn-ghost" disabled={searchingCui() || anafLoading()} onClick={searchByCui}>
                {searchingCui() ? "..." : "Caută"}
              </button>
            </div>
            <Show when={anafLoading()}>
              <div class="rclient-hint">Se interogează ANAF...</div>
            </Show>
            <Show when={!searchingCui() && resultsCui().length > 0}>
              <div class="rclient-results">
                <For each={resultsCui()}>
                  {(c) => (
                    <button class="rclient-result-item" onClick={() => assign(c)}>
                      <span class="rclient-result-name">{c.nume}</span>
                      <Show when={c.cui}><span class="rclient-result-meta">CUI {c.cui}</span></Show>
                    </button>
                  )}
                </For>
                <button class="btn btn-sm btn-ghost" style="font-size:0.78rem;width:100%;margin-top:2px" onClick={openAddModal}>+ Adaugă client nou</button>
              </div>
            </Show>
            <Show when={searchedCui() && !searchingCui() && resultsCui().length === 0 && !anafLoading()}>
              <div class="rclient-no-results">
                <span class="rclient-hint">{anafResult() === null ? "Niciun rezultat." : ""}</span>
                <Show when={anafResult() === null}>
                  <button class="btn btn-sm btn-ghost" style="font-size:0.78rem" onClick={openAddModal}>+ Adaugă client nou</button>
                </Show>
              </div>
            </Show>
            <Show when={anafResult() !== null}>
              <div class="rclient-anaf-suggest">
                <span class="rclient-hint" style="margin-bottom:2px">Găsit în ANAF:</span>
                <button class="rclient-result-item" onClick={openAddModalFromAnaf}>
                  <span class="rclient-result-name">{anafResult()!.name}</span>
                  <span class="rclient-result-meta">CUI {anafResult()!.cui} · click pentru a adăuga</span>
                </button>
              </div>
            </Show>
          </Show>

          {/* Nume */}
          <div class="rclient-search-row">
            <input class="input" style="font-size:0.82rem" placeholder="Nume..." value={searchNume()}
              onInput={e => { setSearchNume(e.currentTarget.value); setResultsNume([]); setSearchedNume(false); }}
              onKeyDown={e => e.key === "Enter" && searchByNume()}
            />
            <button class="btn btn-sm btn-ghost" disabled={searchingNume()} onClick={searchByNume}>
              {searchingNume() ? "..." : "Caută"}
            </button>
          </div>
          <Show when={!searchingNume() && resultsNume().length > 0}>
            <div class="rclient-results">
              <For each={resultsNume()}>
                {(c) => (
                  <button class="rclient-result-item" onClick={() => assign(c)}>
                    <span class="rclient-result-name">{c.nume}</span>
                    <Show when={c.cui}><span class="rclient-result-meta">CUI {c.cui}</span></Show>
                  </button>
                )}
              </For>
              <button class="btn btn-sm btn-ghost" style="font-size:0.78rem;width:100%;margin-top:2px" onClick={openAddModal}>+ Adaugă client nou</button>
            </div>
          </Show>
          <Show when={searchedNume() && !searchingNume() && resultsNume().length === 0}>
            <div class="rclient-no-results">
              <span class="rclient-hint">Niciun rezultat.</span>
              <button class="btn btn-sm btn-ghost" style="font-size:0.78rem" onClick={openAddModal}>+ Adaugă client nou</button>
            </div>
          </Show>

          <Show when={editing()}>
            <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;margin-top:2px;align-self:flex-start" onClick={() => { clearSearch(); setEditing(false); }}>← Înapoi</button>
          </Show>
        </div>
      </Show>

      {/* Modal adăugare client */}
      <Show when={showModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:420px;width:100%">
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

interface CazareBasic {
  id: number;
  data_checkin: string;
  data_checkout: string | null;
  numar_masina: string | null;
  successor_cazare_id: number | null;
  successor_montate_pe_masina: boolean | null;
}

function buildHotelImageProxyUrls() {
  const h = hotelImages();
  return {
    cazare:   h.cazare   ? `${API_BASE}/api/global-settings/hotel-anvelope/image/cazare`   : null,
    scoatere: h.scoatere ? `${API_BASE}/api/global-settings/hotel-anvelope/image/scoatere` : null,
    montare:  h.montare  ? `${API_BASE}/api/global-settings/hotel-anvelope/image/montare`  : null,
  };
}

async function fetchCompanyData(): Promise<CompanyData | null> {
  try {
    const res = await apiFetch("/api/companies?limit=1");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items?.length) return null;
    const co = data.items[0];
    return {
      name: co.name, cui: String(co.cui),
      address: co.address ?? null, nr_reg_com: co.nr_reg_com ?? null,
      phone: co.phone ?? null, tva_percentage: co.tva_percentage ?? null,
      logo_path: co.logo_path ?? null, background_path: co.background_path ?? null,
      website: co.website ?? null,
    };
  } catch { return null; }
}

function ReceiptCard(props: { receipt: Receipt }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = createSignal(false);
  type DeleteStage = "closed" | "select" | "final";
  const [deleteStage, setDeleteStage] = createSignal<DeleteStage>("closed");
  const [deletePending, setDeletePending] = createSignal(false);
  const [cazariSelected, setCazariSelected] = createSignal<Set<number>>(new Set());
  const [montajeSelected, setMontajeSelected] = createSignal<Set<number>>(new Set());
  const [cazariHotel, setCazariHotel] = createSignal<CazareBasic[]>([]);
  const [montajRoti, setMontajRoti] = createSignal<MontajRota[]>([]);
  const [montajPdfLoading, setMontajPdfLoading] = createSignal(false);

  createEffect(() => {
    if (!expanded()) return;
    apiFetch(`/api/cazare-anvelope?receipt_id=${props.receipt.id}&limit=10`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCazariHotel(data.items ?? []); })
      .catch(() => {});
    loadMontajRotiByReceipt(Number(props.receipt.id)).then(setMontajRoti).catch(() => {});
  });
  const [metodaDraft, setMetodaDraft] = createSignal(props.receipt.metodaPlata ?? "");
  const [partialDraft, setPartialDraft] = createSignal(
    props.receipt.partialPay?.toFixed(2) ?? "100.00"
  );
  const [saving, setSaving] = createSignal(false);
  const [docLoading, setDocLoading] = createSignal<string | null>(null);
  const [docError, setDocError] = createSignal<string | null>(null);
  const [showFactureazaModal, setShowFactureazaModal] = createSignal(false);
  const [factureazaPending, setFactureazaPending] = createSignal(false);
  const [factureazaError, setFactureazaError] = createSignal<string | null>(null);
  const [showSpvModal, setShowSpvModal] = createSignal(false);
  const [spvPending, setSpvPending] = createSignal(false);
  const [spvError, setSpvError] = createSignal<string | null>(null);
  const [hotelPdfLoading, setHotelPdfLoading] = createSignal<string | null>(null);
  const r = props.receipt;
  const live = createMemo<Receipt>(() => receipts().find((x) => x.id === r.id) ?? r);

  function openSpvModal() {
    setSpvError(null);
    setShowSpvModal(true);
  }

  async function handleSpvConfirm() {
    setSpvError(null);
    setSpvPending(true);
    try {
      await uploadToSpv(r.id);
      setShowSpvModal(false);
      // SSE-ul va reincarca statusul; intre timp, marcam optimist statusul
      // ca sa se actualizeze instant butonul.
    } catch (e: any) {
      setSpvError(e?.message ?? "Eroare la trimiterea in SPV.");
    } finally {
      setSpvPending(false);
    }
  }

  async function handleSpvRetry() {
    try {
      await retryEFactura(r.id);
    } catch (e: any) {
      setDocError(e?.message ?? "Eroare la reincercare.");
    }
  }

  async function handleMontajPdf() {
    if (montajPdfLoading()) return;
    setMontajPdfLoading(true);
    try {
      const [company] = await Promise.all([fetchCompanyData(), loadMontareRotiImages()]);
      const montareImgs = buildMontareRotiProxyUrls();
      const rows: MontajRotaRow[] = montajRoti().map((m) => ({
        pozitie: m.pozitie,
        presiune: m.presiune,
        marcaNume: m.marcaNume,
        dimensiuneValoare: m.dimensiuneValoare,
        profilValoare: m.profilValoare,
        dotValoare: m.dotValoare,
        tip: m.tip,
        adancime: m.adancime,
        cupluStrangere: m.cupluStrangere,
        indiceViteza: m.indiceViteza,
        indiceSarcina: m.indiceSarcina,
        imageUrl: montareImgs[m.pozitie as PozitieRoata] ?? null,
      }));
      await generateMontajRoti(r, company, rows, r.vehicol ?? null);
    } finally { setMontajPdfLoading(false); }
  }

  // Pasul 1 al ștergerii: încarcă cazările și montajele legate (poate cardul
  // nu a fost extins niciodată), bifează tot implicit și deschide modalul
  // potrivit. Dacă nu există nimic legat, sare direct la confirmarea finală.
  async function handleDeleteClick() {
    try {
      const [cazariRes, montaje] = await Promise.all([
        apiFetch(`/api/cazare-anvelope?receipt_id=${r.id}&limit=10`)
          .then((res) => (res.ok ? res.json() : { items: [] })),
        loadMontajRotiByReceipt(Number(r.id)),
      ]);
      setCazariHotel(cazariRes.items ?? []);
      setMontajRoti(montaje);
    } catch {
      // Continuă chiar și la eroare — utilizatorul poate șterge bonul orfan.
    }
    setCazariSelected(new Set(cazariHotel().map((c) => c.id)));
    setMontajeSelected(new Set(montajRoti().map((m) => m.id)));
    setDeleteStage(cazariHotel().length === 0 && montajRoti().length === 0 ? "final" : "select");
  }

  function toggleCazareSelected(id: number) {
    const s = new Set(cazariSelected());
    if (s.has(id)) s.delete(id); else s.add(id);
    setCazariSelected(s);
  }
  function toggleMontajSelected(id: number) {
    const s = new Set(montajeSelected());
    if (s.has(id)) s.delete(id); else s.add(id);
    setMontajeSelected(s);
  }

  // Pasul final: șterge cazările bifate, apoi montajele bifate, apoi bonul.
  // Continuă chiar dacă unele cereri eșuează — la final raportează erorile.
  async function handleConfirmDelete() {
    if (deletePending()) return;
    setDeletePending(true);
    let failed = 0;
    try {
      for (const id of cazariSelected()) {
        try {
          const res = await apiFetch(`/api/cazare-anvelope/${id}`, { method: "DELETE" });
          if (!res.ok) failed++;
        } catch { failed++; }
      }
      for (const id of montajeSelected()) {
        try {
          const res = await apiFetch(`/api/montaj-roti/${id}`, { method: "DELETE" });
          if (!res.ok) failed++;
        } catch { failed++; }
      }
      await deleteReceipt(r.id);
      if (failed > 0) {
        notify(`Bonul a fost șters, dar ${failed} element(e) legate nu au putut fi șterse.`, "error");
      }
      setDeleteStage("closed");
    } catch (e) {
      notify(`Eroare la ștergere: ${e instanceof Error ? e.message : "necunoscută"}`, "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleHotelPdf(cazareId: number, type: "checkin" | "checkout" | "combined") {
    const key = `${cazareId}-${type}`;
    setHotelPdfLoading(key);
    try {
      const [full, company] = await Promise.all([getCazareById(cazareId), fetchCompanyData(), loadHotelImages()]);
      if (!full) return;
      const imgs = buildHotelImageProxyUrls();
      const vehicle = r.vehicol ?? null;
      if (type === "checkin") {
        await generateCazareCheckin(full, company, imgs, vehicle);
      } else if (type === "checkout") {
        await generateCazareCheckout(full, company, imgs, vehicle);
      } else {
        if (full.successorCazareId == null || !full.dataCheckout) return;
        const successor = await getCazareById(full.successorCazareId);
        if (!successor) return;
        await generateCazareScoatereIntroducere(
          full,
          successor,
          company,
          full.dataCheckout,
          full.successorMontatePeMasina ?? successor.montatePeMasina ?? false,
          imgs,
          vehicle,
        );
      }
    } finally { setHotelPdfLoading(null); }
  }


  function openFactureazaModal() {
    setFactureazaError(null);
    setShowFactureazaModal(true);
  }

  async function handleFactureazaConfirm() {
    setFactureazaError(null);
    const locationId = device()?.locationId;
    if (!locationId) { setFactureazaError("Dispozitivul nu are o locație configurată."); return; }
    setFactureazaPending(true);
    try {
      await assignFacturaNumber(r.id, locationId);
      setShowFactureazaModal(false);
    } catch (e: any) {
      setFactureazaError(e?.message ?? "Eroare la alocarea numărului de factură.");
    } finally {
      setFactureazaPending(false);
    }
  }

  async function handleFdlPdf() {
    setDocError(null);
    setDocLoading("fdl");
    try {
      const company = await fetchCompanyData();
      await generateFisaDeLucru(r, company, generalSettings()?.fdlDisclaimerText ?? null);
    } catch (e: any) {
      setDocError(e?.message ?? "Eroare la generarea Fișei de Lucru.");
    } finally {
      setDocLoading(null);
    }
  }

  const [convertPending, setConvertPending] = createSignal(false);
  const [showConvertConfirm, setShowConvertConfirm] = createSignal(false);
  async function handleConvertFdl() {
    if (convertPending()) return;
    setConvertPending(true);
    try {
      await convertFdlToDeviz(r.id);
      setShowConvertConfirm(false);
      notify("Fișa de Lucru a fost transformată în deviz.", "success");
    } catch (e: any) {
      setDocError(e?.message ?? "Eroare la conversie.");
    } finally {
      setConvertPending(false);
    }
  }

  const [finalizePending, setFinalizePending] = createSignal(false);
  async function handleFinalizeFdl() {
    if (finalizePending()) return;
    setFinalizePending(true);
    try {
      await finalizeFdl(r.id);
      notify("Fișa de Lucru a fost finalizată.", "success");
    } catch (e: any) {
      setDocError(e?.message ?? "Eroare la finalizare.");
    } finally {
      setFinalizePending(false);
    }
  }

  async function handleDocDownload(docType: "deviz" | "factura" | "chitanta") {
    setDocError(null);
    const locationId = device()?.locationId;
    if (!locationId) { setDocError("Dispozitivul nu are o locație configurată."); return; }
    setDocLoading(docType);
    try {
      const res = await apiFetch(`/api/receipts/${r.id}/assign-number`, {
        method: "POST",
        body: JSON.stringify({ doc_type: docType, location_id: locationId }),
      });
      if (!res.ok) {
        const msg = await readApiError(res, "Eroare la generarea documentului.");
        setDocError(msg);
        return;
      }
      const ctx: DocContext = await res.json();
      applyDocNumber(r.id, docType, ctx.serie, ctx.nr);
      if (docType === "deviz") {
        // Anexam corpul Montare Roti la sfarsitul deviz-ului daca receiptul are date.
        const montajList = await loadMontajRotiByReceipt(Number(r.id)).catch(() => [] as MontajRota[]);
        let montajRows: MontajRotaRow[] | undefined;
        if (montajList.length > 0) {
          await loadMontareRotiImages();
          const montareImgs = buildMontareRotiProxyUrls();
          montajRows = montajList.map((m) => ({
            pozitie: m.pozitie,
            presiune: m.presiune,
            marcaNume: m.marcaNume,
            dimensiuneValoare: m.dimensiuneValoare,
            profilValoare: m.profilValoare,
            dotValoare: m.dotValoare,
            tip: m.tip,
            adancime: m.adancime,
            cupluStrangere: m.cupluStrangere,
            indiceViteza: m.indiceViteza,
            indiceSarcina: m.indiceSarcina,
            imageUrl: montareImgs[m.pozitie as PozitieRoata] ?? null,
          }));
        }
        await generateDeviz(r, ctx, generalSettings()?.afiseazaTehnicianDeviz === true, undefined, montajRows);
      }
      else if (docType === "factura") await generateFactura(r, ctx);
      else if (docType === "chitanta") await generateChitanta(r, ctx);
    } catch (e: any) {
      setDocError(e?.message ?? "Eroare necunoscută.");
    } finally {
      setDocLoading(null);
    }
  }

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
  const updatedDate = r.updatedAt ? new Date(r.updatedAt) : null;
  const isUpdated = updatedDate && updatedDate > date;
  const updatedDateStr = isUpdated ? updatedDate!.toLocaleDateString("ro-RO") : null;
  const updatedTimeStr = isUpdated ? updatedDate!.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : null;

  const isFdl = createMemo(() => live().source === "fdl");

  return (
    <div class="rcard" classList={{ "rcard--open": expanded(), "rcard--fdl": isFdl() }}>
      {/* Header card — click pentru expand */}
      <div
        class="rcard-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded()}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setExpanded((v) => !v))}
      >
        <div class="rcard-info">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <Show when={isFdl()}>
              <span class="rcard-fdl-badge" title="Fișă de Lucru — estimare, nu intră în totaluri">FDL</span>
            </Show>
            <span class="rcard-titlu">{r.titlu}</span>
            <Show when={r.clientNume}>
              <span style="font-size:12px;color:var(--text-muted);font-weight:400">{r.clientNume}</span>
            </Show>
            <Show when={live().devizNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--deviz">D {live().devizSerie}{live().devizNr}</span>
            </Show>
            <Show when={live().facturaNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--factura">F {live().facturaSerie}{live().facturaNr}</span>
            </Show>
            <Show when={live().chitantaNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--chitanta">C {live().chitantaSerie}{live().chitantaNr}</span>
            </Show>
          </div>
          <span class="rcard-meta">
            {dateStr} {timeStr}
            <Show when={isUpdated}>
              <span style="margin-left:6px;color:var(--text-muted)">· upd. {updatedDateStr} {updatedTimeStr}</span>
            </Show>
          </span>
        </div>
        <div class="rcard-right">
          <div class="rcard-right-col">
            <span class="rcard-total">{r.total.toFixed(2)} lei</span>
            <Show
              when={!isFdl()}
              fallback={<span class="rcard-fdl-badge" style="font-size:0.6rem">Estimare</span>}
            >
              <span class="rcard-metoda" classList={{ "rcard-metoda--neplatit": !r.metodaPlata }}>
                {displayMetoda(r.metodaPlata)}
              </span>
            </Show>
          </div>
          <Show when={!live().metodaPlata && !live().efacturaLocked}>
            <button
              class="btn btn-sm btn-primary rcard-continua-btn"
              onClick={(e) => {
                e.stopPropagation();
                setResume({
                  id: r.id,
                  titlu: r.titlu,
                  descriere: r.descriere ?? "",
                  dateTehn: r.dateTehn ?? "",
                  items: r.items,
                  clientId: r.clientId,
                  clientNume: r.clientNume,
                  clientCui: r.clientCui,
                  clientTip: r.clientTip,
                  vehicol: r.vehicol ?? null,
                  source: live().source,
                  constatari: live().constatari ?? null,
                  sugestii: live().sugestii ?? null,
                  timpEstimatOre: live().timpEstimatOre ?? null,
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

            <Show when={isFdl() && live().constatari?.trim()}>
              <div class="rcard-fdl-section">
                <div class="rcard-fdl-section-title">Constatări</div>
                <ul class="rcard-fdl-list">
                  <For each={(live().constatari ?? "").split(/\r?\n/).filter((l) => l.trim())}>
                    {(linie) => <li>{linie}</li>}
                  </For>
                </ul>
              </div>
            </Show>

            <div class="receipt-items">
              <For each={r.items}>
                {(item, index) => (
                  <div class="receipt-item">
                    <span class="receipt-item-name">{index() + 1}. {item.name}</span>
                    <span class="receipt-item-qty">{item.qty} x {item.price.toFixed(2)}</span>
                    <span class="receipt-item-total">{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="receipt-divider" />

            <div class="receipt-total">
              <span>{isFdl() ? "TOTAL ESTIMAT" : "TOTAL"}</span>
              <span>{r.total.toFixed(2)} lei</span>
            </div>

            <Show when={isFdl() && live().timpEstimatOre != null && live().timpEstimatOre! > 0}>
              <div class="receipt-plata">
                <span>Timp estimat manoperă</span>
                <span>{live().timpEstimatOre!.toFixed(2)} ore</span>
              </div>
            </Show>

            <Show when={isFdl() && live().sugestii?.trim()}>
              <div class="rcard-fdl-section">
                <div class="rcard-fdl-section-title">Sugestii / Recomandări</div>
                <div class="rcard-fdl-text">{live().sugestii}</div>
              </div>
            </Show>

            {!isFdl() && r.metodaPlata && (
              <div class="receipt-plata">
                <span>Metodă de plată</span>
                <span>{displayMetoda(r.metodaPlata)}</span>
              </div>
            )}

            <div class="receipt-divider receipt-divider--dashed" />

            <div class="receipt-actions">
              {/* Documente: butoanele de descarcare PDF */}
              <div class="receipt-actions-group">
                <div class="receipt-actions-label">Documente:</div>
                <div class="receipt-actions-row">
                  <Show when={isFdl()}>
                    <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={handleFdlPdf}>
                      {docLoading() === "fdl" ? "..." : "Fișă de Lucru"}
                    </button>
                  </Show>
                  <Show when={!isFdl()}>
                    <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("deviz")}>
                      {docLoading() === "deviz" ? "..." : "Deviz"}
                    </button>
                  </Show>
                  <Show when={!isFdl() && generalSettings()?.useFactura !== false && live().facturaNr > 0}>
                    <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("factura")}>
                      {docLoading() === "factura" ? "..." : "Factură"}
                    </button>
                  </Show>
                  <Show when={!isFdl() && generalSettings()?.useFactura !== false && live().facturaNr > 0 && (live().metodaPlata === "Platit cash" || live().metodaPlata === "Platit Partial")}>
                    <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("chitanta")}>
                      {docLoading() === "chitanta" ? "..." : "Chitanță"}
                    </button>
                  </Show>
                </div>
              </div>

              {/* Procese FDL: finalizare + conversie în deviz */}
              <Show when={isFdl()}>
                <div class="receipt-actions-group">
                  <div class="receipt-actions-label">Procese:</div>
                  <div class="receipt-actions-row">
                    <Show when={!live().fdlFinalizedAt}>
                      <button
                        class="btn btn-sm"
                        style="background:#28a745;border-color:#28a745;color:#fff"
                        disabled={finalizePending()}
                        onClick={handleFinalizeFdl}
                        title="Marchează FDL-ul ca finalizat — după finalizare nu mai apare în „AZI” decât dacă filtrul de dată îl prinde explicit"
                      >
                        {finalizePending() ? "..." : "Finalizare fisa de lucru"}
                      </button>
                    </Show>
                    <Show when={live().fdlFinalizedAt}>
                      <span class="rcard-fdl-badge" style="font-size:0.65rem;background:#28a745" title={`Finalizat ${new Date(live().fdlFinalizedAt!).toLocaleString("ro-RO")}`}>
                        Finalizat
                      </span>
                    </Show>
                    <button
                      class="btn btn-primary btn-sm"
                      disabled={convertPending()}
                      onClick={() => setShowConvertConfirm(true)}
                      title="Transformă această estimare într-un deviz real (intră în totaluri și rapoarte)"
                    >
                      Transformă în deviz
                    </button>
                  </div>
                </div>
              </Show>

              {/* Procese deviz: actiuni care schimba starea (facturare, trimitere ANAF) */}
              <Show when={!isFdl() && generalSettings()?.useFactura !== false}>
                <div class="receipt-actions-group">
                  <div class="receipt-actions-label">Procese:</div>
                  <div class="receipt-actions-row">
                    <Show when={live().devizNr > 0 && live().facturaNr === 0}>
                      <button
                        class="btn btn-primary btn-sm"
                        disabled={docLoading() !== null}
                        onClick={openFactureazaModal}
                        title="Alocă număr de factură pe baza devizului existent"
                      >
                        Facturează
                      </button>
                    </Show>

                    {/* Info: facturarea s-a facut deja */}
                    <Show when={live().facturaNr > 0}>
                      <span class="rcard-spv-badge rcard-spv-badge--muted" title={`Factura nr. ${live().facturaNr} alocată`}>
                        Facturat
                      </span>
                    </Show>

                    {/* Trimite in SPV — apare doar daca factura e alocata */}
                    <Show when={live().facturaNr > 0}>
                      <Show when={live().efacturaStatus === null || (live().efacturaStatus === "error" && live().efacturaIndexIncarcare === null)}>
                        <button
                          class="btn btn-spv btn-sm"
                          onClick={openSpvModal}
                          title="Trimite factura electronică către ANAF SPV"
                        >
                          Trimite în SPV
                        </button>
                      </Show>
                      <Show when={live().efacturaStatus === "pending_upload"}>
                        <span class="rcard-spv-badge rcard-spv-badge--pending" title="Upload în curs către ANAF">
                          Se trimite...
                        </span>
                      </Show>
                      <Show when={live().efacturaStatus === "in_prelucrare"}>
                        <span class="rcard-spv-badge rcard-spv-badge--info" title="ANAF a primit factura și o validează">
                          În procesare ANAF
                        </span>
                      </Show>
                      <Show when={live().efacturaStatus === "accepted"}>
                        <span class="rcard-spv-badge rcard-spv-badge--success" title="Factură acceptată de ANAF">
                          Acceptat ANAF
                        </span>
                      </Show>
                      <Show when={live().efacturaStatus === "rejected"}>
                        <span class="rcard-spv-badge rcard-spv-badge--danger" title={live().efacturaError ?? "Factură respinsă de ANAF"}>
                          Respins ANAF
                        </span>
                        <button class="btn btn-danger btn-sm" onClick={handleSpvRetry}>
                          Reîncearcă
                        </button>
                      </Show>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Administrare: actiuni de gestiune (stergere etc) */}
              <Show when={adminVisible() && !live().efacturaLocked}>
                <div class="receipt-actions-group">
                  <div class="receipt-actions-label">Administrare:</div>
                  <div class="receipt-actions-row">
                    <button class="btn btn-danger-outline btn-sm" onClick={handleDeleteClick}>
                      Șterge
                    </button>
                  </div>
                </div>
              </Show>
            </div>
            <Show when={live().efacturaStatus === "error" && live().efacturaError}>
              <p class="cfg-error" role="alert" style="margin-top:6px">
                Eroare ANAF: {live().efacturaError}
              </p>
            </Show>
            <Show when={docError()}>
              <p class="cfg-error" role="alert" style="margin-top:6px">{docError()}</p>
            </Show>

          </div>

          {/* Coloana dreapta */}
          <div class="rcard-extra-col">
            <ClientSection receipt={r} readOnly={live().efacturaLocked || !!live().metodaPlata} />
            {/* Status plata — ascuns pentru FDL (estimare, nu se incaseaza) */}
            <Show when={!isFdl()}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Status plată</div>
                <select
                  class="rcard-plata-select"
                  value={metodaDraft()}
                  onChange={(e) => setMetodaDraft(e.currentTarget.value)}
                >
                  <option value="">Neplătit</option>
                  <For each={METODE}>
                    {(m) => <option value={m}>{displayMetoda(m)}</option>}
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
            </Show>

            <Show when={!!r.descriere}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Descriere</div>
                <div class="rcard-extra-text">{r.descriere}</div>
              </div>
            </Show>
            <Show when={!!r.dateTehn}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Observații</div>
                <div class="rcard-extra-text">{r.dateTehn}</div>
              </div>
            </Show>
            <Show when={!!r.vehicol}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Vehicul</div>
                <div style="font-size:13px;display:grid;gap:3px">
                  <strong>{r.vehicol!.numarMasina}</strong>
                  <Show when={r.vehicol!.marca || r.vehicol!.model}>
                    <span>{[r.vehicol!.marca, r.vehicol!.model].filter(Boolean).join(" ")}</span>
                  </Show>
                  <Show when={r.vehicol!.numarKilometrii != null}>
                    <span>Km: {r.vehicol!.numarKilometrii!.toLocaleString("ro-RO")}</span>
                  </Show>
                  <Show when={r.vehicol!.vin}>
                    <span style="font-size:11px;color:var(--text-muted)">VIN: {r.vehicol!.vin}</span>
                  </Show>
                  <Show when={r.vehicol!.observatii}>
                    <span style="color:var(--text-muted);white-space:pre-wrap">{r.vehicol!.observatii}</span>
                  </Show>
                </div>
              </div>
            </Show>
            <Show when={cazariHotel().length > 0}>
              {(() => {
                const fmtDate = (ymd: string) =>
                  new Date(ymd + "T12:00:00").toLocaleDateString("ro-RO");
                const luni = (c: CazareBasic) => {
                  if (!c.data_checkout) return null;
                  const a = new Date(c.data_checkin + "T12:00:00");
                  const b = new Date(c.data_checkout + "T12:00:00");
                  const diff = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
                  const zile = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
                  if (diff === 0) return `${zile} ${zile === 1 ? "zi" : "zile"}`;
                  const extra = Math.round(zile - diff * 30.44);
                  return extra > 0
                    ? `${diff} ${diff === 1 ? "lună" : "luni"} și ${extra} zile`
                    : `${diff} ${diff === 1 ? "lună" : "luni"}`;
                };
                const pdfBtnStyle = "font-size:11px;color:var(--accent);background:none;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer;line-height:1.4";
                const isLoading = (id: number, type: string) => hotelPdfLoading() === `${id}-${type}`;
                const list = cazariHotel();
                const activeCazare = list.find((c) => !c.data_checkout);
                const closedCazari = list.filter((c) => c.data_checkout);
                const cazareForCheckin = activeCazare ?? closedCazari[0] ?? list[0];
                const cazareForCheckout = closedCazari[0];
                const cazareForCombined = closedCazari.find((c) => c.successor_cazare_id != null);
                return (
                  <div class="rcard-extra-card">
                    <div class="rcard-extra-title">Hotel Anvelope</div>
                    <div style="display:flex;flex-direction:column;gap:4px">
                      <For each={list}>
                        {(c) => (
                          <button
                            style="font-size:13px;color:var(--accent);text-decoration:underline;cursor:pointer;background:none;border:none;padding:0;text-align:left;line-height:1.5"
                            onClick={() => navigate(`/hotel-anvelope?viewCazare=${c.id}`)}
                          >
                            {c.data_checkout ? "Scoatere" : "Cazare"}
                            <span style="font-size:11px;color:var(--text-muted);margin-left:6px;text-decoration:none">
                              {c.data_checkout
                                ? `${fmtDate(c.data_checkin)} → ${fmtDate(c.data_checkout)} · ${luni(c)}`
                                : fmtDate(c.data_checkin)}
                            </span>
                          </button>
                        )}
                      </For>
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
                        <Show when={cazareForCheckin}>
                          {(c) => (
                            <button style={pdfBtnStyle} disabled={isLoading(c().id, "checkin")} onClick={() => handleHotelPdf(c().id, "checkin")}>
                              {isLoading(c().id, "checkin") ? "..." : "PDF Cazare"}
                            </button>
                          )}
                        </Show>
                        <Show when={cazareForCheckout}>
                          {(c) => (
                            <button style={pdfBtnStyle} disabled={isLoading(c().id, "checkout")} onClick={() => handleHotelPdf(c().id, "checkout")}>
                              {isLoading(c().id, "checkout") ? "..." : "PDF Scoatere"}
                            </button>
                          )}
                        </Show>
                        <Show when={cazareForCombined}>
                          {(c) => (
                            <button style={pdfBtnStyle} disabled={isLoading(c().id, "combined")} onClick={() => handleHotelPdf(c().id, "combined")}>
                              {isLoading(c().id, "combined") ? "..." : "PDF Scoatere + Cazare"}
                            </button>
                          )}
                        </Show>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Show>
            <Show when={montajRoti().length > 0}>
              <div class="rcard-extra-card">
                <div class="rcard-extra-title">Roți Montate</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <span style="font-size:13px">
                    {montajRoti().length} {montajRoti().length === 1 ? "roată" : "roți"}
                  </span>
                  <button
                    class="btn btn-ghost btn-sm"
                    disabled={montajPdfLoading()}
                    onClick={handleMontajPdf}
                  >
                    {montajPdfLoading() ? "..." : "PDF Montaj"}
                  </button>
                </div>
              </div>
            </Show>
          </div>

          </div>
        </div>
      </Show>

      {/* Modal pasul 1: selectează elementele legate (cazări + montaje) */}
      <Show when={deleteStage() === "select"}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:520px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Sterge bon — elemente legate</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setDeleteStage("closed")}>✕</button>
            </div>
            <div style="padding:0 16px 8px">
              <p style="font-size:0.88rem;margin-bottom:10px">
                Bonul <strong>{r.titlu}</strong> are elemente legate. Bifează ce vrei să se șteargă împreună cu bonul (debifează ce vrei să păstrezi):
              </p>

              <Show when={cazariHotel().length > 0}>
                <div style="margin-bottom:12px">
                  <div style="font-weight:600;font-size:0.85rem;margin-bottom:6px;color:var(--text-muted)">Cazări Hotel Anvelope</div>
                  <For each={cazariHotel()}>{(c) => (
                    <label style="display:flex;gap:8px;align-items:center;padding:6px 0;cursor:pointer;font-size:0.85rem">
                      <input
                        type="checkbox"
                        checked={cazariSelected().has(c.id)}
                        onChange={() => toggleCazareSelected(c.id)}
                      />
                      <span>
                        {c.numar_masina ?? "fără număr"} · check-in {c.data_checkin}
                        {c.data_checkout ? ` · check-out ${c.data_checkout}` : " · încă în hotel"}
                      </span>
                    </label>
                  )}</For>
                </div>
              </Show>

              <Show when={montajRoti().length > 0}>
                <div style="margin-bottom:12px">
                  <div style="font-weight:600;font-size:0.85rem;margin-bottom:6px;color:var(--text-muted)">Montaje roți</div>
                  <For each={montajRoti()}>{(m) => (
                    <label style="display:flex;gap:8px;align-items:center;padding:6px 0;cursor:pointer;font-size:0.85rem">
                      <input
                        type="checkbox"
                        checked={montajeSelected().has(m.id)}
                        onChange={() => toggleMontajSelected(m.id)}
                      />
                      <span>
                        Poziție {m.pozitie}
                        {m.marcaNume ? ` · ${m.marcaNume}` : ""}
                        {m.dimensiuneValoare ? ` · ${m.dimensiuneValoare}` : ""}
                        {m.profilValoare ? ` ${m.profilValoare}` : ""}
                      </span>
                    </label>
                  )}</For>
                </div>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setDeleteStage("closed")}>Anuleaza</button>
              <button class="btn btn-primary btn-sm" onClick={() => setDeleteStage("final")}>Continuă</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal Facturează: confirmare alocare număr factură pe baza devizului */}
      <Show when={showFactureazaModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Generează factură din deviz</span>
              <button
                class="btn btn-ghost btn-sm"
                disabled={factureazaPending()}
                onClick={() => setShowFactureazaModal(false)}
              >✕</button>
            </div>
            <Show
              when={live().clientId !== null}
              fallback={
                <>
                  <div style="padding:0 16px 8px;font-size:0.88rem">
                    <p class="cfg-error" role="alert" style="margin:0 0 10px">
                      Nu poți emite o factură fără client.
                    </p>
                    <p style="margin:0 0 10px">
                      Bonul <strong>{r.titlu}</strong> nu are un client asociat. O factură fiscală
                      trebuie să conțină datele cumpărătorului (nume, CUI/CNP, adresă).
                    </p>
                    <p style="margin:0;color:var(--text-muted)">
                      Pentru a continua, extinde cardul bonului și folosește secțiunea
                      <strong> „Client" </strong> pentru a căuta sau adăuga un client. După
                      asociere, revino aici și apasă din nou <strong>Facturează</strong>.
                    </p>
                  </div>
                  <div class="sl-modal-footer">
                    <button
                      class="btn btn-primary btn-sm"
                      onClick={() => setShowFactureazaModal(false)}
                    >Am înțeles</button>
                  </div>
                </>
              }
            >
              <div style="padding:0 16px 8px;font-size:0.88rem">
                <p style="margin-bottom:10px">
                  Se va aloca un număr nou de factură din registrul locației pentru bonul:
                </p>
                <ul style="margin:0 0 12px 16px;padding:0">
                  <li><strong>{r.titlu}</strong></li>
                  <li>
                    Deviz:&nbsp;
                    <span class="rcard-doc-tag rcard-doc-tag--deviz" style="display:inline-block">
                      D {live().devizSerie}{live().devizNr}
                    </span>
                  </li>
                  <li>Client: <strong>{live().clientNume}</strong></li>
                  <li>Total: <strong>{r.total.toFixed(2)} lei</strong></li>
                </ul>
                <p style="color:var(--text-muted);margin:0">
                  După confirmare, bonul va fi marcat ca facturat. Acțiunea este ireversibilă —
                  numărul de factură nu poate fi reutilizat.
                </p>
                <Show when={factureazaError()}>
                  <p class="cfg-error" role="alert" style="margin-top:10px">{factureazaError()}</p>
                </Show>
              </div>
              <div class="sl-modal-footer">
                <button
                  class="btn btn-ghost btn-sm"
                  disabled={factureazaPending()}
                  onClick={() => setShowFactureazaModal(false)}
                >Anulează</button>
                <button
                  class="btn btn-primary btn-sm"
                  disabled={factureazaPending()}
                  onClick={handleFactureazaConfirm}
                >{factureazaPending() ? "Se generează..." : "Confirmă și facturează"}</button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Modal Transformă FDL în deviz */}
      <Show when={showConvertConfirm()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Transformă în deviz</span>
              <button
                class="btn btn-ghost btn-sm"
                disabled={convertPending()}
                onClick={() => setShowConvertConfirm(false)}
              >✕</button>
            </div>
            <div style="padding:0 16px 8px;font-size:0.88rem">
              <p style="margin-bottom:10px">
                Fișa de Lucru <strong>{r.titlu}</strong> va deveni un deviz real.
              </p>
              <ul style="margin:0 0 12px 16px;padding:0;color:var(--text-muted)">
                <li>Va intra în totalurile zilei și în rapoarte.</li>
                <li>Poți aloca număr de deviz / factură ca pentru orice deviz normal.</li>
                <li>Constatările, sugestiile și timpul estimat sunt păstrate ca istoric.</li>
              </ul>
              <p style="color:var(--text-muted);margin:0">
                Acțiunea este reversibilă doar prin ștergerea bonului.
              </p>
            </div>
            <div class="sl-modal-footer">
              <button
                class="btn btn-ghost btn-sm"
                disabled={convertPending()}
                onClick={() => setShowConvertConfirm(false)}
              >Anulează</button>
              <button
                class="btn btn-primary btn-sm"
                disabled={convertPending()}
                onClick={handleConvertFdl}
              >{convertPending() ? "Se transformă..." : "Transformă în deviz"}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal Trimite în SPV */}
      <Show when={showSpvModal()}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Trimite factura în SPV (ANAF)</span>
              <button
                class="btn btn-ghost btn-sm"
                disabled={spvPending()}
                onClick={() => setShowSpvModal(false)}
              >✕</button>
            </div>
            <div style="padding:0 16px 8px;font-size:0.88rem">
              <p style="margin-bottom:10px">
                Se va trimite factura electronică (UBL 2.1) către ANAF — Spațiul Privat Virtual.
              </p>
              <ul style="margin:0 0 12px 16px;padding:0">
                <li><strong>{r.titlu}</strong></li>
                <li>
                  Factura:&nbsp;
                  <span class="rcard-doc-tag rcard-doc-tag--factura" style="display:inline-block">
                    F {live().facturaSerie}{live().facturaNr}
                  </span>
                </li>
                <li>Client: <strong>{live().clientNume ?? "—"}</strong></li>
                <li>Total: <strong>{r.total.toFixed(2)} lei</strong></li>
              </ul>
              <p style="color:var(--text-muted);margin:0">
                După trimitere, bonul va fi <strong>blocat</strong> — nu va mai putea fi editat
                (cu excepția metodei de plată). Procesarea ANAF durează între câteva secunde și câteva
                minute; status-ul se actualizează automat.
              </p>
              <Show when={spvError()}>
                <p class="cfg-error" role="alert" style="margin-top:10px">{spvError()}</p>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button
                class="btn btn-ghost btn-sm"
                disabled={spvPending()}
                onClick={() => setShowSpvModal(false)}
              >Anulează</button>
              <button
                class="btn btn-primary btn-sm"
                disabled={spvPending()}
                onClick={handleSpvConfirm}
              >{spvPending() ? "Se trimite..." : "Confirmă trimiterea"}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal pasul 2: confirmare finală */}
      <Show when={deleteStage() === "final"}>
        <div class="sl-modal-overlay">
          <div class="sl-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Confirmare ștergere</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setDeleteStage("closed")}>✕</button>
            </div>
            <div style="padding:0 16px 8px;font-size:0.88rem">
              <p style="margin-bottom:8px">Vei șterge definitiv:</p>
              <ul style="margin:0 0 8px 16px;padding:0">
                <li><strong>Bonul {r.titlu}</strong></li>
                <Show when={cazariSelected().size > 0}>
                  <li><strong>{cazariSelected().size}</strong> cazare(i) Hotel Anvelope</li>
                </Show>
                <Show when={montajeSelected().size > 0}>
                  <li><strong>{montajeSelected().size}</strong> montaj(e) roți</li>
                </Show>
              </ul>
              <p style="color:var(--text-muted)">Acțiunea este ireversibilă.</p>
            </div>
            <div class="sl-modal-footer">
              <button
                class="btn btn-ghost btn-sm"
                disabled={deletePending()}
                onClick={() => {
                  if (cazariHotel().length > 0 || montajRoti().length > 0) setDeleteStage("select");
                  else setDeleteStage("closed");
                }}
              >Înapoi</button>
              <button
                class="btn btn-danger btn-sm"
                disabled={deletePending()}
                onClick={handleConfirmDelete}
              >{deletePending() ? "Se șterge..." : "Sterge definitiv"}</button>
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

  const todayYMD = toYMD(new Date());
  const [dateStart, setDateStart] = createSignal(todayYMD);
  const [dateEnd, setDateEnd] = createSignal(todayYMD);
  const [showDateModal, setShowDateModal] = createSignal(false);
  const [draftStart, setDraftStart] = createSignal(todayYMD);
  const [draftEnd, setDraftEnd] = createSignal(todayYMD);

  const dateRangeLabel = createMemo(() => {
    if (dateStart() === todayYMD && dateEnd() === todayYMD) return "AZI";
    if (dateStart() === dateEnd()) return fmtDateShort(dateStart());
    return `${fmtDateShort(dateStart())} - ${fmtDateShort(dateEnd())}`;
  });

  function openDateModal() {
    setDraftStart(dateStart());
    setDraftEnd(dateEnd());
    setShowDateModal(true);
  }

  function applyDateFilter() {
    setDateStart(draftStart());
    setDateEnd(draftEnd());
    setShowDateModal(false);
  }

  onMount(() => {
    connectSSE();
    loadGeneralSettings();
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

  // Cautare avansata: dupa denumirea articolelor din devize (item_q pe server).
  const [itemSearch, setItemSearch] = createSignal("");
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [advDraft, setAdvDraft] = createSignal("");

  const filtered = createMemo(() => {
    const sel = selected();
    // Cand cautam dupa articol, lista vine deja filtrata de pe server; nu mai
    // aplicam filtrul de titlu local (titlul devizului nu contine denumirea articolului).
    const q = itemSearch() ? "" : search().toLowerCase().trim();
    return receipts().filter((r) => {
      const matchMetoda = sel.size === 0 || sel.has(r.metodaPlata ?? "Neplatit");
      const matchSearch = !q || r.titlu.toLowerCase().includes(q) || (r.clientNume ?? "").toLowerCase().includes(q);
      return matchMetoda && matchSearch;
    });
  });

  const hasFilter = () => selected().size > 0;

  const [serverSearch, setServerSearch] = createSignal("");

  createEffect(() => {
    const ss = serverSearch();
    const iq = itemSearch();
    loadReceipts(dateStart(), dateEnd(), 200, ss, device()?.locationId ?? null, iq);
  });

  // Când search se golește, resetăm și server search-ul
  createEffect(() => {
    if (!search()) setServerSearch("");
  });

  // Cautare automata pe server: daca nu exista NICIUN rezultat in lista deja
  // incarcata in browser, lansam automat cautarea pe server (debounce). Daca
  // exista rezultate locale, ramane butonul manual "Cauta pe server".
  let _autoTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const q = search().trim();
    const localCount = filtered().length;
    const ss = serverSearch();
    const itemActive = !!itemSearch();
    clearTimeout(_autoTimer);
    if (!q || itemActive) return;       // fara termen sau in mod cautare-articol
    if (localCount > 0) return;          // avem rezultate local -> buton manual
    if (ss === q) return;                // deja cautat pe server pentru acest termen
    _autoTimer = setTimeout(() => {
      if (search().trim() === q && !itemSearch()) setServerSearch(q);
    }, 450);
  });
  onCleanup(() => clearTimeout(_autoTimer));

  function applyAdvancedSearch() {
    const term = advDraft().trim();
    if (!term) return;
    setSearch("");          // cautarea pe articol e separata de cea pe titlu
    setServerSearch("");
    setItemSearch(term);
    setShowAdvanced(false);
  }

  function clearAdvancedSearch() {
    setItemSearch("");
    setAdvDraft("");
  }

  let sentinelRef: HTMLDivElement | undefined;
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreReceipts(); },
      { threshold: 0.1 }
    );
    if (sentinelRef) observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">
          Receptie
          <button class="btn btn-sm btn-ghost date-range-btn" onClick={openDateModal}>
            {dateRangeLabel()}
          </button>
        </h1>
        <div class="reception-header-right">
          <div style="display:flex;align-items:center;gap:4px">
            <input
              class="input reception-search"
              style="width:200px"
              type="search"
              placeholder="Cauta dupa titlu..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              disabled={!!itemSearch()}
            />
            {/* Buton manual: doar cand exista rezultate in lista locala. Daca nu
                exista, cautarea pe server porneste automat (vezi createEffect). */}
            <Show when={search() && filtered().length > 0 && !itemSearch()}>
              <button
                class="btn btn-sm btn-ghost"
                style="font-size:11px;white-space:nowrap;flex-shrink:0"
                onClick={() => setServerSearch(search())}
              >
                Caută pe server{serverSearch() === search() ? " ✓" : ""}
              </button>
            </Show>
            <button
              class="btn btn-sm btn-ghost"
              style="font-size:11px;white-space:nowrap;flex-shrink:0"
              title="Cauta devizele dupa denumirea articolelor din ele"
              onClick={() => { setAdvDraft(itemSearch()); setShowAdvanced(true); }}
            >
              Căutare avansată
            </button>
            <Show when={itemSearch()}>
              <span class="adv-search-chip">
                Articol: „{itemSearch()}”
                <button class="adv-search-chip-x" title="Sterge cautarea pe articol" onClick={clearAdvancedSearch}>✕</button>
              </span>
            </Show>
          </div>
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
                      {displayMetoda(opt)}
                    </button>
                  )}
                </For>
                <Show when={hasFilter()}>
                  <button
                    class="btn btn-ghost btn-sm filter-clear-btn"
                    onClick={() => setSelected(new Set())}
                  >
                    Șterge filtre
                  </button>
                </Show>
              </div>
            </Show>
          </div>
          <span class="reception-count">{filtered().length} bonuri</span>
          <span class="reception-pos-count" title="POS-uri active">· {posCount()} POS</span>
        </div>
      </div>


      <Show
        when={filtered().length > 0}
        fallback={
          <div class="card" style="text-align:center;padding:48px 16px">
            <div class="text-muted">
              {itemSearch()
                ? `Niciun deviz nu contine articolul „${itemSearch()}”.`
                : search()
                ? `Niciun rezultat pentru „${search()}”.`
                : receipts().length === 0
                ? "Nu exista bonuri inregistrate."
                : "Niciun bon pentru filtrul selectat."}
            </div>
          </div>
        }
      >
        <div class="rcard-list">
          <For each={filtered()}>
            {(r) => <ReceiptCard receipt={r} />}
          </For>
        </div>
        <div ref={sentinelRef} class="reception-sentinel">
          <Show when={loadingMore()}>
            <span class="text-muted" style="font-size:.85rem">Se incarca...</span>
          </Show>
          <Show when={!hasMore() && !loadingMore() && receipts().length > 0}>
            <span class="text-muted" style="font-size:.85rem">Nu mai sunt bonuri.</span>
          </Show>
        </div>
      </Show>

      <Show when={showDateModal()}>
        <div class="sl-modal-overlay">
          <div class="date-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Filtru dupa data</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowDateModal(false)}>✕</button>
            </div>
            <div class="date-modal-body">
              <div class="date-modal-col">
                <div class="date-modal-col-label">Data inceput</div>
                <MiniCalendar
                  value={draftStart()}
                  onChange={(v) => { setDraftStart(v); if (v > draftEnd()) setDraftEnd(v); }}
                  maxDate={todayYMD}
                />
              </div>
              <div class="date-modal-col">
                <div class="date-modal-col-label">Data sfarsit</div>
                <MiniCalendar
                  value={draftEnd()}
                  onChange={setDraftEnd}
                  minDate={draftStart()}
                  maxDate={todayYMD}
                />
              </div>
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowDateModal(false)}>Anuleaza</button>
              <button class="btn btn-primary btn-sm" onClick={applyDateFilter}>Aplica</button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showAdvanced()}>
        <div class="sl-modal-overlay">
          <div class="date-modal" style="max-width:420px">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Căutare avansată</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowAdvanced(false)}>✕</button>
            </div>
            <div style="padding:16px">
              <div class="text-muted" style="font-size:.85rem;margin-bottom:8px">
                Cauta devizele care contin un articol cu denumirea de mai jos.
                Ex: <b>Roata de cauciuc</b> arata doar devizele care au acest articol.
              </div>
              <input
                class="input"
                style="width:100%"
                type="search"
                placeholder="Denumire articol..."
                value={advDraft()}
                onInput={(e) => setAdvDraft(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyAdvancedSearch(); }}
                autofocus
              />
            </div>
            <div class="sl-modal-footer">
              <button class="btn btn-ghost btn-sm" onClick={() => setShowAdvanced(false)}>Anuleaza</button>
              <button class="btn btn-primary btn-sm" onClick={applyAdvancedSearch} disabled={!advDraft().trim()}>Cauta</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
