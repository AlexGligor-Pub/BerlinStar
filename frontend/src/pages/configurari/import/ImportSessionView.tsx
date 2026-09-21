import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, type Accessor } from "solid-js";
import {
  importApi, type ClientImportFormat, type ImportIssue, type ImportRow, type ImportRowStatus,
} from "../../../api/imports";
import { notify } from "../../../store/notificationsStore";
import { refreshImportPending } from "../../../store/importPending";
import ProgressBar, { createGuard } from "./ProgressBar";
import RevertImport from "./RevertImport";
import RowEditModal from "./RowEditModal";
import {
  ISSUE_BADGE, ISSUE_LABEL, STATUS_BADGE, STATUS_LABEL, formatDateTime, sessionStatusBadge, sessionStatusLabel,
} from "./labels";

const PAGE = 100;

type Filter = ImportRowStatus | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "De rezolvat" },
  { id: "imported", label: "Importate" },
  { id: "rejected", label: "Respinse" },
  { id: "reverted", label: "Anulate" },
  { id: "all", label: "Toate" },
];

export default function ImportSessionView(props: {
  sessionId: number;
  format: Accessor<ClientImportFormat | undefined>;
  onBack: () => void;
}) {
  // Componenta se recreeaza pentru fiecare sesiune (<Match keyed> in panou),
  // deci id-ul e fix pe durata ei.
  const sessionId = props.sessionId; // eslint-disable-line solid/reactivity
  const [session, { refetch: refetchSession }] = createResource(() => sessionId, importApi.session);
  const [filter, setFilter] = createSignal<Filter>("pending");
  const [issue, setIssue] = createSignal<ImportIssue | null>(null);
  const [offset, setOffset] = createSignal(0);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());
  const [editing, setEditing] = createSignal<ImportRow | null>(null);
  const [forceDuplicates, setForceDuplicates] = createSignal(false);
  // O singura actiune pe randuri o data (dublu click = o singura cerere).
  const { busy, guard } = createGuard();
  const [working, setWorking] = createSignal<string | null>(null);
  const [failures, setFailures] = createSignal<{ row: number; message: string }[]>([]);
  const [confirmRejectAll, setConfirmRejectAll] = createSignal(false);

  const processing = () => sessionData()?.state === "processing";
  // O sesiune anulata ramane doar pentru consultare.
  const readOnly = () => sessionData()?.state === "reverted";

  // Cat timp sesiunea se proceseaza in fundal, reincarcam progresul la fiecare
  // secunda; la final aducem randurile si actualizam indicatorul din meniu.
  let wasProcessing = false;
  createEffect(() => {
    if (session.error) {
      // Reincercam mai rar decat polling-ul normal, ca sa nu batem intr-un server picat.
      const timer = setTimeout(retryLoad, 3000);
      onCleanup(() => clearTimeout(timer));
      return;
    }
    const s = sessionData();
    if (!s) return;
    if (s.state === "processing") {
      wasProcessing = true;
      const timer = setTimeout(() => void Promise.resolve(refetchSession()).catch(() => {}), 1000);
      onCleanup(() => clearTimeout(timer));
      return;
    }
    if (wasProcessing) {
      wasProcessing = false;
      void refetchRows();
      void refreshImportPending();
      if (s.state === "done") {
        notify(
          s.pending > 0
            ? `Import finalizat: ${s.imported} clienți importați, ${s.pending} rânduri de rezolvat.`
            : `Import finalizat: ${s.imported} clienți importați.`,
          "success",
        );
      } else {
        notify(s.error ?? "Importul a eșuat.", "error");
      }
    }
  });

  const rowsKey = createMemo(() => ({ f: filter(), i: issue(), o: offset() }));
  const [rows, { refetch: refetchRows, mutate: mutateRows }] = createResource(rowsKey, (k) =>
    importApi.rows(sessionId, {
      status: k.f === "all" ? null : k.f,
      issue: k.f === "pending" ? k.i : null,
      limit: PAGE,
      offset: k.o,
    }),
  );

  const pendingOnPage = () => (rowsData()?.items ?? []).filter(r => r.status === "pending");
  // O resursa in eroare ARUNCA la citire in Solid, iar singurul ErrorBoundary e la
  // radacina aplicatiei: citita direct, o interogare esuata ar inlocui tot ecranul.
  // Citim prin accesorii de mai jos si reincercam — importul merge mai departe pe
  // server chiar daca noi am pierdut un raspuns.
  const sessionData = () => (session.error ? undefined : session());
  const rowsData = () => (rows.error ? undefined : rows());
  const retryLoad = () => {
    void Promise.resolve(refetchSession()).catch(() => {});
    void Promise.resolve(refetchRows()).catch(() => {});
  };

  const allSelected = () => pendingOnPage().length > 0 && pendingOnPage().every(r => selected().has(r.id));

  const pendingByIssue = () => rowsData()?.pending_by_issue ?? {};

  function changeFilter(f: Filter) {
    setFilter(f); setIssue(null); setOffset(0); setSelected(new Set<number>()); setFailures([]);
  }

  function changeIssue(i: ImportIssue | null) {
    setIssue(i); setOffset(0); setSelected(new Set<number>()); setFailures([]); setConfirmRejectAll(false);
  }

  function toggle(id: number) {
    const next = new Set(selected());
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    setSelected(allSelected() ? new Set<number>() : new Set(pendingOnPage().map(r => r.id)));
  }

  async function reloadAll() {
    setSelected(new Set<number>());
    await Promise.all([refetchSession(), refetchRows(), refreshImportPending()]);
  }

  function run<T>(label: string, fn: () => Promise<T>, message: (r: T) => string) {
    return guard(async () => {
      setWorking(label);
      setFailures([]);
      try {
        const result = await fn();
        notify(message(result), "success");
        return result;
      } catch (e) {
        notify(e instanceof Error ? e.message : "Operațiunea a eșuat.", "error");
        return undefined;
      } finally {
        // Reincarcarea poate esua la randul ei, iar bara „se lucrează" trebuie sa
        // dispara oricum — altfel ramane pe ecran dupa o operatiune reusita.
        try {
          await reloadAll();
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function importSelected() {
    const body = { row_ids: [...selected()], force_duplicates: forceDuplicates() };
    const r = await run(
      `Se importă ${body.row_ids.length} rânduri...`,
      () => importApi.importRows(sessionId, body),
      (res) => `${res.imported} rânduri importate${res.failed.length ? `, ${res.failed.length} nu au putut fi importate` : ""}.`,
    );
    if (r) setFailures(r.failed);
  }

  function rejectSelected() {
    const ids = [...selected()];
    void run(`Se resping ${ids.length} rânduri...`, () => importApi.rejectRows(sessionId, { row_ids: ids }), (res) => `${res.rejected} rânduri respinse.`);
  }

  function rejectAll() {
    setConfirmRejectAll(false);
    // Cu un filtru de problema activ, respingem DOAR categoria afisata: altfel
    // butonul ar sterge si randurile pe care utilizatorul nu le vede.
    const i = issue();
    void run("Se resping rândurile rămase...", () => importApi.rejectRows(sessionId, { all_pending: true, issue: i }),
      (res) => `${res.rejected} rânduri respinse.`);
  }

  function rejectOne(r: ImportRow) {
    void run(`Se respinge rândul ${r.row}...`, () => importApi.rejectRows(sessionId, { row_ids: [r.id] }), () => `Rândul ${r.row} a fost respins.`);
  }

  function restoreOne(r: ImportRow) {
    void run(`Se readuce rândul ${r.row}...`, () => importApi.restoreRows(sessionId, [r.id]), () => `Rândul ${r.row} a fost readus în lista de rezolvat.`);
  }

  function onRowChanged(updated: ImportRow | null) {
    if (updated) mutateRows(p => p && { ...p, items: p.items.map(x => (x.id === updated.id ? updated : x)) });
  }

  function closeEditor() {
    setEditing(null);
    void reloadAll();
  }

  function downloadReport() {
    void run("Se pregătește raportul...", () => importApi.downloadReport(sessionId), () => "Raport descărcat.");
  }

  return (
    <div class="import-report">
      <div class="import-actions">
        <button class="btn btn-sm btn-ghost" onClick={() => props.onBack()}>‹ Înapoi la istoric</button>
      </div>

      <Show when={sessionData()}>
        {(s) => (
          <>
            <div class="cfg-panel-header">
              <h3 class="cfg-panel-title">{s().filename ?? `Import #${s().id}`}</h3>
              <span class={`badge ${sessionStatusBadge(s())}`}>{sessionStatusLabel(s())}</span>
            </div>
            <p class="cfg-hint">
              Importat de <strong>{s().created_by ?? "—"}</strong> la {formatDateTime(s().created_at)}
              <Show when={s().updated_at}> · ultima acțiune {formatDateTime(s().updated_at)}</Show>
            </p>
            <div class="import-stats">
              <div><span>Rânduri în fișier</span><strong>{s().total_rows}</strong></div>
              <div><span>Importate</span><strong>{s().imported}</strong></div>
              <div classList={{ "import-stat--warn": s().pending > 0 }}><span>De rezolvat</span><strong>{s().pending}</strong></div>
              <div><span>Respinse</span><strong>{s().rejected}</strong></div>
            </div>
            <For each={s().file_warnings}>{(w) => <p class="cfg-hint cfg-hint--warn">{w}</p>}</For>
            <Show when={s().state === "processing"}>
              <ProgressBar
                value={s().total_rows ? s().processed_rows / s().total_rows : 0}
                label="Se importă clienții..."
                detail={`${s().processed_rows.toLocaleString("ro-RO")} din ${s().total_rows.toLocaleString("ro-RO")} rânduri procesate. Poți părăsi pagina, importul continuă.`}
              />
            </Show>
            <Show when={s().state === "failed"}>
              <p class="cfg-error">{s().error ?? "Importul a eșuat."}</p>
            </Show>
            <Show when={s().state === "reverted"}>
              <p class="cfg-hint cfg-hint--warn">
                Import anulat de <strong>{s().reverted_by ?? "—"}</strong> la {formatDateTime(s().reverted_at)}.
              </p>
            </Show>
            <div class="import-actions">
              <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={downloadReport}>
                Descarcă raportul importului (CSV)
              </button>
              <Show when={s().state === "done" || s().state === "failed"}>
                <RevertImport session={s()} onDone={() => void reloadAll()} />
              </Show>
            </div>
            <Show when={s().state === "done" && s().pending > 0}>
              <div class="import-callout">
                <strong>Această sesiune necesită acțiuni.</strong> Deschide fiecare rând cu <em>Completează</em>, corectează ce
                lipsește și importă-l, sau respinge-l. Poți selecta mai multe rânduri și le poți importa ori respinge deodată.
              </div>
            </Show>
          </>
        )}
      </Show>

      <Show when={sessionData() && !processing()}>
      <div class="cfg-tabs">
        <For each={FILTERS}>
          {(f) => (
            <button class="cfg-tab" disabled={busy()} classList={{ "cfg-tab--active": filter() === f.id }} onClick={() => changeFilter(f.id)}>
              {f.label}
              <Show when={f.id === "pending" && (sessionData()?.pending ?? 0) > 0}>
                <span class="cfg-tab-count">{sessionData()!.pending}</span>
              </Show>
            </button>
          )}
        </For>
      </div>

      <Show when={filter() === "pending" && !readOnly()}>
        <div class="import-actions import-filters">
          <span class="cfg-hint">Problemă:</span>
          <button class="btn btn-sm" disabled={busy()} classList={{ "btn-primary": issue() === null, "btn-ghost": issue() !== null }} onClick={() => changeIssue(null)}>Toate</button>
          <For each={(["missing", "error", "duplicate"] as ImportIssue[]).filter(i => (pendingByIssue()[i] ?? 0) > 0 || issue() === i)}>
            {(i) => (
              <button class="btn btn-sm" disabled={busy()} classList={{ "btn-primary": issue() === i, "btn-ghost": issue() !== i }} onClick={() => changeIssue(i)}>
                {ISSUE_LABEL[i]} <span class="cfg-tab-count">{pendingByIssue()[i] ?? 0}</span>
              </button>
            )}
          </For>
        </div>

        <div class="import-bulk">
          <span class="cfg-hint">{selected().size} selectate</span>
          <button class="btn btn-sm btn-primary" disabled={busy() || selected().size === 0} onClick={() => void importSelected()}>
            Importă selectate
          </button>
          <button class="btn btn-sm btn-danger" disabled={busy() || selected().size === 0} onClick={rejectSelected}>
            Respinge selectate
          </button>
          <label class="cfg-checkbox-row">
            <input type="checkbox" checked={forceDuplicates()} onChange={e => setForceDuplicates(e.currentTarget.checked)} />
            include și posibilele duplicate
          </label>
          <span style={{ flex: 1 }} />
          <Show
            when={confirmRejectAll()}
            fallback={
              <button class="btn btn-sm btn-ghost" disabled={busy() || (sessionData()?.pending ?? 0) === 0} onClick={() => setConfirmRejectAll(true)}>
                {issue() ? `Respinge toate „${ISSUE_LABEL[issue()!]}”` : "Respinge toate rândurile rămase"}
              </button>
            }
          >
            <span class="cfg-hint">
              Respingi {issue() ? `toate rândurile „${ISSUE_LABEL[issue()!]}”` : `toate cele ${sessionData()?.pending} rânduri rămase`}?
            </span>
            <button class="btn btn-sm btn-danger" disabled={busy()} onClick={rejectAll}>Da, respinge</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setConfirmRejectAll(false)}>Nu</button>
          </Show>
        </div>
      </Show>

      <Show when={working()}>
        <ProgressBar label={working()!} />
      </Show>

      <Show when={failures().length > 0}>
        <div class="cfg-error">
          <strong>Rânduri care nu au putut fi importate:</strong>
          <ul><For each={failures()}>{(f) => <li>{f.message}</li>}</For></ul>
        </div>
      </Show>

      <Show when={session.error || rows.error}>
        <p class="cfg-error">
          Datele nu s-au putut încărca (conexiune întreruptă). Importul continuă pe server.{" "}
          <button class="btn btn-sm btn-ghost" onClick={retryLoad}>Reîncearcă</button>
        </p>
      </Show>

      <Show when={rows.loading && !rowsData()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={rowsData() && rowsData()!.items.length === 0}>
        <p class="cfg-hint">{filter() === "pending" ? "Nu mai sunt rânduri de rezolvat." : "Niciun rând."}</p>
      </Show>

      <Show when={rowsData() && rowsData()!.items.length > 0}>
        <div class="data-table-wrap import-scroll">
          <table class="data-table import-table">
            <thead>
              <tr>
                <Show when={filter() === "pending"}>
                  <th><input type="checkbox" checked={allSelected()} onChange={toggleAll} aria-label="Selectează toate" /></th>
                </Show>
                <th>Rând</th><th>Stare</th><th>Nume</th><th>Tip</th><th>CUI / CNP</th><th>Telefon</th><th>Detalii</th><th />
              </tr>
            </thead>
            <tbody>
              <For each={rowsData()!.items}>
                {(r) => (
                  <tr>
                    <Show when={filter() === "pending"}>
                      <td><input type="checkbox" checked={selected().has(r.id)} onChange={() => toggle(r.id)} /></td>
                    </Show>
                    <td>{r.row}</td>
                    <td>
                      <Show when={r.status === "pending" && r.issue} fallback={<span class={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>}>
                        <span class={`badge ${ISSUE_BADGE[r.issue!]}`}>{ISSUE_LABEL[r.issue!]}</span>
                      </Show>
                    </td>
                    <td>{r.values.nume ?? <em class="import-aliases">lipsă</em>}</td>
                    <td>{r.values.tip ?? "—"}</td>
                    <td>{r.values.cui ?? "—"}</td>
                    <td>{r.values.telefon ?? "—"}</td>
                    <td class="import-messages">
                      {r.messages.join(" ")}
                      <Show when={r.status !== "pending" && r.resolved_by}>
                        <div class="import-aliases">{STATUS_LABEL[r.status]} de {r.resolved_by} · {formatDateTime(r.resolved_at)}</div>
                      </Show>
                    </td>
                    <td class="import-row-actions">
                      <Show when={r.status === "pending"}>
                        <button class="btn btn-sm btn-primary" disabled={busy()} onClick={() => setEditing(r)}>Completează</button>
                        <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => rejectOne(r)}>Respinge</button>
                      </Show>
                      <Show when={r.status === "rejected" && !readOnly()}>
                        <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => restoreOne(r)}>Readu în listă</button>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <Show when={rowsData()!.total > PAGE}>
          <div class="import-actions import-pager">
            <button class="btn btn-sm btn-ghost" disabled={busy() || offset() === 0} onClick={() => { setOffset(Math.max(0, offset() - PAGE)); setSelected(new Set<number>()); }}>‹ Anterioare</button>
            <span class="cfg-hint">{offset() + 1}–{Math.min(offset() + PAGE, rowsData()!.total)} din {rowsData()!.total}</span>
            <button class="btn btn-sm btn-ghost" disabled={busy() || offset() + PAGE >= rowsData()!.total} onClick={() => { setOffset(offset() + PAGE); setSelected(new Set<number>()); }}>Următoare ›</button>
          </div>
        </Show>
      </Show>
      </Show>

      <Show when={editing()}>
        {(r) => (
          <RowEditModal
            sessionId={sessionId}
            row={r()}
            columns={props.format()?.columns ?? []}
            onClose={closeEditor}
            onChanged={onRowChanged}
          />
        )}
      </Show>
    </div>
  );
}
