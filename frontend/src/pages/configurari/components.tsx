import { Show, createSignal, onMount, onCleanup } from "solid-js";

/** Buton "Export ▾" cu dropdown CSV/PDF. */
export function ExportMenu(props: { onCSV: () => void; onPDF: () => void }) {
  const [open, setOpen] = createSignal(false);
  let wrap: HTMLDivElement | undefined;

  function onOutside(e: MouseEvent) {
    if (wrap && !wrap.contains(e.target as Node)) setOpen(false);
  }

  onMount(() => document.addEventListener("mousedown", onOutside));
  onCleanup(() => document.removeEventListener("mousedown", onOutside));

  return (
    <div class="cfg-export-wrap" ref={wrap}>
      <button class="btn btn-sm btn-ghost" onClick={() => setOpen(o => !o)}>
        Export ▾
      </button>
      <Show when={open()}>
        <div class="cfg-export-menu">
          <button class="cfg-export-item" onClick={() => { props.onPDF(); setOpen(false); }}>PDF</button>
          <button class="cfg-export-item" onClick={() => { props.onCSV(); setOpen(false); }}>CSV</button>
        </div>
      </Show>
    </div>
  );
}

/** Modal generic de confirmare stergere. */
export function DeleteModal(props: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div class="cfg-confirm-overlay">
      <div class="cfg-confirm-modal">
        <p class="cfg-confirm-text">
          Stergi <strong>{props.label}</strong>?
        </p>
        <div class="cfg-confirm-actions">
          <button class="btn btn-sm btn-ghost" onClick={props.onCancel}>Anuleaza</button>
          <button class="btn btn-sm btn-danger" disabled={props.saving} onClick={props.onConfirm}>Sterge</button>
        </div>
      </div>
    </div>
  );
}
