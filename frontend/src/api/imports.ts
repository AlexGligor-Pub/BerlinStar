import { ApiError, ensureOk, http } from "./client";

/** Tipurile de import (vezi backend/app/routers/import_data.py :: KINDS). */
export type ImportKind = "clienti" | "hotel";

/** Specificatia fisierului CSV de clienti (app/services/client_import.py). */
export interface ImportColumnSpec {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
  aliases: string[];
  if_missing: string | null;
}

export interface ClientImportFormat {
  columns: ImportColumnSpec[];
  missing_markers: string[];
  name_placeholder: string;
  missing_tag: string;
  cnp_placeholder: string;
  max_file_mb: number;
  max_rows: number | null;
  delimiters: string[];
  encodings: string[];
}

/** Problema unui rand. Clienti: error | missing | duplicate.
 *  Hotel: error | duplicate | new_client | name_match | ambiguous. */
export type ImportIssue = "error" | "missing" | "duplicate" | "new_client" | "name_match" | "ambiguous";
export type ImportRowStatus = "imported" | "pending" | "rejected" | "reverted";
export type RowValues = Record<string, string | null>;

interface FileInfo {
  encoding: string;
  delimiter: string;
  columns_recognized: string[];
  columns_missing: string[];
  columns_ignored: string[];
  file_warnings: string[];
}

export interface PreviewRow {
  row: number;
  issue: ImportIssue | null;
  values: RowValues;
  messages: string[];
}

export interface ClientImportPreview extends FileInfo {
  total_rows: number;
  to_import: number;
  to_review: number;
  errors: number;
  missing: number;
  duplicates: number;
  issues: PreviewRow[];
  preview: PreviewRow[];
}

export interface ImportSession {
  id: number;
  kind: ImportKind;
  filename: string | null;
  encoding: string | null;
  delimiter: string | null;
  columns_recognized: string[];
  file_warnings: string[];
  total_rows: number;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  imported: number;
  pending: number;
  rejected: number;
  reverted: number;
  status: "necesita_actiuni" | "finalizata";
  /** Procesarea in fundal a fisierului; `reverted` = importul a fost anulat. */
  state: "processing" | "done" | "failed" | "reverted";
  processed_rows: number;
  error: string | null;
  reverted_by: string | null;
  reverted_at: string | null;
}

export interface ImportRow<V = RowValues, O = RowValues> {
  id: number;
  row: number;
  status: ImportRowStatus;
  issue: ImportIssue | null;
  values: V;
  original: O;
  messages: string[];
  client_id: number | null;
  created: Record<string, unknown> | null;
  /** Numele clientului potrivit / ales (doar in listele de randuri). */
  client_nume?: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

// ─── Hotel anvelope ──────────────────────────────────────────────────────────

export interface HotelColumnSpec {
  key: string;
  label: string;
  required: boolean;
  description: string;
  aliases: string[];
}

export interface HotelImportFormat {
  columns: HotelColumnSpec[];
  formats: string[];
  max_file_mb: number;
  name_placeholder: string;
}

export interface HotelCandidate {
  id: number;
  nume: string;
  masini: string[];
}

export interface HotelTire {
  rand: number;
  dimensiune: string | null;
  marca: string | null;
  profil: string | null;
  sarcina: number | null;
  viteza: string | null;
  dot: string | null;
  adancime: number | null;
  tip: "iarna" | "vara" | "ms" | "altele";
}

/** Decizia pentru o cazare: ce client, ce data, ce loc. */
export interface HotelValues {
  client_mode: "existing" | "new" | null;
  client_id: number | null;
  client_nume: string | null;
  client_telefon: string | null;
  numar_masina: string | null;
  data_checkin: string | null;
  loc: string | null;
  confirmed?: boolean;
}

/** Ce a venit din fisier pentru o cazare. */
export interface HotelOriginal {
  nume: string | null;
  prenume: string | null;
  numar_masina: string;
  data: string | null;
  depozit: string | null;
  telefon: string | null;
  randuri: number[];
  anvelope: HotelTire[];
  candidates: HotelCandidate[];
  match_issue: ImportIssue | null;
}

export type HotelRow = ImportRow<HotelValues, HotelOriginal>;

export interface HotelPreviewIssue {
  row: number;
  rows: number[];
  issue: ImportIssue;
  numar_masina: string;
  nume_fisier: string | null;
  data: string | null;
  loc: string | null;
  anvelope: number;
  client: string | null;
  candidates: HotelCandidate[];
  messages: string[];
}

export interface HotelImportPreview {
  format: string;
  sheet: string | null;
  columns_recognized: string[];
  columns_ignored: string[];
  file_warnings: string[];
  lines: number;
  cazari: number;
  anvelope: number;
  to_import: number;
  to_review: number;
  issues_by_type: Partial<Record<ImportIssue, number>>;
  new_locations: string[];
  /** Mărci care nu există în lista platformei: importul le propune spre aprobare. */
  new_brands: [string, number][];
  issues: HotelPreviewIssue[];
}

// ─── Revert ──────────────────────────────────────────────────────────────────

/** Ce sterge / pastreaza anularea unui import (campurile depind de tip). */
export interface RevertSummary {
  dry_run: boolean;
  pending_closed: number;
  clients_deleted: number;
  clients_kept: number;
  cazari_deleted?: number;
  cazari_kept?: number;
  anvelope_deleted?: number;
  vehicole_deleted?: number;
  nomenclatoare_deleted?: number;
  kept: { row: number | null; label: string | null; reason: string }[];
}

export interface RowsSelection {
  row_ids?: number[];
  all_pending?: boolean;
  /** Cu `all_pending`: doar randurile cu aceasta problema. */
  issue?: ImportIssue | null;
  force_duplicates?: boolean;
}

export type PendingSummary = Partial<Record<ImportKind, { sessions: number; rows: number }>>;

/** Eroare la importul unui rand, cu randul actualizat de server (mesaje noi). */
export class RowImportError<R = ImportRow> extends ApiError {
  row: R | null;
  constructor(status: number, message: string, row: R | null) {
    super(status, message);
    this.row = row;
  }
}

/** Importul nu a pornit: altul e in curs sau fisierul a fost deja importat. */
export class ImportConflictError extends ApiError {
  sessionId: number;
  reason: "in_progress" | "same_file";
  constructor(message: string, sessionId: number, reason: "in_progress" | "same_file") {
    super(409, message);
    this.sessionId = sessionId;
    this.reason = reason;
  }
}

const base = "/api/import";
const rows = (sid: number) => `${base}/sessions/${sid}/rows`;

function upload(file: File, dryRun: boolean, force = false, locationId?: number | null): FormData {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("dry_run", String(dryRun));
  fd.append("force", String(force));
  // Doar importul hotelului o trimite: cazarile apartin unui punct de lucru.
  if (locationId != null) fd.append("location_id", String(locationId));
  return fd;
}

/** Porneste importul: serverul raspunde imediat (202) cu sesiunea in starea
 *  `processing`; progresul se urmareste cu `session(id)`. */
async function startImport(
  kind: ImportKind, file: File, force: boolean, locationId?: number | null,
): Promise<ImportSession> {
  const res = await http.raw(`${base}/${kind}`, { method: "POST", body: upload(file, false, force, locationId) });
  if (res.status === 409) {
    const data = await res.json().catch(() => ({})) as { detail?: string; session_id?: number; reason?: "in_progress" | "same_file" };
    throw new ImportConflictError(data.detail ?? "Importul nu a putut porni.", data.session_id ?? 0, data.reason ?? "in_progress");
  }
  await ensureOk(res, "Importul a eșuat.");
  return res.json() as Promise<ImportSession>;
}

export const importApi = {
  clientiFormat: () => http.get<ClientImportFormat>(`${base}/clienti/format`),
  hotelFormat: () => http.get<HotelImportFormat>(`${base}/hotel/format`),

  previewClienti: (file: File) =>
    http.upload<ClientImportPreview>(`${base}/clienti`, upload(file, true), { errorMessage: "Fișierul nu a putut fi verificat." }),
  previewHotel: (file: File) =>
    http.upload<HotelImportPreview>(`${base}/hotel`, upload(file, true), { errorMessage: "Fișierul nu a putut fi verificat." }),

  importClienti: (file: File, force = false) => startImport("clienti", file, force),
  importHotel: (file: File, force = false, locationId?: number | null) =>
    startImport("hotel", file, force, locationId),

  pending: () => http.get<PendingSummary>(`${base}/pending`),

  sessions: (kind: ImportKind, query: { limit?: number; offset?: number } = {}) =>
    http.get<{ items: ImportSession[]; total: number }>(`${base}/sessions`, { query: { kind, ...query } }),

  session: (sid: number) => http.get<ImportSession>(`${base}/sessions/${sid}`),

  rows: <R = ImportRow>(sid: number, query: { status?: ImportRowStatus | null; issue?: ImportIssue | null; limit?: number; offset?: number }) =>
    http.get<{ items: R[]; total: number; pending_by_issue: Record<string, number> }>(rows(sid), { query }),

  saveRow: <R = ImportRow>(sid: number, rowId: number, values: object) =>
    http.patch<R>(`${rows(sid)}/${rowId}`, { values }, { errorMessage: "Rândul nu a putut fi salvat." }),

  /** La refuz (409) serverul trimite si randul revalidat — il pastram pe eroare. */
  async importRow<R = ImportRow>(sid: number, rowId: number, body: { values?: object; force_duplicate?: boolean }): Promise<R> {
    const res = await http.raw(`${rows(sid)}/${rowId}/import`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({})) as { detail?: string; row?: R };
      throw new RowImportError<R>(409, data.detail ?? "Rândul nu poate fi importat.", data.row ?? null);
    }
    await ensureOk(res, "Rândul nu a putut fi importat.");
    return res.json() as Promise<R>;
  },

  importRows: (sid: number, body: RowsSelection) =>
    http.post<{ imported: number; failed: { row_id: number; row: number; message: string }[] }>(
      `${rows(sid)}/import`, body, { errorMessage: "Importul rândurilor a eșuat." },
    ),

  rejectRows: (sid: number, body: RowsSelection) =>
    http.post<{ rejected: number }>(`${rows(sid)}/reject`, body, { errorMessage: "Respingerea a eșuat." }),

  restoreRows: (sid: number, rowIds: number[]) =>
    http.post<{ restored: number }>(`${rows(sid)}/restore`, { row_ids: rowIds }, { errorMessage: "Rândurile nu au putut fi readuse." }),

  revert: (sid: number, dryRun: boolean) =>
    http.post<RevertSummary>(`${base}/sessions/${sid}/revert`, { dry_run: dryRun }, { errorMessage: "Anularea importului a eșuat." }),

  /** Raportul complet al sesiunii (CSV): fiecare rând din fișier cu ce s-a
   *  întâmplat cu el. Numele fișierului vine de la server. */
  async downloadReport(sid: number): Promise<void> {
    const res = await http.raw(`${base}/sessions/${sid}/export`);
    await ensureOk(res, "Raportul nu a putut fi descărcat.");
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1]
      ?? `raport_import_${sid}.csv`;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
};
