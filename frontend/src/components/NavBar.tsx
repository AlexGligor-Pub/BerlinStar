import { useNavigate } from "@solidjs/router";
import { auth, logout } from "../store/authStore";
import { cartCount } from "../store/cartStore";
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
      <Show when={isOffline()}>
        <div class="offline-banner" />
      </Show>
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
              <button class="logo-dropdown-item" onClick={() => handleNavigate("/")}>
                POS
              </button>
              <button class="logo-dropdown-item" onClick={() => handleNavigate("/receptie")}>
                Receptie
                <Show when={cartCount() > 0}>
                  <span class="badge" style="margin-left:6px">{cartCount()}</span>
                </Show>
              </button>
              <div class="logo-dropdown-divider" />
              <button class="logo-dropdown-item" onClick={() => { toggleTheme(); }} aria-label="Schimba tema">
                <Show
                  when={theme() === "light"}
                  fallback={
                    // Sun icon — switch to light
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                  }
                >
                  {/* Moon icon — switch to dark */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </Show>
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
