import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { apiFetch } from "../../utils/api";
import { auth } from "../../store/authStore";

interface SubscriptionStatus {
  configured: boolean;
  next_payment_date: string | null;
  days_left: number | null;
  banner_kind: string;
  show_banner: boolean;
  message: string;
}

const POLL_MS = 30 * 60 * 1000; // 30 min

export default function SubscriptionBanner() {
  const navigate = useNavigate();
  const [status, setStatus] = createSignal<SubscriptionStatus | null>(null);
  let timer: number | undefined;

  async function load() {
    if (!auth.token) return;
    try {
      const res = await apiFetch("/api/subscription/me", { handleUnauthorized: false });
      if (!res.ok) return;
      const data = (await res.json()) as SubscriptionStatus;
      setStatus(data);
    } catch {
      // silent
    }
  }

  onMount(() => {
    void load();
    timer = window.setInterval(() => void load(), POLL_MS);
  });
  onCleanup(() => { if (timer) window.clearInterval(timer); });

  function bg(kind: string): string {
    if (kind === "warn") return "#fef3c7";
    if (kind === "danger") return "#fed7aa";
    if (kind === "expired") return "#fee2e2";
    return "#e5e7eb";
  }
  function fg(kind: string): string {
    if (kind === "warn") return "#92400e";
    if (kind === "danger") return "#9a3412";
    if (kind === "expired") return "#991b1b";
    return "#111827";
  }

  return (
    <Show when={status()?.show_banner ? status() : null}>
      {(s) => (
        <div
          role="button"
          onClick={() => navigate("/configurari")}
          style={`cursor:pointer;background:${bg(s().banner_kind)};color:${fg(s().banner_kind)};padding:8px 14px;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px`}
        >
          <span>⚠</span>
          <span>{s().message}</span>
          <span style="text-decoration:underline">Plăteşte acum →</span>
        </div>
      )}
    </Show>
  );
}
