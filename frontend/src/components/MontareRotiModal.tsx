import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch, API_BASE } from "../utils/api";
import SearchableSelect from "./SearchableSelect";
import {
  marci, dimensiuni, profiluri,
  loadMarci, loadDimensiuni, loadProfil,
  invalidateMarciCache, invalidateDimensiuniCache, invalidateProfilCache,
  type TipAnvelopa,
} from "../store/hotelAnvelopeStore";
import {
  bulkUpsertMontajRoti, defaultPozitieForIndex,
  POZITII_ORDONATE, POZITIE_LABELS,
  PRESIUNE_SHORTCUTS, CUPLU_SHORTCUTS, ADANCIME_SHORTCUTS, ADANCIME_DEFAULT,
  montareRotiImages, loadMontareRotiImages,
  type MontajRotaDraft, type PozitieRoata,
} from "../store/montajRotiStore";

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
    tip: "vara",
    adancime: ADANCIME_DEFAULT,
    cupluStrangere: pozitieFaraCuplu(pozitie) ? 0 : null,
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

  function imageUrlForPozitie(pozitie: PozitieRoata): string | null {
    return montareRotiImages()[pozitie]
      ? `${API_BASE}/api/global-settings/montare-roti/image/${pozitie}`
      : null;
  }

  onMount(() => {
    loadMarci();
    loadDimensiuni();
    loadProfil();
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

  async function addMarca(name: string) {
    const res = await apiFetch("/api/marci-anvelope", { method: "POST", body: JSON.stringify({ nume: name }) });
    if (res.ok) {
      invalidateMarciCache();
      await loadMarci(true);
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
        tip: r.tip,
        adancime: r.adancime,
        cupluStrangere: r.cupluStrangere,
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

  function renderWheelImage(placement: "left" | "right" | "bottom", pozitie: PozitieRoata) {
    const placementStyle =
      placement === "left"
        ? "grid-column:1;grid-row:1 / span 4;align-self:stretch"
        : placement === "right"
        ? "grid-column:3;grid-row:1 / span 4;align-self:stretch"
        : "grid-column:1 / -1";
    const url = imageUrlForPozitie(pozitie);
    return (
      <div
        style={`${placementStyle};min-height:120px;border:1px solid var(--border);border-radius:8px;overflow:hidden;position:relative;background:#fff`}
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

                    <div style="display:grid;gap:5px;grid-template-columns:1fr 1fr 1fr;align-items:start">
                      <Show when={placement() === "left"}>
                        {renderWheelImage("left", row.pozitie)}
                      </Show>

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

                      {/* Marca */}
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

                      {/* Profil */}
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

                      {/* Dimensiune */}
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

                      {/* Tip — mutat inaintea Adancime */}
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

                      {/* Adancime + Cuplu — perechi cu lățimi 0.7fr / 1.3fr cand ambele sunt vizibile;
                          cand Cuplu e ascuns (Rezerva/Nespecificat), Adancime rămâne o celulă simplă. */}
                      <Show
                        when={!pozitieFaraCuplu(row.pozitie)}
                        fallback={
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
                        }
                      >
                        <div style="grid-column:span 2;display:grid;grid-template-columns:0.7fr 1.3fr;gap:5px;align-items:start">
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

                      <Show when={placement() === "right"}>
                        {renderWheelImage("right", row.pozitie)}
                      </Show>
                      <Show when={placement() === "bottom"}>
                        {renderWheelImage("bottom", row.pozitie)}
                      </Show>
                    </div>
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
    </div>
  );
}
