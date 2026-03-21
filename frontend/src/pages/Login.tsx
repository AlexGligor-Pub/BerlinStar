import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { login } from "../store/authStore";
import { API_BASE } from "../utils/api";
import ThemeToggle from "../components/ThemeToggle";
import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

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
        login(username().trim(), data.access_token);
        navigate("/");
      } else {
        setError("Utilizator sau parola incorecta.");
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
      </div>
    </div>
  );
}
