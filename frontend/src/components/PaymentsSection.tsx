/**
 * Situația plăților unui bon: avans, plată, restituire.
 *
 * De ce separat de liniile bonului: un avans nu micșorează valoarea prestației.
 * Dacă l-am pune ca linie negativă ar deveni reducere comercială în e-Factura și
 * ar scădea baza de TVA — deci am raporta TVA mai mic decât cel datorat.
 */
import { For, Show, createEffect, createSignal, on, onMount } from "solid-js";
import {
  KIND_LABEL,
  addPayment,
  cachedPayments,
  deletePayment,
  loadPayments,
  paymentSign,
  type PaymentKind,
  type PaymentMethod,
  type PaymentsResponse,
} from "../store/paymentsStore";
import { notify } from "../store/notificationsStore";

const KINDS: PaymentKind[] = ["avans", "plata", "restituire"];
const METHODS: PaymentMethod[] = ["Cash", "Card", "OP", "Alta"];

function lei(v: string | number): string {
  return `${parseFloat(String(v)).toFixed(2)} lei`;
}

/** Momentul miscarii, despartit in data si ora — banii se urmaresc pe minut,
 *  nu doar pe zi (doua incasari in aceeasi zi trebuie distinse). */
function stamp(iso: string): { day: string; time: string; full: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "—", time: "", full: "" };
  return {
    day: d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }),
    full: d.toLocaleString("ro-RO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }),
  };
}

export default function PaymentsSection(props: {
  receiptId: string;
  readOnly?: boolean;
  /** De ce e blocata editarea — afisat sub lista, ca sa nu para defect. */
  readOnlyReason?: string;
  /** Amprenta starii bonului (status plata, total, updatedAt). Cand se schimba,
   *  recitim registrul: rest-ul de plata si miscarile generate automat de server
   *  depind de ea. Acopera si schimbarile venite prin SSE de pe alt dispozitiv,
   *  nu doar actiunile facute din acest card. */
  refreshKey?: number | string;
  /** Apelat dupa orice miscare salvata. Statusul bonului (`pay_method`,
   *  `partial_pay`) se recalculeaza pe server din registru, deci cardul trebuie
   *  sa reciteasca bonul — altfel ar afisa in continuare starea veche. */
  onChanged?: () => void;
}) {
  const [data, setData] = createSignal<PaymentsResponse | undefined>(cachedPayments(props.receiptId));
  const [loading, setLoading] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [kind, setKind] = createSignal<PaymentKind>("avans");
  const [amount, setAmount] = createSignal("");
  const [method, setMethod] = createSignal<PaymentMethod>("Cash");
  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  onMount(async () => {
    // Cache-ul e doar pentru primul randare instant; revalidam mereu, altfel un
    // card remontat ar arata o situatie invechita.
    setLoading(!data());
    try {
      setData(await loadPayments(props.receiptId));
    } catch {
      /* lipsa registrului nu trebuie sa blocheze cardul */
    } finally {
      setLoading(false);
    }
  });

  // Reciteste registrul cand se schimba starea bonului (status plata, total).
  createEffect(on(() => props.refreshKey, async () => {
    try {
      setData(await loadPayments(props.receiptId));
    } catch { /* pastram ce aveam */ }
  }, { defer: true }));

  async function handleAdd() {
    const val = parseFloat(amount());
    if (!val || val <= 0) {
      notify("Introdu o sumă mai mare decât zero.", "error");
      return;
    }
    setBusy(true);
    try {
      setData(await addPayment(props.receiptId, {
        kind: kind(),
        amount: val.toFixed(2),
        method: method(),
        note: note().trim() || null,
      }));
      setAmount("");
      setNote("");
      setShowForm(false);
      props.onChanged?.();
      notify(`${KIND_LABEL[kind()]} înregistrată.`, "success");
    } catch (e: any) {
      notify(e?.message ?? "Eroare la înregistrarea plății.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      setData(await deletePayment(props.receiptId, id));
      props.onChanged?.();
      notify("Înregistrare ștearsă.", "success");
    } catch (e: any) {
      notify(e?.message ?? "Eroare la ștergere.", "error");
    } finally {
      setBusy(false);
    }
  }

  const s = () => data()?.summary;
  const hasMovements = () => (data()?.payments.length ?? 0) > 0;

  return (
    <div class="rcard-extra-card">
      <div class="rcard-extra-title">Situație plăți</div>

      <Show when={loading()}>
        <div class="pay-empty">Se încarcă...</div>
      </Show>

      <Show when={hasMovements()}>
        <div class="pay-list">
          <For each={data()!.payments}>
            {(p) => (
              <div class="pay-row">
                <span class="pay-row-date" title={stamp(p.paid_at).full}>
                  <span class="pay-row-day">{stamp(p.paid_at).day}</span>
                  <span class="pay-row-time">{stamp(p.paid_at).time}</span>
                </span>
                <span class="pay-row-kind" classList={{ "pay-row-kind--out": p.kind === "restituire" }}>
                  {KIND_LABEL[p.kind]}
                </span>
                <span class="pay-row-method">{p.method}</span>
                <span class="pay-row-amount" classList={{ "pay-row-amount--out": p.kind === "restituire" }}>
                  {paymentSign(p.kind) < 0 ? "−" : "+"}{lei(p.amount)}
                </span>
                <Show when={!props.readOnly}>
                  <button
                    class="btn btn-ghost btn-xs pay-row-del"
                    disabled={busy()}
                    title="Șterge înregistrarea"
                    onClick={() => handleDelete(p.id)}
                  >
                    ✕
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="pay-summary">
          <div class="pay-summary-row">
            <span>Încasat</span><strong>{lei(s()!.incasat_net)}</strong>
          </div>
          <Show when={parseFloat(s()!.restituit) > 0}>
            <div class="pay-summary-row pay-summary-row--muted">
              <span>din care restituit</span><span>{lei(s()!.restituit)}</span>
            </div>
          </Show>
          {/* Rest negativ = clientul a dat mai mult decat valoarea bonului
              (tipic: s-a aplicat o reducere dupa incasare). „Rest de plata:
              -100" e derutant, asa ca schimbam eticheta si semnul. */}
          <Show
            when={parseFloat(s()!.rest_de_plata) < 0}
            fallback={
              <div class="pay-summary-row pay-summary-row--total">
                <span>Rest de plată</span>
                <strong classList={{ "pay-rest--zero": parseFloat(s()!.rest_de_plata) <= 0 }}>
                  {lei(s()!.rest_de_plata)}
                </strong>
              </div>
            }
          >
            <div class="pay-summary-row pay-summary-row--total">
              <span>De restituit clientului</span>
              <strong style="color:var(--warning)">{lei(Math.abs(parseFloat(s()!.rest_de_plata)))}</strong>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!hasMovements() && !loading()}>
        <div class="pay-empty">Nicio mișcare înregistrată.</div>
      </Show>

      <Show when={props.readOnly && props.readOnlyReason}>
        <div class="pay-locked">🔒 {props.readOnlyReason}</div>
      </Show>

      <Show when={!props.readOnly}>
        <Show
          when={showForm()}
          fallback={
            <button class="btn btn-ghost btn-sm w-full" style="margin-top:8px" onClick={() => setShowForm(true)}>
              + Adaugă avans / plată / restituire
            </button>
          }
        >
          <div class="pay-form">
            <div class="pay-form-kinds">
              <For each={KINDS}>
                {(k) => (
                  <button
                    class="btn btn-xs"
                    classList={{ "btn-primary": kind() === k, "btn-ghost": kind() !== k }}
                    onClick={() => setKind(k)}
                  >
                    {KIND_LABEL[k]}
                  </button>
                )}
              </For>
            </div>
            <div class="pay-form-row">
              {/* Increment de 10 lei (ca la avansul din Status plata); se pot
                  scrie si sume exacte de la tastatura. */}
              <input
                class="input"
                type="number"
                step="10"
                min="0"
                placeholder="Suma"
                value={amount()}
                onInput={(e) => setAmount(e.currentTarget.value)}
              />
              <select class="input" value={method()} onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}>
                <For each={METHODS}>{(m) => <option value={m}>{m}</option>}</For>
              </select>
            </div>
            <input
              class="input"
              placeholder="Observație (opțional)"
              value={note()}
              onInput={(e) => setNote(e.currentTarget.value)}
            />
            <div class="pay-form-actions">
              <button class="btn btn-ghost btn-sm" disabled={busy()} onClick={() => setShowForm(false)}>
                Renunță
              </button>
              <button class="btn btn-primary btn-sm" disabled={busy()} onClick={handleAdd}>
                {busy() ? "Se salvează..." : "Înregistrează"}
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
