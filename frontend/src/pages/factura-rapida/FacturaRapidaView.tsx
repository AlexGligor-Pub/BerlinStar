import { Show, For, createSignal } from "solid-js";
import Modal from "../../components/ui/Modal";
import { apiFetch } from "../../utils/api";
import { generateFactura } from "../../utils/generateDocuments";
import type { DocContext } from "../../utils/generateDocuments";
import { notify } from "../../store/notificationsStore";
import { applyDocNumber, type Receipt } from "../../store/receiptsStore";
import { EFacturaStatusBadge } from "./components";

interface Props {
  open: boolean;
  receipt: Receipt | null;
  onClose: () => void;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function FacturaRapidaView(props: Props) {
  const [downloading, setDownloading] = createSignal(false);

  async function handleDownload() {
    const r = props.receipt;
    if (!r || !r.locationId) {
      notify("Lipseste locatia pe factura.", "warn");
      return;
    }
    setDownloading(true);
    try {
      const res = await apiFetch(`/api/receipts/${r.id}/assign-number`, {
        method: "POST",
        body: JSON.stringify({ doc_type: "factura", location_id: r.locationId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notify(j.detail ?? "Eroare la regenerarea PDF-ului.", "error");
        return;
      }
      const ctx: DocContext = await res.json();
      applyDocNumber(r.id, "factura", ctx.serie, ctx.nr);
      const forPdf: Receipt = { ...r, facturaSerie: ctx.serie, facturaNr: ctx.nr };
      await generateFactura(forPdf, ctx);
    } catch (e: any) {
      notify(e?.message ?? "Eroare la descarcarea PDF.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.receipt ? `Factura ${props.receipt.facturaSerie}${props.receipt.facturaNr || "—"}` : "Factura"}
      size="md"
      footer={
        <>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading() || !props.receipt}
          >
            {downloading()
              ? "..."
              : props.receipt?.facturaNr === 0
                ? "Finalizeaza si descarca"
                : "Descarca PDF"}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose}>
            Inchide
          </button>
        </>
      }
    >
      <Show when={props.receipt}>
        {(r) => (
          <div style="display:flex;flex-direction:column;gap:14px;font-size:14px">
            <Show when={r().facturaNr === 0}>
              <div style="padding:8px 12px;background:rgba(245,158,11,.1);border:1px solid #d97706;border-radius:6px;color:#92400e;font-size:13px">
                Aceasta factura nu are inca numar alocat. Apasa <strong>Finalizeaza si descarca</strong> pentru a aloca numarul si genera PDF-ul.
              </div>
            </Show>

            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="color:var(--text-muted);font-size:12px">Status e-factura</div>
              <EFacturaStatusBadge status={r().efacturaStatus} />
            </div>

            <div>
              <div style="font-weight:600;margin-bottom:4px">Catre</div>
              <div>{r().clientNume ?? "—"}</div>
              <Show when={r().clientCui}>
                <div style="color:var(--text-muted);font-size:13px">CUI {r().clientCui}</div>
              </Show>
              <Show when={r().clientAdresa}>
                <div style="color:var(--text-muted);font-size:13px">{r().clientAdresa}</div>
              </Show>
            </div>

            <div>
              <div style="font-weight:600;margin-bottom:4px">Articole</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                  <tr style="text-align:left;border-bottom:1px solid var(--border)">
                    <th style="padding:6px 4px">Descriere</th>
                    <th style="padding:6px 4px;text-align:right">Cant</th>
                    <th style="padding:6px 4px;text-align:right">Pret</th>
                    <th style="padding:6px 4px;text-align:right">TVA</th>
                    <th style="padding:6px 4px;text-align:right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={r().items}>
                    {(it) => {
                      const sub = it.price * it.qty;
                      const vat = it.vatPercent ?? 19;
                      return (
                        <tr style="border-bottom:1px solid var(--border)">
                          <td style="padding:6px 4px">{it.name}</td>
                          <td style="padding:6px 4px;text-align:right">{it.qty} {it.unit}</td>
                          <td style="padding:6px 4px;text-align:right">{it.price.toFixed(2)}</td>
                          <td style="padding:6px 4px;text-align:right">{vat}%</td>
                          <td style="padding:6px 4px;text-align:right">{(sub * (1 + vat / 100)).toFixed(2)}</td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;font-weight:600;border-top:1px solid var(--border);padding-top:8px">
              <span>Total</span>
              <span>{r().total.toFixed(2)} RON</span>
            </div>

            <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:13px">
              <span>Data emiterii: {fmtDate(r().date)}</span>
              <span>Scadenta: {fmtDate(r().dueDate)}</span>
            </div>

            <Show when={r().efacturaError}>
              <div style="padding:8px 12px;background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:6px;color:var(--danger);font-size:13px">
                {r().efacturaError}
              </div>
            </Show>
          </div>
        )}
      </Show>
    </Modal>
  );
}
