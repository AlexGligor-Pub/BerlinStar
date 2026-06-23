import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel,
  type ColumnDef,
} from "@tanstack/solid-table";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import Pagination from "../../components/data/Pagination";
import { createPagination } from "../../hooks/createPagination";
import { useEFactura } from "./CompanyContext";
import InvoiceDetailsModal, { type SentSummary } from "../../components/efactura/InvoiceDetailsModal";

interface SentRow {
  id: number;
  company_id: number;
  receipt_id: number | null;
  cui: string;
  direction: string;
  standard: string;
  invoice_type: string;
  index_incarcare: number | null;
  status: string;
  anaf_stare: string | null;
  anaf_error_message: string | null;
  download_id: number | null;
  upload_attempts: number;
  invoice_issue_date: string;
  deadline_transmit: string;
  created_at: string;
  updated_at: string | null;
}

interface PaginatedResp {
  items: SentRow[];
  total: number;
  page: number;
  page_size: number;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  accepted: { bg: "rgba(34,197,94,.15)", fg: "var(--success)" },
  rejected: { bg: "rgba(239,68,68,.12)", fg: "var(--danger)" },
  error:    { bg: "rgba(239,68,68,.12)", fg: "var(--danger)" },
  in_prelucrare: { bg: "rgba(245,158,11,.15)", fg: "#d97706" },
  pending_upload: { bg: "var(--surface2)", fg: "var(--text-muted)" },
  draft: { bg: "var(--surface2)", fg: "var(--text-muted)" },
};

function StatusBadge(props: { status: string; anafStare: string | null }) {
  const colors = STATUS_COLORS[props.status] ?? { bg: "var(--surface2)", fg: "var(--text-muted)" };
  const label = props.anafStare && props.anafStare !== props.status ? `${props.status} • ${props.anafStare}` : props.status;
  return (
    <span
      style={`padding:2px 8px;border-radius:10px;background:${colors.bg};color:${colors.fg};font-size:11px;font-weight:600;border:1px solid ${colors.fg};white-space:nowrap`}
    >
      {label}
    </span>
  );
}

export default function EFacturaSent() {
  const ctx = useEFactura();
  const pag = createPagination({ initialPage: 1, initialPageSize: 25 });
  const [rows, setRows] = createSignal<SentRow[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [selected, setSelected] = createSignal<SentRow | null>(null);
  const [syncing, setSyncing] = createSignal(false);

  async function load() {
    const cid = ctx.companyId();
    if (!cid) { setRows([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pag.page()),
        page_size: String(pag.pageSize()),
      });
      if (search().trim()) params.set("search", search().trim());
      if (statusFilter()) params.set("status", statusFilter());
      const res = await apiFetch(`/api/efactura/companies/${cid}/records?${params}`);
      if (res.ok) {
        const data: PaginatedResp = await res.json();
        setRows(data.items);
        setTotal(data.total);
      } else {
        notify("Nu am putut încărca facturile trimise.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    ctx.companyId(); pag.page(); pag.pageSize(); statusFilter();
    void load();
  });

  let searchTimer: number | undefined;
  function onSearchInput(v: string) {
    setSearch(v);
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { pag.setPage(1); void load(); }, 350);
  }

  // Status-uri pentru care e disponibil retry-ul:
  // - "draft"    = creat de get_or_create_record dar nu s-a apelat upload-ul (record
  //   poate ramane in aceasta stare daca factura a fost emisa dar n-a fost trimisa).
  // - "rejected" = respins asincron de ANAF (are index_incarcare; vezi poll_status).
  // - "error"    = upload-ul n-a primit index_incarcare (HTTP/timeout/validare).
  function canRetry(row: SentRow): boolean {
    if (row.status === "draft") return true;
    if (row.status === "rejected") return true;
    if (row.status === "error") return true;
    return false;
  }

  async function handleRetry(row: SentRow) {
    if (row.receipt_id == null) {
      notify("Nu se poate retrimite — receipt_id lipseste.", "warn");
      return;
    }
    try {
      const res = await apiFetch(`/api/efactura/receipts/${row.receipt_id}/retry`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notify(j.detail ?? `Eroare ${res.status}`, "error");
        return;
      }
      notify("Factura a fost retrimisa catre ANAF.", "info");
      void load();
    } catch {
      notify("Eroare de retea la retrimitere.", "error");
    }
  }

  // Aduce din SPV ANAF toate facturile TRIMISE (inclusiv cele emise prin alt sistem)
  // si le persista. Deduplicat dupa index_incarcare in backend.
  async function syncFromSpv() {
    const cid = ctx.companyId();
    if (!cid || syncing()) return;
    setSyncing(true);
    try {
      const res = await apiFetch(`/api/efactura/companies/${cid}/sent/sync`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notify(j.detail ?? `Eroare ${res.status}`, "error");
        return;
      }
      const data = await res.json();
      notify(`Sincronizat din SPV: ${data.inserted} facturi noi (din ${data.messages} trimise găsite).`, "success");
      pag.setPage(1);
      void load();
    } catch {
      notify("Eroare de rețea la sincronizare.", "error");
    } finally {
      setSyncing(false);
    }
  }

  const columns = createMemo<ColumnDef<SentRow>[]>(() => [
    {
      id: "status",
      header: "Status",
      cell: (info) => <StatusBadge status={info.row.original.status} anafStare={info.row.original.anaf_stare} />,
      size: 180,
    },
    {
      id: "source",
      header: "Sursă",
      cell: (info) => {
        const ext = info.row.original.receipt_id == null;
        return (
          <span style={`padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;border:1px solid ${ext ? "var(--text-muted)" : "var(--accent)"};color:${ext ? "var(--text-muted)" : "var(--accent)"}`}>
            {ext ? "SPV (extern)" : "App"}
          </span>
        );
      },
      size: 110,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "cui",
      header: "CUI emitent",
      cell: (info) => info.getValue<string>(),
      size: 110,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "receipt_id",
      header: "Receipt #",
      cell: (info) => info.getValue<number | null>() ?? "—",
      size: 90,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "invoice_type",
      header: "Tip",
      cell: (info) => info.getValue<string>(),
      size: 70,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "index_incarcare",
      header: "Index ANAF",
      cell: (info) => info.getValue<number | null>() ?? "—",
      size: 120,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "invoice_issue_date",
      header: "Data emiterii",
      cell: (info) => info.getValue<string>(),
      size: 110,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "deadline_transmit",
      header: "Deadline",
      cell: (info) => {
        const v = info.getValue<string>();
        const today = new Date().toISOString().slice(0, 10);
        const isPast = v < today && info.row.original.status !== "accepted";
        return (
          <span style={isPast ? "color:var(--danger);font-weight:600" : ""}>{v}</span>
        );
      },
      size: 110,
    },
    {
      id: "actions",
      header: "",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
            <Show when={canRetry(row)}>
              <button
                class={row.status === "draft" ? "btn btn-spv btn-sm" : "btn btn-danger btn-sm"}
                onClick={(e) => { e.stopPropagation(); void handleRetry(row); }}
                title={row.status === "draft" ? "Trimite factura catre ANAF" : "Reincearca trimiterea"}
              >
                {row.status === "draft" ? "Trimite" : "Reincearca"}
              </button>
            </Show>
            <button
              class="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); setSelected(row); }}
            >
              Vezi
            </button>
          </div>
        );
      },
      size: 140,
    },
  ]);

  const table = createSolidTable({
    get data() { return rows(); },
    get columns() { return columns(); },
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedSummary = createMemo<SentSummary | null>(() => {
    const r = selected();
    if (!r) return null;
    return {
      id: r.id, status: r.status, anaf_stare: r.anaf_stare, anaf_error_message: r.anaf_error_message,
      index_incarcare: r.index_incarcare, download_id: r.download_id, cui: r.cui,
      invoice_issue_date: r.invoice_issue_date, deadline_transmit: r.deadline_transmit,
      invoice_type: r.invoice_type, receipt_id: r.receipt_id, upload_attempts: r.upload_attempts,
      created_at: r.created_at,
    };
  });

  return (
    <Show
      when={ctx.companyId()}
      fallback={
        <div style="padding:32px;text-align:center;color:var(--text-muted)">
          Selectează o companie pentru a vedea facturile trimise.
        </div>
      }
    >
      <div class="efactura-toolbar">
        <input
          class="input"
          style="max-width:280px;flex:1 1 200px"
          type="search"
          placeholder="Caută după index, status, stare ANAF…"
          value={search()}
          onInput={(e) => onSearchInput(e.currentTarget.value)}
        />
        <select
          class="input"
          style="max-width:180px"
          value={statusFilter()}
          onChange={(e) => { pag.setPage(1); setStatusFilter(e.currentTarget.value); }}
        >
          <option value="">Toate statusurile</option>
          <option value="draft">Draft</option>
          <option value="pending_upload">Pending upload</option>
          <option value="in_prelucrare">În prelucrare</option>
          <option value="accepted">Acceptate</option>
          <option value="rejected">Respinse</option>
          <option value="error">Eroare</option>
        </select>
        <button
          class="btn btn-ghost btn-sm"
          disabled={syncing()}
          onClick={() => void syncFromSpv()}
          title="Aduce din SPV ANAF toate facturile trimise (inclusiv din alt sistem), ultimele 60 zile"
        >
          {syncing() ? "Sincronizez…" : "↻ Sync din SPV"}
        </button>
        <div style="flex:1" />
        <span class="efactura-toolbar-count" style="font-size:12px;color:var(--text-muted)">{total()} facturi trimise</span>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <Show when={loading() && rows().length === 0}>
          <div style="padding:32px;text-align:center;color:var(--text-muted)">Se încarcă…</div>
        </Show>
        <Show when={!loading() && rows().length === 0}>
          <div style="padding:32px;text-align:center;color:var(--text-muted)">
            Nicio factură trimisă încă.
          </div>
        </Show>
        <Show when={rows().length > 0}>
          <div class="efactura-table-wrap">
            <table>
              <thead>
                <For each={table.getHeaderGroups()}>
                  {(headerGroup) => (
                    <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                      <For each={headerGroup.headers}>
                        {(header) => {
                          const hideOnMobile = (header.column.columnDef.meta as any)?.hideOnMobile;
                          return (
                            <th
                              classList={{ "hide-mobile": !!hideOnMobile }}
                              style="padding:10px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </thead>
              <tbody>
                <For each={table.getRowModel().rows}>
                  {(row) => (
                    <tr
                      style="border-bottom:1px solid var(--border);cursor:pointer"
                      onClick={() => setSelected(row.original)}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => {
                          const hideOnMobile = (cell.column.columnDef.meta as any)?.hideOnMobile;
                          return (
                            <td
                              classList={{ "hide-mobile": !!hideOnMobile }}
                              style="padding:10px 8px;vertical-align:middle"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      <div style="margin-top:12px">
        <Pagination api={pag} total={total()} pageSizeOptions={[10, 25, 50, 100]} />
      </div>

      <InvoiceDetailsModal
        mode="sent"
        open={selected() !== null}
        companyId={ctx.companyId() ?? 0}
        row={selectedSummary()}
        onClose={() => setSelected(null)}
      />
    </Show>
  );
}
