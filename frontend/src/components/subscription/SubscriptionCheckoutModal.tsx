import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { CompanyItem } from "../../pages/configurari/types";
import {
  subscriptionApi,
  type AmountsOut,
  type CheckoutCustomer,
  type CheckoutResponse,
  type CheckoutSessionResponse,
  type PaymentItem,
} from "../../api/subscription";

// Stripe.js e incarcat lazy; tipurile nu sunt importate static ca sa nu
// strice tsc daca @stripe/stripe-js lipseste din node_modules.
type StripeAny = any;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Method = "card" | "qr";
type Step = "form" | "pay" | "qr" | "waiting";

const POLL_MS = 3000;
// La fiecare al N-lea poll cerem reconcilierea cu Stripe: acopera dev-ul local fara webhook.
const SYNC_EVERY = 4;
const FINAL: ReadonlySet<string> = new Set(["succeeded", "failed", "canceled"]);

function returnUrl(): string {
  const u = new URL(window.location.href);
  u.hash = "";
  u.search = "";
  u.searchParams.set("topic", "abonament");
  return u.toString();
}

export default function SubscriptionCheckoutModal(props: Props) {
  const [companies, setCompanies] = createSignal<CompanyItem[]>([]);
  const [companiesLoading, setCompaniesLoading] = createSignal(true);
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [email, setEmail] = createSignal("");
  const [method, setMethod] = createSignal<Method>("qr");

  const [step, setStep] = createSignal<Step>("form");
  const [amounts, setAmounts] = createSignal<AmountsOut | null>(null);
  const [session, setSession] = createSignal<CheckoutSessionResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = createSignal("");
  const [secondsLeft, setSecondsLeft] = createSignal<number | null>(null);
  const [payment, setPayment] = createSignal<PaymentItem | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);

  let stripe: StripeAny = null;
  let elements: StripeAny = null;
  let paymentMount: HTMLDivElement | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  let pollCount = 0;

  const selectedCompany = createMemo(() => companies().find((c) => c.id === selectedId()) ?? null);

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

  onCleanup(stopTimers);

  function stopTimers() {
    if (pollTimer) clearInterval(pollTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    pollTimer = undefined;
    countdownTimer = undefined;
  }

  function buildCustomer(c: CompanyItem): CheckoutCustomer {
    return {
      nume: c.name,
      tip: "juridic",
      cui: String(c.cui),
      email: email().trim(),
      telefon: c.phone ?? null,
      street: c.address ?? null,
      city: c.city ?? null,
      county_code: c.county_code ?? null,
      postal_code: c.postal_code ?? null,
      country_code: "RO",
    };
  }

  async function submitForm(e: Event) {
    e.preventDefault();
    setError("");
    const c = selectedCompany();
    if (!c) { setError("Selectează o companie."); return; }
    if (!email().trim()) { setError("Emailul este obligatoriu pentru chitanţa Stripe."); return; }

    setLoading(true);
    try {
      const customer = buildCustomer(c);
      if (method() === "qr") {
        const data = await subscriptionApi.checkoutSession(customer, returnUrl());
        setAmounts(data);
        setSession(data);
        await renderQr(data.url);
        startCountdown(data.expires_at);
        startPolling(data.payment_id);
        setStep("qr");
      } else {
        const data = await subscriptionApi.checkout(customer);
        if (!data.publishable_key) {
          setError("Cheia publică Stripe nu este configurată. Contactează adminul BerlinStar.");
          return;
        }
        setAmounts(data);
        setStep("pay");
        requestAnimationFrame(() => void mountStripe(data));
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Eroare la iniţierea plăţii.");
    } finally {
      setLoading(false);
    }
  }

  async function renderQr(url: string) {
    const QRCode = await import("qrcode");
    setQrDataUrl(await QRCode.toDataURL(url, { width: 280, margin: 1, errorCorrectionLevel: "M" }));
  }

  function startCountdown(expiresAt: string) {
    const end = new Date(expiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function startPolling(paymentId: number) {
    pollCount = 0;
    pollTimer = setInterval(() => void poll(paymentId), POLL_MS);
  }

  async function poll(paymentId: number, forceSync = false) {
    pollCount += 1;
    try {
      const p = forceSync || pollCount % SYNC_EVERY === 0
        ? await subscriptionApi.syncPayment(paymentId)
        : await subscriptionApi.payment(paymentId);
      setPayment(p);
      if (FINAL.has(p.status)) {
        stopTimers();
        if (p.status === "succeeded") {
          notify("Plata a fost confirmată. Emitem factura...", "success");
          props.onSuccess();
        } else if (p.status === "failed") {
          setError(p.failure_reason || "Plata a fost respinsă.");
        } else {
          setError("Sesiunea de plată a expirat sau a fost anulată. Generează un QR nou.");
        }
      }
    } catch {
      // tranzitoriu (retea / Stripe); urmatorul tick reincearca
    }
  }

  async function checkNow() {
    const id = payment()?.id ?? session()?.payment_id ?? amounts()?.payment_id;
    if (!id) return;
    setSyncing(true);
    try { await poll(id, true); } finally { setSyncing(false); }
  }

  function resetToForm() {
    stopTimers();
    setError("");
    setSession(null);
    setPayment(null);
    setQrDataUrl("");
    setSecondsLeft(null);
    setStep("form");
  }

  async function mountStripe(data: CheckoutResponse) {
    try {
      const mod = await import(/* @vite-ignore */ "@stripe/stripe-js");
      stripe = await mod.loadStripe(data.publishable_key);
      if (!stripe) { setError("Stripe.js nu s-a putut încărca."); return; }
      elements = stripe.elements({ clientSecret: data.client_secret, locale: "ro" });
      elements.create("payment").mount(paymentMount!);
    } catch {
      setError("Eroare la încărcarea Stripe.");
    }
  }

  async function confirmPayment(e: Event) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    setStep("waiting");
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${returnUrl()}&payment=success&payment_id=${amounts()!.payment_id}` },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message || "Plata a eşuat.");
      setStep("pay");
      return;
    }
    // Webhook-ul poate intarzia: asteptam confirmarea reala inainte de a inchide.
    startPolling(amounts()!.payment_id);
    void poll(amounts()!.payment_id, true);
  }

  const busy = () => step() === "waiting";
  const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div class="sl-modal-overlay">
      <div class="sl-modal" style="max-width:560px" onClick={(e) => e.stopPropagation()}>
        <div class="sl-modal-header">
          <span class="sl-modal-title">
            Plată abonament BerlinStar
            <Show when={amounts()?.test_mode}>
              <span style="margin-left:8px;font-size:11px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;vertical-align:middle">TEST</span>
            </Show>
          </span>
          <Show when={!busy()}>
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
                      {(c) => <option value={c.id}>{c.name} — CUI {c.cui}</option>}
                    </For>
                  </select>
                </div>

                <Show when={selectedCompany()}>
                  {(c) => (
                    <div style="background:var(--surface-2,#f1f5f9);padding:10px 12px;border-radius:6px;margin:4px 0 12px;font-size:12px;line-height:1.5">
                      <div><strong>CUI:</strong> {c().cui}</div>
                      <Show when={c().address}><div><strong>Adresă:</strong> {c().address}</div></Show>
                      <Show when={c().city || c().county_code}>
                        <div><strong>Localitate:</strong> {c().city ?? "—"} {c().county_code ? `(${c().county_code})` : ""}</div>
                      </Show>
                      <Show when={!c().county_code}>
                        <div style="color:#92400e">Judeţul lipseşte din datele companiei — factura va folosi implicit RO-B. Completează-l în Configurări → Companii.</div>
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

                <div class="form-group">
                  <label class="form-label">Cum plăteşti</label>
                  <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;cursor:pointer">
                    <input type="radio" name="method" checked={method() === "qr"} onChange={() => setMethod("qr")} />
                    <span>
                      <strong>Pe telefon, scanând un cod QR</strong>
                      <div style="font-size:12px;color:var(--text-muted)">Google Pay, Apple Pay, PayPal sau card — pe pagina securizată Stripe.</div>
                    </span>
                  </label>
                  <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;cursor:pointer">
                    <input type="radio" name="method" checked={method() === "card"} onChange={() => setMethod("card")} />
                    <span>
                      <strong>Card, aici în pagină</strong>
                      <div style="font-size:12px;color:var(--text-muted)">Formular Stripe încorporat.</div>
                    </span>
                  </label>
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
                {loading() ? "Se iniţiază…" : method() === "qr" ? "Generează codul QR" : "Continuă spre plată"}
              </button>
            </div>
          </form>
        </Show>

        <Show when={step() !== "form" ? amounts() : null}>
          {(d) => (
            <div style="background:var(--surface-2,#f1f5f9);padding:10px 12px;margin:16px 24px 0;border-radius:6px;font-size:13px">
              <div><strong>Sumă:</strong> {d().amount_ron.toFixed(2)} RON ({d().amount_eur.toFixed(2)} EUR, TVA inclus)
                <Show when={d().currency !== "RON"}> — încasat în {d().currency}</Show>
              </div>
              <div><strong>Curs BNR:</strong> 1 EUR = {d().fx_rate.toFixed(4)} RON (data {d().fx_date})</div>
            </div>
          )}
        </Show>

        <Show when={step() === "qr"}>
          <div class="sl-modal-body" style="padding:16px 24px;text-align:center">
            <Show when={qrDataUrl()} fallback={<p style="color:var(--text-muted)">Se generează codul QR…</p>}>
              <img src={qrDataUrl()} alt="Cod QR pentru plată" width="280" height="280" style="display:block;margin:0 auto;border-radius:8px" />
            </Show>
            <p style="margin:12px 0 4px;font-size:13px">
              Scanează cu telefonul şi plăteşte cu Google Pay, Apple Pay, PayPal sau card.
            </p>
            <p style="margin:0 0 8px;font-size:12px;color:var(--text-muted)">
              <Show when={secondsLeft() !== null}>Codul expiră în {fmtSeconds(secondsLeft()!)}. </Show>
              <a href={session()?.url} target="_blank" rel="noopener">Deschide pagina de plată pe acest dispozitiv</a>
            </p>
            <p style="margin:0;font-size:12px;color:var(--text-muted)">
              Status: {payment()?.status === "processing" ? "în procesare…" : "aşteptăm plata…"}
            </p>
            <Show when={error()}>
              <div class="login-error" style="margin:8px 0;text-align:left">{error()}</div>
            </Show>
          </div>
          <div class="sl-modal-footer">
            <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose}>Închide</button>
            <Show when={error()}>
              <button type="button" class="btn btn-ghost btn-sm" onClick={resetToForm}>Generează alt QR</button>
            </Show>
            <button type="button" class="btn btn-primary btn-sm" onClick={() => void checkNow()} disabled={syncing()}>
              {syncing() ? "Verificăm…" : "Am plătit — verifică"}
            </button>
          </div>
        </Show>

        <Show when={step() === "pay" || step() === "waiting"}>
          <div class="sl-modal-body" style="padding:16px 24px">
            <div ref={paymentMount} style="min-height:240px" />
            <Show when={step() === "waiting"}>
              <p style="margin:8px 0 0;font-size:13px;color:var(--text-muted)">Aşteptăm confirmarea Stripe…</p>
            </Show>
            <Show when={error()}>
              <div class="login-error" style="margin:8px 0">{error()}</div>
            </Show>
          </div>
          <div class="sl-modal-footer">
            <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose} disabled={busy()}>Anulează</button>
            <button type="button" class="btn btn-primary btn-sm" onClick={confirmPayment} disabled={busy()}>
              {busy() ? "Se procesează…" : "Plăteşte acum"}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
