/**
 * Reducere aplicată pe un bon din Recepție.
 *
 * Reducerea se aplică PE FIECARE LINIE din categoria aleasă, scăzând procentul
 * din prețul liniei — nu ca o singură linie negativă. Motivul e financiar:
 *   - targetul angajatului se calculează per linie, deci un „minus" global
 *     neatribuit ar lăsa targeturile umflate;
 *   - profitabilitatea pe produs se calculează per linie, la fel;
 *   - TVA-ul pe linie rămâne corect fără să spargem reducerea pe cote;
 *   - e-Factura primește prețuri unitare pozitive (BR-27), fără linii negative.
 *
 * Prețul de listă se păstrează în `originalPrice`, ca reducerea să poată fi
 * eliminată sau recalculată fără să se compună.
 */
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import Modal from "./ui/Modal";
import type { CartItem } from "../store/cartStore";
import type { Receipt } from "../store/receiptsStore";
import { updateReceiptContent } from "../store/receiptsStore";
import { notify } from "../store/notificationsStore";

export type DiscountScope = "produse" | "servicii" | "ambele";

const SCOPE_LABEL: Record<DiscountScope, string> = {
  produse: "Doar produse",
  servicii: "Doar servicii",
  ambele: "Produse și servicii",
};

function matchesScope(i: CartItem, scope: DiscountScope): boolean {
  if (scope === "ambele") return true;
  if (scope === "produse") return i.itemType === "Produs";
  return i.itemType === "Service";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function lei(n: number): string {
  return `${n.toFixed(2)} lei`;
}

/** Linia curățată de orice reducere aplicată anterior. */
function withoutDiscount(i: CartItem): CartItem {
  return i.originalPrice != null ? { ...i, price: i.originalPrice, originalPrice: null } : i;
}

/** Totalul bonului, calculat la fel ca pe server (`_verify_total_against_items`):
 *  brut per linie când avem TVA pe linie, altfel preț × cantitate (prețurile din
 *  POS includ deja TVA). */
function computeTotal(items: CartItem[]): number {
  const allHaveVat = items.length > 0 && items.every((i) => i.vatPercent != null);
  if (!allHaveVat) return round2(items.reduce((s, i) => s + i.price * i.qty, 0));
  return round2(items.reduce((s, i) => s + round2(i.price * i.qty * (1 + (i.vatPercent ?? 0) / 100)), 0));
}

export default function DiscountModal(props: {
  open: boolean;
  receipt: Receipt;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [scope, setScope] = createSignal<DiscountScope>("ambele");
  const [mode, setMode] = createSignal<"procent" | "suma">("procent");
  const [percent, setPercent] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [err, setErr] = createSignal("");

  /** Bonul cu prețurile de listă — punctul de plecare al oricărui calcul, ca o
   *  reducere nouă să nu se aplice peste una veche. */
  const pristine = createMemo(() => props.receipt.items.map(withoutDiscount));

  function linesFor(s: DiscountScope): CartItem[] {
    return pristine().filter((i) => i.price > 0 && matchesScope(i, s));
  }
  function baseFor(s: DiscountScope): number {
    return round2(linesFor(s).reduce((sum, i) => sum + i.price * i.qty, 0));
  }

  /** O categorie e disponibilă doar dacă bonul chiar are linii de tipul ăla. */
  const available = createMemo<Record<DiscountScope, boolean>>(() => ({
    produse: linesFor("produse").length > 0,
    servicii: linesFor("servicii").length > 0,
    ambele: linesFor("ambele").length > 0,
  }));

  /**
   * Opțiunile arătate operatorului. Ascundem, nu dezactivăm:
   *   - categoriile care nu există pe bon;
   *   - „Produse și servicii" când n-ar schimba nimic — pe un bon numai cu
   *     produse ar da exact aceeași bază ca „Doar produse", deci ar fi două
   *     butoane pentru același lucru.
   * Rămâne relevantă când există ambele categorii, sau când există linii fără
   * categorie (adăugate manual în POS), care intră doar la „ambele".
   */
  const visibleScopes = createMemo<DiscountScope[]>(() => {
    const av = available();
    const list: DiscountScope[] = [];
    if (av.produse) list.push("produse");
    if (av.servicii) list.push("servicii");
    const widest = Math.max(baseFor("produse"), baseFor("servicii"));
    if (av.ambele && round2(baseFor("ambele")) > round2(widest)) list.push("ambele");
    return list;
  });

  // Selecția implicită e cea mai cuprinzătoare opțiune disponibilă. Dacă bonul
  // se schimbă și opțiunea curentă dispare, comutăm pe una validă.
  createEffect(() => {
    const list = visibleScopes();
    if (list.length === 0 || list.includes(scope())) return;
    changeScope(list.includes("ambele") ? "ambele" : list[0]);
  });

  const baseLines = createMemo(() => linesFor(scope()));
  const base = createMemo(() => baseFor(scope()));

  /** Linii fără categorie (adăugate manual în POS): intră doar la „ambele". */
  const untypedCount = createMemo(
    () => pristine().filter((i) => i.price > 0 && i.itemType == null).length,
  );

  const hasDiscount = createMemo(() => props.receipt.items.some((i) => i.originalPrice != null));
  const currentDiscount = createMemo(() =>
    round2(
      props.receipt.items
        .filter((i) => i.originalPrice != null)
        .reduce((s, i) => s + (i.originalPrice! - i.price) * i.qty, 0),
    ),
  );

  const amountValue = createMemo(() => {
    const v = parseFloat(amount());
    return Number.isFinite(v) ? round2(v) : 0;
  });

  function syncFromPercent(v: string, b = base()) {
    setPercent(v);
    const p = parseFloat(v);
    setAmount(Number.isFinite(p) ? round2((b * p) / 100).toFixed(2) : "");
  }

  function syncFromAmount(v: string, b = base()) {
    setAmount(v);
    const a = parseFloat(v);
    setPercent(b > 0 && Number.isFinite(a) ? round2((a / b) * 100).toFixed(2) : "");
  }

  function changeScope(s: DiscountScope) {
    if (!available()[s]) return;
    setScope(s);
    // Recalculăm perechea pe noua bază, păstrând valoarea tastată de operator.
    const b = baseFor(s);
    if (mode() === "procent") syncFromPercent(percent(), b);
    else syncFromAmount(amount(), b);
  }

  /** Fracția de reducere, dedusă din sumă: o folosim ca să scădem proporțional
   *  din fiecare linie, indiferent dacă operatorul a introdus procent sau sumă. */
  const ratio = createMemo(() => (base() > 0 ? amountValue() / base() : 0));

  /** Liniile rezultate: prețul redus + prețul de listă păstrat.
   *
   *  Alocarea ține evidența a ceea ce s-a scăzut EFECTIV, nu a ceea ce s-a
   *  intenționat. Prețul unitar are doar două zecimale, deci pe o linie cu
   *  qty > 1 o reducere de 10 lei nu se poate împărți exact (10/3 = 3.3333 →
   *  3.33 × 3 = 9.99). Dacă am aduna intenția, ultima linie ar „corecta" o
   *  diferență care de fapt nu s-a produs, iar totalul afișat ar fi cu câțiva
   *  bani lângă cel salvat. Așa, restul se propagă corect spre ultima linie.
   */
  function buildItems(): CartItem[] {
    const target = amountValue();
    const selected = new Set(baseLines().map((i) => i.lineId));
    let allocated = 0;
    const lastId = baseLines()[baseLines().length - 1]?.lineId;

    return pristine().map((i) => {
      if (!selected.has(i.lineId)) return i;
      const lineBase = round2(i.price * i.qty);
      const wanted = i.lineId === lastId ? round2(target - allocated) : round2(lineBase * ratio());
      if (wanted <= 0) return i;
      // Reducerea se distribuie pe cantitate: prețul unitar scade cu cut/qty.
      const newPrice = round2(i.price - wanted / i.qty);
      const applied = round2((i.price - newPrice) * i.qty);
      if (applied <= 0) return i;
      allocated = round2(allocated + applied);
      return { ...i, price: newPrice, originalPrice: i.price };
    });
  }

  const preview = createMemo(() => buildItems());
  const newTotal = createMemo(() => computeTotal(preview()));

  /** Cât se scade în realitate, după rotunjirea prețurilor unitare. Poate
   *  diferi de suma cerută cu câțiva bani pe bonuri cu cantități mari; afișăm
   *  valoarea reală, ca „Total actual − Reducere" să dea exact „Total nou". */
  const appliedDiscount = createMemo(() =>
    round2(
      preview()
        .filter((i) => i.originalPrice != null)
        .reduce((sum, i) => sum + (i.originalPrice! - i.price) * i.qty, 0),
    ),
  );

  const problem = createMemo(() => {
    if (base() <= 0) return "Bonul nu are linii în categoria aleasă.";
    if (amountValue() <= 0) return null;
    if (amountValue() > base()) return `Reducerea depășește baza de calcul (${lei(base())}).`;
    return null;
  });

  const canApply = createMemo(() => !problem() && amountValue() > 0 && !saving());

  /** Salvează bonul cu alt set de linii. `updateReceiptContent` cere obiectul
   *  întreg, deci pornim de la bonul curent și înlocuim liniile și totalul. */
  async function saveItems(items: CartItem[]): Promise<void> {
    const {
      id, efacturaStatus, efacturaLocked, efacturaError, efacturaIndexIncarcare,
      ...rest
    } = props.receipt;
    await updateReceiptContent(id, { ...rest, items, total: computeTotal(items) });
  }

  async function apply() {
    setErr("");
    if (!canApply()) return;
    setSaving(true);
    try {
      const applied = appliedDiscount();
      await saveItems(preview());
      notify(`Reducere de ${lei(applied)} aplicată pe ${baseLines().length} linii.`, "success");
      props.onApplied?.();
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Eroare la aplicarea reducerii.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDiscount() {
    setErr("");
    setSaving(true);
    try {
      await saveItems(pristine());
      notify("Reducerea a fost eliminată.", "success");
      props.onApplied?.();
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Eroare la eliminarea reducerii.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title="Reducere" size="sm">
      <Show when={hasDiscount()}>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:12px;font-size:12.5px">
          Bonul are deja o reducere de <strong>{lei(currentDiscount())}</strong>. O
          reducere nouă se calculează din prețurile de listă, nu peste cea existentă.
        </div>
      </Show>

      <div class="form-group">
        <label class="form-label">Se aplică pe</label>
        <Show
          when={visibleScopes().length > 1}
          fallback={
            // O singură categorie pe bon: nu are ce alege, doar îi spunem care e.
            <div style="font-size:13px;padding:4px 0">
              <strong>{SCOPE_LABEL[visibleScopes()[0] ?? "ambele"]?.replace("Doar ", "")}</strong>
              <span style="color:var(--text-muted)"> — singura categorie de pe acest bon</span>
            </div>
          }
        >
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <For each={visibleScopes()}>
              {(s) => (
                <button
                  type="button"
                  class="btn btn-sm"
                  classList={{ "btn-primary": scope() === s, "btn-ghost": scope() !== s }}
                  style="font-size:12px"
                  onClick={() => changeScope(s)}
                >
                  {SCOPE_LABEL[s]}
                </button>
              )}
            </For>
          </div>
        </Show>
        <div style="margin-top:6px;font-size:0.78rem;color:var(--text-muted)">
          Bază de calcul: <strong>{lei(base())}</strong> din {baseLines().length}{" "}
          {baseLines().length === 1 ? "linie" : "linii"}; reducerea se scade
          proporțional din fiecare.
          <Show when={scope() !== "ambele" && untypedCount() > 0}>
            {" "}({untypedCount()} fără categorie, incluse doar la „Produse și servicii".)
          </Show>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Procent</label>
          <div style="display:flex;align-items:center;gap:6px">
            <input
              class="input"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="0"
              value={percent()}
              onFocus={() => setMode("procent")}
              onInput={(e) => syncFromPercent(e.currentTarget.value)}
            />
            <span style="font-size:0.9rem">%</span>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Sumă</label>
          <div style="display:flex;align-items:center;gap:6px">
            <input
              class="input"
              type="number"
              min="0"
              step="10"
              placeholder="0.00"
              value={amount()}
              onFocus={() => setMode("suma")}
              onInput={(e) => syncFromAmount(e.currentTarget.value)}
            />
            <span style="font-size:0.9rem">lei</span>
          </div>
        </div>
      </div>
      <div style="margin-top:6px;font-size:0.78rem;color:var(--text-muted)">
        Completează oricare dintre cele două — cealaltă se calculează automat.
      </div>

      <Show when={amountValue() > 0 && !problem()}>
        <div style="margin-top:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <div style="background:var(--surface2);padding:6px 10px;font-size:11.5px;font-weight:600;color:var(--text-muted)">
            Preț pe linie după reducere
          </div>
          <div style="max-height:150px;overflow:auto">
            <For each={preview().filter((i) => i.originalPrice != null)}>
              {(i) => (
                <div style="display:flex;justify-content:space-between;gap:10px;padding:5px 10px;font-size:12px;border-top:1px solid var(--border)">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}
                  </span>
                  <span style="white-space:nowrap">
                    <span style="color:var(--text-muted);text-decoration:line-through">
                      {i.originalPrice!.toFixed(2)}
                    </span>{" "}
                    <strong>{i.price.toFixed(2)}</strong>
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:grid;gap:4px;font-size:13px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Total actual</span>
          <span>{lei(props.receipt.total)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Reducere</span>
          <span style="color:var(--danger)">− {lei(appliedDiscount())}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700">
          <span>Total nou</span>
          <span>{lei(newTotal())}</span>
        </div>
      </div>

      <Show when={problem()}>
        <div class="login-error" style="margin:10px 0 0">{problem()}</div>
      </Show>
      <Show when={err()}>
        <div class="login-error" style="margin:10px 0 0">{err()}</div>
      </Show>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <Show when={hasDiscount()}>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            style="margin-right:auto;color:var(--danger)"
            disabled={saving()}
            onClick={() => void removeDiscount()}
          >
            Elimină reducerea
          </button>
        </Show>
        <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
        <button type="button" class="btn btn-primary btn-sm" disabled={!canApply()} onClick={() => void apply()}>
          {saving() ? "Se aplică…" : "Aplică reducerea"}
        </button>
      </div>
    </Modal>
  );
}
