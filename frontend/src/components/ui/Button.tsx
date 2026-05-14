import { splitProps, type JSX } from "solid-js";

export type ButtonVariant = "primary" | "ghost" | "danger" | "secondary";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export default function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "loading", "class", "children", "disabled"]);
  const variant = (): ButtonVariant => local.variant ?? "primary";
  const size = (): ButtonSize => local.size ?? "md";
  return (
    <button
      type={rest.type ?? "button"}
      {...rest}
      class={`btn btn-${variant()} btn-${size()} ${local.class ?? ""}`}
      disabled={local.disabled || local.loading}
      aria-busy={local.loading || undefined}
    >
      {local.loading ? "…" : local.children}
    </button>
  );
}
