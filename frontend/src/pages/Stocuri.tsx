import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  createSolidTable, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { apiFetch } from "../utils/api";
import { device } from "../store/deviceStore";
import { notify } from "../store/notificationsStore";
import {
  stocuri, loading, error,
  loadStocuri, updateItemMeta, intrareMarfa, ajustareStoc,
  type StocRow,
} from "../store/stocStore";

interface Loc { id: number; name: string }

export default function Stocuri() {
  const navigate = useNavigate();
  const [locName, setLocName] = createSignal<string>("");
  const [filter, setFilter] = createSignal("");
  const [onlyLow, setOnlyLow] = createSignal(false);
  const [sorting, setSorting] = createSignal<SortingState>([
    { id: "department_name", desc: false },
    { id: "category_name", desc: false },
    { id: "name", desc: false },
  ]);
  const [showIntrare, setShowIntrare] = createSignal(false);
  const [showAjustare, setShowAjustare] = createSignal<StocRow | null>(null);
  const [showEditMeta, setShowEditMeta] = createSignal<StocRow | null>(null);
  const [showInfo, setShowInfo] = createSignal(false);

  const locationId = createMemo(() => device()?.locationId ?? null);

  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);
  function onResize() { setIsMobile(window.innerWidth < 768); }
  onMount(() => { window.addEventListener("resize", onResize); });
  onCleanup(() => window.removeEventListener("resize", onResize));

  async function loadLocName() {
    const id = locationId();
    if (!id) return;
    try {
      const res = await apiFetch(`/api/locations?limit=200`);
      if (!res.ok) return;
      const data = await res.json() as { items?: Loc[] };
      const loc = (data.items ?? []).find((l) => l.id === id);
      setLocName(loc?.name ?? "");
    } catch {}
  }

  function reload() {
    const id = locationId();
    if (id) void loadStocuri(id);
  }

  onMount(() => {
    loadLocName();
    reload();
  });

  async function savePatch(row: StocRow, patch: { cost_price?: number | null; stoc_minim?: number }) {
    const id = locationId();
    if (!id) return;
    try {
      await updateItemMeta(row.item_id, id, patch);
      notify("Salvat.", "success");
    } catch (e: any) {
      notify(e?.message || "Eroare la salvare.", "error");
    }
  }

  function marja(r: StocRow): string {
    const cost = Number(r.cost_price ?? 0);
    const price = Number(r.price);
    if (cost <= 0 || price <= 0) return "—";
    return `${(((price - cost) / cost) * 100).toFixed(0)}%`;
  }

  function isLowStock(r: StocRow): boolean {
    return r.stoc_minim > 0 && r.qty <= r.stoc_minim;
  }

  const filteredData = createMemo(() => {
    const all = stocuri();
    if (!onlyLow()) return all;
    return all.filter(isLowStock);
  });

  const columns: ColumnDef<StocRow>[] = [
    {
      id: "row_number",
      header: "#",
      enableSorting: false,
      cell: (info) => (
        <span style="color:var(--text-muted);font-size:12px;font-variant-numeric:tabular-nums">
          {info.row.index + 1}
        </span>
      ),
    },
    {
      id: "department_name",
      accessorKey: "department_name",
      header: "Departament",
      cell: (info) => <span style="color:var(--text-muted)">{info.getValue() as string}</span>,
    },
    {
      id: "category_name",
      accessorKey: "category_name",
      header: "Categorie",
      cell: (info) => <span style="color:var(--text-muted)">{info.getValue() as string}</span>,
    },
    {
      id: "name",
      accessorKey: "name",
      header: "Produs",
      cell: (info) => {
        const r = info.row.original;
        return (
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600">{r.name}</span>
            <span style="color:var(--text-muted);font-size:12px">({r.unit})</span>
            <Show when={isLowStock(r)}>
              <span class="badge badge-danger" style="padding:2px 6px;font-size:11px;background:var(--danger);color:#fff;border-radius:4px">stoc mic</span>
            </Show>
          </div>
        );
      },
    },
    {
      id: "cost_price",
      accessorFn: (r) => Number(r.cost_price ?? 0),
      header: "Preț cumpărare",
      cell: (info) => {
        const v = info.row.original.cost_price;
        return (
          <span style={v == null ? "color:var(--text-muted)" : ""}>
            {v == null ? "—" : Number(v).toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "price",
      accessorFn: (r) => Number(r.price),
      header: "Preț vânzare",
      cell: (info) => <span style="font-weight:600">{Number(info.row.original.price).toFixed(2)}</span>,
    },
    {
      id: "marja",
      accessorFn: (r) => {
        const c = Number(r.cost_price ?? 0); const p = Number(r.price);
        return c > 0 && p > 0 ? ((p - c) / c) * 100 : -1;
      },
      header: "Marjă",
      cell: (info) => <span>{marja(info.row.original)}</span>,
    },
    {
      id: "qty",
      accessorKey: "qty",
      header: "Stoc",
      cell: (info) => {
        const r = info.row.original;
        const cls = r.qty < 0 ? "color:var(--danger)" : isLowStock(r) ? "color:#d9822b" : "";
        return <span style={`font-weight:700;font-size:15px;${cls}`}>{r.qty}</span>;
      },
    },
    {
      id: "stoc_minim",
      accessorKey: "stoc_minim",
      header: "Stoc minim",
      cell: (info) => <span>{info.row.original.stoc_minim}</span>,
    },
    {
      id: "actions",
      header: "Acțiuni",
      enableSorting: false,
      cell: (info) => (
        <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
          <button
            class="btn btn-ghost btn-sm"
            title="Vezi toată activitatea produsului"
            onClick={() => navigate(`/stocuri/${info.row.original.item_id}/activitate`)}
          >
            📊 Activitate
          </button>
          <button
            class="btn btn-ghost btn-sm"
            title="Editează preț cumpărare și stoc minim"
            onClick={() => setShowEditMeta(info.row.original)}
          >
            ✎ Edit
          </button>
          <button class="btn btn-ghost btn-sm" onClick={() => setShowAjustare(info.row.original)}>
            Ajustează
          </button>
        </div>
      ),
    },
  ];

  const table = createSolidTable({
    get data() { return filteredData(); },
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
      const r = row.original;
      return (
        r.name.toLowerCase().includes(v) ||
        r.department_name.toLowerCase().includes(v) ||
        r.category_name.toLowerCase().includes(v)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const stats = createMemo(() => {
    const all = stocuri();
    const lowCount = all.filter(isLowStock).length;
    const totalQty = all.reduce((s, r) => s + r.qty, 0);
    return { total: all.length, low: lowCount, totalQty };
  });

  return (
    <div style="padding:12px 16px;max-width:1500px;margin:0 auto">
      {/* Header */}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:22px">Stocuri</h2>
          <Show when={locName()}>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px">
              Locație: <b>{locName()}</b>
            </div>
          </Show>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onClick={() => setShowInfo(true)} title="Ghid de utilizare">
            ⓘ Info
          </button>
          <button class="btn btn-ghost btn-sm" onClick={reload}>↻ Refresh</button>
          <button class="btn btn-primary btn-sm" onClick={() => setShowIntrare(true)} disabled={!locationId()}>
            + Intrare marfă
          </button>
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
          <StatCard label="Produse" value={String(stats().total)} />
          <StatCard label="Total bucăți" value={String(stats().totalQty)} />
          <StatCard
            label="Sub stoc minim"
            value={String(stats().low)}
            highlight={stats().low > 0}
          />
        </div>

        {/* Filtre */}
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <input
            class="input"
            placeholder="🔍 Caută produs, categorie, departament..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            style="flex:1;min-width:200px"
          />
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap">
            <input
              type="checkbox"
              checked={onlyLow()}
              onChange={(e) => setOnlyLow(e.currentTarget.checked)}
            />
            Doar sub stoc minim
          </label>
        </div>

        <Show when={loading() && stocuri().length === 0}>
          <div style="padding:20px;color:var(--text-muted);text-align:center">Se încarcă...</div>
        </Show>

        <Show when={!loading() && table.getRowModel().rows.length === 0}>
          <div style="padding:20px;color:var(--text-muted);text-align:center">
            <Show when={stocuri().length === 0} fallback="Niciun produs nu corespunde filtrelor.">
              Nu există produse pentru această locație.
            </Show>
          </div>
        </Show>

        {/* Mobile cards */}
        <Show when={isMobile() && table.getRowModel().rows.length > 0}>
          <div style="display:flex;flex-direction:column;gap:8px">
            <For each={table.getRowModel().rows}>
              {(row) => {
                const r = row.original;
                const low = isLowStock(r);
                return (
                  <div
                    class="card"
                    style={`padding:12px;border-left:4px solid ${low ? "var(--danger)" : r.qty < 0 ? "var(--danger)" : "var(--accent,#5b7cfa)"}`}
                  >
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                      <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px">
                          <span style="color:var(--text-muted);font-size:12px;font-variant-numeric:tabular-nums">#{row.index + 1}</span>
                          <span style="font-weight:600">{r.name}</span>
                        </div>
                        <div style="color:var(--text-muted);font-size:12px">
                          {r.department_name} · {r.category_name}
                        </div>
                      </div>
                      <div style={`font-size:22px;font-weight:700;${r.qty < 0 ? "color:var(--danger)" : low ? "color:#d9822b" : ""}`}>
                        {r.qty}
                      </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Preț cumpărare</div>
                        <div style={`padding:4px 0;${r.cost_price == null ? "color:var(--text-muted)" : ""}`}>
                          {r.cost_price == null ? "—" : Number(r.cost_price).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Preț vânzare</div>
                        <div style="font-weight:600;padding:4px 0">{Number(r.price).toFixed(2)} · {marja(r)}</div>
                      </div>
                      <div>
                        <div style="color:var(--text-muted);font-size:11px">Stoc minim</div>
                        <div style="padding:4px 0">{r.stoc_minim}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap">
                      <button
                        class="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/stocuri/${r.item_id}/activitate`)}
                      >
                        📊 Activitate
                      </button>
                      <button class="btn btn-ghost btn-sm" onClick={() => setShowEditMeta(r)}>
                        ✎ Edit
                      </button>
                      <button class="btn btn-ghost btn-sm" onClick={() => setShowAjustare(r)}>
                        Ajustează
                      </button>
                    </div>
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
                  {(row) => {
                    const low = isLowStock(row.original);
                    return (
                      <tr
                        style={`border-bottom:1px solid var(--border);transition:background 0.15s;${low ? "background:rgba(220,53,69,0.08)" : ""}`}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = low ? "rgba(220,53,69,0.16)" : "var(--surface-2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = low ? "rgba(220,53,69,0.08)" : ""; }}
                      >
                        <For each={row.getVisibleCells()}>
                          {(cell) => (
                            <td style="padding:8px 10px">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          )}
                        </For>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>

      <Show when={showIntrare()}>
        <IntrareMarfaModal
          locationId={locationId()!}
          onClose={() => setShowIntrare(false)}
          onSaved={() => { setShowIntrare(false); reload(); }}
        />
      </Show>

      <Show when={showAjustare()}>
        <AjustareModal
          row={showAjustare()!}
          locationId={locationId()!}
          onClose={() => setShowAjustare(null)}
          onSaved={() => { setShowAjustare(null); reload(); }}
        />
      </Show>

      <Show when={showEditMeta()}>
        <EditMetaModal
          row={showEditMeta()!}
          onClose={() => setShowEditMeta(null)}
          onSave={async (patch) => {
            await savePatch(showEditMeta()!, patch);
            setShowEditMeta(null);
          }}
        />
      </Show>

      <Show when={showInfo()}>
        <InfoModal onClose={() => setShowInfo(false)} />
      </Show>
    </div>
  );
}

function StatCard(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div class="card" style={`padding:10px 14px;${props.highlight ? "border:2px solid var(--danger)" : ""}`}>
      <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">{props.label}</div>
      <div style={`font-size:22px;font-weight:700;margin-top:2px;${props.highlight ? "color:var(--danger)" : ""}`}>{props.value}</div>
    </div>
  );
}

function EditMetaModal(props: {
  row: StocRow;
  onClose: () => void;
  onSave: (patch: { cost_price?: number | null; stoc_minim?: number }) => Promise<void>;
}) {
  const [costPrice, setCostPrice] = createSignal<string>(
    props.row.cost_price == null ? "" : String(props.row.cost_price),
  );
  const [stocMinim, setStocMinim] = createSignal<string>(String(props.row.stoc_minim));
  const [saving, setSaving] = createSignal(false);

  async function save() {
    setSaving(true);
    try {
      const patch: { cost_price?: number | null; stoc_minim?: number } = {};
      const cpStr = costPrice().trim();
      const newCp = cpStr === "" ? null : Number(cpStr);
      const oldCp = props.row.cost_price == null ? null : Number(props.row.cost_price);
      if (newCp !== oldCp) patch.cost_price = newCp;

      const newSm = Number(stocMinim() || 0);
      if (newSm !== props.row.stoc_minim) patch.stoc_minim = newSm;

      if (Object.keys(patch).length === 0) {
        props.onClose();
        return;
      }
      await props.onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div class="sl-modal-header">
          <span class="sl-modal-title">Editează produs</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:13px;background:var(--surface-2);padding:10px;border-radius:6px">
            <div style="font-weight:600;font-size:14px">{props.row.name}</div>
            <div style="color:var(--text-muted);margin-top:2px;font-size:12px">
              {props.row.department_name} → {props.row.category_name} · Preț vânzare: <b>{Number(props.row.price).toFixed(2)}</b>
            </div>
          </div>
          <label style="font-size:13px;font-weight:500">Preț cumpărare</label>
          <input
            type="number"
            step="0.01"
            min="0"
            class="input"
            value={costPrice()}
            placeholder="ex. 12.50 (gol = necunoscut)"
            onInput={(e) => setCostPrice(e.currentTarget.value)}
          />
          <label style="font-size:13px;font-weight:500">Stoc minim (alertă)</label>
          <input
            type="number"
            min="0"
            class="input"
            value={stocMinim()}
            placeholder="0 = fără alertă"
            onInput={(e) => setStocMinim(e.currentTarget.value)}
          />
          <div style="font-size:12px;color:var(--text-muted)">
            Setează stoc minim &gt; 0 pentru a evidenția automat produsul când stocul scade sub acest prag.
          </div>
        </div>
        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button class="btn btn-primary btn-sm" disabled={saving()} onClick={save}>
            {saving() ? "..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IntrareMarfaModal(props: { locationId: number; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = createSignal<number | null>(null);
  const [qty, setQty] = createSignal(1);
  const [unitCost, setUnitCost] = createSignal<string>("");
  const [note, setNote] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [search, setSearch] = createSignal("");

  const options = createMemo(() => {
    const q = search().toLowerCase();
    const all = stocuri().map((r) => ({
      id: r.item_id,
      label: `${r.department_name} → ${r.category_name} → ${r.name}`,
      name: r.name,
    }));
    if (!q) return all;
    return all.filter((o) => o.label.toLowerCase().includes(q));
  });

  async function save() {
    const id = itemId();
    if (!id || qty() <= 0) return;
    setSaving(true);
    try {
      await intrareMarfa({
        item_id: id, location_id: props.locationId, qty: qty(),
        unit_cost: unitCost() ? Number(unitCost()) : null,
        note: note() || null,
      });
      notify("Intrare salvată.", "success");
      props.onSaved();
    } catch (e: any) {
      notify(e?.message || "Eroare la salvare.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div class="sl-modal-header">
          <span class="sl-modal-title">Intrare marfă</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
          <label style="font-size:13px;font-weight:500">Caută produs</label>
          <input type="text" class="input" placeholder="ex. ulei" value={search()} onInput={(e) => setSearch(e.currentTarget.value)} />
          <label style="font-size:13px;font-weight:500">Produs</label>
          <select class="input" value={itemId() ?? ""} onChange={(e) => setItemId(Number(e.currentTarget.value) || null)}>
            <option value="">— alege —</option>
            <For each={options()}>{(o) => <option value={o.id}>{o.label}</option>}</For>
          </select>
          <label style="font-size:13px;font-weight:500">Cantitate</label>
          <input type="number" class="input" min="1" value={qty()} onInput={(e) => setQty(Number(e.currentTarget.value) || 0)} />
          <label style="font-size:13px;font-weight:500">Preț unitar cumpărare (opțional)</label>
          <input type="number" step="0.01" class="input" value={unitCost()} onInput={(e) => setUnitCost(e.currentTarget.value)} />
          <label style="font-size:13px;font-weight:500">Notă (ex. furnizor)</label>
          <input type="text" class="input" value={note()} onInput={(e) => setNote(e.currentTarget.value)} maxlength="500" />
        </div>
        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button class="btn btn-primary btn-sm" disabled={saving() || !itemId() || qty() <= 0} onClick={save}>
            {saving() ? "..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AjustareModal(props: { row: StocRow; locationId: number; onClose: () => void; onSaved: () => void }) {
  const [newQty, setNewQty] = createSignal(props.row.qty);
  const [note, setNote] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const delta = createMemo(() => newQty() - props.row.qty);

  async function save() {
    setSaving(true);
    try {
      await ajustareStoc({
        item_id: props.row.item_id, location_id: props.locationId,
        new_qty: newQty(), note: note() || null,
      });
      notify("Ajustare salvată.", "success");
      props.onSaved();
    } catch (e: any) {
      notify(e?.message || "Eroare la salvare.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
        <div class="sl-modal-header">
          <span class="sl-modal-title">Ajustare stoc</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:13px;background:var(--surface-2);padding:10px;border-radius:6px">
            <div style="font-weight:600;font-size:14px">{props.row.name}</div>
            <div style="color:var(--text-muted);margin-top:2px">
              Stoc curent: <b>{props.row.qty}</b> {props.row.unit}
            </div>
          </div>
          <label style="font-size:13px;font-weight:500">Stoc nou</label>
          <input type="number" min="0" class="input" value={newQty()} onInput={(e) => setNewQty(Number(e.currentTarget.value) || 0)} />
          <Show when={delta() !== 0}>
            <div style={`font-size:13px;color:${delta() > 0 ? "var(--success,#198754)" : "var(--danger)"}`}>
              Delta: {delta() > 0 ? "+" : ""}{delta()}
            </div>
          </Show>
          <label style="font-size:13px;font-weight:500">Motiv / notă</label>
          <input type="text" class="input" value={note()} placeholder="ex. inventar lunar"
                 onInput={(e) => setNote(e.currentTarget.value)} maxlength="500" />
        </div>
        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button class="btn btn-primary btn-sm" disabled={saving() || newQty() < 0} onClick={save}>
            {saving() ? "..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoModal(props: { onClose: () => void }) {
  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" onClick={(e) => e.stopPropagation()} style="max-width:720px;width:95vw">
        <div class="sl-modal-header">
          <span class="sl-modal-title">ⓘ Ghid de utilizare — Stocuri</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>
        <div
          class="sl-modal-body"
          style="padding:20px 24px;max-height:75vh;overflow-y:auto;line-height:1.55;font-size:14px"
        >
          <p style="margin:0 0 16px;color:var(--text-muted)">
            Pagina <b>Stocuri</b> îți arată în orice moment câte bucăți ai din fiecare produs la locația
            dispozitivului curent, cât te-a costat marfa, cu cât o vinzi și cât profit faci la fiecare
            tranzacție. Stocul scade automat când un bon este marcat ca <b>plătit</b> la Recepție și se
            întoarce automat dacă bonul e șters sau revine la „Neplătit".
          </p>

          <Section title="Pentru ce serveste">
            <ul style="margin:6px 0;padding-left:20px">
              <li><b>Inventar fizic în timp real</b> — vezi câte bucăți mai ai din fiecare produs.</li>
              <li><b>Marjă vizibilă</b> — pentru fiecare produs apare procentul de profit (pe baza prețului de cumpărare introdus).</li>
              <li><b>Alertă stoc mic</b> — produsele care au coborât sub un prag setat de tine sunt evidențiate vizual.</li>
              <li><b>Audit complet</b> — fiecare mișcare (vânzare, intrare marfă, ajustare, storno) e logată: cine, când, ce, câte bucăți, la ce preț. Vezi raportul „Stocuri" în Rapoarte.</li>
            </ul>
          </Section>

          <Section title="Locatia dispozitivului">
            <p style="margin:6px 0">
              Pagina afișează stocul <b>doar pentru locația asociată dispozitivului curent</b>. Asocierea se
              face din <i>Configurări → Dispozitivul meu</i>. Dacă dispozitivul nu e legat de o locație,
              pagina îți arată un mesaj clar. Același produs poate exista cu stocuri diferite la mai multe
              locații — fiecare punct de lucru își vede propriul inventar.
            </p>
          </Section>

          <Section title="Coloanele din tabel">
            <Field name="#">numărul de ordine al rândului în lista curentă (se actualizează după filtru/sortare).</Field>
            <Field name="Departament / Categorie">ierarhia produsului din catalog. Poți sorta sau filtra după ele.</Field>
            <Field name="Produs">denumirea produsului + unitatea de măsură. Dacă produsul e sub stoc minim, apare badge-ul roșu <i>stoc mic</i>.</Field>
            <Field name="Preț cumpărare">cât te costă pe tine o bucată (cost). Este opțional; dacă e gol apare „—". Folosit pentru calculul marjei și a valorii stocului la cost.</Field>
            <Field name="Preț vânzare">prețul cu care vinzi produsul (definit la produs, în Configurări → Produse și Servicii). Nu se modifică din pagina Stocuri.</Field>
            <Field name="Marjă">procentul de profit calculat ca <code>(preț vânzare − preț cumpărare) / preț cumpărare × 100</code>. Apare „—" dacă nu ai setat preț cumpărare.</Field>
            <Field name="Stoc">câte bucăți ai fizic la locația curentă. Apare colorat: roșu dacă e negativ, portocaliu dacă e sub stoc minim.</Field>
            <Field name="Stoc minim">pragul de alertă. Când <i>Stoc ≤ Stoc minim</i> și pragul e &gt; 0, produsul e evidențiat. Setează 0 pentru „fără alertă".</Field>
            <Field name="Acțiuni">butoanele <b>Edit</b> (preț cumpărare + stoc minim) și <b>Ajustează</b> (modifică direct cantitatea, ex. după inventar).</Field>
          </Section>

          <Section title="Statistici (cardurile de sus)">
            <Field name="Produse">numărul total de produse de tip „Produs" pentru acest cont (serviciile nu apar aici).</Field>
            <Field name="Total bucăți">suma cantităților din toate produsele de la locația curentă.</Field>
            <Field name="Sub stoc minim">câte produse au coborât sub pragul de alertă. Dacă e &gt; 0, cardul devine roșu — semn că trebuie să te aprovizionezi.</Field>
          </Section>

          <Section title="Filtrare si sortare">
            <ul style="margin:6px 0;padding-left:20px">
              <li>Câmpul de căutare din partea de sus filtrează după <b>nume produs, departament sau categorie</b> simultan.</li>
              <li>Comutatorul <b>„Doar sub stoc minim"</b> îți arată instant produsele care necesită aprovizionare.</li>
              <li>Click pe orice <b>header de coloană</b> sortează crescător; al doilea click sortează descrescător; al treilea click oprește sortarea pe acea coloană.</li>
            </ul>
          </Section>

          <Section title={'Buton „Edit" (creion ✎)'}>
            <p style="margin:6px 0">
              Deschide un modal unde poți modifica <b>Prețul de cumpărare</b> și/sau <b>Stoc minim</b> pentru
              acel produs. Doar câmpurile efectiv schimbate se trimit la salvare. Modificările sunt globale
              pentru produs (nu doar la locația curentă) — așa că marja calculată e consistentă oriunde
              vezi produsul.
            </p>
          </Section>

          <Section title={'Buton „Ajustează"'}>
            <p style="margin:6px 0">
              Folosește-l <b>doar pentru inventarul fizic</b> (ex. la sfârșit de lună numeri stocul și
              constați diferențe). Setezi cantitatea reală și opțional o notă (ex. „inventar mai 2026").
              Sistemul calculează automat <i>delta</i> (diferența pozitivă sau negativă) și o salvează ca
              mișcare de tip <b>ADJUSTMENT</b> în raportul de mișcări — așa că rămâne urma cine și când a
              modificat manual stocul.
            </p>
          </Section>

          <Section title={'Buton „+ Intrare marfa"'}>
            <p style="margin:6px 0">
              Pentru când primești marfă de la furnizor (NIR). Alegi produsul, pui cantitatea (bucățile noi
              care se adaugă la stocul actual), opțional prețul de cumpărare pentru această tranșă și o
              notă (ex. numele furnizorului). Se salvează ca mișcare <b>PURCHASE</b>. <i>Notă: prețul de
              cumpărare introdus aici nu suprascrie automat <code>cost_price</code> de pe produs — îl
              actualizezi separat din butonul Edit, dacă vrei să reflecte noul cost.</i>
            </p>
          </Section>

          <Section title="Cum scade stocul automat (vanzare)">
            <ol style="margin:6px 0;padding-left:20px">
              <li>În <b>POS</b> creezi un bon și adaugi produse pe el. <b>Stocul NU se modifică încă</b> — bonul e „Neplătit".</li>
              <li>În <b>Recepție</b> marchezi bonul ca „Platit cash", „Platit cu cardul", „Platit prin OP" sau „Platit Partial".</li>
              <li>În acel moment <b>stocul scade automat</b> cu cantitățile de pe bon, pentru fiecare produs (linie de tip „Produs"). Serviciile nu afectează stocul.</li>
              <li>Se salvează o mișcare <b>SALE</b>: produs, cantitate, angajat, bon, prețul de vânzare și prețul de cumpărare snapshot.</li>
            </ol>
            <p style="margin:6px 0;color:var(--text-muted);font-size:13px">
              Stocul <b>poate deveni negativ</b> dacă vinzi mai mult decât ai în sistem — alegere intenționată,
              ca să nu blochezi vânzări reale când inventarul nu e actualizat. Cantitățile negative apar colorate
              cu roșu și e un semnal clar că trebuie să faci o ajustare.
            </p>
          </Section>

          <Section title="Storno (cand bonul revine)">
            <ul style="margin:6px 0;padding-left:20px">
              <li>Dacă un bon plătit este <b>marcat înapoi ca „Neplătit"</b> în Recepție, stocul se întoarce automat (mișcare <b>SALE_REVERSE</b>).</li>
              <li>Dacă <b>ștergi</b> un bon plătit, la fel — stocul revine.</li>
              <li>Dacă <b>editezi conținutul</b> unui bon deja plătit (adaugi/scoți produse sau modifici cantitățile), sistemul face automat reverse pe liniile vechi și apply pe noile. Stocul rămâne corect.</li>
            </ul>
          </Section>

          <Section title="Mobile vs desktop">
            <p style="margin:6px 0">
              Pe ecrane sub 768px, tabelul se transformă în <b>carduri</b> cu același conținut, pentru a fi
              ușor de folosit pe telefon. Butoanele Edit și Ajustează rămân disponibile pe fiecare card.
            </p>
          </Section>

          <Section title="Rapoarte de stoc">
            <p style="margin:6px 0">
              În secțiunea <i>Rapoarte → Stocuri</i> ai 4 panouri: <b>Snapshot</b> (valoare stoc curent),
              <b>Top produse vândute</b>, <b>Vânzări per angajat</b> și <b>Istoric mișcări</b> (toate
              evenimentele SALE / SALE_REVERSE / PURCHASE / ADJUSTMENT, filtrabile pe perioadă).
            </p>
          </Section>

          <p style="margin:18px 0 0;color:var(--text-muted);font-size:12px;border-top:1px solid var(--border);padding-top:10px">
            Pentru întrebări sau dacă întâlnești comportament neașteptat, contactează administratorul aplicației.
          </p>
        </div>
        <div class="sl-modal-footer">
          <button class="btn btn-primary btn-sm" onClick={props.onClose}>Am înțeles</button>
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; children: any }) {
  return (
    <div style="margin:0 0 18px">
      <h4 style="margin:0 0 6px;font-size:15px;color:var(--accent,#5b7cfa)">{props.title}</h4>
      <div>{props.children}</div>
    </div>
  );
}

function Field(props: { name: string; children: any }) {
  return (
    <div style="margin:4px 0">
      <b>{props.name}</b> — {props.children}
    </div>
  );
}
