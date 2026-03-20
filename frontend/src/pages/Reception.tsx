import { For, Show, createSignal, onMount } from "solid-js";
import { receipts, deleteReceipt, loadReceipts, type Receipt } from "../store/receiptsStore";

function generatePDF(r: Receipt) {
  import("jspdf").then(({ jsPDF }) => {
    import("jspdf-autotable").then(() => {
      const doc = new jsPDF({ unit: "mm", format: [80, 200] });
      const date = new Date(r.date);
      const dateStr = date.toLocaleDateString("ro-RO");
      const timeStr = date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text("ProfessorPrime", 40, 12, { align: "center" });

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Bon fiscal", 40, 18, { align: "center" });
      doc.text(`${dateStr}  ${timeStr}`, 40, 23, { align: "center" });
      doc.text(`Casier: ${r.casier}`, 40, 28, { align: "center" });

      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(4, 31, 76, 31);

      const rows = r.items.map((item) => [
        item.name,
        `${item.qty} x ${item.price.toFixed(2)}`,
        (item.price * item.qty).toFixed(2),
      ]);

      (doc as any).autoTable({
        startY: 34,
        head: [["Produs", "Cant x Pret", "Total"]],
        body: rows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
        columnStyles: { 2: { halign: "right" } },
        margin: { left: 4, right: 4 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 4;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(4, finalY, 76, finalY);

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", 4, finalY + 7);
      doc.text(`${r.total.toFixed(2)} lei`, 76, finalY + 7, { align: "right" });

      doc.save(`bon-${date.toISOString().slice(0, 10)}-${r.id}.pdf`);
    });
  });
}

function ReceiptCard(props: { receipt: Receipt }) {
  const [expanded, setExpanded] = createSignal(false);
  const r = props.receipt;
  const date = new Date(r.date);
  const dateStr = date.toLocaleDateString("ro-RO");
  const timeStr = date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div class="rcard" classList={{ "rcard--open": expanded() }}>
      {/* Header card — click pentru expand */}
      <div class="rcard-header" onClick={() => setExpanded((v) => !v)}>
        <div class="rcard-info">
          <span class="rcard-date">{dateStr} {timeStr}</span>
          <span class="rcard-casier">{r.casier}</span>
        </div>
        <div class="rcard-right">
          <span class="rcard-total">{r.total.toFixed(2)} lei</span>
          <span class="rcard-count">{r.items.reduce((s, i) => s + i.qty, 0)} buc</span>
          <span class="rcard-chevron">{expanded() ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Receipt detaliat */}
      <Show when={expanded()}>
        <div class="rcard-body">
          <div class="receipt">
            <div class="receipt-header">
              <div class="receipt-meta">
                <span>{dateStr} {timeStr}</span>
                <span>Casier: {r.casier}</span>
              </div>
            </div>

            <div class="receipt-divider" />

            <div class="receipt-items">
              <For each={r.items}>
                {(item) => (
                  <div class="receipt-item">
                    <span class="receipt-item-name">{item.name}</span>
                    <span class="receipt-item-qty">{item.qty} x {item.price.toFixed(2)}</span>
                    <span class="receipt-item-total">{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="receipt-divider" />

            <div class="receipt-total">
              <span>TOTAL</span>
              <span>{r.total.toFixed(2)} lei</span>
            </div>

            <div class="receipt-divider receipt-divider--dashed" />

            <div class="receipt-actions">
              <button class="btn btn-danger btn-sm" onClick={() => deleteReceipt(r.id)}>
                Sterge
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => generatePDF(r)}>
                Descarca PDF
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default function Reception() {
  onMount(() => { loadReceipts(); });
  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Receptie</h1>
        <span class="text-muted" style="font-size:0.85rem">{receipts().length} bonuri</span>
      </div>

      <Show
        when={receipts().length > 0}
        fallback={
          <div class="card" style="text-align:center;padding:48px 16px">
            <div class="text-muted">Nu exista bonuri inregistrate.</div>
          </div>
        }
      >
        <div class="rcard-list">
          <For each={receipts()}>
            {(r) => <ReceiptCard receipt={r} />}
          </For>
        </div>
      </Show>
    </div>
  );
}
