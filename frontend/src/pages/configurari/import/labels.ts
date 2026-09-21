import type { ImportIssue, ImportRowStatus, ImportSession } from "../../../api/imports";

export const ISSUE_LABEL: Record<ImportIssue, string> = {
  error: "Date invalide",
  missing: "Date lipsă",
  duplicate: "Posibil duplicat",
  new_client: "Client nou",
  name_match: "Potrivit după nume",
  ambiguous: "Client ambiguu",
};

export const ISSUE_BADGE: Record<ImportIssue, string> = {
  error: "badge--danger",
  missing: "badge--warn",
  duplicate: "badge--info",
  new_client: "badge--info",
  name_match: "badge--warn",
  ambiguous: "badge--danger",
};

export const STATUS_LABEL: Record<ImportRowStatus, string> = {
  imported: "Importat",
  pending: "De rezolvat",
  rejected: "Respins",
  reverted: "Anulat",
};

export const STATUS_BADGE: Record<ImportRowStatus, string> = {
  imported: "badge--success",
  pending: "badge--warn",
  rejected: "badge--neutral",
  reverted: "badge--neutral",
};

export function sessionStatusLabel(s: ImportSession): string {
  if (s.state === "processing") {
    const pct = s.total_rows ? Math.round((s.processed_rows / s.total_rows) * 100) : 0;
    return `În procesare ${pct}%`;
  }
  if (s.state === "reverted") return "Anulată";
  if (s.status === "necesita_actiuni") return "Necesită acțiuni";
  return s.state === "failed" ? "Eșuată" : "Finalizată";
}

export function sessionStatusBadge(s: ImportSession): string {
  if (s.state === "processing") return "badge--info";
  if (s.state === "reverted") return "badge--neutral";
  if (s.status === "necesita_actiuni") return "badge--warn";
  return s.state === "failed" ? "badge--danger" : "badge--success";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}
