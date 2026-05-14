import { For } from "solid-js";
import { notifications, dismissNotification } from "../../store/notificationsStore";

export default function Notifications() {
  return (
    <div class="notifications-host" aria-live="polite" aria-atomic="false">
      <For each={notifications()}>
        {(n) => (
          <div class={`notification notification--${n.kind}`} role={n.kind === "error" ? "alert" : "status"}>
            <span class="notification-msg">{n.message}</span>
            <button
              type="button"
              class="notification-close"
              aria-label="Închide notificarea"
              onClick={() => dismissNotification(n.id)}
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
