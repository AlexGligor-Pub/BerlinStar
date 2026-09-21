import { For, Show, createMemo, createResource, createSignal, type Accessor } from "solid-js";
import {
  ImportConflictError, importApi, type HotelImportFormat, type HotelImportPreview, type ImportIssue, type ImportSession,
} from "../../../api/imports";
import { locationsApi } from "../../../api/locations";
import { device } from "../../../store/deviceStore";
import { ISSUE_BADGE, ISSUE_LABEL } from "./labels";
import ProgressBar, { createGuard } from "./ProgressBar";

const ISSUE_ORDER: ImportIssue[] = ["new_client", "name_match", "ambiguous", "duplicate", "error"];

export default function NewHotelImport(props: {
  format: Accessor<HotelImportFormat | undefined>;
  onCreated: (session: ImportSession) => void;
  onOpenSession: (sessionId: number) => void;
}) {
  const [file, setFile] = createSignal<File | null>(null);
  const [preview, setPreview] = createSignal<HotelImportPreview | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal<ImportConflictError | null>(null);
  const [phase, setPhase] = createSignal<"check" | "import" | null>(null);
  const { busy, guard } = createGuard();
  let fileInput: HTMLInputElement | undefined;

  // Punctul de lucru al cazarilor. Pagina Hotel arata doar cazarile locatiei
  // statiei curente, deci o cazare fara locatie n-ar fi vizibila nicaieri.
  // Fara lista (retea, server), importul merge mai departe: serverul alege
  // singur locatia cand contul are una singura si cere alegerea altfel. O
  // resursa in eroare ar arunca la citire si ar dobori tot panoul.
  const [locations] = createResource(async () =>
    (await locationsApi.list({ limit: 200 }).catch(() => ({ items: [] }))).items);
  const [chosenLocation, setChosenLocation] = createSignal<number | null>(null);
  // Implicit: locatia statiei de la care se face importul; daca nu e inregistrata,
  // prima din lista. Contul cu o singura locatie nu are ce alege.
  const locationId = createMemo(() => {
    const list = locations() ?? [];
    const picked = chosenLocation();
    if (picked !== null && list.some(l => l.id === picked)) return picked;
    const dev = device()?.locationId ?? null;
    if (dev !== null && list.some(l => l.id === dev)) return dev;
    return list.length ? list[0].id : null;
  });

  const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Operațiunea a eșuat.");

  async function check(f: File) {
    await guard(async () => {
      setPhase("check"); setError(null); setConflict(null); setPreview(null);
      try {
        setPreview(await importApi.previewHotel(f));
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
        return await importApi.importHotel(f, force, locationId());
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

  return (
    <>
      <p class="cfg-hint">
        Importă anvelopele depozitate dintr-un fișier <strong>Excel (.xlsx)</strong> sau CSV, întreg, dintr-o singură bucată.
        Fiecare linie e o anvelopă; liniile cu același client, aceeași mașină și aceeași dată formează o <strong>cazare</strong>.
        Fișierul e mai întâi verificat — nimic nu se salvează până nu pornești importul.
      </p>

      <details class="import-format" open={!file()}>
        <summary>Formatul fișierului și cum se potrivesc clienții</summary>
        <Show when={props.format()} fallback={<p class="cfg-hint">Se încarcă...</p>}>
          {(fmt) => (
            <>
              <ul class="import-rules">
                <li>Primul rând e antetul. Coloanele obligatorii: <strong>Nr. mașină</strong> și <strong>Depozitate</strong> (data).</li>
                <li>Clientul se caută <strong>întâi după numărul de mașină</strong> (garajul și fișa clientului), apoi după <strong>nume și prenume</strong>.</li>
                <li>Numărul găsit la un singur client → cazarea se importă direct. Numărul lipsă dar numele găsit → <em>Potrivit după nume</em>, confirmi.
                  Mai mulți clienți posibili → <em>Client ambiguu</em>, alegi. Niciun client → <em>Client nou</em>, se creează la import.</li>
                <li>Locul din depozit devine loc de cazare; dimensiunea, profilul și DOT-ul se adaugă în nomenclatoare dacă lipsesc.
                  O marcă nouă se propune spre aprobarea platformei și se pune pe anvelope (apare în liste după aprobare).</li>
                <li>Importul poate fi <strong>anulat</strong> ulterior din sesiune: se șterge tot ce a creat, dar se păstrează ce a fost folosit între timp.</li>
              </ul>
              <div class="data-table-wrap">
                <table class="data-table import-table">
                  <thead><tr><th>Coloană</th><th>Obligatoriu</th><th>Ce conține</th></tr></thead>
                  <tbody>
                    <For each={fmt().columns}>
                      {(c) => (
                        <tr>
                          <td>
                            {c.label}
                            <Show when={c.aliases.length}><div class="import-aliases">sau: {c.aliases.join(", ")}</div></Show>
                          </td>
                          <td>{c.required ? <strong>Da</strong> : "Nu"}</td>
                          <td>{c.description}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Show>
      </details>

      <Show when={(locations() ?? []).length > 1}>
        <label class="import-location">
          <span>Punct de lucru</span>
          <select class="input" disabled={busy()} value={String(locationId() ?? "")}
            onChange={e => setChosenLocation(Number(e.currentTarget.value))}>
            <For each={locations()}>{(l) => <option value={l.id}>{l.name}</option>}</For>
          </select>
          <small class="cfg-hint">Cazările importate intră pe acest punct de lucru și acolo se vor vedea în pagina Hotel.</small>
        </label>
      </Show>

      <div class="import-upload">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
              <p class="cfg-hint">Dacă îl imporți din nou, cazările deja importate vor apărea ca posibile duplicate.</p>
            </Show>
            <div class="import-actions">
              <button class="btn btn-sm btn-primary" onClick={() => props.onOpenSession(c().sessionId)}>Deschide sesiunea #{c().sessionId}</button>
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
              <div><span>Linii (anvelope)</span><strong>{r().lines.toLocaleString("ro-RO")}</strong></div>
              <div><span>Cazări</span><strong>{r().cazari.toLocaleString("ro-RO")}</strong></div>
              <div><span>Se importă direct</span><strong>{r().to_import}</strong></div>
              <div classList={{ "import-stat--warn": r().to_review > 0 }}><span>De rezolvat</span><strong>{r().to_review}</strong></div>
              <For each={ISSUE_ORDER.filter(i => (r().issues_by_type[i] ?? 0) > 0)}>
                {(i) => <div><span>{ISSUE_LABEL[i]}</span><strong>{r().issues_by_type[i]}</strong></div>}
              </For>
            </div>
            <p class="cfg-hint">
              Foaia „{r().sheet ?? r().format}” · coloane recunoscute: {r().columns_recognized.join(", ")}
            </p>
            <For each={r().file_warnings}>{(w) => <p class="cfg-hint cfg-hint--warn">{w}</p>}</For>
            <Show when={r().new_locations.length > 0}>
              <p class="cfg-hint">Locuri de cazare noi ({r().new_locations.length}): {r().new_locations.join(", ")}</p>
            </Show>
            <Show when={r().new_brands.length > 0}>
              <p class="cfg-hint">
                Mărci noi ({r().new_brands.length}) — se propun spre aprobare și se pun pe anvelope; apar în
                listele de mărci după ce platforma le aprobă:{" "}
                {r().new_brands.slice(0, 20).map(([b, n]) => `${b} (${n})`).join(", ")}
                {r().new_brands.length > 20 ? "…" : ""}
              </p>
            </Show>

            <div class="import-actions">
              <button class="btn btn-primary" disabled={busy() || conflict() !== null} onClick={() => void startImport()}>
                {r().to_review > 0
                  ? `Importă ${r().to_import} cazări și pune ${r().to_review} în lista de rezolvat`
                  : `Importă ${r().to_import} cazări`}
              </button>
              <button class="btn btn-ghost" disabled={busy()} onClick={reset}>Anulează</button>
            </div>

            <Show when={r().issues.length > 0}>
              <h3 class="cfg-panel-title">Cazări de rezolvat ({r().to_review})</h3>
              <div class="data-table-wrap import-scroll">
                <table class="data-table import-table">
                  <thead><tr><th>Rând</th><th>Problemă</th><th>Nr. mașină</th><th>Nume în fișier</th><th>Client propus</th><th>Data</th><th>Anvelope</th><th>Detalii</th></tr></thead>
                  <tbody>
                    <For each={r().issues}>
                      {(i) => (
                        <tr>
                          <td>{i.row}</td>
                          <td><span class={`badge ${ISSUE_BADGE[i.issue]}`}>{ISSUE_LABEL[i.issue]}</span></td>
                          <td>{i.numar_masina}</td>
                          <td>{i.nume_fisier ?? "—"}</td>
                          <td>{i.client ?? (i.candidates.length ? `${i.candidates.length} posibili` : "—")}</td>
                          <td>{i.data ?? "—"}</td>
                          <td>{i.anvelope}</td>
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
