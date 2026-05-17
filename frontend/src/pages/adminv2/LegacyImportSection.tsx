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

// Expected counts for Vulcanizare Alex DEVA dump. Used as the "Expected"
// column in the verification table. If a future dump has different volumes,
// the table still renders the imported counts — just the green ✓ won't match.
const EXPECTED_DEFAULTS: Partial<Record<keyof Verification, number>> = {
  companies: 2,
  locations: 2,
  employees: 26,
  departments: 5,
  categories: 20,
  items: 238,
  devices: 11,
  receipts: 38724,
  receipt_items: 158759,
};

// ---------- Component ----------

export default function LegacyImportSection() {
  const [file, setFile] = createSignal<File | null>(null);
  const [username, setUsername] = createSignal("vulcanizarealex");
  const [password, setPassword] = createSignal("vulcanizarealex");
  const [accountName, setAccountName] = createSignal("Vulcanizare Alex");
  const [dryRun, setDryRun] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [result, setResult] = createSignal<ImportResult | null>(null);

  let fileInput!: HTMLInputElement;

  function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    setFile(input.files?.[0] ?? null);
    setErr("");
  }

  async function submit(e: Event) {
    e.preventDefault();
    setErr("");
    const f = file();
    if (!f) {
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
      fd.append("dump", f);
      fd.append("username", username().trim());
      fd.append("password", password());
      fd.append("account_name", accountName().trim());
      fd.append("dry_run", String(dryRun()));

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
    return [
      { label: "Companies", key: "companies", got: v.companies, expected: EXPECTED_DEFAULTS.companies },
      { label: "Locations", key: "locations", got: v.locations, expected: EXPECTED_DEFAULTS.locations },
      { label: "Employees", key: "employees", got: v.employees, expected: EXPECTED_DEFAULTS.employees },
      { label: "Departments", key: "departments", got: v.departments, expected: EXPECTED_DEFAULTS.departments },
      { label: "Categories", key: "categories", got: v.categories, expected: EXPECTED_DEFAULTS.categories },
      { label: "Items", key: "items", got: v.items, expected: EXPECTED_DEFAULTS.items },
      { label: "Devices", key: "devices", got: v.devices, expected: EXPECTED_DEFAULTS.devices },
      { label: "Clienti B2B", key: "clienti", got: v.clienti },
      { label: "Receipts", key: "receipts", got: v.receipts, expected: EXPECTED_DEFAULTS.receipts },
      { label: "Vehicole", key: "vehicole", got: v.vehicole },
      { label: "Receipt items", key: "receipt_items", got: v.receipt_items, expected: EXPECTED_DEFAULTS.receipt_items },
      { label: "Sum total (RON)", key: "sum_total", got: v.sum_total },
    ];
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
          <label class="adminv2-form__label">Fisier dump (.sql)</label>
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
            disabled={running() || !file()}
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
