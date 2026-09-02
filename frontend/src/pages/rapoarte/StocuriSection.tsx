import { For, Show, createSignal, createEffect, createMemo } from "solid-js";
import { device } from "../../store/deviceStore";
import {
  loadSnapshot, loadMiscari, loadTopProduse, loadPerAngajat,
  type StocSnapshot, type MiscareStoc,
} from "../../store/stocStore";
import { periodFrom, periodTo, periodVersion } from "./state";
import { fmtMoney, fmtRoDate, toNumber } from "./format";

interface TopRow {
  item_id: number;
  item_name: string;
  qty_total: number;
  valoare_vanzare: number;
  valoare_cost: number;
  marja: number;
}

interface AngRow {
  employee_id: number | null;
  employee_name: string;
  item_id: number | null;
  item_name: string;
  qty_total: number;
  valoare: number;
}

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: "Vânzare",
  SALE_REVERSE: "Storno vânzare",
  PURCHASE: "Intrare marfă",
  ADJUSTMENT: "Ajustare",
};

export default function StocuriSection() {
  const locId = createMemo(() => device()?.locationId ?? null);

  const [snapshot, setSnapshot] = createSignal<StocSnapshot | null>(null);
  const [topRows, setTopRows] = createSignal<TopRow[]>([]);
  const [angRows, setAngRows] = createSignal<AngRow[]>([]);
  const [miscari, setMiscari] = createSignal<MiscareStoc[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [movFilter, setMovFilter] = createSignal<string>("");

  async function load() {
    const lid = locId();
    if (!lid) return;
    setLoading(true);
    try {
      const fromISO = periodFrom();
      const toISO = periodTo();
      const [snap, top, ang, mov] = await Promise.all([
        loadSnapshot(lid).catch(() => null),
        loadTopProduse({ date_from: fromISO, date_to: toISO, location_ids: [lid], limit: 20 }).catch(() => []),
        loadPerAngajat({ date_from: fromISO, date_to: toISO, location_ids: [lid] }).catch(() => []),
        loadMiscari({
          location_id: lid, date_from: fromISO, date_to: toISO,
          movement_type: movFilter() || undefined, limit: 300,
        }).catch(() => []),
      ]);
      setSnapshot(snap);
      setTopRows(top);
      setAngRows(ang);
      setMiscari(mov);
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    periodVersion();
    movFilter();
    locId();
    void load();
  });

  const groupedAng = createMemo(() => {
    const map = new Map<string, { name: string; items: AngRow[]; total_qty: number; total_val: number }>();
    for (const r of angRows()) {
      const k = String(r.employee_id ?? 0);
      let g = map.get(k);
      if (!g) {
        g = { name: r.employee_name, items: [], total_qty: 0, total_val: 0 };
        map.set(k, g);
      }
      g.items.push(r);
      g.total_qty += r.qty_total;
      g.total_val += r.valoare;
    }
    return Array.from(map.values());
  });

  return (
    <div>
      <Show when={!locId()}>
        <div class="card" style="padding:20px;color:var(--text-muted)">
          Dispozitivul nu are o locație asociată. Configurări → Dispozitivul meu.
        </div>
      </Show>

      <Show when={locId()}>
        <h2 style="margin:0 0 4px">Stocuri</h2>
        <div style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
          Perioadă: {periodFrom() || "—"} → {periodTo() || "—"}
        </div>

        {/* Snapshot */}
        <Show when={snapshot()}>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px">
            <Card label="Produse" value={String(snapshot()!.nr_produse)} />
            <Card label="Buc. în stoc" value={String(snapshot()!.qty_total)} />
            <Card label="Valoare cost" value={fmtMoney(toNumber(snapshot()!.valoare_cost))} />
            <Card label="Valoare vânzare" value={fmtMoney(toNumber(snapshot()!.valoare_vanzare))} />
            <Card label="Sub stoc minim" value={String(snapshot()!.sub_stoc_minim)}
                  highlight={snapshot()!.sub_stoc_minim > 0} />
          </div>
        </Show>

        {/* Top produse */}
        <h3 style="margin:24px 0 8px">Top produse vândute</h3>
        <div class="table-wrap">
          <table class="table" style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--surface-2);text-align:left">
                <th style="padding:6px 10px">Produs</th>
                <th style="padding:6px 10px;width:80px">Buc.</th>
                <th style="padding:6px 10px;width:120px">Valoare</th>
                <th style="padding:6px 10px;width:120px">Cost</th>
                <th style="padding:6px 10px;width:120px">Marjă</th>
              </tr>
            </thead>
            <tbody>
              <For each={topRows()}>
                {(r) => (
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:6px 10px">{r.item_name}</td>
                    <td style="padding:6px 10px">{r.qty_total}</td>
                    <td style="padding:6px 10px">{fmtMoney(r.valoare_vanzare)}</td>
                    <td style="padding:6px 10px">{fmtMoney(r.valoare_cost)}</td>
                    <td style="padding:6px 10px;font-weight:600">{fmtMoney(r.marja)}</td>
                  </tr>
                )}
              </For>
              <Show when={topRows().length === 0 && !loading()}>
                <tr><td colspan="5" style="padding:12px;color:var(--text-muted);text-align:center">Nicio vânzare în perioadă.</td></tr>
              </Show>
            </tbody>
          </table>
        </div>

        {/* Per angajat */}
        <h3 style="margin:24px 0 8px">Vânzări per angajat</h3>
        <For each={groupedAng()}>
          {(g) => (
            <div style="margin-bottom:16px">
              <div style="background:var(--surface-2);padding:6px 12px;border-radius:6px;font-weight:600;font-size:14px;display:flex;justify-content:space-between">
                <span>{g.name}</span>
                <span style="color:var(--text-muted);font-weight:400">{g.total_qty} buc. · {fmtMoney(g.total_val)}</span>
              </div>
              <div class="table-wrap">
                <table class="table" style="width:100%;border-collapse:collapse;font-size:13px">
                  <tbody>
                    <For each={g.items}>
                      {(r) => (
                        <tr style="border-bottom:1px solid var(--border)">
                          <td style="padding:4px 10px">{r.item_name}</td>
                          <td style="padding:4px 10px;width:80px">{r.qty_total}</td>
                          <td style="padding:4px 10px;width:120px">{fmtMoney(r.valoare)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </For>
        <Show when={groupedAng().length === 0 && !loading()}>
          <div style="padding:12px;color:var(--text-muted)">Nicio vânzare în perioadă.</div>
        </Show>

        {/* Istoric mișcări */}
        <h3 style="margin:24px 0 8px">Istoric mișcări</h3>
        <div style="margin-bottom:8px">
          <select class="input" value={movFilter()} onChange={(e) => setMovFilter(e.currentTarget.value)} style="width:200px">
            <option value="">Toate tipurile</option>
            <option value="SALE">Vânzări</option>
            <option value="SALE_REVERSE">Storno vânzări</option>
            <option value="PURCHASE">Intrări marfă</option>
            <option value="ADJUSTMENT">Ajustări</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table" style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--surface-2);text-align:left">
                <th style="padding:6px 10px;width:140px">Dată</th>
                <th style="padding:6px 10px;width:130px">Tip</th>
                <th style="padding:6px 10px">Produs</th>
                <th style="padding:6px 10px;width:80px">Delta</th>
                <th style="padding:6px 10px;width:140px">Angajat</th>
                <th style="padding:6px 10px;width:80px">Bon</th>
                <th style="padding:6px 10px">Notă</th>
              </tr>
            </thead>
            <tbody>
              <For each={miscari()}>
                {(m) => (
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:4px 10px">{fmtRoDate(m.created_at)}</td>
                    <td style="padding:4px 10px">{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</td>
                    <td style="padding:4px 10px">{m.item_name}</td>
                    <td style={`padding:4px 10px;font-weight:600;${m.qty_delta < 0 ? "color:var(--danger)" : "color:var(--success,#198754)"}`}>
                      {m.qty_delta > 0 ? "+" : ""}{m.qty_delta}
                    </td>
                    <td style="padding:4px 10px">{m.employee_name ?? (m.created_by_user ?? "—")}</td>
                    <td style="padding:4px 10px">{m.receipt_id ? `#${m.receipt_id}` : "—"}</td>
                    <td style="padding:4px 10px;color:var(--text-muted)">{m.note ?? ""}</td>
                  </tr>
                )}
              </For>
              <Show when={miscari().length === 0 && !loading()}>
                <tr><td colspan="7" style="padding:12px;color:var(--text-muted);text-align:center">Nicio mișcare în perioadă.</td></tr>
              </Show>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

function Card(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div class="card" style={`padding:12px;${props.highlight ? "border:2px solid var(--danger)" : ""}`}>
      <div style="color:var(--text-muted);font-size:12px">{props.label}</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">{props.value}</div>
    </div>
  );
}
