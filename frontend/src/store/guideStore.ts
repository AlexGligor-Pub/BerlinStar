import { createSignal } from "solid-js";

export type GuideLang = "ro" | "en" | "hu";
export const GUIDE_LANGS: GuideLang[] = ["ro", "en", "hu"];
export const GUIDE_LANG_LABEL: Record<GuideLang, string> = {
  ro: "Română",
  en: "English",
  hu: "Magyar",
};

const KEY = "bs_guide_lang";

function initial(): GuideLang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ro" || saved === "en" || saved === "hu") return saved;
  } catch {}
  return "ro";
}

const [lang, setLangSignal] = createSignal<GuideLang>(initial());

export { lang };
export function setLang(l: GuideLang): void {
  setLangSignal(l);
  try { localStorage.setItem(KEY, l); } catch {}
}
