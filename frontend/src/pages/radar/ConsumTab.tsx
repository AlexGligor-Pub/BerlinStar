import { Show, createResource, createSignal } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { EmptyState, Spinner } from "../../components/ui";
import { radarApi, type UsageBucket, type UsageFeatureBucket } from "../../api/radar";
import { KV, RadarTable, fmtInt, fmtMonth, fmtUsd } from "./shared";

const FEATURE_LABEL: Record<string, string> = {
  "radar.context": "Descriere afacere",
  "radar.digest": "Analiză element",
  "radar.synthesis": "Sinteză raport",
};

function featureLabel(f: string): string {
  return FEATURE_LABEL[f] ?? f;
}

export default function ConsumTab() {
  const [months, setMonths] = createSignal(6);
  const [usage] = createResource(months, (m: number) => radarApi.usage(m));

  const monthCols: ColumnDef<UsageBucket>[] = [
    { id: "month", accessorKey: "month", header: "Lună", cell: (i) => fmtMonth(i.row.original.month) },
    { id: "tokens_in", accessorKey: "tokens_in", header: "Tokeni in", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_in)}</span> },
    { id: "tokens_out", accessorKey: "tokens_out", header: "Tokeni out", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_out)}</span> },
    { id: "cost_usd", accessorKey: "cost_usd", header: "Cost", cell: (i) => <span class="radar-mono">{fmtUsd(i.row.original.cost_usd)}</span> },
  ];

  const featureCols: ColumnDef<UsageFeatureBucket>[] = [
    { id: "feature", accessorKey: "feature", header: "Operațiune", cell: (i) => featureLabel(i.row.original.feature) },
    { id: "tokens_in", accessorKey: "tokens_in", header: "Tokeni in", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_in)}</span> },
    { id: "tokens_out", accessorKey: "tokens_out", header: "Tokeni out", cell: (i) => <span class="radar-mono">{fmtInt(i.row.original.tokens_out)}</span> },
    { id: "cost_usd", accessorKey: "cost_usd", header: "Cost", cell: (i) => <span class="radar-mono">{fmtUsd(i.row.original.cost_usd)}</span> },
  ];

  return (
    <div class="radar-panel">
      <div class="radar-toolbar">
        <label class="form-label" for="radar-usage-months">Perioadă</label>
        <select
          id="radar-usage-months"
          class="input radar-select"
          value={String(months())}
          onChange={(e) => setMonths(Number(e.currentTarget.value))}
        >
          <option value="3">Ultimele 3 luni</option>
          <option value="6">Ultimele 6 luni</option>
          <option value="12">Ultimele 12 luni</option>
        </select>
      </div>

      <Show when={!usage.loading} fallback={<div class="radar-center"><Spinner /></div>}>
        <Show when={usage()} fallback={<p class="radar-error">Nu am putut încărca consumul.</p>}>
          {(u) => (
            <>
              <div class="radar-stats">
                <div class="radar-stat">
                  <div class="radar-stat-label">Tokeni intrare</div>
                  <div class="radar-stat-value">{fmtInt(u().total_in)}</div>
                </div>
                <div class="radar-stat">
                  <div class="radar-stat-label">Tokeni ieșire</div>
                  <div class="radar-stat-value">{fmtInt(u().total_out)}</div>
                </div>
                <div class="radar-stat">
                  <div class="radar-stat-label">Cost total</div>
                  <div class="radar-stat-value">{fmtUsd(u().total_cost_usd)}</div>
                </div>
              </div>

              <section class="radar-card">
                <h2>Pe luni</h2>
                <div class="radar-card-body">
                  <RadarTable
                    data={u().by_month}
                    columns={monthCols}
                    initialSorting={[{ id: "month", desc: true }]}
                    mobileCard={(r) => (
                      <div class="radar-row">
                        <div class="radar-row-head"><span class="radar-row-title">{fmtMonth(r.month)}</span></div>
                        <KV label="Tokeni in"><span class="radar-mono">{fmtInt(r.tokens_in)}</span></KV>
                        <KV label="Tokeni out"><span class="radar-mono">{fmtInt(r.tokens_out)}</span></KV>
                        <KV label="Cost"><span class="radar-mono">{fmtUsd(r.cost_usd)}</span></KV>
                      </div>
                    )}
                    empty={<EmptyState message="Niciun consum în perioada selectată." />}
                  />
                </div>
              </section>

              <section class="radar-card">
                <h2>Pe operațiuni</h2>
                <div class="radar-card-body">
                  <RadarTable
                    data={u().by_feature}
                    columns={featureCols}
                    initialSorting={[{ id: "cost_usd", desc: true }]}
                    mobileCard={(r) => (
                      <div class="radar-row">
                        <div class="radar-row-head"><span class="radar-row-title">{featureLabel(r.feature)}</span></div>
                        <KV label="Tokeni in"><span class="radar-mono">{fmtInt(r.tokens_in)}</span></KV>
                        <KV label="Tokeni out"><span class="radar-mono">{fmtInt(r.tokens_out)}</span></KV>
                        <KV label="Cost"><span class="radar-mono">{fmtUsd(r.cost_usd)}</span></KV>
                      </div>
                    )}
                    empty={<EmptyState message="Niciun consum în perioada selectată." />}
                  />
                </div>
              </section>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
