import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import {
  createSolidTable, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { device } from "../store/deviceStore";
import { loadMiscari, stocuri, loadStocuri, type MiscareStoc, type StocRow } from "../store/stocStore";

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: "Vânzare",
  SALE_REVERSE: "Storno vânzare",
  PURCHASE: "Intrare marfă",
  ADJUSTMENT: "Ajustare",
};

const MOVEMENT_COLORS: Record<string, string> = {
  SALE: "#198754",
  SALE_REVERSE: "#d9822b",
  PURCHASE: "#5b7cfa",
  ADJUSTMENT: "#6c757d",
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ro-RO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function defaultFromISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StocActivitate() {
  const params = useParams();
  const navigate = useNavigate();
  const itemId = createMemo(() => Number(params.itemId) || 0);
  const locationId = createMemo(() => device()?.locationId ?? null);

  const [miscari, setMiscari] = createSignal<MiscareStoc[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal("");
  const [movType, setMovType] = createSignal<string>("");
  const [dateFrom, setDateFrom] = createSignal(defaultFromISO());
  const [dateTo, setDateTo] = createSignal(todayISO());
  const [sorting, setSorting] = createSignal<SortingState>([{ id: "created_at", desc: true }]);

  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);
  function onResize() { setIsMobile(window.innerWidth < 768); }
  onMount(() => { window.addEventListener("resize", onResize); });
  onCleanup(() => window.removeEventListener("resize", onResize));

  const product = createMemo<StocRow | undefined>(() =>
    stocuri().find((r) => r.item_id === itemId()),
  );

  async function reload() {
    const lid = locationId();
    const iid = itemId();
    if (!lid || !iid) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await loadMiscari({
        location_id: lid,
        item_id: iid,
        date_from: dateFrom() ? `${dateFrom()}T00:00:00` : undefined,
        date_to: dateTo() ? `${dateTo()}T23:59:59` : undefined,
        movement_type: movType() || undefined,
        limit: 1000,
      });
      setMiscari(rows);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcarea activității.");
      setMiscari([]);
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    const lid = locationId();
    if (lid && stocuri().length === 0) {
      void loadStocuri(lid);
    }
    void reload();
  });

  function applyFilters() { void reload(); }

  const stats = createMemo(() => {
    let intrari = 0, vanzari = 0, storno = 0, ajustari = 0;
    let valoareIntrari = 0, valoareVanzari = 0;
    for (const m of miscari()) {
      const d = m.qty_delta;
      const price = Number(m.unit_price ?? 0);
      const cost = Number(m.unit_cost ?? 0);
      switch (m.movement_type) {
        case "PURCHASE":
          intrari += d;
          valoareIntrari += d * cost;
          break;
        case "SALE":
          vanzari += -d;
          valoareVanzari += -d * price;
          break;
        case "SALE_REVERSE":
          storno += d;
          break;
        case "ADJUSTMENT":
          ajustari += d;
          break;
      }
    }
    return { intrari, vanzari, storno, ajustari, valoareIntrari, valoareVanzari, total: miscari().length };
  });

  const columns: ColumnDef<MiscareStoc>[] = [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Dată",
      cell: (info) => (
        <span style="font-variant-numeric:tabular-nums">
          {fmtDateTime(info.row.original.created_at)}
        </span>
      ),
    },
    {
      id: "movement_type",
      accessorKey: "movement_type",
      header: "Tip",
      cell: (info) => {
        const t = info.row.original.movement_type;
        const color = MOVEMENT_COLORS[t] || "#6c757d";
        return (
          <span style={`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${color}22;color:${color}`}>
            {MOVEMENT_LABELS[t] || t}
          </span>
        );
      },
    },
    {
      id: "qty_delta",
      accessorKey: "qty_delta",
      header: "Delta",
      cell: (info) => {
        const d = info.row.original.qty_delta;
        const color = d > 0 ? "var(--success,#198754)" : d < 0 ? "var(--danger)" : "var(--text-muted)";
        return (
          <span style={`font-weight:700;color:${color};font-variant-numeric:tabular-nums`}>
            {d > 0 ? "+" : ""}{d}
          </span>
        );
      },
    },
    {
      id: "unit_price",
      accessorFn: (r) => Number(r.unit_price ?? 0),
      header: "Preț unit.",
      cell: (info) => {
        const v = info.row.original.unit_price;
        return <span style={v == null ? "color:var(--text-muted)" : ""}>
          {v == null ? "—" : Number(v).toFixed(2)}
        </span>;
      },
    },
    {
      id: "unit_cost",
      accessorFn: (r) => Number(r.unit_cost ?? 0),
      header: "Cost unit.",
      cell: (info) => {
        const v = info.row.original.unit_cost;
        return <span style={v == null ? "color:var(--text-muted)" : ""}>
          {v == null ? "—" : Number(v).toFixed(2)}
        </span>;
      },
    },
    {
      id: "employee_name",
      accessorFn: (r) => r.employee_name ?? r.created_by_user ?? "",
      header: "Angajat / User",
      cell: (info) => {
        const m = info.row.original;
        return <span>{m.employee_name ?? m.created_by_user ?? "—"}</span>;
      },
    },
    {
      id: "receipt_id",
      accessorKey: "receipt_id",
      header: "Bon",
      cell: (info) => {
        const id = info.row.original.receipt_id;
        return <span style={id ? "" : "color:var(--text-muted)"}>{id ? `#${id}` : "—"}</span>;
      },
    },
    {
      id: "note",
      accessorKey: "note",
      header: "Notă",
      enableSorting: false,
      cell: (info) => (
        <span style="color:var(--text-muted);font-size:12px">{info.row.original.note ?? ""}</span>
      ),
    },
  ];

  const table = createSolidTable({
    get data() { return miscari(); },
    columns,
    state: {
      get sorting() { return sorting(); },
      get globalFilter() { return filter(); },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _colId, value) => {
      const v = (value as string)?.toLowerCase() ?? "";
      if (!v) return true;
      const m = row.original;
      return (
        (m.employee_name ?? "").toLowerCase().includes(v) ||
        (m.created_by_user ?? "").toLowerCase().includes(v) ||
        (m.note ?? "").toLowerCase().includes(v) ||
        String(m.receipt_id ?? "").includes(v) ||
        (MOVEMENT_LABELS[m.movement_type] || "").toLowerCase().includes(v)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div style="padding:12px 16px;max-width:1500px;margin:0 auto">
      {/* Header */}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <button
            class="btn btn-ghost btn-sm"
            onClick={() => navigate("/stocuri")}
            style="margin-bottom:6px;padding-left:4px"
          >
            ← Înapoi la Stocuri
          </button>
          <h2 style="margin:0;font-size:22px;line-height:1.2">
            Activitate produs
          </h2>
          <Show when={product()} fallback={
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px">
              Produs #{itemId()}
            </div>
          }>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px">
              <b style="color:var(--text)">{product()!.name}</b>
              {" · "}{product()!.department_name} → {product()!.category_name}
              {" · "}Stoc curent: <b style="color:var(--text)">{product()!.qty}</b> {product()!.unit}
            </div>
          </Show>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onClick={reload}>↻ Refresh</button>
        </div>
      </div>

      <Show when={!locationId()}>
        <div class="card" style="padding:20px;text-align:center;color:var(--text-muted)">
          Dispozitivul nu are o locație asociată.<br />
          Mergi în <b>Configurări → Dispozitivul meu</b> și asociază o locație.
        </div>
      </Show>

      <Show when={locationId() && error()}>
        <div class="card" style="padding:12px;color:var(--danger);margin-bottom:12px">{error()}</div>
      </Show>

      <Show when={locationId()}>
        {/* Stat cards */}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
          <StatCard label="Mișcări" value={String(stats().total)} />
          <StatCard label="Intrat (PURCHASE)" value={`+${stats().intrari}`} color="#5b7cfa" />
          <StatCard label="Vândut (SALE)" value={String(stats().vanzari)} color="#198754" />
          <StatCard label="Storno" value={`+${stats().storno}`} color="#d9822b" />
          <StatCard
            label="Ajustări (net)"
            value={`${stats().ajustari > 0 ? "+" : ""}${stats().ajustari}`}
            color="#6c757d"
          />
        </div>

        {/* Filtre */}
        <div style="display:flex;gap:8px;align-items:end;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;flex-direction:column;gap:2px">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">De la</label>
            <input
              type="date"
              class="input"
              value={dateFrom()}
              onChange={(e) => { setDateFrom(e.currentTarget.value); applyFilters(); }}
              style="width:150px"
            />
          </div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Până la</label>
            <input
              type="date"
              class="input"
              value={dateTo()}
              onChange={(e) => { setDateTo(e.currentTarget.value); applyFilters(); }}
              style="width:150px"
            />
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:160px">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Tip mișcare</label>
            <select
              class="input"
              value={movType()}
              onChange={(e) => { setMovType(e.currentTarget.value); applyFilters(); }}
            >
              <option value="">Toate tipurile</option>
              <option value="SALE">Vânzări</option>
              <option value="SALE_REVERSE">Storno vânzări</option>
              <option value="PURCHASE">Intrări marfă</option>
              <option value="ADJUSTMENT">Ajustări</option>
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;flex:2;min-width:180px">
            <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Caută</label>
            <input
              class="input"
              placeholder="🔍 angajat, notă, bon..."
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
          </div>
        </div>

        <Show when={loading() && miscari().length === 0}>
          <div style="padding:20px;color:var(--text-muted);text-align:center">Se încarcă...</div>
        </Show>

        <Show when={!loading() && table.getRowModel().rows.length === 0}>
          <div style="padding:20px;color:var(--text-muted);text-align:center">
            <Show when={miscari().length === 0} fallback="Nicio mișcare nu corespunde filtrelor.">
              Nicio activitate pentru acest produs în perioada selectată.
            </Show>
          </div>
        </Show>

        {/* Mobile cards */}
        <Show when={isMobile() && table.getRowModel().rows.length > 0}>
          <div style="display:flex;flex-direction:column;gap:8px">
            <For each={table.getRowModel().rows}>
              {(row) => {
                const m = row.original;
                const color = MOVEMENT_COLORS[m.movement_type] || "#6c757d";
                const deltaColor = m.qty_delta > 0 ? "var(--success,#198754)" : m.qty_delta < 0 ? "var(--danger)" : "var(--text-muted)";
                return (
                  <div class="card" style={`padding:12px;border-left:4px solid ${color}`}>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                      <div style="flex:1;min-width:0">
                        <span style={`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${color}22;color:${color};margin-bottom:4px`}>
                          {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                        </span>
                        <div style="font-size:12px;color:var(--text-muted);font-variant-numeric:tabular-nums">
                          {fmtDateTime(m.created_at)}
                        </div>
                      </div>
                      <div style={`font-size:22px;font-weight:700;color:${deltaColor};font-variant-numeric:tabular-nums`}>
                        {m.qty_delta > 0 ? "+" : ""}{m.qty_delta}
                      </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Preț unit.</div>
                        <div style={`padding:2px 0;${m.unit_price == null ? "color:var(--text-muted)" : ""}`}>
                          {m.unit_price == null ? "—" : Number(m.unit_price).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Cost unit.</div>
                        <div style={`padding:2px 0;${m.unit_cost == null ? "color:var(--text-muted)" : ""}`}>
                          {m.unit_cost == null ? "—" : Number(m.unit_cost).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Angajat / User</div>
                        <div style="padding:2px 0">{m.employee_name ?? m.created_by_user ?? "—"}</div>
                      </div>
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Bon</div>
                        <div style={`padding:2px 0;${m.receipt_id ? "" : "color:var(--text-muted)"}`}>
                          {m.receipt_id ? `#${m.receipt_id}` : "—"}
                        </div>
                      </div>
                    </div>
                    <Show when={m.note}>
                      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)">
                        {m.note}
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Desktop table */}
        <Show when={!isMobile() && table.getRowModel().rows.length > 0}>
          <div class="card" style="padding:0;overflow:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <For each={table.getHeaderGroups()}>
                  {(hg) => (
                    <tr style="background:var(--surface-2);position:sticky;top:0;z-index:1">
                      <For each={hg.headers}>
                        {(h) => {
                          const sort = h.column.getIsSorted();
                          const canSort = h.column.getCanSort();
                          return (
                            <th
                              style={`padding:10px;text-align:left;font-weight:600;border-bottom:1px solid var(--border);${canSort ? "cursor:pointer;user-select:none" : ""}`}
                              onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                            >
                              <span style="display:inline-flex;align-items:center;gap:4px">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                                <Show when={sort === "asc"}><span style="font-size:11px">▲</span></Show>
                                <Show when={sort === "desc"}><span style="font-size:11px">▼</span></Show>
                              </span>
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
                      style="border-bottom:1px solid var(--border);transition:background 0.15s"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td style="padding:8px 10px">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function StatCard(props: { label: string; value: string; color?: string }) {
  return (
    <div class="card" style="padding:10px 14px">
      <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">{props.label}</div>
      <div style={`font-size:22px;font-weight:700;margin-top:2px;${props.color ? `color:${props.color}` : ""}`}>
        {props.value}
      </div>
    </div>
  );
}
