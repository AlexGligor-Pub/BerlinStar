import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { cart, cartTotal, clearCart } from "../store/cartStore";
import { auth } from "../store/authStore";
import logo from "../assets/logo.png";

export default function Reception() {
  const navigate = useNavigate();
  const now = new Date();
  const dateStr = now.toLocaleDateString("ro-RO");
  const timeStr = now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  function generatePDF() {
    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF({ unit: "mm", format: [80, 200] });

        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text("ProfessorPrime", 40, 12, { align: "center" });

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Bon fiscal", 40, 18, { align: "center" });
        doc.text(`${dateStr}  ${timeStr}`, 40, 23, { align: "center" });
        doc.text(`Casier: ${auth.user ?? "—"}`, 40, 28, { align: "center" });

        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(4, 31, 76, 31);

        const rows = cart.items.map((item) => [
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
        doc.text(`${cartTotal().toFixed(2)} lei`, 76, finalY + 7, { align: "right" });

        doc.save(`bon-${now.toISOString().slice(0, 10)}-${Date.now()}.pdf`);
      });
    });
  }

  function handleFinalize() {
    generatePDF();
    clearCart();
    navigate("/");
  }

  return (
    <div class="receipt-page">
      <Show
        when={cart.items.length > 0}
        fallback={
          <div class="receipt-empty">
            <div class="receipt-empty-icon">📋</div>
            <div class="text-muted">Lista este goala.</div>
            <button class="btn btn-primary mt-16" onClick={() => navigate("/")}>
              Adauga produse
            </button>
          </div>
        }
      >
        <div class="receipt">
          {/* Header */}
          <div class="receipt-header">
            <img src={logo} alt="Logo" class="receipt-logo" />
            <div class="receipt-meta">
              <span>{dateStr}</span>
              <span>{timeStr}</span>
              <span>Casier: {auth.user ?? "—"}</span>
            </div>
          </div>

          <div class="receipt-divider" />

          {/* Produse */}
          <div class="receipt-items">
            <For each={cart.items}>
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

          {/* Total */}
          <div class="receipt-total">
            <span>TOTAL</span>
            <span>{cartTotal().toFixed(2)} lei</span>
          </div>

          <div class="receipt-divider receipt-divider--dashed" />

          {/* Actiuni */}
          <div class="receipt-actions">
            <button class="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
              Anuleaza
            </button>
            <button class="btn btn-primary" onClick={handleFinalize}>
              Descarca & Finalizeaza
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
