/** Formularul unui client — folosit și la adăugare/editare din lista Clienți,
 *  și la editarea din fișa clientului.
 *
 *  Stă într-un singur loc pentru că e sursa adevărului despre ce câmpuri are un
 *  client și care depind de tip: persoana fizică are CNP, cea juridică are CUI
 *  (cu căutare ANAF) și reprezentant. Două copii ar începe să difere la primul
 *  câmp adăugat doar într-una.
 */
import { Show, createSignal } from "solid-js";
import { companiesApi, type AnafCompany } from "../../api/companies";
import { CNP_PLACEHOLDER, cnpError, cnpForSave, type Client, type ClientTip } from "../../types/client";

export interface ClientFormValues {
  tip: ClientTip;
  nume: string;
  description: string;
  cui: string;
  reprezentant: string;
  telefon: string;
  email: string;
  adresa: string;
  numar_masina: string;
  comments: string;
}

export function emptyClientForm(): ClientFormValues {
  return {
    tip: "fizic", nume: "", description: "", cui: CNP_PLACEHOLDER, reprezentant: "",
    telefon: "", email: "", adresa: "", numar_masina: "", comments: "",
  };
}

export function clientToForm(c: Client): ClientFormValues {
  return {
    tip: c.tip,
    nume: c.nume,
    description: c.description ?? "",
    cui: c.cui ?? CNP_PLACEHOLDER,
    reprezentant: c.reprezentant ?? "",
    telefon: c.telefon ?? "",
    email: c.email ?? "",
    adresa: c.adresa ?? "",
    numar_masina: c.numar_masina ?? "",
    comments: c.comments ?? "",
  };
}

/** Ce se trimite la server. Golul înseamnă „necompletat", adică `null`. */
export function clientFormPayload(f: ClientFormValues) {
  return {
    tip: f.tip,
    nume: f.nume.trim(),
    description: f.description.trim() || null,
    // La persoana fizică golul devine placeholderul de CNP cerut de e-Factura.
    cui: f.tip === "fizic" ? cnpForSave(f.cui) : (f.cui.trim() || null),
    reprezentant: f.reprezentant.trim() || null,
    telefon: f.telefon.trim() || null,
    email: f.email.trim() || null,
    adresa: f.adresa.trim() || null,
    numar_masina: f.numar_masina.trim() || null,
    comments: f.comments.trim() || null,
  };
}

/** Mesajul de eroare dacă formularul nu se poate salva, altfel `null`. */
export function clientFormError(f: ClientFormValues): string | null {
  if (!f.nume.trim()) return "Numele este obligatoriu.";
  if (f.tip === "fizic") return cnpError(f.cui);
  return null;
}

export default function ClientForm(props: {
  f: ClientFormValues;
  setF: (f: ClientFormValues) => void;
}) {
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError] = createSignal<string | null>(null);

  /** Completează numele, adresa și reprezentantul din registrul ANAF. */
  async function searchAnaf() {
    const cuiNum = parseInt(props.f.cui.replace(/\D/g, ""));
    if (!cuiNum) return;
    setAnafLoading(true);
    setAnafError(null);
    try {
      const res = await companiesApi.anafRaw(cuiNum);
      if (res.status === 404) { setAnafError("CUI-ul nu a fost găsit în ANAF."); return; }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as AnafCompany;
      props.setF({
        ...props.f,
        nume: data.name ?? props.f.nume,
        adresa: data.address ?? props.f.adresa,
        reprezentant: data.representative ?? props.f.reprezentant,
      });
    } catch {
      setAnafError("Eroare la interogarea ANAF.");
    } finally {
      setAnafLoading(false);
    }
  }

  return (
    <div class="cfg-location-fields">
      <div style="display:flex;gap:8px">
        <button
          class={`btn btn-sm ${props.f.tip === "fizic" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => props.setF({ ...props.f, tip: "fizic" })}
        >Persoană fizică</button>
        <button
          class={`btn btn-sm ${props.f.tip === "juridic" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => props.setF({ ...props.f, tip: "juridic" })}
        >Persoană juridică</button>
      </div>
      <Show when={props.f.tip === "fizic"}>
        <input class="input" placeholder="CNP" aria-label="CNP" inputmode="numeric" maxlength="13" value={props.f.cui} onFocus={(e) => e.currentTarget.select()} onInput={(e) => props.setF({ ...props.f, cui: e.currentTarget.value })} />
        <input class="input" placeholder="Număr mașină" aria-label="Număr mașină" value={props.f.numar_masina} onInput={(e) => props.setF({ ...props.f, numar_masina: e.currentTarget.value.toUpperCase() })} />
      </Show>
      <Show when={props.f.tip === "juridic"}>
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;gap:6px">
            <input
              class="input"
              style="flex:1"
              placeholder="CUI"
              aria-label="CUI"
              value={props.f.cui}
              onInput={(e) => { props.setF({ ...props.f, cui: e.currentTarget.value }); setAnafError(null); }}
              onKeyDown={(e) => e.key === "Enter" && void searchAnaf()}
            />
            <button
              class="btn btn-sm btn-ghost"
              onClick={() => void searchAnaf()}
              disabled={anafLoading() || !props.f.cui.trim()}
            >{anafLoading() ? "..." : "ANAF"}</button>
          </div>
          <Show when={anafError()}>
            <span style="color:var(--danger,#ef4444);font-size:12px">{anafError()}</span>
          </Show>
        </div>
        <input class="input" placeholder="Număr mașină" aria-label="Număr mașină" value={props.f.numar_masina} onInput={(e) => props.setF({ ...props.f, numar_masina: e.currentTarget.value.toUpperCase() })} />
      </Show>
      <input class="input" placeholder="Nume *" aria-label="Nume" value={props.f.nume} onInput={(e) => props.setF({ ...props.f, nume: e.currentTarget.value })} />
      <input class="input" placeholder="Descriere" aria-label="Descriere" value={props.f.description} onInput={(e) => props.setF({ ...props.f, description: e.currentTarget.value })} />
      <Show when={props.f.tip === "juridic"}>
        <input class="input" placeholder="Reprezentant" aria-label="Reprezentant" value={props.f.reprezentant} onInput={(e) => props.setF({ ...props.f, reprezentant: e.currentTarget.value })} />
      </Show>
      <input class="input" placeholder="Telefon" aria-label="Telefon" value={props.f.telefon} onInput={(e) => props.setF({ ...props.f, telefon: e.currentTarget.value })} />
      <input class="input" placeholder="Email" aria-label="Email" value={props.f.email} onInput={(e) => props.setF({ ...props.f, email: e.currentTarget.value })} />
      <input class="input" placeholder="Adresă" aria-label="Adresă" value={props.f.adresa} onInput={(e) => props.setF({ ...props.f, adresa: e.currentTarget.value })} />
      <textarea class="input" placeholder="Comentarii" aria-label="Comentarii" rows={3} style="resize:vertical" value={props.f.comments} onInput={(e) => props.setF({ ...props.f, comments: e.currentTarget.value })} />
    </div>
  );
}
