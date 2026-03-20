import { createSignal, createEffect } from "solid-js";

const STORAGE_KEY = "bs_theme";
const saved = (localStorage.getItem(STORAGE_KEY) as "light" | "dark") ?? "light";

const [theme, setTheme] = createSignal<"light" | "dark">(saved);

createEffect(() => {
  document.documentElement.setAttribute("data-theme", theme());
  localStorage.setItem(STORAGE_KEY, theme());
});

export function toggleTheme() {
  setTheme((t) => (t === "light" ? "dark" : "light"));
}

export { theme };
