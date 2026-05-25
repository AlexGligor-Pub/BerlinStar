import { For, Show, createSignal, onMount } from "solid-js";
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
  // Confirmare propunere marca noua (devine pending pana o aproba adminul).
  const [proposingMarca, setProposingMarca] = createSignal<string | null>(null);
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

  function addMarca(name: string) {
    // Deschide modalul de confirmare; trimiterea efectiva are loc in confirmProposeMarca.
    setProposingMarca(name.trim());
  }

  async function confirmProposeMarca() {
    const name = proposingMarca();
    if (!name) return;
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
        const data = await readJsonSafe<{ detail?: { status?: string; message?: string; nume?: string } }>(res);
        const detail = data?.detail;
        if (detail?.status === "approved") {
          invalidateMarciCache();
          await loadMarci(true);
          notify(detail.message ?? `Marca „${detail.nume ?? name}” există deja.`, "info");
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
    }
  }
  async function addDim(value: string) {
    const res = await apiFetch("/api/dimensiuni-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      invalidateDimensiuniCache();
      await loadDimensiuni(true);
    }
  }
  async function addDot(value: string) {
    const res = await apiFetch("/api/coduri-dot-anvelope", { method: "POST", body: JSON.stringify({ valoare: value }) });
    if (res.ok) {
      invalidateCoduriDotCache();
      await loadCoduriDot(true);
    }
  }

  async function doSave() {
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
    <div class="sl-modal-overlay">
      <div class="sl-modal" style="width:min(1500px,98vw);max-height:92vh;display:flex;flex-direction:column">
        <div class="sl-modal-header">
          <span class="sl-modal-title">Montare Roți</span>
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px">
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;align-items:start">
            <For each={rows()}>
              {(row, idx) => {
                const placement = () => imagePlacement(row.pozitie);
                return (
                  <div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg)">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px">
                      <span style="font-size:12px;font-weight:600;color:var(--text-muted)">Roată #{idx() + 1}</span>
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-ghost btn-sm" onClick={() => copyRow(row.uid)}>Copiază</button>
                        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onClick={() => deleteRow(row.uid)}>✕</button>
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
                              value={row.pozitie}
                              onChange={(e) => {
                                const newPoz = e.currentTarget.value as PozitieRoata;
                                const patch: Partial<RowDraft> = { pozitie: newPoz };
                                if (pozitieFaraCuplu(newPoz)) patch.cupluStrangere = 0;
                                patchRow(row.uid, patch);
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
                              <input
                                class="input"
                                style="width:100%"
                                type="number"
                                step="0.1"
                                min="0"
                                value={row.presiune ?? ""}
                                onInput={(e) => {
                                  const v = e.currentTarget.value;
                                  patchRow(row.uid, { presiune: v === "" ? null : parseFloat(v) });
                                }}
                              />
                              <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                <For each={PRESIUNE_SHORTCUTS}>
                                  {(val) => (
                                    <button
                                      type="button"
                                      style={SHORTCUT_BTN_STYLE}
                                      onClick={() => patchRow(row.uid, { presiune: val })}
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
                                value={row.marcaId ?? ""}
                                onSelect={(id) => patchRow(row.uid, { marcaId: id === "" ? null : id })}
                                getLabel={(m) => m.nume}
                                placeholder="Marcă"
                                onAddNew={addMarca}
                              />
                            </div>
                          </Show>

                          {/* Profil */}
                          <Show when={showField("montareRotiShowProfil")}>
                            <div>
                              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Profil</label>
                              <SearchableSelect
                                items={profiluri()}
                                value={row.profilId ?? ""}
                                onSelect={(id) => patchRow(row.uid, { profilId: id === "" ? null : id })}
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
                                    value={row.dimensiuneId ?? ""}
                                    onSelect={(id) => patchRow(row.uid, { dimensiuneId: id === "" ? null : id })}
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
                                    value={row.dotId ?? ""}
                                    onSelect={(id) => patchRow(row.uid, { dotId: id === "" ? null : id })}
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
                                    value={row.tip}
                                    onChange={(e) => patchRow(row.uid, { tip: e.currentTarget.value as TipAnvelopa })}
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
                            const cupluVisible = showField("montareRotiShowCuplu") && !pozitieFaraCuplu(row.pozitie);
                            return adVisible && cupluVisible;
                          })()}>
                            <div style="grid-column:1 / -1;display:grid;grid-template-columns:0.7fr 1.3fr;gap:5px;align-items:start">
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Adâncime (mm)</label>
                                <input
                                  class="input"
                                  style="width:100%"
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={row.adancime ?? ""}
                                  onInput={(e) => {
                                    const v = e.currentTarget.value;
                                    patchRow(row.uid, { adancime: v === "" ? null : parseFloat(v) });
                                  }}
                                />
                                <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                  <For each={ADANCIME_SHORTCUTS}>
                                    {(val) => (
                                      <button
                                        type="button"
                                        style={SHORTCUT_BTN_STYLE}
                                        onClick={() => patchRow(row.uid, { adancime: val })}
                                      >
                                        {val}
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </div>
                              <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Cuplu strângere (Nm)</label>
                                <input
                                  class="input"
                                  style="width:100%"
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={row.cupluStrangere ?? ""}
                                  onInput={(e) => {
                                    const v = e.currentTarget.value;
                                    patchRow(row.uid, { cupluStrangere: v === "" ? null : parseInt(v, 10) });
                                  }}
                                />
                                <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                  <For each={CUPLU_SHORTCUTS}>
                                    {(val) => (
                                      <button
                                        type="button"
                                        style={SHORTCUT_BTN_STYLE}
                                        onClick={() => patchRow(row.uid, { cupluStrangere: val })}
                                      >
                                        {val}
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </div>
                          </Show>

                          <Show when={showField("montareRotiShowAdancime") && (!showField("montareRotiShowCuplu") || pozitieFaraCuplu(row.pozitie))}>
                            <div>
                              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Adâncime (mm)</label>
                              <input
                                class="input"
                                style="width:100%"
                                type="number"
                                step="0.5"
                                min="0"
                                value={row.adancime ?? ""}
                                onInput={(e) => {
                                  const v = e.currentTarget.value;
                                  patchRow(row.uid, { adancime: v === "" ? null : parseFloat(v) });
                                }}
                              />
                              <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                <For each={ADANCIME_SHORTCUTS}>
                                  {(val) => (
                                    <button
                                      type="button"
                                      style={SHORTCUT_BTN_STYLE}
                                      onClick={() => patchRow(row.uid, { adancime: val })}
                                    >
                                      {val}
                                    </button>
                                  )}
                                </For>
                              </div>
                            </div>
                          </Show>

                          <Show when={!showField("montareRotiShowAdancime") && showField("montareRotiShowCuplu") && !pozitieFaraCuplu(row.pozitie)}>
                            <div>
                              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Cuplu strângere (Nm)</label>
                              <input
                                class="input"
                                style="width:100%"
                                type="number"
                                step="1"
                                min="0"
                                value={row.cupluStrangere ?? ""}
                                onInput={(e) => {
                                  const v = e.currentTarget.value;
                                  patchRow(row.uid, { cupluStrangere: v === "" ? null : parseInt(v, 10) });
                                }}
                              />
                              <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                <For each={CUPLU_SHORTCUTS}>
                                  {(val) => (
                                    <button
                                      type="button"
                                      style={SHORTCUT_BTN_STYLE}
                                      onClick={() => patchRow(row.uid, { cupluStrangere: val })}
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
                                    value={row.indiceViteza ?? ""}
                                    onInput={(e) => {
                                      const v = e.currentTarget.value.toUpperCase();
                                      patchRow(row.uid, { indiceViteza: v === "" ? null : v });
                                    }}
                                  />
                                  <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                    <For each={INDICE_VITEZA_SHORTCUTS}>
                                      {(val) => (
                                        <button
                                          type="button"
                                          style={SHORTCUT_BTN_STYLE}
                                          onClick={() => patchRow(row.uid, { indiceViteza: val })}
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
                                  <input
                                    class="input"
                                    style="width:100%"
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={row.indiceSarcina ?? ""}
                                    onInput={(e) => {
                                      const v = e.currentTarget.value;
                                      patchRow(row.uid, { indiceSarcina: v === "" ? null : parseInt(v, 10) });
                                    }}
                                  />
                                  <div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">
                                    <For each={INDICE_SARCINA_SHORTCUTS}>
                                      {(val) => (
                                        <button
                                          type="button"
                                          style={SHORTCUT_BTN_STYLE}
                                          onClick={() => patchRow(row.uid, { indiceSarcina: val })}
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
                              {renderWheelImage(row.pozitie, "flex:0 0 32%;min-width:140px")}
                            </Show>
                            <div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:start">
                              {renderControls()}
                            </div>
                            <Show when={placement() === "right"}>
                              {renderWheelImage(row.pozitie, "flex:0 0 32%;min-width:140px")}
                            </Show>
                          </div>
                        }>
                          <div style="display:flex;flex-direction:column;gap:6px">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:start">
                              {renderControls()}
                            </div>
                            {renderWheelImage(row.pozitie)}
                          </div>
                        </Show>
                      );
                    })()}
                  </div>
                );
              }}
            </For>
          </div>

          <button class="btn btn-ghost btn-sm" style="align-self:flex-start" onClick={addRow}>
            + Adaugă roată
          </button>

          <Show when={err()}>
            <p style="color:var(--danger);font-size:13px;margin:0">{err()}</p>
          </Show>
        </div>

        <div class="sl-modal-footer">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>Anulează</button>
          <button class="btn btn-primary btn-sm" disabled={saving() || rows().length === 0} onClick={doSave}>
            {saving() ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>

      {/* Modal: Confirmare propunere marca noua */}
      <Show when={proposingMarca() !== null}>
        <div class="sl-modal-overlay">
          <div class="sl-modal" style="max-width:520px;width:100%">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Propune marcă nouă</span>
            </div>
            <div class="sl-modal-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
              <p style="margin:0;font-size:14px;line-height:1.5">
                Marca <strong>„{proposingMarca()}”</strong> nu există în lista globală. Vrei să o propui adminului?
              </p>
              <div style="background:var(--warn-bg,rgba(245,158,11,.1));border:1px solid var(--warn,#f59e0b);border-radius:6px;padding:10px;font-size:13px;line-height:1.5">
                <strong>Atenție:</strong> marca va fi disponibilă pentru utilizare DOAR după ce administratorul o aprobă. Până atunci, rândul curent va rămâne fără marcă.
              </div>
            </div>
            <div class="sl-modal-footer">
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
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
