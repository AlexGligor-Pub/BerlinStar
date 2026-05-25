import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

// Textul default afișat pe PDF-ul Fișei de Lucru când utilizatorul nu l-a
// personalizat. Folosit și ca placeholder în câmpul de configurare.
export const DEFAULT_FDL_DISCLAIMER =
  "Acest document reprezintă o estimare a costurilor și timpului de manoperă pe baza constatărilor inițiale. " +
  "Valorile sunt orientative și pot fi modificate la executarea efectivă a lucrării, în funcție de starea " +
  "reală a pieselor și descoperirile pe parcursul lucrului. Devizul final cu valorile reale se emite la " +
  "finalizarea lucrării.";

export interface GeneralSettingsData {
  useFactura: boolean;
  useAviz: boolean;
  afiseazaTehnicianDeviz: boolean;
  dezactiveazaHotelAnvelope: boolean;
  activeazaFisaDeLucru: boolean;
  fdlDisclaimerText: string | null;

  montareRotiShowPresiune: boolean;
  montareRotiShowMarca: boolean;
  montareRotiShowProfil: boolean;
  montareRotiShowDimensiune: boolean;
  montareRotiShowDot: boolean;
  montareRotiShowTip: boolean;
  montareRotiShowAdancime: boolean;
  montareRotiShowCuplu: boolean;
  montareRotiShowIndiceViteza: boolean;
  montareRotiShowIndiceSarcina: boolean;

  hotelAnvelopeShowProfil: boolean;
  hotelAnvelopeShowDot: boolean;
  hotelAnvelopeShowAdancime: boolean;
  hotelAnvelopeShowTip: boolean;
  hotelAnvelopeShowIndiceViteza: boolean;
  hotelAnvelopeShowIndiceSarcina: boolean;
}

export type GeneralSettingsPatch = Partial<GeneralSettingsData>;

const API_KEY_MAP: Record<keyof GeneralSettingsData, string> = {
  useFactura: "use_factura",
  useAviz: "use_aviz",
  afiseazaTehnicianDeviz: "afiseaza_tehnician_deviz",
  dezactiveazaHotelAnvelope: "dezactiveaza_hotel_anvelope",
  activeazaFisaDeLucru: "activeaza_fisa_de_lucru",
  fdlDisclaimerText: "fdl_disclaimer_text",
  montareRotiShowPresiune: "montare_roti_show_presiune",
  montareRotiShowMarca: "montare_roti_show_marca",
  montareRotiShowProfil: "montare_roti_show_profil",
  montareRotiShowDimensiune: "montare_roti_show_dimensiune",
  montareRotiShowDot: "montare_roti_show_dot",
  montareRotiShowTip: "montare_roti_show_tip",
  montareRotiShowAdancime: "montare_roti_show_adancime",
  montareRotiShowCuplu: "montare_roti_show_cuplu",
  montareRotiShowIndiceViteza: "montare_roti_show_indice_viteza",
  montareRotiShowIndiceSarcina: "montare_roti_show_indice_sarcina",
  hotelAnvelopeShowProfil: "hotel_anvelope_show_profil",
  hotelAnvelopeShowDot: "hotel_anvelope_show_dot",
  hotelAnvelopeShowAdancime: "hotel_anvelope_show_adancime",
  hotelAnvelopeShowTip: "hotel_anvelope_show_tip",
  hotelAnvelopeShowIndiceViteza: "hotel_anvelope_show_indice_viteza",
  hotelAnvelopeShowIndiceSarcina: "hotel_anvelope_show_indice_sarcina",
};

function mapFromApi(data: any): GeneralSettingsData {
  return {
    useFactura: data.use_factura ?? true,
    useAviz: data.use_aviz ?? true,
    afiseazaTehnicianDeviz: data.afiseaza_tehnician_deviz ?? false,
    dezactiveazaHotelAnvelope: data.dezactiveaza_hotel_anvelope ?? false,
    activeazaFisaDeLucru: data.activeaza_fisa_de_lucru ?? false,
    fdlDisclaimerText: data.fdl_disclaimer_text ?? null,
    montareRotiShowPresiune: data.montare_roti_show_presiune ?? true,
    montareRotiShowMarca: data.montare_roti_show_marca ?? true,
    montareRotiShowProfil: data.montare_roti_show_profil ?? true,
    montareRotiShowDimensiune: data.montare_roti_show_dimensiune ?? true,
    montareRotiShowDot: data.montare_roti_show_dot ?? true,
    montareRotiShowTip: data.montare_roti_show_tip ?? true,
    montareRotiShowAdancime: data.montare_roti_show_adancime ?? true,
    montareRotiShowCuplu: data.montare_roti_show_cuplu ?? true,
    montareRotiShowIndiceViteza: data.montare_roti_show_indice_viteza ?? false,
    montareRotiShowIndiceSarcina: data.montare_roti_show_indice_sarcina ?? false,
    hotelAnvelopeShowProfil: data.hotel_anvelope_show_profil ?? true,
    hotelAnvelopeShowDot: data.hotel_anvelope_show_dot ?? true,
    hotelAnvelopeShowAdancime: data.hotel_anvelope_show_adancime ?? true,
    hotelAnvelopeShowTip: data.hotel_anvelope_show_tip ?? true,
    hotelAnvelopeShowIndiceViteza: data.hotel_anvelope_show_indice_viteza ?? false,
    hotelAnvelopeShowIndiceSarcina: data.hotel_anvelope_show_indice_sarcina ?? false,
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

export async function updateGeneralSettings(patch: GeneralSettingsPatch): Promise<void> {
  const body: Record<string, boolean | string | null> = {};
  for (const k of Object.keys(patch) as (keyof GeneralSettingsData)[]) {
    const value = patch[k];
    if (value !== undefined) body[API_KEY_MAP[k]] = value;
  }

  const res = await apiFetch("/api/general-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Eroare la salvarea setărilor.");
  const data = mapFromApi(await res.json());
  setGeneralSettings(data);
  saveToLS(data);
}
