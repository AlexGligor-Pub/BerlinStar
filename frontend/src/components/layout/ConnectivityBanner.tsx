import { Show, createMemo } from "solid-js";
import { connectivityStatus, retryConnectivity } from "../../store/connectivityStore";

/**
 * Banner global afisat pe toate paginile cand clientul nu poate comunica:
 *  - fara internet (navigator offline)
 *  - serverul nu raspunde (internet ok, dar API/DB inaccesibil)
 *
 * Recuperarea e automata (polling pe /api/health), butonul doar forteaza o verificare.
 */
export default function ConnectivityBanner() {
  const status = createMemo(() => connectivityStatus());

  const message = createMemo(() => {
    switch (status()) {
      case "no-internet":
        return "Fără conexiune la internet. Verifică rețeaua — modificările nu pot fi salvate momentan.";
      case "server-down":
        return "Conexiunea cu serverul a fost pierdută. Reîncercăm automat — nu efectua plăți sau salvări până la revenire.";
      default:
        return "";
    }
  });

  return (
    <Show when={status() !== "online"}>
      <div
        class="connectivity-banner"
        classList={{
          "connectivity-banner--no-internet": status() === "no-internet",
          "connectivity-banner--server-down": status() === "server-down",
        }}
        role="alert"
        aria-live="assertive"
      >
        <span class="connectivity-banner__dot" aria-hidden="true" />
        <svg
          class="connectivity-banner__icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span class="connectivity-banner__msg">{message()}</span>
        <button
          type="button"
          class="connectivity-banner__retry"
          onClick={() => void retryConnectivity()}
        >
          Reîncearcă
        </button>
      </div>
    </Show>
  );
}
