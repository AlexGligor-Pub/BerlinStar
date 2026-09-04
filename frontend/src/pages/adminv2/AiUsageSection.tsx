import { Show, createMemo, createResource, createSignal } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { EmptyState } from "../../components/ui";
import { aiAdminApi, type AccountUsage } from "../../api/radar";
import { KV, RadarTable, fmtInt, fmtUsd } from "../radar/shared";
import "../radar/radar.css";

export default function AiUsageSection() {
  const [months, setMonths] = createSignal(6);
  const [rows] = createResource(months, (m: number) => aiAdminApi.usage(m));

  const data = () => rows() ?? [];
  const totals = createMemo(() =>
    data().reduce(
      (acc, r) => ({
        tokens_in: acc.tokens_in + r.tokens_in,
        tokens_out: acc.tokens_out + r.tokens_out,
        cost_usd: acc.cost_usd + r.cost_usd,
        runs: acc.runs + r.runs,
      }),
      { tokens_in: 0, tokens_out: 0, cost_usd: 0, runs: 0 },
    ),
  );

  const columns: ColumnDef<AccountUsage>[] = [
    { id: "account_name", accessorKey: "account_name", header: "Cont", cell: (i) => i.row.original.account_name },
    { id: "tokens_in", accessorKey: "tokens_in", header: "Tokeni in", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_in)}</span> },
    { id: "tokens_out", accessorKey: "tokens_out", header: "Tokeni out", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_out)}</span> },
    { id: "cost_usd", accessorKey: "cost_usd", header: "Cost USD", cell: (i) => <span class="radar-mono">{fmtUsd(i.row.original.cost_usd)}</span> },
    { id: "runs", accessorKey: "runs", header: "Rulări", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.runs)}</span> },
  ];

  return (
    <div class="radar-page">
      <header class="radar-head">
        <div>
          <h1>Consum AI pe conturi</h1>
          <p class="radar-lead">Tokeni și cost pentru Radar AI, agregate pe cont, pentru facturare.</p>
        </div>
      </header>

      <div class="radar-toolbar">
        <label class="form-label" for="ai-usage-months">Perioadă</label>
        <select
          id="ai-usage-months"
          class="input radar-select"
          value={String(months())}
          onChange={(e) => setMonths(Number(e.currentTarget.value))}
        >
          <option value="3">Ultimele 3 luni</option>
          <option value="6">Ultimele 6 luni</option>
          <option value="12">Ultimele 12 luni</option>
        </select>
      </div>

      <Show when={!rows.loading} fallback={<p class="radar-center">Se încarcă…</p>}>
        <Show when={!rows.error} fallback={<p class="radar-error">Nu am putut încărca consumul.</p>}>
          <div class="radar-stats">
            <div class="radar-stat">
              <div class="radar-stat-label">Tokeni intrare</div>
              <div class="radar-stat-value">{fmtInt(totals().tokens_in)}</div>
            </div>
            <div class="radar-stat">
              <div class="radar-stat-label">Tokeni ieșire</div>
              <div class="radar-stat-value">{fmtInt(totals().tokens_out)}</div>
            </div>
            <div class="radar-stat">
              <div class="radar-stat-label">Cost total</div>
              <div class="radar-stat-value">{fmtUsd(totals().cost_usd)}</div>
            </div>
            <div class="radar-stat">
              <div class="radar-stat-label">Rulări</div>
              <div class="radar-stat-value">{fmtInt(totals().runs)}</div>
            </div>
          </div>

          <RadarTable
            data={data()}
            columns={columns}
            initialSorting={[{ id: "cost_usd", desc: true }]}
            mobileCard={(r) => (
              <div class="radar-row">
                <div class="radar-row-head"><span class="radar-row-title">{r.account_name}</span></div>
                <KV label="Tokeni in"><span class="radar-mono">{fmtInt(r.tokens_in)}</span></KV>
                <KV label="Tokeni out"><span class="radar-mono">{fmtInt(r.tokens_out)}</span></KV>
                <KV label="Cost USD"><span class="radar-mono">{fmtUsd(r.cost_usd)}</span></KV>
                <KV label="Rulări"><span class="radar-mono">{fmtInt(r.runs)}</span></KV>
              </div>
            )}
            empty={<EmptyState title="Niciun consum" message="Nu s-a consumat AI în perioada selectată." />}
          />
        </Show>
      </Show>
    </div>
  );
}
