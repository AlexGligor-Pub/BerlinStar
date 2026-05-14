import { Show, onMount, onCleanup, type JSX } from "solid-js";
import { Portal } from "solid-js/web";

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  children: JSX.Element;
  footer?: JSX.Element;
  size?: "sm" | "md" | "lg";
}

export default function Modal(props: ModalProps) {
  let dialogRef: HTMLDivElement | undefined;
  let lastFocused: Element | null = null;

  function getFocusable(): HTMLElement[] {
    if (!dialogRef) return [];
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(dialogRef.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.hasAttribute("data-focus-skip"));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!props.open) return;
    if (e.key === "Escape" && props.closeOnEscape !== false) {
      props.onClose?.();
      return;
    }
    if (e.key === "Tab") {
      const focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      lastFocused = document.activeElement;
      queueMicrotask(() => {
        const fs = getFocusable();
        fs[0]?.focus();
      });
    } else {
      if (lastFocused && lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      }
    }
  }

  let lastOpen = false;
  return (
    <Show when={props.open}>
      {(() => {
        if (!lastOpen) { lastOpen = true; queueMicrotask(() => handleOpenChange(true)); }
        onCleanup(() => { if (lastOpen) { lastOpen = false; handleOpenChange(false); } });
        return (
          <Portal>
            <div class="sl-modal-overlay" role="presentation">
              <div
                ref={dialogRef}
                class={`sl-modal sl-modal--${props.size ?? "md"}`}
                role="dialog"
                aria-modal="true"
                aria-label={props.ariaLabel}
                aria-labelledby={props.title ? "modal-title" : undefined}
              >
                <Show when={props.title}>
                  <div class="sl-modal-header">
                    <span id="modal-title" class="sl-modal-title">{props.title}</span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      aria-label="Închide"
                      onClick={() => props.onClose?.()}
                    >
                      ✕
                    </button>
                  </div>
                </Show>
                <div class="sl-modal-body">{props.children}</div>
                <Show when={props.footer}>
                  <div class="sl-modal-footer">{props.footer}</div>
                </Show>
              </div>
            </div>
          </Portal>
        );
      })()}
    </Show>
  );
}
