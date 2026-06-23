import { Show, For, createSignal, createMemo, createEffect } from "solid-js";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import { apiFetch } from "../../utils/api";
import { saveReceipt, updateReceiptContent, applyDocNumber, type Receipt } from "../../store/receiptsStore";
import { generateFactura } from "../../utils/generateDocuments";
import type { DocContext } from "../../utils/generateDocuments";
import { notify } from "../../store/notificationsStore";
import {
  CompanyPicker,
  LocationPicker,
  ClientSearch,
  AnafLookup,
  FizicClientForm,
  ItemsEditor,
} from "./components";
import type { ClientLite, CompanyMeta, QuickInvoiceLine } from "./types";
import { newLine, sumGross, todayPlusDaysISO } from "./types";

const PAYMENT_TERM_DAYS = 7;

const PAY_METHOD_OPTIONS = [
  { value: "Neplatit", label: "Neplatit (pe scadenta)" },
  { value: "Platit cash", label: "Cash" },
  { value: "Platit cu cardul", label: "Card" },
  { value: "Platit prin OP", label: "OP / Transfer bancar" },
] as const;

function defaultVatForCompany(c: CompanyMeta | null | undefined): number {
  if (!c) return 19;
  if (c.is_vat_payer === false) return 0;
  return c.tva_percentage ?? 19;
}

interface Props {
  open: boolean;
  companies: CompanyMeta[];
  editing: Receipt | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function FacturaRapidaForm(props: Props) {
  const [companyId, setCompanyId] = createSignal<number | null>(null);
  const [locationId, setLocationId] = createSignal<number | null>(null);
  const [client, setClient] = createSignal<ClientLite | null>(null);
  const [tab, setTab] = createSignal<"search" | "anaf" | "fizic">("search");
  const [dueDate, setDueDate] = createSignal(todayPlusDaysISO(PAYMENT_TERM_DAYS));
  const [payMethod, setPayMethod] = createSignal<string>("Neplatit");
  const [lines, setLines] = createSignal<QuickInvoiceLine[]>([newLine()]);
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [submitting, setSubmitting] = createSignal(false);

  const selectedCompany = createMemo(() => props.companies.find((c) => c.company_id === companyId()) ?? null);

  createEffect(() => {
    if (!props.open) return;
    const editing = props.editing;
    if (editing) {
      // Find company by looking up locationId across companies
      const owning = props.companies.find((c) => c.locations.some((l) => l.id === editing.locationId));
      setCompanyId(owning?.company_id ?? null);
      setLocationId(editing.locationId ?? null);
      setDueDate(editing.dueDate ?? todayPlusDaysISO(PAYMENT_TERM_DAYS));
      setPayMethod(editing.metodaPlata ?? "Neplatit");
      const fallbackVat = defaultVatForCompany(owning);
      setLines(
        editing.items.length === 0
          ? [{ ...newLine(), vatPercent: fallbackVat }]
          : editing.items.map((it, idx) => ({
              lineId: `e_${idx}_${it.id}`,
              name: it.name,
              qty: it.qty,
              unit: it.unit,
              price: it.price,
              vatPercent: it.vatPercent ?? fallbackVat,
            }))
      );
      if (editing.clientId) {
        setClient({
          id: editing.clientId,
          tip: editing.clientTip ?? "fizic",
          nume: editing.clientNume ?? "",
          cui: editing.clientCui,
          adresa: editing.clientAdresa,
          telefon: editing.clientTelefon,
          reprezentant: editing.clientReprezentant,
          numar_masina: editing.clientNumarMasina,
        });
      } else {
        setClient(null);
      }
    } else {
      // Reset for new
      const firstCompany = props.companies[0] ?? null;
      setCompanyId(firstCompany?.company_id ?? null);
      setLocationId(firstCompany?.locations[0]?.id ?? null);
      setClient(null);
      setDueDate(todayPlusDaysISO(PAYMENT_TERM_DAYS));
      setPayMethod("Neplatit");
      setLines([{ ...newLine(), vatPercent: defaultVatForCompany(firstCompany) }]);
    }
    setErrors({});
    setTab("search");
  });

  // Auto-pick location when company changes and only one location is available
  createEffect(() => {
    const c = selectedCompany();
    if (!c) return;
    if (c.locations.length === 1 && locationId() !== c.locations[0].id) {
      setLocationId(c.locations[0].id);
    } else if (c.locations.length > 1 && !c.locations.some((l) => l.id === locationId())) {
      setLocationId(null);
    }
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!companyId()) errs.companyId = "Alege firma emitenta.";
    if (!locationId()) errs.locationId = "Alege locatia.";
    if (!client()) errs.client = "Alege un client.";
    if (lines().length === 0) errs.lines = "Adauga cel putin o linie.";
    lines().forEach((l, idx) => {
      if (!l.name.trim()) errs[`name_${idx}`] = "Obligatoriu";
      if (!(l.price > 0)) errs[`price_${idx}`] = "> 0";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const locId = locationId()!;
      const c = client()!;
      const total = sumGross(lines());
      const baseInput = {
        date: new Date().toISOString(),
        titlu: "Factura Rapida",
        clientId: c.id,
        clientNume: c.nume,
        clientCui: c.cui,
        clientAdresa: c.adresa,
        clientTelefon: c.telefon,
        clientTip: c.tip,
        clientReprezentant: c.reprezentant,
        clientNumarMasina: c.numar_masina,
        descriere: undefined,
        dateTehn: undefined,
        metodaPlata: payMethod(),
        partialPay: undefined,
        items: lines().map((l, idx) => ({
          id: -(idx + 1),
          lineId: l.lineId,
          name: l.name,
          price: l.price,
          unit: l.unit,
          qty: l.qty,
          employeeId: null,
          employeeName: null,
          employeeTargetPct: null,
          itemId: null,
          itemType: null,
          vatPercent: l.vatPercent,
        })),
        total,
        devizSerie: "",
        devizNr: 0,
        facturaSerie: "",
        facturaNr: 0,
        chitantaSerie: "",
        chitantaNr: 0,
        programareId: null,
        locationId: locId,
        vehicol: null,
        updatedAt: null,
        source: "rapida",
        dueDate: dueDate(),
      };

      let saved: Receipt;
      if (props.editing) {
        saved = await updateReceiptContent(props.editing.id, baseInput);
        // Client change separately (PATCH /client)
        if (props.editing.clientId !== c.id) {
          await apiFetch(`/api/receipts/${saved.id}/client`, {
            method: "PATCH",
            body: JSON.stringify({ client_id: c.id }),
          });
        }
        // pay_method nu trece prin /content — PATCH separat daca s-a schimbat
        if (props.editing.metodaPlata !== payMethod()) {
          const payRes = await apiFetch(`/api/receipts/${saved.id}`, {
            method: "PATCH",
            body: JSON.stringify({ pay_method: payMethod(), partial_pay: null }),
          });
          if (payRes.ok) {
            saved = { ...saved, metodaPlata: payMethod() };
          }
        }
      } else {
        saved = await saveReceipt(baseInput);
      }

      // Allocate factura number (idempotent) + fetch company/disclaimer ctx
      const ctxRes = await apiFetch(`/api/receipts/${saved.id}/assign-number`, {
        method: "POST",
        body: JSON.stringify({ doc_type: "factura", location_id: locId }),
      });
      if (!ctxRes.ok) {
        const j = await ctxRes.json().catch(() => ({}));
        throw new Error(j.detail ?? "Eroare la alocarea numarului de factura.");
      }
      const ctx: DocContext = await ctxRes.json();
      applyDocNumber(saved.id, "factura", ctx.serie, ctx.nr);

      // Update local receipt with new serie/nr for the PDF generator
      const forPdf: Receipt = { ...saved, facturaSerie: ctx.serie, facturaNr: ctx.nr };
      await generateFactura(forPdf, ctx);

      notify("Factura a fost generata.", "success");
      props.onSaved();
      props.onClose();
    } catch (e: any) {
      notify(e?.message ?? "Eroare la generarea facturii.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = () => props.editing !== null;

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={isEdit() ? "Editare Factura Rapida" : "Factura Rapida noua"}
      size="lg"
      footer={
        <>
          <button type="button" class="btn btn-ghost btn-sm" onClick={props.onClose} disabled={submitting()}>
            Anuleaza
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={submitting()}
          >
            {submitting() ? "..." : isEdit() ? "Salveaza modificarile" : "Genereaza Factura"}
          </button>
        </>
      }
    >
      <div style="display:flex;flex-direction:column;gap:16px;max-width:100%">
        <CompanyPicker
          companies={props.companies}
          value={companyId()}
          onChange={setCompanyId}
          error={errors().companyId}
        />
        <Show when={selectedCompany()}>
          {(c) => (
            <LocationPicker
              locations={c().locations}
              value={locationId()}
              onChange={setLocationId}
              error={errors().locationId}
            />
          )}
        </Show>

        <div>
          <div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid var(--border)">
            <button
              type="button"
              onClick={() => setTab("search")}
              style={`padding:8px 12px;background:transparent;border:none;border-bottom:2px solid ${tab() === "search" ? "var(--accent,#5b7cfa)" : "transparent"};color:${tab() === "search" ? "var(--text)" : "var(--text-muted)"};font-weight:600;cursor:pointer`}
            >
              Cauta client
            </button>
            <button
              type="button"
              onClick={() => setTab("anaf")}
              style={`padding:8px 12px;background:transparent;border:none;border-bottom:2px solid ${tab() === "anaf" ? "var(--accent,#5b7cfa)" : "transparent"};color:${tab() === "anaf" ? "var(--text)" : "var(--text-muted)"};font-weight:600;cursor:pointer`}
            >
              Lookup ANAF
            </button>
            <button
              type="button"
              onClick={() => setTab("fizic")}
              style={`padding:8px 12px;background:transparent;border:none;border-bottom:2px solid ${tab() === "fizic" ? "var(--accent,#5b7cfa)" : "transparent"};color:${tab() === "fizic" ? "var(--text)" : "var(--text-muted)"};font-weight:600;cursor:pointer`}
            >
              Pers. fizică nouă
            </button>
          </div>
          <Show when={tab() === "search"}>
            <ClientSearch selected={client()} onSelect={setClient} />
          </Show>
          <Show when={tab() === "anaf"}>
            <AnafLookup onClientCreated={(c) => { setClient(c); setTab("search"); }} />
          </Show>
          <Show when={tab() === "fizic"}>
            <FizicClientForm onClientCreated={(c) => { setClient(c); setTab("search"); }} />
          </Show>
          <Show when={errors().client}>
            <span class="field-error" role="alert">{errors().client}</span>
          </Show>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <Input
            label={`Data scadenta (default ${PAYMENT_TERM_DAYS} zile)`}
            type="date"
            value={dueDate()}
            onInput={(v) => setDueDate(v)}
          />
          <div class="field">
            <label class="field-label">Modalitate plata</label>
            <select
              class="input"
              value={payMethod()}
              onChange={(e) => setPayMethod(e.currentTarget.value)}
            >
              <For each={PAY_METHOD_OPTIONS}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
        </div>

        <ItemsEditor lines={lines()} onChange={setLines} errors={errors()} />
      </div>

      <style>{`
        @media (max-width: 640px) {
          .fr-item-row {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </Modal>
  );
}
