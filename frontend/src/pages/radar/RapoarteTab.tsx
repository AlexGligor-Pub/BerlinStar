import { Show, Suspense, createEffect, createResource, createSignal, onCleanup, onMount } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { Badge, Button, ConfirmDialog, EmptyState, Spinner } from "../../components/ui";
import type { BadgeKind } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { downloadRunPdf, radarApi, type RadarRun, type RadarStatus } from "../../api/radar";
import ReportView from "./ReportView";
import { KV, RadarTable, errMsg, fmtDateTime, fmtDay, fmtInt, fmtUsd } from "./shared";

const STATUS_LABEL: Record<RadarStatus, string> = {
  queued: "În așteptare",
  running: "Rulează",
  done: "Gata",
  error: "Eroare",
};

const STATUS_BADGE: Record<RadarStatus, BadgeKind> = {
  queued: "neutral",
  running: "info",
  done: "success",
  error: "danger",
};

function period(r: RadarRun): string {
  if (!r.period_from && !r.period_to) return "—";
  return `${fmtDay(r.period_from)} – ${fmtDay(r.period_to)}`;
}

export default function RapoarteTab(props: { aiConfigured: boolean }) {
  const [runs, { refetch }] = createResource(() => radarApi.runs(20));
  const [openId, setOpenId] = createSignal<number | null>(null);
  const [openRun] = createResource(openId, (id: number) => radarApi.run(id));
  const [active, setActive] = createSignal<RadarRun | null>(null);
  const [starting, setStarting] = createSignal(false);
  const [toDelete, setToDelete] = createSignal<RadarRun | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  const list = () => runs() ?? [];

  createEffect(() => {
    const items = runs();
    if (!items) return;
    setActive(items.find((r) => r.status === "queued" || r.status === "running") ?? null);
  });

  async function poll() {
    const a = active();
    if (!a) return;
    try {
      const r = await radarApi.run(a.id);
      if (r.status === "queued" || r.status === "running") {
        setActive(r);
        return;
      }
      setActive(null);
      void refetch();
      if (r.status === "done") {
        notify("Raportul este gata.", "success");
        setOpenId(r.id);
      } else {
        notify(r.error || "Analiza a eșuat.", "error");
      }
    } catch {
      // reîncercăm la următorul tick
    }
  }

  onMount(() => {
    const t = setInterval(() => void poll(), 3000);
    onCleanup(() => clearInterval(t));
  });

  async function start() {
    setStarting(true);
    try {
      const r = await radarApi.startRun();
      setActive(r);
      notify("Analiza a pornit. Poți naviga liniștit, o urmărim aici.", "info");
      void refetch();
    } catch (e) {
      notify(errMsg(e, "Nu am putut porni analiza."), "error");
    } finally {
      setStarting(false);
    }
  }

  async function savePdf(id: number) {
    try {
      await downloadRunPdf(id);
    } catch (e) {
      notify(errMsg(e, "Nu am putut genera PDF-ul."), "error");
    }
  }

  async function confirmDelete() {
    const r = toDelete();
    if (!r) return;
    setDeleting(true);
    try {
      await radarApi.deleteRun(r.id);
      if (openId() === r.id) setOpenId(null);
      setToDelete(null);
      notify("Raport șters.", "success");
      void refetch();
    } catch (e) {
      notify(errMsg(e, "Eroare la ștergere."), "error");
    } finally {
      setDeleting(false);
    }
  }

  const progressPct = () => {
    const p = active()?.progress;
    const total = p?.total ?? 0;
    if (!total) return 0;
    return Math.min(100, Math.round(((p?.done ?? 0) / total) * 100));
  };
  const lastLog = () => {
    const log = active()?.progress?.log ?? [];
    return log.length ? log[log.length - 1] : "";
  };

  const columns: ColumnDef<RadarRun>[] = [
    {
      id: "started_at",
      accessorKey: "started_at",
      header: "Dată",
      cell: (info) => <span class="radar-mono">{fmtDateTime(info.row.original.started_at)}</span>,
    },
    { id: "title", accessorFn: (r) => r.title ?? "", header: "Titlu", cell: (info) => info.row.original.title || "—" },
    { id: "period", header: "Perioadă", enableSorting: false, cell: (info) => <span class="radar-mono">{period(info.row.original)}</span> },
    {
      id: "tokens",
      accessorFn: (r) => r.tokens_in + r.tokens_out,
      header: "Tokeni",
      cell: (info) => (
        <span class="radar-mono">{fmtInt(info.row.original.tokens_in)} / {fmtInt(info.row.original.tokens_out)}</span>
      ),
    },
    { id: "cost", accessorKey: "cost_usd", header: "Cost", cell: (info) => <span class="radar-mono">{fmtUsd(info.row.original.cost_usd)}</span> },
    {
      id: "status",
      accessorKey: "status",
      header: "Stare",
      cell: (info) => {
        const r = info.row.original;
        return (
          <span title={r.error ?? undefined}>
            <Badge kind={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Acțiuni",
      enableSorting: false,
      cell: (info) => {
        const r = info.row.original;
        return (
          <div class="radar-actions">
            <Button variant="ghost" size="sm" disabled={r.status !== "done"} onClick={() => setOpenId(r.id)}>Deschide</Button>
            <Button variant="ghost" size="sm" disabled={r.status !== "done"} onClick={() => void savePdf(r.id)}>PDF</Button>
            <Button variant="danger" size="sm" onClick={() => setToDelete(r)}>Șterge</Button>
          </div>
        );
      },
    },
  ];

  const mobileCard = (r: RadarRun) => (
    <div class="radar-row">
      <div class="radar-row-head">
        <span class="radar-row-title">{r.title || `Raport #${r.id}`}</span>
        <Badge kind={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      </div>
      <KV label="Dată"><span class="radar-mono">{fmtDateTime(r.started_at)}</span></KV>
      <KV label="Perioadă"><span class="radar-mono">{period(r)}</span></KV>
      <KV label="Tokeni"><span class="radar-mono">{fmtInt(r.tokens_in)} / {fmtInt(r.tokens_out)}</span></KV>
      <KV label="Cost"><span class="radar-mono">{fmtUsd(r.cost_usd)}</span></KV>
      <div class="radar-actions">
        <Button variant="ghost" size="sm" disabled={r.status !== "done"} onClick={() => setOpenId(r.id)}>Deschide</Button>
        <Button variant="ghost" size="sm" disabled={r.status !== "done"} onClick={() => void savePdf(r.id)}>PDF</Button>
        <Button variant="danger" size="sm" onClick={() => setToDelete(r)}>Șterge</Button>
      </div>
    </div>
  );

  return (
    <div class="radar-panel">
      <Show
        when={openId() === null}
        fallback={
          <Suspense fallback={<div class="radar-center"><Spinner /></div>}>
            <Show when={openRun()} fallback={<p class="radar-error">Raportul nu a putut fi încărcat.</p>}>
              {(r) => (
                <ReportView run={r()} onBack={() => setOpenId(null)} onPdf={() => void savePdf(r().id)} />
              )}
            </Show>
          </Suspense>
        }
      >
        <div class="radar-toolbar">
          <Button loading={starting()} disabled={!props.aiConfigured || active() !== null} onClick={() => void start()}>
            Rulează analiza acum
          </Button>
          <span class="radar-muted">
            {active() ? "O analiză este deja în curs." : "Colectăm sursele, analizăm fiecare element și scriem raportul."}
          </span>
        </div>

        <Show when={active()}>
          {(a) => (
            <section class="radar-card">
              <h2>Analiză în curs</h2>
              <div class="radar-card-body">
                <div class="radar-kv">
                  <span class="radar-kv-label">{a().progress?.step || "Se pregătește…"}</span>
                  <span class="radar-kv-value radar-mono">
                    {fmtInt(a().progress?.done ?? 0)} / {fmtInt(a().progress?.total ?? 0)}
                  </span>
                </div>
                <div class="radar-progress">
                  <div class="radar-progress-fill" style={{ width: `${progressPct()}%` }} />
                </div>
                <Show when={lastLog()}><p class="radar-log">{lastLog()}</p></Show>
              </div>
            </section>
          )}
        </Show>

        <Show when={!runs.loading} fallback={<div class="radar-center"><Spinner /></div>}>
          <Show when={!runs.error} fallback={<p class="radar-error">Nu am putut încărca istoricul.</p>}>
            <RadarTable
              data={list()}
              columns={columns}
              mobileCard={mobileCard}
              initialSorting={[{ id: "started_at", desc: true }]}
              empty={
                <EmptyState
                  title="Niciun raport încă"
                  message="Pornește prima analiză și primești un raport de decizie cu semnale, recomandări și opțiuni."
                  action={
                    <Button loading={starting()} disabled={!props.aiConfigured} onClick={() => void start()}>
                      Rulează analiza acum
                    </Button>
                  }
                />
              }
            />
          </Show>
        </Show>
      </Show>

      <ConfirmDialog
        open={toDelete() !== null}
        title="Ștergi raportul?"
        message={`Raportul „${toDelete()?.title || `#${toDelete()?.id ?? ""}`}” va fi șters definitiv.`}
        confirmLabel="Șterge"
        variant="danger"
        loading={deleting()}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
