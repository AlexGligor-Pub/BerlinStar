import { Show, createSignal } from "solid-js";
import { readJsonSafe, parseApiError } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { notify } from "../../store/notificationsStore";
import { adminFetch } from "./admin-auth";

interface SeedResult {
  ok: boolean;
  username: string;
  password: string;
  duration_seconds: number;
  receipts: number;
  receipt_items: number;
  stock_movements: number;
  programari: number;
  cazari: number;
  clients: number;
}

interface DeleteResult {
  ok: boolean;
  existed: boolean;
  account_id: number | null;
  counts: Record<string, number>;
}

export default function DemoSeedSection() {
  const [running, setRunning] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [result, setResult] = createSignal<SeedResult | null>(null);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = createSignal(false);
  const [deleteResult, setDeleteResult] = createSignal<DeleteResult | null>(null);

  async function doDelete() {
    setErr("");
    setDeleteResult(null);
    setResult(null);
    setDeleting(true);
    setDeleteConfirmOpen(false);
    try {
      const res = await adminFetch("/api/admin/seed-demo", { method: "DELETE" });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        const msg = parseApiError(d.detail) || `Eroare HTTP ${res.status}`;
        setErr(msg);
        notify(msg, "error");
        return;
      }
      const data = (await res.json()) as DeleteResult;
      setDeleteResult(data);
      notify(
        data.existed ? "Cont demo sters complet" : "Contul demo nu exista",
        data.existed ? "success" : "info",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare de retea";
      setErr(msg);
      notify(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function doSeed() {
    setErr("");
    setResult(null);
    setRunning(true);
    setConfirmOpen(false);
    try {
      const res = await adminFetch("/api/admin/seed-demo", {
        method: "POST",
        // Niciun body — endpoint-ul nu primeste argumente
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        const msg = parseApiError(d.detail) || `Eroare HTTP ${res.status}`;
        setErr(msg);
        notify(msg, "error");
        return;
      }
      const data = (await res.json()) as SeedResult;
      setResult(data);
      notify(`Seed OK in ${data.duration_seconds}s (${data.receipts} devize)`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare de retea";
      setErr(msg);
      notify(msg, "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Demo Account Seeder</h2>
      </div>

      <div style="max-width:680px;display:grid;gap:16px">
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <h3 style="margin:0 0 8px;font-size:1rem">Ce face acest seeder?</h3>
          <p style="margin:0;color:var(--text-muted);font-size:13px;line-height:1.6">
            Creeaza un cont showroom complet ocupat cu activitate realista de
            vulcanizare + service auto + spalatorie, populat cu aproximativ
            <strong> 2 ani de date (1 mai 2024 → 18 mai 2026)</strong>:
          </p>
          <ul style="margin:8px 0 0;padding-left:20px;color:var(--text-muted);font-size:13px;line-height:1.7">
            <li>2 locatii (Centru &amp; Nord), cu 5 angajati fiecare (1 manager + 4 tehnicieni)</li>
            <li>6 divizii per locatie: Vulcanizare, Mecanica, Hotel Anvelope, Geometrie, Spalatorie Auto, Clima Auto</li>
            <li>~95 itemi in catalog (anvelope 10 marci × 15 dimensiuni, piese, servicii)</li>
            <li>~800 clienti (fizici &amp; juridici) cu masini</li>
            <li><strong>~30.000 devize</strong> cu sezonalitate (varfuri primavara/toamna, depresiuni iarna/vara)</li>
            <li>Inventar viu: stoc initial + re-aprovizionari lunare + iesiri</li>
            <li>Programari (trecute + cateva viitoare) si hotel anvelope cu cicluri vara↔iarna</li>
          </ul>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <h3 style="margin:0 0 8px;font-size:1rem">Credentiale cont demo</h3>
          <div style="font-family:monospace;font-size:13px;color:var(--text-muted)">
            Username: <strong style="color:var(--text)">ProfessorPrimeDemo</strong><br />
            Parola:   <strong style="color:var(--text)">ProfessorPrimeDemo</strong>
          </div>
        </div>

        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;color:#78350f;font-size:13px">
          <strong>Atentie:</strong> Daca contul <code>ProfessorPrimeDemo</code> exista deja,
          seederul va esua (HTTP 409). Pentru re-rulare, sterge-l manual din baza de date
          (incl. toate datele asociate). Operatia dureaza <strong>3-8 minute</strong> —
          nu inchide tab-ul in acest timp.
        </div>

        <Show when={err()}>
          <div style="color:var(--danger);font-size:13px;background:rgba(220,38,38,.08);padding:10px;border-radius:6px">
            {err()}
          </div>
        </Show>

        <div>
          <Show
            when={!confirmOpen()}
            fallback={
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:13px">Esti sigur?</span>
                <button class="btn btn-sm btn-primary" onClick={doSeed} disabled={running()}>
                  Da, porneste seed
                </button>
                <button class="btn btn-sm btn-ghost" onClick={() => setConfirmOpen(false)}>
                  Anuleaza
                </button>
              </div>
            }
          >
            <button
              class="btn btn-primary btn-sm"
              onClick={() => setConfirmOpen(true)}
              disabled={running()}
            >
              {running() ? "Generare in curs... (3-8 min)" : "Porneste demo seed"}
            </button>
            <Show when={running()}>
              <span style="margin-left:12px;color:var(--text-muted);font-size:13px">
                Genereaza ~30.000 devize. Astepti...
              </span>
            </Show>
          </Show>
        </div>

        <Show when={result()}>
          {(r) => (
            <div style="margin-top:8px;border:1px solid var(--success);border-radius:8px;padding:14px;background:rgba(34,197,94,.05)">
              <h3 style="margin:0 0 10px;font-size:1rem;color:var(--success)">
                ✓ Seed COMPLET in {r().duration_seconds}s
              </h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font-size:13px">
                <div><strong>{r().receipts.toLocaleString()}</strong> devize</div>
                <div><strong>{r().receipt_items.toLocaleString()}</strong> linii deviz</div>
                <div><strong>{r().stock_movements.toLocaleString()}</strong> miscari stoc</div>
                <div><strong>{r().programari.toLocaleString()}</strong> programari</div>
                <div><strong>{r().cazari.toLocaleString()}</strong> cazari hotel anvelope</div>
                <div><strong>{r().clients.toLocaleString()}</strong> clienti</div>
              </div>
              <p style="margin:10px 0 0;font-size:13px">
                Poti loga ca <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px">{r().username}</code>
                {" / "}
                <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px">{r().password}</code>
              </p>
            </div>
          )}
        </Show>

        {/* Zona de cleanup (sub seederul principal) */}
        <hr style="margin-top:24px;border:none;border-top:1px solid var(--border)" />

        <div style="background:rgba(220,38,38,.04);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:16px">
          <h3 style="margin:0 0 8px;font-size:1rem;color:var(--danger)">Zona Periculoasa</h3>
          <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px">
            Sterge complet contul <code>ProfessorPrimeDemo</code> impreuna cu toate datele
            asociate (devize, stocuri, programari, cazari, clienti, etc.). Util cand seederul
            a esuat partial sau vrei sa regenerezi datele.
          </p>

          <Show
            when={!deleteConfirmOpen()}
            fallback={
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:13px;color:var(--danger)"><strong>Sigur?</strong> Stergerea este ireversibila.</span>
                <button class="btn btn-sm" style="background:var(--danger);color:white" onClick={doDelete} disabled={deleting()}>
                  Da, sterge tot
                </button>
                <button class="btn btn-sm btn-ghost" onClick={() => setDeleteConfirmOpen(false)}>
                  Anuleaza
                </button>
              </div>
            }
          >
            <button
              class="btn btn-sm"
              style="background:var(--danger);color:white"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting() || running()}
            >
              {deleting() ? "Stergere in curs..." : "Sterge contul demo"}
            </button>
          </Show>

          <Show when={deleteResult()}>
            {(dr) => (
              <div style="margin-top:12px;font-size:13px">
                <Show
                  when={dr().existed}
                  fallback={<span style="color:var(--text-muted)">Contul demo nu exista in baza de date.</span>}
                >
                  <div style="color:var(--success);font-weight:600;margin-bottom:6px">
                    ✓ Cont sters (id={dr().account_id})
                  </div>
                  <details>
                    <summary style="cursor:pointer;color:var(--text-muted);font-size:12px">Detalii inregistrari sterse</summary>
                    <div style="font-family:monospace;font-size:11px;margin-top:6px;color:var(--text-muted)">
                      {Object.entries(dr().counts)
                        .filter(([_, v]) => v > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([tbl, n]) => <div>{tbl}: {n}</div>)
                      }
                    </div>
                  </details>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
