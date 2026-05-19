import { Show, createSignal, onMount } from "solid-js";
import { adminFetch } from "./admin-auth";
import { readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";

interface SubSettings {
  subscription_price_eur: number;
  subscription_vat_percent: number;
  subscription_currency_charge: string;
  subscription_invoice_series: string;
  subscription_next_invoice_number: number;

  issuer_name: string | null;
  issuer_cui: string | null;
  issuer_reg_com: string | null;
  issuer_legal_form: string | null;
  issuer_is_vat_payer: boolean;
  issuer_address: string | null;
  issuer_street: string | null;
  issuer_city: string | null;
  issuer_county_code: string | null;
  issuer_postal_code: string | null;
  issuer_country_code: string;
  issuer_iban: string | null;
  issuer_bank_name: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;

  stripe_publishable_key: string | null;
  stripe_secret_key_set: boolean;
  stripe_webhook_secret_set: boolean;
  stripe_test_mode: boolean;

  platform_anaf_use_test_env: boolean;
  platform_anaf_auto_upload: boolean;
  platform_anaf_connected: boolean;
  platform_anaf_expires_at: string | null;
}

export default function SubscriptionSettingsSection() {
  const [s, setS] = createSignal<SubSettings | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [stripeSecretInput, setStripeSecretInput] = createSignal("");
  const [stripeWebhookInput, setStripeWebhookInput] = createSignal("");

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/subscription/settings");
      if (res.ok) setS(await res.json());
    } finally { setLoading(false); }
  }

  onMount(() => { void load(); });

  function update<K extends keyof SubSettings>(key: K, value: SubSettings[K]) {
    const cur = s();
    if (!cur) return;
    setS({ ...cur, [key]: value });
  }

  async function save() {
    const cur = s();
    if (!cur) return;
    setSaving(true);
    try {
      const body: any = { ...cur };
      // doar daca admin a introdus, trimite cheia in clar; altfel pastreaza ce e in DB
      if (stripeSecretInput().trim()) body.stripe_secret_key = stripeSecretInput().trim();
      if (stripeWebhookInput().trim()) body.stripe_webhook_secret = stripeWebhookInput().trim();
      // elimina campurile readonly
      delete body.stripe_secret_key_set;
      delete body.stripe_webhook_secret_set;
      delete body.platform_anaf_connected;
      delete body.platform_anaf_expires_at;

      const res = await adminFetch("/api/admin/subscription/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await readJsonSafe<{ detail?: string }>(res);
        notify(d.detail || "Eroare la salvare.", "error");
        return;
      }
      setS(await res.json());
      setStripeSecretInput("");
      setStripeWebhookInput("");
      notify("Setări abonament salvate.", "success");
    } finally { setSaving(false); }
  }

  async function connectAnaf() {
    const res = await adminFetch("/api/admin/subscription/anaf/auth-url");
    if (!res.ok) {
      const d = await readJsonSafe<{ detail?: string }>(res);
      notify(d.detail || "Eroare ANAF.", "error");
      return;
    }
    const d = (await res.json()) as { auth_url: string };
    window.location.href = d.auth_url;
  }

  async function disconnectAnaf() {
    if (!confirm("Sigur deconectezi ANAF SPV?")) return;
    const res = await adminFetch("/api/admin/subscription/anaf/disconnect", { method: "POST" });
    if (!res.ok) {
      notify("Eroare la deconectare.", "error");
      return;
    }
    notify("ANAF SPV deconectat.", "success");
    void load();
  }

  return (
    <div style="padding:18px;max-width:920px">
      <h2 style="margin-top:0">Abonament — Setări</h2>
      <Show when={s()} fallback={<div>{loading() ? "Se încarcă…" : "Indisponibil"}</div>}>
        {(d) => (
          <div style="display:grid;gap:18px">
            <div class="account-card" style="padding:16px">
              <h3 style="margin-top:0">Preţ & TVA</h3>
              <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
                <div class="form-group">
                  <label class="form-label">Preţ EUR (cu TVA inclus)</label>
                  <input class="input" type="number" step="0.01" value={d().subscription_price_eur} onInput={(e) => update("subscription_price_eur", parseFloat(e.currentTarget.value || "0"))} />
                </div>
                <div class="form-group">
                  <label class="form-label">TVA %</label>
                  <input class="input" type="number" step="0.01" value={d().subscription_vat_percent} onInput={(e) => update("subscription_vat_percent", parseFloat(e.currentTarget.value || "0"))} />
                </div>
                <div class="form-group">
                  <label class="form-label">Moneda încasată</label>
                  <select class="input" value={d().subscription_currency_charge} onChange={(e) => update("subscription_currency_charge", e.currentTarget.value)}>
                    <option value="RON">RON (curs BNR)</option>
                    <option value="EUR">EUR (fără conversie)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Serie factură</label>
                  <input class="input" value={d().subscription_invoice_series} onInput={(e) => update("subscription_invoice_series", e.currentTarget.value)} maxLength={20} />
                </div>
                <div class="form-group">
                  <label class="form-label">Următorul număr factură</label>
                  <input class="input" type="number" min="1" value={d().subscription_next_invoice_number} onInput={(e) => update("subscription_next_invoice_number", parseInt(e.currentTarget.value || "1", 10))} />
                </div>
              </div>
            </div>

            <div class="account-card" style="padding:16px">
              <h3 style="margin-top:0">Date firmă emitentă (BerlinStar SRL)</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-top:0">
                Aceste date apar pe factura emisă către clienţii BerlinStar şi se transmit la ANAF SPV.
              </p>
              <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
                <div class="form-group"><label class="form-label">Denumire</label>
                  <input class="input" value={d().issuer_name ?? ""} onInput={(e) => update("issuer_name", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">CUI</label>
                  <input class="input" value={d().issuer_cui ?? ""} onInput={(e) => update("issuer_cui", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Reg. Com.</label>
                  <input class="input" value={d().issuer_reg_com ?? ""} onInput={(e) => update("issuer_reg_com", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Formă juridică</label>
                  <input class="input" value={d().issuer_legal_form ?? ""} onInput={(e) => update("issuer_legal_form", e.currentTarget.value)} placeholder="SRL" /></div>
                <div class="form-group" style="grid-column:span 2"><label class="form-label">Plătitor de TVA</label>
                  <select class="input" value={d().issuer_is_vat_payer ? "1" : "0"} onChange={(e) => update("issuer_is_vat_payer", e.currentTarget.value === "1")}>
                    <option value="1">Da</option>
                    <option value="0">Nu</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column:span 2"><label class="form-label">Stradă</label>
                  <input class="input" value={d().issuer_street ?? ""} onInput={(e) => update("issuer_street", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Localitate</label>
                  <input class="input" value={d().issuer_city ?? ""} onInput={(e) => update("issuer_city", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Cod judeţ</label>
                  <input class="input" value={d().issuer_county_code ?? ""} onInput={(e) => update("issuer_county_code", e.currentTarget.value)} placeholder="RO-B" /></div>
                <div class="form-group"><label class="form-label">Cod poştal</label>
                  <input class="input" value={d().issuer_postal_code ?? ""} onInput={(e) => update("issuer_postal_code", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Ţara</label>
                  <input class="input" value={d().issuer_country_code} onInput={(e) => update("issuer_country_code", e.currentTarget.value)} maxLength={2} /></div>
                <div class="form-group"><label class="form-label">IBAN</label>
                  <input class="input" value={d().issuer_iban ?? ""} onInput={(e) => update("issuer_iban", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Bancă</label>
                  <input class="input" value={d().issuer_bank_name ?? ""} onInput={(e) => update("issuer_bank_name", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Email</label>
                  <input class="input" type="email" value={d().issuer_email ?? ""} onInput={(e) => update("issuer_email", e.currentTarget.value)} /></div>
                <div class="form-group"><label class="form-label">Telefon</label>
                  <input class="input" value={d().issuer_phone ?? ""} onInput={(e) => update("issuer_phone", e.currentTarget.value)} /></div>
              </div>
            </div>

            <div class="account-card" style="padding:16px">
              <h3 style="margin-top:0">Stripe</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-top:0">
                Cheile sensibile sunt criptate cu Fernet în baza de date. Lasă goale câmpurile dacă nu vrei să le modifici.
              </p>
              <div class="form-group">
                <label class="form-label">Test mode</label>
                <select class="input" value={d().stripe_test_mode ? "1" : "0"} onChange={(e) => update("stripe_test_mode", e.currentTarget.value === "1")}>
                  <option value="1">Test (pk_test_… / sk_test_…)</option>
                  <option value="0">Live (pk_live_… / sk_live_…)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Publishable Key (pk_…)</label>
                <input class="input" value={d().stripe_publishable_key ?? ""} onInput={(e) => update("stripe_publishable_key", e.currentTarget.value)} placeholder="pk_test_…" />
              </div>
              <div class="form-group">
                <label class="form-label">Secret Key (sk_…) {d().stripe_secret_key_set ? <span style="color:#16a34a;font-size:12px">(setat)</span> : <span style="color:#dc2626;font-size:12px">(lipsă)</span>}</label>
                <input class="input" type="password" value={stripeSecretInput()} onInput={(e) => setStripeSecretInput(e.currentTarget.value)} placeholder={d().stripe_secret_key_set ? "•••••••• (las gol = păstrează)" : "sk_test_…"} />
              </div>
              <div class="form-group">
                <label class="form-label">Webhook Secret (whsec_…) {d().stripe_webhook_secret_set ? <span style="color:#16a34a;font-size:12px">(setat)</span> : <span style="color:#dc2626;font-size:12px">(lipsă)</span>}</label>
                <input class="input" type="password" value={stripeWebhookInput()} onInput={(e) => setStripeWebhookInput(e.currentTarget.value)} placeholder={d().stripe_webhook_secret_set ? "•••••••• (las gol = păstrează)" : "whsec_…"} />
              </div>
              <div style="font-size:12px;color:var(--text-muted)">
                URL webhook de configurat în Stripe Dashboard: <code>https://&lt;domeniul tau&gt;/api/subscription/webhook</code><br />
                Evenimente: <code>payment_intent.succeeded</code>, <code>payment_intent.payment_failed</code>, <code>payment_intent.canceled</code>.
              </div>
            </div>

            <div class="account-card" style="padding:16px">
              <h3 style="margin-top:0">ANAF SPV (BerlinStar SRL)</h3>
              <div class="form-group">
                <label class="form-label">Mediu ANAF</label>
                <select class="input" value={d().platform_anaf_use_test_env ? "1" : "0"} onChange={(e) => update("platform_anaf_use_test_env", e.currentTarget.value === "1")}>
                  <option value="1">Test (api.anaf.ro/test)</option>
                  <option value="0">Producţie (api.anaf.ro/prod)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Upload automat în SPV</label>
                <select class="input" value={d().platform_anaf_auto_upload ? "1" : "0"} onChange={(e) => update("platform_anaf_auto_upload", e.currentTarget.value === "1")}>
                  <option value="1">Da — trimite factura automat</option>
                  <option value="0">Nu — emite doar PDF local</option>
                </select>
              </div>
              <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <Show
                  when={d().platform_anaf_connected}
                  fallback={
                    <button class="btn btn-primary btn-sm" onClick={connectAnaf}>
                      Conectează ANAF SPV (USB)
                    </button>
                  }
                >
                  <span style="color:#16a34a">✓ Conectat (expiră {d().platform_anaf_expires_at?.split("T")[0]})</span>
                  <button class="btn btn-primary btn-sm" onClick={connectAnaf}>Reconectează</button>
                  <button class="btn btn-ghost btn-sm" onClick={disconnectAnaf}>Deconectează</button>
                </Show>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button class="btn btn-ghost btn-sm" onClick={() => void load()} disabled={saving()}>Anulează</button>
              <button class="btn btn-primary" onClick={save} disabled={saving()}>{saving() ? "Se salvează…" : "Salvează"}</button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
