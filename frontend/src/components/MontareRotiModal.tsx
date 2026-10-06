import { For, Index, Show, createMemo, createSignal, onMount } from "solid-js";
import { apiFetch, API_BASE, readJsonSafe, readApiError } from "../utils/api";
import { notify } from "../store/notificationsStore";
import SearchableSelect from "./SearchableSelect";
import {
  marci, dimensiuni, profiluri, coduriDot,
  loadMarci, loadDimensiuni, loadProfil, loadCoduriDot,
  invalidateMarciCache, invalidateDimensiuniCache, invalidateProfilCache, invalidateCoduriDotCache,
  type TipAnvelopa,
} from "../store/hotelAnvelopeStore";
import {
  bulkUpsertMontajRoti, defaultPozitieForIndex,
  POZITII_ORDONATE, POZITIE_LABELS,
  PRESIUNE_SHORTCUTS, CUPLU_SHORTCUTS, ADANCIME_SHORTCUTS, ADANCIME_DEFAULT,
  INDICE_VITEZA_SHORTCUTS, INDICE_SARCINA_SHORTCUTS,
  montareRotiImages, loadMontareRotiImages,
  type MontajRotaDraft, type PozitieRoata,
} from "../store/montajRotiStore";
import { generalSettings, type GeneralSettingsData } from "../store/generalSettingsStore";
import Modal from "./ui/Modal";
import DecimalInput from "./ui/DecimalInput";
import { parseDecimal } from "../utils/decimal";

const TIP_LABELS: Record<TipAnvelopa, string> = {
  iarna: "Iarnă",
  vara: "Vară",
  ms: "M+S",
  altele: "Altele",
};

interface RowDraft extends MontajRotaDraft {
  uid: number; // local-only id
}

let _uidSeq = 0;
function newUid(): number { return ++_uidSeq; }

const DEFAULT_PRESIUNE = 2.3;

function pozitieFaraCuplu(pozitie: PozitieRoata): boolean {
  return pozitie === "rezerva" || pozitie === "nespecificat";
}

function emptyRow(idx: number): RowDraft {
  const pozitie = defaultPozitieForIndex(idx);
  return {
    uid: newUid(),
    pozitie,
    presiune: DEFAULT_PRESIUNE,
    ordine: idx,
    marcaId: null,
    dimensiuneId: null,
    profilId: null,
    dotId: null,
    tip: "vara",
    adancime: ADANCIME_DEFAULT,
    cupluStrangere: pozitieFaraCuplu(pozitie) ? 0 : null,
    indiceViteza: null,
    indiceSarcina: null,
    comments: null,
  };
}

const SHORTCUT_BTN_STYLE = "font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer";

export default function MontareRotiModal(props: {
  receiptId: number;
  initialItems: MontajRotaDraft[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const seed: RowDraft[] = props.initialItems.length > 0
    ? props.initialItems.map((it, i) => ({ ...it, uid: newUid(), ordine: it.ordine ?? i }))
    : [emptyRow(0)];

  const [rows, setRows] = createSignal<RowDraft[]>(seed);
  const [saving, setSaving] = createSignal(false);
  const [err, setErr] = createSignal("");
  let bodyRef: HTMLDivElement | undefined;
  // Confirmare propunere marca noua (devine pending pana o aproba adminul).
  // Tinem si uid-ul randului care a declansat propunerea: daca marca exista
  // deja aprobata (409 status='approved'), o auto-selectam in randul corect.
  const [proposingMarca, setProposingMarca] = createSignal<{ name: string; rowUid: number } | null>(null);
  const [proposingBusy, setProposingBusy] = createSignal(false);

  function imageUrlForPozitie(pozitie: PozitieRoata): string | null {
    return montareRotiImages()[pozitie]
      ? `${API_BASE}/api/global-settings/montare-roti/image/${pozitie}`
      : null;
  }

  onMount(() => {
    loadMarci();
    loadDimensiuni();
    loadProfil();
    loadCoduriDot();
    loadMontareRotiImages();
  });

  function patchRow(uid: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(prev.length)]);
  }

  function copyRow(uid: number) {
    setRows((prev) => {
      const src = prev.find((r) => r.uid === uid);
      if (!src) return prev;
      const copy: RowDraft = {
        ...src,
        uid: newUid(),
        pozitie: defaultPozitieForIndex(prev.length),
        ordine: prev.length,
      };
      return [...prev, copy];
    });
  }

  function deleteRow(uid: number) {
    setRows((prev) => prev.filter((r) => r.uid !== uid).map((r, i) => ({ ...r, ordine: i })));
  }

  function addMarca(rowUid: number, name: string) {
    // Deschide modalul de confirmare; trimiterea efectiva are loc in confirmProposeMarca.
    setProposingMarca({ name: name.trim(), rowUid });
  }

  async function confirmProposeMarca() {
    const pending = proposingMarca();
    if (!pending) return;
    const { name, rowUid } = pending;
    setProposingBusy(true);
    try {
      const res = await apiFetch("/api/marci-anvelope/propune", {
        method: "POST",
        body: JSON.stringify({ nume: name }),
      });
      if (res.status === 201) {
        notify(
          `Propunere trimisă. Marca „${name}” va fi vizibilă după ce administratorul o aprobă.`,
          "info",
          6000,
        );
      } else if (res.status === 409) {
        const data = await readJsonSafe<{ detail?: { status?: string; message?: string; nume?: string; id?: number } }>(res);
        const detail = data?.detail;
        if (detail?.status === "approved") {
          invalidateMarciCache();
          await loadMarci(true);
          // Auto-selectam marca aprobata in randul care a declansat propunerea,
          // ca userul sa nu fie nevoit sa deschida iar dropdown-ul.
          if (detail.id != null) {
            patchRow(rowUid, { marcaId: detail.id });
          }
          notify(detail.message ?? `Marca „${detail.nume ?? name}” există deja și a fost selectată.`, "info");
        } else if (detail?.status === "pending") {
          notify(detail.message ?? `Marca „${name}” este deja propusă și așteaptă aprobare.`, "warn", 6000);
        } else {
          notify(`Marca „${name}” există deja.`, "info");
        }
      } else {
        const msg = await readApiError(res, "Eroare la trimiterea propunerii.");
        notify(msg, "error");
      }
    } catch {
      notify("Eroare de rețea la trimiterea propunerii.", "error");
    } finally {
      setProposingBusy(false);
      setProposingMarca(null);
    }
  }
  async function addProfil(value: string) {
    const res = await apiFetch("/api/profiluri-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      invalidateProfilCache();
      await loadProfil(true);
    } else {
      notify(await readApiError(res, "Valoarea nu a putut fi adăugată."), "error");
    }
  }
  async function addDim(value: string) {
    const res = await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      invalidateDimensiuniCache();
      await loadDimensiuni(true);
    } else {
      notify(await readApiError(res, "Valoarea nu a putut fi adăugată."), "error");
    }
  }
  async function addDot(value: string) {
    const res = await apiFetch("/api/coduri-dot-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      invalidateCoduriDotCache();
      await loadCoduriDot(true);
    } else {
      notify(await readApiError(res, "Valoarea nu a putut fi adăugată."), "error");
    }
  }

  async function doSave() {
    // Un camp numeric cu text invalid (ex. „2,") are valoarea null in rand;
    // salvarea l-ar goli pe tacute. Oprim si aratam campul.
    // DecimalInput marcheaza un text neterminat abia la blur, iar pe tablete
    // (iOS Safari) atingerea butonului nu scoate focusul din camp: scoatem noi
    // focusul si recitim textul fiecarui camp numeric, fara sa ne bazam doar
    // pe aria-invalid.
    const active = document.activeElement;
    if (active instanceof HTMLElement && bodyRef?.contains(active)) active.blur();
    const numericInputs = Array.from(
      bodyRef?.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"], input[inputmode="numeric"]') ?? [],
    );
    const badInput = numericInputs.find((inp) =>
      inp.getAttribute("aria-invalid") === "true"
      || !parseDecimal(inp.value, { integer: inp.getAttribute("inputmode") === "numeric" }).valid,
    );
    if (badInput) {
      setErr("Un câmp numeric nu conține un număr valid. Corectează-l sau golește-l înainte de salvare.");
      badInput.focus();
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const items: MontajRotaDraft[] = rows().map((r, i) => ({
        pozitie: r.pozitie,
        presiune: r.presiune,
        ordine: i,
        marcaId: r.marcaId,
        dimensiuneId: r.dimensiuneId,
        profilId: r.profilId,
        dotId: r.dotId,
        tip: r.tip,
        adancime: r.adancime,
        cupluStrangere: r.cupluStrangere,
        indiceViteza: r.indiceViteza,
        indiceSarcina: r.indiceSarcina,
        comments: r.comments,
      }));
      await bulkUpsertMontajRoti(props.receiptId, items);
      props.onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  function imagePlacement(pozitie: PozitieRoata): "left" | "right" | "bottom" {
    if (pozitie === "stanga_fata" || pozitie === "stanga_spate") return "right";
    if (pozitie === "dreapta_fata" || pozitie === "dreapta_spate") return "left";
    return "bottom";
  }

  const showField = (key: keyof GeneralSettingsData): boolean => {
    const s = generalSettings();
    if (!s) return true;
    return s[key] !== false;
  };

  function renderWheelImage(pozitie: PozitieRoata, extraStyle: string = "") {
    const url = imageUrlForPozitie(pozitie);
    return (
      <div
        style={`min-height:120px;border:1px solid var(--border);border-radius:8px;overflow:hidden;position:relative;background:#fff;${extraStyle}`}
      >
        <Show
          when={url}
          fallback={
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;min-height:120px">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--border)">
                <rect x="2" y="3" width="20" height="18" rx="2" /><path d="M4 16l4-4 4 4 4-6 4 6" />
              </svg>
              <span style="font-size:11px;color:var(--text-muted);text-align:center">Nicio imagine configurată pentru această poziție</span>
            </div>
          }
        >
          <img
            src={url!}
            alt={POZITIE_LABELS[pozitie]}
            style="width:100%;height:100%;object-fit:contain;display:block"
          />
        </Show>
      </div>
    );
  }

  return (
    <Modal
      open
      title="Montare Roți"
      onClose={props.onClose}
      style="width:min(1500px,98vw);max-height:92vh"
      closeOnEscape={false}
      bodyClass="sl-modal-body--stack"
      footer={<>
        <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
        <button class="btn btn-primary btn-sm" disabled={saving() || rows().length === 0} onClick={doSave}>
          {saving() ? "Se salvează..." : "Salvează"}
        </button>
      </>}
    >
      <div ref={bodyRef} style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px">
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;align-items:start">
          {/* <Index>, nu <For>: patchRow inlocuieste obiectul randului la fiecare
              tasta, iar <For> (cheie = referinta) reconstruia tot randul si
              campul pierdea focusul dupa primul caracter. */}
          <Index each={rows()}>
            {(row, idx) => {
              // Memo: imaginea rotii si asezarea se refac doar cand se schimba
              // pozitia, nu la orice modificare a randului.
              const pozitie = createMemo(() => row().pozitie);
              const placement = () => imagePlacement(pozitie());
              return (
                <div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg)">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px">
                    <span style="font-size:12px;font-weight:600;color:var(--text-muted)">Roată #{idx + 1}</span>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-ghost btn-sm" onClick={() => copyRow(row().uid)}>Copiază</button>
                      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onClick={() => deleteRow(row().uid)}>✕</button>
                    </div>
                  </div>

                  {(() => {
                    const renderControls = () => (
                      <>
                        {/* Pozitie */}
                        <div>
                          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Poziție</label>
                          <select
                            class="input"
                            style="width:100%"
                            value={row().pozitie}
                            onChange={(e) => {
                              const newPoz = e.currentTarget.value as PozitieRoata;
                              const patch: Partial<RowDraft> = { pozitie: newPoz };
                              if (pozitieFaraCuplu(newPoz)) patch.cupluStrangere = 0;
                              patchRow(row().uid, patch);
                            }}
                          >
                            <For each={POZITII_ORDONATE}>
                              {(p) => <option value={p}>{POZITIE_LABELS[p]}</option>}
                            </For>
                          </select>
                        </div>

                        {/* Presiune */}
                        <Show when={showField("montareRotiShowPresiune")}>
                          <div>
                            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Presiune (bar)</label>
                            <DecimalInput
                              class="input"
                              style="width:100%"
                              value={row().presiune}
                              onInput={(_raw, v) => patchRow(row().uid, { presiune: v })}
                            />
                            <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                              <For each={PRESIUNE_SHORTCUTS}>
                                {(val) => (
                                  <button
                                    type="button"
                                    style={SHORTCUT_BTN_STYLE}
                                    onClick={() => patchRow(row().uid, { presiune: val })}
                                  >
                                    {val.toFixed(1)}
                                  </button>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        {/* Marca */}
                        <Show when={showField("montareRotiShowMarca")}>
                          <div>
                            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Marcă</label>
                            <SearchableSelect
                              items={marci()}
                              value={row().marcaId ?? ""}
                              onSelect={(id) => patchRow(row().uid, { marcaId: id === "" ? null : id })}
                              getLabel={(m) => m.nume}
                              placeholder="Marcă"
                              onAddNew={(name) => addMarca(row().uid, name)}
                            />
                          </div>
                        </Show>

                        {/* Profil */}
                        <Show when={showField("montareRotiShowProfil")}>
                          <div>
                            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Profil</label>
                            <SearchableSelect
                              items={profiluri()}
                              value={row().profilId ?? ""}
                              onSelect={(id) => patchRow(row().uid, { profilId: id === "" ? null : id })}
                              getLabel={(p) => p.valoare}
                              placeholder="Profil"
                              onAddNew={addProfil}
                            />
                          </div>
                        </Show>

                        {/* Dim / DOT / Tip — span pe toata latimea controalelor, in 3 sub-coloane. */}
                        <Show when={showField("montareRotiShowDimensiune") || showField("montareRotiShowDot") || showField("montareRotiShowTip")}>
                          <div style="grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;align-items:start">
                            <Show when={showField("montareRotiShowDimensiune")}>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Dimensiune</label>
                                <SearchableSelect
                                  items={dimensiuni()}
                                  value={row().dimensiuneId ?? ""}
                                  onSelect={(id) => patchRow(row().uid, { dimensiuneId: id === "" ? null : id })}
                                  getLabel={(d) => d.valoare}
                                  placeholder="Dimensiune"
                                  onAddNew={addDim}
                                />
                              </div>
                            </Show>
                            <Show when={showField("montareRotiShowDot")}>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">DOT</label>
                                <SearchableSelect
                                  items={coduriDot()}
                                  value={row().dotId ?? ""}
                                  onSelect={(id) => patchRow(row().uid, { dotId: id === "" ? null : id })}
                                  getLabel={(d) => d.valoare}
                                  placeholder="DOT"
                                  onAddNew={addDot}
                                />
                              </div>
                            </Show>
                            <Show when={showField("montareRotiShowTip")}>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Tip</label>
                                <select
                                  class="input"
                                  style="width:100%"
                                  value={row().tip}
                                  onChange={(e) => patchRow(row().uid, { tip: e.currentTarget.value as TipAnvelopa })}
                                >
                                  <option value="iarna">{TIP_LABELS.iarna}</option>
                                  <option value="vara">{TIP_LABELS.vara}</option>
                                  <option value="ms">{TIP_LABELS.ms}</option>
                                  <option value="altele">{TIP_LABELS.altele}</option>
                                </select>
                              </div>
                            </Show>
                          </div>
                        </Show>

                        {/* Adancime + Cuplu — span pe toata latimea controalelor. */}
                        <Show when={(() => {
                          const adVisible = showField("montareRotiShowAdancime");
                          const cupluVisible = showField("montareRotiShowCuplu") && !pozitieFaraCuplu(pozitie());
                          return adVisible && cupluVisible;
                        })()}>
                          <div style="grid-column:1 / -1;display:grid;grid-template-columns:0.7fr 1.3fr;gap:5px;align-items:start">
                            <div>
                              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Adâncime (mm)</label>
                              <DecimalInput
                                class="input"
                                style="width:100%"
                                value={row().adancime}
                                onInput={(_raw, v) => patchRow(row().uid, { adancime: v })}
                              />
                              <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                <For each={ADANCIME_SHORTCUTS}>
                                  {(val) => (
                                    <button
                                      type="button"
                                      style={SHORTCUT_BTN_STYLE}
                                      onClick={() => patchRow(row().uid, { adancime: val })}
                                    >
                                      {val}
                                    </button>
                                  )}
                                </For>
                              </div>
                            </div>
                            <div>
                              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Cuplu strângere (Nm)</label>
                              <DecimalInput
                                class="input"
                                style="width:100%"
                                integer
                                value={row().cupluStrangere}
                                onInput={(_raw, v) => patchRow(row().uid, { cupluStrangere: v })}
                              />
                              <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                <For each={CUPLU_SHORTCUTS}>
                                  {(val) => (
                                    <button
                                      type="button"
                                      style={SHORTCUT_BTN_STYLE}
                                      onClick={() => patchRow(row().uid, { cupluStrangere: val })}
                                    >
                                      {val}
                                    </button>
                                  )}
                                </For>
                              </div>
                            </div>
                          </div>
                        </Show>

                        <Show when={showField("montareRotiShowAdancime") && (!showField("montareRotiShowCuplu") || pozitieFaraCuplu(pozitie()))}>
                          <div>
                            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Adâncime (mm)</label>
                            <DecimalInput
                              class="input"
                              style="width:100%"
                              value={row().adancime}
                              onInput={(_raw, v) => patchRow(row().uid, { adancime: v })}
                            />
                            <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                              <For each={ADANCIME_SHORTCUTS}>
                                {(val) => (
                                  <button
                                    type="button"
                                    style={SHORTCUT_BTN_STYLE}
                                    onClick={() => patchRow(row().uid, { adancime: val })}
                                  >
                                    {val}
                                  </button>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={!showField("montareRotiShowAdancime") && showField("montareRotiShowCuplu") && !pozitieFaraCuplu(pozitie())}>
                          <div>
                            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Cuplu strângere (Nm)</label>
                            <DecimalInput
                              class="input"
                              style="width:100%"
                              integer
                              value={row().cupluStrangere}
                              onInput={(_raw, v) => patchRow(row().uid, { cupluStrangere: v })}
                            />
                            <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                              <For each={CUPLU_SHORTCUTS}>
                                {(val) => (
                                  <button
                                    type="button"
                                    style={SHORTCUT_BTN_STYLE}
                                    onClick={() => patchRow(row().uid, { cupluStrangere: val })}
                                  >
                                    {val}
                                  </button>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        {/* Indice Viteza + Indice Sarcina — span pe toata latimea controalelor. */}
                        <Show when={showField("montareRotiShowIndiceViteza") || showField("montareRotiShowIndiceSarcina")}>
                          <div style="grid-column:1 / -1;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:start">
                            <Show when={showField("montareRotiShowIndiceViteza")}>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Indice Viteză</label>
                                <input
                                  class="input"
                                  style="width:100%"
                                  type="text"
                                  maxLength={4}
                                  value={row().indiceViteza ?? ""}
                                  onInput={(e) => {
                                    const v = e.currentTarget.value.toUpperCase();
                                    patchRow(row().uid, { indiceViteza: v === "" ? null : v });
                                  }}
                                />
                                <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                  <For each={INDICE_VITEZA_SHORTCUTS}>
                                    {(val) => (
                                      <button
                                        type="button"
                                        style={SHORTCUT_BTN_STYLE}
                                        onClick={() => patchRow(row().uid, { indiceViteza: val })}
                                      >
                                        {val}
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </Show>
                            <Show when={showField("montareRotiShowIndiceSarcina")}>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Indice Sarcină</label>
                                <DecimalInput
                                  class="input"
                                  style="width:100%"
                                  integer
                                  value={row().indiceSarcina}
                                  onInput={(_raw, v) => patchRow(row().uid, { indiceSarcina: v })}
                                />
                                <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                  <For each={INDICE_SARCINA_SHORTCUTS}>
                                    {(val) => (
                                      <button
                                        type="button"
                                        style={SHORTCUT_BTN_STYLE}
                                        onClick={() => patchRow(row().uid, { indiceSarcina: val })}
                                      >
                                        {val}
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </>
                    );

                    return (
                      <Show when={placement() === "bottom"} fallback={
                        <div style="display:flex;gap:6px;align-items:stretch">
                          <Show when={placement() === "left"}>
                            {renderWheelImage(pozitie(), "flex:0 0 32%;min-width:140px")}
                          </Show>
                          <div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:start">
                            {renderControls()}
                          </div>
                          <Show when={placement() === "right"}>
                            {renderWheelImage(pozitie(), "flex:0 0 32%;min-width:140px")}
                          </Show>
                        </div>
                      }>
                        <div style="display:flex;flex-direction:column;gap:6px">
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:start">
                            {renderControls()}
                          </div>
                          {renderWheelImage(pozitie())}
                        </div>
                      </Show>
                    );
                  })()}
                </div>
              );
            }}
          </Index>
        </div>

        <button class="btn btn-ghost btn-sm" style="align-self:flex-start" onClick={addRow}>
          + Adaugă roată
        </button>

        <Show when={err()}>
          <p style="color:var(--danger);font-size:13px;margin:0">{err()}</p>
        </Show>
      </div>

      {/* Modal: Confirmare propunere marca noua */}
      <Show when={proposingMarca() !== null}>
        <Modal
          open
          title="Propune marcă nouă"
          hideClose
          style="max-width:520px;width:100%"
          bodyStyle="padding:16px 20px;display:flex;flex-direction:column;gap:10px"
          footer={<>
            <button
              class="btn btn-ghost btn-sm"
              disabled={proposingBusy()}
              onClick={() => setProposingMarca(null)}
            >Anulează</button>
            <button
              class="btn btn-primary btn-sm"
              disabled={proposingBusy()}
              onClick={confirmProposeMarca}
            >{proposingBusy() ? "Se trimite..." : "Trimite propunerea"}</button>
          </>}
        >
          <p style="margin:0;font-size:14px;line-height:1.5">
            Marca <strong>„{proposingMarca()?.name}”</strong> nu există în lista globală. Vrei să o propui adminului?
          </p>
          <div style="background:var(--warn-bg,rgba(245,158,11,.1));border:1px solid var(--warn,#f59e0b);border-radius:6px;padding:10px;font-size:13px;line-height:1.5">
            <strong>Atenție:</strong> marca va fi disponibilă pentru utilizare DOAR după ce administratorul o aprobă. Până atunci, rândul curent va rămâne fără marcă.
          </div>
        </Modal>
      </Show>
    </Modal>
  );
}
