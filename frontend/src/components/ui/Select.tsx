import { splitProps, createUniqueId, Show, For, type JSX } from "solid-js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "onInput" | "value"> {
  label?: string;
  hint?: string;
  error?: string | null;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

export default function Select(props: SelectProps) {
  const [local, rest] = splitProps(props, ["label", "hint", "error", "value", "options", "placeholder", "onChange", "id", "class"]);
  const id = local.id ?? createUniqueId();
  return (
    <div class={`field ${local.error ? "field--error" : ""} ${local.class ?? ""}`}>
      <Show when={local.label}>
        <label class="field-label" for={id}>{local.label}</label>
      </Show>
      <select
        id={id}
        class="input"
        value={local.value ?? ""}
        onChange={(e) => local.onChange?.(e.currentTarget.value)}
        aria-invalid={local.error ? true : undefined}
        {...rest}
      >
        <Show when={local.placeholder !== undefined}>
          <option value="">{local.placeholder}</option>
        </Show>
        <For each={local.options}>
          {(o) => <option value={o.value}>{o.label}</option>}
        </For>
      </select>
      <Show when={local.error}>
        <span class="field-error" role="alert">{local.error}</span>
      </Show>
    </div>
  );
}
