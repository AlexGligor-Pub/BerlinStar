import { For, Show, createMemo, createSignal } from "solid-js";
import { companiesApi, type Company, type CompanyCreate, type CompanyUpdate } from "../../api/companies";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function CompaniiPanel() {
  const list = createListResource<Company>({ fetcher: cursorFetcher(companiesApi.list), limit: 100 });
  const [search, setSearch]   = createSignal("");

  // Add form state
  const [addMode, setAddMode] = createSignal(false);
  const [cuiInput, setCuiInput]   = createSignal("");
  const [anafLoading, setAnafLoading] = createSignal(false);
  const [anafError, setAnafError]     = createSignal<string | null>(null);
  const [form, setForm] = createSignal<Partial<Company>>({});

  // Edit state
  const [editId, setEditId] = createSignal<number | null>(null);
  const [editForm, setEditForm] = createSignal<Partial<Company>>({});

  const [deleteTarget, setDeleteTarget] = createSignal<Company | null>(null);

  let logoInputRef!: HTMLInputElement;
  let bgInputRef!: HTMLInputElement;

  const logoUpload = useAction({
    fn: async (id: number, file: File) => {
      const compressed = await compressToPng(file);
      const fd = new FormData();
      fd.append("file", compressed);
      return companiesApi.uploadLogo(id, fd);
    },
    onSuccess: (data, id) => {
      setEditForm(f => ({ ...f, logo_path: data.logo_path }));
      list.mutate(items => items.map(c => c.id === id ? { ...c, logo_path: data.logo_path } : c));
    },
    errorMessage: "Eroare la încărcarea logo-ului.",
    silentError: true,
  });

  const bgUpload = useAction({
    fn: async (id: number, file: File) => {
      const compressed = await compressToPng(file, 1_000_000);
      const fd = new FormData();
      fd.append("file", compressed);
      return companiesApi.uploadBackground(id, fd);
    },
    onSuccess: (data, id) => {
      setEditForm(f => ({ ...f, background_path: data.background_path }));
      list.mutate(items => items.map(c => c.id === id ? { ...c, background_path: data.background_path } : c));
    },
    errorMessage: "Eroare la încărcarea imaginii de fundal.",
    silentError: true,
  });

  function handleLogoFile(file: File) {
    const id = editId();
    if (!id) return;
    void logoUpload.run(id, file);
  }

  function handleBgFile(file: File) {
    const id = editId();
    if (!id) return;
    void bgUpload.run(id, file);
  }

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return q ? list.items().filter(c =>
      c.name.toLowerCase().includes(q) ||
      String(c.cui).includes(q) ||
      (c.nr_reg_com ?? "").toLowerCase().includes(q)
    ) : list.items();
  });

  async function searchAnaf() {
    const cui = parseInt(cuiInput().replace(/\D/g, ""));
    if (!cui) return;
    setAnafLoading(true);
    setAnafError(null);
    try {
      const res = await companiesApi.anafRaw(cui);
      if (res.status === 404) { setAnafError("CUI-ul nu a fost găsit în ANAF."); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as Partial<Company>;
      setForm(data);
      if (data.is_vat_payer && !data.tva_percentage) patchForm("tva_percentage", 21);
    } catch {
      setAnafError("Eroare la interogarea ANAF. Verificați conexiunea.");
    } finally {
      setAnafLoading(false);
    }
  }

  function patchForm(key: keyof Company, val: string | boolean | number | null) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function patchEditForm(key: keyof Company, val: string | boolean | number | null) {
    setEditForm(f => ({ ...f, [key]: val }));
  }

  const add = useAction({
    fn: () => {
      const f = form();
      return companiesApi.create({ ...f, name: f.name!.trim() } as CompanyCreate);
    },
    onSuccess: () => {
      setAddMode(false); setForm({}); setCuiInput(""); setAnafError(null);
      void list.reload();
    },
    silentError: true,
  });

  const save = useAction({
    fn: () => {
      const f = editForm();
      return companiesApi.update(editId()!, { ...f, name: f.name!.trim() } as CompanyUpdate);
    },
    onSuccess: () => { setEditId(null); void list.reload(); },
    silentError: true,
  });

  const remove = useAction({
    fn: (id: number) => companiesApi.remove(id),
    onSuccess: () => void list.reload(),
    silentError: true,
  });

  const saving = () => save.loading() || add.loading() || remove.loading() || logoUpload.loading() || bgUpload.loading();
  const error = () => list.error() ?? logoUpload.error() ?? bgUpload.error() ?? add.error() ?? save.error() ?? remove.error();
  function clearErrors() { logoUpload.reset(); bgUpload.reset(); add.reset(); save.reset(); remove.reset(); }

  function startEdit(c: Company) {
    setEditId(c.id);
    setEditForm({ ...c });
    setAddMode(false); clearErrors();
  }

  function confirmDelete() {
    const c = deleteTarget();
    if (!c) return;
    setDeleteTarget(null);
    void remove.run(c.id);
  }

  function doExportCSV() {
    exportCSV("Companii",
      ["#", "CUI", "Denumire", "Nr. Reg. Com.", "Adresă", "Telefon", "Cod poștal", "Plătitor TVA", "Descriere", "Comentarii", "Nume Bancă", "IBAN", "Capital Social"],
      filtered().map((c, i) => [
        String(i + 1), String(c.cui), c.name, c.nr_reg_com ?? "", c.address ?? "",
        c.phone ?? "", c.postal_code ?? "",
        c.is_vat_payer === true ? "Da" : c.is_vat_payer === false ? "Nu" : "",
        c.description ?? "", c.comments ?? "", c.bank_name ?? "", c.iban ?? "",
        c.capital_social != null ? String(c.capital_social) : "",
      ]));
  }
  function doExportPDF() {
    exportPDF("Companii",
      ["#", "CUI", "Denumire", "Nr. Reg. Com.", "Adresă", "TVA"],
      filtered().map((c, i) => [
        String(i + 1), String(c.cui), c.name, c.nr_reg_com ?? "", c.address ?? "",
        c.is_vat_payer === true ? "Da" : c.is_vat_payer === false ? "Nu" : "",
      ]));
  }

  const f = () => form();
  const ef = () => editForm();

  return (
    <div class="cfg-panel">
      <Show when={deleteTarget()}>
        <DeleteModal
          label={deleteTarget()!.name}
          saving={saving()}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Show>

      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Companii</h2>
        <input class="input cfg-search" placeholder="Caută CUI / denumire..." value={search()} onInput={e => setSearch(e.currentTarget.value)} />
        <ExportMenu onCSV={doExportCSV} onPDF={doExportPDF} />
        <button class="btn btn-sm btn-primary" onClick={() => { setAddMode(true); setEditId(null); setForm({ tva_percentage: 21 }); setCuiInput(""); setAnafError(null); clearErrors(); }}>
          + Adaugă
        </button>
      </div>

      <Show when={error()}><p class="cfg-error">{error()}</p></Show>

      {/* ── Add form ── */}
      <Show when={addMode()}>
        <div class="cfg-location-row cfg-location-row--edit">
          <div class="cfg-anaf-row">
            <input
              class="input"
              placeholder="CUI (fără RO) *"
              value={cuiInput()}
              onInput={e => setCuiInput(e.currentTarget.value)}
              onKeyDown={e => e.key === "Enter" && searchAnaf()}
            />
            <button class="btn btn-sm btn-ghost" disabled={anafLoading() || !cuiInput().trim()} onClick={searchAnaf}>
              {anafLoading() ? "Se caută..." : "Caută în ANAF"}
            </button>
          </div>
          <Show when={anafError()}>
            <p class="cfg-hint cfg-hint--warn">{anafError()}</p>
          </Show>
          <div class="cfg-location-fields cfg-company-fields">
            <input class="input" placeholder="Denumire *" value={f().name ?? ""} onInput={e => patchForm("name", e.currentTarget.value)} />
            <input class="input" placeholder="Adresă" value={f().address ?? ""} onInput={e => patchForm("address", e.currentTarget.value)} />
            <input class="input" placeholder="Nr. Reg. Comerțului" value={f().nr_reg_com ?? ""} onInput={e => patchForm("nr_reg_com", e.currentTarget.value)} />
            <input class="input" placeholder="Telefon" value={f().phone ?? ""} onInput={e => patchForm("phone", e.currentTarget.value)} />
            <input class="input" placeholder="Cod poștal" value={f().postal_code ?? ""} onInput={e => patchForm("postal_code", e.currentTarget.value)} />
            <input class="input" placeholder="Status înregistrare" value={f().registration_status ?? ""} onInput={e => patchForm("registration_status", e.currentTarget.value)} />
            <input class="input" placeholder="Nume Bancă" value={f().bank_name ?? ""} onInput={e => patchForm("bank_name", e.currentTarget.value)} />
            <input class="input" placeholder="IBAN" value={f().iban ?? ""} onInput={e => patchForm("iban", e.currentTarget.value)} />
            <input class="input" type="number" step="0.01" placeholder="Capital social (lei)" value={f().capital_social ?? 200} onInput={e => patchForm("capital_social", parseFloat(e.currentTarget.value) || null)} />
            <label class="cfg-checkbox-row">
              <input type="checkbox" checked={f().is_vat_payer ?? false} onChange={e => {
                const checked = e.currentTarget.checked;
                patchForm("is_vat_payer", checked);
                if (checked && !f().tva_percentage) patchForm("tva_percentage", 21);
              }} />
              Plătitor TVA
            </label>
            <Show when={f().is_vat_payer}>
              <div class="cfg-input-suffix-wrap">
                <input class="input" type="number" placeholder="Cotă TVA" min="0" max="100" step="1"
                  value={f().tva_percentage ?? 21} onInput={e => patchForm("tva_percentage", e.currentTarget.value ? parseFloat(e.currentTarget.value) : null)} />
                <span class="cfg-input-suffix">%</span>
              </div>
            </Show>
            <textarea class="input cfg-textarea" placeholder="Descriere" value={f().description ?? ""} onInput={e => patchForm("description", e.currentTarget.value)} />
            <textarea class="input cfg-textarea" placeholder="Comentarii" value={f().comments ?? ""} onInput={e => patchForm("comments", e.currentTarget.value)} />
            <input class="input" placeholder="Site web (https://...)" value={f().website ?? ""} onInput={e => patchForm("website", e.currentTarget.value)} />
          </div>
          <div class="cfg-location-actions">
            <button class="btn btn-sm btn-primary" disabled={saving() || !f().name?.trim() || !f().cui} onClick={() => void add.run()}>Salvează</button>
            <button class="btn btn-sm btn-ghost" onClick={() => setAddMode(false)}>Anulează</button>
          </div>
        </div>
      </Show>

      <Show when={list.loading()}><p class="cfg-hint">Se încarcă...</p></Show>
      <Show when={!list.loading() && filtered().length === 0}>
        <p class="cfg-hint">{search() ? "Niciun rezultat." : "Nu există companii. Apasă \"+ Adaugă\" pentru a crea una."}</p>
      </Show>

      <div class="cfg-location-list">
        <For each={filtered()}>
          {(c) => (
            <Show
              when={editId() === c.id}
              fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{c.name}</span>
                    <span class="cfg-location-desc">
                      CUI: {c.cui}
                      {c.nr_reg_com ? ` · ${c.nr_reg_com}` : ""}
                      {c.is_vat_payer ? " · Plătitor TVA" : ""}
                    </span>
                    <Show when={c.address}>
                      <span class="cfg-location-desc">{c.address}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Editează</button>
                  </div>
                </div>
              }
            >
              <div class="cfg-location-row cfg-location-row--edit">
                <div class="cfg-location-fields cfg-company-fields">
                  <input class="input" placeholder="CUI *" value={ef().cui ?? ""} onInput={e => patchEditForm("cui", e.currentTarget.value)} />
                  <input class="input" placeholder="Denumire *" value={ef().name ?? ""} onInput={e => patchEditForm("name", e.currentTarget.value)} />
                  <input class="input" placeholder="Adresă" value={ef().address ?? ""} onInput={e => patchEditForm("address", e.currentTarget.value)} />
                  <input class="input" placeholder="Nr. Reg. Comerțului" value={ef().nr_reg_com ?? ""} onInput={e => patchEditForm("nr_reg_com", e.currentTarget.value)} />
                  <input class="input" placeholder="Telefon" value={ef().phone ?? ""} onInput={e => patchEditForm("phone", e.currentTarget.value)} />
                  <input class="input" placeholder="Cod poștal" value={ef().postal_code ?? ""} onInput={e => patchEditForm("postal_code", e.currentTarget.value)} />
                  <input class="input" placeholder="Status înregistrare" value={ef().registration_status ?? ""} onInput={e => patchEditForm("registration_status", e.currentTarget.value)} />
                  <input class="input" placeholder="Nume Bancă" value={ef().bank_name ?? ""} onInput={e => patchEditForm("bank_name", e.currentTarget.value)} />
                  <input class="input" placeholder="IBAN" value={ef().iban ?? ""} onInput={e => patchEditForm("iban", e.currentTarget.value)} />
                  <input class="input" type="number" step="0.01" placeholder="Capital social (lei)" value={ef().capital_social ?? 200} onInput={e => patchEditForm("capital_social", parseFloat(e.currentTarget.value) || null)} />
                  <label class="cfg-checkbox-row">
                    <input type="checkbox" checked={ef().is_vat_payer ?? false} onChange={e => {
                      const checked = e.currentTarget.checked;
                      patchEditForm("is_vat_payer", checked);
                      if (checked && !ef().tva_percentage) patchEditForm("tva_percentage", 21);
                    }} />
                    Plătitor TVA
                  </label>
                  <Show when={ef().is_vat_payer}>
                    <div class="cfg-input-suffix-wrap">
                      <input class="input" type="number" placeholder="Cotă TVA" min="0" max="100" step="1"
                        value={ef().tva_percentage ?? 21} onInput={e => patchEditForm("tva_percentage", e.currentTarget.value ? parseFloat(e.currentTarget.value) : null)} />
                      <span class="cfg-input-suffix">%</span>
                    </div>
                  </Show>
                  <textarea class="input cfg-textarea" placeholder="Descriere" value={ef().description ?? ""} onInput={e => patchEditForm("description", e.currentTarget.value)} />
                  <textarea class="input cfg-textarea" placeholder="Comentarii" value={ef().comments ?? ""} onInput={e => patchEditForm("comments", e.currentTarget.value)} />
                  <input class="input" placeholder="Site web (https://...)" value={ef().website ?? ""} onInput={e => patchEditForm("website", e.currentTarget.value)} />
                </div>
                {/* Logo & Background upload */}
                <div class="cfg-image-upload-row">
                  <input ref={logoInputRef!} type="file" accept="image/*" style="display:none"
                    onChange={e => { const f = e.currentTarget.files?.[0]; if (f) handleLogoFile(f); e.currentTarget.value = ""; }} />
                  <input ref={bgInputRef!} type="file" accept="image/*" style="display:none"
                    onChange={e => { const f = e.currentTarget.files?.[0]; if (f) handleBgFile(f); e.currentTarget.value = ""; }} />
                  <div class="cfg-image-upload-item">
                    <Show when={ef().logo_path} fallback={
                      <div class="cfg-img-placeholder" onClick={() => logoInputRef.click()}>Logo</div>
                    }>
                      <img src={ef().logo_path!} class="cfg-company-img-preview" alt="Logo" onClick={() => logoInputRef.click()} />
                    </Show>
                    <button class="btn btn-ghost btn-sm" disabled={logoUpload.loading()} onClick={() => logoInputRef.click()}>
                      {logoUpload.loading() ? "Se încarcă..." : ef().logo_path ? "Schimbă logo" : "Adaugă logo"}
                    </button>
                  </div>
                  <div class="cfg-image-upload-item">
                    <Show when={ef().background_path} fallback={
                      <div class="cfg-img-placeholder" onClick={() => bgInputRef.click()}>Fundal</div>
                    }>
                      <img src={ef().background_path!} class="cfg-company-img-preview cfg-company-img-preview--bg" alt="Fundal" onClick={() => bgInputRef.click()} />
                    </Show>
                    <button class="btn btn-ghost btn-sm" disabled={bgUpload.loading()} onClick={() => bgInputRef.click()}>
                      {bgUpload.loading() ? "Se încarcă..." : ef().background_path ? "Schimbă fundal" : "Adaugă fundal"}
                    </button>
                  </div>
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setDeleteTarget(c)}>Șterge</button>
                  <div style="flex:1" />
                  <button class="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>Anulează</button>
                  <button class="btn btn-sm btn-primary" disabled={saving() || !ef().name?.trim()} onClick={() => void save.run()}>Salvează</button>
                </div>
              </div>
            </Show>
          )}
        </For>
        <Show when={list.hasMore()}>
          <button class="btn btn-sm btn-ghost" disabled={list.loadingMore()} onClick={() => void list.loadMore()}>
            {list.loadingMore() ? "Se încarcă..." : "Încarcă mai multe"}
          </button>
        </Show>
      </div>
    </div>
  );
}
