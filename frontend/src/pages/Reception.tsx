import { For, Show, createMemo, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { adminVisible } from "../store/adminStore";
import { useNavigate } from "@solidjs/router";
import { receipts, deleteReceipt, loadReceipts, loadMoreReceipts, hasMore, loadingMore, updateMetodaPlata, updateReceiptClient, connectSSE, disconnectSSE, posCount, type Receipt } from "../store/receiptsStore";
import { generateDeviz, generateFactura, generateChitanta } from "../utils/generateDocuments";
import type { DocContext } from "../utils/generateDocuments";
import { setResume } from "../store/resumeStore";
import { apiFetch } from "../utils/api";
import { device } from "../store/deviceStore";

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
  const [tipFilter, setTipFilter] = createSignal<"fizic" | "juridic">("juridic");
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
    setTipFilter(tip);
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
    } catch {} finally { setAnafLoading(false); }
  }

  async function searchByNume() {
    const q = searchNume().trim();
    if (!q) return;
    setResultsNume([]); setSearchedNume(false);
    setSearchingNume(true);
    try {
      const res = await apiFetch(`/api/clienti?q=${encodeURIComponent(q)}&limit=20`);
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
    form.tip = tipFilter();
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
          <div class="rclient-name">{r().clientNume}</div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px" onClick={() => { clearSearch(); setEditing(true); }}>✎ Schimbă</button>
            <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px" onClick={remove}>✕ Elimină</button>
          </div>
        </div>
      </Show>

      <Show when={r().clientId === null || editing()}>
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

function ReceiptCard(props: { receipt: Receipt }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [metodaDraft, setMetodaDraft] = createSignal(props.receipt.metodaPlata ?? "");
  const [partialDraft, setPartialDraft] = createSignal(
    props.receipt.partialPay?.toFixed(2) ?? "100.00"
  );
  const [saving, setSaving] = createSignal(false);
  const [docLoading, setDocLoading] = createSignal<string | null>(null);
  const r = props.receipt;


  async function handleDocDownload(docType: "deviz" | "factura" | "chitanta") {
    const locationId = device()?.locationId;
    if (!locationId) { alert("Dispozitivul nu are o locație configurată."); return; }
    setDocLoading(docType);
    try {
      const res = await apiFetch(`/api/receipts/${r.id}/assign-number`, {
        method: "POST",
        body: JSON.stringify({ doc_type: docType, location_id: locationId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail ?? "Eroare la generarea documentului.");
        return;
      }
      const ctx: DocContext = await res.json();
      if (docType === "deviz") await generateDeviz(r, ctx);
      else if (docType === "factura") await generateFactura(r, ctx);
      else await generateChitanta(r, ctx);
    } catch (e: any) {
      alert(e?.message ?? "Eroare necunoscută.");
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

  return (
    <div class="rcard" classList={{ "rcard--open": expanded() }}>
      {/* Header card — click pentru expand */}
      <div class="rcard-header" onClick={() => setExpanded((v) => !v)}>
        <div class="rcard-info">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="rcard-titlu">{r.titlu}</span>
            <Show when={r.devizNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--deviz">D {r.devizSerie}{r.devizNr}</span>
            </Show>
            <Show when={r.facturaNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--factura">F {r.facturaSerie}{r.facturaNr}</span>
            </Show>
            <Show when={r.chitantaNr > 0}>
              <span class="rcard-doc-tag rcard-doc-tag--chitanta">C {r.chitantaSerie}{r.chitantaNr}</span>
            </Show>
          </div>
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
              <Show when={adminVisible()}>
                <button class="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                  Sterge
                </button>
              </Show>
              <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("deviz")}>
                {docLoading() === "deviz" ? "..." : "Deviz"}
              </button>
              <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("factura")}>
                {docLoading() === "factura" ? "..." : "Factura"}
              </button>
              <button class="btn btn-ghost btn-sm" disabled={docLoading() !== null} onClick={() => handleDocDownload("chitanta")}>
                {docLoading() === "chitanta" ? "..." : "Chitanta"}
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
        <div class="sl-modal-overlay">
          <div class="sl-modal">
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

  const [serverSearch, setServerSearch] = createSignal("");

  createEffect(() => {
    const ss = serverSearch();
    loadReceipts(dateStart(), dateEnd(), 200, ss);
  });

  // Când search se golește, resetăm și server search-ul
  createEffect(() => {
    if (!search()) setServerSearch("");
  });

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
            />
            <Show when={search()}>
              <button
                class="btn btn-sm btn-ghost"
                style="font-size:11px;white-space:nowrap;flex-shrink:0"
                onClick={() => setServerSearch(search())}
              >
                Server{serverSearch() === search() ? " ✓" : ""}
              </button>
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
          <span class="reception-count">{filtered().length} bonuri</span>
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
    </div>
  );
}
