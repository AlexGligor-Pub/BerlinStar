import { splitProps, createUniqueId, Show, type JSX } from "solid-js";

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "onInput" | "value"> {
  label?: string;
  hint?: string;
  error?: string | null;
  value?: string;
  onInput?: (value: string, e: InputEvent & { currentTarget: HTMLInputElement }) => void;
}

export default function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["label", "hint", "error", "value", "onInput", "id", "class"]);
  const id = local.id ?? createUniqueId();
  return (
    <div class={`field ${local.error ? "field--error" : ""} ${local.class ?? ""}`}>
      <Show when={local.label}>
        <label class="field-label" for={id}>{local.label}</label>
      </Show>
      <input
        id={id}
        class="input"
        value={local.value ?? ""}
        onInput={(e) => local.onInput?.(e.currentTarget.value, e)}
        aria-invalid={local.error ? true : undefined}
        aria-describedby={local.error ? `${id}-err` : local.hint ? `${id}-hint` : undefined}
        {...rest}
      />
      <Show when={local.hint && !local.error}>
        <span id={`${id}-hint`} class="field-hint">{local.hint}</span>
      </Show>
      <Show when={local.error}>
        <span id={`${id}-err`} class="field-error" role="alert">{local.error}</span>
      </Show>
    </div>
  );
}
