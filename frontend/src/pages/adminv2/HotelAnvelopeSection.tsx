import { Show, createSignal, onMount } from "solid-js";
import { notify } from "../../store/notificationsStore";
import { invalidateHotelImages } from "../../store/hotelAnvelopeStore";
import { adminFetch } from "./admin-auth";
import type { HotelImages } from "./types";
import ImageUploadDialog from "./ImageUploadDialog";

export default function HotelAnvelopeSection() {
  const [images, setImages] = createSignal<HotelImages>({
    hotel_cazare_image_path: null,
    hotel_scoatere_image_path: null,
    hotel_montare_image_path: null,
  });
  const [dialogType, setDialogType] = createSignal<"cazare" | "scoatere" | "montare" | null>(null);

  onMount(async () => {
    try {
      const res = await adminFetch("/api/global-settings/hotel-anvelope");
      if (res.ok) setImages(await res.json() as HotelImages);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Eroare la încărcare imagini hotel.";
      notify(msg, "error");
    }
  });

  return (
    <div>
      <div class="page-header" style="margin-bottom:16px">
        <h2 class="page-title" style="font-size:1.25rem">Hotel Anvelope — Imagini</h2>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;line-height:1.55;color:var(--text)">
        <p style="margin:0 0 8px;font-weight:600">Cele 3 imagini se afișează pe ecranele și PDF-urile din fluxul <strong>Hotel Anvelope</strong>:</p>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
          <li>
            <strong>Cazare Roți</strong> — vizibilă în pagina <em>Hotel Anvelope</em> pe cardul de cazare nouă (checkin),
            în modalul de cazare a setului de anvelope, și ca imagine laterală în PDF-ul <em>Hotel Anvelope — Cazare</em>
            generat din pagina Hotel Anvelope și inclus în PDF-ul combinat <em>Deviz + Operații</em> de la Recepție.
          </li>
          <li>
            <strong>Scoatere Roți</strong> — vizibilă în pagina <em>Hotel Anvelope</em> când se procesează scoaterea unui set
            de anvelope (checkout), în modalul de scoatere, și ca imagine laterală în PDF-urile
            <em>Hotel Anvelope — Scoatere</em> și <em>Scoatere și Cazare Nouă</em> (când roțile NU sunt remontate pe mașină).
          </li>
          <li>
            <strong>Montare Roți</strong> — vizibilă în pagina <em>Hotel Anvelope</em> la modalul de
            <em>Scoatere și Introducere nouă</em> când roțile sunt remontate pe mașină, și ca imagine laterală în PDF-urile
            <em>Montare Roți</em> (de la Recepție) și <em>Scoatere și Cazare Nouă</em> (când roțile sunt montate pe mașină).
          </li>
        </ul>
        <p style="margin:10px 0 0;color:var(--text-muted);font-size:12px">
          Apasă pe o imagine pentru a o înlocui. Imaginile sunt comune pentru toți utilizatorii și se aplică imediat în întreaga aplicație.
        </p>
      </div>

      <div class="hotel-img-grid">
        {/* Cazare Roti */}
        <div
          class="hotel-img-card"
          role="button"
          tabIndex={0}
          onClick={() => setDialogType("cazare")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDialogType("cazare"))}
          aria-label="Modifică imaginea Cazare Roți"
        >
          <div class="hotel-img-card__title">Cazare Roti</div>
          <Show
            when={images().hotel_cazare_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_cazare_image_path!}
              class="hotel-img-card__img"
              alt="Cazare Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>

        {/* Scoatere Roti */}
        <div
          class="hotel-img-card"
          role="button"
          tabIndex={0}
          onClick={() => setDialogType("scoatere")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDialogType("scoatere"))}
          aria-label="Modifică imaginea Scoatere Roți"
        >
          <div class="hotel-img-card__title">Scoatere Roti</div>
          <Show
            when={images().hotel_scoatere_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_scoatere_image_path!}
              class="hotel-img-card__img"
              alt="Scoatere Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>

        {/* Montare Roti */}
        <div
          class="hotel-img-card"
          role="button"
          tabIndex={0}
          onClick={() => setDialogType("montare")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDialogType("montare"))}
          aria-label="Modifică imaginea Montare Roți"
        >
          <div class="hotel-img-card__title">Montare Roti</div>
          <Show
            when={images().hotel_montare_image_path}
            fallback={
              <div class="hotel-img-card__placeholder">
                <span>Nicio imagine</span>
                <span class="text-muted" style="font-size:12px">Apasă pentru a adăuga</span>
              </div>
            }
          >
            <img
              src={images().hotel_montare_image_path!}
              class="hotel-img-card__img"
              alt="Montare Roti"
            />
          </Show>
          <div class="hotel-img-card__overlay">
            <span>Schimbă imaginea</span>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Show when={dialogType() === "cazare"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Cazare Roti"
          currentUrl={images().hotel_cazare_image_path}
          endpoint="/api/global-settings/hotel-cazare-image"
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_cazare_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "scoatere"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Scoatere Roti"
          currentUrl={images().hotel_scoatere_image_path}
          endpoint="/api/global-settings/hotel-scoatere-image"
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_scoatere_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
          onClose={() => setDialogType(null)}
        />
      </Show>

      <Show when={dialogType() === "montare"}>
        <ImageUploadDialog
          title="Schimbă imaginea — Montare Roti"
          currentUrl={images().hotel_montare_image_path}
          endpoint="/api/global-settings/hotel-montare-image"
          onSaved={(url) => { setImages((prev) => ({ ...prev, hotel_montare_image_path: url + "?t=" + Date.now() })); invalidateHotelImages(); }}
          onClose={() => setDialogType(null)}
        />
      </Show>
    </div>
  );
}
