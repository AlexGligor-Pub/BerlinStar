import { Show, createSignal, onCleanup } from "solid-js";
import { apiFetch, readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";

// Stripe.js e incarcat lazy via dynamic import — tipul Stripe/StripeElements
// nu e specificat ca import static ca sa nu strice tsc daca @stripe/stripe-js
// nu e inca instalat in node_modules pana la docker rebuild.
type StripeAny = any;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface CheckoutResponse {
  client_secret: string;
  payment_intent_id: string;
  amount_ron: number;
  amount_eur: number;
  vat_amount_ron: number;
  fx_rate: number;
  fx_date: string;
  currency: string;
  publishable_key: string;
}

interface CustomerForm {
  nume: string;
  tip: "juridic" | "fizic";
  cui: string;
  email: string;
  telefon: string;
  street: string;
  city: string;
  county_code: string;
  postal_code: string;
  country_code: string;
}

const DEFAULT_FORM: CustomerForm = {
  nume: "",
  tip: "juridic",
  cui: "",
  email: "",
  telefon: "",
  street: "",
  city: "",
  county_code: "RO-B",
  postal_code: "",
  country_code: "RO",
};

export default function SubscriptionCheckoutModal(props: Props) {
  const [form, setForm] = createSignal<CustomerForm>({ ...DEFAULT_FORM });
  const [step, setStep] = createSignal<"form" | "pay" | "processing">("form");
  const [intent, setIntent] = createSignal<CheckoutResponse | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  let stripe: StripeAny = null;
  let elements: StripeAny = null;
  let paymentMount: HTMLDivElement | undefined;

  function setField<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submitForm(e: Event) {
    e.preventDefault();
    setError("");
    const f = form();
    if (!f.nume.trim()) { setError("Denumirea / numele este obligatorie."); return; }
    if (f.tip === "juridic" && !f.cui.trim()) {
      setError("CUI-ul este obligatoriu pentru persoane juridice.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ customer: { ...f } }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<{ detail?: string }>(res);
        setError(d.detail || "Eroare la iniţierea plăţii.");
        return;
      }
      const data = (await res.json()) as CheckoutResponse;
      if (!data.publishable_key) {
        setError("Cheia publică Stripe nu este configurată. Contactează adminul BerlinStar.");
        return;
      }
      setIntent(data);
      setStep("pay");
      // initializeaza Stripe.js asincron dupa montaj
      requestAnimationFrame(() => void mountStripe(data));
    } catch {
      setError("Eroare de conexiune.");
    } finally {
      setLoading(false);
    }
  }

  async function mountStripe(data: CheckoutResponse) {
    try {
      // Import dinamic ca Vite sa nu cada in dev daca pachetul nu e instalat
      const mod = await import(/* @vite-ignore */ "@stripe/stripe-js");
      stripe = await mod.loadStripe(data.publishable_key);
      if (!stripe) {
        setError("Stripe.js nu s-a putut încărca.");
        return;
      }
      elements = stripe.elements({ clientSecret: data.client_secret });
      const payEl = elements.create("payment");
      if (paymentMount) payEl.mount(paymentMount);
    } catch {
      setError("Eroare la încărcarea Stripe.");
    }
  }

  async function confirmPayment(e: Event) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    setStep("processing");
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href.split("?")[0] + "?topic=abonament&payment=success",
      },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message || "Plata a eşuat.");
      setStep("pay");
      return;
    }
    notify("Plata a fost confirmată. Procesăm factura...", "success");
    props.onSuccess();
  }

  onCleanup(() => {
    // Stripe Elements se cureata singur la unmount-ul nodului
  });

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" style="max-width:560px" onClick={(e) => e.stopPropagation()}>
        <div class="sl-modal-header">
          <span class="sl-modal-title">Plată abonament BerlinStar</span>
          <Show when={step() !== "processing"}>
            <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
          </Show>
        </div>

        <Show when={step() === "form"}>
          <form onSubmit={submitForm} autocomplete="off">
            <div class="sl-modal-body" style="padding:20px 24px">
              <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">
                Completează datele clientului — apar pe factura emisă de
                BerlinStar SRL şi se transmit la ANAF SPV.
              </p>
              <div class="form-group">
                <label class="form-label">Tip client</label>
                <select
                  class="input"
                  value={form().tip}
                  onChange={(e) => setField("tip", e.currentTarget.value as "juridic" | "fizic")}
                >
                  <option value="juridic">Persoană juridică (firmă)</option>
                  <option value="fizic">Persoană fizică</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Denumire / nume complet</label>
                <input class="input" value={form().nume} onInput={(e) => setField("nume", e.currentTarget.value)} maxLength={255} />
              </div>
              <div class="form-group">
                <label class="form-label">{form().tip === "juridic" ? "CUI" : "CNP (opţional)"}</label>
                <input class="input" value={form().cui} onInput={(e) => setField("cui", e.currentTarget.value)} maxLength={20} />
              </div>
              <div class="form-group">
                <label class="form-label">Email (pentru chitanţa Stripe)</label>
                <input class="input" type="email" value={form().email} onInput={(e) => setField("email", e.currentTarget.value)} maxLength={255} />
              </div>
              <div class="form-group">
                <label class="form-label">Telefon</label>
                <input class="input" value={form().telefon} onInput={(e) => setField("telefon", e.currentTarget.value)} maxLength={50} />
              </div>
              <div class="form-group">
                <label class="form-label">Adresă (strada, nr.)</label>
                <input class="input" value={form().street} onInput={(e) => setField("street", e.currentTarget.value)} maxLength={255} />
              </div>
              <div style="display:grid;gap:8px;grid-template-columns:2fr 1fr 1fr">
                <div class="form-group">
                  <label class="form-label">Localitate</label>
                  <input class="input" value={form().city} onInput={(e) => setField("city", e.currentTarget.value)} maxLength={100} />
                </div>
                <div class="form-group">
                  <label class="form-label">Cod judeţ</label>
                  <input class="input" value={form().county_code} onInput={(e) => setField("county_code", e.currentTarget.value)} maxLength={10} placeholder="RO-B" />
                </div>
                <div class="form-group">
                  <label class="form-label">Cod poştal</label>
                  <input class="input" value={form().postal_code} onInput={(e) => setField("postal_code", e.currentTarget.value)} maxLength={20} />
                </div>
              </div>
              <Show when={error()}>
                <div class="login-error" style="margin:8px 0">{error()}</div>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose} disabled={loading()}>Anulează</button>
              <button type="submit" class="btn btn-primary btn-sm" disabled={loading()}>
                {loading() ? "Se iniţiază…" : "Continuă spre plată"}
              </button>
            </div>
          </form>
        </Show>

        <Show when={step() === "pay" || step() === "processing"}>
          <div class="sl-modal-body" style="padding:20px 24px">
            <Show when={intent()}>
              {(d) => (
                <div style="background:var(--surface-2,#f1f5f9);padding:10px 12px;border-radius:6px;margin-bottom:14px;font-size:13px">
                  <div><strong>Sumă:</strong> {d().amount_ron.toFixed(2)} RON ({d().amount_eur.toFixed(2)} EUR brut)</div>
                  <div><strong>Curs BNR:</strong> 1 EUR = {d().fx_rate.toFixed(4)} RON (data {d().fx_date})</div>
                </div>
              )}
            </Show>
            <div ref={paymentMount} style="min-height:240px" />
            <Show when={error()}>
              <div class="login-error" style="margin:8px 0">{error()}</div>
            </Show>
          </div>
          <div class="sl-modal-footer">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onClick={props.onClose}
              disabled={step() === "processing"}
            >Anulează</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onClick={confirmPayment}
              disabled={step() === "processing"}
            >
              {step() === "processing" ? "Se procesează…" : "Plăteşte acum"}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
