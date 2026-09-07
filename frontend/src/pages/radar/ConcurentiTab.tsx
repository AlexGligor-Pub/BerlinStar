import { For, Show, Suspense, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { Badge, Button, ConfirmDialog, EmptyState, Select, Spinner } from "../../components/ui";
import type { BadgeKind } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { companiesApi, type Company } from "../../api/companies";
import { discoveryApi, type DiscoveryOut, type DiscoveryQuestion, type RadarStatus } from "../../api/radar";
import DiscoveryResultView from "./DiscoveryResultView";
import { KV, RadarTable, errMsg, fmtDateTime, fmtInt, fmtUsd } from "./shared";

const STATUS_LABEL: Record<RadarStatus, string> = {
  queued: "În așteptare",
  running: "Caută",
  done: "Gata",
  error: "Eroare",
};

const STATUS_BADGE: Record<RadarStatus, BadgeKind> = {
  queued: "neutral",
  running: "info",
  done: "success",
  error: "danger",
};

const OPTIONAL_IDS = ["known_competitors", "exclusions"];

function isOptional(q: DiscoveryQuestion): boolean {
  return q.optional === true || OPTIONAL_IDS.includes(q.id);
}

function companyLabel(c: Company): string {
  return c.cui ? `${c.name} · CUI ${c.cui}` : c.name;
}

export default function ConcurentiTab(props: {
  aiConfigured: boolean;
  placesConfigured: boolean;
  onOpenTab: (tab: "surse" | "focus") => void;
}) {
  const [companies] = createResource(() => companiesApi.listAll());
  const [discoveries, { refetch }] = createResource(() => discoveryApi.list(20));

  const [companyId, setCompanyId] = createSignal("");
  const [questions, setQuestions] = createSignal<DiscoveryQuestion[] | null>(null);
  const [answers, setAnswers] = createSignal<Record<string, string>>({});
  const [preparing, setPreparing] = createSignal(false);
  let prepareAbort: AbortController | null = null;
  onCleanup(() => prepareAbort?.abort());
  const [starting, setStarting] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  const [active, setActive] = createSignal<DiscoveryOut | null>(null);
  const [openId, setOpenId] = createSignal<number | null>(null);
  const [openDiscovery] = createResource(openId, (id: number) => discoveryApi.get(id));
  const [toDelete, setToDelete] = createSignal<DiscoveryOut | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  const [historyOpen, setHistoryOpen] = createSignal(false);

  const blocked = () => !props.aiConfigured || !props.placesConfigured;
  const list = () => discoveries() ?? [];
  const companyOptions = createMemo(() =>
    (companies() ?? []).map((c) => ({ value: String(c.id), label: companyLabel(c) })),
  );

  createEffect(() => {
    const opts = companyOptions();
    if (opts.length && !companyId()) setCompanyId(opts[0].value);
  });

  createEffect(() => {
    const items = discoveries();
    if (!items) return;
    setActive(items.find((d) => d.status === "queued" || d.status === "running") ?? null);
  });

  async function poll() {
    const a = active();
    if (!a) return;
    try {
      const d = await discoveryApi.get(a.id);
      if (d.status === "queued" || d.status === "running") {
        setActive(d);
        return;
      }
      setActive(null);
      void refetch();
      if (d.status === "done") {
        notify("Lista de concurenți este gata.", "success");
        setQuestions(null);
        setOpenId(d.id);
      } else {
        notify(d.error || "Căutarea a eșuat.", "error");
      }
    } catch {
      // reîncercăm la următorul tick
    }
  }

  onMount(() => {
    const t = setInterval(() => void poll(), 3000);
    onCleanup(() => clearInterval(t));
  });

  async function prepare() {
    const id = Number(companyId());
    if (!id) { setFormError("Alege firma pentru care căutăm concurenți."); return; }
    prepareAbort?.abort();
    const ctrl = new AbortController();
    prepareAbort = ctrl;
    setPreparing(true);
    setFormError("");
    try {
      const p = await discoveryApi.prepare(id, undefined, ctrl.signal);
      setQuestions(p.questions);
      setAnswers(
        Object.fromEntries(p.questions.map((q) => [q.id, q.suggested == null ? "" : String(q.suggested)])),
      );
      if (!p.ai_used) notify("Am precompletat întrebările din datele firmei (fără AI).", "info");
    } catch (e) {
      if (!ctrl.signal.aborted) setFormError(errMsg(e, "Nu am putut pregăti căutarea."));
    } finally {
      if (prepareAbort === ctrl) prepareAbort = null;
      setPreparing(false);
    }
  }

  async function start() {
    const qs = questions() ?? [];
    const payload: Record<string, string | number> = {};
    for (const q of qs) {
      const raw = (answers()[q.id] ?? "").trim();
      if (!raw) {
        if (!isOptional(q)) { setFormError(`Completează „${q.question}”.`); return; }
        continue;
      }
      if (q.type === "number") {
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n) || n <= 0) { setFormError(`„${q.question}” trebuie să fie un număr.`); return; }
        payload[q.id] = n;
      } else {
        payload[q.id] = raw;
      }
    }
    setStarting(true);
    setFormError("");
    try {
      const d = await discoveryApi.create(Number(companyId()), payload);
      setActive(d);
      notify("Căutarea a pornit. Poți naviga liniștit, o urmărim aici.", "info");
      void refetch();
    } catch (e) {
      setFormError(errMsg(e, "Nu am putut porni căutarea."));
    } finally {
      setStarting(false);
    }
  }

  async function confirmDelete() {
    const d = toDelete();
    if (!d) return;
    setDeleting(true);
    try {
      await discoveryApi.remove(d.id);
      if (openId() === d.id) setOpenId(null);
      setToDelete(null);
      notify("Căutare ștearsă.", "success");
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
  const logLines = () => (active()?.progress?.log ?? []).slice(-3);

  const columns: ColumnDef<DiscoveryOut>[] = [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "Dată",
      cell: (info) => <span class="radar-mono">{fmtDateTime(info.row.original.created_at)}</span>,
    },
    { id: "company_name", accessorKey: "company_name", header: "Firmă", cell: (info) => info.row.original.company_name || "—" },
    {
      id: "status",
      accessorKey: "status",
      header: "Stare",
      cell: (info) => {
        const d = info.row.original;
        return (
          <span title={d.error ?? undefined}>
            <Badge kind={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
          </span>
        );
      },
    },
    {
      id: "cost",
      accessorKey: "cost_usd",
      header: "Cost",
      cell: (info) => <span class="radar-mono">{fmtUsd(info.row.original.cost_usd)}</span>,
    },
    {
      id: "actions",
      header: "Acțiuni",
      enableSorting: false,
      cell: (info) => {
        const d = info.row.original;
        const running = () => d.status === "queued" || d.status === "running";
        return (
          <div class="radar-actions">
            <Button variant="ghost" size="sm" disabled={d.status !== "done"} onClick={() => setOpenId(d.id)}>Deschide</Button>
            <Button variant="danger" size="sm" disabled={running()} onClick={() => setToDelete(d)}>Șterge</Button>
          </div>
        );
      },
    },
  ];

  const mobileCard = (d: DiscoveryOut) => {
    const running = () => d.status === "queued" || d.status === "running";
    return (
      <div class="radar-row">
        <div class="radar-row-head">
          <span class="radar-row-title">{d.company_name || `Căutare #${d.id}`}</span>
          <Badge kind={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
        </div>
        <KV label="Dată"><span class="radar-mono">{fmtDateTime(d.created_at)}</span></KV>
        <KV label="Cost"><span class="radar-mono">{fmtUsd(d.cost_usd)}</span></KV>
        <div class="radar-actions">
          <Button variant="ghost" size="sm" disabled={d.status !== "done"} onClick={() => setOpenId(d.id)}>Deschide</Button>
          <Button variant="danger" size="sm" disabled={running()} onClick={() => setToDelete(d)}>Șterge</Button>
        </div>
      </div>
    );
  };

  return (
    <div class="radar-panel">
      <Show
        when={openId() === null}
        fallback={
          <Suspense fallback={<div class="radar-center"><Spinner /></div>}>
            <Show when={openDiscovery()} fallback={<p class="radar-error">Căutarea nu a putut fi încărcată.</p>}>
              {(d) => (
                <DiscoveryResultView
                  discovery={d()}
                  onBack={() => setOpenId(null)}
                  onOpenTab={props.onOpenTab}
                />
              )}
            </Show>
          </Suspense>
        }
      >
        <Show when={blocked()}>
          <div class="radar-banner">
            Descoperirea concurenților are nevoie de cheile Google Places și AI, configurate pe platformă.
            Roagă administratorul platformei să le adauge din <b>Admin → Radar AI</b>. Restul Radarului
            funcționează normal.
          </div>
        </Show>

        <Show when={active()}>
          {(a) => (
            <section class="radar-card">
              <h2>Căutare în curs</h2>
              <p class="radar-card-hint">{a().company_name}</p>
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
                <For each={logLines()}>{(l) => <p class="radar-log">{l}</p>}</For>
              </div>
            </section>
          )}
        </Show>

        <Show when={!active()}>
          <Show
            when={questions()}
            fallback={
              <section class="radar-card">
                <h2>Firma mea</h2>
                <p class="radar-card-hint">
                  Alege firma pentru care căutăm concurenți. Pornim de la adresa și activitatea ei, apoi îți
                  punem câteva întrebări scurte.
                </p>
                <div class="radar-card-body">
                  <Show when={!companies.loading} fallback={<div class="radar-center"><Spinner /></div>}>
                    <Select
                      class="radar-select"
                      label="Firmă"
                      value={companyId()}
                      options={companyOptions()}
                      onChange={setCompanyId}
                    />
                  </Show>
                  <Button
                    loading={preparing()}
                    disabled={blocked() || !companyId()}
                    onClick={() => void prepare()}
                  >
                    Pregătește căutarea
                  </Button>
                  <Show
                    when={preparing()}
                    fallback={
                      <span class="radar-muted">
                        Pregătirea folosește AI-ul pentru a-ți precompleta întrebările, deci consumă câțiva tokeni.
                      </span>
                    }
                  >
                    <span class="radar-muted">Pregătesc întrebările… (poate dura până la 3 minute)</span>
                  </Show>
                  <Show when={formError()}><p class="radar-error">{formError()}</p></Show>
                </div>
              </section>
            }
          >
            {(qs) => (
              <section class="radar-card">
                <h2>Ce mai am nevoie de la tine</h2>
                <p class="radar-card-hint">
                  Am precompletat ce am putut deduce. Verifică și corectează — cu cât e mai exact, cu atât lista
                  de concurenți e mai bună.
                </p>
                <div class="radar-card-body">
                  <For each={qs()}>
                    {(q) => (
                      <div class="radar-field">
                        <label class="form-label" for={`disc-${q.id}`}>
                          {q.question}
                          <Show when={isOptional(q)}> <span class="radar-muted">(opțional)</span></Show>
                        </label>
                        <Show when={q.hint}><span class="radar-muted">{q.hint}</span></Show>
                        <input
                          id={`disc-${q.id}`}
                          class="input"
                          classList={{ "radar-select": q.type === "number" }}
                          type={q.type === "number" ? "number" : "text"}
                          min={q.type === "number" ? 1 : undefined}
                          max={q.type === "number" ? 200 : undefined}
                          value={answers()[q.id] ?? ""}
                          onInput={(e) => setAnswers({ ...answers(), [q.id]: e.currentTarget.value })}
                        />
                      </div>
                    )}
                  </For>
                  <Show when={formError()}><p class="radar-error">{formError()}</p></Show>
                  <div class="radar-toolbar">
                    <Button variant="ghost" disabled={starting()} onClick={() => { setQuestions(null); setFormError(""); }}>
                      Înapoi
                    </Button>
                    <Button loading={starting()} disabled={blocked()} onClick={() => void start()}>
                      Caută concurenți
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </Show>

        <Show when={!discoveries.loading} fallback={<div class="radar-center"><Spinner /></div>}>
          <Show when={!discoveries.error} fallback={<p class="radar-error">Nu am putut încărca istoricul.</p>}>
            <Show
              when={list().length > 0}
              fallback={
                <EmptyState
                  title="Nicio căutare de concurenți"
                  message="Alege firma și pornește prima căutare: găsim afacerile din zonă, le analizăm și le poți adăuga în Radar cu un click."
                />
              }
            >
              <details class="rv-section" open={historyOpen()}>
                <summary onClick={() => setHistoryOpen(!historyOpen())}>
                  <span>Căutări anterioare</span>
                  <span class="radar-muted">{fmtInt(list().length)}</span>
                </summary>
                <div class="rv-section-body">
                  <RadarTable
                    data={list()}
                    columns={columns}
                    mobileCard={mobileCard}
                    initialSorting={[{ id: "created_at", desc: true }]}
                  />
                </div>
              </details>
            </Show>
          </Show>
        </Show>
      </Show>

      <ConfirmDialog
        open={toDelete() !== null}
        title="Ștergi căutarea?"
        message={`Căutarea pentru „${toDelete()?.company_name || `#${toDelete()?.id ?? ""}`}” și rezultatele ei vor fi șterse definitiv.`}
        confirmLabel="Șterge"
        variant="danger"
        loading={deleting()}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
