import { For, Show, createSignal } from "solid-js";
import { notify } from "../../store/notificationsStore";
import { efacturaApi } from "../../api/efactura";
import { createListResource, useAction } from "../../hooks";

// ---------- Types ----------

type TokenState = "disconnected" | "connected" | "expiring_soon" | "expired";

interface AnafTokenStatus {
  company_id: number;
  connected: boolean;
  expires_at: string | null;
  days_until_expiry: number | null;
  state: TokenState;
}

interface AnafSettings {
  id: number;
  company_id: number;
  use_test_env: boolean;
  payment_terms_days: number;
  default_invoice_type: "380" | "381" | "386" | "751";
  auto_upload: boolean;
  auto_upload_delay_minutes: number;
  deadline_alert_email: string | null;
  validate_schematron: boolean;
  last_sync_at: string | null;
}

interface CompanySummary {
  company_id: number;
  account_id: number;
  name: string;
  cui: number;
  is_vat_payer: boolean | null;
  settings: AnafSettings | null;
  token_status: AnafTokenStatus;
}

interface ConnectResponse {
  authorize_url?: string | null;
}

interface TestConnectionResponse {
  ok?: boolean;
  detail?: string | null;
}

// ---------- Helpers ----------

function tokenBadge(s: TokenState): { color: string; icon: string; label: string } {
  switch (s) {
    case "connected":
      return { color: "var(--success)", icon: "🟢", label: "Conectat la ANAF" };
    case "expiring_soon":
      return { color: "var(--accent)", icon: "🟠", label: "Expiră curând" };
    case "expired":
      return { color: "var(--danger)", icon: "🔴", label: "Expirat — necesită USB" };
    default:
      return { color: "var(--text-muted)", icon: "⚫", label: "Deconectat" };
  }
}

// ---------- Component ----------

export default function EFacturaPanel() {
  const [expandedId, setExpandedId] = createSignal<number | null>(null);
  const list = createListResource<CompanySummary>({
    fetcher: () => efacturaApi.myCompanies<CompanySummary[]>(),
    errorMessage: "Nu am putut încărca companiile.",
  });

  return (
    <div class="cfg-panel">
      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">eFactura ANAF</h2>
        <button class="btn btn-ghost btn-sm" onClick={() => void list.reload()}>🔄 Reîncarcă</button>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.55">
        <p style="margin:0 0 6px;font-weight:600">Configurare RO e-Factura per companie</p>
        <p style="margin:0;color:var(--text-muted)">
          Credențialele OAuth ANAF (client_id, client_secret) sunt gestionate global de administratorul BerlinStar —
          tu nu trebuie să te înregistrezi separat pe anaf.ro. Conectarea companiei la ANAF se face folosind
          USB-ul cu certificatul digital al companiei.
        </p>
        <p style="margin:8px 0 0;color:var(--text-muted)">
          💡 <strong>USB necesar la primul connect și la fiecare 90 de zile.</strong> Refresh-ul automat al token-ului în
          background se face fără USB.
        </p>
      </div>

      <Show when={list.error()}>
        <p class="cfg-error">{list.error()}</p>
      </Show>

      <Show when={list.loading() && list.items().length === 0}>
        <div class="text-muted">Se încarcă companiile...</div>
      </Show>

      <Show when={!list.loading() && list.items().length === 0}>
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          Nu ai nicio companie configurată. Mergi în <strong>Configurări → Companiile mele</strong> pentru a adăuga una.
        </div>
      </Show>

      <div style="display:flex;flex-direction:column;gap:10px">
        <For each={list.items()}>
          {(c) => (
            <CompanyCard
              company={c}
              expanded={expandedId() === c.company_id}
              onToggle={() => setExpandedId(expandedId() === c.company_id ? null : c.company_id)}
              onReload={() => void list.reload()}
            />
          )}
        </For>
      </div>
    </div>
  );
}

function CompanyCard(props: {
  company: CompanySummary;
  expanded: boolean;
  onToggle: () => void;
  onReload: () => void;
}) {
  const badge = () => tokenBadge(props.company.token_status.state);
  const isTest = () => props.company.settings?.use_test_env !== false;

  return (
    <div style="border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">
      <div
        style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;cursor:pointer"
        onClick={props.onToggle}
      >
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">{props.company.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">CUI {props.company.cui}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span
            style={`padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;background:${
              isTest() ? "rgba(250,204,21,0.15)" : "rgba(34,197,94,0.15)"
            };color:${isTest() ? "var(--accent)" : "var(--success)"}`}
          >
            {isTest() ? "🟡 SANDBOX" : "🟢 PRODUCȚIE"}
          </span>
          <span
            style={`padding:2px 10px;border-radius:10px;border:1px solid ${badge().color};color:${badge().color};font-size:11px;font-weight:600`}
          >
            {badge().icon} {badge().label}
            <Show when={props.company.token_status.connected && props.company.token_status.days_until_expiry !== null}>
              <span style="margin-left:4px">({props.company.token_status.days_until_expiry}z)</span>
            </Show>
          </span>
          <button class="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); props.onToggle(); }}>
            {props.expanded ? "Închide" : "Configurează"}
          </button>
        </div>
      </div>

      <Show when={props.expanded}>
        <CompanyEditor company={props.company} onSaved={props.onReload} />
      </Show>
    </div>
  );
}

function CompanyEditor(props: { company: CompanySummary; onSaved: () => void }) {
  const s = props.company.settings;
  const [useTestEnv, setUseTestEnv] = createSignal<boolean>(s?.use_test_env ?? true);
  const [paymentTermsDays, setPaymentTermsDays] = createSignal<number>(s?.payment_terms_days ?? 30);
  const [defaultInvoiceType, setDefaultInvoiceType] = createSignal<"380" | "381" | "386" | "751">(
    s?.default_invoice_type ?? "380"
  );
  const [autoUpload, setAutoUpload] = createSignal<boolean>(s?.auto_upload ?? false);
  const [autoUploadDelay, setAutoUploadDelay] = createSignal<number>(s?.auto_upload_delay_minutes ?? 60);
  const [deadlineEmail, setDeadlineEmail] = createSignal<string>(s?.deadline_alert_email ?? "");

  const saveAction = useAction({
    fn: () =>
      efacturaApi.updateSettings(props.company.company_id, {
        use_test_env: useTestEnv(),
        payment_terms_days: paymentTermsDays(),
        default_invoice_type: defaultInvoiceType(),
        auto_upload: autoUpload(),
        auto_upload_delay_minutes: autoUploadDelay(),
        deadline_alert_email: deadlineEmail() || null,
      }),
    successMessage: "Setări salvate.",
    onSuccess: () => props.onSaved(),
    errorMessage: "Eroare la salvare.",
  });
  const saving = saveAction.loading;
  function save() { void saveAction.run(); }

  const connectAction = useAction({
    fn: () => efacturaApi.connect<ConnectResponse>(props.company.company_id),
    onSuccess: (d) => {
      if (d.authorize_url) {
        notify("Redirect către ANAF... Asigură-te că USB-ul este plugat și middleware-ul instalat.", "info");
        window.location.href = d.authorize_url;
      }
    },
    errorMessage: "Nu am putut iniția conectarea.",
  });
  function connect() { void connectAction.run(); }

  const disconnectAction = useAction({
    fn: () => efacturaApi.disconnect(props.company.company_id),
    successMessage: "Companie deconectată.",
    onSuccess: () => props.onSaved(),
    errorMessage: "Eroare la deconectare.",
  });
  function disconnect() {
    if (!window.confirm("Sigur deconectezi compania de la ANAF? Token-ul actual va fi șters.")) return;
    void disconnectAction.run();
  }

  const testAction = useAction({
    fn: () => efacturaApi.testConnection<TestConnectionResponse>(props.company.company_id),
    onSuccess: (d) => {
      if (d.ok) notify(d.detail ?? "Conexiune OK.", "success");
      else notify(d.detail ?? "Test eșuat.", "error");
    },
    errorMessage: "Test eșuat.",
  });
  const testing = testAction.loading;
  function testConn() { void testAction.run(); }

  return (
    <div style="padding:14px 16px;border-top:1px solid var(--border);background:var(--surface2)">
      <Show when={props.company.token_status.state === "expiring_soon"}>
        <div style="margin-bottom:14px;padding:10px 12px;background:rgba(250,204,21,0.12);color:var(--accent);border-radius:6px;font-size:12px">
          ⚠ Refresh token expiră în {props.company.token_status.days_until_expiry} zile.
          Reconectează cu USB-ul de semnătură înainte de expirare pentru a evita întreruperea.
        </div>
      </Show>
      <Show when={props.company.token_status.state === "expired"}>
        <div style="margin-bottom:14px;padding:10px 12px;background:rgba(220,38,38,0.1);color:var(--danger);border-radius:6px;font-size:12px">
          🛑 Token expirat — toate transmiterile automate sunt oprite. Reconectează cu USB-ul de semnătură.
        </div>
      </Show>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
        {/* Mediu */}
        <div class="form-group">
          <label class="form-label">Mediu ANAF</label>
          <div style="display:flex;gap:8px">
            <button
              class="btn btn-sm"
              classList={{ "btn-primary": useTestEnv(), "btn-ghost": !useTestEnv() }}
              onClick={() => setUseTestEnv(true)}
            >
              🟡 Sandbox (test)
            </button>
            <button
              class="btn btn-sm"
              classList={{ "btn-primary": !useTestEnv(), "btn-ghost": useTestEnv() }}
              onClick={() => setUseTestEnv(false)}
            >
              🟢 Producție
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Termen plată (zile)</label>
          <input
            class="input"
            type="number"
            min="0"
            max="365"
            value={paymentTermsDays()}
            onInput={(e) => setPaymentTermsDays(Number(e.currentTarget.value) || 0)}
          />
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
            Folosit pentru DueDate pe facturile transmise.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Tip factură implicit</label>
          <select
            class="input"
            value={defaultInvoiceType()}
            onChange={(e) => setDefaultInvoiceType(e.currentTarget.value as "380" | "381" | "386" | "751")}
          >
            <option value="380">380 — Factură normală</option>
            <option value="381">381 — Notă de credit</option>
            <option value="386">386 — Avans</option>
            <option value="751">751 — Auto-facturare</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Email alerte deadline</label>
          <input
            class="input"
            type="email"
            placeholder="contabil@firma.ro"
            value={deadlineEmail()}
            onInput={(e) => setDeadlineEmail(e.currentTarget.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input
              type="checkbox"
              checked={autoUpload()}
              onChange={(e) => setAutoUpload(e.currentTarget.checked)}
            />
            <span>Auto-upload la salvare factură</span>
          </label>
          <Show when={autoUpload()}>
            <div style="margin-top:6px">
              <label class="form-label" style="font-size:11px">Delay buffer (minute)</label>
              <input
                class="input"
                type="number"
                min="0"
                max="10080"
                value={autoUploadDelay()}
                onInput={(e) => setAutoUploadDelay(Number(e.currentTarget.value) || 0)}
              />
            </div>
          </Show>
        </div>
      </div>

      {/* Action buttons */}
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;margin-top:12px;border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onClick={save} disabled={saving()}>
          {saving() ? "Se salvează..." : "💾 Salvează setări"}
        </button>

        <Show when={!props.company.token_status.connected || props.company.token_status.state === "expired"}>
          <button
            class="btn btn-sm"
            style="background:#0d6efd;color:white"
            onClick={connect}
            title="Asigura-te ca USB-ul cu certificatul digital este plugat in calculator inainte de a apasa"
          >
            🔌 Conectează la ANAF (necesită USB)
          </button>
        </Show>

        <Show when={props.company.token_status.state === "expiring_soon"}>
          <button
            class="btn btn-sm"
            style="background:#ffc107;color:#664d03"
            onClick={connect}
            title="Token-ul expira curand — reconnect cu USB-ul de semnatura"
          >
            🔄 Reconnect (USB)
          </button>
        </Show>

        <Show when={props.company.token_status.connected}>
          <button class="btn btn-ghost btn-sm" onClick={testConn} disabled={testing()}>
            {testing() ? "..." : "🧪 Test conexiune"}
          </button>
          <button class="btn btn-ghost btn-sm" onClick={disconnect}>
            🔒 Deconectează
          </button>
        </Show>
      </div>

      <div style="margin-top:10px;font-size:11px;color:var(--text-muted);line-height:1.5">
        💡 <strong>Cum funcționează connect-ul cu USB:</strong> apăsând butonul Conectează, browser-ul te redirectează la ANAF SPV.
        Middleware-ul instalat pe calculator (CertSign / DigiSign / TransSped / AlfaSign) citește certificatul de pe USB,
        introduci PIN-ul, iar ANAF redirectează apoi înapoi la BerlinStar.
        Token-ul OAuth astfel obținut este valabil 90 de zile.
      </div>
    </div>
  );
}
