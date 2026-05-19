import { For, Show, createMemo, createSignal, onMount, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { apiFetch } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import { EFacturaProvider, type EFacturaCompany } from "./CompanyContext";

export default function EFacturaLayout(props: { children?: JSX.Element }) {
  const [companies, setCompanies] = createSignal<EFacturaCompany[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [companyId, setCompanyId] = createSignal<number | null>(null);
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [syncing, setSyncing] = createSignal(false);

  const selectedCompany = createMemo(() =>
    companies().find((c) => c.company_id === companyId())
  );
  const location = useLocation();

  async function refreshCompanies() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/efactura/my-companies");
      if (res.ok) {
        const data: EFacturaCompany[] = await res.json();
        setCompanies(data);
        const stored = Number(localStorage.getItem("efactura_company_id") || "");
        const match = data.find((c) => c.company_id === stored);
        if (match) setCompanyId(match.company_id);
        else if (data.length === 1) setCompanyId(data[0].company_id);
      } else {
        notify("Nu am putut încărca companiile.", "error");
      }
    } catch {
      notify("Eroare de rețea.", "error");
    } finally {
      setLoading(false);
    }
  }

  function changeCompany(id: number | null) {
    setCompanyId(id);
    if (id !== null) localStorage.setItem("efactura_company_id", String(id));
    else localStorage.removeItem("efactura_company_id");
  }

  async function syncNow() {
    const cid = companyId();
    if (!cid) return;
    setSyncing(true);
    try {
      const res = await apiFetch(`/api/efactura/companies/${cid}/received/sync`, { method: "POST" });
      const d = await res.json().catch(() => ({} as any));
      if (res.ok) {
        notify(`Sincronizare OK — ${d.messages ?? 0} mesaje (${d.inserted ?? 0} noi).`, "success");
        window.dispatchEvent(new CustomEvent("efactura:refresh"));
      } else {
        notify(d.detail ?? "Sync eșuat.", "error");
      }
    } catch {
      notify("Eroare de rețea la sync.", "error");
    } finally {
      setSyncing(false);
    }
  }

  onMount(refreshCompanies);

  const ctx = {
    companies,
    loading,
    companyId,
    setCompanyId: changeCompany as any,
    selectedCompany,
    unreadCount,
    setUnreadCount,
    refreshCompanies,
  };

  return (
    <EFacturaProvider value={ctx}>
      <div class="page-content" style="padding:16px;max-width:1400px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <h1 style="margin:0;font-size:1.4rem">📨 e-Factura</h1>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <Show when={!loading() && companies().length > 0}>
              <label class="form-label" style="margin:0;font-size:12px">Companie:</label>
              <select
                class="input"
                style="max-width:280px"
                value={companyId() ?? ""}
                onChange={(e) => changeCompany(Number(e.currentTarget.value) || null)}
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
                    {c().token_status.connected ? "🟢 Conectat ANAF" : "🔴 Neconectat"}
                  </span>
                )}
              </Show>
              <button
                class="btn btn-ghost btn-sm"
                onClick={syncNow}
                disabled={syncing() || !companyId()}
                title="Interoghează ANAF SPV pentru e-facturi noi primite"
              >
                {syncing() ? "Se sincronizează..." : "🌐 Sincronizează acum"}
              </button>
            </Show>
          </div>
        </div>

        <Show when={loading()}>
          <div class="text-muted">Se încarcă companiile...</div>
        </Show>

        <Show when={!loading() && companies().length === 0}>
          <div style="text-align:center;padding:32px;color:var(--text-muted)">
            Nu ai nicio companie configurată. Mergi în <strong>Configurări → Companiile mele</strong>.
          </div>
        </Show>

        <Show when={!loading() && companies().length > 0}>
          <div style="display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:flex-start">
            <aside
              style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;position:sticky;top:8px"
            >
              <SidebarLink
                href="/efactura/primite"
                label="Facturi primite"
                icon="📥"
                badge={unreadCount() > 0 ? String(unreadCount()) : null}
                isActive={location.pathname.startsWith("/efactura/primite")}
              />
              <SidebarLink
                href="/efactura/trimise"
                label="Facturi trimise"
                icon="📤"
                isActive={location.pathname.startsWith("/efactura/trimise")}
              />
              <div style="margin-top:8px;padding:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);line-height:1.5">
                Sync automat: <strong>60 min</strong>.<br />
                Folosește <em>Sincronizează acum</em> pentru update instant.
              </div>
            </aside>
            <main>{props.children}</main>
          </div>
        </Show>
      </div>
    </EFacturaProvider>
  );
}

function SidebarLink(props: { href: string; label: string; icon: string; badge?: string | null; isActive: boolean }) {
  const active = () => props.isActive;
  return (
    <A
      href={props.href}
      style={`display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:${
        active() ? "600" : "500"
      };background:${active() ? "var(--surface)" : "transparent"};color:${
        active() ? "var(--accent)" : "var(--text)"
      };border:1px solid ${active() ? "var(--border)" : "transparent"}`}
    >
      <span>{props.icon}</span>
      <span style="flex:1">{props.label}</span>
      <Show when={props.badge}>
        <span
          style="background:var(--accent);color:white;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700;min-width:20px;text-align:center"
        >
          {props.badge}
        </span>
      </Show>
    </A>
  );
}
