import { For, Show, createSignal, onMount } from "solid-js";
import Modal from "./ui/Modal";
import DecimalInput from "./ui/DecimalInput";
import {
  addPayment, cachedPayments, deletePayment, loadPayments,
  KIND_LABEL, paymentSign,
  type PaymentMethod, type PaymentsResponse,
} from "../store/paymentsStore";
import { notify } from "../store/notificationsStore";
import { avansShortcuts, validateAvans } from "../utils/avans";

const METHODS: PaymentMethod[] = ["Cash", "Card", "OP", "Alta"];

function lei(v: string | number): string {
  return `${parseFloat(String(v)).toFixed(2)} lei`;
}

/**
 * Avansul incasat din POS. Spre deosebire de „Situație plăți” din Recepție, aici
 * se poate inregistra DOAR avans: tipul miscarii e fix, fara plata si fara
 * restituire. Un avans tastat gresit se poate sterge (cu confirmare); miscarile
 * de alt tip, facute din Recepție, apar doar informativ.
 */
export default function PosAvansModal(props: {
  receiptId: string;
  onClose: () => void;
  /** Apelat dupa fiecare avans adaugat sau sters (statusul bonului se schimba pe server). */
  onChanged?: () => void;
}) {
  const [data, setData] = createSignal<PaymentsResponse | undefined>(cachedPayments(props.receiptId));
  const [loading, setLoading] = createSignal(true);
  const [loadErr, setLoadErr] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [method, setMethod] = createSignal<PaymentMethod>("Cash");
  const [err, setErr] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [confirmDelId, setConfirmDelId] = createSignal<number | null>(null);
  let amountEl: HTMLInputElement | undefined;

  onMount(async () => {
    try {
      setData(await loadPayments(props.receiptId));
    } catch (e: unknown) {
      // Fara registru nu stim restul de plata, deci nu lasam sa se incaseze pe ghicite.
      setLoadErr(e instanceof Error ? e.message : "Eroare la încărcarea plăților.");
    } finally {
      setLoading(false);
      amountEl?.focus();
    }
  });

  const s = () => data()?.summary;
  const ready = () => !loading() && !loadErr() && !!s();
  /** Sume rotunde, doar cele mai mici decat totalul devizului (vezi avansShortcuts). */
  const shortcuts = () => {
    const sum = s();
    return sum ? avansShortcuts({ total: parseFloat(sum.total_bon), rest: parseFloat(sum.rest_de_plata) }) : [];
  };

  async function handleAdd() {
    const sum = s();
    if (!sum || busy()) return;
    const check = validateAvans(amount(), {
      total: parseFloat(sum.total_bon),
      rest: parseFloat(sum.rest_de_plata),
    });
    if (!check.ok) { setErr(check.message); return; }
    setErr("");
    setBusy(true);
    try {
      setData(await addPayment(props.receiptId, {
        kind: "avans",
        amount: check.amount.toFixed(2),
        method: method(),
      }));
      props.onChanged?.();
      notify(`Avans de ${lei(check.amount)} înregistrat.`, "success");
      // Avansul e luat: operatorul se intoarce la cos. Pentru inca un avans sau
      // pentru a sterge unul gresit, fereastra se redeschide din acelasi buton.
      props.onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Eroare la înregistrarea avansului.");
      // Campul a fost dezactivat cat a durat cererea, deci a pierdut focusul.
      queueMicrotask(() => amountEl?.focus());
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (busy()) return;
    setBusy(true);
    try {
      setData(await deletePayment(props.receiptId, id));
      setConfirmDelId(null);
      props.onChanged?.();
      notify("Avans șters.", "success");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Eroare la ștergerea avansului.");
      setConfirmDelId(null);
      // Lista poate fi invechita (avans sters deja de pe alt dispozitiv): o recitim,
      // altfel randul ar ramane afisat si fiecare incercare ar da aceeasi eroare.
      try { setData(await loadPayments(props.receiptId)); } catch { /* ramane lista veche */ }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Avans"
      size="sm"
      onClose={() => { if (!busy()) props.onClose(); }}
      closeDisabled={busy()}
      bodyClass="sl-modal-body--stack"
      footer={<>
        <button class="btn btn-ghost btn-sm" disabled={busy()} onClick={() => props.onClose()}>Închide</button>
        <button class="btn btn-primary btn-sm" disabled={busy() || !ready()} onClick={handleAdd}>
          {busy() ? "Se salvează..." : "Înregistrează avans"}
        </button>
      </>}
    >
      <div class="pos-avans">
        <Show when={loadErr()}>
          <div class="pos-avans-err" role="alert">{loadErr()}</div>
        </Show>

        <label class="pos-avans-label" for="pos-avans-suma">Suma avans (lei)</label>
        <DecimalInput
          id="pos-avans-suma"
          class="input pos-avans-input"
          maxDecimals={2}
          placeholder="ex. 200"
          value={amount()}
          disabled={!ready() || busy()}
          ref={(el: HTMLInputElement) => (amountEl = el)}
          onInput={(raw) => { setAmount(raw); setErr(""); }}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") void handleAdd(); }}
        />

        <Show when={ready() && shortcuts().length > 0}>
          <div class="pos-avans-shortcuts" role="group" aria-label="Sume rapide">
            <For each={shortcuts()}>
              {(v) => (
                <button
                  type="button"
                  class="btn btn-sm"
                  classList={{ "btn-primary": amount() === String(v), "btn-ghost": amount() !== String(v) }}
                  disabled={busy()}
                  onClick={() => { setAmount(String(v)); setErr(""); amountEl?.focus(); }}
                >
                  {v}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="pos-avans-label">Metodă</div>
        <div class="pos-avans-methods" role="group" aria-label="Metodă de încasare">
          <For each={METHODS}>
            {(m) => (
              <button
                type="button"
                class="btn btn-sm"
                classList={{ "btn-primary": method() === m, "btn-ghost": method() !== m }}
                aria-pressed={method() === m}
                disabled={busy()}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            )}
          </For>
        </div>

        <Show when={err()}>
          <div class="pos-avans-err" role="alert">{err()}</div>
        </Show>

        <Show when={loading()}>
          <div class="pay-empty">Se încarcă...</div>
        </Show>

        <Show when={s()}>
          {(sum) => (
            <div class="pay-summary">
              <div class="pay-summary-row">
                <span>Total deviz</span><span>{lei(sum().total_bon)}</span>
              </div>
              <div class="pay-summary-row">
                <span>Încasat până acum</span><strong>{lei(sum().incasat_net)}</strong>
              </div>
              <div class="pay-summary-row pay-summary-row--total">
                <span>Rest de plată</span>
                <strong>{lei(Math.max(0, parseFloat(sum().rest_de_plata)))}</strong>
              </div>
            </div>
          )}
        </Show>

        <Show when={(data()?.payments.length ?? 0) > 0}>
          <div class="pay-list">
            <For each={data()!.payments}>
              {(p) => (
                <div class="pay-row">
                  <span class="pay-row-kind" classList={{ "pay-row-kind--out": p.kind === "restituire" }}>
                    {KIND_LABEL[p.kind]}
                  </span>
                  <span class="pay-row-method">{p.method}</span>
                  <span class="pay-row-amount" classList={{ "pay-row-amount--out": p.kind === "restituire" }}>
                    {paymentSign(p.kind) < 0 ? "−" : "+"}{lei(p.amount)}
                  </span>
                  {/* Din POS se sterg doar avansurile; restul miscarilor tin de Recepție. */}
                  <Show when={p.kind === "avans"}>
                    <Show
                      when={confirmDelId() === p.id}
                      fallback={
                        <button
                          class="btn btn-ghost btn-xs pay-row-del"
                          // Nu se sterge de pe o lista inca neincarcata (cea din cache poate fi veche).
                          disabled={busy() || !ready()}
                          title="Șterge avansul"
                          onClick={() => setConfirmDelId(p.id)}
                        >
                          ✕
                        </button>
                      }
                    >
                      <span class="pos-avans-confirm">
                        Ștergi avansul?
                        <button class="btn btn-danger btn-xs" disabled={busy() || !ready()} onClick={() => void handleDelete(p.id)}>Da, șterge</button>
                        <button class="btn btn-ghost btn-xs" disabled={busy()} onClick={() => setConfirmDelId(null)}>Nu</button>
                      </span>
                    </Show>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="pos-avans-hint">Restituirea și plata finală se fac din Recepție.</div>
      </div>
    </Modal>
  );
}
