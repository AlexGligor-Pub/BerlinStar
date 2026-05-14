import { For, Show, createSignal, createMemo, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";
import type { Client } from "../types";

interface ClientReceiptsSummary {
  count: number;
  total: number;
  plates_used: { numar_masina: string; count: number }[];
  no_vehicol_count: number;
}

// Filtru pe stânga: toate, o anumită placă, fără mașină.
type PlateFilter = { kind: "all" } | { kind: "plate"; numar: string } | { kind: "none" };

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

  onMount(async () => {
    setLoading(true);
    await Promise.all([loadClient(), loadSummary(), loadAllReceipts()]);
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
            <Show when={client()!.cui || client()!.telefon}>
              <p class="client-detail-meta">
                <Show when={client()!.cui}>
                  <span>CUI: {client()!.cui}</span>
                </Show>
                <Show when={client()!.cui && client()!.telefon}>
                  <span class="client-detail-meta-sep">·</span>
                </Show>
                <Show when={client()!.telefon}>
                  <span>{client()!.telefon}</span>
                </Show>
              </p>
            </Show>
          </Show>
        </div>
      </div>

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
    </div>
  );
}
