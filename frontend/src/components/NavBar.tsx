import { useNavigate } from "@solidjs/router";
import { auth, logout } from "../store/authStore";
import { isOffline } from "../store/productsStore";
import { theme, toggleTheme } from "../store/themeStore";
import { Show, createSignal, onCleanup } from "solid-js";
import logo from "../assets/logo.png";

export default function NavBar() {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login");
  }

  function handleNavigate(path: string) {
    setOpen(false);
    navigate(path);
  }

  // Inchide dropdown-ul cand se face click in afara
  function onOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".logo-menu")) setOpen(false);
  }

  document.addEventListener("click", onOutsideClick);
  onCleanup(() => document.removeEventListener("click", onOutsideClick));

  return (
    <>
      <div class="offline-banner" classList={{ "offline-banner--online": !isOffline() }} />
      <nav class="navbar">
        <div class="logo-menu" style="position:relative">
          <button
            class="btn-icon"
            style="border:none;padding:4px;background:transparent"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label="Meniu"
          >
            <img src={logo} alt="Logo" style="height:36px;display:block" />
          </button>

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
                <button class="logo-nav-tile" onClick={() => handleNavigate("/clienti")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span>Clienți</span>
                </button>
                <button class="logo-nav-tile" onClick={() => handleNavigate("/configurari")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span>Configurări</span>
                </button>
              </div>
              <div class="logo-dropdown-divider" />
              <button class="logo-dropdown-item" onClick={() => { toggleTheme(); }} aria-label="Schimba tema">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span style="margin-left:8px">{{ light: "Light", dark: "Dark", gray: "Gray", apple: "Navy" }[theme()]}</span>
              </button>
              <Show when={auth.user}>
                <div class="logo-dropdown-divider" />
                <button class="logo-dropdown-item logo-dropdown-danger" onClick={handleLogout}>
                  Logout
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </nav>
    </>
  );
}
