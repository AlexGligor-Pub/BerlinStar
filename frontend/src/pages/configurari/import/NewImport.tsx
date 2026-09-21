import { For, Show, createSignal, type Accessor } from "solid-js";
import {
  ImportConflictError, importApi, type ClientImportFormat, type ClientImportPreview, type ImportSession,
} from "../../../api/imports";
import { exportCSV } from "../shared";
import { ISSUE_BADGE, ISSUE_LABEL } from "./labels";
import ProgressBar, { createGuard } from "./ProgressBar";

/** Doua randuri de exemplu pentru modelul descarcabil: o persoana fizica si o firma. */
const TEMPLATE_ROWS: Record<string, string>[] = [
  { nume: "Popescu Ion", tip: "fizic", cui: "1850101123456", telefon: "0722123456", email: "ion.popescu@exemplu.ro", adresa: "Str. Florilor 10, Timișoara", numar_masina: "TM01ABC", comments: "Client fidel" },
  { nume: "Auto Service SRL", tip: "juridic", cui: "RO12345678", reprezentant: "Ionescu Maria", telefon: "0256123456, 0722000111", email: "office@autoservice.ro", adresa: "Calea Aradului 5, Timișoara", numar_masina: "#LIPSA" },
];

export default function NewImport(props: {
  format: Accessor<ClientImportFormat | undefined>;
  /** Importul a pornit: sesiunea e in procesare, panoul o deschide cu progresul. */
  onCreated: (session: ImportSession) => void;
  onOpenSession: (sessionId: number) => void;
}) {
  const [file, setFile] = createSignal<File | null>(null);
  const [preview, setPreview] = createSignal<ClientImportPreview | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal<ImportConflictError | null>(null);
  const [phase, setPhase] = createSignal<"check" | "import" | null>(null);
  // O singura operatiune o data: verificarea si importul nu pot porni de doua ori.
  const { busy, guard } = createGuard();
  let fileInput: HTMLInputElement | undefined;

  const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Operațiunea a eșuat.");

  async function check(f: File) {
    await guard(async () => {
      setPhase("check"); setError(null); setConflict(null); setPreview(null);
      try {
        setPreview(await importApi.previewClienti(f));
      } catch (e) {
        setError(message(e));
      } finally {
        setPhase(null);
      }
    });
  }

  async function startImport(force = false) {
    const f = file();
    if (!f) return;
    const session = await guard(async () => {
      setPhase("import"); setError(null); setConflict(null);
      try {
        return await importApi.importClienti(f, force);
      } catch (e) {
        if (e instanceof ImportConflictError) setConflict(e);
        else setError(message(e));
        return undefined;
      } finally {
        setPhase(null);
      }
    });
    if (session) props.onCreated(session);
  }

  function pickFile(f: File | null) {
    if (busy()) return;
    setFile(f);
    setPreview(null); setError(null); setConflict(null);
    if (f) void check(f);
  }

  function reset() {
    pickFile(null);
    if (fileInput) fileInput.value = "";
  }

  function downloadTemplate() {
    const cols = props.format()?.columns ?? [];
    exportCSV(
      "model_import_clienti",
      cols.map(c => c.key),
      TEMPLATE_ROWS.map(r => cols.map(c => r[c.key] ?? "")),
    );
  }

  return (
    <>
      <p class="cfg-hint">
        Adaugă clienți în masă dintr-un fișier CSV. Toți clienții importați intră <strong>doar în contul tău</strong>.
        Fișierul este mai întâi verificat. La import, rândurile corecte devin clienți, iar cele cu probleme
        ajung într-o <strong>listă de rezolvat</strong>, unde completezi ce lipsește sau le respingi.
      </p>

      <details class="import-format" open={!file()}>
        <summary>Formatul fișierului</summary>
        <Show when={props.format()} fallback={<p class="cfg-hint">Se încarcă...</p>}>
          {(fmt) => (
            <>
              <div class="import-actions" style={{ "margin-top": "10px" }}>
                <button class="btn btn-sm btn-ghost" onClick={downloadTemplate}>Descarcă model CSV</button>
              </div>
              <ul class="import-rules">
                <li>Fișier <strong>.csv</strong>, întreg, dintr-o singură bucată — fără limită de rânduri (până la {fmt().max_file_mb} MB).</li>
                <li><strong>Primul rând este antetul</strong> cu numele coloanelor. Ordinea coloanelor nu contează, iar coloanele necunoscute sunt ignorate.</li>
                <li>Separator: <code>;</code> sau <code>,</code> (se detectează automat). Codare: {fmt().encodings.join(" sau ")}, deci poți salva direct din Excel („Salvare ca → CSV").</li>
                <li>Numele coloanei poate fi scris și cu diacritice, majuscule sau cu una din variantele din tabel (ex. „Număr mașină", „nr inmatriculare").</li>
              </ul>

              <div class="data-table-wrap">
                <table class="data-table import-table">
                  <thead>
                    <tr><th>Coloană</th><th>Obligatoriu</th><th>Ce conține</th><th>Exemplu</th><th>Dacă lipsește</th></tr>
                  </thead>
                  <tbody>
                    <For each={fmt().columns}>
                      {(c) => (
                        <tr>
                          <td>
                            <code>{c.key}</code>
                            <Show when={c.aliases.length}>
                              <div class="import-aliases">sau: {c.aliases.join(", ")}</div>
                            </Show>
                          </td>
                          <td>{c.required ? <strong>Da</strong> : "Nu"}</td>
                          <td>{c.description}</td>
                          <td><Show when={c.example} fallback="—"><code>{c.example}</code></Show></td>
                          <td>{c.if_missing ?? "Rămâne gol."}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>

              <div class="import-callout">
                <strong>Rânduri cu probleme: ce se întâmplă cu ele</strong>
                <ul>
                  <li>
                    Dacă nu cunoști o valoare, lasă celula goală sau scrie explicit{" "}
                    <For each={fmt().missing_markers}>{(m, i) => <><code>{m}</code>{i() < fmt().missing_markers.length - 1 ? ", " : ""}</>}</For>.
                  </li>
                  <li>
                    Coloana <code>tip</code> este opțională: dacă lipsește (sau e goală), clientul este considerat
                    <strong> persoană fizică</strong>. Pentru firme scrie <code>juridic</code>.
                  </li>
                  <li>
                    La <code>telefon</code> poți pune mai multe numere, despărțite prin virgulă. Dacă fișierul folosește
                    virgula ca separator de coloane, câmpul trebuie pus între ghilimele (Excel face asta automat).
                  </li>
                  <li>
                    Rândurile cu <strong>date lipsă</strong> (nume), <strong>date invalide</strong> (ex. tip necunoscut,
                    CNP fără 13 cifre) sau care par <strong>duplicate</strong> (același CUI/CNP sau același nume și telefon)
                    <strong> nu se pierd</strong>: rămân în sesiunea de import, în lista de rezolvat.
                  </li>
                  <li>
                    Acolo, pentru fiecare rând (sau pentru mai multe deodată), <strong>completezi și imporți</strong> sau
                    <strong> respingi</strong>. Un rând respins poate fi readus oricând în listă.
                  </li>
                  <li>
                    Pentru valorile obligatorii lipsă sistemul propune o valoare-marcaj (ex. <code>{fmt().name_placeholder} (rând N)</code>).
                    Dacă imporți rândul fără să o corectezi, clientul primește în <em>Observații</em> eticheta{" "}
                    <code>{fmt().missing_tag} …</code>, ca să-l poți găsi și completa mai târziu.
                  </li>
                  <li>Toate importurile rămân în <strong>Istoric importuri</strong>, cu cine și când a importat sau a respins fiecare rând.</li>
                </ul>
              </div>
            </>
          )}
        </Show>
      </details>

      <div class="import-upload">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          disabled={busy()}
          onChange={e => pickFile(e.currentTarget.files?.[0] ?? null)}
        />
        <Show when={file()}>
          <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => void check(file()!)}>Verifică din nou</button>
        </Show>
      </div>

      <Show when={phase()}>
        <ProgressBar
          label={phase() === "check" ? "Se încarcă și se verifică fișierul..." : "Se încarcă fișierul și pornește importul..."}
          detail={file()?.name}
        />
      </Show>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      <Show when={conflict()}>
        {(c) => (
          <div class="import-callout">
            <strong>{c().message}</strong>
            <Show when={c().reason === "same_file"}>
              <p class="cfg-hint">Dacă îl imporți din nou, rândurile deja importate vor apărea ca posibile duplicate.</p>
            </Show>
            <div class="import-actions">
              <button class="btn btn-sm btn-primary" onClick={() => props.onOpenSession(c().sessionId)}>
                Deschide sesiunea #{c().sessionId}
              </button>
              <Show when={c().reason === "same_file"}>
                <button class="btn btn-sm btn-ghost" disabled={busy()} onClick={() => void startImport(true)}>Importă oricum</button>
              </Show>
            </div>
          </div>
        )}
      </Show>

      <Show when={preview()}>
        {(r) => (
          <div class="import-report">
            <div class="import-stats">
              <div><span>Rânduri în fișier</span><strong>{r().total_rows}</strong></div>
              <div><span>Se importă direct</span><strong>{r().to_import}</strong></div>
              <div classList={{ "import-stat--warn": r().to_review > 0 }}><span>Ajung în lista de rezolvat</span><strong>{r().to_review}</strong></div>
              <div><span>Date lipsă</span><strong>{r().missing}</strong></div>
              <div><span>Posibile duplicate</span><strong>{r().duplicates}</strong></div>
              <div classList={{ "import-stat--err": r().errors > 0 }}><span>Date invalide</span><strong>{r().errors}</strong></div>
            </div>

            <p class="cfg-hint">
              Coloane recunoscute: {r().columns_recognized.join(", ") || "—"}
              {" · "}separator „{r().delimiter === "\t" ? "TAB" : r().delimiter}" · {r().encoding}
            </p>
            <For each={r().file_warnings}>{(w) => <p class="cfg-hint cfg-hint--warn">{w}</p>}</For>

            <div class="import-actions">
              <button class="btn btn-primary" disabled={busy() || conflict() !== null} onClick={() => void startImport()}>
                {r().to_review > 0
                  ? `Importă ${r().to_import} clienți și pune ${r().to_review} rânduri în lista de rezolvat`
                  : `Importă ${r().to_import} clienți`}
              </button>
              <button class="btn btn-ghost" disabled={busy()} onClick={reset}>Anulează</button>
            </div>

            <Show when={r().issues.length > 0}>
              <h3 class="cfg-panel-title">Rânduri care vor ajunge în lista de rezolvat ({r().to_review})</h3>
              <div class="data-table-wrap import-scroll">
                <table class="data-table import-table">
                  <thead><tr><th>Rând</th><th>Problemă</th><th>Nume</th><th>Detalii</th></tr></thead>
                  <tbody>
                    <For each={r().issues}>
                      {(i) => (
                        <tr>
                          <td>{i.row}</td>
                          <td><span class={`badge ${ISSUE_BADGE[i.issue!]}`}>{ISSUE_LABEL[i.issue!]}</span></td>
                          <td>{i.values.nume ?? "—"}</td>
                          <td>{i.messages.join(" ")}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </>
  );
}
