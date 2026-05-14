import { Show, type JSX } from "solid-js";

export interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: JSX.Element;
}

export default function EmptyState(props: EmptyStateProps) {
  return (
    <div class="empty-state" role="status">
      <Show when={props.title}>
        <h3 class="empty-state-title">{props.title}</h3>
      </Show>
      <Show when={props.message}>
        <p class="empty-state-msg">{props.message}</p>
      </Show>
      <Show when={props.action}>
        <div class="empty-state-action">{props.action}</div>
      </Show>
    </div>
  );
}
