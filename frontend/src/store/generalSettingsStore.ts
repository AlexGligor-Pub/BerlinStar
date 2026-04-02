import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface GeneralSettingsData {
  useFactura: boolean;
  useAviz: boolean;
}

function mapFromApi(data: any): GeneralSettingsData {
  return {
    useFactura: data.use_factura,
    useAviz: data.use_aviz,
  };
}

const LS_KEY = "general_settings";

function saveToLS(data: GeneralSettingsData): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadFromLS(): GeneralSettingsData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeneralSettingsData;
  } catch { return null; }
}

const [generalSettings, setGeneralSettings] = createSignal<GeneralSettingsData | null>(loadFromLS());

export { generalSettings };

export async function loadGeneralSettings(): Promise<void> {
  try {
    const res = await apiFetch("/api/general-settings");
    if (!res.ok) return;
    const data = mapFromApi(await res.json());
    setGeneralSettings(data);
    saveToLS(data);
  } catch {
    // păstrează valoarea existentă la eroare de rețea
  }
}

export async function updateGeneralSettings(
  patch: Partial<{ useFactura: boolean; useAviz: boolean }>
): Promise<void> {
  const body: Record<string, boolean> = {};
  if (patch.useFactura !== undefined) body.use_factura = patch.useFactura;
  if (patch.useAviz !== undefined) body.use_aviz = patch.useAviz;

  const res = await apiFetch("/api/general-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Eroare la salvarea setărilor.");
  const data = mapFromApi(await res.json());
  setGeneralSettings(data);
  saveToLS(data);
}
