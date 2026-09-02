import { For, Show, Suspense, createSignal, lazy, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { readJsonSafe } from "../utils/api";
import type { ApiMessageBody } from "../types";
import logo from "../assets/logo-nav.webp";
import { adminFetch, setAdminToken } from "./adminv2/admin-auth";

const AssistantSection = lazy(() => import("./adminv2/AssistantSection"));

type Section = "conturi" | "hotel" | "montare" | "roti-anvelope" | "email" | "rapoarte" | "efactura" | "tasks" | "logs" | "import-legacy" | "demo-seed" | "abonament-setari" | "abonament-conturi";

const SECTIONS: Record<Section, Component> = {
  conturi: lazy(() => import("./adminv2/AccountsSection")),
  hotel: lazy(() => import("./adminv2/HotelAnvelopeSection")),
  montare: lazy(() => import("./adminv2/MontareRotiSection")),
  "roti-anvelope": lazy(() => import("./adminv2/RotiMasinaAnvelopeSection")),
  email: lazy(() => import("./adminv2/EmailSection")),
  rapoarte: lazy(() => import("./adminv2/ReportsSection")),
  efactura: lazy(() => import("./adminv2/EFacturaSection")),
  tasks: lazy(() => import("./adminv2/TasksSection")),
  logs: lazy(() => import("./adminv2/LogsSection")),
  "import-legacy": lazy(() => import("./adminv2/LegacyImportSection")),
  "demo-seed": lazy(() => import("./adminv2/DemoSeedSection")),
  "abonament-setari": lazy(() => import("./adminv2/SubscriptionSettingsSection")),
  "abonament-conturi": lazy(() => import("./adminv2/SubscriptionAccountsSection")),
};

interface NavItem { id: Section; label: string; icon: string }
interface NavCategory { label: string; items: NavItem[] }

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: "Useri",
    items: [
      { id: "conturi", label: "Conturi", icon: "👥" },
    ],
  },
  {
    label: "Aplicații",
    items: [
      { id: "hotel", label: "Hotel Anvelope", icon: "🔧" },
      { id: "montare", label: "Montare Roți", icon: "🛞" },
    ],
  },
  {
    label: "Roți Mașină",
    items: [
      { id: "roti-anvelope", label: "Anvelope", icon: "🏷️" },
    ],
  },
  {
    label: "Operațional",
    items: [
      { id: "email", label: "Email", icon: "✉️" },
      { id: "rapoarte", label: "Rapoarte", icon: "📊" },
      { id: "efactura", label: "eFactura ANAF", icon: "📄" },
    ],
  },
  {
    label: "Abonament",
    items: [
      { id: "abonament-setari", label: "Setări", icon: "💳" },
      { id: "abonament-conturi", label: "Conturi", icon: "📅" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { id: "tasks", label: "Tasks", icon: "⏱️" },
      { id: "logs", label: "Logs", icon: "📜" },
      { id: "import-legacy", label: "Import Legacy", icon: "🗃️" },
      { id: "demo-seed", label: "Demo Seeder", icon: "🌱" },
    ],
  },
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
            {(() => {
              const cat = NAV_CATEGORIES.find((c) => c.items.some((i) => i.id === section()));
              const item = cat?.items.find((i) => i.id === section());
              if (!cat || !item) return "Admin";
              return cat.items.length > 1 ? `${cat.label} — ${item.label}` : item.label;
            })()}
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
              <For each={NAV_CATEGORIES}>
                {(cat) => (
                  <div class="adminv2-nav-group">
                    <div class="adminv2-nav-category">{cat.label}</div>
                    <For each={cat.items}>
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
                  </div>
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
            <Suspense fallback={<p class="cfg-hint">Se încarcă...</p>}>
              <Show when={section()} keyed>
                {(id) => <Dynamic component={SECTIONS[id]} />}
              </Show>
            </Suspense>
          </main>
        </div>

        {/* Asistent AI — buton flotant (FAB) dreapta-jos, disponibil pe orice sectiune */}
        <Suspense>
          <AssistantSection />
        </Suspense>
      </div>
    </Show>
  );
}
