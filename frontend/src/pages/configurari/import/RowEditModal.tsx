import { For, Show, createSignal } from "solid-js";
import { Modal } from "../../../components/ui";
import {
  RowImportError, importApi, type ImportColumnSpec, type ImportRow, type RowValues,
} from "../../../api/imports";
import { ISSUE_BADGE, ISSUE_LABEL } from "./labels";
import ProgressBar, { createGuard } from "./ProgressBar";

const LONG_FIELDS = new Set(["adresa", "description", "comments"]);
const TIP_OPTIONS = ["fizic", "juridic"];

/**
 * Formularul unui rand din lista de rezolvat: utilizatorul completeaza ce
 * lipseste si importa, salveaza pentru mai tarziu, sau respinge randul.
 */
export default function RowEditModal(props: {
  sessionId: number;
  row: ImportRow;
  columns: ImportColumnSpec[];
  onClose: () => void;
  /** Randul s-a schimbat pe server (salvat, importat sau respins). */
  onChanged: (row: ImportRow | null) => void;
}) {
  // Modalul se deschide pentru un singur rand si porneste de la o copie a lui;
  // mai departe `row` tine versiunea intoarsa de server dupa fiecare actiune.
  const initial = props.row; // eslint-disable-line solid/reactivity
  const sessionId = props.sessionId; // eslint-disable-line solid/reactivity
  const [values, setValues] = createSignal<RowValues>({ ...initial.values });
  const [row, setRow] = createSignal<ImportRow>(initial);
  const [forceDuplicate, setForceDuplicate] = createSignal(false);
  // Salvează / Importă / Respinge: o singura cerere o data, oricate click-uri.
  const { busy, guard } = createGuard();
  const [working, setWorking] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const setField = (key: string, v: string) => setValues({ ...values(), [key]: v === "" ? null : v });
  const changed = (key: string) => (values()[key] ?? null) !== (row().original[key] ?? null);

  /** Intoarce true daca actiunea a reusit. */
  async function act(label: string, fn: () => Promise<ImportRow | null>): Promise<boolean> {
    const result = await guard(async () => {
      setWorking(label);
      setError(null);
      try {
        const updated = await fn();
        if (updated) setRow(updated);
        return { ok: true, changed: updated };
      } catch (e) {
        if (e instanceof RowImportError && e.row) setRow(e.row);
        setError(e instanceof Error ? e.message : "Operațiunea a eșuat.");
        return { ok: false, changed: e instanceof RowImportError ? e.row : null };
      } finally {
        setWorking(null);
      }
    });
    if (!result) return false; // alt click era deja in lucru
    props.onChanged(result.changed);
    return result.ok;
  }

  async function save() {
    const id = row().id, vals = values();
    await act("Se salvează...", () => importApi.saveRow(sessionId, id, vals));
  }

  async function saveAndImport() {
    const id = row().id, body = { values: values(), force_duplicate: forceDuplicate() };
    if (await act("Se importă clientul...", () => importApi.importRow(sessionId, id, body))) props.onClose();
  }

  async function reject() {
    const id = row().id;
    const ok = await act("Se respinge rândul...", async () => {
      await importApi.rejectRows(sessionId, { row_ids: [id] });
      return null;
    });
    if (ok) props.onClose();
  }

  return (
    <Modal
      open
      onClose={() => { if (!busy()) props.onClose(); }}
      closeDisabled={busy()}
      size="lg"
      title={<>Rândul {row().row} din fișier</>}
      footer={
        <div class="import-modal-footer">
          <button class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void reject()}>Respinge rândul</button>
          <span style={{ flex: 1 }} />
          <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={props.onClose}>Închide</button>
          <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => void save()}>Salvează</button>
          <button class="btn btn-sm btn-primary" disabled={busy()} onClick={() => void saveAndImport()}>
            Salvează și importă
          </button>
        </div>
      }
    >
      <div class="import-row-editor">
        <Show when={row().issue}>
          {(issue) => (
            <div class={`import-row-issue import-row-issue--${issue()}`}>
              <span class={`badge ${ISSUE_BADGE[issue()]}`}>{ISSUE_LABEL[issue()]}</span>
              <ul>
                <For each={row().messages}>{(m) => <li>{m}</li>}</For>
              </ul>
            </div>
          )}
        </Show>
        <Show when={!row().issue}>
          <p class="import-success">Rândul este complet și poate fi importat.</p>
        </Show>

        <div class="import-row-fields">
          <For each={props.columns}>
            {(c) => (
              <label classList={{ "import-row-field--wide": LONG_FIELDS.has(c.key) }}>
                <span>{c.label}{c.required ? " *" : ""}</span>
                <Show
                  when={c.key === "tip"}
                  fallback={
                    <Show
                      when={LONG_FIELDS.has(c.key)}
                      fallback={
                        <input
                          class="input"
                          value={values()[c.key] ?? ""}
                          placeholder={c.example || c.label}
                          onInput={e => setField(c.key, e.currentTarget.value)}
                        />
                      }
                    >
                      <textarea
                        class="cfg-textarea"
                        rows={2}
                        value={values()[c.key] ?? ""}
                        onInput={e => setField(c.key, e.currentTarget.value)}
                      />
                    </Show>
                  }
                >
                  <select class="input" value={values().tip ?? ""} onChange={e => setField("tip", e.currentTarget.value)}>
                    <option value="">— lipsă (implicit fizic) —</option>
                    <Show when={values().tip && !TIP_OPTIONS.includes(values().tip!)}>
                      <option value={values().tip!}>{values().tip} (din fișier, invalid)</option>
                    </Show>
                    <For each={TIP_OPTIONS}>{(t) => <option value={t}>{t}</option>}</For>
                  </select>
                </Show>
                <Show when={changed(c.key)}>
                  <small class="import-aliases">În fișier: {row().original[c.key] ?? "(gol)"}</small>
                </Show>
              </label>
            )}
          </For>
        </div>

        <Show when={row().issue === "duplicate"}>
          <label class="cfg-checkbox-row">
            <input type="checkbox" checked={forceDuplicate()} onChange={e => setForceDuplicate(e.currentTarget.checked)} />
            Este alt client — importă-l chiar dacă pare duplicat
          </label>
        </Show>

        <Show when={working()}><ProgressBar label={working()!} /></Show>
        <Show when={error()}><p class="cfg-error">{error()}</p></Show>
      </div>
    </Modal>
  );
}
