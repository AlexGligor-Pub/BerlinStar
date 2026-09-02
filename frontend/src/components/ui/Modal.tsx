import { Show, onMount, onCleanup, createUniqueId, type JSX } from "solid-js";
import { Portal } from "solid-js/web";

type StyleProp = string | JSX.CSSProperties | undefined;

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: JSX.Element;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  children: JSX.Element;
  footer?: JSX.Element;
  size?: "sm" | "md" | "lg";
  /** Extra classes / inline style on the dialog panel (.sl-modal). */
  class?: string;
  style?: StyleProp;
  overlayClass?: string;
  overlayStyle?: StyleProp;
  headerStyle?: StyleProp;
  footerStyle?: StyleProp;
  bodyClass?: string;
  bodyStyle?: StyleProp;
  hideClose?: boolean;
  closeDisabled?: boolean;
  /** Render children directly inside the panel (custom layout, no header/body/footer). */
  bare?: boolean;
}

export default function Modal(props: ModalProps) {
  let dialogRef: HTMLDivElement | undefined;
  let lastFocused: Element | null = null;
  const titleId = createUniqueId();

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
        if (dialogRef?.contains(document.activeElement)) return;
        const fs = getFocusable();
        fs[0]?.focus();
      });
    } else {
      if (lastFocused && lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      }
    }
  }

  const panelClass = () => {
    if (props.bare) return props.class ?? "";
    return `sl-modal sl-modal--${props.size ?? "md"}${props.class ? ` ${props.class}` : ""}`;
  };

  let lastOpen = false;
  return (
    <Show when={props.open}>
      {(() => {
        if (!lastOpen) { lastOpen = true; queueMicrotask(() => handleOpenChange(true)); }
        onCleanup(() => { if (lastOpen) { lastOpen = false; handleOpenChange(false); } });
        return (
          <Portal>
            <div class={`sl-modal-overlay${props.overlayClass ? ` ${props.overlayClass}` : ""}`} style={props.overlayStyle} role="presentation">
              <div
                ref={dialogRef}
                class={panelClass()}
                style={props.style}
                role="dialog"
                aria-modal="true"
                aria-label={props.ariaLabel}
                aria-labelledby={props.title ? titleId : undefined}
              >
                <Show when={props.bare} fallback={
                  <>
                    <Show when={props.title}>
                      <div class="sl-modal-header" style={props.headerStyle}>
                        <span id={titleId} class="sl-modal-title">{props.title}</span>
                        <Show when={!props.hideClose}>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            aria-label="Închide"
                            disabled={props.closeDisabled}
                            onClick={() => props.onClose?.()}
                          >
                            ✕
                          </button>
                        </Show>
                      </div>
                    </Show>
                    <div class={`sl-modal-body${props.bodyClass ? ` ${props.bodyClass}` : ""}`} style={props.bodyStyle}>{props.children}</div>
                    <Show when={props.footer}>
                      <div class="sl-modal-footer" style={props.footerStyle}>{props.footer}</div>
                    </Show>
                  </>
                }>
                  {props.children}
                </Show>
              </div>
            </div>
          </Portal>
        );
      })()}
    </Show>
  );
}
