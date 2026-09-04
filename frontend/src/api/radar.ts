import { http, ensureOk, ApiError } from "./client";
import { readApiError } from "../utils/api";
import { adminFetch } from "../pages/adminv2/admin-auth";

export type RadarKind = "youtube" | "company" | "website" | "gbusiness";
export type RadarSchedule = "off" | "weekly" | "monthly";
export type RadarStatus = "queued" | "running" | "done" | "error";
export type Impact = "high" | "medium" | "low";
export type Sentiment = "positive" | "negative" | "neutral";
export type Confidence = "high" | "medium" | "low";
export type Horizon = "acum" | "30_zile" | "trimestru";
export type Trend = "up" | "down" | "flat" | "unknown";
export type NoveltyCategory = "echipament" | "serviciu" | "tehnologie" | "pret" | "altceva";

export interface RadarSettings {
  focus_prompt: string;
  business_context: string;
  schedule: RadarSchedule;
  ai_configured: boolean;
  places_configured: boolean;
  model: string;
}

export interface RadarSettingsUpdate {
  focus_prompt?: string;
  business_context?: string;
  schedule?: RadarSchedule;
}

export interface RadarSource {
  id: number;
  kind: RadarKind;
  label: string;
  value: string;
  meta: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  last_collected_at: string | null;
  last_error: string | null;
  snapshots_count: number;
}

export interface RadarSourceCreate {
  kind: RadarKind;
  value: string;
  label?: string;
}

export interface RadarSourceUpdate {
  label?: string;
  enabled?: boolean;
}

export interface RadarSnapshot {
  id: number;
  external_id: string;
  collected_at: string;
  payload: Record<string, unknown> | null;
  digest: Record<string, unknown> | null;
}

export interface RadarProgress {
  step?: string;
  done?: number;
  total?: number;
  log?: string[];
}

export interface RadarRun {
  id: number;
  status: RadarStatus;
  trigger: "manual" | "scheduled";
  started_at: string;
  finished_at: string | null;
  error: string | null;
  progress: RadarProgress | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  title: string | null;
  period_from: string | null;
  period_to: string | null;
  report?: ReportDoc | null;
}

export interface KeySignal {
  title: string;
  insight: string;
  impact: Impact;
  sentiment: Sentiment;
  source_refs?: number[];
}

export interface Recommendation {
  title: string;
  rationale: string;
  action: string;
  priority: number;
  horizon: Horizon;
  confidence: Confidence;
  source_refs?: number[];
}

export interface DecisionOption {
  option: string;
  pros?: string[];
  cons?: string[];
  evidence?: string[];
}

export interface DecisionFrame {
  question: string;
  options?: DecisionOption[];
  recommended: string;
  risks?: string[];
}

export interface YoutubeDigest {
  snapshot_id: number;
  source_label: string;
  video_title: string;
  url: string;
  published_at: string | null;
  summary: string;
  achievements?: string[];
  selling: boolean;
  selling_what: string;
  call_to_action: string;
  sentiment: Sentiment;
  relevance: number;
}

export interface CompanyFinancials {
  year: number;
  turnover: number | null;
  profit: number | null;
  employees: number | null;
}

export interface CompanyDigest {
  snapshot_id: number;
  source_label: string;
  cui: string;
  name: string;
  vat_payer: boolean | null;
  status: string;
  financials?: CompanyFinancials[];
  trend: Trend;
  commentary: string;
}

export interface WebsiteNovelty {
  title: string;
  description: string;
  image_url: string | null;
  link: string | null;
  category: NoveltyCategory;
}

export interface WebsiteDigest {
  snapshot_id: number;
  source_label: string;
  url: string;
  title: string;
  novelties?: WebsiteNovelty[];
  commentary: string;
}

export interface ReviewTheme {
  theme: string;
  sentiment: Sentiment;
  count: number;
  example: string;
}

export interface ReviewDigest {
  snapshot_id: number;
  source_label: string;
  name: string;
  rating: number | null;
  reviews_count: number | null;
  themes?: ReviewTheme[];
  praise?: string[];
  complaints?: string[];
  commentary: string;
}

export interface ReportSections {
  youtube?: YoutubeDigest[];
  companies?: CompanyDigest[];
  websites?: WebsiteDigest[];
  reviews?: ReviewDigest[];
}

export interface ReportDoc {
  version: number;
  generated_at: string;
  period: { from: string; to: string };
  title: string;
  executive_summary: string;
  key_signals?: KeySignal[];
  recommendations?: Recommendation[];
  decision_frame?: DecisionFrame | null;
  sections?: ReportSections;
  history_delta: string;
  data_gaps?: string[];
}

export interface UsageBucket {
  month: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export interface UsageFeatureBucket {
  feature: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export interface RadarUsage {
  total_in: number;
  total_out: number;
  total_cost_usd: number;
  by_month: UsageBucket[];
  by_feature: UsageFeatureBucket[];
}

export interface AiSettings {
  anthropic_api_key_set: boolean;
  google_places_api_key_set: boolean;
  ai_model: string;
  ai_price_in_usd_mtok: number;
  ai_price_out_usd_mtok: number;
}

export interface AiSettingsUpdate {
  anthropic_api_key?: string;
  google_places_api_key?: string;
  ai_model?: string;
  ai_price_in_usd_mtok?: number;
  ai_price_out_usd_mtok?: number;
}

export interface AccountUsage {
  account_id: number;
  account_name: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  runs: number;
}

const BASE = "/api/radar";

export async function downloadRunPdf(id: number): Promise<void> {
  const res = await ensureOk(await http.raw(`${BASE}/runs/${id}/pdf`), "Nu am putut genera PDF-ul.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `radar-${id}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const radarApi = {
  settings: () => http.get<RadarSettings>(`${BASE}/settings`),
  updateSettings: (body: RadarSettingsUpdate) =>
    http.put<RadarSettings>(`${BASE}/settings`, body, { errorMessage: "Eroare la salvarea setărilor." }),
  suggestContext: () =>
    http.post<{ business_context: string }>(`${BASE}/settings/suggest-context`, undefined, {
      errorMessage: "Nu am putut genera descrierea afacerii.",
    }),

  sources: () => http.get<RadarSource[]>(`${BASE}/sources`),
  createSource: (body: RadarSourceCreate) =>
    http.post<RadarSource>(`${BASE}/sources`, body, { errorMessage: "Nu am putut adăuga sursa." }),
  updateSource: (id: number, body: RadarSourceUpdate) =>
    http.put<RadarSource>(`${BASE}/sources/${id}`, body, { errorMessage: "Eroare la salvarea sursei." }),
  deleteSource: (id: number) => http.delete(`${BASE}/sources/${id}`, { errorMessage: "Eroare la ștergerea sursei." }),
  snapshots: (id: number, limit = 20) =>
    http.get<RadarSnapshot[]>(`${BASE}/sources/${id}/snapshots`, { query: { limit } }),

  startRun: () => http.post<RadarRun>(`${BASE}/runs`, undefined, { errorMessage: "Nu am putut porni analiza." }),
  runs: (limit = 20) => http.get<RadarRun[]>(`${BASE}/runs`, { query: { limit } }),
  run: (id: number) => http.get<RadarRun>(`${BASE}/runs/${id}`),
  deleteRun: (id: number) => http.delete(`${BASE}/runs/${id}`, { errorMessage: "Eroare la ștergerea raportului." }),
  downloadRunPdf,

  usage: (months = 6) => http.get<RadarUsage>(`${BASE}/usage`, { query: { months } }),
};

async function adminJson<T>(url: string, init: RequestInit = {}, fallback = "Eroare."): Promise<T> {
  const res = await adminFetch(url, init);
  if (!res.ok) throw new ApiError(res.status, await readApiError(res, fallback));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const aiAdminApi = {
  settings: () => adminJson<AiSettings>("/api/admin/ai-settings", {}, "Nu am putut încărca setările AI."),
  saveSettings: (body: AiSettingsUpdate) =>
    adminJson<AiSettings>(
      "/api/admin/ai-settings",
      { method: "PUT", body: JSON.stringify(body) },
      "Eroare la salvarea setărilor AI.",
    ),
  usage: (months = 6) =>
    adminJson<AccountUsage[]>(`/api/admin/ai-usage?months=${months}`, {}, "Nu am putut încărca consumul AI."),
};
