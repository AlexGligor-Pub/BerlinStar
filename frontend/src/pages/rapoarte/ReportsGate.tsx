import { Show, createSignal, onMount, onCleanup, type JSX } from "solid-js";
import logo from "../../assets/logo.png";
import { apiFetch, readJsonSafe } from "../../utils/api";
import type { ApiMessageBody } from "../../types";
import { getReportsToken, hasValidReportsToken, setReportsToken } from "./reports-auth";

/**
 * Gate de parola pentru pagina Rapoarte. Pana cand utilizatorul nu introduce
 * parola configurata pentru Rapoarte, copiii nu sunt randati (deci niciun
 * apel API de raport nu se executa).
 *
 * Token-ul are TTL 1h; cand expira, ascundem din nou continutul si redam
 * ecranul de parola.
 */
export default function ReportsGate(props: {
  children: JSX.Element;
  title?: string;
  passwordLabel?: string;
  unlockLabel?: string;
  notSetMsg?: string;
  lockTitle?: string;
}) {
  const title = () => props.title ?? "Rapoarte";
  const passwordLabel = () => props.passwordLabel ?? "Parola Rapoarte";
  const unlockLabel = () => props.unlockLabel ?? "Deblochează Rapoartele";
  const notSetMsg = () => props.notSetMsg ?? 'Parola pentru Rapoarte nu este inca setata. Configureaz-o din Configurări → „Contul Meu" → „Parola Rapoarte".';
  const lockTitle = () => props.lockTitle ?? "Închide accesul la Rapoarte (cere parola din nou)";
  const [verified, setVerified] = createSignal(hasValidReportsToken());
  const [password, setPassword] = createSignal("");
  const [err, setErr] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [hasPwd, setHasPwd] = createSignal<boolean | null>(null);

  async function loadStatus() {
    try {
      const res = await apiFetch("/api/auth/reports/status");
      if (!res.ok) return;
      const d = await readJsonSafe<{ has_password: boolean }>(res);
      setHasPwd(!!d.has_password);
    } catch {
      // network — lasam UI-ul sa incerce direct verify
    }
  }

  // Verificam periodic daca token-ul a expirat (TTL 1h). Daca da, comutam
  // inapoi pe ecranul de parola. Verificam si la `visibilitychange` pentru a
  // reflecta expirarea imediat ce userul revine pe tab.
  function checkExpiry() {
    if (verified() && !getReportsToken()) {
      setVerified(false);
      setErr("Sesiunea pentru Rapoarte a expirat. Reintrodu parola.");
    }
  }

  onMount(() => {
    void loadStatus();
    const id = setInterval(checkExpiry, 60_000);
    const visHandler = () => checkExpiry();
    const lockedHandler = () => {
      setVerified(false);
      setErr("Sesiunea pentru Rapoarte a expirat. Reintrodu parola.");
    };
    document.addEventListener("visibilitychange", visHandler);
    window.addEventListener("bs:reports-locked", lockedHandler as EventListener);
    onCleanup(() => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visHandler);
      window.removeEventListener("bs:reports-locked", lockedHandler as EventListener);
    });
  });

  async function doSubmit(e: Event) {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/reports/verify", {
        method: "POST",
        body: JSON.stringify({ password: password() }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        if (res.status === 409) {
          setErr(d.detail ?? "Parola nu este setata. Configureaz-o din AdminV2 -> Contul Meu.");
        } else {
          setErr(d.detail ?? "Parola incorecta.");
        }
        return;
      }
      const d = await readJsonSafe<{ access_token?: string; expires_in?: number }>(res);
      if (d.access_token) {
        setReportsToken(d.access_token, d.expires_in);
        setPassword("");
        setVerified(true);
      }
    } catch {
      setErr("Eroare de conexiune.");
    } finally {
      setSubmitting(false);
    }
  }

  function doLock() {
    setReportsToken(null);
    setVerified(false);
  }

  return (
    <Show
      when={verified()}
      fallback={
        <div class="login-page">
          <div class="login-card">
            <img src={logo} alt="Berlin Star" class="login-logo" />
            <div class="login-subtitle">{title()}</div>
            <div class="login-powered">Acces protejat — introdu parola</div>

            <Show when={err()}>
              <div class="login-error">{err()}</div>
            </Show>

            <Show when={hasPwd() === false}>
              <div class="login-error" style="background:#f59e0b;color:#fff">
                {notSetMsg()}
              </div>
            </Show>

            <form onSubmit={doSubmit} autocomplete="off">
              <div class="form-group">
                <label class="form-label">{passwordLabel()}</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  disabled={hasPwd() === false}
                  autofocus
                />
              </div>
              <button
                class="btn btn-primary w-full mt-8"
                type="submit"
                disabled={submitting() || hasPwd() === false}
              >
                {submitting() ? "Se verifică..." : unlockLabel()}
              </button>
            </form>
            <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);text-align:center">
              Accesul rămâne valid 1 oră.
            </div>
          </div>
        </div>
      }
    >
      <div style="position:relative">
        <button
          class="btn btn-ghost btn-sm"
          style="position:absolute;top:8px;right:8px;z-index:10;font-size:0.78rem"
          onClick={doLock}
          title={lockTitle()}
        >
          🔒 Blochează
        </button>
        {props.children}
      </div>
    </Show>
  );
}
