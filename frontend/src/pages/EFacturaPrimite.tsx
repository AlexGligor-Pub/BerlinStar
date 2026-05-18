import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../utils/api";
import { notify } from "../store/notificationsStore";

interface CompanySummary {
  company_id: number;
  account_id: number;
  name: string;
  cui: number;
  is_vat_payer: boolean | null;
  settings: unknown;
  token_status: {
    company_id: number;
    connected: boolean;
    expires_at: string | null;
    days_until_expiry: number | null;
    state: "disconnected" | "connected" | "expiring_soon" | "expired";
  };
}

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

export default function EFacturaPrimite() {
  const [companies, setCompanies] = createSignal<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = createSignal<number | null>(null);
  const [rows, setRows] = createSignal<ReceivedRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);

  async function loadCompanies() {
    setLoadingCompanies(true);
    try {
      const res = await apiFetch("/api/efactura/my-companies");
      if (res.ok) {
        const data: CompanySummary[] = await res.json();
        setCompanies(data);
        if (data.length === 1) setSelectedCompanyId(data[0].company_id);
      } else {
        notify("Nu am putut încărca companiile.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoadingCompanies(false);
    }
  }

  async function loadRows() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/efactura/companies/${cid}/received?limit=200`);
      if (res.ok) setRows(await res.json());
      else notify("Nu am putut încărca facturile primite.", "error");
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    const cid = selectedCompanyId();
    if (!cid) return;
    setSyncing(true);
    try {
      const res = await apiFetch(`/api/efactura/companies/${cid}/received/sync`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        notify(`Sincronizare OK — ${d.messages ?? 0} mesaje (${d.inserted ?? 0} noi).`, "success");
        await loadRows();
      } else {
        notify(d.detail ?? "Sync eșuat.", "error");
      }
    } catch {
      notify("Eroare de rețea la sync.", "error");
    } finally {
      setSyncing(false);
    }
  }

  onMount(loadCompanies);

  const selectedCompany = () => companies().find((c) => c.company_id === selectedCompanyId());

  return (
    <div class="page-content" style="padding:20px;max-width:1200px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <h1 style="margin:0;font-size:1.5rem">📨 Facturi primite eFactura</h1>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.55">
        <p style="margin:0;color:var(--text-muted)">
          Aici vezi e-Facturile primite de la furnizori prin SPV ANAF. Sincronizarea automată rulează la 60 min;
          poți declanșa manual oricând cu butonul <strong>Sincronizează acum</strong>.
        </p>
      </div>

      <Show when={loadingCompanies()}>
        <div class="text-muted">Se încarcă companiile...</div>
      </Show>

      <Show when={!loadingCompanies() && companies().length === 0}>
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
          Nu ai nicio companie configurată. Mergi în <strong>Configurări → Companiile mele</strong>.
        </div>
      </Show>

      <Show when={!loadingCompanies() && companies().length > 0}>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <label class="form-label" style="margin:0">Companie:</label>
          <select
            class="input"
            style="max-width:300px"
            value={selectedCompanyId() ?? ""}
            onChange={(e) => {
              const v = Number(e.currentTarget.value) || null;
              setSelectedCompanyId(v);
              setRows([]);
              if (v) void loadRows();
            }}
          >
            <option value="">— alege —</option>
            <For each={companies()}>
              {(c) => <option value={c.company_id}>{c.name} (CUI {c.cui})</option>}
            </For>
          </select>

          <Show when={selectedCompany()}>
            {(c) => (
              <span
                style={`padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;border:1px solid ${
                  c().token_status.connected ? "var(--success)" : "var(--danger)"
                };color:${c().token_status.connected ? "var(--success)" : "var(--danger)"}`}
              >
                {c().token_status.connected ? "🟢 Conectat la ANAF" : "🔴 Neconectat — sincronizarea va eșua"}
              </span>
            )}
          </Show>

          <button class="btn btn-primary btn-sm" onClick={loadRows} disabled={loading() || !selectedCompanyId()}>
            {loading() ? "Se încarcă..." : "🔄 Reîncarcă"}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            onClick={syncNow}
            disabled={syncing() || !selectedCompanyId()}
            title="Interoghează ANAF SPV pentru e-facturi noi primite"
          >
            {syncing() ? "Se sincronizează..." : "🌐 Sincronizează acum de la ANAF"}
          </button>
        </div>

        <Show when={selectedCompanyId() && rows().length === 0 && !loading()}>
          <div class="text-muted" style="padding:30px;text-align:center">
            Nicio factură primită încă. Apasă <strong>Sincronizează acum</strong> pentru a interoga ANAF.
          </div>
        </Show>

        <Show when={rows().length > 0}>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
            {rows().length} facturi primite (cache local)
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <For each={rows()}>
              {(r) => (
                <div style="border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:12px 14px">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <div style="flex:1;min-width:200px">
                      <div style="font-weight:600">{r.nume_emitent ?? r.cif_emitent ?? "—"}</div>
                      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                        CIF {r.cif_emitent ?? "—"} • {r.data_creare ?? "—"} • id_solicitare {r.id_solicitare}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                      <span style="padding:2px 8px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);font-size:11px">
                        {r.tip ?? "—"}
                      </span>
                      <Show when={r.downloaded}>
                        <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,0.15);color:var(--success);font-weight:600">
                          ✓ Descărcată
                        </span>
                      </Show>
                    </div>
                  </div>
                  <Show when={r.detalii}>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:6px">{r.detalii}</div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
