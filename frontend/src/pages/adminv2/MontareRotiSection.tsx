import { For, Show, createSignal, onMount } from "solid-js";
import { invalidateMontareRotiImages } from "../../store/montajRotiStore";
import { adminFetch } from "./admin-auth";
import ImageUploadDialog from "./ImageUploadDialog";

type MontarePozitie =
  | "stanga_fata"
  | "dreapta_fata"
  | "stanga_spate"
  | "dreapta_spate"
  | "rezerva"
  | "nespecificat";

interface MontareRotiImagesAdmin {
  montare_stanga_fata_image_path: string | null;
  montare_dreapta_fata_image_path: string | null;
  montare_stanga_spate_image_path: string | null;
  montare_dreapta_spate_image_path: string | null;
  montare_rezerva_image_path: string | null;
  montare_nespecificat_image_path: string | null;
}

const MONTARE_POZITII: { id: MontarePozitie; label: string }[] = [
  { id: "stanga_fata", label: "Stânga Față" },
  { id: "dreapta_fata", label: "Dreapta Față" },
  { id: "stanga_spate", label: "Stânga Spate" },
  { id: "dreapta_spate", label: "Dreapta Spate" },
  { id: "rezerva", label: "Rezervă" },
  { id: "nespecificat", label: "Nespecificat" },
];


export default function MontareRotiSection() {
  const [images, setImages] = createSignal<MontareRotiImagesAdmin>({
    montare_stanga_fata_image_path: null,
    montare_dreapta_fata_image_path: null,
    montare_stanga_spate_image_path: null,
    montare_dreapta_spate_image_path: null,
    montare_rezerva_image_path: null,
    montare_nespecificat_image_path: null,
  });
  const [dialogPozitie, setDialogPozitie] = createSignal<MontarePozitie | null>(null);

  onMount(async () => {
    try {
      const res = await adminFetch("/api/global-settings/montare-roti");
      if (res.ok) setImages(await res.json() as MontareRotiImagesAdmin);
    } catch {}
  });

  function currentUrl(pozitie: MontarePozitie): string | null {
    return images()[`montare_${pozitie}_image_path` as keyof MontareRotiImagesAdmin];
  }

  function onSavedFor(pozitie: MontarePozitie) {
    return (url: string) => {
      setImages((prev) => ({
        ...prev,
        [`montare_${pozitie}_image_path`]: url + "?t=" + Date.now(),
      }));
      invalidateMontareRotiImages();
    };
  }

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Montare Roți — Imagini per poziție</h2>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;line-height:1.55;color:var(--text)">
        <p style="margin:0 0 8px;font-weight:600">Aceste 6 imagini se folosesc în modalul „Montare Roți" din POS / Recepție:</p>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
          <li>În <em>Pagina POS</em> (Listă de cumpărături), butonul <strong>Montare Roți</strong> deschide un modal cu un card pentru fiecare roată.</li>
          <li>De asemenea, modalul poate fi deschis și din <em>Pagina Recepție</em> pentru o comandă existentă.</li>
        </ul>
        <p style="margin:10px 0 6px;font-weight:600">Cum se afișează imaginea în card:</p>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
          <li><strong>Dreapta Față / Dreapta Spate</strong> → imaginea apare în <em>coloana 1</em> (stânga cardului).</li>
          <li><strong>Stânga Față / Stânga Spate</strong> → imaginea apare în <em>coloana 3</em> (dreapta cardului).</li>
          <li><strong>Rezervă / Nespecificat</strong> → imaginea apare <em>sub cele 3 coloane</em>, pe toată lățimea cardului.</li>
        </ul>
        <p style="margin:10px 0 0;color:var(--text-muted);font-size:12px">
          Imaginea afișată se schimbă automat când utilizatorul modifică <em>Poziția</em> roții în modal.
          Pozițiile fără imagine configurată afișează un placeholder. Imaginile sunt comune pentru toți utilizatorii.
        </p>
      </div>

      <div class="hotel-img-grid">
        <For each={MONTARE_POZITII}>
          {(p) => (
            <div
              class="hotel-img-card"
              role="button"
              tabIndex={0}
              onClick={() => setDialogPozitie(p.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDialogPozitie(p.id))}
              aria-label={`Modifică imaginea pozitiei ${p.label}`}
            >
              <div class="hotel-img-card__title">{p.label}</div>
              <Show
                when={currentUrl(p.id)}
                fallback={
                  <div class="hotel-img-card__placeholder">
                    <span>Nicio imagine</span>
                    <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
                  </div>
                }
              >
                <img
                  src={currentUrl(p.id)!}
                  class="hotel-img-card__img"
                  alt={p.label}
                />
              </Show>
              <div class="hotel-img-card__overlay">
                <span>Schimbă imaginea</span>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={dialogPozitie() !== null}>
        <ImageUploadDialog
          title={`Schimbă imaginea — ${MONTARE_POZITII.find((p) => p.id === dialogPozitie())?.label}`}
          currentUrl={currentUrl(dialogPozitie()!)}
          endpoint={`/api/global-settings/montare-roti-image/${dialogPozitie()}`}
          onSaved={onSavedFor(dialogPozitie()!)}
          onClose={() => setDialogPozitie(null)}
        />
      </Show>
    </div>
  );
}
