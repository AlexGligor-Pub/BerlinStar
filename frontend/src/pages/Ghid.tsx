import { For, Show, createMemo, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { SECTIONS, sectionMarkdown } from "../docs";
import { GUIDE_LANGS, GUIDE_LANG_LABEL, lang, setLang, type GuideLang } from "../store/guideStore";
import { renderMarkdown } from "../utils/miniMarkdown";

const CHROME: Record<GuideLang, { search: string; empty: string; back: string; subtitle: string }> = {
  ro: { search: "Caută în ghid…", empty: "Niciun rezultat.", back: "← Înapoi la aplicație", subtitle: "Ghid de utilizare" },
  en: { search: "Search the guide…", empty: "No results.", back: "← Back to app", subtitle: "User guide" },
  hu: { search: "Keresés az útmutatóban…", empty: "Nincs találat.", back: "← Vissza az alkalmazáshoz", subtitle: "Használati útmutató" },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function highlight(html: string, q: string): string {
  if (!q) return html;
  const nq = normalize(q);
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) return part;
      const np = normalize(part);
      let out = "";
      let idx = 0;
      let from = np.indexOf(nq);
      while (from !== -1) {
        out += part.slice(idx, from) + "<mark>" + part.slice(from, from + q.length) + "</mark>";
        idx = from + q.length;
        from = np.indexOf(nq, idx);
      }
      return out + part.slice(idx);
    })
    .join("");
}

export default function Ghid() {
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(SECTIONS[0].id);

  const chrome = createMemo(() => CHROME[lang()]);

  const sources = createMemo(() =>
    SECTIONS.map((s) => ({ ...s, md: sectionMarkdown(s.id, lang()) })),
  );

  const filtered = createMemo(() => {
    const q = normalize(query().trim());
    if (!q) return sources();
    return sources().filter(
      (s) => normalize(s.title[lang()]).includes(q) || normalize(s.md).includes(q),
    );
  });

  const current = createMemo(() => {
    const list = filtered();
    const sel = list.find((s) => s.id === active()) ?? list[0];
    return sel ?? null;
  });

  const html = createMemo(() => {
    const c = current();
    if (!c) return "";
    return highlight(renderMarkdown(c.md), query().trim());
  });

  return (
    <div class="guide">
      <header class="guide-top">
        <div class="guide-brand">
          <span class="guide-logo">Berlin Star</span>
          <span class="guide-subtitle">{chrome().subtitle}</span>
        </div>
        <div class="guide-top-right">
          <div class="guide-langs" role="group" aria-label="Language">
            <For each={GUIDE_LANGS}>
              {(l) => (
                <button
                  type="button"
                  class="guide-lang"
                  classList={{ active: lang() === l }}
                  onClick={() => setLang(l)}
                >
                  {GUIDE_LANG_LABEL[l]}
                </button>
              )}
            </For>
          </div>
          <A href="/" class="guide-back">{chrome().back}</A>
        </div>
      </header>

      <div class="guide-search">
        <input
          type="search"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder={chrome().search}
          aria-label={chrome().search}
        />
      </div>

      <div class="guide-body">
        <nav class="guide-nav">
          <Show when={filtered().length > 0} fallback={<div class="guide-empty">{chrome().empty}</div>}>
            <For each={filtered()}>
              {(s) => (
                <button
                  type="button"
                  class="guide-nav-item"
                  classList={{ active: current()?.id === s.id }}
                  onClick={() => setActive(s.id)}
                >
                  <span class="guide-nav-icon">{s.icon}</span>
                  <span>{s.title[lang()]}</span>
                </button>
              )}
            </For>
          </Show>
        </nav>

        <main class="guide-content">
          <Show when={current()} fallback={<div class="guide-empty">{chrome().empty}</div>}>
            <article class="guide-md" innerHTML={html()} />
          </Show>
        </main>
      </div>
    </div>
  );
}
