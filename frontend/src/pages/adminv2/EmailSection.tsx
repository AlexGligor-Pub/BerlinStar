import { For, Show, createSignal, onMount, createEffect, on } from "solid-js";
import { readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { ApiMessageBody } from "../../types";
import { adminFetch } from "./admin-auth";
import { fmtDate } from "./shared";
import type { Account } from "./types";

interface SmtpSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_from_address: string;
  smtp_use_tls: boolean;
  smtp_enabled: boolean;
}

interface EmailTemplate {
  id: number;
  scenario: string;
  subject: string;
  title: string;
  body: string;
  enabled: boolean;
}

interface EmailLog {
  id: number;
  sent_at: string;
  account_id: number | null;
  to_address: string;
  scenario: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  body_html: string | null;
}

const SCENARIO_LABELS: Record<string, string> = {
  client_nou: "Client nou",
  reminder_plata: "Reminder plată",
};

const EMPTY_SMTP: SmtpSettings = {
  smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
  smtp_from_name: "", smtp_from_address: "", smtp_use_tls: true, smtp_enabled: false,
};


export default function EmailSection() {
  const [smtp, setSmtp] = createSignal<SmtpSettings>({ ...EMPTY_SMTP });
  const [smtpSaving, setSmtpSaving] = createSignal(false);
  const [smtpMsg, setSmtpMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  const [testTo, setTestTo] = createSignal("");
  const [testSubject, setTestSubject] = createSignal("Test email — BerlinStar");
  const [testBody, setTestBody] = createSignal(
    "<p>Acesta este un <strong>email de test</strong> trimis din BerlinStar.</p><p>Dacă îl primiți, configurația SMTP funcționează corect.</p>"
  );
  const [testPreview, setTestPreview] = createSignal(false);
  const [testSending, setTestSending] = createSignal(false);
  const [testMsg, setTestMsg] = createSignal<{ ok: boolean; text: string } | null>(null);

  const [tmplEdits, setTmplEdits] = createSignal<Record<string, EmailTemplate>>({});
  const [expandedScenario, setExpandedScenario] = createSignal<string | null>(null);
  const [tmplSaving, setTmplSaving] = createSignal<string | null>(null);
  const [tmplMsg, setTmplMsg] = createSignal<Record<string, { ok: boolean; text: string }>>({});
  const [previewScenarios, setPreviewScenarios] = createSignal<Record<string, boolean>>({});

  const [logs, setLogs] = createSignal<EmailLog[]>([]);
  const [logsAccounts, setLogsAccounts] = createSignal<Account[]>([]);
  const [filterAccountId, setFilterAccountId] = createSignal<number | null>(null);
  const [expandedLogId, setExpandedLogId] = createSignal<number | null>(null);
  const [openMenuId, setOpenMenuId] = createSignal<number | null>(null);
  const [viewLog, setViewLog] = createSignal<EmailLog | null>(null);
  const [resendingId, setResendingId] = createSignal<number | null>(null);
  const [resendMsg, setResendMsg] = createSignal<{ id: number; ok: boolean; text: string } | null>(null);

  onMount(async () => {
    try {
      const r = await adminFetch("/api/email-settings/smtp");
      if (r.ok) setSmtp(await r.json());
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare SMTP.", "error");
    }
    try {
      const r = await adminFetch("/api/email-settings/templates");
      if (r.ok) {
        const data: EmailTemplate[] = await r.json();
        const edits: Record<string, EmailTemplate> = {};
        for (const t of data) edits[t.scenario] = { ...t };
        setTmplEdits(edits);
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare template-uri email.", "error");
    }
    try {
      const r = await adminFetch("/api/accounts?limit=200&sort=id");
      if (r.ok) {
        const data: { items: Account[] } = await r.json();
        setLogsAccounts(data.items);
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare conturi.", "error");
    }
    loadLogs();
  });

  async function loadLogs() {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterAccountId() !== null) params.set("account_id", String(filterAccountId()));
      const r = await adminFetch(`/api/email-settings/logs?${params}`);
      if (r.ok) setLogs(await r.json());
    } catch {}
  }

  // Refetch logs cand filtru cont se schimba — dependenta explicita via on().
  createEffect(on(filterAccountId, () => { void loadLogs(); }));

  async function saveSmtp() {
    setSmtpSaving(true);
    setSmtpMsg(null);
    try {
      const r = await adminFetch("/api/email-settings/smtp", {
        method: "PATCH",
        body: JSON.stringify(smtp()),
      });
      if (r.ok) {
        setSmtpMsg({ ok: true, text: "Setări salvate." });
      } else {
        const d = await readJsonSafe<ApiMessageBody>(r);
        setSmtpMsg({ ok: false, text: d.detail ?? "Eroare la salvare." });
      }
    } catch {
      setSmtpMsg({ ok: false, text: "Eroare de conexiune." });
    } finally {
      setSmtpSaving(false);
    }
  }

  async function sendTest() {
    setTestSending(true);
    setTestMsg(null);
    try {
      const r = await adminFetch("/api/email-settings/test", {
        method: "POST",
        body: JSON.stringify({ to_address: testTo(), subject: testSubject() || undefined, body_html: testBody() || undefined }),
      });
      const d = await readJsonSafe<ApiMessageBody>(r);
      if (r.ok) {
        setTestMsg({ ok: true, text: d.message ?? "Email trimis." });
        loadLogs();
      } else {
        setTestMsg({ ok: false, text: d.detail ?? "Eroare la trimitere." });
        loadLogs();
      }
    } catch {
      setTestMsg({ ok: false, text: "Eroare de conexiune." });
    } finally {
      setTestSending(false);
    }
  }

  async function saveTemplate(scenario: string) {
    setTmplSaving(scenario);
    setTmplMsg((prev) => { const n = { ...prev }; delete n[scenario]; return n; });
    const edits = tmplEdits()[scenario];
    if (!edits) return;
    try {
      const r = await adminFetch(`/api/email-settings/templates/${scenario}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: edits.subject,
          title: edits.title,
          body: edits.body,
          enabled: edits.enabled,
        }),
      });
      const d = await readJsonSafe<EmailTemplate & ApiMessageBody>(r);
      if (r.ok) {
        setTmplEdits((prev) => ({ ...prev, [scenario]: { ...prev[scenario], ...(d as EmailTemplate) } }));
        setTmplMsg((prev) => ({ ...prev, [scenario]: { ok: true, text: "Template salvat." } }));
      } else {
        setTmplMsg((prev) => ({
          ...prev,
          [scenario]: { ok: false, text: d.detail ?? "Eroare." },
        }));
      }
    } catch {
      setTmplMsg((prev) => ({ ...prev, [scenario]: { ok: false, text: "Eroare de conexiune." } }));
    } finally {
      setTmplSaving(null);
    }
  }

  async function resendEmail(log: EmailLog) {
    setResendingId(log.id);
    setResendMsg(null);
    setOpenMenuId(null);
    try {
      const r = await adminFetch(`/api/email-settings/logs/${log.id}/resend`, { method: "POST" });
      const d = await readJsonSafe<ApiMessageBody>(r);
      if (r.ok) {
        setResendMsg({ id: log.id, ok: true, text: "Email retrims cu succes." });
        loadLogs();
      } else {
        setResendMsg({ id: log.id, ok: false, text: d.detail ?? "Eroare la retrimitere." });
      }
    } catch {
      setResendMsg({ id: log.id, ok: false, text: "Eroare de conexiune." });
    } finally {
      setResendingId(null);
    }
  }

  function setSmtpField<K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) {
    setSmtp((prev) => ({ ...prev, [key]: value }));
  }

  function setTmplField(scenario: string, key: keyof EmailTemplate, value: any) {
    setTmplEdits((prev) => ({
      ...prev,
      [scenario]: { ...(prev[scenario] ?? {}), [key]: value } as EmailTemplate,
    }));
  }

  const VARIABLE_HINT = "{client_name}, {company_name}, {amount}, {factura_nr}, {expiry_date}, {vehicle_plate}";

  return (
    <div>
      <div class="page-header" style="margin-bottom:24px">
        <h2 class="page-title" style="font-size:1.25rem">Email</h2>
      </div>

      {/* ── SMTP Config ── */}
      <div class="card" style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px">Configurare SMTP</h3>

        <div class="admin-form-row" style="margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
            <input type="checkbox" checked={smtp().smtp_enabled}
              onChange={(e) => setSmtpField("smtp_enabled", e.currentTarget.checked)} />
            Activat
          </label>
        </div>

        <div class="admin-form-row">
          <label class="admin-form-label">Host SMTP</label>
          <input class="input" placeholder="mail.domain.com" value={smtp().smtp_host}
            onInput={(e) => setSmtpField("smtp_host", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Port</label>
          <input class="input" type="number" value={smtp().smtp_port}
            onInput={(e) => setSmtpField("smtp_port", parseInt(e.currentTarget.value) || 587)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Utilizator SMTP</label>
          <input class="input" value={smtp().smtp_user}
            onInput={(e) => setSmtpField("smtp_user", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Parolă SMTP</label>
          <input class="input" type="password" placeholder="(gol = neschimbat)"
            value={smtp().smtp_password}
            onInput={(e) => setSmtpField("smtp_password", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Nume expeditor</label>
          <input class="input" value={smtp().smtp_from_name}
            onInput={(e) => setSmtpField("smtp_from_name", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Adresă expeditor</label>
          <input class="input" type="email" value={smtp().smtp_from_address}
            onInput={(e) => setSmtpField("smtp_from_address", e.currentTarget.value)} />
        </div>
        <div class="admin-form-row" style="margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
            <input type="checkbox" checked={smtp().smtp_use_tls}
              onChange={(e) => setSmtpField("smtp_use_tls", e.currentTarget.checked)} />
            Folosește STARTTLS (port 587) — dezactivat = SSL direct (port 465)
          </label>
        </div>

        <Show when={smtpMsg()}>
          {(msg) => (
            <p style={`font-size:13px;margin-bottom:8px;color:var(--${msg().ok ? "success" : "danger"})`}>
              {msg().text}
            </p>
          )}
        </Show>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" disabled={smtpSaving()} onClick={saveSmtp}>
            {smtpSaving() ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>

      {/* ── Test email ── */}
      <div class="card" style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px">Testează trimiterea</h3>
        <div class="admin-form-row" style="margin-bottom:12px">
          <label class="admin-form-label">Adresă destinatar test</label>
          <input class="input" type="email" placeholder="test@example.com"
            value={testTo()} onInput={(e) => setTestTo(e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <label class="admin-form-label">Subiect</label>
          <input class="input" value={testSubject()}
            onInput={(e) => setTestSubject(e.currentTarget.value)} />
        </div>
        <div class="admin-form-row">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="admin-form-label" style="margin-bottom:0">Conținut HTML</label>
            <button
              class="btn btn-ghost btn-sm"
              style="font-size:0.78rem;padding:2px 10px"
              onClick={() => setTestPreview((v) => !v)}
            >
              {testPreview() ? "✏️ Editează" : "👁 Preview"}
            </button>
          </div>
          <Show
            when={testPreview()}
            fallback={
              <textarea
                class="input admin-textarea"
                style="min-height:140px;font-family:monospace;font-size:0.82rem"
                value={testBody()}
                onInput={(e) => setTestBody(e.currentTarget.value)}
              />
            }
          >
            <iframe
              srcdoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;margin:0;color:#222;font-size:14px;line-height:1.6}</style></head><body>${testBody()}</body></html>`}
              style="width:100%;min-height:140px;border:1px solid var(--border);border-radius:6px;background:#fff;display:block"
              sandbox=""
            />
          </Show>
        </div>
        <Show when={testMsg()}>
          {(msg) => (
            <p style={`font-size:13px;margin-bottom:8px;color:var(--${msg().ok ? "success" : "danger"})`}>
              {msg().text}
            </p>
          )}
        </Show>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" disabled={testSending() || !testTo().includes("@")}
            onClick={sendTest}>
            {testSending() ? "Se trimite..." : "Trimite email test"}
          </button>
        </div>
      </div>

      {/* ── Template-uri ── */}
      <div style="max-width:680px;margin-bottom:20px">
        <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:8px">Template-uri email</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">
          Variabile disponibile în subiect și conținut:&nbsp;
          <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:0.78rem">
            {VARIABLE_HINT}
          </code>
        </p>

        <For each={["client_nou", "reminder_plata"]}>
          {(scenario) => {
            const tmpl = () => tmplEdits()[scenario];
            const isExpanded = () => expandedScenario() === scenario;
            const msg = () => tmplMsg()[scenario];
            const isPreview = () => previewScenarios()[scenario] ?? false;

            return (
              <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden">
                <button
                  style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:none;border:none;cursor:pointer;text-align:left"
                  onClick={() => setExpandedScenario(isExpanded() ? null : scenario)}
                >
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:0.9rem;font-weight:600;color:var(--text)">
                      {SCENARIO_LABELS[scenario] ?? scenario}
                    </span>
                    <Show when={tmpl()?.enabled}>
                      <span class="admin-badge admin-badge--active" style="font-size:0.7rem">Activ</span>
                    </Show>
                    <Show when={tmpl() && !tmpl()!.enabled}>
                      <span class="admin-badge admin-badge--deleted" style="font-size:0.7rem">Inactiv</span>
                    </Show>
                  </div>
                  <span style="color:var(--text-muted);font-size:0.75rem">{isExpanded() ? "▲" : "▼"}</span>
                </button>

                <Show when={isExpanded()}>
                  <div style="padding:0 16px 16px;border-top:1px solid var(--border)">
                    <div class="admin-form-row" style="margin-top:12px">
                      <label class="admin-form-label">Subiect</label>
                      <input class="input" value={tmpl()?.subject ?? ""}
                        onInput={(e) => setTmplField(scenario, "subject", e.currentTarget.value)} />
                    </div>
                    <div class="admin-form-row">
                      <label class="admin-form-label">Titlu (heading în email)</label>
                      <input class="input" value={tmpl()?.title ?? ""}
                        onInput={(e) => setTmplField(scenario, "title", e.currentTarget.value)} />
                    </div>
                    <div class="admin-form-row">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                        <label class="admin-form-label" style="margin-bottom:0">Conținut HTML</label>
                        <button
                          class="btn btn-ghost btn-sm"
                          style="font-size:0.78rem;padding:2px 10px"
                          onClick={() => setPreviewScenarios((prev) => ({ ...prev, [scenario]: !prev[scenario] }))}
                        >
                          {isPreview() ? "✏️ Editează" : "👁 Preview"}
                        </button>
                      </div>
                      <Show
                        when={isPreview()}
                        fallback={
                          <textarea
                            class="input admin-textarea"
                            style="min-height:200px;font-family:monospace;font-size:0.82rem"
                            value={tmpl()?.body ?? ""}
                            onInput={(e) => setTmplField(scenario, "body", e.currentTarget.value)}
                          />
                        }
                      >
                        <iframe
                          srcdoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;margin:0;color:#222;font-size:14px;line-height:1.6}</style></head><body>${tmpl()?.body ?? ""}</body></html>`}
                          style="width:100%;min-height:200px;border:1px solid var(--border);border-radius:6px;background:#fff;display:block"
                          sandbox=""
                        />
                      </Show>
                    </div>
                    <div class="admin-form-row" style="margin-bottom:12px">
                      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
                        <input type="checkbox" checked={tmpl()?.enabled ?? false}
                          onChange={(e) => setTmplField(scenario, "enabled", e.currentTarget.checked)} />
                        Activat
                      </label>
                    </div>
                    <Show when={msg()}>
                      {(m) => (
                        <p style={`font-size:13px;margin-bottom:8px;color:var(--${m().ok ? "success" : "danger"})`}>
                          {m().text}
                        </p>
                      )}
                    </Show>
                    <div style="display:flex;justify-content:flex-end">
                      <button class="btn btn-primary btn-sm"
                        disabled={tmplSaving() === scenario}
                        onClick={() => saveTemplate(scenario)}>
                        {tmplSaving() === scenario ? "Se salvează..." : "Salvează template"}
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* ── Istoric emailuri ── */}
      <div style="max-width:900px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3 style="font-size:0.95rem;font-weight:600">Istoric emailuri trimise</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <select
              class="input"
              style="width:auto;font-size:0.85rem;padding:4px 8px"
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFilterAccountId(v === "" ? null : parseInt(v));
              }}
            >
              <option value="">Toate conturile</option>
              <For each={logsAccounts()}>
                {(acc) => <option value={acc.id}>{acc.name}</option>}
              </For>
            </select>
            <button class="btn btn-ghost btn-sm" onClick={loadLogs}>↻ Refresh</button>
          </div>
        </div>

        <Show
          when={logs().length > 0}
          fallback={<p style="color:var(--text-muted);font-size:0.875rem">Niciun email trimis încă.</p>}
        >
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border)">
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Data/ora</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Cont</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Destinatar</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Scenariu</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Subiect</th>
                  <th style="text-align:left;padding:6px 10px;white-space:nowrap;color:var(--text-muted)">Status</th>
                  <th style="padding:6px 10px" />
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log) => {
                    const isErr = log.status === "error";
                    const accountName = () => {
                      if (log.account_id === null) return "Admin";
                      return logsAccounts().find((a) => a.id === log.account_id)?.name ?? `#${log.account_id}`;
                    };
                    const isExpanded = () => expandedLogId() === log.id;
                    const menuOpen = () => openMenuId() === log.id;

                    return (
                      <>
                        <tr
                          style={`border-bottom:1px solid var(--border);cursor:${isErr ? "pointer" : "default"};background:${isErr ? "rgba(var(--danger-rgb,220,53,69),0.04)" : "transparent"}`}
                          onClick={() => isErr && setExpandedLogId(isExpanded() ? null : log.id)}
                        >
                          <td style="padding:6px 10px;white-space:nowrap;color:var(--text-muted)">{fmtDate(log.sent_at)}</td>
                          <td style="padding:6px 10px;white-space:nowrap">{accountName()}</td>
                          <td style="padding:6px 10px;white-space:nowrap">{log.to_address}</td>
                          <td style="padding:6px 10px;white-space:nowrap">
                            {log.scenario ? (SCENARIO_LABELS[log.scenario] ?? log.scenario) : "Test"}
                          </td>
                          <td style="padding:6px 10px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                            title={log.subject}>{log.subject}</td>
                          <td style="padding:6px 10px">
                            <Show
                              when={isErr}
                              fallback={<span class="admin-badge admin-badge--active" style="font-size:0.7rem">OK</span>}
                            >
                              <span class="admin-badge admin-badge--deleted" style="font-size:0.7rem">Eroare {isErr ? "▾" : ""}</span>
                            </Show>
                          </td>
                          <td style="padding:4px 8px;position:relative">
                            <button
                              class="btn btn-ghost btn-sm"
                              style="padding:2px 8px;font-size:1.1rem;line-height:1"
                              onClick={() => setOpenMenuId(menuOpen() ? null : log.id)}
                              title="Acțiuni"
                            >⋮</button>
                            <Show when={menuOpen()}>
                              <div style="position:absolute;right:4px;top:calc(100% + 2px);z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.25);min-width:180px;overflow:hidden">
                                <button
                                  style="display:block;width:100%;text-align:left;padding:9px 14px;background:var(--surface);border:none;cursor:pointer;font-size:0.84rem;color:var(--text)"
                                  onClick={() => { setViewLog(log); setOpenMenuId(null); }}
                                >Vizualizare email</button>
                                <button
                                  style="display:block;width:100%;text-align:left;padding:9px 14px;background:var(--surface);border:none;border-top:1px solid var(--border);cursor:pointer;font-size:0.84rem;color:var(--text)"
                                  onClick={() => resendEmail(log)}
                                  disabled={resendingId() === log.id}
                                >{resendingId() === log.id ? "Se trimite..." : "Retrimitere"}</button>
                              </div>
                            </Show>
                            <Show when={resendMsg()?.id === log.id}>
                              <span style={`font-size:0.72rem;display:block;white-space:nowrap;color:${resendMsg()?.ok ? "var(--success)" : "var(--danger)"}`}>
                                {resendMsg()?.text}
                              </span>
                            </Show>
                          </td>
                        </tr>
                        <Show when={isExpanded() && isErr}>
                          <tr style="background:rgba(var(--danger-rgb,220,53,69),0.04)">
                            <td colspan="7" style="padding:6px 10px 10px 10px;font-size:0.78rem;color:var(--danger)">
                              {log.error_message ?? "Eroare necunoscută"}
                            </td>
                          </tr>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      {/* overlay pentru închidere meniu dropdown */}
      <Show when={openMenuId() !== null}>
        <div style="position:fixed;inset:0;z-index:199" onClick={() => setOpenMenuId(null)} />
      </Show>

      {/* ── Vizualizare email modal ── */}
      <Show when={viewLog() !== null}>
        {(_) => {
          const log = viewLog()!;
          const accountName = log.account_id === null
            ? "Admin"
            : (logsAccounts().find((a) => a.id === log.account_id)?.name ?? `#${log.account_id}`);
          return (
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px">
              <div class="card" style="width:100%;max-width:720px;max-height:88vh;overflow-y:auto;padding:24px;position:relative">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                  <h3 style="font-size:1rem;font-weight:600;margin:0">Vizualizare email</h3>
                  <button class="btn btn-ghost btn-sm" onClick={() => setViewLog(null)}>✕ Închide</button>
                </div>
                <div style="display:grid;grid-template-columns:max-content 1fr;gap:6px 12px;font-size:0.85rem;margin-bottom:16px">
                  <span style="color:var(--text-muted)">Data/ora</span><span>{fmtDate(log.sent_at)}</span>
                  <span style="color:var(--text-muted)">Cont</span><span>{accountName}</span>
                  <span style="color:var(--text-muted)">Destinatar</span><span>{log.to_address}</span>
                  <span style="color:var(--text-muted)">Scenariu</span>
                  <span>{log.scenario ? (SCENARIO_LABELS[log.scenario] ?? log.scenario) : "Test"}</span>
                  <span style="color:var(--text-muted)">Subiect</span><span>{log.subject}</span>
                  <span style="color:var(--text-muted)">Status</span>
                  <span>
                    <Show
                      when={log.status === "error"}
                      fallback={<span class="admin-badge admin-badge--active" style="font-size:0.75rem">OK</span>}
                    >
                      <span class="admin-badge admin-badge--deleted" style="font-size:0.75rem">Eroare</span>
                    </Show>
                  </span>
                  <Show when={log.error_message}>
                    <span style="color:var(--text-muted)">Eroare</span>
                    <span style="color:var(--danger);font-size:0.8rem">{log.error_message}</span>
                  </Show>
                </div>
                <Show
                  when={log.body_html}
                  fallback={<p style="color:var(--text-muted);font-size:0.85rem">Conținutul emailului nu a fost salvat.</p>}
                >
                  <div style="margin-bottom:8px;font-size:0.8rem;font-weight:600;color:var(--text-muted)">Conținut email</div>
                  <iframe
                    sandbox=""
                    srcdoc={log.body_html!}
                    style="width:100%;min-height:320px;border:1px solid var(--border);border-radius:6px;background:#fff"
                  />
                </Show>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
}
