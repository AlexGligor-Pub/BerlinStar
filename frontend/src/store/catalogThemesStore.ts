import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface CatalogTheme {
  id: number;
  name: string;
}

const [catalogThemes, setCatalogThemes] = createSignal<CatalogTheme[]>([]);

export async function loadCatalogThemes(locationId?: number | null) {
  try {
    const qs = locationId != null ? `&location_id=${locationId}` : "";
    const res = await apiFetch(`/api/themes?limit=100${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setCatalogThemes(
      data.items.map((t: any) => ({ id: t.id, name: t.name }))
    );
  } catch {}
}

export { catalogThemes };
