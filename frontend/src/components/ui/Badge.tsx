import type { JSX } from "solid-js";

export type BadgeKind = "neutral" | "success" | "warn" | "danger" | "info";

export default function Badge(props: { kind?: BadgeKind; children: JSX.Element }) {
  return <span class={`badge badge--${props.kind ?? "neutral"}`}>{props.children}</span>;
}
