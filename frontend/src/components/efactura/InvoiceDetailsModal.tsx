import { For, Show, createEffect, createSignal, Switch, Match } from "solid-js";
import Modal from "../ui/Modal";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import { printInvoiceReceivedPdf, type InvoiceDetailsReceived } from "../../utils/pdf/invoiceReceived";

export interface ReceivedSummary {
  id: number;
  id_solicitare: number;
  tip: string | null;
  data_creare: string | null;
  cif_emitent: string | null;
  nume_emitent: string | null;
  detalii: string | null;
  is_read: boolean;
  downloaded: boolean;
  paid: boolean;
  paid_at: string | null;
}

export interface SentSummary {
  id: number;
  status: string;
  anaf_stare: string | null;
  anaf_error_message: string | null;
  index_incarcare: number | null;
  download_id: number | null;
  cui: string;
  invoice_issue_date: string;
  deadline_transmit: string;
  invoice_type: string;
  receipt_id: number | null;
  upload_attempts: number;
  created_at: string;
}

interface PropsReceived {
  mode: "received";
  open: boolean;
  companyId: number;
  row: ReceivedSummary | null;
  onClose: () => void;
  onMarkedRead?: (id: number) => void;
  onMarkedPaid?: (id: number, paid: boolean, paid_at: string | null) => void;
}

interface PropsSent {
  mode: "sent";
  open: boolean;
  companyId: number;
  row: SentSummary | null;
  onClose: () => void;
}

type Props = PropsReceived | PropsSent;

function fmtDateANAF(s: string | null): string {
  if (!s) return "—";
  // ANAF stocheaza YYYYMMDDhhmm sau yyyymmdd
  if (/^\d{8,}/.test(s)) {
    const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
    if (s.length >= 12) return `${y}-${m}-${d} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
    return `${y}-${m}-${d}`;
  }
  return s;
}

function fmtMoney(s: string | null | undefined, curr: string | null = null): string {
  if (!s) return "—";
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  const f = n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return curr ? `${f} ${curr}` : f;
}

export default function InvoiceDetailsModal(props: Props) {
  return (
    <Show when={props.open && props.row}>
      <Switch>
        <Match when={props.mode === "received" && props.row}>
          <ReceivedDetails {...(props as PropsReceived)} />
        </Match>
        <Match when={props.mode === "sent" && props.row}>
          <SentDetails {...(props as PropsSent)} />
        </Match>
      </Switch>
    </Show>
  );
}

function ReceivedDetails(props: PropsReceived) {
  const row = () => props.row!;
  const [details, setDetails] = createSignal<InvoiceDetailsReceived | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [markedRead, setMarkedRead] = createSignal(false);
  const [showHelp, setShowHelp] = createSignal(false);
  const [paid, setPaid] = createSignal(false);
  const [paidAt, setPaidAt] = createSignal<string | null>(null);
  const [paying, setPaying] = createSignal(false);

  createEffect(() => {
    const r = props.row;
    if (r) { setPaid(r.paid); setPaidAt(r.paid_at); }
  });

  async function togglePaid() {
    const r = props.row;
    if (!r || paying()) return;
    const next = !paid();
    setPaying(true);
    try {
      const res = await apiFetch(
        `/api/efactura/companies/${props.companyId}/received/${r.id}/mark-paid`,
        { method: "POST", body: JSON.stringify({ paid: next }) },
      );
      if (!res.ok) {
        notify("Nu am putut actualiza starea de plată.", "error");
        return;
      }
      const data = (await res.json()) as { paid: boolean; paid_at: string | null };
      setPaid(data.paid);
      setPaidAt(data.paid_at);
      props.onMarkedPaid?.(r.id, data.paid, data.paid_at);
      notify(data.paid ? "Marcată ca plătită." : "Marcare plată anulată.", "success");
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setPaying(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setDetails(null);
    try {
      const r = await apiFetch(
        `/api/efactura/companies/${props.companyId}/received/${row().id}/details`,
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({} as any));
        setError(data.detail ?? `Eroare ${r.status}`);
        return;
      }
      const d = (await r.json()) as InvoiceDetailsReceived;
      setDetails(d);
      // fire-and-forget mark-as-read
      if (!row().is_read && !markedRead()) {
        setMarkedRead(true);
        apiFetch(`/api/efactura/companies/${props.companyId}/received/${row().id}/mark-read`, {
          method: "POST",
        })
          .then((res) => { if (res.ok) props.onMarkedRead?.(row().id); })
          .catch(() => {});
      }
    } catch (e) {
      setError("Eroare de rețea.");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    if (props.open && row()) {
      void load();
    }
  });

  async function downloadXml() {
    try {
      const r = await apiFetch(
        `/api/efactura/companies/${props.companyId}/received/${row().id}/xml`,
      );
      if (!r.ok) {
        notify("Nu am putut descărca XML-ul.", "error");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura_${row().id_solicitare}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Eroare la descărcare XML.", "error");
    }
  }

  async function printPdf() {
    const d = details();
    if (!d) return;
    try {
      await printInvoiceReceivedPdf(d);
    } catch (e) {
      notify("Eroare la generarea PDF-ului.", "error");
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Factură primită • ${row().nume_emitent ?? row().cif_emitent ?? "—"}`}
      size="lg"
      footer={
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;width:100%">
          <button
            class="btn btn-ghost"
            onClick={() => setShowHelp((v) => !v)}
            title="Arată / ascunde descrierea butoanelor"
            aria-expanded={showHelp()}
          >
            ℹ️ Info
          </button>
          <button
            class="btn btn-ghost"
            onClick={togglePaid}
            disabled={paying()}
            style={paid() ? "background:rgba(34,197,94,0.15);color:var(--success);border-color:var(--success);font-weight:600" : ""}
            title={paid() ? `Marcată plătită${paidAt() ? " (" + paidAt() + ")" : ""} — click pentru a anula` : "Marchează factura ca plătită"}
          >
            {paid() ? "✓ Plătită" : "💰 Marchează plata"}
          </button>
          <button
            class="btn btn-ghost"
            disabled
            title="În curând: alertă email înainte de scadență"
          >
            ⏰ Reminder scadență
          </button>
          <button
            class="btn btn-ghost"
            disabled
            title="În curând: export CSV/SAGA/ContaB"
          >
            📊 Export contabilitate
          </button>
          <div style="flex:1" />
          <button class="btn btn-ghost" onClick={downloadXml} disabled={loading() || !!error()}>
            📄 Descarcă XML
          </button>
          <button class="btn btn-primary" onClick={printPdf} disabled={!details()}>
            🖨️ Printează PDF
          </button>
          <button class="btn btn-ghost" onClick={props.onClose}>Închide</button>
        </div>
      }
    >
      <Show when={loading()}>
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          <div class="skeleton" style="height:18px;width:60%;margin:0 auto 10px" />
          <div class="skeleton" style="height:18px;width:80%;margin:0 auto 10px" />
          <div class="skeleton" style="height:120px;width:100%;margin-top:14px" />
          <div style="margin-top:12px;font-size:13px">Descărcăm factura de la ANAF…</div>
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div style="padding:20px;background:rgba(239,68,68,0.08);border:1px solid var(--danger);border-radius:6px;color:var(--danger)">
          <strong>Eroare:</strong> {error()}
          <div style="margin-top:10px">
            <button class="btn btn-sm btn-ghost" onClick={load}>Reîncearcă</button>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !error() && details()}>
        {(d) => (
          <div style="display:flex;flex-direction:column;gap:14px;font-size:13px">
            <Suggestions details={d()} />

            <div class="invoice-party-grid">
              <PartyCard label="EMITENT" p={d().supplier} />
              <PartyCard label="BENEFICIAR" p={d().customer} />
            </div>

            <div class="invoice-meta-grid">
              <Field label="Tip">{d().doc_type === "CreditNote" ? "Notă credit" : "Factură"}</Field>
              <Field label="Număr">{d().invoice_number ?? "—"}</Field>
              <Field label="Data emiterii">{d().issue_date ?? "—"}</Field>
              <Field label="Scadență">{d().due_date ?? "—"}</Field>
              <Field label="Cod tip">{d().invoice_type_code ?? "—"}</Field>
              <Field label="Monedă">{d().currency ?? "—"}</Field>
              <Field label="IBAN">{d().payment_iban ?? "—"}</Field>
              <Field label="Bancă">{d().payment_bank ?? "—"}</Field>
            </div>

            <Show when={d().payment_terms || d().note}>
              <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;font-size:12px">
                <Show when={d().payment_terms}>
                  <div><strong>Termeni plată:</strong> {d().payment_terms}</div>
                </Show>
                <Show when={d().note}>
                  <div><strong>Mențiuni:</strong> {d().note}</div>
                </Show>
              </div>
            </Show>

            <Show when={d().lines.length > 0}>
              <div>
                <h4 style="margin:0 0 8px 0;font-size:13px;text-transform:uppercase;color:var(--text-muted)">Linii produs</h4>
                <div style="overflow-x:auto">
                  <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead>
                      <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                        <th style="padding:6px;text-align:left">#</th>
                        <th style="padding:6px;text-align:left">Descriere</th>
                        <th style="padding:6px;text-align:right">Cant.</th>
                        <th style="padding:6px;text-align:center">U.M.</th>
                        <th style="padding:6px;text-align:right">Preț unit.</th>
                        <th style="padding:6px;text-align:right">Val. net</th>
                        <th style="padding:6px;text-align:center">TVA %</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().lines}>
                        {(l, i) => (
                          <tr style="border-bottom:1px solid var(--border)">
                            <td style="padding:6px">{i() + 1}</td>
                            <td style="padding:6px">{l.description ?? "—"}</td>
                            <td style="padding:6px;text-align:right">{l.quantity ?? "—"}</td>
                            <td style="padding:6px;text-align:center">{l.unit_code ?? ""}</td>
                            <td style="padding:6px;text-align:right">{fmtMoney(l.unit_price)}</td>
                            <td style="padding:6px;text-align:right;font-weight:600">{fmtMoney(l.line_net)}</td>
                            <td style="padding:6px;text-align:center">{l.vat_percent ? `${l.vat_percent}%` : "—"}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>

            <Show when={d().tax_breakdown.length > 0}>
              <div>
                <h4 style="margin:0 0 8px 0;font-size:13px;text-transform:uppercase;color:var(--text-muted)">Defalcare TVA</h4>
                <table style="width:auto;border-collapse:collapse;font-size:12px">
                  <thead>
                    <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                      <th style="padding:6px 14px;text-align:center">Cotă</th>
                      <th style="padding:6px 14px;text-align:center">Cat.</th>
                      <th style="padding:6px 14px;text-align:right">Bază</th>
                      <th style="padding:6px 14px;text-align:right">TVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().tax_breakdown}>
                      {(t) => (
                        <tr style="border-bottom:1px solid var(--border)">
                          <td style="padding:6px 14px;text-align:center">{t.percent ? `${t.percent}%` : "—"}</td>
                          <td style="padding:6px 14px;text-align:center">{t.category ?? "—"}</td>
                          <td style="padding:6px 14px;text-align:right">{fmtMoney(t.taxable_amount)}</td>
                          <td style="padding:6px 14px;text-align:right">{fmtMoney(t.tax_amount)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px">
              <Show when={d().total_without_vat}>
                <div style="display:flex;gap:14px"><span style="color:var(--text-muted)">Total fără TVA:</span> <strong>{fmtMoney(d().total_without_vat, d().currency)}</strong></div>
              </Show>
              <Show when={d().total_vat}>
                <div style="display:flex;gap:14px"><span style="color:var(--text-muted)">TVA:</span> <strong>{fmtMoney(d().total_vat, d().currency)}</strong></div>
              </Show>
              <Show when={d().total_with_vat}>
                <div style="display:flex;gap:14px"><span style="color:var(--text-muted)">Total cu TVA:</span> <strong>{fmtMoney(d().total_with_vat, d().currency)}</strong></div>
              </Show>
              <Show when={d().payable_amount}>
                <div style="display:flex;gap:14px;font-size:15px;margin-top:4px"><span style="color:var(--text-muted)">DE PLATĂ:</span> <strong style="color:var(--accent)">{fmtMoney(d().payable_amount, d().currency)}</strong></div>
              </Show>
            </div>
          </div>
        )}
      </Show>

      <Show when={showHelp()}>
        <div
          style="margin-top:14px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);padding:12px 14px;font-size:12.5px;line-height:1.55"
          role="region"
          aria-label="Descriere butoane"
        >
          <div style="font-weight:600;font-size:12px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;margin-bottom:8px">
            Ce face fiecare buton
          </div>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
            <li>
              <strong>ℹ️ Info</strong> — afișează / ascunde acest panou cu descrierea butoanelor.
            </li>
            <li>
              <strong>💰 Marchează plata</strong> — marchează factura ca plătită (apare ca "✓ Plătită" în tabel și pe acest dialog). Click din nou anulează marcarea. Data marcării se reține automat.
            </li>
            <li>
              <strong>⏰ Reminder scadență</strong> <em style="color:var(--text-muted)">(în curând)</em> — va trimite o alertă pe email cu N zile înainte de scadență ca să previi întârzierile.
            </li>
            <li>
              <strong>📊 Export contabilitate</strong> <em style="color:var(--text-muted)">(în curând)</em> — va exporta factura în format CSV / SAGA / ContaB pentru import direct în programul de contabilitate.
            </li>
            <li>
              <strong>📄 Descarcă XML</strong> — descarcă fișierul XML UBL original primit de la ANAF, util pentru arhivare sau import în alt sistem.
            </li>
            <li>
              <strong>🖨️ Printează PDF</strong> — generează un PDF lizibil al facturii (emitent, beneficiar, linii produs, TVA, total) pe care îl poți tipări sau salva local.
            </li>
            <li>
              <strong>Închide</strong> — închide fereastra de detalii fără să modifice nimic. Factura rămâne marcată ca citită dacă a fost deschisă cu succes.
            </li>
          </ul>
        </div>
      </Show>
    </Modal>
  );
}

function SentDetails(props: PropsSent) {
  const row = () => props.row!;
  async function downloadZip() {
    const rid = row().receipt_id;
    if (!rid) return;
    try {
      const r = await apiFetch(`/api/efactura/receipts/${rid}/download`);
      if (!r.ok) { notify("Nu am putut descărca ZIP-ul.", "error"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anaf_response_${rid}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Eroare la descărcare ZIP.", "error");
    }
  }
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Factură trimisă • ${row().invoice_type} ${row().cui}`}
      size="lg"
      footer={
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;width:100%">
          <Show when={row().receipt_id}>
            <button class="btn btn-ghost" onClick={downloadZip}>📥 Descarcă ZIP răspuns ANAF</button>
          </Show>
          <button class="btn btn-ghost" onClick={props.onClose}>Închide</button>
        </div>
      }
    >
      <div style="display:flex;flex-direction:column;gap:12px;font-size:13px">
        <div class="invoice-sent-grid">
          <Field label="Status intern">{row().status}</Field>
          <Field label="Stare ANAF">{row().anaf_stare ?? "—"}</Field>
          <Field label="Index încărcare">{row().index_incarcare ?? "—"}</Field>
          <Field label="Download ID">{row().download_id ?? "—"}</Field>
          <Field label="Receipt #">{row().receipt_id ?? "—"}</Field>
          <Field label="CUI emitent">{row().cui}</Field>
          <Field label="Tip">{row().invoice_type}</Field>
          <Field label="Data emiterii">{row().invoice_issue_date}</Field>
          <Field label="Deadline transmit">{row().deadline_transmit}</Field>
          <Field label="Încercări upload">{row().upload_attempts}</Field>
          <Field label="Creat">{fmtDateANAF(row().created_at)}</Field>
        </div>
        <Show when={row().anaf_error_message}>
          <div style="background:rgba(239,68,68,0.08);border:1px solid var(--danger);border-radius:6px;padding:10px;color:var(--danger);font-size:12px">
            <strong>Eroare ANAF:</strong> {row().anaf_error_message}
          </div>
        </Show>
      </div>
    </Modal>
  );
}

function Field(props: { label: string; children: any }) {
  return (
    <div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em">{props.label}</span>
      <span style="font-size:13px">{props.children}</span>
    </div>
  );
}

function PartyCard(props: { label: string; p: InvoiceDetailsReceived["supplier"] }) {
  return (
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;background:var(--surface)">
      <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;margin-bottom:4px">{props.label}</div>
      <div style="font-weight:600;font-size:14px;margin-bottom:4px">{props.p.name ?? "—"}</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.5">
        <Show when={props.p.cui}><div>CUI: {props.p.cui}</div></Show>
        <Show when={props.p.address_line}><div>{props.p.address_line}</div></Show>
        <Show when={props.p.city}>
          <div>
            {props.p.city}
            <Show when={props.p.country_subentity}>, {props.p.country_subentity}</Show>
            <Show when={props.p.country_code}>, {props.p.country_code}</Show>
          </div>
        </Show>
        <Show when={props.p.contact_email}><div>📧 {props.p.contact_email}</div></Show>
        <Show when={props.p.contact_phone}><div>📞 {props.p.contact_phone}</div></Show>
      </div>
    </div>
  );
}

function Suggestions(props: { details: InvoiceDetailsReceived }) {
  const tips = () => {
    const d = props.details;
    const out: string[] = [];
    if (d.due_date) {
      const due = new Date(d.due_date);
      const now = new Date();
      const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) out.push(`⚠️ Scadența a trecut cu ${-diff} zile — verifică dacă plata a fost efectuată.`);
      else if (diff <= 5) out.push(`⏰ Scadență în ${diff} zile — pregătește plata din timp.`);
      else out.push(`✓ Mai sunt ${diff} zile până la scadență.`);
    }
    if (d.payment_iban) out.push(`💳 Plătește prin transfer la IBAN ${d.payment_iban}.`);
    if (d.doc_type === "CreditNote") out.push("ℹ️ Notă de credit — sumă scăzută din factura corectată.");
    if ((d.lines?.length ?? 0) === 0) out.push("ℹ️ Factura nu conține linii detaliate — verifică XML-ul original.");
    return out;
  };
  return (
    <Show when={tips().length > 0}>
      <div style="background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(59,130,246,.03));border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:6px;padding:10px 12px;font-size:12px">
        <div style="font-weight:600;color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Sugestii acțiuni</div>
        <For each={tips()}>{(t) => <div style="margin-top:2px">{t}</div>}</For>
      </div>
    </Show>
  );
}
