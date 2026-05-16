import { createSignal } from "solid-js";
import { firstOfMonthISO, todayISO } from "./format";

/**
 * Wrapper peste createSignal care persista valoarea in localStorage. Suporta
 * atat set(newVal) cat si set(prev => newVal) — folosim returnul lui set, care
 * e mereu valoarea finala.
 */
export function persistedSignal<T>(
  key: string,
  initial: T,
): ReturnType<typeof createSignal<T>> {
  let initialValue = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) initialValue = JSON.parse(raw) as T;
  } catch {
    // localStorage indisponibil sau JSON invalid — folosim valoarea initiala
  }
  const [get, set] = createSignal<T>(initialValue);
  const wrappedSet = ((v: T | ((prev: T) => T)) => {
    const newVal = (set as (val: T | ((prev: T) => T)) => T)(v);
    try { localStorage.setItem(key, JSON.stringify(newVal)); } catch {}
    return newVal;
  }) as ReturnType<typeof createSignal<T>>[1];
  return [get, wrappedSet];
}

// ─── Period state (shared intre toate panourile) ─────────────────────────────

export const [periodFrom, setPeriodFrom] = persistedSignal<string>(
  "rapoarte_period_from",
  firstOfMonthISO(),
);
export const [periodTo, setPeriodTo] = persistedSignal<string>(
  "rapoarte_period_to",
  todayISO(),
);
export const [periodLabel, setPeriodLabel] = persistedSignal<string>(
  "rapoarte_period_label",
  "Luna aceasta",
);
export const [periodVersion, setPeriodVersion] = createSignal(0);

export function commitPeriod(from: string, to: string, label: string): void {
  setPeriodFrom(from);
  setPeriodTo(to);
  setPeriodLabel(label);
  setPeriodVersion((v) => v + 1);
}

// ─── Hide explanations toggle ────────────────────────────────────────────────

const HIDE_EXPL_KEY = "rapoarte_hide_explanations";

function initialHideExplanations(): boolean {
  try {
    return localStorage.getItem(HIDE_EXPL_KEY) === "1";
  } catch {
    return false;
  }
}

const [_hideExplanations, _setHideExplanationsRaw] = createSignal(initialHideExplanations());

export const hideExplanations = _hideExplanations;

export function setHideExplanations(v: boolean): void {
  _setHideExplanationsRaw(v);
  try {
    localStorage.setItem(HIDE_EXPL_KEY, v ? "1" : "0");
  } catch {
    // localStorage indisponibil — pastram doar starea in memorie
  }
}
