import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { login } from "../store/authStore";
import ThemeToggle from "../components/ThemeToggle";

// Credentiale demo — in Faza 2 vor fi verificate prin API
const DEMO_USERS: Record<string, string> = {
  admin: "admin123",
  casier: "casier123",
};

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

    // Simulare delay retea
    await new Promise((r) => setTimeout(r, 300));

    const user = username().trim().toLowerCase();
    const pass = password();

    if (DEMO_USERS[user] && DEMO_USERS[user] === pass) {
      login(user, `demo-token-${user}`);
      navigate("/");
    } else {
      setError("Utilizator sau parola incorecta.");
    }

    setLoading(false);
  }

  return (
    <div class="login-page">
      <div style="position:fixed;top:12px;right:12px">
        <ThemeToggle />
      </div>

      <div class="login-card">
        <div class="login-title">BerlinStar</div>
        <div class="login-subtitle">Autentificare POS</div>

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
