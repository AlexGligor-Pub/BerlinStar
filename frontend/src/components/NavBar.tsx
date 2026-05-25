import { useNavigate } from "@solidjs/router";
import { auth, logout, setDisplayName, trialRemainingMs, TRIAL_DAYS } from "../store/authStore";
import { isOffline } from "../store/productsStore";
import { theme, toggleTheme } from "../store/themeStore";
import { adminVisible, setAdminVisible } from "../store/adminStore";
import { posHotelCtx, clearPosHotelCtx } from "../store/posHotelStore";
import { generalSettings } from "../store/generalSettingsStore";
import { Show, createSignal, onCleanup, createMemo, onMount } from "solid-js";
import logo from "../assets/logo.png";
import { apiFetch } from "../utils/api";

export default function NavBar() {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  const trialBanner = createMemo(() => {
    if (!auth.isLocked || !auth.lockedAt) return null;
    const ms = trialRemainingMs();
    if (ms <= 0) return null;
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const lockedDate = new Date(auth.lockedAt);
    const expiry = new Date(lockedDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const expiryStr = expiry.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (days > 0) {
      return `Acces trial activ pana pe ${expiryStr} — mai ai ${days} zile si ${hours} ore.`;
    }
    return `Acces trial activ pana pe ${expiryStr} — mai ai ${hours} ore.`;
  });

  function handleLogout() {
    setOpen(false);
    logout();
  }

  function handleNavigate(path: string) {
    setOpen(false);
    navigate(path);
  }

  const [showAdminModal, setShowAdminModal] = createSignal(false);
  const [adminPassword, setAdminPassword] = createSignal("");
  const [adminError, setAdminError] = createSignal("");
  const [adminLoading, setAdminLoading] = createSignal(false);

  async function handleAdminSubmit(e: Event) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        handleUnauthorized: false,
        body: JSON.stringify({ username: auth.user, password: adminPassword() }),
      });
      if (res.ok) {
        setAdminVisible(true);
        setShowAdminModal(false);
        setAdminPassword("");
      } else {
        setAdminError("Parolă incorectă.");
      }
    } catch {
      setAdminError("Eroare de conexiune.");
    } finally {
      setAdminLoading(false);
    }
  }

  // ───── Fullscreen ─────────────────────────────────────────────────────────
  // iOS Safari iPhone nu expune requestFullscreen pe documentElement -> apelul
  // ar arunca un TypeError sincron (nu Promise rejection) si ar fi prins de
  // ErrorBoundary. Verificam cu typeof inainte de orice apel + fallback webkit
  // pentru Safari macOS / iPad mai vechi.
  type FsDoc = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  type FsElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const fsDoc = document as FsDoc;
  const fsRoot = document.documentElement as FsElement;

  function currentFsElement(): Element | null {
    return fsDoc.fullscreenElement ?? fsDoc.webkitFullscreenElement ?? null;
  }
  const fsAvailable = typeof fsRoot.requestFullscreen === "function"
                   || typeof fsRoot.webkitRequestFullscreen === "function";

  const [isFullscreen, setIsFullscreen] = createSignal(!!currentFsElement());

  function onFullscreenChange() {
    setIsFullscreen(!!currentFsElement());
  }

  async function toggleFullscreen() {
    try {
      if (currentFsElement()) {
        if (typeof fsDoc.exitFullscreen === "function") {
          await fsDoc.exitFullscreen();
        } else if (typeof fsDoc.webkitExitFullscreen === "function") {
          await fsDoc.webkitExitFullscreen();
        }
      } else {
        if (typeof fsRoot.requestFullscreen === "function") {
          await fsRoot.requestFullscreen();
        } else if (typeof fsRoot.webkitRequestFullscreen === "function") {
          await fsRoot.webkitRequestFullscreen();
        }
      }
    } catch {
      // Browser-ul a refuzat (de obicei lipsa de user gesture sau iOS Safari).
    }
  }

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  onCleanup(() => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  });

  // Inchide dropdown-ul cand se face pointerdown in afara.
  // Folosim pointerdown (nu click) ca sa reducem latency-ul pe touch si gate
  // pe `open()` pentru a evita procesarea cand dropdown-ul e inchis.
  function onOutsidePointerDown(e: PointerEvent) {
    if (!open()) return;
    const target = e.target as HTMLElement;
    if (!target.closest(".logo-menu")) setOpen(false);
  }

  document.addEventListener("pointerdown", onOutsidePointerDown);
  onCleanup(() => document.removeEventListener("pointerdown", onOutsidePointerDown));

  // Cand display-name-ul nu e in localStorage (prima vizita dupa login),
  // il aducem din /api/auth/me. Daca utilizatorul isi schimba numele din
  // Configurari -> Contul Meu, store-ul e actualizat direct de acolo si
  // navbar-ul reactioneaza automat.
  onMount(() => {
    if (!auth.token || auth.displayName) return;
    void apiFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const d = (await res.json()) as { name?: string };
      if (d?.name) setDisplayName(d.name);
    }).catch(() => {});
  });

  const displayLabel = createMemo(() => auth.displayName?.trim() || auth.user || "");

  return (
    <>
      <nav class="navbar">
        <div class="offline-banner" classList={{ "offline-banner--online": !isOffline() }} />
        <div class="logo-menu" style="position:relative;display:flex;align-items:center;gap:10px">
          <button
            class="btn-icon"
            style="border:none;padding:4px;background:transparent"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label="Meniu"
          >
            <img src={logo} alt="Logo" style="height:40px;display:block" />
          </button>

          <Show when={displayLabel()}>
            <span
              class="navbar-account-name"
              title={displayLabel()}
              style="font-family:'Segoe UI',system-ui,sans-serif;font-weight:600;font-size:1.05rem;letter-spacing:0.2px;background:linear-gradient(90deg,var(--accent,#5b7cfa),#9b6bff);-webkit-background-clip:text;background-clip:text;color:transparent;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
            >
              {displayLabel()}
            </span>
          </Show>

          <Show when={open()}>
            <div class="logo-dropdown">
              <div class="logo-nav-grid">
                <button class="logo-nav-tile" onClick={() => handleNavigate("/")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <span>POS</span>
                </button>
                <button class="logo-nav-tile" onClick={() => handleNavigate("/receptie")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span>Recepție</span>
                </button>
                <button class="logo-nav-tile" onClick={() => handleNavigate("/programari")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/>
                  </svg>
                  <span>Programări</span>
                </button>
                <button class="logo-nav-tile" onClick={() => handleNavigate("/clienti")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span>Clienți</span>
                </button>
                <button class="logo-nav-tile" onClick={() => handleNavigate("/concedii")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>
                  </svg>
                  <span>Concedii</span>
                </button>
                <Show when={!generalSettings()?.dezactiveazaHotelAnvelope}>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/hotel-anvelope")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                    </svg>
                    <span>Hotel Anvelope</span>
                  </button>
                </Show>
                <Show when={adminVisible()}>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/stocuri")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <span>Stocuri</span>
                  </button>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/rapoarte")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                    </svg>
                    <span>Rapoarte</span>
                  </button>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/efactura/primite")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <span>e-Factura</span>
                  </button>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/factura-rapida")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/>
                    </svg>
                    <span>Factura Rapida</span>
                  </button>
                  <button class="logo-nav-tile" onClick={() => handleNavigate("/configurari")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    <span>Configurări</span>
                  </button>
                </Show>
              </div>
              <div class="logo-dropdown-divider" />
              <button class="logo-dropdown-item" onClick={() => { toggleTheme(); }} aria-label="Schimba tema">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span style="margin-left:8px">{{ light: "Light", dark: "Dark", gray: "Gray", apple: "Navy" }[theme()]}</span>
              </button>
              <div class="logo-dropdown-divider" />
              <Show
                when={!adminVisible()}
                fallback={
                  <button class="logo-dropdown-item" onClick={() => { setAdminVisible(false); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;flex-shrink:0">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    Anulează vizibilitate
                  </button>
                }
              >
                <button class="logo-dropdown-item" onClick={() => { setAdminPassword(""); setAdminError(""); setShowAdminModal(true); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;flex-shrink:0">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Vizibilitate Admin
                </button>
              </Show>
              <Show when={auth.user}>
                <div class="logo-dropdown-divider" />
                <button class="logo-dropdown-item logo-dropdown-danger" onClick={handleLogout}>
                  Logout
                </button>
              </Show>
            </div>
          </Show>
        </div>

        <Show when={posHotelCtx()}>
          {(ctx) => (
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;flex:1;justify-content:center;overflow:hidden;min-width:0">
              <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">
                {ctx().titlu}
              </span>
              <span style="color:var(--text-muted);flex-shrink:0">·</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-muted);max-width:150px">
                {ctx().clientNume}
              </span>
              <button
                class="btn btn-ghost btn-sm"
                style="white-space:nowrap;flex-shrink:0"
                onClick={() => {
                  clearPosHotelCtx();
                  navigate("/");
                }}
              >
                ← POS
              </button>
            </div>
          )}
        </Show>

        <div class="navbar-right">
          <Show when={trialBanner()}>
            <span class="navbar-trial-badge">{trialBanner()}</span>
          </Show>

          <Show when={fsAvailable}>
            <button
              type="button"
              class="navbar-fullscreen-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen() ? "Ieși din ecran complet" : "Activează ecran complet"}
              title={isFullscreen() ? "Ieși din ecran complet" : "Activează ecran complet"}
            >
              <Show
                when={isFullscreen()}
                fallback={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9V3h6"/>
                    <path d="M21 9V3h-6"/>
                    <path d="M3 15v6h6"/>
                    <path d="M21 15v6h-6"/>
                  </svg>
                }
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 3v6H3"/>
                  <path d="M15 3v6h6"/>
                  <path d="M9 21v-6H3"/>
                  <path d="M15 21v-6h6"/>
                </svg>
              </Show>
            </button>
          </Show>
        </div>
      </nav>

      <Show when={showAdminModal()}>
        <div class="sl-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div class="sl-modal" onClick={(e) => e.stopPropagation()}>
            <div class="sl-modal-header">
              <span class="sl-modal-title">Vizibilitate Admin</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowAdminModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdminSubmit}>
              <div class="sl-modal-body" style="padding:20px 24px">
                <p style="margin:0 0 12px;color:var(--text-muted);font-size:14px">Introdu parola contului pentru a activa vizibilitatea admin.</p>
                <input
                  type="password"
                  class="input"
                  placeholder="Parolă"
                  value={adminPassword()}
                  onInput={(e) => setAdminPassword(e.currentTarget.value)}
                  autofocus
                />
                <Show when={adminError()}>
                  <p style="margin:8px 0 0;color:var(--danger);font-size:13px">{adminError()}</p>
                </Show>
              </div>
              <div class="sl-modal-footer">
                <button type="button" class="btn btn-ghost btn-sm" onClick={() => setShowAdminModal(false)}>Anulează</button>
                <button type="submit" class="btn btn-primary btn-sm" disabled={adminLoading()}>
                  {adminLoading() ? "..." : "Activează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </>
  );
}
