import { For, Show, createSignal } from "solid-js";
import { readJsonSafe, parseApiError } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { notify } from "../../store/notificationsStore";
import { adminUpload } from "./admin-auth";

// ---------- Types ----------

interface PhaseEntry {
  name: string;
  status: "ok" | "error";
  counts: Record<string, number | string>;
}

interface Verification {
  companies: number;
  locations: number;
  employees: number;
  departments: number;
  categories: number;
  items: number;
  devices: number;
  clienti: number;
  receipts: number;
  vehicole: number;
  receipt_items: number;
  sum_total: string;
  // AutoElite profile extras (undefined for vulcanizarealex):
  dimensiuni_anvelope?: number;
  locuri_cazare?: number;
  cazari_anvelope?: number;
  cazare_anvelope_items?: number;
  programari?: number;
  client_vehicole?: number;
  fdl_receipts?: number;
  receipts_with_client?: number;
  receipts_with_vehicol_no_client?: number;
  marci_anvelope_proposed_by_account?: number;
  marci_anvelope_pending_by_account?: number;
}

interface ImportResult {
  account_id: number | null;
  username: string;
  phases: PhaseEntry[];
  verification: Verification | null;
  dry_run: boolean;
  inventory: Record<string, number>;
  duration_seconds: number;
}

type Profile = "vulcanizarealex" | "autoelite";

// Expected counts per profile. Used as the "Expected" column in the
// verification table. If a future dump has different volumes the table still
// renders the imported counts — the green ✓ just won't match.
const EXPECTED_BY_PROFILE: Record<Profile, Partial<Record<keyof Verification, number>>> = {
  vulcanizarealex: {
    companies: 2,
    locations: 2,
    employees: 26,
    departments: 5,
    categories: 20,
    items: 238,
    devices: 11,
    receipts: 38724,
    receipt_items: 158759,
  },
  // Bazat pe inventarul dump-ului AutoElite (work/AUTOELITE_IMPORT_PLAN.md)
  // si rularea reusita din 2026-05-27. receipts include FDL (source='fdl');
  // receipt_items include si itemii FDL. Phase 14 ataseaza un client (PF nou
  // sau cel existent matchuit pe placa) la fiecare receipt cu vehicol.
  autoelite: {
    companies: 2,
    locations: 1,
    employees: 12,
    departments: 13,
    categories: 40,
    items: 294,
    devices: 20,
    receipts: 6790, // 5617 normal + 1173 FDL
    receipt_items: 32890, // 20717 + 3737 + 3651 (FDL catalog) + 4785 (FDL manual)
    dimensiuni_anvelope: 121,
    locuri_cazare: 43,
    cazari_anvelope: 814,
    cazare_anvelope_items: 3210,
    programari: 84,
    fdl_receipts: 1173,
    client_vehicole: 3138, // ~316 din CheckInData + ~2822 noi din placi receipts
    receipts_with_client: 5861, // toate receipts cu vehicol → au si client
    receipts_with_vehicol_no_client: 0, // invariant: 0
  },
};

const PROFILE_DEFAULTS: Record<Profile, { username: string; password: string; account_name: string }> = {
  vulcanizarealex: { username: "vulcanizarealex", password: "vulcanizarealex", account_name: "Vulcanizare Alex" },
  autoelite:       { username: "autoelite",       password: "autoelite",       account_name: "Auto Elite" },
};

// ---------- Component ----------

export default function LegacyImportSection() {
  const [file, setFile] = createSignal<File | null>(null);
  const [profile, setProfile] = createSignal<Profile>("vulcanizarealex");
  const [username, setUsername] = createSignal(PROFILE_DEFAULTS.vulcanizarealex.username);
  const [password, setPassword] = createSignal(PROFILE_DEFAULTS.vulcanizarealex.password);
  const [accountName, setAccountName] = createSignal(PROFILE_DEFAULTS.vulcanizarealex.account_name);
  const [dryRun, setDryRun] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [result, setResult] = createSignal<ImportResult | null>(null);

  function changeProfile(p: Profile) {
    setProfile(p);
    const d = PROFILE_DEFAULTS[p];
    setUsername(d.username);
    setPassword(d.password);
    setAccountName(d.account_name);
  }

  let fileInput!: HTMLInputElement;

  function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    setFile(input.files?.[0] ?? null);
    setErr("");
  }

  // Profilul "autoelite" are dump pre-staged pe server — daca userul nu
  // upload-uieste nimic, backendul foloseste fisierul local default.
  const fileOptional = () => profile() === "autoelite";

  async function submit(e: Event) {
    e.preventDefault();
    setErr("");
    const f = file();
    if (!f && !fileOptional()) {
      setErr("Selecteaza un fisier .sql.");
      return;
    }
    if (!username().trim() || !password().trim() || !accountName().trim()) {
      setErr("Toate campurile sunt obligatorii.");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (f) {
        fd.append("dump", f);
      }
      fd.append("username", username().trim());
      fd.append("password", password());
      fd.append("account_name", accountName().trim());
      fd.append("dry_run", String(dryRun()));
      fd.append("profile", profile());

      const res = await adminUpload("/api/admin/legacy-import/import", fd);
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        const msg = parseApiError(d.detail) || `Eroare HTTP ${res.status}`;
        setErr(msg);
        notify(msg, "error");
        return;
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      notify(
        data.dry_run
          ? `Dry-run OK in ${data.duration_seconds}s`
          : `Import OK: account_id=${data.account_id} (${data.duration_seconds}s)`,
        "success",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare de retea";
      setErr(msg);
      notify(msg, "error");
    } finally {
      setRunning(false);
    }
  }

  function verifRows(v: Verification): { label: string; key: keyof Verification; got: number | string; expected?: number }[] {
    const E = EXPECTED_BY_PROFILE[profile()];
    const baseRows: { label: string; key: keyof Verification; got: number | string; expected?: number }[] = [
      { label: "Companies", key: "companies", got: v.companies, expected: E.companies },
      { label: "Locations", key: "locations", got: v.locations, expected: E.locations },
      { label: "Employees", key: "employees", got: v.employees, expected: E.employees },
      { label: "Departments", key: "departments", got: v.departments, expected: E.departments },
      { label: "Categories", key: "categories", got: v.categories, expected: E.categories },
      { label: "Items", key: "items", got: v.items, expected: E.items },
      { label: "Devices", key: "devices", got: v.devices, expected: E.devices },
      { label: "Clienti (toate)", key: "clienti", got: v.clienti },
      { label: "Receipts", key: "receipts", got: v.receipts, expected: E.receipts },
      { label: "Vehicole", key: "vehicole", got: v.vehicole },
      { label: "Receipt items", key: "receipt_items", got: v.receipt_items, expected: E.receipt_items },
      { label: "Sum total (RON)", key: "sum_total", got: v.sum_total },
    ];
    if (profile() === "autoelite") {
      baseRows.push(
        { label: "Dimensiuni anvelope", key: "dimensiuni_anvelope", got: v.dimensiuni_anvelope ?? 0, expected: E.dimensiuni_anvelope },
        { label: "Locuri cazare",       key: "locuri_cazare",       got: v.locuri_cazare ?? 0,       expected: E.locuri_cazare },
        { label: "Cazari anvelope",     key: "cazari_anvelope",     got: v.cazari_anvelope ?? 0,     expected: E.cazari_anvelope },
        { label: "Cazare items (buc.)", key: "cazare_anvelope_items", got: v.cazare_anvelope_items ?? 0, expected: E.cazare_anvelope_items },
        { label: "Client vehicole (hotel dropdown)", key: "client_vehicole", got: v.client_vehicole ?? 0, expected: E.client_vehicole },
        { label: "Programari",          key: "programari",          got: v.programari ?? 0,          expected: E.programari },
        { label: "FDL (Fise de Lucru)", key: "fdl_receipts",        got: v.fdl_receipts ?? 0,        expected: E.fdl_receipts },
        { label: "Receipts cu client (deviz+FDL)", key: "receipts_with_client", got: v.receipts_with_client ?? 0, expected: E.receipts_with_client },
        { label: "Receipts cu vehicol DAR fara client (trebuie 0)", key: "receipts_with_vehicol_no_client", got: v.receipts_with_vehicol_no_client ?? 0, expected: E.receipts_with_vehicol_no_client },
        { label: "Marci propuse total",  key: "marci_anvelope_proposed_by_account", got: v.marci_anvelope_proposed_by_account ?? 0 },
        { label: "Marci pending (in asteptarea aprobarii)", key: "marci_anvelope_pending_by_account", got: v.marci_anvelope_pending_by_account ?? 0 },
      );
    }
    return baseRows;
  }

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Import Legacy (SQL Server)</h2>
      </div>

      <p style="color:var(--text-muted);font-size:13px;margin:0 0 16px">
        Urca un dump SSMS din schema veche BerlinV3. Se creeaza un Account nou cu toate datele
        mapate (companies, locations, employees, items, receipts, etc). Encoding UTF-16 LE
        detectat automat si convertit la UTF-8.
      </p>

      {/* ---------- Formular ---------- */}
      <form onSubmit={submit} class="adminv2-form" style="max-width:520px;display:grid;gap:12px">

        <div>
          <label class="adminv2-form__label">Profil import</label>
          <select
            value={profile()}
            onChange={(e) => changeProfile(e.currentTarget.value as Profile)}
            disabled={running()}
            class="adminv2-form__input"
          >
            <option value="vulcanizarealex">Vulcanizare Alex (faze 0-5)</option>
            <option value="autoelite">Auto Elite (faze 0-14: + cazari, programari, FDL, link receipts→clients)</option>
          </select>
          <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0">
            Profilul AutoElite include in plus: SelledServiceManual, WheelDimensions,
            WherehouseLocation, WheelCompany (match global cu propunere), Vehicul (enrichment
            marca/model/vin/km), CheckInData → cazari anvelope (cu dedup placa-first si
            inlocuire nume junk cu placa/nume real), client_vehicole pentru dropdown Hotel,
            Programari, FDL (Fise de Lucru ca Receipt source='fdl'), si Phase 14 care leaga
            fiecare receipt (deviz + FDL) la un client matchuit dupa placa (fara duplicari).
          </p>
        </div>

        <div>
          <label class="adminv2-form__label">
            Fisier dump (.sql)
            <Show when={fileOptional()}>
              <span style="color:var(--text-muted);font-weight:normal;font-size:12px"> (optional pentru autoelite)</span>
            </Show>
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".sql,.txt"
            onChange={pickFile}
            disabled={running()}
            class="adminv2-form__input"
          />
          <Show when={file()}>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0">
              {file()!.name} ({(file()!.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          </Show>
          <Show when={fileOptional() && !file()}>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0;line-height:1.4">
              Daca nu uploadezi fisier, serverul foloseste dump-ul commited in repo la
              {" "}<code style="font-size:11px">Site/backup_db_berlin26.05.02026.sql</code>.
              Override via env var <code style="font-size:11px">AUTOELITE_DEFAULT_DUMP</code>.
            </p>
          </Show>
        </div>

        <div>
          <label class="adminv2-form__label">Username cont nou</label>
          <input
            type="text"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            disabled={running()}
            class="adminv2-form__input"
          />
        </div>

        <div>
          <label class="adminv2-form__label">Parola cont nou</label>
          <input
            type="text"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            disabled={running()}
            class="adminv2-form__input"
          />
        </div>

        <div>
          <label class="adminv2-form__label">Nume afisat (Account.name)</label>
          <input
            type="text"
            value={accountName()}
            onInput={(e) => setAccountName(e.currentTarget.value)}
            disabled={running()}
            class="adminv2-form__input"
          />
        </div>

        <label style="display:flex;gap:6px;align-items:center;font-size:14px">
          <input
            type="checkbox"
            checked={dryRun()}
            onChange={(e) => setDryRun(e.currentTarget.checked)}
            disabled={running()}
          />
          Dry-run (doar parsing, fara INSERT)
        </label>

        <Show when={err()}>
          <p style="color:var(--danger);font-size:13px;margin:0">{err()}</p>
        </Show>

        <div>
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            disabled={running() || (!file() && !fileOptional())}
          >
            {running() ? "Procesare ~ 1 minut..." : (dryRun() ? "Verifica (dry-run)" : "Porneste import")}
          </button>
          <Show when={running()}>
            <span style="margin-left:10px;color:var(--text-muted);font-size:13px">
              Nu inchide tab-ul. Importul dureaza ~30-60 secunde.
            </span>
          </Show>
        </div>
      </form>

      {/* ---------- Rezultat ---------- */}
      <Show when={result()}>
        {(r) => (
          <div style="margin-top:24px">
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
              <h3 style="margin:0;font-size:1.1rem">
                Raport {r().dry_run ? "(DRY-RUN)" : "Import"}
              </h3>
              <span style="color:var(--text-muted);font-size:13px">
                {r().duration_seconds}s
              </span>
            </div>

            <Show when={!r().dry_run && r().account_id != null}>
              <p style="margin:0 0 16px">
                Account creat: <strong>id={r().account_id}</strong> username=
                <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px">
                  {r().username}
                </code>
              </p>
            </Show>

            {/* Phases */}
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:18px">
              <div style="font-weight:600;margin-bottom:8px">Etape</div>
              <For each={r().phases}>
                {(p) => (
                  <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--border-light)">
                    <span style={`font-size:16px;color:${p.status === "ok" ? "var(--success)" : "var(--danger)"}`}>
                      {p.status === "ok" ? "✓" : "✗"}
                    </span>
                    <div style="flex:1">
                      <div style="font-weight:500">{p.name}</div>
                      <div style="color:var(--text-muted);font-size:12px;font-family:monospace">
                        {Object.entries(p.counts).map(([k, v]) => `${k}=${v}`).join("  ")}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Verification table */}
            <Show when={r().verification}>
              {(ver) => (
                <div>
                  <div style="font-weight:600;margin-bottom:8px">Verificare counts</div>
                  <div class="table-wrap">
                    <table class="adminv2-table" style="width:100%;border-collapse:collapse">
                      <thead>
                        <tr style="background:var(--surface-2);text-align:left">
                          <th style="padding:8px;border:1px solid var(--border)">Entitate</th>
                          <th style="padding:8px;border:1px solid var(--border);text-align:right">Asteptat</th>
                          <th style="padding:8px;border:1px solid var(--border);text-align:right">Importat</th>
                          <th style="padding:8px;border:1px solid var(--border);text-align:center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={verifRows(ver())}>
                          {(row) => {
                            const matches = row.expected == null ? null : Number(row.got) === row.expected;
                            return (
                              <tr>
                                <td style="padding:6px 8px;border:1px solid var(--border)">{row.label}</td>
                                <td style="padding:6px 8px;border:1px solid var(--border);text-align:right;font-family:monospace">
                                  {row.expected ?? "—"}
                                </td>
                                <td style="padding:6px 8px;border:1px solid var(--border);text-align:right;font-family:monospace">
                                  {row.got}
                                </td>
                                <td style="padding:6px 8px;border:1px solid var(--border);text-align:center">
                                  <Show
                                    when={matches !== null}
                                    fallback={<span style="color:var(--text-muted)">—</span>}
                                  >
                                    <span style={`color:${matches ? "var(--success)" : "var(--danger)"};font-weight:600`}>
                                      {matches ? "✓" : "✗"}
                                    </span>
                                  </Show>
                                </td>
                              </tr>
                            );
                          }}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Show>

            {/* Inventory din dump (informativ) */}
            <Show when={r().dry_run}>
              <div style="margin-top:18px">
                <div style="font-weight:600;margin-bottom:8px">Inventar dump</div>
                <div style="font-family:monospace;font-size:12px;background:var(--surface-2);padding:10px;border-radius:6px">
                  <For each={Object.entries(r().inventory).sort((a, b) => b[1] - a[1])}>
                    {([tbl, cnt]) => <div>{tbl}: {cnt}</div>}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
