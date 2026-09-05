import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { Badge, Button, EmptyState, Modal } from "../../components/ui";
import type { BadgeKind } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { renderMarkdown } from "../../utils/markdown";
import {
  discoveryApi,
  type DiscoveryCompetitor,
  type DiscoveryImportItem,
  type DiscoveryOut,
  type RadarKind,
  type Threat,
} from "../../api/radar";
import { IMPACT_BADGE, IMPACT_LABEL, KV, RadarTable, errMsg, fmtInt, fmtUsd } from "./shared";

const THREAT_LABEL: Record<Threat, string> = {
  high: "Amenințare mare",
  medium: "Amenințare medie",
  low: "Amenințare mică",
};

const THREAT_BADGE: Record<Threat, BadgeKind> = {
  high: "danger",
  medium: "warn",
  low: "neutral",
};

interface DataKind {
  kind: RadarKind;
  label: string;
  value: (c: DiscoveryCompetitor) => string | null;
  missing: string;
}

const DATA_KINDS: DataKind[] = [
  { kind: "gbusiness", label: "Google", value: (c) => c.place_id ?? null, missing: "Fără fișă Google" },
  { kind: "website", label: "Site", value: (c) => c.website ?? null, missing: "Fără site găsit" },
  { kind: "youtube", label: "YouTube", value: (c) => c.youtube_channel ?? null, missing: "Fără canal YouTube" },
  { kind: "company", label: "CUI", value: (c) => (c.cui ? String(c.cui) : null), missing: "Fără CUI găsit" },
];

function fmtKm(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("ro-RO", { maximumFractionDigits: 1 })} km`;
}

function fmtRating(c: DiscoveryCompetitor): string {
  if (c.rating == null) return "—";
  const r = c.rating.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return c.reviews_count ? `★ ${r} (${fmtInt(c.reviews_count)})` : `★ ${r}`;
}

export default function DiscoveryResultView(props: {
  discovery: DiscoveryOut;
  onBack: () => void;
  onOpenTab: (tab: "surse" | "focus") => void;
}) {
  const [picked, setPicked] = createSignal<Record<string, boolean>>({});
  const [detail, setDetail] = createSignal<DiscoveryCompetitor | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [imported, setImported] = createSignal("");
  const [focusing, setFocusing] = createSignal(false);
  const [focusDone, setFocusDone] = createSignal(false);

  const res = () => props.discovery.result ?? null;
  const competitors = createMemo(() => res()?.competitors ?? []);
  const findings = () => res()?.findings ?? [];
  const gaps = () => res()?.data_gaps ?? [];
  const profile = () => res()?.profile ?? props.discovery.profile ?? {};

  const key = (index: number, kind: RadarKind) => `${index}:${kind}`;

  createEffect(() => {
    const start: Record<string, boolean> = {};
    for (const c of competitors()) {
      for (const dk of DATA_KINDS) if (dk.value(c)) start[key(c.index, dk.kind)] = true;
    }
    setPicked(start);
    setImported("");
    setFocusDone(false);
  });

  const items = createMemo<DiscoveryImportItem[]>(() => {
    const out: DiscoveryImportItem[] = [];
    for (const c of competitors()) {
      const kinds = DATA_KINDS.filter((dk) => dk.value(c) && picked()[key(c.index, dk.kind)]).map((dk) => dk.kind);
      if (kinds.length) out.push({ index: c.index, kinds });
    }
    return out;
  });

  const pickedCount = () => items().reduce((n, it) => n + it.kinds.length, 0);

  function toggle(index: number, kind: RadarKind) {
    const k = key(index, kind);
    setPicked({ ...picked(), [k]: !picked()[k] });
  }

  async function runImport() {
    const list = items();
    if (!list.length) return;
    setImporting(true);
    try {
      const r = await discoveryApi.importItems(props.discovery.id, list);
      setImported(`Am adăugat ${fmtInt(r.created)} surse noi, ${fmtInt(r.skipped)} erau deja în Radar.`);
      notify(`Surse adăugate: ${r.created}. Sărite (existente): ${r.skipped}.`, "success");
    } catch (e) {
      notify(errMsg(e, "Nu am putut importa selecția."), "error");
    } finally {
      setImporting(false);
    }
  }

  async function useAsFocus() {
    setFocusing(true);
    try {
      await discoveryApi.useFocus(props.discovery.id);
      setFocusDone(true);
      notify("Sugestia a fost pusă în Focus. Verific-o și ajusteaz-o oricând.", "success");
    } catch (e) {
      notify(errMsg(e, "Nu am putut folosi sugestia ca Focus."), "error");
    } finally {
      setFocusing(false);
    }
  }

  function chips(c: DiscoveryCompetitor) {
    return (
      <div class="radar-datachips">
        <For each={DATA_KINDS}>
          {(dk) => {
            const val = () => dk.value(c);
            const on = () => Boolean(val()) && picked()[key(c.index, dk.kind)] === true;
            return (
              <button
                type="button"
                class="radar-chip radar-chip--sm"
                classList={{ "radar-chip--active": on() }}
                disabled={!val()}
                title={val() ? String(val()) : dk.missing}
                onClick={() => toggle(c.index, dk.kind)}
              >
                {on() ? "✓ " : ""}{dk.label}
              </button>
            );
          }}
        </For>
      </div>
    );
  }

  const columns: ColumnDef<DiscoveryCompetitor>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Concurent",
      cell: (info) => {
        const c = info.row.original;
        return (
          <div class="dv-name">
            <span class="rv-item-title">{c.name}</span>
            <Show when={c.address}><span class="radar-muted">{c.address}</span></Show>
          </div>
        );
      },
    },
    {
      id: "distance_km",
      accessorFn: (c) => c.distance_km ?? 9999,
      header: "Distanță",
      cell: (info) => <span class="radar-mono">{fmtKm(info.row.original.distance_km)}</span>,
    },
    {
      id: "rating",
      accessorFn: (c) => c.rating ?? 0,
      header: "Rating",
      cell: (info) => <span class="radar-mono">{fmtRating(info.row.original)}</span>,
    },
    {
      id: "threat",
      accessorFn: (c) => c.relevance ?? 0,
      header: "Amenințare",
      cell: (info) => {
        const c = info.row.original;
        const t = c.threat ?? "low";
        return (
          <div class="dv-threat">
            <Badge kind={THREAT_BADGE[t]}>{THREAT_LABEL[t]}</Badge>
            <Show when={c.relevance != null}>
              <span class="radar-muted radar-mono">relevanță {fmtInt(c.relevance)}%</span>
            </Show>
          </div>
        );
      },
    },
    { id: "data", header: "Date găsite", enableSorting: false, cell: (info) => chips(info.row.original) },
    {
      id: "actions",
      header: "Acțiuni",
      enableSorting: false,
      cell: (info) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(info.row.original)}>Detalii</Button>
      ),
    },
  ];

  const mobileCard = (c: DiscoveryCompetitor) => {
    const t = c.threat ?? "low";
    return (
      <div class="radar-row">
        <div class="radar-row-head">
          <span class="radar-row-title">{c.name}</span>
          <Badge kind={THREAT_BADGE[t]}>{THREAT_LABEL[t]}</Badge>
        </div>
        <Show when={c.address}><span class="radar-muted">{c.address}</span></Show>
        <KV label="Distanță"><span class="radar-mono">{fmtKm(c.distance_km)}</span></KV>
        <KV label="Rating"><span class="radar-mono">{fmtRating(c)}</span></KV>
        <Show when={c.relevance != null}>
          <KV label="Relevanță"><span class="radar-mono">{fmtInt(c.relevance)}%</span></KV>
        </Show>
        {chips(c)}
        <div class="radar-actions">
          <Button variant="ghost" size="sm" onClick={() => setDetail(c)}>Detalii</Button>
        </div>
      </div>
    );
  };

  return (
    <div class="radar-panel">
      <div class="radar-toolbar">
        <Button variant="ghost" size="sm" onClick={props.onBack}>← Înapoi</Button>
        <span class="radar-spacer" />
        <span class="radar-muted radar-mono">
          {fmtInt(props.discovery.tokens_in)} / {fmtInt(props.discovery.tokens_out)} tokeni ·{" "}
          {fmtUsd(props.discovery.cost_usd)}
        </span>
      </div>

      <section class="radar-card">
        <div class="rv-head">
          <h2 class="rv-title">Concurenți pentru {props.discovery.company_name}</h2>
          <div class="rv-chips">
            <Show when={profile().city || profile().address}>
              <Badge kind="info">{profile().city || profile().address}</Badge>
            </Show>
            <Show when={profile().radius_km}>
              {(r) => <Badge kind="neutral">rază {fmtInt(r())} km</Badge>}
            </Show>
            <Badge kind="neutral">{fmtInt(competitors().length)} concurenți</Badge>
          </div>
        </div>
      </section>

      <Show when={res()?.market_summary}>
        <section class="radar-card">
          <h2>Sumar piață</h2>
          <div class="radar-card-body">
            {/* eslint-disable-next-line solid/no-innerhtml -- renderMarkdown escapeaza HTML-ul sursei */}
            <div class="rv-md" innerHTML={renderMarkdown(res()?.market_summary ?? "")} />
          </div>
        </section>
      </Show>

      <Show when={findings().length > 0}>
        <section class="radar-card">
          <h2>Constatări</h2>
          <div class="radar-card-body">
            <div class="rv-grid">
              <For each={findings()}>
                {(f) => (
                  <article class="rv-signal" classList={{ [`rv-signal--${f.impact}`]: true }}>
                    <div class="radar-row-head">
                      <span class="rv-item-title">{f.title}</span>
                      <Badge kind={IMPACT_BADGE[f.impact] ?? "neutral"}>{IMPACT_LABEL[f.impact] ?? f.impact}</Badge>
                    </div>
                    <p class="rv-text">{f.insight}</p>
                  </article>
                )}
              </For>
            </div>
          </div>
        </section>
      </Show>

      <section class="radar-card">
        <h2>Concurenți găsiți</h2>
        <p class="radar-card-hint">
          Bifează ce vrei să urmărești pentru fiecare concurent: fișa Google, site-ul, canalul YouTube sau firma (CUI).
        </p>
        <div class="radar-card-body">
          <RadarTable
            data={competitors()}
            columns={columns}
            mobileCard={mobileCard}
            initialSorting={[{ id: "threat", desc: true }]}
            empty={
              <EmptyState
                title="Niciun concurent găsit"
                message="Încearcă o rază mai mare sau alți termeni de căutare."
              />
            }
          />
        </div>
      </section>

      <Show when={gaps().length > 0}>
        <section class="radar-card">
          <h2>Limitări</h2>
          <ul class="rv-list">
            <For each={gaps()}>{(g) => <li>{g}</li>}</For>
          </ul>
        </section>
      </Show>

      <section class="radar-card">
        <div class="radar-toolbar">
          <Button loading={importing()} disabled={pickedCount() === 0} onClick={() => void runImport()}>
            Adaugă selecția în Radar ({fmtInt(pickedCount())})
          </Button>
          <Button
            variant="ghost"
            loading={focusing()}
            disabled={!res()?.suggested_focus}
            onClick={() => void useAsFocus()}
          >
            Folosește ca Focus
          </Button>
        </div>
        <div class="radar-card-body">
          <Show when={imported()}>
            <div class="radar-toolbar">
              <span class="radar-muted">{imported()}</span>
              <Button variant="ghost" size="sm" onClick={() => props.onOpenTab("surse")}>Vezi sursele</Button>
            </div>
          </Show>
          <Show when={focusDone()}>
            <div class="radar-toolbar">
              <span class="radar-muted">Focusul a fost actualizat cu sugestia AI.</span>
              <Button variant="ghost" size="sm" onClick={() => props.onOpenTab("focus")}>Deschide Focus</Button>
            </div>
          </Show>
          <Show when={!res()?.suggested_focus}>
            <span class="radar-muted">AI-ul nu a propus un text de Focus pentru această căutare.</span>
          </Show>
        </div>
      </section>

      <Modal
        open={detail() !== null}
        onClose={() => setDetail(null)}
        title={detail()?.name ?? ""}
        size="lg"
        footer={<Button size="sm" variant="ghost" onClick={() => setDetail(null)}>Închide</Button>}
      >
        <Show when={detail()}>
          {(c) => (
            <div class="radar-card-body">
              <Show when={c().address}><KV label="Adresă">{c().address}</KV></Show>
              <KV label="Distanță"><span class="radar-mono">{fmtKm(c().distance_km)}</span></KV>
              <KV label="Rating"><span class="radar-mono">{fmtRating(c())}</span></KV>
              <Show when={c().phone}><KV label="Telefon"><span class="radar-mono">{c().phone}</span></KV></Show>
              <Show when={c().cui}>
                <KV label="CUI">
                  <span class="radar-mono">{c().cui}</span>
                  <Show when={c().cui_source}> <span class="radar-muted">({c().cui_source})</span></Show>
                </KV>
              </Show>
              <Show when={c().positioning}>
                <div class="radar-field">
                  <span class="rv-sublabel">Poziționare</span>
                  <p class="rv-text">{c().positioning}</p>
                </div>
              </Show>
              <Show when={(c().strengths ?? []).length > 0}>
                <div class="radar-field">
                  <span class="rv-sublabel">Puncte tari</span>
                  <ul class="rv-list"><For each={c().strengths}>{(s) => <li>{s}</li>}</For></ul>
                </div>
              </Show>
              <Show when={(c().weaknesses ?? []).length > 0}>
                <div class="radar-field">
                  <span class="rv-sublabel">Puncte slabe</span>
                  <ul class="rv-list"><For each={c().weaknesses}>{(s) => <li>{s}</li>}</For></ul>
                </div>
              </Show>
              <Show when={(c().evidence ?? []).length > 0}>
                <div class="radar-field">
                  <span class="rv-sublabel">Dovezi</span>
                  <ul class="rv-list"><For each={c().evidence}>{(s) => <li>{s}</li>}</For></ul>
                </div>
              </Show>
              <div class="radar-datachips">
                <Show when={c().website}>
                  {(u) => <a class="radar-chip radar-chip--sm" href={u()} target="_blank" rel="noreferrer">Site</a>}
                </Show>
                <Show when={c().youtube_channel}>
                  {(u) => <a class="radar-chip radar-chip--sm" href={u()} target="_blank" rel="noreferrer">YouTube</a>}
                </Show>
                <Show when={c().facebook}>
                  {(u) => <a class="radar-chip radar-chip--sm" href={u()} target="_blank" rel="noreferrer">Facebook</a>}
                </Show>
              </div>
            </div>
          )}
        </Show>
      </Modal>
    </div>
  );
}
