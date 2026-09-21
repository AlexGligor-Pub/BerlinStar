import { For, Show, createSignal, createMemo, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";
import { generalSettings, loadGeneralSettings } from "../store/generalSettingsStore";
import Modal from "../components/ui/Modal";
import ClientForm, {
  clientFormError, clientFormPayload, clientToForm, emptyClientForm, type ClientFormValues,
} from "../components/clienti/ClientForm";
import { clientiApi } from "../api/clienti";
import type { Client } from "../types";
import { CNP_PLACEHOLDER } from "../types/client";

interface ClientReceiptsSummary {
  count: number;
  total: number;
  plates_used: { numar_masina: string; count: number }[];
  no_vehicol_count: number;
}

// Filtru pe stânga: toate, o anumită placă, fără mașină.
type PlateFilter = { kind: "all" } | { kind: "plate"; numar: string } | { kind: "none" };

/** O cazare din hotelul de anvelope, cât să încapă pe un rând în fișa clientului. */
interface CazareScurt {
  id: number;
  numarMasina: string | null;
  dataCheckin: string;
  dataCheckout: string | null;
  loc: string | null;
  anvelope: number;
  peTip: Map<string, number>;
}

const TIP_ANVELOPA: Record<string, string> = {
  iarna: "iarnă", vara: "vară", ms: "M+S", altele: "alt tip",
};

function fmtZi(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

/** „4 anvelope · 4 iarnă" — la fel ca în lista din Hotel anvelope. */
function rezumatAnvelope(c: CazareScurt): string {
  if (c.anvelope === 0) return "fără anvelope";
  const tipuri = [...c.peTip.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tip, n]) => `${n} ${TIP_ANVELOPA[tip] ?? tip}`)
    .join(", ");
  return `${c.anvelope} ${c.anvelope === 1 ? "anvelopă" : "anvelope"} · ${tipuri}`;
}

const RO_DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ro-RO", RO_DATE_FMT);
  } catch {
    return iso;
  }
}

function payBadgeKind(pay: string | undefined): string {
  if (!pay) return "badge--warn";
  if (pay === "Platit cash" || pay === "Platit cu cardul" || pay === "Platit prin OP") return "badge--success";
  if (pay === "Platit Partial") return "badge--info";
  return "badge--warn";
}

interface RawReceiptItem {
  id: number;
  name: string;
  price: string | number;
  qty: number;
  unit: string;
  employee_id?: number | null;
  employee_name?: string | null;
}

interface RawReceipt {
  id: number | string;
  created_at: string;
  titlu: string;
  client_id?: number | null;
  client_nume?: string | null;
  total: string | number;
  pay_method?: string;
  receipt_items: RawReceiptItem[];
  vehicol?: { numar_masina: string; marca?: string | null; model?: string | null } | null;
  deviz_serie?: string;
  deviz_nr?: number;
  factura_serie?: string;
  factura_nr?: number;
}

interface NormalizedReceipt {
  id: string;
  date: string;
  titlu: string;
  total: number;
  payMethod: string | undefined;
  numarMasina: string | null;
  marca: string | null;
  model: string | null;
  devizSerie: string;
  devizNr: number;
  itemsCount: number;
}

function normalize(r: RawReceipt): NormalizedReceipt {
  return {
    id: String(r.id),
    date: r.created_at,
    titlu: r.titlu,
    total: typeof r.total === "number" ? r.total : parseFloat(r.total),
    payMethod: r.pay_method && r.pay_method !== "Neplatit" ? r.pay_method : undefined,
    numarMasina: r.vehicol?.numar_masina ?? null,
    marca: r.vehicol?.marca ?? null,
    model: r.vehicol?.model ?? null,
    devizSerie: r.deviz_serie ?? "",
    devizNr: r.deviz_nr ?? 0,
    itemsCount: r.receipt_items?.length ?? 0,
  };
}

export default function ClientDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const clientId = (): number => Number(params.id);

  const [client, setClient] = createSignal<Client | null>(null);
  const [summary, setSummary] = createSignal<ClientReceiptsSummary | null>(null);
  const [receipts, setReceipts] = createSignal<NormalizedReceipt[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [filter, setFilter] = createSignal<PlateFilter>({ kind: "all" });
  // Editarea datelor clientului, cu același formular ca în lista Clienți.
  const [editOpen, setEditOpen] = createSignal(false);
  const [form, setForm] = createSignal<ClientFormValues>(emptyClientForm());
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal<string | null>(null);

  function startEdit() {
    const c = client();
    if (!c) return;
    setForm(clientToForm(c));
    setFormError(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    const err = clientFormError(form());
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError(null);
    try {
      setClient(await clientiApi.update(clientId(), clientFormPayload(form())));
      setEditOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  // Cazările din hotelul de anvelope: secțiunea apare doar dacă există.
  const [cazari, setCazari] = createSignal<CazareScurt[]>([]);
  // Mai sunt cazari dupa primele 200 aduse: numerele din titlu sunt „cel putin".
  const [cazariMaiMulte, setCazariMaiMulte] = createSignal(false);
  // Firma care a dezactivat Hotel anvelope nu vede sectiunea (ca in meniu).
  const hotelActiv = () => !generalSettings()?.dezactiveazaHotelAnvelope;
  const cazariActive = createMemo(() => cazari().filter((c) => !c.dataCheckout).length);

  /** Placeholder-ul de e-Factura nu e o identificare reala — nu se afiseaza. */
  const fiscalCod = createMemo(() => {
    const c = client();
    return c?.cui && c.cui !== CNP_PLACEHOLDER ? c.cui : null;
  });

  async function loadClient(): Promise<void> {
    try {
      const res = await apiFetch(`/api/clienti/${clientId()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Client;
      setClient(data);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare client.", "error");
    }
  }

  async function loadSummary(): Promise<void> {
    try {
      const res = await apiFetch(`/api/clienti/${clientId()}/receipts-summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ClientReceiptsSummary;
      setSummary(data);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare sumar.", "error");
    }
  }

  async function loadAllReceipts(): Promise<void> {
    // Iteram cu cursor pana epuizam — count e in summary, dar avem nevoie de detalii pentru filtrare per masina.
    const PAGE = 100;
    let cursor: number | null = null;
    const all: NormalizedReceipt[] = [];
    try {
      while (true) {
        let qs = `/api/receipts?limit=${PAGE}&sort=-activity&client_id=${clientId()}`;
        if (cursor !== null) qs += `&last_id=${cursor}`;
        const res = await apiFetch(qs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: RawReceipt[]; next_cursor: number | null };
        const items = data.items ?? [];
        for (const it of items) all.push(normalize(it));
        if (data.next_cursor === null || items.length < PAGE) break;
        cursor = data.next_cursor;
        if (all.length > 10_000) break; // safeguard
      }
      setReceipts(all);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare devize.", "error");
    }
  }

  /** Cazările clientului, cele active primele (API-ul le dă descrescător după id). */
  async function loadCazariHotel(): Promise<void> {
    try {
      const res = await apiFetch(`/api/cazare-anvelope?client_id=${clientId()}&limit=200`);
      if (!res.ok) return;
      const data = await res.json() as { items: Array<Record<string, unknown>>; next_cursor?: number | null };
      setCazariMaiMulte(data.next_cursor != null);
      const items: CazareScurt[] = (data.items ?? []).map((raw) => {
        const list = (raw.items ?? []) as Array<{ anvelopa?: { tip?: string } | null }>;
        const peTip = new Map<string, number>();
        let n = 0;
        for (const it of list) {
          if (!it.anvelopa) continue;
          n += 1;
          const tip = it.anvelopa.tip ?? "altele";
          peTip.set(tip, (peTip.get(tip) ?? 0) + 1);
        }
        return {
          id: raw.id as number,
          numarMasina: (raw.numar_masina as string | null) ?? null,
          dataCheckin: raw.data_checkin as string,
          dataCheckout: (raw.data_checkout as string | null) ?? null,
          loc: (raw.loc_cazare_nume as string | null) ?? null,
          anvelope: n,
          peTip,
        };
      });
      // Întâi cele aflate în depozit, apoi istoricul, de la cea mai recentă.
      items.sort((a, b) =>
        (a.dataCheckout ? 1 : 0) - (b.dataCheckout ? 1 : 0)
        || b.dataCheckin.localeCompare(a.dataCheckin));
      setCazari(items);
    } catch {
      // Fișa clientului rămâne utilizabilă și fără secțiunea de hotel.
    }
  }

  onMount(async () => {
    setLoading(true);
    await Promise.all([loadClient(), loadSummary(), loadAllReceipts(), loadCazariHotel(), loadGeneralSettings()]);
    setLoading(false);
  });

  const filtered = createMemo<NormalizedReceipt[]>(() => {
    const f = filter();
    const list = receipts();
    if (f.kind === "all") return list;
    if (f.kind === "none") return list.filter((r) => r.numarMasina === null);
    return list.filter((r) => r.numarMasina === f.numar);
  });

  const filteredTotal = createMemo<number>(() =>
    filtered().reduce((s, r) => s + r.total, 0),
  );

  function isActive(f: PlateFilter): boolean {
    const c = filter();
    if (c.kind !== f.kind) return false;
    if (c.kind === "plate" && f.kind === "plate") return c.numar === f.numar;
    return true;
  }

  return (
    <div class="client-detail-page">
      {/* Header */}
      <div class="client-detail-header">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onClick={() => navigate("/clienti")}
          aria-label="Înapoi la lista de clienți"
        >
          ← Înapoi
        </button>
        <div class="client-detail-title">
          <Show when={client()} fallback={<span class="cfg-hint">Se încarcă…</span>}>
            <h1 class="client-detail-name">
              {client()!.nume}
              <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": client()!.tip === "juridic" }}>
                {client()!.tip === "juridic" ? "Juridică" : "Fizică"}
              </span>
            </h1>
            <Show when={fiscalCod() || client()!.telefon}>
              <p class="client-detail-meta">
                <Show when={fiscalCod()}>
                  <span>{client()!.tip === "juridic" ? "CUI" : "CNP"}: {fiscalCod()}</span>
                </Show>
                <Show when={fiscalCod() && client()!.telefon}>
                  <span class="client-detail-meta-sep">·</span>
                </Show>
                <Show when={client()!.telefon}>
                  <span>{client()!.telefon}</span>
                </Show>
              </p>
            </Show>
          </Show>
        </div>
        {/* Oricine poate edita un client, ca în lista Clienți. */}
        <Show when={client()}>
          <button type="button" class="btn btn-primary btn-sm client-detail-edit" onClick={startEdit}>
            Editează clientul
          </button>
        </Show>
      </div>

      {/* Modal: datele clientului */}
      <Show when={editOpen()}>
        <Modal
          open
          title="Editează clientul"
          onClose={() => setEditOpen(false)}
          style="max-width:520px;width:100%;max-height:90vh;display:flex;flex-direction:column"
          bodyStyle="padding:16px 20px;overflow-y:auto"
          footer={<>
            <button class="btn btn-ghost btn-sm" onClick={() => setEditOpen(false)} disabled={saving()}>Anulează</button>
            <button class="btn btn-primary btn-sm" onClick={() => void saveEdit()} disabled={saving()}>
              {saving() ? "Se salvează..." : "Salvează"}
            </button>
          </>}
        >
          <ClientForm f={form()} setF={setForm} />
          <Show when={formError()}>
            <p class="cfg-error" style="margin-top:10px">{formError()}</p>
          </Show>
        </Modal>
      </Show>

      {/* Stats sus */}
      <div class="client-detail-stats">
        <div class="client-stat-card">
          <span class="client-stat-label">Devize total</span>
          <span class="client-stat-value">{summary()?.count ?? 0}</span>
        </div>
        <div class="client-stat-card">
          <span class="client-stat-label">Sumă totală</span>
          <span class="client-stat-value">{fmtMoney(summary()?.total ?? 0)} lei</span>
        </div>
        <Show when={filter().kind !== "all"}>
          <div class="client-stat-card client-stat-card--accent">
            <span class="client-stat-label">Filtrate</span>
            <span class="client-stat-value">
              {filtered().length} · {fmtMoney(filteredTotal())} lei
            </span>
          </div>
        </Show>
      </div>

      {/* Layout 2 coloane */}
      <div class="client-detail-layout">
        {/* Stânga: mașini */}
        <aside class="client-vehicles-panel">
          <h2 class="client-panel-title">Mașini</h2>
          <ul class="client-vehicle-list">
            <li>
              <button
                type="button"
                class={`client-vehicle-row ${isActive({ kind: "all" }) ? "client-vehicle-row--active" : ""}`}
                onClick={() => setFilter({ kind: "all" })}
              >
                <span class="client-vehicle-name">Toate</span>
                <span class="client-vehicle-count">{summary()?.count ?? 0}</span>
              </button>
            </li>
            <For each={summary()?.plates_used ?? []}>
              {(p) => (
                <li>
                  <button
                    type="button"
                    class={`client-vehicle-row ${isActive({ kind: "plate", numar: p.numar_masina }) ? "client-vehicle-row--active" : ""}`}
                    onClick={() => setFilter({ kind: "plate", numar: p.numar_masina })}
                  >
                    <span class="client-vehicle-name">{p.numar_masina}</span>
                    <span class="client-vehicle-count">{p.count}</span>
                  </button>
                </li>
              )}
            </For>
            <Show when={(summary()?.no_vehicol_count ?? 0) > 0}>
              <li>
                <button
                  type="button"
                  class={`client-vehicle-row ${isActive({ kind: "none" }) ? "client-vehicle-row--active" : ""}`}
                  onClick={() => setFilter({ kind: "none" })}
                >
                  <span class="client-vehicle-name" style="font-style:italic">Fără mașină</span>
                  <span class="client-vehicle-count">{summary()?.no_vehicol_count ?? 0}</span>
                </button>
              </li>
            </Show>
          </ul>
        </aside>

        {/* Dreapta: devize */}
        <section class="client-receipts-panel">
          <h2 class="client-panel-title">Devize</h2>

          <Show when={loading()}>
            <p class="cfg-hint">Se încarcă…</p>
          </Show>

          <Show when={!loading() && filtered().length === 0}>
            <p class="cfg-hint">Niciun deviz pentru filtrul curent.</p>
          </Show>

          <ul class="client-receipt-list">
            <For each={filtered()}>
              {(r) => (
                <li class="client-receipt-row">
                  <div class="client-receipt-main">
                    <span class="client-receipt-titlu">{r.titlu}</span>
                    <span class="client-receipt-date">{fmtDate(r.date)}</span>
                  </div>
                  <div class="client-receipt-meta">
                    <Show when={r.numarMasina}>
                      <span class="badge badge--info" title="Mașină">
                        {r.numarMasina}
                        <Show when={r.marca || r.model}>
                          {" "}· {[r.marca, r.model].filter(Boolean).join(" ")}
                        </Show>
                      </span>
                    </Show>
                    <Show when={r.devizSerie || r.devizNr}>
                      <span class="badge badge--neutral">
                        {r.devizSerie}-{r.devizNr || "—"}
                      </span>
                    </Show>
                    <span class="client-receipt-items">{r.itemsCount} items</span>
                  </div>
                  <div class="client-receipt-side">
                    <span class={`badge ${payBadgeKind(r.payMethod)}`}>
                      {r.payMethod ?? "Neplătit"}
                    </span>
                    <span class="client-receipt-total">{fmtMoney(r.total)} lei</span>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
      </div>

      {/* Hotel de anvelope — numai dacă clientul a lăsat ceva în depozit */}
      <Show when={cazari().length > 0 && hotelActiv()}>
        <section class="client-receipts-panel client-hotel-panel">
          <h2 class="client-panel-title">
            Hotel de anvelope
            <span class="client-hotel-count">
              {cazariActive()} {cazariActive() === 1 ? "cazare activă" : "cazări active"}
              <Show when={cazari().length !== cazariActive()}>
                {" · "}{cazari().length - cazariActive()} în istoric
              </Show>
              <Show when={cazariMaiMulte()}>
                {" · "}se văd primele {cazari().length}, mai sunt și altele în Hotel anvelope
              </Show>
            </span>
          </h2>
          <ul class="client-receipt-list">
            <For each={cazari()}>
              {(c) => (
                <li
                  class="client-receipt-row client-hotel-row"
                  role="button"
                  tabIndex={0}
                  title="Deschide cazarea în Hotel anvelope"
                  onClick={() => navigate(`/hotel-anvelope?viewCazare=${c.id}`)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ")
                    && (e.preventDefault(), navigate(`/hotel-anvelope?viewCazare=${c.id}`))}
                >
                  <div class="client-receipt-main">
                    <span class="client-receipt-titlu">{c.numarMasina ?? "fără număr"}</span>
                    <span class="client-receipt-date">
                      {fmtZi(c.dataCheckin)}
                      <Show when={c.dataCheckout}>{" → "}{fmtZi(c.dataCheckout)}</Show>
                    </span>
                  </div>
                  <div class="client-receipt-meta">
                    <Show when={c.loc}><span class="badge badge--neutral">{c.loc}</span></Show>
                    <span class="client-receipt-items">{rezumatAnvelope(c)}</span>
                  </div>
                  <div class="client-receipt-side">
                    <span class={`badge ${c.dataCheckout ? "badge--neutral" : "badge--success"}`}>
                      {c.dataCheckout ? "Ieșit" : "În cazare"}
                    </span>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  );
}
