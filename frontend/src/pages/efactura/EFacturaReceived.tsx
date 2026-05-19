import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel,
  type ColumnDef,
} from "@tanstack/solid-table";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import Pagination from "../../components/data/Pagination";
import { createPagination } from "../../hooks/createPagination";
import { useEFactura } from "./CompanyContext";
import InvoiceDetailsModal, { type ReceivedSummary } from "../../components/efactura/InvoiceDetailsModal";

interface ReceivedRow {
  id: number;
  id_solicitare: number;
  tip: string | null;
  data_creare: string | null;
  cif_emitent: string | null;
  nume_emitent: string | null;
  cif_beneficiar: string | null;
  nume_beneficiar: string | null;
  detalii: string | null;
  downloaded: boolean;
  is_read: boolean;
  read_at: string | null;
  response_zip_s3_key: string | null;
  created_at: string | null;
}

interface PaginatedResp {
  items: ReceivedRow[];
  total: number;
  page: number;
  page_size: number;
  unread_count: number;
}

function fmtANAFDate(s: string | null): string {
  if (!s) return "—";
  if (/^\d{8,}/.test(s)) {
    const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
    if (s.length >= 12) return `${y}-${m}-${d} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
    return `${y}-${m}-${d}`;
  }
  return s;
}

export default function EFacturaReceived() {
  const ctx = useEFactura();
  const pag = createPagination({ initialPage: 1, initialPageSize: 25 });
  const [rows, setRows] = createSignal<ReceivedRow[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [readFilter, setReadFilter] = createSignal<"all" | "unread" | "read">("all");
  const [selected, setSelected] = createSignal<ReceivedRow | null>(null);

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
      if (readFilter() === "read") params.set("is_read", "true");
      else if (readFilter() === "unread") params.set("is_read", "false");
      const res = await apiFetch(`/api/efactura/companies/${cid}/received?${params}`);
      if (res.ok) {
        const data: PaginatedResp = await res.json();
        setRows(data.items);
        setTotal(data.total);
        ctx.setUnreadCount(data.unread_count);
      } else {
        notify("Nu am putut încărca facturile primite.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    // Reactive dependencies: companyId, page, pageSize, filters
    ctx.companyId(); pag.page(); pag.pageSize(); readFilter();
    void load();
  });

  let searchTimer: number | undefined;
  function onSearchInput(v: string) {
    setSearch(v);
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { pag.setPage(1); void load(); }, 350);
  }

  onMount(() => {
    window.addEventListener("efactura:refresh", load);
  });
  onCleanup(() => window.removeEventListener("efactura:refresh", load));

  function handleMarkedRead(id: number) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, is_read: true } : r));
    ctx.setUnreadCount(Math.max(0, ctx.unreadCount() - 1));
  }

  const columns = createMemo<ColumnDef<ReceivedRow>[]>(() => [
    {
      id: "read_indicator",
      header: "",
      cell: (info) => (
        <span
          title={info.row.original.is_read ? "Citită" : "Necitită"}
          style={`display:inline-block;width:8px;height:8px;border-radius:50%;background:${info.row.original.is_read ? "transparent" : "var(--accent)"};border:1px solid ${info.row.original.is_read ? "var(--border)" : "var(--accent)"}`}
        />
      ),
      size: 30,
    },
    {
      accessorKey: "nume_emitent",
      header: "Emitent",
      cell: (info) => {
        const r = info.row.original;
        return (
          <div>
            <div style={`font-weight:${r.is_read ? "400" : "600"};word-break:break-word`}>{r.nume_emitent ?? "—"}</div>
            <div style="font-size:11px;color:var(--text-muted)">CIF {r.cif_emitent ?? "—"} • #{r.id_solicitare}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "data_creare",
      header: "Data",
      cell: (info) => fmtANAFDate(info.getValue<string | null>()),
      size: 130,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "tip",
      header: "Tip",
      cell: (info) => (
        <span style="padding:2px 8px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);font-size:11px;font-weight:600">
          {info.getValue<string | null>() ?? "—"}
        </span>
      ),
      size: 90,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "detalii",
      header: "Detalii",
      cell: (info) => {
        const v = info.getValue<string | null>();
        if (!v) return <span style="color:var(--text-muted)">—</span>;
        const truncated = v.length > 60 ? v.slice(0, 60) + "…" : v;
        return <span title={v}>{truncated}</span>;
      },
      meta: { hideOnMobile: true },
    },
    {
      id: "status",
      header: "Status",
      cell: (info) => (
        <Show
          when={info.row.original.downloaded}
          fallback={
            <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--surface2);color:var(--text-muted);border:1px solid var(--border)">
              Nedescărcată
            </span>
          }
        >
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,0.15);color:var(--success);font-weight:600">
            ✓ Descărcată
          </span>
        </Show>
      ),
      size: 120,
      meta: { hideOnMobile: true },
    },
    {
      id: "actions",
      header: "",
      cell: (info) => (
        <button
          class="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); setSelected(info.row.original); }}
        >
          Vezi
        </button>
      ),
      size: 80,
    },
  ]);

  const table = createSolidTable({
    get data() { return rows(); },
    get columns() { return columns(); },
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedSummary = createMemo<ReceivedSummary | null>(() => {
    const r = selected();
    if (!r) return null;
    return {
      id: r.id, id_solicitare: r.id_solicitare, tip: r.tip,
      data_creare: r.data_creare, cif_emitent: r.cif_emitent, nume_emitent: r.nume_emitent,
      detalii: r.detalii, is_read: r.is_read, downloaded: r.downloaded,
    };
  });

  return (
    <Show
      when={ctx.companyId()}
      fallback={
        <div style="padding:32px;text-align:center;color:var(--text-muted)">
          Selectează o companie pentru a vedea facturile primite.
        </div>
      }
    >
      <div class="efactura-toolbar">
        <input
          class="input"
          style="max-width:280px;flex:1 1 200px"
          type="search"
          placeholder="Caută după emitent, CIF, detalii…"
          value={search()}
          onInput={(e) => onSearchInput(e.currentTarget.value)}
        />
        <select
          class="input"
          style="max-width:160px"
          value={readFilter()}
          onChange={(e) => { pag.setPage(1); setReadFilter(e.currentTarget.value as any); }}
        >
          <option value="all">Toate</option>
          <option value="unread">Doar necitite</option>
          <option value="read">Doar citite</option>
        </select>
        <div style="flex:1" />
        <span class="efactura-toolbar-count" style="font-size:12px;color:var(--text-muted)">
          {total()} facturi • {ctx.unreadCount()} necitite
        </span>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <Show when={loading() && rows().length === 0}>
          <div style="padding:32px;text-align:center;color:var(--text-muted)">Se încarcă…</div>
        </Show>
        <Show when={!loading() && rows().length === 0}>
          <div style="padding:32px;text-align:center;color:var(--text-muted)">
            Nicio factură primită. Apasă <strong>Sincronizează acum</strong> pentru a interoga ANAF.
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
                              style={`padding:10px 8px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;${header.column.columnDef.size ? `width:${header.column.columnDef.size}px` : ""}`}
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
        mode="received"
        open={selected() !== null}
        companyId={ctx.companyId() ?? 0}
        row={selectedSummary()}
        onClose={() => setSelected(null)}
        onMarkedRead={handleMarkedRead}
      />
    </Show>
  );
}
