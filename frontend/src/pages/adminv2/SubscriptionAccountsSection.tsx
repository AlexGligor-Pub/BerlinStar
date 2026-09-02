import { For, Show, createSignal, onMount } from "solid-js";
import { adminFetch } from "./admin-auth";
import { readJsonSafe } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import Modal from "../../components/ui/Modal";

interface AccountItem {
  account_id: number;
  account_name: string;
  account_username: string;
  email: string | null;
  is_locked: boolean;
  next_payment_date: string | null;
  last_payment_date: string | null;
  last_payment_status: string | null;
}

interface AccountPayment {
  id: number;
  status: string;
  paid_at: string | null;
  amount_eur: number;
  amount_ron: number;
  invoice_number: string | null;
  anaf_status: string | null;
}

export default function SubscriptionAccountsSection() {
  const [items, setItems] = createSignal<AccountItem[]>([]);
  const [q, setQ] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [editDate, setEditDate] = createSignal("");
  const [historyFor, setHistoryFor] = createSignal<AccountItem | null>(null);
  const [history, setHistory] = createSignal<AccountPayment[]>([]);

  async function load() {
    setLoading(true);
    try {
      const url = "/api/admin/subscription/accounts" + (q().trim() ? `?q=${encodeURIComponent(q().trim())}` : "");
      const res = await adminFetch(url);
      if (res.ok) {
        const d = (await res.json()) as { items: AccountItem[] };
        setItems(d.items);
      }
    } finally { setLoading(false); }
  }

  onMount(() => { void load(); });

  function startEdit(item: AccountItem) {
    setEditingId(item.account_id);
    setEditDate(item.next_payment_date || new Date().toISOString().slice(0, 10));
  }

  async function saveDate(item: AccountItem) {
    if (!editDate()) return;
    const res = await adminFetch(`/api/admin/subscription/accounts/${item.account_id}`, {
      method: "PATCH",
      body: JSON.stringify({ next_payment_date: editDate() }),
    });
    if (!res.ok) {
      const d = await readJsonSafe<{ detail?: string }>(res);
      notify(d.detail || "Eroare.", "error");
      return;
    }
    notify("Scadenţa actualizată.", "success");
    setEditingId(null);
    void load();
  }

  async function toggleLock(item: AccountItem) {
    const res = await adminFetch(`/api/admin/subscription/accounts/${item.account_id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_locked: !item.is_locked }),
    });
    if (!res.ok) {
      notify("Eroare la lock.", "error");
      return;
    }
    void load();
  }

  async function viewHistory(item: AccountItem) {
    setHistoryFor(item);
    const res = await adminFetch(`/api/admin/subscription/accounts/${item.account_id}/payments`);
    if (res.ok) setHistory(await res.json());
    else setHistory([]);
  }

  return (
    <div style="padding:18px">
      <h2 style="margin-top:0">Abonament — Conturi</h2>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <input
          class="input"
          style="max-width:280px"
          placeholder="Caută după nume / username / email"
          value={q()}
          onInput={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
        />
        <button class="btn btn-primary btn-sm" onClick={() => void load()} disabled={loading()}>Caută</button>
        <button class="btn btn-ghost btn-sm" onClick={() => { setQ(""); void load(); }}>Reset</button>
      </div>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:var(--surface-2,#f1f5f9);text-align:left">
              <th style="padding:8px 10px">Cont</th>
              <th style="padding:8px 10px">Email</th>
              <th style="padding:8px 10px">Scadenţa următoare</th>
              <th style="padding:8px 10px">Ultima plată</th>
              <th style="padding:8px 10px">Status</th>
              <th style="padding:8px 10px">Acţiuni</th>
            </tr>
          </thead>
          <tbody>
            <For each={items()}>
              {(item) => (
                <tr style="border-bottom:1px solid var(--border,#e5e7eb)">
                  <td style="padding:8px 10px">
                    <div style="font-weight:600">{item.account_name}</div>
                    <div style="font-size:12px;color:var(--text-muted)">@{item.account_username}</div>
                  </td>
                  <td style="padding:8px 10px">{item.email || "—"}</td>
                  <td style="padding:8px 10px">
                    <Show
                      when={editingId() === item.account_id}
                      fallback={item.next_payment_date || "—"}
                    >
                      <div style="display:flex;gap:4px;align-items:center">
                        <input class="input" type="date" value={editDate()} onInput={(e) => setEditDate(e.currentTarget.value)} style="max-width:160px" />
                        <button class="btn btn-primary btn-sm" onClick={() => saveDate(item)}>OK</button>
                        <button class="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    </Show>
                  </td>
                  <td style="padding:8px 10px">
                    <div>{item.last_payment_date || "—"}</div>
                    <Show when={item.last_payment_status}>
                      <div style="font-size:12px;color:var(--text-muted)">{item.last_payment_status}</div>
                    </Show>
                  </td>
                  <td style="padding:8px 10px">
                    <Show when={item.is_locked} fallback={<span style="color:#16a34a">Activ</span>}>
                      <span style="color:#dc2626">Blocat</span>
                    </Show>
                  </td>
                  <td style="padding:8px 10px;white-space:nowrap">
                    <Show when={editingId() !== item.account_id}>
                      <button class="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>Editează data</button>
                    </Show>
                    <button class="btn btn-ghost btn-sm" style="margin-left:4px" onClick={() => toggleLock(item)}>
                      {item.is_locked ? "Deblochează" : "Blochează"}
                    </button>
                    <button class="btn btn-ghost btn-sm" style="margin-left:4px" onClick={() => viewHistory(item)}>Istoric</button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={historyFor()}>
        {(item) => (
          <Modal
            open
            title={<>Istoric plăţi — {item().account_name}</>}
            onClose={() => { setHistoryFor(null); setHistory([]); }}
            style="max-width:760px"
            bodyStyle="padding:16px 20px"
          >
            <Show
              when={history().length > 0}
              fallback={<div style="color:var(--text-muted)">Nu există plăţi.</div>}
            >
              <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                <thead>
                  <tr style="background:var(--surface-2,#f1f5f9);text-align:left">
                    <th style="padding:6px 8px">Factura</th>
                    <th style="padding:6px 8px">Plătit la</th>
                    <th style="padding:6px 8px">EUR</th>
                    <th style="padding:6px 8px">RON</th>
                    <th style="padding:6px 8px">Status</th>
                    <th style="padding:6px 8px">SPV</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={history()}>
                    {(p) => (
                      <tr style="border-bottom:1px solid var(--border,#e5e7eb)">
                        <td style="padding:6px 8px">{p.invoice_number || "—"}</td>
                        <td style="padding:6px 8px">{p.paid_at?.split("T")[0] || "—"}</td>
                        <td style="padding:6px 8px">{p.amount_eur.toFixed(2)}</td>
                        <td style="padding:6px 8px">{p.amount_ron.toFixed(2)}</td>
                        <td style="padding:6px 8px">{p.status}</td>
                        <td style="padding:6px 8px">{p.anaf_status || "—"}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </Modal>
        )}
      </Show>
    </div>
  );
}
