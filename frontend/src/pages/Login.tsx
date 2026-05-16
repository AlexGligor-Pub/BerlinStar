import { createSignal, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { loginAndRedirect } from "../store/authStore";
import { apiFetch, readApiError } from "../utils/api";
import ThemeToggle from "../components/ThemeToggle";
import Modal from "../components/ui/Modal";
import logo from "../assets/logo.png";

export default function Login() {
  const [searchParams] = useSearchParams();

  function resolveLoginTarget(): string {
    const raw = searchParams.from;
    const from = Array.isArray(raw) ? raw[0] : raw;
    if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
      try { return decodeURIComponent(from); } catch { return from; }
    }
    return "/";
  }

  // login
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // register
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [regName, setRegName] = createSignal("");
  const [regUsername, setRegUsername] = createSignal("");
  const [regEmail, setRegEmail] = createSignal("");
  const [regCui, setRegCui] = createSignal("");
  const [regPhone, setRegPhone] = createSignal("");
  const [regPassword, setRegPassword] = createSignal("");
  const [regPassword2, setRegPassword2] = createSignal("");
  const [regSuccess, setRegSuccess] = createSignal("");

  // success modal
  const [showSuccessModal, setShowSuccessModal] = createSignal(false);
  const [successUsername, setSuccessUsername] = createSignal("");
  const [successPassword, setSuccessPassword] = createSignal("");
  const [showSuccessPassword, setShowSuccessPassword] = createSignal(false);

  function switchMode(m: "login" | "register") {
    setError("");
    setRegSuccess("");
    setMode(m);
  }

  function goToLoginFromSuccess() {
    setShowSuccessModal(false);
    setSuccessUsername("");
    setSuccessPassword("");
    setShowSuccessPassword(false);
    switchMode("login");
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        handleUnauthorized: false,
        body: JSON.stringify({ username: username().trim(), password: password() }),
      });

      if (res.ok) {
        const data = await res.json() as { access_token: string; is_locked?: boolean; locked_at?: string | null };
        loginAndRedirect(
          username().trim(),
          data.access_token,
          data.is_locked ?? false,
          data.locked_at ?? null,
          resolveLoginTarget(),
        );
        return;
      } else if (res.status === 401 || res.status === 403) {
        setError("Utilizator sau parola incorecta.");
      } else if (res.status === 429) {
        setError("Prea multe incercari. Reincearca in cateva minute.");
      } else if (res.status >= 500) {
        setError("Server indisponibil. Incearca din nou.");
      } else {
        const msg = await readApiError(res, "Eroare la autentificare.");
        setError(msg);
      }
    } catch {
      setError("Serverul nu raspunde. Incearca din nou.");
    }

    setLoading(false);
  }

  async function handleRegister(e: Event) {
    e.preventDefault();
    setError("");
    setRegSuccess("");
    if (!regEmail().trim()) {
      setError("Emailul este obligatoriu.");
      return;
    }
    const cuiDigits = regCui().replace(/\D/g, "");
    if (!cuiDigits) {
      setError("CUI Firma este obligatoriu.");
      return;
    }
    if (!regPhone().trim()) {
      setError("Numarul de telefon este obligatoriu.");
      return;
    }
    if (regPassword() !== regPassword2()) {
      setError("Parolele nu coincid.");
      return;
    }
    if (regPassword().length < 10) {
      setError("Parola trebuie sa aiba minim 10 caractere.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        handleUnauthorized: false,
        body: JSON.stringify({
          name: regName().trim(),
          username: regUsername().trim(),
          email: regEmail().trim(),
          password: regPassword(),
          cui_firma: parseInt(cuiDigits, 10),
          phone: regPhone().trim(),
        }),
      });
      if (res.ok) {
        setSuccessUsername(regUsername().trim());
        setSuccessPassword(regPassword());
        setShowSuccessPassword(false);
        setShowSuccessModal(true);
        setRegName(""); setRegUsername(""); setRegEmail(""); setRegCui(""); setRegPhone(""); setRegPassword(""); setRegPassword2("");
      } else if (res.status === 429) {
        setError("Prea multe incercari. Reincearca in cateva minute.");
      } else {
        const msg = await readApiError(res, "Eroare la creare cont.");
        setError(msg);
      }
    } catch {
      setError("Serverul nu raspunde. Incearca din nou.");
    }
    setLoading(false);
  }

  return (
    <div class="login-page">
      <div style="position:fixed;top:12px;right:12px;z-index:2">
        <ThemeToggle />
      </div>

      <a class="login-news-link" href="https://professorprime.ro/" target="_blank" rel="noopener noreferrer">
        Afla cele mai recente noutati pe professorprime.ro
      </a>

      <div class="login-card">
        <img src={logo} alt="Berlin Star" class="login-logo" />
        <div class="login-subtitle">Berlin Star</div>
        <div class="login-powered">Powered by Professor Prime S.R.L</div>

        {error() && <div class="login-error">{error()}</div>}
        {regSuccess() && <div class="login-success">{regSuccess()}</div>}

        <Show when={mode() === "login"}>
          <form onSubmit={handleSubmit} autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="username">Utilizator</label>
              <input
                id="username"
                class="input"
                type="text"
                placeholder="ex: admin"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                required
                autofocus
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="password">Parola</label>
              <input
                id="password"
                class="input"
                type="password"
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
              />
            </div>
            <button class="btn btn-primary w-full mt-8" type="submit" disabled={loading()}>
              {loading() ? "Se conecteaza..." : "Intra in sistem"}
            </button>
          </form>
          <button class="btn btn-ghost w-full" style="margin-top:16px" type="button" onClick={() => switchMode("register")}>
            Cont nou
          </button>
        </Show>

        <Show when={mode() === "register"}>
          <form onSubmit={handleRegister} autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="reg-name">Nume complet</label>
              <input
                id="reg-name"
                class="input"
                type="text"
                placeholder="ex: Ion Popescu"
                value={regName()}
                onInput={(e) => setRegName(e.currentTarget.value)}
                required
                autofocus
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-username">Utilizator</label>
              <input
                id="reg-username"
                class="input"
                type="text"
                placeholder="ex: ionpopescu"
                value={regUsername()}
                onInput={(e) => setRegUsername(e.currentTarget.value)}
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-email">Email</label>
              <input
                id="reg-email"
                class="input"
                type="email"
                placeholder="ex: ion@email.com"
                value={regEmail()}
                onInput={(e) => setRegEmail(e.currentTarget.value)}
                required
              />
            </div>
            <div class="login-form-row">
              <div class="form-group">
                <label class="form-label" for="reg-cui">CUI Firma</label>
                <input
                  id="reg-cui"
                  class="input"
                  type="text"
                  inputmode="numeric"
                  placeholder="ex: 12345678"
                  value={regCui()}
                  onInput={(e) => setRegCui(e.currentTarget.value)}
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-phone">Numar de telefon</label>
                <input
                  id="reg-phone"
                  class="input"
                  type="tel"
                  placeholder="ex: 0712345678"
                  value={regPhone()}
                  onInput={(e) => setRegPhone(e.currentTarget.value)}
                  required
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Parola</label>
              <input
                id="reg-password"
                class="input"
                type="password"
                placeholder="minim 10 caractere"
                value={regPassword()}
                onInput={(e) => setRegPassword(e.currentTarget.value)}
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password2">Confirma parola</label>
              <input
                id="reg-password2"
                class="input"
                type="password"
                placeholder="••••••••"
                value={regPassword2()}
                onInput={(e) => setRegPassword2(e.currentTarget.value)}
                required
              />
            </div>
            <button class="btn btn-primary w-full mt-8" type="submit" disabled={loading()}>
              {loading() ? "Se creează..." : "Finalizează"}
            </button>
          </form>
          <button class="btn btn-ghost w-full mt-4" type="button" onClick={() => switchMode("login")}>
            ← Inapoi la autentificare
          </button>
        </Show>
      </div>

      <Modal open={showSuccessModal()} closeOnEscape={false} ariaLabel="Cont creat cu succes">
        <div style="text-align:center;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:2.4rem;line-height:1">🎉</div>
          <div style="font-weight:600;font-size:1.1rem">Felicitari, contul a fost creat!</div>
          <div style="font-size:0.9rem;color:var(--text-muted)">
            Te poti autentifica folosind credentialele de mai jos. Pastreaza-le intr-un loc sigur.
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;text-align:left;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Utilizator</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.95rem;word-break:break-all">{successUsername()}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Parola</div>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.95rem;word-break:break-all;flex:1">
                  {showSuccessPassword() ? successPassword() : "•".repeat(Math.max(8, successPassword().length))}
                </div>
                <button
                  type="button"
                  class="btn btn-ghost"
                  style="padding:4px 10px;font-size:0.8rem"
                  onClick={() => setShowSuccessPassword(v => !v)}
                >
                  {showSuccessPassword() ? "Ascunde" : "Arata"}
                </button>
              </div>
            </div>
          </div>

          <button class="btn btn-primary w-full mt-4" type="button" onClick={goToLoginFromSuccess}>
            Mergi la autentificare
          </button>
        </div>
      </Modal>
    </div>
  );
}
