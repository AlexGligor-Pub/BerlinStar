import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { apiFetch, apiUpload } from "../../utils/api";
import { notify } from "../../store/notificationsStore";
import type { Department, Category, Item } from "./types";
import { compressToPng, exportCSV, exportPDF } from "./shared";
import { ExportMenu, DeleteModal } from "./components";

export default function ProduseSiServiciiPanel() {
  // ── shared ──
  const [departments, setDepartments] = createSignal<Department[]>([]);
  const [filterDeptId, setFilterDeptId] = createSignal<number | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // ── tabs ──
  const [activeTab, setActiveTab] = createSignal<"categorii" | "produse">("categorii");

  // ── categories ──
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [catsLoading, setCatsLoading] = createSignal(false);
  const [catEditId, setCatEditId] = createSignal<number | null>(null);
  const [catEditName, setCatEditName] = createSignal("");
  const [catEditDeptId, setCatEditDeptId] = createSignal<number | null>(null);
  const [catAddMode, setCatAddMode] = createSignal(false);
  const [catNewName, setCatNewName] = createSignal("");
  const [catNewDeptId, setCatNewDeptId] = createSignal<number | null>(null);
  const [catDeleteTarget, setCatDeleteTarget] = createSignal<Category | null>(null);

  // ── items ──
  const [items, setItems] = createSignal<Item[]>([]);
  const [itemsLoading, setItemsLoading] = createSignal(false);
  const [itemFilterCatId, setItemFilterCatId] = createSignal<number | null>(null);
  const [itemFilterType, setItemFilterType] = createSignal<"all" | "Produs" | "Service">("all");
  const [itemEditId, setItemEditId] = createSignal<number | null>(null);
  const [itemEditForm, setItemEditForm] = createSignal({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: 0 });
  const [itemAddMode, setItemAddMode] = createSignal(false);
  const [itemNewForm, setItemNewForm] = createSignal({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: 0 });
  const [itemDeleteTarget, setItemDeleteTarget] = createSignal<Item | null>(null);
  const [itemEditImagePath, setItemEditImagePath] = createSignal<string | null>(null);
  const [itemImageUploading, setItemImageUploading] = createSignal(false);
  let itemFileInputRef: HTMLInputElement | undefined;

  async function handleItemImageFile(file: File) {
    const id = itemEditId();
    if (!id) return;
    setItemImageUploading(true);
    setError(null);
    try {
      const compressed = await compressToPng(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await apiUpload(`/api/items/${id}/image`, fd);
      if (!res.ok) throw new Error("Eroare la upload imagine.");
      const updated = await res.json() as { image_path: string | null };
      setItemEditImagePath(updated.image_path ?? null);
      setItems(items().map(it => it.id === id ? { ...it, image_path: updated.image_path ?? null } : it));
    } catch (ex: any) {
      setError(ex?.message ?? "Eroare la upload.");
    } finally {
      setItemImageUploading(false);
    }
  }

  async function loadDepartments() {
    try {
      const res = await apiFetch("/api/departments?limit=200");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Department[] };
      const depts: Department[] = data.items ?? [];
      setDepartments(depts);
      if (catNewDeptId() === null && depts.length > 0) setCatNewDeptId(depts[0].id);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Eroare la încărcare departamente.", "error");
    }
  }

  async function loadCategories() {
    setCatsLoading(true);
    try {
      const dq = filterDeptId() != null ? `&department_id=${filterDeptId()}` : "";
      const res = await apiFetch(`/api/categories?limit=200${dq}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories(data.items ?? []);
    } catch {
      setError("Eroare la încărcarea categoriilor.");
    } finally {
      setCatsLoading(false);
    }
  }

  async function loadItems() {
    setItemsLoading(true);
    try {
      const cq = itemFilterCatId() != null ? `&category_id=${itemFilterCatId()}` : "";
      const tq = itemFilterType() !== "all" ? `&type=${itemFilterType()}` : "";
      const dq = filterDeptId() != null ? `&department_id=${filterDeptId()}` : "";
      const res = await apiFetch(`/api/items?limit=300${cq}${tq}${dq}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("Eroare la încărcarea produselor.");
    } finally {
      setItemsLoading(false);
    }
  }

  function switchTab(tab: "categorii" | "produse") {
    setActiveTab(tab);
    if (tab === "categorii") loadCategories();
  }

  onMount(() => { loadDepartments(); loadCategories(); });

  // When dept filter changes: refresh category list + reset cat filter
  createEffect(() => {
    filterDeptId();
    setItemFilterCatId(null);
    loadCategories();
  });

  // Auto-load items cand filtrele se schimba (doar pe tab produse)
  createEffect(() => {
    const tab = activeTab();
    filterDeptId();
    itemFilterType();
    itemFilterCatId();
    if (tab === "produse") loadItems();
  });

  // ── categories CRUD ──
  async function saveCatEdit() {
    if (!catEditName().trim() || !catEditDeptId()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/categories/${catEditId()}`, {
        method: "PATCH",
        body: JSON.stringify({ name: catEditName().trim(), department_id: catEditDeptId() }),
      });
      if (!res.ok) throw new Error();
      setCatEditId(null);
      await loadCategories();
    } catch { setError("Eroare la salvare."); } finally { setSaving(false); }
  }

  async function saveCatAdd() {
    if (!catNewName().trim() || !catNewDeptId()) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: catNewName().trim(), department_id: catNewDeptId() }),
      });
      if (!res.ok) throw new Error();
      setCatNewName(""); setCatAddMode(false);
      await loadCategories();
    } catch { setError("Eroare la adăugare."); } finally { setSaving(false); }
  }

  async function confirmCatDelete() {
    const c = catDeleteTarget(); if (!c) return;
    setSaving(true); setError(null); setCatDeleteTarget(null);
    try {
      await apiFetch(`/api/categories/${c.id}`, { method: "DELETE" });
      await loadCategories();
    } catch { setError("Eroare la ștergere."); } finally { setSaving(false); }
  }

  // ── items CRUD ──
  async function saveItemEdit() {
    const f = itemEditForm();
    if (!f.name.trim() || !f.price || !f.unit.trim() || !f.category_id) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/items/${itemEditId()}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: f.name.trim(), description: f.description.trim() || null,
          price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
        }),
      });
      if (!res.ok) throw new Error();
      setItemEditId(null);
      await loadItems();
    } catch { setError("Eroare la salvare."); } finally { setSaving(false); }
  }

  async function saveItemAdd() {
    const f = itemNewForm();
    if (!f.name.trim() || !f.price || !f.unit.trim() || !f.category_id) return;
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({
          name: f.name.trim(), description: f.description.trim() || null,
          price: parseFloat(f.price), unit: f.unit.trim(), type: f.type, category_id: f.category_id,
        }),
      });
      if (!res.ok) throw new Error();
      setItemNewForm({ name: "", description: "", price: "", unit: "", type: "Produs", category_id: itemNewForm().category_id });
      setItemAddMode(false);
      await loadItems();
    } catch { setError("Eroare la adăugare."); } finally { setSaving(false); }
  }

  async function confirmItemDelete() {
    const it = itemDeleteTarget(); if (!it) return;
    setSaving(true); setError(null); setItemDeleteTarget(null);
    try {
      await apiFetch(`/api/items/${it.id}`, { method: "DELETE" });
      await loadItems();
    } catch { setError("Eroare la ștergere."); } finally { setSaving(false); }
  }

  // ── export helpers ──
  function filterLabel() {
    const parts: string[] = [];
    const dept = filterDeptId();
    if (dept !== null) parts.push("Departament: " + (departments().find(d => d.id === dept)?.name ?? dept));
    const cat = itemFilterCatId();
    if (cat !== null) parts.push("Categorie: " + (categories().find(c => c.id === cat)?.name ?? cat));
    if (itemFilterType() !== "all") parts.push("Tip: " + (itemFilterType() === "Service" ? "Servicii" : "Produse"));
    return parts.length > 0 ? parts.join(" | ") : "Toate";
  }

  function doCatCSV() {
    const label = filterLabel();
    exportCSV("Categorii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Categorie", "Departament"],
      categories().map(c => [c.name, departments().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doCatPDF() {
    const label = filterLabel();
    exportPDF("Categorii" + (label !== "Toate" ? " — " + label : ""),
      ["Categorie", "Departament"],
      categories().map(c => [c.name, departments().find(d => d.id === c.department_id)?.name ?? ""]));
  }
  function doItemCSV() {
    const label = filterLabel();
    exportCSV("Produse_si_Servicii" + (label !== "Toate" ? "_" + label.replace(/[^a-zA-Z0-9]/g, "_") : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }
  function doItemPDF() {
    const label = filterLabel();
    exportPDF("Produse și Servicii" + (label !== "Toate" ? " — " + label : ""),
      ["Nume", "Tip", "Categorie", "Preț (RON)", "Unitate", "Descriere"],
      items().map(it => [it.name, it.type === "Service" ? "Serviciu" : "Produs", it.category_name ?? "", parseFloat(it.price).toFixed(2), it.unit, it.description ?? ""]));
  }

  function ItemForm(props: { f: typeof itemNewForm extends () => infer T ? T : never; setF: (v: any) => void; }) {
    return (
      <div class="cfg-location-fields">
        <input class="input" placeholder="Nume *" value={props.f.name} onInput={e => props.setF({ ...props.f, name: e.currentTarget.value })} />
        <input class="input" placeholder="Descriere" value={props.f.description} onInput={e => props.setF({ ...props.f, description: e.currentTarget.value })} />
        <div style="display:flex;gap:8px">
          <input class="input" style="flex:1" type="number" step="0.01" min="0" placeholder="Preț *" value={props.f.price} onInput={e => props.setF({ ...props.f, price: e.currentTarget.value })} />
          <input class="input" style="width:100px" placeholder="UM *" value={props.f.unit} onInput={e => props.setF({ ...props.f, unit: e.currentTarget.value })} />
        </div>
        <div style="display:flex;gap:8px">
          <button class={`btn btn-sm ${props.f.type === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Produs" })}>Produs</button>
          <button class={`btn btn-sm ${props.f.type === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => props.setF({ ...props.f, type: "Service" })}>Serviciu</button>
        </div>
        <select class="input" value={props.f.category_id} onChange={e => props.setF({ ...props.f, category_id: parseInt(e.currentTarget.value) })}>
          <option value={0} disabled>Selectează categorie *</option>
          <For each={categories()}>
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
          <button class="btn btn-sm btn-primary" onClick={() => { setCatAddMode(true); setCatEditId(null); setError(null); }}>+ Adaugă</button>
        </Show>
        <Show when={activeTab() === "produse"}>
          <ExportMenu onCSV={doItemCSV} onPDF={doItemPDF} />
          <button class="btn btn-sm btn-primary" onClick={() => { setItemAddMode(true); setItemEditId(null); setError(null); }}>+ Adaugă</button>
        </Show>
      </div>

      {/* ── Filters (all at top) ── */}
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        <Show when={departments().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${filterDeptId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(null)}>Toate departamentele</button>
            <For each={departments()}>
              {(d) => <button class={`btn btn-sm ${filterDeptId() === d.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterDeptId(d.id)}>{d.name}</button>}
            </For>
          </div>
        </Show>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class={`btn btn-sm ${itemFilterType() === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("all")}>Toate</button>
          <button class={`btn btn-sm ${itemFilterType() === "Produs" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Produs")}>Produse</button>
          <button class={`btn btn-sm ${itemFilterType() === "Service" ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterType("Service")}>Servicii</button>
        </div>
        <Show when={activeTab() === "produse" && categories().length > 0}>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class={`btn btn-sm ${itemFilterCatId() === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(null)}>Toate categoriile</button>
            <For each={categories()}>
              {(c) => <button class={`btn btn-sm ${itemFilterCatId() === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setItemFilterCatId(c.id)}>{c.name}</button>}
            </For>
          </div>
        </Show>
      </div>

      {/* ── Tabs ── */}
      <div class="cfg-tabs">
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "categorii" }} onClick={() => switchTab("categorii")}>
          Categorii <span class="cfg-tab-count">{categories().length}</span>
        </button>
        <button class="cfg-tab" classList={{ "cfg-tab--active": activeTab() === "produse" }} onClick={() => switchTab("produse")}>
          Produse și Servicii <span class="cfg-tab-count">{items().length}</span>
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
                <For each={departments()}>
                  {(d) => <option value={d.id}>{d.name}</option>}
                </For>
              </select>
            </div>
            <div class="cfg-location-actions" style="margin-top:8px">
              <button class="btn btn-sm btn-ghost" onClick={() => { setCatAddMode(false); setError(null); }}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving() || !catNewName().trim() || !catNewDeptId()} onClick={saveCatAdd}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={catsLoading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!catsLoading() && categories().length === 0}>
          <p class="cfg-hint">Nu există categorii{filterDeptId() ? " pentru acest departament" : ""}.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={categories()}>
            {(c) => (
              <Show when={catEditId() === c.id} fallback={
                <div class="cfg-location-row">
                  <div class="cfg-location-info">
                    <span class="cfg-location-name">{c.name}</span>
                    <span class="cfg-location-desc">{departments().find(d => d.id === c.department_id)?.name ?? ""}</span>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => { setCatEditId(c.id); setCatEditName(c.name); setCatEditDeptId(c.department_id); setError(null); }}>Editează</button>
                  </div>
                </div>
              }>
                <div class="cfg-location-row cfg-location-row--edit">
                  <div class="cfg-location-fields">
                    <input class="input" placeholder="Nume *" value={catEditName()} onInput={e => setCatEditName(e.currentTarget.value)} />
                    <select class="input" value={catEditDeptId() ?? 0} onChange={e => setCatEditDeptId(parseInt(e.currentTarget.value))}>
                      <For each={departments()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
                    </select>
                  </div>
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setCatDeleteTarget(c)}>Șterge</button>
                    <div style="flex:1" />
                    <button class="btn btn-sm btn-ghost" onClick={() => setCatEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving() || !catEditName().trim()} onClick={saveCatEdit}>Salvează</button>
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
              <button class="btn btn-sm btn-ghost" onClick={() => { setItemAddMode(false); setError(null); }}>Anulează</button>
              <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveItemAdd}>Salvează</button>
            </div>
          </div>
        </Show>
        <Show when={itemsLoading()}><p class="cfg-hint">Se încarcă...</p></Show>
        <Show when={!itemsLoading() && items().length === 0}>
          <p class="cfg-hint">Niciun produs sau serviciu pentru filtrele selectate.</p>
        </Show>
        <div class="cfg-location-list">
          <For each={items()}>
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
                    <span class="cfg-location-desc">{it.category_name ?? ""} · {parseFloat(it.price).toFixed(2)} RON / {it.unit}</span>
                    <Show when={it.description}>
                      <span class="cfg-location-desc" style="font-style:italic">{it.description}</span>
                    </Show>
                  </div>
                  <div class="cfg-location-actions">
                    <button class="btn btn-sm btn-ghost" onClick={() => {
                      setItemEditId(it.id);
                      setItemEditImagePath(it.image_path ?? null);
                      setItemEditForm({ name: it.name, description: it.description ?? "", price: it.price, unit: it.unit, type: it.type, category_id: it.category_id });
                      setError(null);
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
                      onChange={(ev) => { const f = ev.currentTarget.files?.[0]; if (f) handleItemImageFile(f); ev.currentTarget.value = ""; }}
                    />
                    <button class="btn btn-sm btn-ghost" disabled={itemImageUploading()} onClick={() => itemFileInputRef?.click()}>
                      {itemImageUploading() ? "..." : itemEditImagePath() ? "Schimbă poza" : "Adaugă poză"}
                    </button>
                  </div>
                  <ItemForm f={itemEditForm()} setF={setItemEditForm} />
                  <div class="cfg-location-actions" style="margin-top:8px">
                    <button class="btn btn-sm btn-ghost cfg-btn-danger" disabled={saving()} onClick={() => setItemDeleteTarget(it)}>Șterge</button>
                    <div style="flex:1" />
                    <button class="btn btn-sm btn-ghost" onClick={() => setItemEditId(null)}>Anulează</button>
                    <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveItemEdit}>Salvează</button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
