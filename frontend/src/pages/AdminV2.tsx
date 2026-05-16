import { For, Show, createSignal } from "solid-js";
import { readJsonSafe } from "../utils/api";
import type { ApiMessageBody } from "../types";
import logo from "../assets/logo.png";
import { adminFetch, setAdminToken } from "./adminv2/admin-auth";
import AccountsSection from "./adminv2/AccountsSection";
import HotelAnvelopeSection from "./adminv2/HotelAnvelopeSection";
import MontareRotiSection from "./adminv2/MontareRotiSection";
import EmailSection from "./adminv2/EmailSection";
import ReportsSection from "./adminv2/ReportsSection";

type Section = "conturi" | "hotel" | "montare" | "email" | "rapoarte";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "conturi", label: "Conturi", icon: "👥" },
  { id: "hotel", label: "Hotel Anvelope", icon: "🔧" },
  { id: "montare", label: "Montare Roți", icon: "🛞" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "rapoarte", label: "Rapoarte", icon: "📊" },
];

// La mount, daca avem un token persistat valid (<24h) sarim peste ecranul de logare.
function initialVerified(): boolean {
  try {
    const exp = Number(localStorage.getItem("adminv2_token_exp") ?? 0);
    return !!exp && Date.now() < exp && !!localStorage.getItem("adminv2_token");
  } catch {
    return false;
  }
}

export default function AdminV2() {
  const [verified, setVerified] = createSignal(initialVerified());
  const [pass1, setPass1] = createSignal("");
  const [pass2, setPass2] = createSignal("");
  const [verifyErr, setVerifyErr] = createSignal("");
  const [verifying, setVerifying] = createSignal(false);

  function doLogout() {
    setAdminToken(null);
    setVerified(false);
  }

  async function doVerify(e: Event) {
    e.preventDefault();
    setVerifyErr("");
    setVerifying(true);
    try {
      const res = await adminFetch("/api/admin/verify", {
        method: "POST",
        body: JSON.stringify({ password1: pass1(), password2: pass2() }),
      });
      if (!res.ok) {
        const d = await readJsonSafe<ApiMessageBody>(res);
        setVerifyErr(d.detail ?? "Parole incorecte.");
        return;
      }
      const d = await readJsonSafe<{ access_token?: string }>(res);
      if (d.access_token) setAdminToken(d.access_token);
      setPass1(""); setPass2("");
      setVerified(true);
    } catch {
      setVerifyErr("Eroare de conexiune.");
    } finally {
      setVerifying(false);
    }
  }

  const [section, setSection] = createSignal<Section>("conturi");
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  function selectSection(s: Section) {
    setSection(s);
    setSidebarOpen(false);
  }

  return (
    <Show
      when={verified()}
      fallback={
        <div class="login-page">
          <div class="login-video-overlay" />
          <div class="login-card">
            <img src={logo} alt="Berlin Star" class="login-logo" />
            <div class="login-subtitle">Administrator</div>
            <div class="login-powered">Logare Administrator</div>

            <Show when={verifyErr()}>
              <div class="login-error">{verifyErr()}</div>
            </Show>

            <form onSubmit={doVerify} autocomplete="off">
              <div class="form-group">
                <label class="form-label">Parola 1</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={pass1()}
                  onInput={(e) => setPass1(e.currentTarget.value)}
                  autofocus
                />
              </div>
              <div class="form-group">
                <label class="form-label">Parola 2</label>
                <input
                  class="input"
                  type="password"
                  placeholder="••••••••"
                  value={pass2()}
                  onInput={(e) => setPass2(e.currentTarget.value)}
                />
              </div>
              <button class="btn btn-primary w-full mt-8" type="submit" disabled={verifying()}>
                {verifying() ? "Se verifică..." : "Intră în Admin"}
              </button>
            </form>
          </div>
        </div>
      }
    >
      <div class="adminv2-page">
        <div class="adminv2-mobile-header">
          <button
            class="btn btn-ghost btn-sm adminv2-hamburger"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span class="adminv2-mobile-title">
            {NAV_ITEMS.find((n) => n.id === section())?.label ?? "Admin"}
          </span>
        </div>

        <div class="adminv2-layout">
          <Show when={sidebarOpen()}>
            <div class="adminv2-backdrop" onClick={() => setSidebarOpen(false)} />
          </Show>

          <aside class="adminv2-sidebar adminv2-sidebar--with-logout" classList={{ "adminv2-sidebar--open": sidebarOpen() }}>
            <div class="adminv2-sidebar-header">
              <span class="adminv2-sidebar-title">BerlinStar Admin</span>
            </div>
            <nav class="adminv2-nav">
              <For each={NAV_ITEMS}>
                {(item) => (
                  <button
                    class="adminv2-nav-item"
                    classList={{ "adminv2-nav-item--active": section() === item.id }}
                    onClick={() => selectSection(item.id)}
                  >
                    <span class="adminv2-nav-item__icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )}
              </For>
            </nav>
            <div class="adminv2-sidebar-footer">
              <button class="adminv2-nav-item adminv2-nav-item--logout" onClick={doLogout}>
                <span class="adminv2-nav-item__icon">⎋</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>

          <main class="adminv2-content">
            <Show when={section() === "conturi"}>
              <AccountsSection />
            </Show>
            <Show when={section() === "hotel"}>
              <HotelAnvelopeSection />
            </Show>
            <Show when={section() === "montare"}>
              <MontareRotiSection />
            </Show>
            <Show when={section() === "email"}>
              <EmailSection />
            </Show>
            <Show when={section() === "rapoarte"}>
              <ReportsSection />
            </Show>
          </main>
        </div>
      </div>
    </Show>
  );
}
