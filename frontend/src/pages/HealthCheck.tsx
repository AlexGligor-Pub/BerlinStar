import { createResource } from "solid-js";
import { apiFetch } from "../utils/api";
import type { HealthStatus } from "../types";

type HealthLabel = "OK" | "BE-Error" | "DB-Error";

async function fetchHealth(): Promise<HealthLabel> {
  try {
    const res = await apiFetch("/api/health", {
      signal: AbortSignal.timeout(5000),
      handleUnauthorized: false,
    });
    if (!res.ok) return "BE-Error";
    const data = (await res.json()) as HealthStatus;
    return data.db === "error" ? "DB-Error" : "OK";
  } catch {
    return "BE-Error";
  }
}

export default function HealthCheck() {
  const [status] = createResource<HealthLabel>(fetchHealth);
  return (
    <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100vh", "font-size": "2rem", "font-family": "monospace" }}>
      {status.loading ? "..." : status()}
    </div>
  );
}
