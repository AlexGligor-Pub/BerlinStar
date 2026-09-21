import { For, Show, createSignal } from "solid-js";
import { Modal } from "../../../components/ui";
import { importApi, type ImportSession, type RevertSummary } from "../../../api/imports";
import { notify } from "../../../store/notificationsStore";
import ProgressBar, { createGuard } from "./ProgressBar";

/**
 * Anularea unui import, in doi pasi: intai serverul calculeaza ce s-ar sterge si
 * ce s-ar pastra (fara sa modifice nimic), apoi utilizatorul confirma.
 */
export default function RevertImport(props: { session: ImportSession; onDone: () => void }) {
  const [plan, setPlan] = createSignal<RevertSummary | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [working, setWorking] = createSignal<string | null>(null);
  const { busy, guard } = createGuard();

  const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Operațiunea a eșuat.");

  async function open() {
    const sid = props.session.id;
    await guard(async () => {
      setWorking("Se calculează ce s-ar anula..."); setError(null);
      try {
        setPlan(await importApi.revert(sid, true));
      } catch (e) {
        setError(message(e));
      } finally {
        setWorking(null);
      }
    });
  }

  async function confirm() {
    const sid = props.session.id;
    const done = await guard(async () => {
      setWorking("Se anulează importul..."); setError(null);
      try {
        const res = await importApi.revert(sid, false);
        notify(`Import anulat: ${describe(res)}.`, "success");
        setPlan(null);
        return true;
      } catch (e) {
        setError(message(e));
        return false;
      } finally {
        setWorking(null);
      }
    });
    if (done) props.onDone();
  }

  return (
    <>
      <button class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void open()}>
        Anulează importul (revert)
      </button>
      <Show when={working() && !plan()}><ProgressBar label={working()!} /></Show>
      <Show when={error() && !plan()}><p class="cfg-error">{error()}</p></Show>

      <Show when={plan()}>
        {(p) => (
          <Modal
            open
            size="md"
            title="Anulează importul"
            onClose={() => { if (!busy()) setPlan(null); }}
            closeDisabled={busy()}
            footer={
              <div class="import-modal-footer">
                <span style={{ flex: 1 }} />
                <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => setPlan(null)}>Renunță</button>
                <button class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void confirm()}>Da, anulează importul</button>
              </div>
            }
          >
            <div class="import-row-editor">
              <p>
                Se șterge ce a creat importul <strong>{props.session.filename ?? `#${props.session.id}`}</strong>.
                Ce a fost folosit sau modificat între timp <strong>se păstrează</strong>.
              </p>
              <ul class="import-rules">
                <Show when={p().cazari_deleted !== undefined}>
                  <li>Cazări șterse: <strong>{p().cazari_deleted}</strong> (păstrate: {p().cazari_kept})</li>
                  <li>Anvelope șterse: <strong>{p().anvelope_deleted}</strong></li>
                  <li>Mașini scoase din garajul clienților: <strong>{p().vehicole_deleted}</strong></li>
                  <li>Valori noi din nomenclatoare (locuri, dimensiuni, profiluri, DOT) șterse: <strong>{p().nomenclatoare_deleted}</strong></li>
                </Show>
                <li>Clienți creați de import, șterși: <strong>{p().clients_deleted}</strong> (păstrați: {p().clients_kept})</li>
                <li>Rânduri încă de rezolvat, închise: <strong>{p().pending_closed}</strong></li>
              </ul>
              <Show when={p().kept.length > 0}>
                <strong>Se păstrează:</strong>
                <div class="data-table-wrap import-scroll">
                  <table class="data-table import-table">
                    <thead><tr><th>Rând</th><th>Ce</th><th>De ce</th></tr></thead>
                    <tbody>
                      <For each={p().kept}>
                        {(k) => <tr><td>{k.row ?? "—"}</td><td>{k.label ?? "—"}</td><td>{k.reason}</td></tr>}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
              <Show when={working()}><ProgressBar label={working()!} /></Show>
              <Show when={error()}><p class="cfg-error">{error()}</p></Show>
            </div>
          </Modal>
        )}
      </Show>
    </>
  );
}

function describe(r: RevertSummary): string {
  const parts = [];
  if (r.cazari_deleted !== undefined) parts.push(`${r.cazari_deleted} cazări, ${r.anvelope_deleted} anvelope`);
  parts.push(`${r.clients_deleted} clienți șterși`);
  const kept = (r.cazari_kept ?? 0) + r.clients_kept;
  if (kept) parts.push(`${kept} păstrate`);
  return parts.join(", ");
}
