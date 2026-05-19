import { ErrorBoundary, type JSX } from "solid-js";

function fallback(err: unknown, reset: () => void): JSX.Element {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    <div class="app-error-fallback" role="alert">
      <h2 class="app-error-title">A apărut o eroare</h2>
      <p class="app-error-msg">{msg}</p>
      <div class="app-error-actions">
        <button type="button" class="btn btn-primary btn-sm" onClick={reset}>
          Reîncearcă
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onClick={() => { window.location.href = import.meta.env.BASE_URL; }}
        >
          Mergi la pagina principală
        </button>
      </div>
    </div>
  );
}

export default function AppErrorBoundary(props: { children: JSX.Element }) {
  return <ErrorBoundary fallback={fallback}>{props.children}</ErrorBoundary>;
}
