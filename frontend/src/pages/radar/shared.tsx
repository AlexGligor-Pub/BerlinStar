import { For, Show, createSignal, type JSX } from "solid-js";
import {
  createSolidTable, flexRender, getCoreRowModel, getSortedRowModel,
  type ColumnDef, type SortingState,
} from "@tanstack/solid-table";
import { useIsMobile } from "../../hooks/createMediaQuery";
import type { BadgeKind } from "../../components/ui";
import type { Impact, RadarKind, Sentiment } from "../../api/radar";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtMonth(m: string): string {
  const d = new Date(`${m}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return m;
  return d.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

export function fmtInt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("ro-RO");
}

export function fmtUsd(n: number | null | undefined): string {
  const v = n ?? 0;
  return `$${v.toFixed(v > 0 && v < 1 ? 4 : 2)}`;
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export const SENTIMENT_BADGE: Record<Sentiment, BadgeKind> = {
  positive: "success",
  negative: "danger",
  neutral: "neutral",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Pozitiv",
  negative: "Negativ",
  neutral: "Neutru",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  high: "Impact mare",
  medium: "Impact mediu",
  low: "Impact mic",
};

export const IMPACT_BADGE: Record<Impact, BadgeKind> = {
  high: "danger",
  medium: "warn",
  low: "neutral",
};

export interface KindMeta {
  kind: RadarKind;
  label: string;
  icon: string;
  hint: string;
  placeholder: string;
  badge: BadgeKind;
  valueLabel: string;
}

export const KINDS: KindMeta[] = [
  {
    kind: "youtube",
    label: "YouTube",
    icon: "▶",
    hint: "Urmărește videoclipurile noi ale unui canal.",
    placeholder: "https://www.youtube.com/@canal",
    badge: "danger",
    valueLabel: "Link canal YouTube",
  },
  {
    kind: "company",
    label: "Firmă (CUI)",
    icon: "🏢",
    hint: "Date ANAF și bilanțuri pentru un CUI.",
    placeholder: "14399840",
    badge: "info",
    valueLabel: "CUI (doar cifre)",
  },
  {
    kind: "website",
    label: "Site web",
    icon: "🌐",
    hint: "Noutățile publicate pe o pagină web.",
    placeholder: "https://exemplu.ro/noutati",
    badge: "success",
    valueLabel: "Adresa paginii",
  },
  {
    kind: "gbusiness",
    label: "Google Business",
    icon: "★",
    hint: "Recenziile Google ale unei afaceri locale.",
    placeholder: "Vulcanizare X, Timișoara",
    badge: "warn",
    valueLabel: "Nume și oraș",
  },
];

export const KIND_BY_ID: Record<string, KindMeta> = Object.fromEntries(KINDS.map((k) => [k.kind, k]));

export interface RadarTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  mobileCard: (row: T) => JSX.Element;
  initialSorting?: SortingState;
  empty?: JSX.Element;
}

export function RadarTable<T>(props: RadarTableProps<T>) {
  const [sorting, setSorting] = createSignal<SortingState>(props.initialSorting ?? []);
  const isMobile = useIsMobile();
  const table = createSolidTable<T>({
    get data() { return props.data; },
    get columns() { return props.columns; },
    state: { get sorting() { return sorting(); } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Show when={props.data.length > 0} fallback={props.empty}>
      <Show
        when={isMobile()}
        fallback={
          <div class="radar-table-wrap">
            <table class="radar-table">
              <thead>
                <For each={table.getHeaderGroups()}>
                  {(hg) => (
                    <tr>
                      <For each={hg.headers}>
                        {(h) => (
                          <th
                            classList={{ "is-sortable": h.column.getCanSort() }}
                            onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Show when={h.column.getIsSorted() === "asc"}> ▲</Show>
                            <Show when={h.column.getIsSorted() === "desc"}> ▼</Show>
                          </th>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </thead>
              <tbody>
                <For each={table.getRowModel().rows}>
                  {(row) => (
                    <tr>
                      <For each={row.getVisibleCells()}>
                        {(cell) => <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        }
      >
        <div class="radar-rows">
          <For each={table.getRowModel().rows}>{(row) => props.mobileCard(row.original)}</For>
        </div>
      </Show>
    </Show>
  );
}

export function KV(props: { label: string; children: JSX.Element }) {
  return (
    <div class="radar-kv">
      <span class="radar-kv-label">{props.label}</span>
      <span class="radar-kv-value">{props.children}</span>
    </div>
  );
}
