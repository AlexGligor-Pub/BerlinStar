import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";
import { uploadToSpv, deleteReceipt, mapReceiptFromApi, type Receipt, type RawReceipt } from "../store/receiptsStore";
import Modal from "../components/ui/Modal";
import FacturaRapidaForm from "./factura-rapida/FacturaRapidaForm";
import FacturaRapidaView from "./factura-rapida/FacturaRapidaView";
import { EFacturaStatusBadge, RowKebab } from "./factura-rapida/components";
import type { CompanyMeta } from "./factura-rapida/types";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function FacturaRapida() {
  const [companies, setCompanies] = createSignal<CompanyMeta[]>([]);
  const [items, setItems] = createSignal<Receipt[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [editing, setEditing] = createSignal<Receipt | null>(null);
  const [viewing, setViewing] = createSignal<Receipt | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<Receipt | null>(null);
  const [isMobile, setIsMobile] = createSignal(typeof window !== "undefined" && window.innerWidth < 768);

  function onResize() { setIsMobile(window.innerWidth < 768); }
  onMount(() => {
    window.addEventListener("resize", onResize);
    onCleanup(() => window.removeEventListener("resize", onResize));
  });

  async function loadCompanies() {
    try {
      const res = await apiFetch("/api/factura-rapida/companies-meta");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data as CompanyMeta[]);
      }
    } catch {
      notify("Nu am putut incarca firmele.", "error");
    }
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/receipts?limit=50&source=rapida&sort=-id");
      if (res.ok) {
        const data = await res.json();
        setItems((data.items as RawReceipt[]).map(mapReceiptFromApi));
      }
    } catch {
      notify("Nu am putut incarca istoricul.", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void loadCompanies();
    void loadHistory();
  });

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(r: Receipt) {
    setEditing(r);
    setShowForm(true);
  }

  async function handleSendSpv(r: Receipt) {
    try {
      await uploadToSpv(r.id);
      notify("Factura a fost trimisa catre SPV.", "success");
      void loadHistory();
    } catch (e: any) {
      notify(e?.message ?? "Eroare la trimiterea in SPV.", "error");
    }
  }

  async function handleDeleteConfirm() {
    const r = confirmDelete();
    if (!r) return;
    try {
      await deleteReceipt(r.id);
      setItems(items().filter((x) => x.id !== r.id));
      notify("Factura a fost stearsa.", "info");
    } catch (e: any) {
      notify(e?.message ?? "Eroare la stergere.", "error");
    } finally {
      setConfirmDelete(null);
    }
  }

  function canSend(r: Receipt): boolean {
    // `accepted`/`in_prelucrare`/`pending_upload` semnaleaza ca SPV-ul are deja bonul;
    // un retry doar duplica. `rejected`/`error` raman trimisibile (intentionat — userul
    // poate corecta si retrimite). facturaNr=0 = orphan, trebuie finalizat din View.
    if (r.efacturaStatus === "in_prelucrare") return false;
    if (r.efacturaStatus === "accepted") return false;
    if (r.efacturaStatus === "pending_upload") return false;
    if (!r.clientId) return false;
    if (r.facturaNr === 0) return false;
    return true;
  }

  return (
    <div class="page-content" style="padding:24px;max-width:1200px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h1 style="margin:0;font-size:1.4rem">Facturi Rapide</h1>
        <button class="btn btn-primary btn-sm" onClick={openNew}>
          + Factura noua
        </button>
      </div>

      <Show when={companies().length === 0 && !loading()}>
        <div style="padding:24px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text-muted);text-align:center">
          Nu ai firme cu locatii si registre configurate. Mergi la Configurari pentru a adauga.
        </div>
      </Show>

      <Show when={loading() && items().length === 0}>
        <div class="skeleton" style="height:120px" />
      </Show>

      <Show when={!loading() && items().length === 0 && companies().length > 0}>
        <div style="padding:24px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text-muted);text-align:center">
          Nu exista facturi rapide. Creeaza prima factura cu butonul de mai sus.
        </div>
      </Show>

      <Show when={items().length > 0}>
        <Show when={!isMobile()} fallback={
          <div style="display:flex;flex-direction:column;gap:10px">
            <For each={items()}>
              {(r) => (
                <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface1)">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div>
                      <div style="font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span>{r.facturaSerie}{r.facturaNr || "—"}</span>
                        <Show when={r.facturaNr === 0}>
                          <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,.15);color:#d97706;border:1px solid #d97706">Incomplet</span>
                        </Show>
                      </div>
                      <div style="font-size:12px;color:var(--text-muted)">{fmtDate(r.date)}</div>
                    </div>
                    <RowKebab
                      canEdit={!r.efacturaLocked}
                      canSend={canSend(r)}
                      canDelete={!r.efacturaLocked}
                      onView={() => setViewing(r)}
                      onEdit={() => openEdit(r)}
                      onSend={() => handleSendSpv(r)}
                      onDelete={() => setConfirmDelete(r)}
                    />
                  </div>
                  <div style="margin-top:8px;font-size:13px">
                    <div>{r.clientNume ?? "—"}</div>
                    <Show when={r.clientCui}>
                      <div style="color:var(--text-muted);font-size:12px">CUI {r.clientCui}</div>
                    </Show>
                  </div>
                  <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                    <EFacturaStatusBadge status={r.efacturaStatus} />
                    <strong>{r.total.toFixed(2)} RON</strong>
                  </div>
                  <div style="margin-top:4px;color:var(--text-muted);font-size:12px">
                    Scadenta: {fmtDate(r.dueDate)}
                  </div>
                </div>
              )}
            </For>
          </div>
        }>
          <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface1)">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:var(--surface2);text-align:left">
                  <th style="padding:10px 12px;font-size:13px">Numar</th>
                  <th style="padding:10px 12px;font-size:13px">Data</th>
                  <th style="padding:10px 12px;font-size:13px">Client</th>
                  <th style="padding:10px 12px;font-size:13px;text-align:right">Total</th>
                  <th style="padding:10px 12px;font-size:13px">Scadenta</th>
                  <th style="padding:10px 12px;font-size:13px">Status</th>
                  <th style="padding:10px 12px;font-size:13px;width:40px"></th>
                </tr>
              </thead>
              <tbody>
                <For each={items()}>
                  {(r) => (
                    <tr style="border-top:1px solid var(--border)">
                      <td style="padding:10px 12px;font-weight:600">
                        {r.facturaSerie}{r.facturaNr || "—"}
                      </td>
                      <td style="padding:10px 12px;font-size:13px">{fmtDate(r.date)}</td>
                      <td style="padding:10px 12px;font-size:13px">
                        <div>{r.clientNume ?? "—"}</div>
                        <Show when={r.clientCui}>
                          <div style="color:var(--text-muted);font-size:12px">CUI {r.clientCui}</div>
                        </Show>
                      </td>
                      <td style="padding:10px 12px;text-align:right;font-weight:600">{r.total.toFixed(2)}</td>
                      <td style="padding:10px 12px;font-size:13px">{fmtDate(r.dueDate)}</td>
                      <td style="padding:10px 12px"><EFacturaStatusBadge status={r.efacturaStatus} /></td>
                      <td style="padding:10px 12px;text-align:right">
                        <RowKebab
                          canEdit={!r.efacturaLocked}
                          canSend={canSend(r)}
                          canDelete={!r.efacturaLocked}
                          onView={() => setViewing(r)}
                          onEdit={() => openEdit(r)}
                          onSend={() => handleSendSpv(r)}
                          onDelete={() => setConfirmDelete(r)}
                        />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>

      <FacturaRapidaForm
        open={showForm()}
        companies={companies()}
        editing={editing()}
        onClose={() => setShowForm(false)}
        onSaved={loadHistory}
      />

      <FacturaRapidaView
        open={viewing() !== null}
        receipt={viewing()}
        onClose={() => setViewing(null)}
      />

      <Modal
        open={confirmDelete() !== null}
        onClose={() => setConfirmDelete(null)}
        title="Confirmare stergere"
        size="sm"
        footer={
          <>
            <button class="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Anuleaza</button>
            <button class="btn btn-danger btn-sm" onClick={handleDeleteConfirm}>Sterge</button>
          </>
        }
      >
        <Show when={confirmDelete()}>
          {(r) => (
            <p>Stergi factura <strong>{r().facturaSerie}{r().facturaNr || "—"}</strong> pentru <strong>{r().clientNume ?? "—"}</strong>?</p>
          )}
        </Show>
      </Modal>
    </div>
  );
}
