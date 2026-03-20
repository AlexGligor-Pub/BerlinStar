import { createSignal, createEffect } from "solid-js";

export type Theme = "light" | "dark" | "gray";
const THEMES: Theme[] = ["light", "dark", "gray"];

const STORAGE_KEY = "bs_theme";
const saved = (localStorage.getItem(STORAGE_KEY) as Theme) ?? "light";

const [theme, setTheme] = createSignal<Theme>(saved);

createEffect(() => {
  document.documentElement.setAttribute("data-theme", theme());
  localStorage.setItem(STORAGE_KEY, theme());
});

export function toggleTheme() {
  setTheme((t) => {
    const idx = THEMES.indexOf(t);
    return THEMES[(idx + 1) % THEMES.length];
  });
}

export { theme };
