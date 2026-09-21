/**
 * Comutatoarele de funcționalități opționale ale platformei (AdminV2).
 *
 * Meniul se desenează din ele, deci se încarcă o dată, la pornirea aplicației.
 * Până vine răspunsul, meniul presupune că totul e pornit — altfel elementele
 * ar clipi, apărând abia după cerere. Rutele unei funcționalități stingibile
 * așteaptă însă răspunsul (`featuresLoaded`), ca pagina să nu apuce să pornească
 * și să ceară date unui server care o refuză.
 */
import { createSignal } from "solid-js";
import { apiFetch } from "../utils/api";

export interface Features {
  radar: boolean;
}

const [features, setFeatures] = createSignal<Features>({ radar: true });
const [featuresLoaded, setFeaturesLoaded] = createSignal(false);

export { features, featuresLoaded };

export const radarEnabled = () => features().radar;

/** Pauzele dintre reîncercări, dacă cererea eșuează (ex. stație pornită offline). */
const RETRY_MS = [5_000, 30_000, 120_000];
let attempt = 0;
let inFlight: Promise<void> | null = null;

export function loadFeatures(): Promise<void> {
  if (featuresLoaded()) return Promise.resolve();
  inFlight ??= (async () => {
    try {
      const res = await apiFetch("/api/global-settings/features");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Partial<Features>;
      setFeatures({ radar: data.radar !== false });
      setFeaturesLoaded(true);
    } catch {
      if (attempt < RETRY_MS.length) {
        setTimeout(() => void loadFeatures(), RETRY_MS[attempt++]);
      } else {
        // După ultima încercare rămânem pe presupunerea „pornit": mai bine un
        // element de meniu în plus decât o aplicație ciuntită de rețea.
        setFeaturesLoaded(true);
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** După ce administratorul schimbă comutatorul, meniul se actualizează imediat. */
export function setFeature<K extends keyof Features>(key: K, value: Features[K]): void {
  setFeatures({ ...features(), [key]: value });
}
