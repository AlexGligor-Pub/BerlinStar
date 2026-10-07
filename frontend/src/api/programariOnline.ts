import { http } from "./client";

// Programari online — configurarea per locatie si cheile API ale site-ului
// public (backend: app/routers/booking_settings.py).

export interface BookingHours {
  weekday: number; // 0 = luni … 6 = duminica
  open_time: string; // "08:00" sau "08:00:00"
  close_time: string;
}

export interface BookingServiceItem {
  id: number | null;
  name: string;
  duration_minutes: number;
  active: boolean;
}

export interface BookingSettings {
  location_id: number;
  enabled: boolean;
  site_name: string;
  public_slug: string | null; // adresa serverului MCP: /mcp/<public_slug>
  mcp_url?: string | null; // absoluta, cand serverul are MCP_PUBLIC_BASE_URL
  department_id: number | null;
  slot_minutes: number;
  capacity: number;
  lead_minutes: number;
  horizon_days: number;
  cancel_cutoff_minutes: number;
  closed_on_holidays: boolean;
  hours: BookingHours[];
  services: BookingServiceItem[];
}

export type BookingSettingsWrite = Omit<BookingSettings, "location_id">;

export interface PublicApiKey {
  id: number;
  location_id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface PublicApiKeyCreated extends PublicApiKey {
  key: string;
}

export const programariOnlineApi = {
  getSettings: (locationId: number) =>
    http.get<BookingSettings>(`/api/programari-online/settings/${locationId}`),
  saveSettings: (locationId: number, body: BookingSettingsWrite) =>
    http.put<BookingSettings>(`/api/programari-online/settings/${locationId}`, body, {
      errorMessage: "Eroare la salvarea programărilor online.",
    }),
  listKeys: () => http.get<PublicApiKey[]>("/api/programari-online/keys"),
  createKey: (location_id: number, name: string) =>
    http.post<PublicApiKeyCreated>("/api/programari-online/keys", { location_id, name }),
  revokeKey: (id: number) => http.delete(`/api/programari-online/keys/${id}`),
};
