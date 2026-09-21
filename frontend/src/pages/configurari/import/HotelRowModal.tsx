import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { Modal } from "../../../components/ui";
import { clientiApi } from "../../../api/clienti";
import {
  RowImportError, importApi, type HotelCandidate, type HotelRow, type HotelValues,
} from "../../../api/imports";
import { ISSUE_BADGE, ISSUE_LABEL } from "./labels";
import ProgressBar, { createGuard } from "./ProgressBar";

const TIP_LABEL = { iarna: "Iarnă", vara: "Vară", ms: "All season", altele: "—" } as const;

/** `input[type=date]` accepta doar AAAA-LL-ZZ; orice altceva l-ar afisa gol, fara
 *  sa se vada ca fisierul avea totusi o data. */
const isoDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

/**
 * Rezolvarea unei cazari din import: alegi clientul (unul propus, altul cautat
 * sau unul nou), corectezi data / locul si imporți — sau respingi cazarea.
 */
export default function HotelRowModal(props: {
  sessionId: number;
  row: HotelRow;
  onClose: () => void;
  onChanged: (row: HotelRow | null) => void;
}) {
  // Modalul porneste de la o copie a randului; `row` tine versiunea de pe server.
  const initial = props.row; // eslint-disable-line solid/reactivity
  const sessionId = props.sessionId; // eslint-disable-line solid/reactivity
  const [row, setRow] = createSignal<HotelRow>(initial);
  const [values, setValues] = createSignal<HotelValues>({ ...initial.values });
  const [search, setSearch] = createSignal("");
  // Cautarea porneste dupa ce omul s-a oprit din tastat, nu la fiecare tasta.
  const [searchTerm, setSearchTerm] = createSignal("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const typeSearch = (v: string) => {
    setSearch(v);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setSearchTerm(v), 300);
  };
  onCleanup(() => clearTimeout(searchTimer));
  const [picked, setPicked] = createSignal<HotelCandidate[]>([]);
  const [forceDuplicate, setForceDuplicate] = createSignal(false);
  const [working, setWorking] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const { busy, guard } = createGuard();

  const set = <K extends keyof HotelValues>(key: K, v: HotelValues[K]) => setValues({ ...values(), [key]: v });
  const text = (v: string) => (v.trim() === "" ? null : v);

  // Cautare de client in tot contul, cand cel potrivit nu e printre cei propusi.
  const [results] = createResource(
    () => (searchTerm().trim().length >= 2 ? searchTerm().trim() : null),
    async (q) => (await clientiApi.list({ q, limit: 10 })).items.map(c => ({
      id: c.id, nume: c.nume, masini: c.numar_masina ? [c.numar_masina] : [],
    })),
  );

  const options = () => {
    const seen = new Set<number>();
    return [...(row().original.candidates ?? []), ...picked(), ...(results() ?? [])].filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  };

  function choose(c: HotelCandidate) {
    if (!picked().some(p => p.id === c.id)) setPicked([...picked(), c]);
    setValues({ ...values(), client_mode: "existing", client_id: c.id });
  }

  async function act(label: string, fn: () => Promise<HotelRow | null>): Promise<boolean> {
    const result = await guard(async () => {
      setWorking(label);
      setError(null);
      try {
        const updated = await fn();
        if (updated) { setRow(updated); setValues({ ...updated.values }); }
        return { ok: true, changed: updated };
      } catch (e) {
        const r = e instanceof RowImportError ? (e.row as HotelRow | null) : null;
        if (r) setRow(r);
        setError(e instanceof Error ? e.message : "Operațiunea a eșuat.");
        return { ok: false, changed: r };
      } finally {
        setWorking(null);
      }
    });
    if (!result) return false;
    props.onChanged(result.changed);
    return result.ok;
  }

  async function save() {
    const id = row().id, vals = values();
    await act("Se salvează...", () => importApi.saveRow<HotelRow>(sessionId, id, vals));
  }

  async function saveAndImport() {
    const id = row().id, body = { values: values(), force_duplicate: forceDuplicate() };
    if (await act("Se importă cazarea...", () => importApi.importRow<HotelRow>(sessionId, id, body))) props.onClose();
  }

  async function reject() {
    const id = row().id;
    const ok = await act("Se respinge cazarea...", async () => {
      await importApi.rejectRows(sessionId, { row_ids: [id] });
      return null;
    });
    if (ok) props.onClose();
  }

  const o = () => row().original;

  return (
    <Modal
      open
      size="lg"
      title={<>Cazarea {o().numar_masina} · rândurile {o().randuri[0]}–{o().randuri[o().randuri.length - 1]}</>}
      onClose={() => { if (!busy()) props.onClose(); }}
      closeDisabled={busy()}
      footer={
        <div class="import-modal-footer">
          <button class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void reject()}>Respinge cazarea</button>
          <span style={{ flex: 1 }} />
          <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={props.onClose}>Închide</button>
          <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => void save()}>Salvează</button>
          <button class="btn btn-sm btn-primary" disabled={busy()} onClick={() => void saveAndImport()}>Salvează și importă</button>
        </div>
      }
    >
      <div class="import-row-editor">
        <Show when={row().issue}>
          {(issue) => (
            <div class={`import-row-issue import-row-issue--${issue() === "name_match" || issue() === "new_client" ? "missing" : issue() === "ambiguous" ? "error" : issue()}`}>
              <span class={`badge ${ISSUE_BADGE[issue()]}`}>{ISSUE_LABEL[issue()]}</span>
              <ul><For each={row().messages}>{(m) => <li>{m}</li>}</For></ul>
            </div>
          )}
        </Show>
        <p class="cfg-hint">
          În fișier: <strong>{[o().nume, o().prenume].filter(Boolean).join(" ") || "fără nume"}</strong>
          {" · "}{o().numar_masina}{" · "}{o().data ?? "fără dată"}{" · "}{o().depozit ?? "fără loc"}
        </p>

        <fieldset class="import-fieldset">
          <legend>Client</legend>
          <div class="import-actions">
            <label class="cfg-checkbox-row">
              <input type="radio" name="client_mode" checked={values().client_mode === "existing"}
                onChange={() => set("client_mode", "existing")} />
              Client existent
            </label>
            <label class="cfg-checkbox-row">
              <input type="radio" name="client_mode" checked={values().client_mode === "new"}
                onChange={() => setValues({ ...values(), client_mode: "new", client_id: null })} />
              Client nou
            </label>
          </div>

          <Show when={values().client_mode !== "new"}>
            <input class="input" placeholder="Caută alt client după nume sau CUI (min. 2 caractere)..."
              value={search()} onInput={e => typeSearch(e.currentTarget.value)} />
            <Show when={results.loading}><span class="cfg-hint">Se caută...</span></Show>
            <div class="import-candidates">
              <For each={options()} fallback={<p class="cfg-hint">Niciun client propus. Caută unul sau alege „Client nou”.</p>}>
                {(c) => (
                  <label class="import-candidate" classList={{ "import-candidate--active": values().client_id === c.id }}>
                    <input type="radio" name="client_id" checked={values().client_id === c.id} onChange={() => choose(c)} />
                    <span><strong>{c.nume}</strong>
                      <Show when={c.masini.length}><span class="import-aliases"> · {c.masini.join(", ")}</span></Show>
                    </span>
                  </label>
                )}
              </For>
            </div>
          </Show>

          <Show when={values().client_mode === "new"}>
            <div class="import-row-fields">
              <label><span>Nume client</span>
                <input class="input" value={values().client_nume ?? ""} placeholder="Nume și prenume"
                  onInput={e => set("client_nume", text(e.currentTarget.value))} />
              </label>
              <label><span>Telefon</span>
                <input class="input" value={values().client_telefon ?? ""} placeholder="Opțional"
                  onInput={e => set("client_telefon", text(e.currentTarget.value))} />
              </label>
            </div>
          </Show>
        </fieldset>

        <fieldset class="import-fieldset">
          <legend>Cazare</legend>
          <div class="import-row-fields">
            <label><span>Nr. mașină *</span>
              <input class="input" value={values().numar_masina ?? ""} onInput={e => set("numar_masina", text(e.currentTarget.value))} />
            </label>
            <label><span>Data depozitării *</span>
              <input class="input" type="date" value={isoDate(values().data_checkin)} onInput={e => set("data_checkin", text(e.currentTarget.value))} />
              <Show when={!isoDate(values().data_checkin) && (o().data || values().data_checkin)}>
                <small class="import-aliases">În fișier: {o().data ?? values().data_checkin} (format nerecunoscut)</small>
              </Show>
            </label>
            <label><span>Loc în depozit</span>
              <input class="input" value={values().loc ?? ""} onInput={e => set("loc", text(e.currentTarget.value))} />
            </label>
          </div>
        </fieldset>

        <div class="data-table-wrap">
          <table class="data-table import-table">
            <thead><tr><th>Rând</th><th>Dimensiune</th><th>Marca</th><th>Profil</th><th>DOT</th><th>Adâncime</th><th>Tip</th><th>Sarcină / viteză</th></tr></thead>
            <tbody>
              <For each={o().anvelope}>
                {(a) => (
                  <tr>
                    <td>{a.rand}</td><td>{a.dimensiune ?? "—"}</td><td>{a.marca ?? "—"}</td><td>{a.profil ?? "—"}</td>
                    <td>{a.dot ?? "—"}</td><td>{a.adancime ?? "—"}</td><td>{TIP_LABEL[a.tip]}</td>
                    <td>{[a.sarcina, a.viteza].filter(v => v !== null && v !== undefined).join(" ") || "—"}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={row().issue === "duplicate"}>
          <label class="cfg-checkbox-row">
            <input type="checkbox" checked={forceDuplicate()} onChange={e => setForceDuplicate(e.currentTarget.checked)} />
            Este altă cazare — importă-o chiar dacă pare să existe deja
          </label>
        </Show>

        <Show when={working()}><ProgressBar label={working()!} /></Show>
        <Show when={error()}><p class="cfg-error">{error()}</p></Show>
      </div>
    </Modal>
  );
}
