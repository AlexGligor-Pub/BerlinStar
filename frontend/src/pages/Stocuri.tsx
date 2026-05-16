import { For, Show, createMemo, createSignal, onMount } from "solid-js";
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
  const [locName, setLocName] = createSignal<string>("");
  const [search, setSearch] = createSignal("");
  const [showIntrare, setShowIntrare] = createSignal(false);
  const [showAjustare, setShowAjustare] = createSignal<StocRow | null>(null);

  const locationId = createMemo(() => device()?.locationId ?? null);

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
    if (id) void loadStocuri(id, search() || undefined);
  }

  onMount(() => {
    loadLocName();
    reload();
  });

  // Grupare ierarhica pe departament -> categorie
  const grouped = createMemo(() => {
    const list = stocuri();
    const map = new Map<string, { dept_id: number; dept_name: string; cats: Map<string, { cat_id: number; cat_name: string; items: StocRow[] }> }>();
    for (const r of list) {
      const dKey = String(r.department_id);
      let d = map.get(dKey);
      if (!d) {
        d = { dept_id: r.department_id, dept_name: r.department_name, cats: new Map() };
        map.set(dKey, d);
      }
      const cKey = String(r.category_id);
      let c = d.cats.get(cKey);
      if (!c) {
        c = { cat_id: r.category_id, cat_name: r.category_name, items: [] };
        d.cats.set(cKey, c);
      }
      c.items.push(r);
    }
    return Array.from(map.values()).map((d) => ({
      ...d,
      cats: Array.from(d.cats.values()),
    }));
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

  return (
    <div style="padding:16px 20px;max-width:1400px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">Stocuri</h2>
          <Show when={locName()}>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Locație: {locName()}</div>
          </Show>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input
            class="input"
            placeholder="Caută produs..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") reload(); }}
            style="width:200px"
          />
          <button class="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
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
        <div class="card" style="padding:12px;color:var(--danger)">{error()}</div>
      </Show>

      <Show when={locationId() && loading() && stocuri().length === 0}>
        <div style="padding:20px;color:var(--text-muted)">Se încarcă...</div>
      </Show>

      <Show when={locationId() && !loading() && stocuri().length === 0}>
        <div style="padding:20px;color:var(--text-muted)">Nu există produse pentru această locație.</div>
      </Show>

      <For each={grouped()}>
        {(d) => (
          <div style="margin-bottom:24px">
            <div style="background:var(--surface-2);padding:8px 12px;border-radius:6px;font-weight:600;font-size:15px">
              {d.dept_name}
            </div>
            <For each={d.cats}>
              {(c) => (
                <div style="margin-top:8px">
                  <div style="padding:4px 12px;color:var(--text-muted);font-size:13px;font-weight:500">
                    {c.cat_name}
                  </div>
                  <table class="table" style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                      <tr style="background:var(--surface-2);text-align:left">
                        <th style="padding:6px 10px">Nume</th>
                        <th style="padding:6px 10px;width:100px">Preț cumpărare</th>
                        <th style="padding:6px 10px;width:100px">Preț vânzare</th>
                        <th style="padding:6px 10px;width:80px">Marjă</th>
                        <th style="padding:6px 10px;width:90px">Stoc</th>
                        <th style="padding:6px 10px;width:90px">Stoc minim</th>
                        <th style="padding:6px 10px;width:120px;text-align:right">Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={c.items}>
                        {(r) => {
                          const cost = Number(r.cost_price ?? 0);
                          const price = Number(r.price);
                          const marja = cost > 0 && price > 0
                            ? `${(((price - cost) / cost) * 100).toFixed(0)}%`
                            : "—";
                          const lowStock = r.stoc_minim > 0 && r.qty <= r.stoc_minim;
                          return (
                            <tr style={`border-bottom:1px solid var(--border);${lowStock ? "background:rgba(220,53,69,0.12)" : ""}`}>
                              <td style="padding:6px 10px">{r.name} <span style="color:var(--text-muted)">({r.unit})</span></td>
                              <td style="padding:6px 10px">
                                <EditableNumber
                                  value={r.cost_price == null ? "" : String(r.cost_price)}
                                  onCommit={(v) => savePatch(r, { cost_price: v === "" ? null : Number(v) })}
                                  step="0.01"
                                />
                              </td>
                              <td style="padding:6px 10px">{Number(r.price).toFixed(2)}</td>
                              <td style="padding:6px 10px">{marja}</td>
                              <td style={`padding:6px 10px;font-weight:600;${r.qty < 0 ? "color:var(--danger)" : ""}`}>
                                {r.qty}
                              </td>
                              <td style="padding:6px 10px">
                                <EditableNumber
                                  value={String(r.stoc_minim)}
                                  onCommit={(v) => savePatch(r, { stoc_minim: Number(v || 0) })}
                                  step="1"
                                />
                              </td>
                              <td style="padding:6px 10px;text-align:right">
                                <button class="btn btn-ghost btn-sm" onClick={() => setShowAjustare(r)}>Ajustează</button>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              )}
            </For>
          </div>
        )}
      </For>

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
    </div>
  );
}

function EditableNumber(props: { value: string; onCommit: (v: string) => void; step?: string }) {
  const [val, setVal] = createSignal(props.value);
  const [dirty, setDirty] = createSignal(false);
  return (
    <input
      type="number"
      step={props.step ?? "1"}
      class="input"
      style="width:90px;font-size:13px;padding:2px 6px"
      value={val()}
      onInput={(e) => { setVal(e.currentTarget.value); setDirty(true); }}
      onBlur={() => { if (dirty()) { props.onCommit(val()); setDirty(false); } }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { (e.currentTarget as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setVal(props.value); setDirty(false); (e.currentTarget as HTMLInputElement).blur(); }
      }}
    />
  );
}

function IntrareMarfaModal(props: { locationId: number; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = createSignal<number | null>(null);
  const [qty, setQty] = createSignal(1);
  const [unitCost, setUnitCost] = createSignal<string>("");
  const [note, setNote] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const options = createMemo(() =>
    stocuri().map((r) => ({ id: r.item_id, label: `${r.department_name} → ${r.category_name} → ${r.name}` })),
  );

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
          <label style="font-size:13px">Produs</label>
          <select class="input" value={itemId() ?? ""} onChange={(e) => setItemId(Number(e.currentTarget.value) || null)}>
            <option value="">— alege —</option>
            <For each={options()}>{(o) => <option value={o.id}>{o.label}</option>}</For>
          </select>
          <label style="font-size:13px">Cantitate</label>
          <input type="number" class="input" min="1" value={qty()} onInput={(e) => setQty(Number(e.currentTarget.value) || 0)} />
          <label style="font-size:13px">Preț unitar cumpărare (opțional)</label>
          <input type="number" step="0.01" class="input" value={unitCost()} onInput={(e) => setUnitCost(e.currentTarget.value)} />
          <label style="font-size:13px">Notă (opțional, ex. furnizor)</label>
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
          <div style="font-size:13px;color:var(--text-muted)">
            <b>{props.row.name}</b><br />
            Stoc curent: <b>{props.row.qty}</b>
          </div>
          <label style="font-size:13px">Stoc nou</label>
          <input type="number" min="0" class="input" value={newQty()} onInput={(e) => setNewQty(Number(e.currentTarget.value) || 0)} />
          <label style="font-size:13px">Motiv / notă</label>
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
