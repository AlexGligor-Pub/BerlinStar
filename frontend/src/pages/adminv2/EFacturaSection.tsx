import { For, Show, createSignal, onMount } from "solid-js";
import { notify } from "../../store/notificationsStore";
import { adminFetch } from "./admin-auth";

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
  client_id: string | null;
  redirect_uri: string | null;
  payment_terms_days: number;
  default_invoice_type: "380" | "381" | "386" | "751";
  auto_upload: boolean;
  auto_upload_delay_minutes: number;
  deadline_alert_email: string | null;
  validate_schematron: boolean;
  has_client_secret: boolean;
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

interface DashboardData {
  by_status: Record<string, number>;
  deadline_overdue_or_today: number;
  connected_companies: number;
  total_companies: number;
  fernet_configured: boolean;
  scheduler_enabled: boolean;
}

type Tab = "config" | "companies" | "status" | "deadlines" | "received" | "audit";

// ---------- Helpers ----------

function tokenStateBadge(s: TokenState): { color: string; icon: string; label: string } {
  switch (s) {
    case "connected":
      return { color: "var(--success)", icon: "🟢", label: "Conectat" };
    case "expiring_soon":
      return { color: "var(--accent)", icon: "🟠", label: "Expiră curând" };
    case "expired":
      return { color: "var(--danger)", icon: "🔴", label: "Expirat" };
    default:
      return { color: "var(--text-muted)", icon: "⚫", label: "Deconectat" };
  }
}

// ---------- Component ----------

export default function EFacturaSection() {
  const [tab, setTab] = createSignal<Tab>("config");
  const [dashboard, setDashboard] = createSignal<DashboardData | null>(null);
  const [companies, setCompanies] = createSignal<CompanySummary[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [editingCompanyId, setEditingCompanyId] = createSignal<number | null>(null);

  async function loadDashboard() {
    try {
      const res = await adminFetch("/api/admin/efactura/dashboard");
      if (res.ok) setDashboard(await res.json());
    } catch {
      notify("Nu am putut încărca dashboard-ul eFactura.", "error");
    }
  }

  async function loadCompanies() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/efactura/companies");
      if (res.ok) setCompanies(await res.json());
      else notify("Eroare la listarea companiilor.", "error");
    } catch {
      notify("Eroare de rețea la companii.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void loadDashboard();
    void loadCompanies();
  });

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">eFactura ANAF</h2>
      </div>

      {/* Sub-tabs */}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <For
          each={
            [
              { id: "config", label: "Configurare globală" },
              { id: "companies", label: "Companii (OAuth)" },
              { id: "status", label: "Status transmiteri" },
              { id: "deadlines", label: "Deadline-uri" },
              { id: "received", label: "Facturi primite" },
              { id: "audit", label: "Audit mapping" },
            ] as { id: Tab; label: string }[]
          }
        >
          {(t) => (
            <button
              class="btn btn-sm"
              classList={{ "btn-primary": tab() === t.id, "btn-ghost": tab() !== t.id }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          )}
        </For>
      </div>

      <Show when={tab() === "config"}>
        <ConfigTab dashboard={dashboard()} onReload={() => void loadDashboard()} />
      </Show>

      <Show when={tab() === "companies"}>
        <CompaniesTab
          companies={companies()}
          loading={loading()}
          editingCompanyId={editingCompanyId()}
          setEditingCompanyId={setEditingCompanyId}
          onReload={() => {
            void loadCompanies();
            void loadDashboard();
          }}
        />
      </Show>

      <Show when={tab() === "status"}>
        <StatusTab companies={companies()} />
      </Show>

      <Show when={tab() === "deadlines"}>
        <DeadlinesTab companies={companies()} />
      </Show>

      <Show when={tab() === "received"}>
        <ReceivedTab companies={companies()} />
      </Show>

      <Show when={tab() === "audit"}>
        <AuditTab companies={companies()} />
      </Show>
    </div>
  );
}

// ---------- Tab: Config global ----------

interface GlobalSettings {
  id: number;
  fernet_key_set: boolean;
  fernet_key_preview: string | null;
  anaf_auth_url: string;
  anaf_token_url: string;
  anaf_api_base_prod: string;
  anaf_api_base_test: string;
  default_redirect_uri: string;
  frontend_callback_redirect: string;
  scheduler_enabled: boolean;
  scheduler_running: boolean;
  updated_at: string | null;
}

interface TestCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface GlobalTestResult {
  ok: boolean;
  checks: TestCheck[];
}

function ConfigTab(props: { dashboard: DashboardData | null; onReload: () => void }) {
  const [gs, setGs] = createSignal<GlobalSettings | null>(null);
  const [loadingGs, setLoadingGs] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<GlobalTestResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  // Form state
  const [fernetKey, setFernetKey] = createSignal("");
  const [authUrl, setAuthUrl] = createSignal("");
  const [tokenUrl, setTokenUrl] = createSignal("");
  const [apiBaseProd, setApiBaseProd] = createSignal("");
  const [apiBaseTest, setApiBaseTest] = createSignal("");
  const [redirectUri, setRedirectUri] = createSignal("");
  const [frontendCallback, setFrontendCallback] = createSignal("");
  const [schedulerEnabled, setSchedulerEnabled] = createSignal(false);

  async function loadGlobal() {
    setLoadingGs(true);
    try {
      const res = await adminFetch("/api/admin/efactura/global");
      if (!res.ok) {
        notify("Nu am putut încărca setările globale.", "error");
        return;
      }
      const data: GlobalSettings = await res.json();
      setGs(data);
      setAuthUrl(data.anaf_auth_url);
      setTokenUrl(data.anaf_token_url);
      setApiBaseProd(data.anaf_api_base_prod);
      setApiBaseTest(data.anaf_api_base_test);
      setRedirectUri(data.default_redirect_uri);
      setFrontendCallback(data.frontend_callback_redirect);
      setSchedulerEnabled(data.scheduler_enabled);
      setFernetKey("");
    } catch {
      notify("Eroare de rețea la încărcarea setărilor.", "error");
    } finally {
      setLoadingGs(false);
    }
  }

  onMount(() => void loadGlobal());

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        anaf_auth_url: authUrl(),
        anaf_token_url: tokenUrl(),
        anaf_api_base_prod: apiBaseProd(),
        anaf_api_base_test: apiBaseTest(),
        default_redirect_uri: redirectUri(),
        frontend_callback_redirect: frontendCallback(),
        scheduler_enabled: schedulerEnabled(),
      };
      const fk = fernetKey().trim();
      if (fk) body.fernet_key = fk;
      const res = await adminFetch("/api/admin/efactura/global", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        notify("Setări globale salvate.", "success");
        setFernetKey("");
        await loadGlobal();
        props.onReload();
      } else {
        const d = await res.json().catch(() => ({}));
        notify(d.detail ?? "Eroare la salvare.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function generateNewKey() {
    if (gs()?.fernet_key_set) {
      const ok = confirm(
        "Atenție: regenerarea cheii Fernet va face INUTILE toate tokenurile OAuth existente.\n" +
        "Toate companiile conectate vor trebui să se reconecteze cu USB-ul de semnătură.\n\n" +
        "Continui?"
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/efactura/global", {
        method: "PATCH",
        body: JSON.stringify({ fernet_key: "AUTO" }),
      });
      if (res.ok) {
        notify("Cheie Fernet nouă generată și salvată.", "success");
        await loadGlobal();
        props.onReload();
      } else {
        notify("Generare eșuată.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminFetch("/api/admin/efactura/global/test-setup", { method: "POST" });
      if (res.ok) {
        setTestResult(await res.json());
      } else {
        notify("Test eșuat la rulare.", "error");
      }
    } catch {
      notify("Eroare de rețea la test.", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:18px;font-size:13px;line-height:1.55">
        <p style="margin:0 0 6px;font-weight:600">Configurare globală RO e-Factura ANAF</p>
        <p style="margin:0;color:var(--text-muted)">
          Toate setările eFactura sunt persistate în baza de date (nu în <code>.env</code>).
          Pentru OAuth per-companie (client_id, client_secret, sandbox/prod) vezi tabul „Companii".
        </p>
      </div>

      {/* Dashboard quick stats */}
      <Show when={props.dashboard}>
        {(d) => (
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px">
            <StatCard label="Companii conectate" value={`${d().connected_companies}/${d().total_companies}`} />
            <StatCard
              label="Deadline azi/depășit"
              value={String(d().deadline_overdue_or_today)}
              tone={d().deadline_overdue_or_today > 0 ? "danger" : "ok"}
            />
            <StatCard
              label="Cheie criptare"
              value={gs()?.fernet_key_set ? "Setată" : "Lipsește"}
              tone={gs()?.fernet_key_set ? "ok" : "danger"}
            />
            <StatCard
              label="Scheduler"
              value={gs()?.scheduler_running ? "Rulează" : gs()?.scheduler_enabled ? "Activat (oprit)" : "Dezactivat"}
              tone={gs()?.scheduler_running ? "ok" : gs()?.scheduler_enabled ? "warn" : "warn"}
            />
          </div>
        )}
      </Show>

      <Show when={loadingGs() && !gs()}>
        <div class="text-muted">Se încarcă...</div>
      </Show>

      <Show when={gs()}>
        {(g) => (
          <>
            {/* Cheia Fernet */}
            <div class="account-card" style="padding:14px 16px;margin-bottom:14px">
              <h3 style="margin:0 0 10px;font-size:14px">🔐 Cheie criptare (Fernet)</h3>
              <p style="margin:0 0 10px;font-size:12px;color:var(--text-muted)">
                Folosită pentru a cripta tokenurile OAuth ANAF stocate în DB.
                Pierderea sau schimbarea ei invalidează toate conexiunile existente.
              </p>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <Show
                  when={g().fernet_key_set}
                  fallback={
                    <span style="padding:3px 10px;border-radius:10px;background:rgba(220,38,38,0.1);color:var(--danger);font-size:12px;font-weight:600">
                      ❌ NU este setată
                    </span>
                  }
                >
                  <span style="padding:3px 10px;border-radius:10px;background:rgba(34,197,94,0.15);color:var(--success);font-size:12px;font-weight:600">
                    ✓ Setată ({g().fernet_key_preview})
                  </span>
                </Show>
                <button class="btn btn-primary btn-sm" onClick={generateNewKey} disabled={saving()}>
                  🎲 {g().fernet_key_set ? "Regenerează cheie nouă" : "Generează cheie automată"}
                </button>
              </div>
              <details style="margin-top:10px">
                <summary style="cursor:pointer;font-size:12px;color:var(--text-muted)">
                  Introdu manual o cheie existentă (migrate din altă instalare)
                </summary>
                <div style="margin-top:8px">
                  <input
                    class="input"
                    type="text"
                    placeholder="Fernet key (urlsafe base64, 44 caractere)"
                    value={fernetKey()}
                    onInput={(e) => setFernetKey(e.currentTarget.value)}
                    autocomplete="off"
                  />
                  <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                    Salvată odată cu butonul „Salvează setări" de mai jos.
                  </div>
                </div>
              </details>
            </div>

            {/* Scheduler */}
            <div class="account-card" style="padding:14px 16px;margin-bottom:14px">
              <h3 style="margin:0 0 10px;font-size:14px">⚙️ Scheduler eFactura</h3>
              <p style="margin:0 0 10px;font-size:12px;color:var(--text-muted)">
                Pornește job-urile automate de upload/poll/download/sync received.
                Recomandat OFF pe dev local, ON în producție.
              </p>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input
                  type="checkbox"
                  checked={schedulerEnabled()}
                  onChange={(e) => setSchedulerEnabled(e.currentTarget.checked)}
                />
                <span>Activează scheduler-ul (intervale: upload 5min, poll 10min, download 30min, sync received 60min)</span>
              </label>
              <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
                Status runtime: <strong>{g().scheduler_running ? "rulează" : "oprit"}</strong>
              </div>
            </div>

            {/* Redirect URIs */}
            <div class="account-card" style="padding:14px 16px;margin-bottom:14px">
              <h3 style="margin:0 0 10px;font-size:14px">🌐 URL-uri redirect</h3>
              <div class="form-group">
                <label class="form-label">Default redirect URI (callback ANAF)</label>
                <input
                  class="input"
                  type="text"
                  value={redirectUri()}
                  onInput={(e) => setRedirectUri(e.currentTarget.value)}
                  placeholder="https://app.berlinstar.ro/api/efactura/callback"
                />
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                  Se folosește dacă o companie nu are propriul redirect_uri setat.
                </div>
              </div>
              <div class="form-group" style="margin-top:8px">
                <label class="form-label">Frontend post-callback redirect</label>
                <input
                  class="input"
                  type="text"
                  value={frontendCallback()}
                  onInput={(e) => setFrontendCallback(e.currentTarget.value)}
                  placeholder="http://localhost:2000/adminv2?section=efactura"
                />
              </div>
            </div>

            {/* Advanced: ANAF URLs override */}
            <div class="account-card" style="padding:14px 16px;margin-bottom:14px">
              <details open={advancedOpen()} onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}>
                <summary style="cursor:pointer;font-size:14px;font-weight:600">⚡ Avansat — Override URL-uri ANAF</summary>
                <p style="margin:8px 0 10px;font-size:12px;color:var(--text-muted)">
                  Doar pentru cazul în care ANAF schimbă endpoint-urile. Defaults oficiale de mai sus.
                </p>
                <div class="form-group">
                  <label class="form-label">ANAF Auth URL</label>
                  <input class="input" type="text" value={authUrl()} onInput={(e) => setAuthUrl(e.currentTarget.value)} />
                </div>
                <div class="form-group" style="margin-top:8px">
                  <label class="form-label">ANAF Token URL</label>
                  <input class="input" type="text" value={tokenUrl()} onInput={(e) => setTokenUrl(e.currentTarget.value)} />
                </div>
                <div class="form-group" style="margin-top:8px">
                  <label class="form-label">API Base TEST (sandbox)</label>
                  <input class="input" type="text" value={apiBaseTest()} onInput={(e) => setApiBaseTest(e.currentTarget.value)} />
                </div>
                <div class="form-group" style="margin-top:8px">
                  <label class="form-label">API Base PROD</label>
                  <input class="input" type="text" value={apiBaseProd()} onInput={(e) => setApiBaseProd(e.currentTarget.value)} />
                </div>
              </details>
            </div>

            {/* Actions */}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <button class="btn btn-primary" onClick={save} disabled={saving()}>
                {saving() ? "Se salvează..." : "💾 Salvează setări"}
              </button>
              <button class="btn btn-ghost" onClick={runTest} disabled={testing()}>
                {testing() ? "Se testează..." : "🧪 Testează configurarea"}
              </button>
              <button class="btn btn-ghost btn-sm" onClick={() => { void loadGlobal(); props.onReload(); }}>
                🔄 Reîncarcă
              </button>
            </div>

            {/* Test result */}
            <Show when={testResult()}>
              {(tr) => (
                <div
                  class="account-card"
                  style={`padding:14px 16px;border-left:4px solid ${tr().ok ? "var(--success)" : "var(--danger)"}`}
                >
                  <h3 style="margin:0 0 10px;font-size:14px">
                    {tr().ok ? "✅ Test complet — toate verificările au trecut" : "⚠ Test complet — există probleme"}
                  </h3>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <For each={tr().checks}>
                      {(c) => (
                        <div style="display:flex;gap:8px;align-items:flex-start">
                          <span style={`min-width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${c.ok ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.1)"};color:${c.ok ? "var(--success)" : "var(--danger)"};font-size:11px;font-weight:600`}>
                            {c.ok ? "✓" : "!"}
                          </span>
                          <div style="flex:1;min-width:0">
                            <strong style="font-size:13px">{c.name}</strong>
                            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">{c.detail}</div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}

function StatCard(props: { label: string; value: string; tone?: "ok" | "warn" | "danger" }) {
  const color =
    props.tone === "danger" ? "var(--danger)" : props.tone === "warn" ? "var(--accent)" : "var(--text)";
  return (
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">{props.label}</div>
      <div style={`font-size:18px;font-weight:600;color:${color}`}>{props.value}</div>
    </div>
  );
}

// ---------- Tab: Companies ----------

function CompaniesTab(props: {
  companies: CompanySummary[];
  loading: boolean;
  editingCompanyId: number | null;
  setEditingCompanyId: (id: number | null) => void;
  onReload: () => void;
}) {
  return (
    <div>
      <Show when={props.loading}>
        <div class="text-muted">Se încarcă companiile...</div>
      </Show>

      <Show when={!props.loading && props.companies.length === 0}>
        <div class="text-muted">Nu există companii în sistem.</div>
      </Show>

      <div style="display:flex;flex-direction:column;gap:10px">
        <For each={props.companies}>
          {(c) => (
            <CompanyCard
              company={c}
              expanded={props.editingCompanyId === c.company_id}
              onToggleExpand={() =>
                props.setEditingCompanyId(props.editingCompanyId === c.company_id ? null : c.company_id)
              }
              onReload={props.onReload}
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
  onToggleExpand: () => void;
  onReload: () => void;
}) {
  const badge = () => tokenStateBadge(props.company.token_status.state);

  return (
    <div class="account-card" style="padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">{props.company.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">
            CUI: {props.company.cui}
            <Show when={props.company.is_vat_payer}>
              <span style="margin-left:8px;padding:1px 6px;border-radius:8px;background:var(--surface2);font-size:11px">
                TVA
              </span>
            </Show>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <Show when={props.company.settings?.use_test_env !== false}>
            <span style="padding:2px 8px;border-radius:10px;background:rgba(250,204,21,0.15);border:1px solid var(--accent);font-size:11px;font-weight:600">
              SANDBOX
            </span>
          </Show>
          <Show when={props.company.settings && !props.company.settings.use_test_env}>
            <span style="padding:2px 8px;border-radius:10px;background:rgba(34,197,94,0.15);border:1px solid var(--success);font-size:11px;font-weight:600;color:var(--success)">
              PRODUCȚIE
            </span>
          </Show>

          <span style={`padding:2px 8px;border-radius:10px;border:1px solid ${badge().color};color:${badge().color};font-size:11px;font-weight:600`}>
            {badge().icon} {badge().label}
            <Show when={props.company.token_status.days_until_expiry !== null && props.company.token_status.connected}>
              <span style="margin-left:4px">({props.company.token_status.days_until_expiry}z)</span>
            </Show>
          </span>

          <button class="btn btn-ghost btn-sm" onClick={() => props.onToggleExpand()}>
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

// ---------- Company editor ----------

function CompanyEditor(props: { company: CompanySummary; onSaved: () => void }) {
  const s = props.company.settings;
  const [useTestEnv, setUseTestEnv] = createSignal<boolean>(s?.use_test_env ?? true);
  const [clientId, setClientId] = createSignal<string>(s?.client_id ?? "");
  const [clientSecret, setClientSecret] = createSignal<string>("");
  const [redirectUri, setRedirectUri] = createSignal<string>(s?.redirect_uri ?? "");
  const [paymentTermsDays, setPaymentTermsDays] = createSignal<number>(s?.payment_terms_days ?? 30);
  const [defaultInvoiceType, setDefaultInvoiceType] = createSignal<"380" | "381" | "386" | "751">(
    s?.default_invoice_type ?? "380"
  );
  const [autoUpload, setAutoUpload] = createSignal<boolean>(s?.auto_upload ?? false);
  const [autoUploadDelay, setAutoUploadDelay] = createSignal<number>(s?.auto_upload_delay_minutes ?? 60);
  const [deadlineEmail, setDeadlineEmail] = createSignal<string>(s?.deadline_alert_email ?? "");
  const [validateSchematron, setValidateSchematron] = createSignal<boolean>(s?.validate_schematron ?? false);
  const [saving, setSaving] = createSignal(false);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        use_test_env: useTestEnv(),
        client_id: clientId() || null,
        redirect_uri: redirectUri() || null,
        payment_terms_days: paymentTermsDays(),
        default_invoice_type: defaultInvoiceType(),
        auto_upload: autoUpload(),
        auto_upload_delay_minutes: autoUploadDelay(),
        deadline_alert_email: deadlineEmail() || null,
        validate_schematron: validateSchematron(),
      };
      if (clientSecret()) body.client_secret = clientSecret();
      const res = await adminFetch(
        `/api/admin/efactura/companies/${props.company.company_id}/settings`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      if (res.ok) {
        notify("Setări ANAF salvate.", "success");
        setClientSecret("");
        props.onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        notify(d.detail ?? "Eroare la salvare.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function connect() {
    try {
      const res = await adminFetch(
        `/api/efactura/companies/${props.company.company_id}/connect`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        notify(d.detail ?? "Nu am putut iniția conectarea la ANAF.", "error");
        return;
      }
      const d = await res.json();
      if (d.authorize_url) {
        notify("Redirect către ANAF... Asigură-te că USB-ul este plugat.", "info");
        window.location.href = d.authorize_url;
      }
    } catch {
      notify("Eroare de rețea la connect.", "error");
    }
  }

  async function disconnect() {
    if (!window.confirm("Sigur deconectezi această companie de la ANAF? Tokenul actual va fi șters.")) return;
    try {
      const res = await adminFetch(
        `/api/efactura/companies/${props.company.company_id}/disconnect`,
        { method: "POST" }
      );
      if (res.ok) {
        notify("Companie deconectată.", "success");
        props.onSaved();
      } else {
        notify("Eroare la deconectare.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    }
  }

  async function testConn() {
    try {
      const res = await adminFetch(
        `/api/efactura/companies/${props.company.company_id}/refresh`,
        { method: "POST" }
      );
      if (res.ok) {
        notify("Conexiune OK — token-ul este valid.", "success");
      } else {
        const d = await res.json().catch(() => ({}));
        notify(d.detail ?? "Test eșuat.", "error");
      }
    } catch {
      notify("Eroare de rețea la test.", "error");
    }
  }

  return (
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
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
        <label class="form-label">client_id (OAuth ANAF)</label>
        <input
          class="input"
          type="text"
          placeholder="ex. 6f8a..."
          value={clientId()}
          onInput={(e) => setClientId(e.currentTarget.value)}
        />
      </div>

      <div class="form-group">
        <label class="form-label">
          client_secret {props.company.settings?.has_client_secret && <span style="font-size:11px;color:var(--success)">(setat)</span>}
        </label>
        <input
          class="input"
          type="password"
          placeholder={props.company.settings?.has_client_secret ? "•••••••• (lasă gol pentru a păstra)" : "introdu secret-ul"}
          value={clientSecret()}
          onInput={(e) => setClientSecret(e.currentTarget.value)}
          autocomplete="new-password"
        />
      </div>

      <div class="form-group">
        <label class="form-label">redirect_uri</label>
        <input
          class="input"
          type="text"
          placeholder="https://app.berlinstar.ro/api/efactura/callback"
          value={redirectUri()}
          onInput={(e) => setRedirectUri(e.currentTarget.value)}
        />
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
      </div>

      <div class="form-group">
        <label class="form-label">Tip factură default</label>
        <select
          class="input"
          value={defaultInvoiceType()}
          onChange={(e) => setDefaultInvoiceType(e.currentTarget.value as "380" | "381" | "386" | "751")}
        >
          <option value="380">380 - Factură normală</option>
          <option value="381">381 - Notă de credit</option>
          <option value="386">386 - Avans</option>
          <option value="751">751 - Auto-facturare</option>
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
          <span>Auto-upload facturi la ANAF</span>
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

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input
            type="checkbox"
            checked={validateSchematron()}
            onChange={(e) => setValidateSchematron(e.currentTarget.checked)}
          />
          <span>Validare Schematron CIUS-RO (Sprint 7)</span>
        </label>
      </div>

      {/* Action buttons */}
      <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onClick={save} disabled={saving()}>
          {saving() ? "Se salvează..." : "💾 Salvează setări"}
        </button>
        <button class="btn btn-ghost btn-sm" onClick={connect} title="Necesită USB-ul cu certificatul digital plugat">
          🔗 {props.company.token_status.connected ? "Reconnect ANAF (USB)" : "Conectează la ANAF (USB)"}
        </button>
        <Show when={props.company.token_status.connected}>
          <button class="btn btn-ghost btn-sm" onClick={testConn}>
            🧪 Test conexiune
          </button>
          <button class="btn btn-ghost btn-sm" onClick={disconnect} style="color:var(--danger)">
            🔌 Deconectează
          </button>
        </Show>
      </div>

      <div style="grid-column:1/-1;font-size:11px;color:var(--text-muted);padding-top:6px">
        💡 Pentru a conecta compania la ANAF, asigură-te că USB-ul cu certificatul digital este plugat
        în calculator și că middleware-ul (CertSign/DigiSign/TransSped/AlfaSign) este instalat.
        Token-ul OAuth este valabil 90 de zile, după care necesită reconnect cu USB.
      </div>
    </div>
  );
}

// ---------- Tab: Status transmiteri ----------

interface EFacturaRecordRow {
  id: number;
  company_id: number;
  receipt_id: number | null;
  cui: string;
  direction: string;
  standard: string;
  invoice_type: string;
  index_incarcare: number | null;
  status: string;
  anaf_stare: string | null;
  anaf_error_message: string | null;
  download_id: number | null;
  upload_attempts: number;
  invoice_issue_date: string;
  deadline_transmit: string;
  created_at: string;
  updated_at: string | null;
}

function statusBadgeColor(status: string): string {
  if (status === "accepted") return "var(--success)";
  if (status === "rejected" || status === "error") return "var(--danger)";
  if (status === "in_prelucrare" || status === "pending_upload" || status === "uploaded") return "var(--accent)";
  return "var(--text-muted)";
}

function StatusTab(props: { companies: CompanySummary[] }) {
  const [selectedCompanyId, setSelectedCompanyId] = createSignal<number | null>(
    props.companies[0]?.company_id ?? null
  );
  const [records, setRecords] = createSignal<EFacturaRecordRow[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [statusFilter, setStatusFilter] = createSignal<string>("");

  async function loadRecords() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter()) params.append("status", statusFilter());
      const res = await adminFetch(`/api/efactura/companies/${cid}/records?${params}`);
      if (res.ok) setRecords(await res.json());
      else notify("Nu am putut încărca transmiterile.", "error");
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus(receiptId: number | null) {
    if (!receiptId) return;
    try {
      const res = await adminFetch(`/api/efactura/receipts/${receiptId}/status`);
      if (res.ok) {
        notify("Status actualizat.", "success");
        void loadRecords();
      } else {
        const d = await res.json().catch(() => ({}));
        notify(d.detail ?? "Status refresh eșuat.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    }
  }

  function downloadZip(receiptId: number | null) {
    if (!receiptId) return;
    const url = `/api/efactura/receipts/${receiptId}/download`;
    window.open(url, "_blank");
  }

  return (
    <div>
      <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="form-label" style="margin:0">Companie:</label>
        <select
          class="input"
          style="max-width:280px"
          value={selectedCompanyId() ?? ""}
          onChange={(e) => setSelectedCompanyId(Number(e.currentTarget.value) || null)}
        >
          <For each={props.companies}>
            {(c) => <option value={c.company_id}>{c.name} (CUI {c.cui})</option>}
          </For>
        </select>

        <select
          class="input"
          style="max-width:200px"
          value={statusFilter()}
          onChange={(e) => setStatusFilter(e.currentTarget.value)}
        >
          <option value="">Toate statusurile</option>
          <option value="draft">Draft</option>
          <option value="pending_upload">În așteptare</option>
          <option value="in_prelucrare">În prelucrare ANAF</option>
          <option value="accepted">Acceptat</option>
          <option value="rejected">Respins</option>
          <option value="error">Eroare</option>
        </select>

        <button class="btn btn-primary btn-sm" onClick={loadRecords} disabled={loading() || !selectedCompanyId()}>
          {loading() ? "Se încarcă..." : "🔄 Încarcă transmiteri"}
        </button>
      </div>

      <Show when={records().length === 0 && !loading()}>
        <div class="text-muted" style="padding:30px;text-align:center">
          Apasă "Încarcă transmiteri" pentru a vedea facturile transmise la ANAF.
        </div>
      </Show>

      <Show when={records().length > 0}>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          {records().length} transmiteri afișate
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <For each={records()}>
            {(r) => (
              <div class="account-card" style="padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div style="min-width:200px">
                    <div>
                      <strong>Receipt #{r.receipt_id}</strong>
                      <span style="margin-left:8px;color:var(--text-muted);font-size:12px">
                        emisă {r.invoice_issue_date} • deadline {r.deadline_transmit}
                      </span>
                    </div>
                    <Show when={r.index_incarcare}>
                      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                        index_incarcare: {r.index_incarcare}
                      </div>
                    </Show>
                  </div>

                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <span style={`padding:3px 10px;border-radius:10px;border:1px solid ${statusBadgeColor(r.status)};color:${statusBadgeColor(r.status)};font-size:11px;font-weight:600`}>
                      {r.status}
                    </span>
                    <Show when={r.upload_attempts > 1}>
                      <span style="font-size:11px;color:var(--text-muted)">attempt #{r.upload_attempts}</span>
                    </Show>
                    <Show when={r.status === "in_prelucrare"}>
                      <button class="btn btn-ghost btn-sm" onClick={() => refreshStatus(r.receipt_id)}>
                        🔄 Verifică
                      </button>
                    </Show>
                    <Show when={r.download_id}>
                      <button class="btn btn-ghost btn-sm" onClick={() => downloadZip(r.receipt_id)}>
                        📥 ZIP
                      </button>
                    </Show>
                  </div>
                </div>

                <Show when={r.anaf_error_message}>
                  <div style="margin-top:6px;padding:6px 10px;background:rgba(220,38,38,0.08);border-radius:6px;font-size:12px;color:var(--danger)">
                    ⚠ {r.anaf_error_message}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ---------- Tab: Deadlines ----------

function DeadlinesTab(props: { companies: CompanySummary[] }) {
  const [selectedCompanyId, setSelectedCompanyId] = createSignal<number | null>(
    props.companies[0]?.company_id ?? null
  );
  const [records, setRecords] = createSignal<EFacturaRecordRow[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [daysAhead, setDaysAhead] = createSignal(5);

  async function load() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/efactura/companies/${cid}/pending-deadlines?days_ahead=${daysAhead()}`
      );
      if (res.ok) setRecords(await res.json());
      else notify("Eroare la deadlines.", "error");
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="form-label" style="margin:0">Companie:</label>
        <select
          class="input"
          style="max-width:280px"
          value={selectedCompanyId() ?? ""}
          onChange={(e) => setSelectedCompanyId(Number(e.currentTarget.value) || null)}
        >
          <For each={props.companies}>
            {(c) => <option value={c.company_id}>{c.name} (CUI {c.cui})</option>}
          </For>
        </select>

        <label class="form-label" style="margin:0">Zile înainte:</label>
        <input
          class="input"
          style="max-width:80px"
          type="number"
          min="0"
          max="30"
          value={daysAhead()}
          onInput={(e) => setDaysAhead(Number(e.currentTarget.value) || 0)}
        />

        <button class="btn btn-primary btn-sm" onClick={load} disabled={loading() || !selectedCompanyId()}>
          {loading() ? "Se încarcă..." : "🔄 Verifică"}
        </button>
      </div>

      <Show when={records().length === 0 && !loading()}>
        <div class="text-muted" style="padding:30px;text-align:center">
          🎉 Niciun deadline iminent în următoarele {daysAhead()} zile.
        </div>
      </Show>

      <Show when={records().length > 0}>
        <div style="background:rgba(220,38,38,0.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px">
          ⚠ {records().length} factură(i) cu deadline ANAF în maxim {daysAhead()} zile.
          Conform legii, depășirea atrage amenzi de 1.000–10.000 lei per factură.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <For each={records()}>
            {(r) => (
              <div class="account-card" style="padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div>
                    <strong>Receipt #{r.receipt_id}</strong>
                    <span style="margin-left:8px;color:var(--text-muted);font-size:12px">
                      emisă {r.invoice_issue_date} • status {r.status}
                    </span>
                  </div>
                  <span style="padding:3px 10px;border-radius:10px;border:1px solid var(--danger);color:var(--danger);font-size:12px;font-weight:600">
                    deadline {r.deadline_transmit}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ---------- Tab: Received ----------

interface ReceivedRow {
  id: number;
  id_solicitare: number;
  tip: string | null;
  data_creare: string | null;
  cif_emitent: string | null;
  nume_emitent: string | null;
  cif_beneficiar: string | null;
  nume_beneficiar: string | null;
  detalii: string | null;
  downloaded: boolean;
  response_zip_s3_key: string | null;
  created_at: string | null;
}

function ReceivedTab(props: { companies: CompanySummary[] }) {
  const [selectedCompanyId, setSelectedCompanyId] = createSignal<number | null>(
    props.companies[0]?.company_id ?? null
  );
  const [rows, setRows] = createSignal<ReceivedRow[]>([]);
  const [loading, setLoading] = createSignal(false);

  async function load() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/efactura/companies/${cid}/received?limit=200`);
      if (res.ok) setRows(await res.json());
      else notify("Eroare la facturi primite.", "error");
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    try {
      const res = await adminFetch(`/api/admin/efactura/jobs/efactura_sync_received/trigger`, {
        method: "POST",
      });
      if (res.ok) {
        notify("Sincronizare ANAF declanșată. Reîncarcă în câteva secunde.", "success");
        setTimeout(() => void load(), 2500);
      } else {
        notify("Sync eșuat.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    }
  }

  return (
    <div>
      <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="form-label" style="margin:0">Companie:</label>
        <select
          class="input"
          style="max-width:280px"
          value={selectedCompanyId() ?? ""}
          onChange={(e) => setSelectedCompanyId(Number(e.currentTarget.value) || null)}
        >
          <For each={props.companies}>
            {(c) => <option value={c.company_id}>{c.name} (CUI {c.cui})</option>}
          </For>
        </select>

        <button class="btn btn-primary btn-sm" onClick={load} disabled={loading() || !selectedCompanyId()}>
          {loading() ? "Se încarcă..." : "📨 Încarcă din cache"}
        </button>
        <button class="btn btn-ghost btn-sm" onClick={syncNow} disabled={!selectedCompanyId()}>
          🔄 Sincronizează acum de la ANAF
        </button>
      </div>

      <Show when={rows().length === 0 && !loading()}>
        <div class="text-muted" style="padding:30px;text-align:center">
          Nicio factură primită încă. Apasă "Sincronizează acum" pentru a interoga ANAF.
        </div>
      </Show>

      <Show when={rows().length > 0}>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          {rows().length} facturi primite din cache (job-ul rulează automat la 60 min)
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <For each={rows()}>
            {(r) => (
              <div class="account-card" style="padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div>
                    <strong>{r.nume_emitent ?? r.cif_emitent ?? "—"}</strong>
                    <span style="margin-left:8px;color:var(--text-muted);font-size:12px">
                      CIF {r.cif_emitent} • {r.data_creare}
                    </span>
                  </div>
                  <span style="padding:2px 8px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);font-size:11px">
                    {r.tip ?? "—"}
                  </span>
                </div>
                <Show when={r.detalii}>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:4px">{r.detalii}</div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ---------- Tab: Audit mapping ----------

interface MappingAuditEntry {
  receipt_id: number;
  factura_serie: string | null;
  factura_nr: number | null;
  titlu: string | null;
  issues: string[];
}

function AuditTab(props: { companies: CompanySummary[] }) {
  const [selectedCompanyId, setSelectedCompanyId] = createSignal<number | null>(
    props.companies[0]?.company_id ?? null
  );
  const [entries, setEntries] = createSignal<MappingAuditEntry[]>([]);
  const [loading, setLoading] = createSignal(false);

  async function runAudit() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/efactura/companies/${cid}/audit?limit=100`);
      if (res.ok) setEntries(await res.json());
      else notify("Audit eșuat.", "error");
    } catch {
      notify("Eroare de rețea la audit.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="form-label" style="margin:0">Companie:</label>
        <select
          class="input"
          style="max-width:300px"
          value={selectedCompanyId() ?? ""}
          onChange={(e) => setSelectedCompanyId(Number(e.currentTarget.value) || null)}
        >
          <For each={props.companies}>
            {(c) => <option value={c.company_id}>{c.name} (CUI {c.cui})</option>}
          </For>
        </select>
        <button class="btn btn-primary btn-sm" onClick={runAudit} disabled={loading() || !selectedCompanyId()}>
          {loading() ? "Se analizează..." : "🔍 Rulează audit"}
        </button>
      </div>

      <Show when={entries().length === 0 && !loading()}>
        <div class="text-muted" style="padding:30px;text-align:center">
          Apasă "Rulează audit" pentru a vedea facturile cu câmpuri incomplete pentru eFactura.
        </div>
      </Show>

      <Show when={entries().length > 0}>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          {entries().length} factură(i) cu probleme de mapare (last 100)
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <For each={entries()}>
            {(e) => (
              <div class="account-card" style="padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div>
                    <strong>#{e.receipt_id}</strong> — {e.factura_serie ?? ""}
                    {e.factura_nr ?? ""}
                    <Show when={e.titlu}>
                      <span style="color:var(--text-muted);margin-left:8px">— {e.titlu}</span>
                    </Show>
                  </div>
                  <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(220,38,38,0.1);color:var(--danger)">
                    {e.issues.length} {e.issues.length === 1 ? "problemă" : "probleme"}
                  </span>
                </div>
                <ul style="margin:8px 0 0;padding-left:20px;font-size:12px;color:var(--text-muted)">
                  <For each={e.issues}>{(issue) => <li>{issue}</li>}</For>
                </ul>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ---------- Placeholder pentru taburi viitoare ----------

function PlaceholderTab(props: { title: string; body: string }) {
  return (
    <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:8px;padding:30px;text-align:center">
      <h3 style="margin:0 0 8px;color:var(--text-muted)">{props.title}</h3>
      <p style="margin:0;color:var(--text-muted);font-size:13px">{props.body}</p>
    </div>
  );
}
