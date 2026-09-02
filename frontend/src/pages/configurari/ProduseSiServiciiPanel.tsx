import { For, Show, createEffect, createSignal, on } from "solid-js";
import { departmentsApi, type Department } from "../../api/departments";
import { categoriesApi, itemsApi, type Category, type Item, type ItemType } from "../../api/catalog";
import { createListResource, cursorFetcher, useAction } from "../../hooks";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

interface ItemFormState {
  name: string;
  description: string;
  price: string;
  unit: string;
  type: ItemType;
  category_id: number;
}

function emptyItemForm(categoryId = 0): ItemFormState {
  return { name: "", description: "", price: "", unit: "", type: "Produs", category_id: categoryId };
}

export default function ProduseSiServiciiPanel() {
  // ── shared ──
  const departments = createListResource<Department>({ fetcher: () => departmentsApi.listAll() });
  const [filterDeptId, setFilterDeptId] = createSignal<number | null>(null);

  // ── tabs ──
  const [activeTab, setActiveTab] = createSignal<"categorii" | "produse">("categorii");

  // ── categories ──
  const categories = createListResource<Category>({
    fetcher: () => categoriesApi.listAll({ department_id: filterDeptId() }),
    deps: filterDeptId,
  });
  const [catEditId, setCatEditId] = createSignal<number | null>(null);
  const [catEditName, setCatEditName] = createSignal("");
  const [catEditDeptId, setCatEditDeptId] = createSignal<number | null>(null);
  const [catAddMode, setCatAddMode] = createSignal(false);
  const [catNewName, setCatNewName] = createSignal("");
  const [catNewDeptId, setCatNewDeptId] = createSignal<number | null>(null);
  const [catDeleteTarget, setCatDeleteTarget] = createSignal<Category | null>(null);

  createEffect(() => {
    const depts = departments.items();
    if (catNewDeptId() === null && depts.length > 0) setCatNewDeptId(depts[0].id);
  });

  // ── items ──
  const [itemFilterCatId, setItemFilterCatId] = createSignal<number | null>(null);
  const [itemFilterType, setItemFilterType] = createSignal<"all" | "Produs" | "Service">("all");
  const items = createListResource<Item>({
    fetcher: cursorFetcher(itemsApi.list, () => {
      const t = itemFilterType();
      return {
        department_id: filterDeptId(),
        category_id: itemFilterCatId(),
        type: t === "all" ? null : t,
      };
    }),
    deps: () => `${filterDeptId()}|${itemFilterCatId()}|${itemFilterType()}`,
    limit: 100,
  });
  const [itemEditId, setItemEditId] = createSignal<number | null>(null);
  const [itemEditForm, setItemEditForm] = createSignal<ItemFormState>(emptyItemForm());
  const [itemAddMode, setItemAddMode] = createSignal(false);
  const [itemNewForm, setItemNewForm] = createSignal<ItemFormState>(emptyItemForm());
  const [itemDeleteTarget, setItemDeleteTarget] = createSignal<Item | null>(null);
  const [itemEditImagePath, setItemEditImagePath] = createSignal<string | null>(null);
  let itemFileInputRef: HTMLInputElement | undefined;

  // Reseteaza filtrul de categorie cand se schimba departamentul (categoria selectata poate sa nu mai existe).
  createEffect(on(filterDeptId, () => setItemFilterCatId(null), { defer: true }));

  function switchTab(tab: "categorii" | "produse") {
    setActiveTab(tab);
  }

  // ── categories CRUD ──
  const catSave = useAction({
    fn: (id: number) => categoriesApi.update(id, { name: catEditName().trim(), department_id: catEditDeptId()! }),
    onSuccess: () => { setCatEditId(null); void categories.reload(); },
    silentError: true,
  });

  const catAdd = useAction({
    fn: () => categoriesApi.create({ name: catNewName().trim(), department_id: catNewDeptId()! }),
    onSuccess: () => { setCatNewName(""); setCatAddMode(false); void categories.reload(); },
    silentError: true,
  });

  const catRemove = useAction({
    fn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => void categories.reload(),
    silentError: true,
  });

  function confirmCatDelete() {
    const c = catDeleteTarget();
    if (!c) return;
    setCatDeleteTarget(null);
    void catRemove.run(c.id);
  }

  // ── items CRUD ──
  const itemSave = useAction({
    fn: (id: number) => {
      const f = itemEditForm();
      return itemsApi.update(id, {
        name: f.name.trim(), description: f.description.trim() || null,
        price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
      });
    },
    onSuccess: () => { setItemEditId(null); void items.reload(); },
    silentError: true,
  });

  const itemAdd = useAction({
    fn: () => {
      const f = itemNewForm();
      return itemsApi.create({
        name: f.name.trim(), description: f.description.trim() || null, currency: "RON",
        price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
      });
    },
    onSuccess: () => { setItemNewForm(emptyItemForm(itemNewForm().category_id)); setItemAddMode(false); void items.reload(); },
    silentError: true,
  });

  const itemRemove = useAction({
    fn: (id: number) => itemsApi.remove(id),
    onSuccess: () => void items.reload(),
    silentError: true,
  });

  const upload = useAction({
    fn: async (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", await compressToPng(file));
      return itemsApi.uploadImage(id, fd);
    },
    onSuccess: (updated, id) => {
      setItemEditImagePath(updated.image_path ?? null);
      items.mutate((prev) => prev.map((it) => (it.id === id ? { ...it, image_path: updated.image_path ?? null } : it)));
    },
    silentError: true,
  });

  function confirmItemDelete() {
    const it = itemDeleteTarget();
    if (!it) return;
    setItemDeleteTarget(null);
    void itemRemove.run(it.id);
  }

  const saving = () => catSave.loading() || catAdd.loading() || catRemove.loading()
    || itemSave.loading() || itemAdd.loading() || itemRemove.loading();
  const error = () => departments.error() ?? categories.error() ?? items.error()
    ?? catSave.error() ?? catAdd.error() ?? catRemove.error()
    ?? itemSave.error() ?? itemAdd.error() ?? itemRemove.error() ?? upload.error();

  // ── export helpers ──
  function filterLabel() {
    const parts: string[] = [];
    const dept = filterDeptId();
    if (dept !== null) parts.push("Departament: " + (departments.items().find(d => d.id === dept)?.name ?? dept));
    const cat = itemFilterCatId();
    if (cat !== null) parts.push("Categorie: " + (categories.items().find(c => c.id === cat)?.name ?? cat));
    if (itemFilterType() !== "all") parts.push("Tip: " + (itemFilterType() === "Service" ? "Servicii" : "Produse"));
    return parts.length > 0 ? parts.join(" | ") : "Toate";
  }

  function doCatCSV() {
    const label = filterLabel();
    exportCSV("Categorii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Categorie", "Departament"],
      categories.items().map(c => [c.name, departments.items().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doCatPDF() {
    const label = filterLabel();
    exportPDF("Categorii" + (label !== "Toate" ? " — " + label : ""),
      ["Categorie", "Departament"],
      categories.items().map(c => [c.name, departments.items().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doItemCSV() {
    const label = filterLabel();
    exportCSV("Produse_si_Servicii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items.items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }
  function doItemPDF() {
    const label = filterLabel();
    exportPDF("Produse și Servicii" + (label !== "Toate" ? " — " + label : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items.items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }

  function ItemForm(props: { f: ItemFormState; setF: (v: ItemFormState) => void }) {
    return (
      <div class="cfg-location-fields">
        <input class="input" placeholder="Nume *" value={props.f.name} onInput={e => props.setF({ ...props.f, name: e.currentTarget.value })} />
        <input class="input" placeholder="Descriere" value={props.f.description} onInput={e => props.setF({ ...props.f, description: e.currentTarget.value })} />
        <div style="display:flex;gap:8px">
          {/* Fara min="0": preturile negative sunt permise si se folosesc ca
              linii de reducere / restituire pe bon (ex. -100 lei). */}
          <input class="input" style="flex:1" type="number" step="0.01" placeholder="Preț * (negativ = reducere)" value={props.f.price} onInput={e => props.setF({ ...props.f, price: e.currentTarget.value })} />
          <input class="input" style="width:100px" placeholder="UM *" value={props.f.unit} onInput={e => props.setF({ ...props.f, unit: e.currentTarget.value })} />
        </div>
        <div style="display:flex;gap:8px">
          <button class={`btn btn-sm ${props.f.type === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Produs" })}>Produs</button>
          <button class={`btn btn-sm ${props.f.type === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Service" })}>Serviciu</button>
        </div>
        <select class="input" value={props.f.category_id} onChange={e => props.setF({ ...props.f, category_id: parseInt(e.currentTarget.value) })}>
          <option value={0} disabled>Selectează categorie *</option>
          <For each={categories.items()}>
            {(c) => <option value={c.id}>{c.name}</option>}
          </For>
        </select>
      </div>
    );
  }

  return (
    <div class="cfg-panel">
      <Show when={catDeleteTarget()}>
        <DeleteModal label={catDeleteTarget()!.name} saving={saving()} onConfirm={confirmCatDelete} onCancel={() => setCatDeleteTarget(null)} />
      </Show>
      <Show when={itemDeleteTarget()}>
        <DeleteModal label={itemDeleteTarget()!.name} saving={saving()} onConfirm={confirmItemDelete} onCancel={() => setItemDeleteTarget(null)} />
      </Show>

      {/* ── Header ── */}
      <div class="cfg-panel-header">
        <h2 class="cfg-panel-title">Produse și Servicii</h2>
        <Show when={activeTab() === "categorii"}>
          <ExportMenu onCSV={doCatCSV} onPDF={doCatPDF} />
          <button class="btn btn-sm btn-primary" onClick={() => { setCatAddMode(true); setCatEditId(null); }}>+ Adaugă</button>
        </Show>
        <Show when={activeTab() === "produse"}>
          <ExportMenu onCSV={doItemCSV} onPDF={doItemPDF} />
          <button class="btn btn-sm btn-primary" onClick={() => { setItemAddMode(true); setItemEditId(null); }}>+ Adaugă</button>
        </Show>
      </div>

      {/* ── Filters (all at top) ── */}
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        <Show when={departments.items().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${filterDeptId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(null)}>Toate departamentele</button>
            <For each={departments.items()}>
              {(d) => <button class={`btn btn-sm ${filterDeptId() === d.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(d.id)}>{d.name}</button>}
            </For>
          </div>
        </Show>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class={`btn btn-sm ${itemFilterType() === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("all")}>Toate</button>
          <button class={`btn btn-sm ${itemFilterType() === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Produs")}>Produse</button>
          <button class={`btn btn-sm ${itemFilterType() === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Service")}>Servicii</button>
        </div>
        <Show when={activeTab() === "produse" && categories.items().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${itemFilterCatId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(null)}>Toate categoriile</button>
            <For each={categories.items()}>
              {(c) => <button class={`btn btn-sm ${itemFilterCatId() === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(c.id)}>{c.name}</button>}
            </For>
          </div>
        </Show>
      </div>

      {/* ── Tabs ── */}
      <div class="cfg-tabs">
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "categorii" }} onClick={() => switchTab("categorii")}>
          Categorii <span class="cfg-tab-count">{categories.items().length}</span>
        </button>
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "produse" }} onClick={() => switchTab("produse")}>
          Produse și Servicii <span class="cfg-tab-count">{items.items().length}</span>
        </button>
      </div>

      <Show when={error()}><p class="cfg-error" style="margin-top:8px">{error()}</p></Show>

      {/* ── Categorii tab ── */}
      <Show when={activeTab() === "categorii"}>
        <Show when={catAddMode()}>
          <div class="cfg-location-row cfg-location-row--edit" style="margin-top:12px">
            <div class="cfg-location-fields">
              <input class="input" placeholder="Nume categorie *" value={catNewName()} onInput={e => setCatNewName(e.currentTarget.value)} />
              <select class="input" value={catNewDeptId() ?? 0} onChange={e => setCatNewDeptId(parseInt(e.currentTarget.value))}>
                <option value={0} disabled>Selectează departament *</option>
                <For each={departments.items()}>
                  {(d) => <option value={d.id}>{d.name}</option>}
                </For>
              </select>
            </div>
            <div class="cfg-location-actions" style="margin-top:8px">
              <button class="btn btn-sm btn-ghost" onClick={() => setCatAddMode(false)}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving() || !catNewName().trim() || !catNewDeptId()} onClick={() => void catAdd.run()}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={categories.loading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!categories.loading() && categories.items().length === 0}>
          <p class="cfg-hint">Nu există categorii{filterDeptId() ? " pentru acest departament" : ""}.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={categories.items()}>
            {(c) => (
              <Show when={catEditId() === c.id} fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{c.name}</span>
                    <span class="cfg-location-desc">{departments.items().find(d => d.id === c.department_id)?.name ?? ""}</span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => { setCatEditId(c.id); setCatEditName(c.name); setCatEditDeptId(c.department_id); }}>Editează</button>
                  </div>
                </div>
              }>
                <div class="cfg-location-row cfg-location-row--edit">
                  <div class="cfg-location-fields">
                    <input class="input" placeholder="Nume *" value={catEditName()} onInput={e => setCatEditName(e.currentTarget.value)} />
                    <select class="input" value={catEditDeptId() ?? 0} onChange={e => setCatEditDeptId(parseInt(e.currentTarget.value))}>
                      <For each={departments.items()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
                    </select>
                  </div>
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setCatDeleteTarget(c)}>Șterge</button>
                    <div style="flex:1" />
                    <button class="btn btn-sm btn-ghost" onClick={() => setCatEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving() || !catEditName().trim()} onClick={() => void catSave.run(c.id)}>Salvează</button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>

      {/* ── Produse tab ── */}
      <Show when={activeTab() === "produse"}>
        <Show when={itemAddMode()}>
          <div class="cfg-location-row cfg-location-row--edit" style="margin-top:12px;margin-bottom:12px">
            <ItemForm f={itemNewForm()} setF={setItemNewForm} />
            <div class="cfg-location-actions" style="margin-top:8px">
              <button class="btn btn-sm btn-ghost" onClick={() => setItemAddMode(false)}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving()} onClick={() => void itemAdd.run()}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={items.loading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!items.loading() && items.items().length === 0}>
          <p class="cfg-hint">Niciun produs sau serviciu pentru filtrele selectate.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={items.items()}>
            {(it) => (
              <Show when={itemEditId() === it.id} fallback={
                <div class="cfg-location-row">
                  <Show
                    when={it.image_path}
                    fallback={<div class="cfg-employee-avatar cfg-employee-avatar--sm cfg-employee-avatar--placeholder">{it.name.charAt(0).toUpperCase()}</div>}
                  >
                    <img src={it.image_path!} class="cfg-employee-avatar cfg-employee-avatar--sm" alt="avatar" />
                  </Show>
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">
                      {it.name}
                      <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": it.type === "Service" }}>
                        {it.type === "Service" ? "Serviciu" : "Produs"}
                      </span>
                    </span>
                    <span class="cfg-location-desc">
                      {it.category_name ?? ""} · {parseFloat(it.price).toFixed(2)} RON / {it.unit}
                      <Show when={parseFloat(it.price) < 0}>
                        <span class="cfg-item-discount-badge" title="Preț negativ — se scade din total (reducere / restituire)">reducere</span>
                      </Show>
                    </span>
                    <Show when={it.description}>
                      <span class="cfg-location-desc" style="font-style:italic">{it.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => {
                      setItemEditId(it.id);
                      setItemEditImagePath(it.image_path ?? null);
                      setItemEditForm({ name: it.name, description: it.description ?? "", price: it.price, unit: it.unit, type: it.type, category_id: it.category_id });
                    }}>Editează</button>
                  </div>
                </div>
              }>
                <div class="cfg-location-row cfg-location-row--edit">
                  <div class="cfg-employee-image-row" style="margin-bottom:8px">
                    <Show
                      when={itemEditImagePath()}
                      fallback={<div class="cfg-employee-avatar cfg-employee-avatar--placeholder">{itemEditForm().name.trim().charAt(0).toUpperCase() || "?"}</div>}
                    >
                      <img src={itemEditImagePath()!} class="cfg-employee-avatar" alt="avatar" />
                    </Show>
                    <input ref={itemFileInputRef} type="file" accept="image/*" style="display:none"
                      onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) void upload.run(it.id, f); ev.currentTarget.value = ""; }}
                    />
                    <button class="btn btn-sm btn-ghost" disabled={upload.loading()} onClick={() => itemFileInputRef?.click()}>
                      {upload.loading() ? "..." : itemEditImagePath() ? "Schimbă poza" : "Adaugă poză"}
                    </button>
                  </div>
                  <ItemForm f={itemEditForm()} setF={setItemEditForm} />
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setItemDeleteTarget(it)}>Șterge</button>
                    <div style="flex:1" />
                    <button class="btn btn-sm btn-ghost" onClick={() => setItemEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving()} onClick={() => void itemSave.run(it.id)}>Salvează</button>
                  </div>
                </div>
              </Show>
            )}
          </For>
          <Show when={items.hasMore()}>
            <button class="btn btn-sm btn-ghost" disabled={items.loadingMore()} onClick={() => void items.loadMore()}>
              {items.loadingMore() ? "Se încarcă..." : "Încarcă mai multe"}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
