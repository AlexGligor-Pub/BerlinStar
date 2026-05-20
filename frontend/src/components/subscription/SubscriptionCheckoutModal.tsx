import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { apiFetch, readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { CompanyItem } from "../../pages/configurari/types";

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

export default function SubscriptionCheckoutModal(props: Props) {
  const [companies, setCompanies] = createSignal<CompanyItem[]>([]);
  const [companiesLoading, setCompaniesLoading] = createSignal(true);
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [email, setEmail] = createSignal("");

  const [step, setStep] = createSignal<"form" | "pay" | "processing">("form");
  const [intent, setIntent] = createSignal<CheckoutResponse | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  let stripe: StripeAny = null;
  let elements: StripeAny = null;
  let paymentMount: HTMLDivElement | undefined;

  const selectedCompany = createMemo(() =>
    companies().find(c => c.id === selectedId()) ?? null
  );

  onMount(async () => {
    try {
      const res = await apiFetch("/api/companies?limit=200");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = (data.items ?? []) as CompanyItem[];
      setCompanies(list);
      if (list.length > 0) setSelectedId(list[0].id);
    } catch {
      setError("Eroare la încărcarea companiilor.");
    } finally {
      setCompaniesLoading(false);
    }
  });

  async function submitForm(e: Event) {
    e.preventDefault();
    setError("");
    const c = selectedCompany();
    if (!c) { setError("Selectează o companie."); return; }
    if (!email().trim()) { setError("Emailul este obligatoriu pentru chitanţa Stripe."); return; }

    setLoading(true);
    try {
      const customer = {
        nume: c.name,
        tip: "juridic" as const,
        cui: String(c.cui),
        email: email().trim(),
        telefon: c.phone ?? "",
        street: c.address ?? "",
        city: "",
        county_code: "RO-B",
        postal_code: c.postal_code ?? "",
        country_code: "RO",
      };
      const res = await apiFetch("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ customer }),
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
      requestAnimationFrame(() => void mountStripe(data));
    } catch {
      setError("Eroare de conexiune.");
    } finally {
      setLoading(false);
    }
  }

  async function mountStripe(data: CheckoutResponse) {
    try {
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
                Selectează compania pentru care emiţi factura — datele sunt
                preluate din Configurări → Companii şi se transmit la ANAF SPV.
              </p>

              <Show when={companiesLoading()}>
                <p style="color:var(--text-muted);font-size:13px">Se încarcă companiile…</p>
              </Show>

              <Show when={!companiesLoading() && companies().length === 0}>
                <div class="login-error" style="margin:8px 0">
                  Nu există companii configurate. Adaugă una în
                  Configurări → Companii înainte de a continua.
                </div>
              </Show>

              <Show when={!companiesLoading() && companies().length > 0}>
                <div class="form-group">
                  <label class="form-label">Companie</label>
                  <select
                    class="input"
                    value={selectedId() ?? ""}
                    onChange={(e) => setSelectedId(Number(e.currentTarget.value))}
                  >
                    <For each={companies()}>
                      {(c) => (
                        <option value={c.id}>{c.name} — CUI {c.cui}</option>
                      )}
                    </For>
                  </select>
                </div>

                <Show when={selectedCompany()}>
                  {(c) => (
                    <div style="background:var(--surface-2,#f1f5f9);padding:10px 12px;border-radius:6px;margin:4px 0 12px;font-size:12px;line-height:1.5">
                      <div><strong>CUI:</strong> {c().cui}</div>
                      <Show when={c().address}>
                        <div><strong>Adresă:</strong> {c().address}</div>
                      </Show>
                      <Show when={c().phone}>
                        <div><strong>Telefon:</strong> {c().phone}</div>
                      </Show>
                    </div>
                  )}
                </Show>

                <div class="form-group">
                  <label class="form-label">Email (pentru chitanţa Stripe)</label>
                  <input
                    class="input"
                    type="email"
                    required
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    maxLength={255}
                  />
                </div>
              </Show>

              <Show when={error()}>
                <div class="login-error" style="margin:8px 0">{error()}</div>
              </Show>
            </div>
            <div class="sl-modal-footer">
              <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose} disabled={loading()}>Anulează</button>
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                disabled={loading() || companiesLoading() || !selectedCompany()}
              >
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
