import { useNavigate } from "@solidjs/router";
import { auth, trialRemainingMs, TRIAL_DAYS } from "../store/authStore";
import { logoutEverywhere } from "../store/profile";
import { isConnected } from "../store/connectivityStore";
import { theme, toggleTheme } from "../store/themeStore";
import { can, canSettings, roleLabel } from "../store/permissions";
import { posHotelCtx, clearPosHotelCtx } from "../store/posHotelStore";
import { For, Show, createSignal, onCleanup, createMemo } from "solid-js";
import { NAV_ITEMS } from "../routes";
import logo from "../assets/logo-nav.webp";
import ChangeMyPasswordModal from "./ChangeMyPasswordModal";

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
    // Revocam si sesiunea pe server, ca token-ul sa nu mai fie folosibil si sa
    // dispara din lista de dispozitive a userului.
    void logoutEverywhere();
  }

  // Schimbarea propriei parole trebuie sa fie la indemana oricui: formularul din
  // Configurari e in spatele resursei `settings`, deci un `worker` nu ar avea
  // de unde.
  const [showPwdModal, setShowPwdModal] = createSignal(false);

  function handleNavigate(path: string) {
    setOpen(false);
    navigate(path);
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

  const visibleNav = createMemo(() =>
    NAV_ITEMS.filter((i) => (!i.requires || can(i.requires)) && !i.hidden?.()),
  );

  const displayLabel = createMemo(() => auth.displayName?.trim() || auth.user || "");
  const usernameLabel = createMemo(() => {
    const u = auth.user?.trim() ?? "";
    return u && u !== displayLabel() ? u : "";
  });

  return (
    <>
      <nav class="navbar">
        <div class="offline-banner" classList={{ "offline-banner--online": isConnected() }} />
        <div class="logo-menu" style="position:relative;display:flex;align-items:center;gap:10px">
          <button
            class="btn-icon logo-coin-scene"
            style="border:none;padding:4px;background:transparent"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label="Meniu"
          >
            <span class="logo-coin" classList={{ "logo-coin--stuck": open() }}>
              <img src={logo} alt="Logo" />
            </span>
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

          <Show when={usernameLabel()}>
            <span class="navbar-username" title={`Utilizator: ${usernameLabel()}`}>
              {usernameLabel()}
            </span>
          </Show>

          <Show when={open()}>
            <div class="logo-dropdown">
              <div class="logo-nav-grid">
                <For each={visibleNav()}>
                  {(item) => (
                    <button class="logo-nav-tile" onClick={() => handleNavigate(item.href)}>
                      {item.icon()}
                      <span>{item.label}</span>
                    </button>
                  )}
                </For>
              </div>
              <div class="logo-dropdown-divider" />
              <button class="logo-dropdown-item" onClick={() => { toggleTheme(); }} aria-label="Schimba tema">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span style="margin-left:8px">{{ light: "Light", dark: "Dark", gray: "Gray", apple: "Navy" }[theme()]}</span>
              </button>
              <Show when={auth.userName || roleLabel()}>
                <div class="logo-dropdown-divider" />
                <div class="logo-dropdown-item" style="cursor:default;opacity:0.85;font-size:0.82rem">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;flex-shrink:0">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>{auth.userName || auth.user}{roleLabel() ? ` — ${roleLabel()}` : ""}</span>
                </div>
              </Show>
              <Show when={auth.user}>
                <div class="logo-dropdown-divider" />
                {/* Doar pentru rolurile care NU ajung in Configurări (adica
                    `worker`): acolo exista deja „Contul Meu → Parola mea", si
                    nu vrem doua intrari pentru acelasi lucru. */}
                <Show when={!canSettings()}>
                  <button class="logo-dropdown-item" onClick={() => { setOpen(false); setShowPwdModal(true); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;flex-shrink:0">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Schimbă parola
                  </button>
                </Show>
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

          <button
            type="button"
            class="navbar-fullscreen-btn"
            onClick={() => handleNavigate("/ghid")}
            aria-label="Ghid"
            title="Ghid"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>

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

      <ChangeMyPasswordModal open={showPwdModal()} onClose={() => setShowPwdModal(false)} />
    </>
  );
}
