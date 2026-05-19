import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch, readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import SubscriptionCheckoutModal from "../../components/subscription/SubscriptionCheckoutModal";

interface SubscriptionStatus {
  configured: boolean;
  next_payment_date: string | null;
  last_payment_date: string | null;
  days_left: number | null;
  banner_kind: string;
  show_banner: boolean;
  message: string;
  price_eur: number;
  vat_percent: number;
}

interface PaymentItem {
  id: number;
  status: string;
  paid_at: string | null;
  amount_ron: number;
  amount_eur: number;
  invoice_number: string | null;
  invoice_issue_date: string | null;
  anaf_status: string | null;
  pdf_available: boolean;
  zip_available: boolean;
}

function statusLabel(status: string): string {
  switch (status) {
    case "succeeded": return "Plătit";
    case "processing": return "În procesare";
    case "requires_payment": return "Initială, neplătit";
    case "failed": return "Eşec";
    case "canceled": return "Anulat";
    default: return status;
  }
}

function anafLabel(s: string | null | undefined): string {
  if (!s) return "—";
  if (s === "in_prelucrare") return "În prelucrare ANAF";
  if (s === "accepted") return "Acceptată ANAF";
  if (s === "rejected") return "Respinsă ANAF";
  if (s === "upload_disabled") return "Upload SPV dezactivat";
  if (s === "blocked_config") return "Config emitent incomplet";
  return s;
}

function bannerColor(kind: string): string {
  switch (kind) {
    case "ok": return "#d1fae5";
    case "warn": return "#fef3c7";
    case "danger": return "#fed7aa";
    case "expired": return "#fee2e2";
    default: return "#f3f4f6";
  }
}

function bannerTextColor(kind: string): string {
  switch (kind) {
    case "ok": return "#065f46";
    case "warn": return "#92400e";
    case "danger": return "#9a3412";
    case "expired": return "#991b1b";
    default: return "#111827";
  }
}

export default function AbonamentPanel() {
  const [status, setStatus] = createSignal<SubscriptionStatus | null>(null);
  const [payments, setPayments] = createSignal<PaymentItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showCheckout, setShowCheckout] = createSignal(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        apiFetch("/api/subscription/me"),
        apiFetch("/api/subscription/payments"),
      ]);
      if (s.ok) setStatus(await s.json() as SubscriptionStatus);
      if (p.ok) setPayments(await p.json() as PaymentItem[]);
    } catch {
      notify("Eroare la incărcarea abonamentului.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => { void loadAll(); });

  function downloadFile(url: string) {
    const link = document.createElement("a");
    // PDF/ZIP endpoint-urile cer Authorization header — fetch in JS si saveAs
    void apiFetch(url).then(async (res) => {
      if (!res.ok) {
        const d = await readJsonSafe<{ detail?: string }>(res);
        notify(d.detail || "Eroare la descărcare.", "error");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      link.href = blobUrl;
      // dezirabil sa pastreze numele de la backend (Content-Disposition)
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      if (m) link.download = m[1];
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    });
  }

  const banner = createMemo(() => {
    const s = status();
    if (!s) return null;
    if (!s.show_banner) return null;
    return s;
  });

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Abonament BerlinStar</h2>
      <p class="cfg-hint" style="margin:0 0 18px">
        Plata anuală pentru accesul la platforma BerlinStar. Încasare prin
        Stripe în lei (curs BNR la momentul plăţii). Factura
        electronică emisă de BerlinStar SRL se transmite automat la ANAF SPV.
      </p>

      {/* ── Status ── */}
      <div class="account-card" style="padding:18px;margin-bottom:18px">
        <Show
          when={status()}
          fallback={
            <div style="font-size:0.82rem;color:var(--text-muted)">
              {loading() ? "Se încarcă…" : "Indisponibil"}
            </div>
          }
        >
          {(s) => (
            <div>
              <Show when={banner()}>
                {(b) => (
                  <div
                    style={`background:${bannerColor(b().banner_kind)};color:${bannerTextColor(b().banner_kind)};padding:10px 14px;border-radius:6px;margin-bottom:14px;font-weight:500`}
                  >
                    {b().message}
                  </div>
                )}
              </Show>
              <div style="display:grid;gap:10px;grid-template-columns:max-content 1fr;align-items:center;font-size:0.95rem">
                <div style="color:var(--text-muted)">Scadenţa următoare</div>
                <div style="font-weight:600">
                  {s().next_payment_date || "—"}
                  <Show when={s().days_left !== null}>
                    <span style="margin-left:8px;color:var(--text-muted);font-weight:400">
                      ({s().days_left! > 0 ? `în ${s().days_left} zile` : s().days_left === 0 ? "astăzi" : `expirat de ${-s().days_left!} zile`})
                    </span>
                  </Show>
                </div>
                <div style="color:var(--text-muted)">Ultima plată</div>
                <div>{s().last_payment_date || "—"}</div>
                <div style="color:var(--text-muted)">Preţ anual</div>
                <div>
                  {s().price_eur.toFixed(2)} EUR (cu TVA {s().vat_percent.toFixed(0)}%)
                </div>
              </div>
              <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
                <button
                  class="btn btn-primary btn-sm"
                  onClick={() => setShowCheckout(true)}
                >
                  Plăteşte abonamentul
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  onClick={() => void loadAll()}
                  disabled={loading()}
                >
                  Reactualizează
                </button>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* ── Istoric plăţi ── */}
      <div class="account-card" style="padding:18px">
        <h3 style="margin:0 0 12px;font-size:1.05rem">Istoric plăţi</h3>
        <Show
          when={payments().length > 0}
          fallback={
            <div style="font-size:0.82rem;color:var(--text-muted)">
              Nu există plăţi înregistrate.
            </div>
          }
        >
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
              <thead>
                <tr style="background:var(--surface-2,#f1f5f9);text-align:left">
                  <th style="padding:8px 10px">Factura</th>
                  <th style="padding:8px 10px">Data</th>
                  <th style="padding:8px 10px">Sumă</th>
                  <th style="padding:8px 10px">Status</th>
                  <th style="padding:8px 10px">SPV</th>
                  <th style="padding:8px 10px">Acţiuni</th>
                </tr>
              </thead>
              <tbody>
                <For each={payments()}>
                  {(p) => (
                    <tr style="border-bottom:1px solid var(--border,#e5e7eb)">
                      <td style="padding:8px 10px;font-family:var(--font-mono,monospace)">
                        {p.invoice_number || "—"}
                      </td>
                      <td style="padding:8px 10px">{p.invoice_issue_date || p.paid_at || "—"}</td>
                      <td style="padding:8px 10px">
                        {p.amount_ron.toFixed(2)} RON
                        <div style="font-size:0.75rem;color:var(--text-muted)">
                          ({p.amount_eur.toFixed(2)} EUR)
                        </div>
                      </td>
                      <td style="padding:8px 10px">{statusLabel(p.status)}</td>
                      <td style="padding:8px 10px">{anafLabel(p.anaf_status)}</td>
                      <td style="padding:8px 10px;white-space:nowrap">
                        <Show when={p.pdf_available}>
                          <button
                            class="btn btn-ghost btn-sm"
                            onClick={() => downloadFile(`/api/subscription/invoices/${p.id}/pdf`)}
                          >
                            PDF
                          </button>
                        </Show>
                        <Show when={p.zip_available}>
                          <button
                            class="btn btn-ghost btn-sm"
                            style="margin-left:4px"
                            onClick={() => downloadFile(`/api/subscription/invoices/${p.id}/anaf-zip`)}
                          >
                            ZIP ANAF
                          </button>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      <Show when={showCheckout()}>
        <SubscriptionCheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setShowCheckout(false);
            notify("Plata a fost iniţiată. Statusul se va actualiza după confirmarea Stripe.", "info");
            setTimeout(() => void loadAll(), 4000);
          }}
        />
      </Show>
    </div>
  );
}
