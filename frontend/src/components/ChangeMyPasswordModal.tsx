/**
 * Schimbarea propriei parole — disponibila TUTUROR rolurilor, din meniul din
 * NavBar.
 *
 * Formularul echivalent din Configurari → Contul Meu e in spatele resursei
 * `settings`, deci un `worker` nu ar avea de unde sa isi schimbe parola.
 * Endpointul (`POST /api/auth/change-password`) opereaza pe utilizatorul logat
 * si inchide celelalte sesiuni ale lui, pastrand-o pe cea curenta.
 */
import { Show, createSignal } from "solid-js";
import Modal from "./ui/Modal";
import { apiFetch, readApiError } from "../utils/api";
import { notify } from "../store/notificationsStore";

const PASSWORD_MIN = 10;

export default function ChangeMyPasswordModal(props: { open: boolean; onClose: () => void }) {
  const [oldPwd, setOldPwd] = createSignal("");
  const [newPwd, setNewPwd] = createSignal("");
  const [newPwd2, setNewPwd2] = createSignal("");
  const [err, setErr] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  function reset() {
    setOldPwd(""); setNewPwd(""); setNewPwd2(""); setErr("");
  }

  function close() {
    reset();
    props.onClose();
  }

  async function submit(e: Event) {
    e.preventDefault();
    setErr("");
    if (!oldPwd()) { setErr("Introdu parola curentă."); return; }
    if (newPwd().length < PASSWORD_MIN) { setErr(`Parola nouă trebuie să aibă minim ${PASSWORD_MIN} caractere.`); return; }
    if (newPwd() !== newPwd2()) { setErr("Parolele noi nu coincid."); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        // Un 401 aici inseamna „parola curenta greșita", nu sesiune expirata —
        // nu vrem sa fim deconectati din aplicatie.
        handleUnauthorized: false,
        body: JSON.stringify({ old_password: oldPwd(), new_password: newPwd() }),
      });
      if (!res.ok) {
        setErr(await readApiError(res, "Eroare la schimbarea parolei."));
        return;
      }
      const d = (await res.json()) as { message?: string };
      notify(d.message || "Parola a fost schimbată.", "success");
      close();
    } catch {
      setErr("Eroare de conexiune.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={props.open} onClose={close} title="Schimbă parola" size="sm">
      <form onSubmit={submit} autocomplete="off">
        <p style="margin:0 0 12px;font-size:13px;color:var(--text-muted)">
          Îți schimbi parola de autentificare. Vei rămâne conectat pe acest
          dispozitiv; celelalte sesiuni ale tale se închid.
        </p>
        <div class="form-group">
          <label class="form-label">Parola curentă</label>
          <input
            class="input"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            value={oldPwd()}
            onInput={(e) => setOldPwd(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label class="form-label">Parola nouă</label>
          <input
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder={`minim ${PASSWORD_MIN} caractere`}
            value={newPwd()}
            onInput={(e) => setNewPwd(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label class="form-label">Confirmă parola nouă</label>
          <input
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            value={newPwd2()}
            onInput={(e) => setNewPwd2(e.currentTarget.value)}
          />
        </div>
        <Show when={err()}>
          <div class="login-error" style="margin:8px 0">{err()}</div>
        </Show>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button type="button" class="btn btn-ghost btn-sm" onClick={close}>Anulează</button>
          <button type="submit" class="btn btn-primary btn-sm" disabled={saving()}>
            {saving() ? "Se salvează…" : "Schimbă parola"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
