import { createSignal, onCleanup, type Accessor } from "solid-js";

/** Canonical breakpoints; keep in sync with the list at the top of styles/global.css. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

export function createMediaQuery(query: string): Accessor<boolean> {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    const [v] = createSignal(false);
    return v;
  }
  const mq = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mq.matches);
  const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
  mq.addEventListener("change", onChange);
  onCleanup(() => mq.removeEventListener("change", onChange));
  return matches;
}

/** <= 768px (phones), same as the CSS `max-width: 768px` blocks. */
export function useIsMobile(): Accessor<boolean> {
  return createMediaQuery(`(max-width: ${BREAKPOINTS.md}px)`);
}

/** <= 1024px (phones + tablets). */
export function useIsTablet(): Accessor<boolean> {
  return createMediaQuery(`(max-width: ${BREAKPOINTS.lg}px)`);
}
