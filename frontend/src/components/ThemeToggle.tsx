import { theme, toggleTheme } from "../store/themeStore";

export default function ThemeToggle() {
  return (
    <button class="btn-icon" onClick={toggleTheme} title="Schimba tema" aria-label="Schimba tema">
      {theme() === "light" ? "🌙" : "☀️"}
    </button>
  );
}
