import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { login } from "../store/authStore";
import { API_BASE } from "../utils/api";
import ThemeToggle from "../components/ThemeToggle";
import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();

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
  const [regPassword, setRegPassword] = createSignal("");
  const [regPassword2, setRegPassword2] = createSignal("");
  const [regSuccess, setRegSuccess] = createSignal("");

  function switchMode(m: "login" | "register") {
    setError("");
    setRegSuccess("");
    setMode(m);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username().trim(), password: password() }),
      });

      if (res.ok) {
        const data = await res.json();
        login(username().trim(), data.access_token, data.is_locked ?? false, data.locked_at ?? null);
        navigate("/");
      } else {
        setError("Utilizator sau parola incorecta.");
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
    if (regPassword() !== regPassword2()) {
      setError("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName().trim(),
          username: regUsername().trim(),
          email: regEmail().trim(),
          password: regPassword(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegSuccess("Contul a fost creat cu succes! Vei avea acces timp de 7 zile. Vei fi redirectionat la login...");
        setRegName(""); setRegUsername(""); setRegEmail(""); setRegPassword(""); setRegPassword2("");
        setTimeout(() => switchMode("login"), 3000);
      } else {
        setError(data.detail ?? "Eroare la creare cont.");
      }
    } catch {
      setError("Serverul nu raspunde. Incearca din nou.");
    }
    setLoading(false);
  }

  return (
    <div class="login-page">
      <div style="position:fixed;top:12px;right:12px">
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
            <div class="form-group">
              <label class="form-label" for="reg-password">Parola</label>
              <input
                id="reg-password"
                class="input"
                type="password"
                placeholder="minim 6 caractere"
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
    </div>
  );
}
