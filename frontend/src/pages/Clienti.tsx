import { For, Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { canManage } from "../store/permissions";
import { createPagination } from "../hooks/createPagination";
import { createListResource } from "../hooks";
import Pagination from "../components/data/Pagination";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { CNP_PLACEHOLDER, cnpError, cnpForSave, type Client, type ClientVehicol } from "../types/client";
import { clientiApi } from "../api/clienti";
import { companiesApi, type AnafCompany } from "../api/companies";

function DeleteModal(props: { label: string; onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <ConfirmDialog
      open={true}
      title="Confirmare ștergere"
      message={`Ștergi ${props.label}?`}
      confirmLabel="Șterge"
      variant="danger"
      loading={props.saving}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  );
}

function emptyForm() {
  return { tip: "fizic" as "fizic" | "juridic", nume: "", description: "", cui: CNP_PLACEHOLDER, reprezentant: "", telefon: "", email: "", adresa: "", numar_masina: "", comments: "" };
}

function emptyVForm() {
  return { numar_masina: "", marca: "", model: "", an_fabricatie: "", numar_kilometrii: "", vin: "", observatii: "" };
}

export default function Clienti() {
  const navigate = useNavigate();
  const [search, setSearch] = createSignal("");
  const [searchMasina, setSearchMasina] = createSignal("");
  const [querySearch, setQuerySearch] = createSignal("");
  const [queryMasina, setQueryMasina] = createSignal("");
  const pagination = createPagination({ initialPageSize: 25 });

  const list = createListResource<Client>({
    fetcher: ({ signal, limit, offset }) =>
      clientiApi.list({ limit, offset, q: querySearch() || null, q_masina: queryMasina() || null }, { signal }),
    deps: () => `${querySearch()}|${queryMasina()}`,
    pagination,
    errorMessage: "Eroare la încărcare clienți.",
  });
  const clienti = list.items;
  const loading = list.loading;
  const total = list.total;

  const [viewId, setViewId] = createSignal<number | null>(null);
  const [editId, setEditId] = createSignal<number | null>(null);
  const [form, setForm] = createSignal(emptyForm());

  const [addMode, setAddMode] = createSignal(false);
  const [newForm, setNewForm] = createSignal(emptyForm());

  const [deleteTarget, setDeleteTarget] = createSignal<Client | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal<string | null>(null);
  const error = () => list.error() ?? formError();

  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError] = createSignal<string | null>(null);

  // Vehicole state
  const [vehicoleMap, setVehicoleMap] = createSignal<Record<number, ClientVehicol[]>>({});
  const [vLoadingId, setVLoadingId] = createSignal<number | null>(null);
  const [vAddMode, setVAddMode] = createSignal<number | null>(null);
  const [vEditId, setVEditId] = createSignal<number | null>(null);
  const [vForm, setVForm] = createSignal(emptyVForm());
  const [vDeleteTarget, setVDeleteTarget] = createSignal<{ v: ClientVehicol; clientId: number } | null>(null);
  const [vSaving, setVSaving] = createSignal(false);
  const [vError, setVError] = createSignal<string | null>(null);

  async function searchAnaf(cui: string, setF: (f: ReturnType<typeof emptyForm>) => void, f: ReturnType<typeof emptyForm>) {
    const cuiNum = parseInt(cui.replace(/\D/g, ""));
    if (!cuiNum) return;
    setAnafLoading(true);
    setAnafError(null);
    try {
      const res = await companiesApi.anafRaw(cuiNum);
      if (res.status === 404) { setAnafError("CUI-ul nu a fost găsit în ANAF."); return; }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as AnafCompany;
      setF({
        ...f,
        nume: data.name ?? f.nume,
        adresa: data.address ?? f.adresa,
        reprezentant: data.representative ?? f.reprezentant,
      });
    } catch {
      setAnafError("Eroare la interogarea ANAF.");
    } finally {
      setAnafLoading(false);
    }
  }

  let _searchDebounce: ReturnType<typeof setTimeout> | null = null;
  function debouncedLoad(): void {
    if (_searchDebounce) clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      _searchDebounce = null;
      pagination.reset();
      setQuerySearch(search());
      setQueryMasina(searchMasina());
    }, 250);
  }

  async function loadVehicole(clientId: number) {
    if (vehicoleMap()[clientId] !== undefined) return;
    setVLoadingId(clientId);
    try {
      const data = await clientiApi.listVehicole(clientId);
      setVehicoleMap((m) => ({ ...m, [clientId]: data }));
    } catch {
      setVehicoleMap((m) => ({ ...m, [clientId]: [] }));
    } finally {
      setVLoadingId(null);
    }
  }

  function startEdit(c: Client) {
    setEditId(c.id);
    setViewId(null);
    setForm({ tip: c.tip, nume: c.nume, description: c.description ?? "", cui: c.cui ?? CNP_PLACEHOLDER, reprezentant: c.reprezentant ?? "", telefon: c.telefon ?? "", email: c.email ?? "", adresa: c.adresa ?? "", numar_masina: c.numar_masina ?? "", comments: c.comments ?? "" });
    setAddMode(false);
    setFormError(null);
  }

  function cancelEdit() { setEditId(null); setFormError(null); }

  async function saveEdit() {
    const f = form();
    if (!f.nume.trim()) { setFormError("Numele este obligatoriu."); return; }
    if (f.tip === "fizic") { const e = cnpError(f.cui); if (e) { setFormError(e); return; } }
    setSaving(true); setFormError(null);
    try {
      const updated = await clientiApi.update(editId()!, {
        tip: f.tip, nume: f.nume.trim(),
        description: f.description.trim() || null,
        cui: f.tip === "fizic" ? cnpForSave(f.cui) : (f.cui.trim() || null),
        reprezentant: f.reprezentant.trim() || null,
        telefon: f.telefon.trim() || null, email: f.email.trim() || null,
        adresa: f.adresa.trim() || null, numar_masina: f.numar_masina.trim() || null,
        comments: f.comments.trim() || null,
      });
      list.mutate((items) => items.map((c) => (c.id === updated.id ? updated : c)));
      setEditId(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  function startView(c: Client) {
    setViewId(c.id);
    setEditId(null);
    setAddMode(false);
    setFormError(null);
    loadVehicole(c.id);
  }
  function closeView() { setViewId(null); setVAddMode(null); setVEditId(null); }

  function startAdd() { setNewForm(emptyForm()); setAddMode(true); setEditId(null); setViewId(null); setFormError(null); }
  function cancelAdd() { setAddMode(false); setFormError(null); }

  async function saveAdd() {
    const f = newForm();
    if (!f.nume.trim()) { setFormError("Numele este obligatoriu."); return; }
    if (f.tip === "fizic") { const e = cnpError(f.cui); if (e) { setFormError(e); return; } }
    setSaving(true); setFormError(null);
    try {
      const created = await clientiApi.create({
        tip: f.tip, nume: f.nume.trim(),
        description: f.description.trim() || null,
        cui: f.tip === "fizic" ? cnpForSave(f.cui) : (f.cui.trim() || null),
        reprezentant: f.reprezentant.trim() || null,
        telefon: f.telefon.trim() || null, email: f.email.trim() || null,
        adresa: f.adresa.trim() || null, numar_masina: f.numar_masina.trim() || null,
        comments: f.comments.trim() || null,
      }, { errorMessage: "Eroare la salvare." });
      list.mutate((items) => [created, ...items]);
      setAddMode(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget();
    if (!target) return;
    setSaving(true);
    try {
      await clientiApi.remove(target.id);
      list.mutate((items) => items.filter((c) => c.id !== target.id));
      setDeleteTarget(null);
    } catch {
      setFormError("Eroare la ștergere.");
    } finally {
      setSaving(false);
    }
  }

  // Vehicole CRUD
  function startVAdd(clientId: number) {
    setVAddMode(clientId);
    setVEditId(null);
    setVForm(emptyVForm());
    setVError(null);
  }

  function startVEdit(v: ClientVehicol) {
    setVEditId(v.id);
    setVAddMode(null);
    setVForm({
      numar_masina: v.numar_masina,
      marca: v.marca ?? "",
      model: v.model ?? "",
      numar_kilometrii: v.numar_kilometrii != null ? String(v.numar_kilometrii) : "",
      an_fabricatie: v.an_fabricatie != null ? String(v.an_fabricatie) : "",
      vin: v.vin ?? "",
      observatii: v.observatii ?? "",
    });
    setVError(null);
  }

  async function saveVAdd(clientId: number) {
    const f = vForm();
    if (!f.numar_masina.trim()) { setVError("Numărul mașinii este obligatoriu."); return; }
    setVSaving(true); setVError(null);
    try {
      const created = await clientiApi.createVehicol(clientId, {
        numar_masina: f.numar_masina.trim(),
        marca: f.marca.trim() || null,
        model: f.model.trim() || null,
        numar_kilometrii: f.numar_kilometrii ? parseInt(f.numar_kilometrii) || null : null,
        an_fabricatie: f.an_fabricatie ? parseInt(f.an_fabricatie) || null : null,
        vin: f.vin.trim() || null,
        observatii: f.observatii.trim() || null,
      });
      setVehicoleMap((m) => ({ ...m, [clientId]: [...(m[clientId] ?? []), created] }));
      setVAddMode(null);
    } catch {
      setVError("Eroare la salvare.");
    } finally {
      setVSaving(false);
    }
  }

  async function saveVEdit(clientId: number, vId: number) {
    const f = vForm();
    if (!f.numar_masina.trim()) { setVError("Numărul mașinii este obligatoriu."); return; }
    setVSaving(true); setVError(null);
    try {
      const updated = await clientiApi.updateVehicol(clientId, vId, {
        numar_masina: f.numar_masina.trim(),
        marca: f.marca.trim() || null,
        model: f.model.trim() || null,
        numar_kilometrii: f.numar_kilometrii ? parseInt(f.numar_kilometrii) || null : null,
        an_fabricatie: f.an_fabricatie ? parseInt(f.an_fabricatie) || null : null,
        vin: f.vin.trim() || null,
        observatii: f.observatii.trim() || null,
      });
      setVehicoleMap((m) => ({ ...m, [clientId]: (m[clientId] ?? []).map((v) => v.id === vId ? updated : v) }));
      setVEditId(null);
    } catch {
      setVError("Eroare la salvare.");
    } finally {
      setVSaving(false);
    }
  }

  async function confirmDeleteVehicol() {
    const target = vDeleteTarget();
    if (!target) return;
    setVSaving(true);
    try {
      await clientiApi.removeVehicol(target.clientId, target.v.id);
      setVehicoleMap((m) => ({ ...m, [target.clientId]: (m[target.clientId] ?? []).filter((v) => v.id !== target.v.id) }));
      setVDeleteTarget(null);
      setVEditId(null);
    } catch {
      setVError("Eroare la ștergere.");
    } finally {
      setVSaving(false);
    }
  }

  function VehicolForm(props: { f: ReturnType<typeof emptyVForm>; setF: (f: ReturnType<typeof emptyVForm>) => void }) {
    return (
      <div class="cfg-location-fields" style="gap:6px">
        <input
          class="input"
          placeholder="Număr mașină *"
          aria-label="Număr mașină"
          value={props.f.numar_masina}
          onInput={(e) => props.setF({ ...props.f, numar_masina: e.currentTarget.value.toUpperCase() })}
        />
        <div style="display:flex;gap:6px">
          <input class="input" placeholder="Marcă" aria-label="Marcă" style="flex:1" value={props.f.marca} onInput={(e) => props.setF({ ...props.f, marca: e.currentTarget.value })} />
          <input class="input" placeholder="Model" aria-label="Model" style="flex:1" value={props.f.model} onInput={(e) => props.setF({ ...props.f, model: e.currentTarget.value })} />
        </div>
        <div style="display:flex;gap:6px">
          <input class="input" placeholder="An fabricație" aria-label="An fabricație" type="number" min="1900" max="2100" style="flex:1" value={props.f.an_fabricatie} onInput={(e) => props.setF({ ...props.f, an_fabricatie: e.currentTarget.value })} />
          <input class="input" placeholder="Km" aria-label="Kilometraj" type="number" style="flex:1" value={props.f.numar_kilometrii} onInput={(e) => props.setF({ ...props.f, numar_kilometrii: e.currentTarget.value })} />
          <input class="input" placeholder="VIN" aria-label="VIN" style="flex:2" value={props.f.vin} onInput={(e) => props.setF({ ...props.f, vin: e.currentTarget.value.toUpperCase() })} />
        </div>
        <input class="input" placeholder="Observații" aria-label="Observații" value={props.f.observatii} onInput={(e) => props.setF({ ...props.f, observatii: e.currentTarget.value })} />
      </div>
    );
  }

  function ClientForm(props: { f: ReturnType<typeof emptyForm>; setF: (f: ReturnType<typeof emptyForm>) => void }) {
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
                value={props.f.cui}
                onInput={(e) => { props.setF({ ...props.f, cui: e.currentTarget.value }); setAnafError(null); }}
                onKeyDown={(e) => e.key === "Enter" && searchAnaf(props.f.cui, props.setF, props.f)}
              />
              <button
                class="btn btn-sm btn-ghost"
                onClick={() => searchAnaf(props.f.cui, props.setF, props.f)}
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

  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Clienți</h1>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="sr-only" for="cli-search-nume">Caută după nume</label>
          <input
            id="cli-search-nume"
            class="input reception-search"
            type="search"
            placeholder="Caută după nume..."
            aria-label="Caută client după nume"
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); debouncedLoad(); }}
          />
          <label class="sr-only" for="cli-search-masina">Caută după nr. mașină</label>
          <input
            id="cli-search-masina"
            class="input reception-search"
            type="search"
            placeholder="Caută după nr. mașină..."
            aria-label="Caută client după număr de înmatriculare"
            value={searchMasina()}
            onInput={(e) => { setSearchMasina(e.currentTarget.value); debouncedLoad(); }}
          />
          <button class="btn btn-primary btn-sm" onClick={startAdd}>+ Adaugă client</button>
        </div>
      </div>

      <Show when={error()}>
        <p class="cfg-error" style="margin-bottom:8px">{error()}</p>
      </Show>

      <Show when={addMode()}>
        <div class="cfg-location-row cfg-location-row--edit" style="margin-bottom:12px">
          <ClientForm f={newForm()} setF={setNewForm} />
          <div class="cfg-location-actions" style="margin-top:8px">
            <button class="btn btn-sm btn-ghost" onClick={cancelAdd}>Anulează</button>
            <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveAdd}>
              {saving() ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>

      <Show when={!loading() && clienti().length === 0}>
        <p class="cfg-hint">Niciun client înregistrat.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={clienti()}>
          {(c) => (
            <div class="cfg-location-row" classList={{ "cfg-location-row--edit": editId() === c.id || viewId() === c.id }}>
              <Show when={editId() === c.id}>
                <ClientForm f={form()} setF={setForm} />
                <div class="cfg-location-actions" style="margin-top:8px">
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <Show when={canManage()}>
                    <button class="btn btn-sm btn-danger" onClick={() => setDeleteTarget(c)}>Șterge</button>
                  </Show>
                  <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveEdit}>
                    {saving() ? "Se salvează..." : "Salvează"}
                  </button>
                </div>
              </Show>

              <Show when={viewId() === c.id}>
                <div style="display:flex;gap:16px;flex-wrap:wrap;width:100%">
                  {/* Detalii client — stânga */}
                  <div class="cfg-location-info" style="flex:1;min-width:200px">
                    <span class="cfg-location-name">
                      {c.nume}
                      <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": c.tip === "juridic" }}>
                        {c.tip === "juridic" ? "Juridică" : "Fizică"}
                      </span>
                    </span>
                    <Show when={c.description}>
                      <span class="cfg-location-desc"><strong>Descriere:</strong> {c.description}</span>
                    </Show>
                    <Show when={c.cui && (c.tip === "juridic" || c.cui !== CNP_PLACEHOLDER)}>
                      <span class="cfg-location-desc"><strong>{c.tip === "juridic" ? "CUI" : "CNP"}:</strong> {c.cui}</span>
                    </Show>
                    <Show when={c.tip === "juridic" && c.reprezentant}>
                      <span class="cfg-location-desc"><strong>Reprezentant:</strong> {c.reprezentant}</span>
                    </Show>
                    <Show when={c.telefon}>
                      <span class="cfg-location-desc"><strong>Telefon:</strong> {c.telefon}</span>
                    </Show>
                    <Show when={c.email}>
                      <span class="cfg-location-desc"><strong>Email:</strong> {c.email}</span>
                    </Show>
                    <Show when={c.adresa}>
                      <span class="cfg-location-desc"><strong>Adresă:</strong> {c.adresa}</span>
                    </Show>
                    <Show when={c.numar_masina}>
                      <span class="cfg-location-desc"><strong>Nr. mașină:</strong> {c.numar_masina}</span>
                    </Show>
                    <Show when={c.comments}>
                      <span class="cfg-location-desc" style="font-style:italic"><strong>Comentarii:</strong> {c.comments}</span>
                    </Show>
                    <div class="cfg-location-actions" style="margin-top:8px">
                      <button class="btn btn-sm btn-ghost" onClick={closeView}>Închide</button>
                      <button class="btn btn-sm btn-primary" onClick={() => startEdit(c)}>Editează</button>
                    </div>
                  </div>

                  {/* Vehicole — dreapta */}
                  <div style="flex:1;min-width:200px;border-left:1px solid var(--border,#e5e7eb);padding-left:16px">
                    <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-muted)">Mașini</div>

                    <Show when={vLoadingId() === c.id}>
                      <p class="cfg-hint" style="font-size:12px">Se încarcă...</p>
                    </Show>

                    <Show when={vError()}>
                      <p style="color:var(--danger,#ef4444);font-size:12px;margin-bottom:4px">{vError()}</p>
                    </Show>

                    <For each={vehicoleMap()[c.id] ?? []}>
                      {(v) => (
                        <div style="margin-bottom:8px">
                          <Show when={vEditId() === v.id}>
                            <VehicolForm f={vForm()} setF={setVForm} />
                            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                              <button class="btn btn-sm btn-ghost" onClick={() => { setVEditId(null); setVError(null); }}>Anulează</button>
                              <Show when={canManage()}>
                                <button class="btn btn-sm btn-danger" onClick={() => setVDeleteTarget({ v, clientId: c.id })}>Șterge</button>
                              </Show>
                              <button class="btn btn-sm btn-primary" disabled={vSaving()} onClick={() => saveVEdit(c.id, v.id)}>
                                {vSaving() ? "..." : "Salvează"}
                              </button>
                            </div>
                          </Show>
                          <Show when={vEditId() !== v.id}>
                            <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
                              <span style="font-size:13px">
                                <strong>{v.numar_masina}</strong>
                                <Show when={v.marca || v.model}>
                                  <span style="color:var(--text-muted);margin-left:6px">{[v.marca, v.model].filter(Boolean).join(" ")}</span>
                                </Show>
                                <Show when={v.an_fabricatie != null}>
                                  <span style="color:var(--text-muted);margin-left:6px;font-size:11px">{v.an_fabricatie}</span>
                                </Show>
                                <Show when={v.numar_kilometrii != null}>
                                  <span style="color:var(--text-muted);margin-left:6px;font-size:11px">{v.numar_kilometrii} km</span>
                                </Show>
                              </span>
                              <button class="btn btn-sm btn-ghost" style="font-size:11px;padding:2px 8px" onClick={() => startVEdit(v)}>Editează</button>
                            </div>
                            <Show when={v.vin}>
                              <div style="font-size:11px;color:var(--text-muted)">VIN: {v.vin}</div>
                            </Show>
                            <Show when={v.observatii}>
                              <div style="font-size:11px;color:var(--text-muted)">{v.observatii}</div>
                            </Show>
                          </Show>
                        </div>
                      )}
                    </For>

                    <Show when={(vehicoleMap()[c.id] ?? []).length === 0 && vLoadingId() !== c.id}>
                      <p class="cfg-hint" style="font-size:12px;margin-bottom:6px">Nicio mașină înregistrată.</p>
                    </Show>

                    <Show when={vAddMode() === c.id}>
                      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border,#e5e7eb)">
                        <VehicolForm f={vForm()} setF={setVForm} />
                        <div style="display:flex;gap:6px;margin-top:6px">
                          <button class="btn btn-sm btn-ghost" onClick={() => { setVAddMode(null); setVError(null); }}>Anulează</button>
                          <button class="btn btn-sm btn-primary" disabled={vSaving()} onClick={() => saveVAdd(c.id)}>
                            {vSaving() ? "..." : "Salvează"}
                          </button>
                        </div>
                      </div>
                    </Show>

                    <Show when={vAddMode() !== c.id}>
                      <button class="btn btn-sm btn-ghost" style="margin-top:6px;font-size:12px" onClick={() => startVAdd(c.id)}>
                        + Adaugă mașină
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={editId() !== c.id && viewId() !== c.id}>
                <div
                  class="cfg-location-info"
                  style="cursor:pointer;flex:1"
                  role="button"
                  tabIndex={0}
                  onClick={() => startView(c)}
                  onDblClick={() => navigate(`/clienti/${c.id}`)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), startView(c))}
                  title="Dublu-click pentru detalii și devize"
                >
                  <span class="cfg-location-name">
                    {c.nume}
                    <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": c.tip === "juridic" }}>
                      {c.tip === "juridic" ? "Juridică" : "Fizică"}
                    </span>
                  </span>
                  <Show when={c.description}>
                    <span class="cfg-location-desc">{c.description}</span>
                  </Show>
                  <Show when={c.tip === "juridic" && (c.cui || c.reprezentant)}>
                    <span class="cfg-location-desc">
                      {[c.cui && `CUI: ${c.cui}`, c.reprezentant && `Rep: ${c.reprezentant}`].filter(Boolean).join(" · ")}
                    </span>
                  </Show>
                  <Show when={c.numar_masina || c.telefon || c.email}>
                    <span class="cfg-location-desc">
                      {[c.numar_masina, c.telefon, c.email].filter(Boolean).join(" · ")}
                    </span>
                  </Show>
                  <Show when={c.comments}>
                    <span class="cfg-location-desc" style="font-style:italic">{c.comments}</span>
                  </Show>
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost" onClick={() => navigate(`/clienti/${c.id}`)}>Vezi detalii client</button>
                  <button class="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Editează</button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={!loading() && clienti().length > 0}>
        <Pagination api={pagination} total={total()} pageSizeOptions={[10, 25, 50, 100]} />
      </Show>

      <Show when={deleteTarget()}>
        <DeleteModal
          label={deleteTarget()!.nume}
          saving={saving()}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Show>

      <Show when={vDeleteTarget()}>
        <DeleteModal
          label={vDeleteTarget()!.v.numar_masina}
          saving={vSaving()}
          onConfirm={confirmDeleteVehicol}
          onCancel={() => setVDeleteTarget(null)}
        />
      </Show>
    </div>
  );
}
