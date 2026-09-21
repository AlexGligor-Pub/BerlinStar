import { Show, createSignal } from "solid-js";

/**
 * Bara de progres pentru import.
 *  - cu `value` (0..1): progres real, ex. randuri procesate din total;
 *  - fara `value`: „working", animatie continua cand nu stim cat mai dureaza
 *    (incarcarea fisierului, verificarea, actiunile pe randuri).
 */
export default function ProgressBar(props: { value?: number | null; label?: string; detail?: string }) {
  const pct = () => Math.round(Math.min(1, Math.max(0, props.value ?? 0)) * 100);
  const determinate = () => props.value !== undefined && props.value !== null;

  return (
    <div class="import-progress" role="progressbar" aria-busy="true"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate() ? pct() : undefined}>
      <div class="import-progress-head">
        <span class="import-progress-spinner" aria-hidden="true" />
        <span>{props.label ?? "Se lucrează..."}</span>
        <Show when={determinate()}><strong>{pct()}%</strong></Show>
        <Show when={props.detail}><span class="import-aliases">{props.detail}</span></Show>
      </div>
      <div class="import-progress-track">
        <div
          class="import-progress-fill"
          classList={{ "import-progress-fill--indeterminate": !determinate() }}
          style={determinate() ? { width: `${pct()}%` } : undefined}
        />
      </div>
    </div>
  );
}

/**
 * Garda la dublu click: `guard(fn)` ruleaza `fn` doar daca nu ruleaza deja una.
 *
 * Butoanele se dezactiveaza oricum din `busy()`, dar intre click si re-render
 * (sau la Enter tinut apasat) pot pleca doua cereri; flag-ul sincron le opreste.
 */
export function createGuard() {
  const [busy, setBusy] = createSignal(false);
  let running = false;

  async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      running = false;
      setBusy(false);
    }
  }

  return { busy, guard };
}
