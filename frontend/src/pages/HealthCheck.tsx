import { createResource } from "solid-js";
import { API_BASE } from "../utils/api";

async function fetchHealth() {
  try {
    const res = await fetch(API_BASE + "/api/health", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "BE-Error";
    const data = await res.json();
    return data.db === "error" ? "DB-Error" : "OK";
  } catch {
    return "BE-Error";
  }
}

export default function HealthCheck() {
  const [status] = createResource(fetchHealth);
  return (
    <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100vh", "font-size": "2rem", "font-family": "monospace" }}>
      {status.loading ? "..." : status()}
    </div>
  );
}
