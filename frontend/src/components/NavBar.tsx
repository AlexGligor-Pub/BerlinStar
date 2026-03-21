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
              <button class="logo-dropdown-item" onClick={() => handleNavigate("/")}>
                POS
              </button>
              <button class="logo-dropdown-item" onClick={() => handleNavigate("/receptie")}>
                Receptie
              </button>
              <div class="logo-dropdown-divider" />
              <button class="logo-dropdown-item" onClick={() => { toggleTheme(); }} aria-label="Schimba tema">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
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
