import { Show, type JSX } from "solid-js";

export interface PageWrapperProps {
  title?: string;
  subtitle?: string;
  actions?: JSX.Element;
  children: JSX.Element;
}

export default function PageWrapper(props: PageWrapperProps) {
  return (
    <div class="page-wrapper">
      <Show when={props.title || props.actions}>
        <header class="page-header">
          <div>
            <Show when={props.title}>
              <h1 class="page-title">{props.title}</h1>
            </Show>
            <Show when={props.subtitle}>
              <p class="page-subtitle">{props.subtitle}</p>
            </Show>
          </div>
          <Show when={props.actions}>
            <div class="page-actions">{props.actions}</div>
          </Show>
        </header>
      </Show>
      <div class="page-body">{props.children}</div>
    </div>
  );
}
