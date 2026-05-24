import { For, Show, createEffect, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { products, loadProducts } from "../store/productsStore";
import { catalogDepartments, loadCatalogDepartments } from "../store/catalogThemesStore";
import { employees, loadEmployees, selectedEmployeeId, selectEmployee } from "../store/employeesStore";
import { receipts, loadReceipts, connectPosSSE, disconnectPosSSE, type Receipt } from "../store/receiptsStore";
import { triggerLoad, triggerNewDeviz } from "../store/resumeStore";
import { device } from "../store/deviceStore";
import ProductCard from "../components/ProductCard";
import ShoppingList from "../components/ShoppingList";
import SplitName from "../components/SplitName";

const PAGE_SIZE = 20;

interface TypeToggleProps {
  label: string;
  show: () => boolean;
  setShow: (v: boolean) => void;
}

/** Buton toggle ON/OFF independent. Ambele off = niciun filtru aplicat. */
function TypeToggle(props: TypeToggleProps) {
  return (
    <button
      class="btn btn-sm type-toggle-btn"
      classList={{ "type-toggle-btn--on": props.show(), "type-toggle-btn--off": !props.show() }}
      onClick={() => props.setShow(!props.show())}
    >
      {props.label}
    </button>
  );
}

function formatDevizTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 120) return "acum 1 min";
  if (diff < 3600) return `acum ${Math.floor(diff / 60)} min`;
  if (diff < 7200) return "acum 1 ora";
  if (diff < 86400) return `acum ${Math.floor(diff / 3600)} ore`;
  const d = new Date(dateStr);
  const months = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function POS() {
  const [panel, setPanel] = createSignal(0);
  const [selectedDepartmentId, setSelectedDepartmentId] = createSignal<number | null>(null);
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal("Toate");
  const [showProduse, setShowProduse] = createSignal(false);
  const [showServicii, setShowServicii] = createSignal(false);

  const [showDevizModal, setShowDevizModal] = createSignal(false);
  const [devizSearch, setDevizSearch] = createSignal("");
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);
  const [showNewDevizConfirm, setShowNewDevizConfirm] = createSignal(false);

  function confirmNewDeviz() {
    triggerNewDeviz();
    selectEmployee(null);
    setSelectedDepartmentId(null);
    setCategory("Toate");
    setShowProduse(false);
    setShowServicii(false);
    setShowNewDevizConfirm(false);
  }

  const unpaidFiltered = createMemo(() => {
    const q = devizSearch().toLowerCase().trim();
    return receipts()
      .filter((r) => r.metodaPlata === undefined && !r.efacturaLocked)
      .filter((r) => !q || r.titlu.toLowerCase().includes(q));
  });

  function openDevizModal() {
    setDevizSearch("");
    setVisibleCount(PAGE_SIZE);
    loadReceipts(undefined, undefined, 200);
    setShowDevizModal(true);
  }

  function selectDeviz(r: Receipt) {
    triggerLoad({
      id: r.id,
      titlu: r.titlu,
      descriere: r.descriere ?? "",
      dateTehn: r.dateTehn ?? "",
      items: r.items,
      clientId: r.clientId,
      clientNume: r.clientNume,
      clientCui: r.clientCui,
      clientTip: r.clientTip,
      vehicol: r.vehicol ?? null,
    });
    setShowDevizModal(false);
  }

  function selectCatalogDepartment(id: number | null) {
    setSelectedDepartmentId(id);
    setCategory("Toate");
    if (selectedEmployeeId() !== null) setPanel(0);
  }

  onMount(() => {
    loadProducts();
    loadCatalogDepartments(device()?.locationId);
    loadEmployees(device()?.locationId);
    connectPosSSE();
  });

  onCleanup(() => disconnectPosSSE());

  // Daca nu e angajat selectat si lista e incarcata → shift la panel 1
  createEffect(() => {
    if (employees().length > 0 && selectedEmployeeId() === null) {
      setPanel(1);
    }
  });

  const locationDeptIds = createMemo(() =>
    new Set(catalogDepartments().map((d) => d.id))
  );

  const categories = createMemo(() => {
    const tid = selectedDepartmentId();
    const deptIds = locationDeptIds();
    const base = products().filter((p) =>
      tid !== null ? p.departmentId === tid : deptIds.has(p.departmentId!)
    );
    const cats = new Set(base.map((p) => p.category));
    return ["Toate", ...Array.from(cats)];
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    const sp = showProduse();
    const ss = showServicii();
    const noTypeFilter = !sp && !ss; // ambele off → fără filtru de tip
    const tid = selectedDepartmentId();
    const deptIds = locationDeptIds();
    return products().filter((p) => {
      const matchCat = category() === "Toate" || p.category === category();
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchType = noTypeFilter || (p.type === "Produs" && sp) || (p.type === "Service" && ss);
      const matchTheme = tid !== null ? p.departmentId === tid : deptIds.has(p.departmentId!);
      return matchCat && matchSearch && matchType && matchTheme;
    });
  });

  const [activeEmpTab, setActiveEmpTab] = createSignal<string | null>(null);

  const EMP_VIEW_KEY = "bs_emp_view_mode";
  const savedView = localStorage.getItem(EMP_VIEW_KEY);
  const [empViewMode, setEmpViewMode] = createSignal<"tabs" | "simplu" | "linie">(
    (savedView === "tabs" || savedView === "simplu" || savedView === "linie") ? savedView : "tabs"
  );
  function setAndSaveEmpViewMode(mode: "tabs" | "simplu" | "linie") {
    setEmpViewMode(mode);
    localStorage.setItem(EMP_VIEW_KEY, mode);
  }

  type EmpGroup = { label: string; list: ReturnType<typeof employees> };
  const employeeGroups = createMemo((): EmpGroup[] => {
    const map = new Map<string, ReturnType<typeof employees>>();
    const sorted = [...employees()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
    for (const e of sorted) {
      const key = e.description?.trim() || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const named: EmpGroup[] = [...map.entries()]
      .filter(([k]) => k !== "")
      .sort(([a], [b]) => a.localeCompare(b, "ro"))
      .map(([label, list]) => ({ label, list }));
    const noCategory = map.get("") ?? [];
    if (noCategory.length > 0) named.push({ label: "", list: noCategory });
    return named;
  });

  // Când se încarcă grupurile, setează tab-ul activ pe primul grup
  createEffect(() => {
    const groups = employeeGroups();
    if (groups.length === 0) return;
    setActiveEmpTab((prev) => {
      if (prev !== null && groups.some(g => g.label === prev)) return prev;
      return groups[0].label;
    });
  });

  const activeDepartmentName = createMemo(() => {
    const tid = selectedDepartmentId();
    if (tid === null) return null;
    return catalogDepartments().find((t) => t.id === tid)?.name ?? null;
  });

  return (
    <div class="pos-slider-wrapper">
      <div class="pos-slider-track" classList={{ "pos-slider-track--shifted": panel() === 1 }}>

        {/* ── Panel 1: POS ── */}
        <div class="pos-panel">
          <div class="pos-panel-inner">
            <div class="pos-layout">
              <div class="pos-left-col">
                <div class="pos-toolbar">
                  <button
                    class="btn btn-sm btn-primary"
                    style="white-space:nowrap;flex-shrink:0"
                    onClick={() => setShowNewDevizConfirm(true)}
                    title="Începe un deviz nou (șterge lista curentă)"
                  >
                    Deviz Nou
                  </button>
                  <input
                    class="input pos-search"
                    type="search"
                    placeholder="Cauta..."
                    value={search()}
                    onInput={(e) => setSearch(e.currentTarget.value)}
                  />
                  <TypeToggle
                    label="Produse"
                    show={showProduse}
                    setShow={setShowProduse}
                  />
                  <TypeToggle
                    label="Servicii"
                    show={showServicii}
                    setShow={setShowServicii}
                  />
                  <div class="filter-divider" />
                  <div class="pos-toolbar-cats">
                    <For each={categories()}>
                      {(cat) => (
                        <button
                          class={`btn btn-sm ${category() === cat ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setCategory(cat)}
                        >
                          {cat}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <div class="product-grid">
                  <For each={filtered()}>
                    {(product) => <ProductCard product={product} />}
                  </For>
                </div>
              </div>

              <div class="pos-right-col">
                <div class="pos-right-actions">
                  <button class="btn btn-sm btn-deviz" onClick={openDevizModal}>
                    Deschide Deviz
                  </button>
                  <button
                    class="btn btn-sm pos-panel-slide-btn"
                    classList={{
                      "btn-primary": selectedDepartmentId() !== null,
                      "btn-ghost": selectedDepartmentId() === null,
                    }}
                    onClick={() => setPanel(1)}
                  >
                    {activeDepartmentName() ?? "Departament"} ▶
                  </button>
                </div>
                <ShoppingList onEmployeeBadgeClick={() => setPanel(1)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel 2: Catalog Themes ── */}
        <div class="pos-panel pos-panel--theme">
          <div class="pos-panel-inner">
            <div class="pos-theme-header">
            </div>
            <div class="pos-theme-center">

              <h2 class="pos-theme-title">Departament</h2>
              <div class="pos-theme-grid">
                <button
                  class="pos-theme-card"
                  classList={{ "pos-theme-card--active": selectedDepartmentId() === null }}
                  onClick={() => selectCatalogDepartment(null)}
                >
                  <div class="pos-theme-preview pos-theme-preview--all" />
                  <span class="pos-theme-label">Toate</span>
                </button>
                <For each={catalogDepartments()}>
                  {(t, i) => (
                    <button
                      class="pos-theme-card"
                      classList={{ "pos-theme-card--active": selectedDepartmentId() === t.id }}
                      onClick={() => selectCatalogDepartment(t.id)}
                    >
                      <Show when={t.image_path} fallback={<div class={`pos-theme-preview pos-theme-preview--c${(i() % 6) + 1}`} />}>
                        <img src={t.image_path!} class="pos-theme-preview" style="object-fit:cover" />
                      </Show>
                      <span class="pos-theme-label">{t.name}</span>
                    </button>
                  )}
                </For>
              </div>

              <Show when={employeeGroups().length > 0}>
                <div class="pos-emp-section-header" style="margin-top:28px">
                  <h2 class="pos-theme-title">Angajati</h2>
                  <div class="pos-emp-view-toggle">
                    <button
                      class="pos-emp-view-btn"
                      classList={{ "pos-emp-view-btn--active": empViewMode() === "tabs" }}
                      onClick={() => setAndSaveEmpViewMode("tabs")}
                    >Tabs</button>
                    <button
                      class="pos-emp-view-btn"
                      classList={{ "pos-emp-view-btn--active": empViewMode() === "simplu" }}
                      onClick={() => setAndSaveEmpViewMode("simplu")}
                    >Simplu</button>
                    <button
                      class="pos-emp-view-btn"
                      classList={{ "pos-emp-view-btn--active": empViewMode() === "linie" }}
                      onClick={() => setAndSaveEmpViewMode("linie")}
                    >Linie</button>
                  </div>
                </div>

                {/* Tabs view */}
                <Show when={empViewMode() === "tabs"}>
                  <div class="pos-emp-tabs">
                    <For each={employeeGroups()}>
                      {(group) => (
                        <button
                          class="pos-emp-tab"
                          classList={{ "pos-emp-tab--active": activeEmpTab() === group.label }}
                          onClick={() => setActiveEmpTab(group.label)}
                        >
                          {group.label || "—"}
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="pos-employee-grid">
                    <For each={employeeGroups().find(g => g.label === activeEmpTab())?.list ?? []}>
                      {(e) => (
                        <button
                          class="pos-employee-card"
                          classList={{ "pos-employee-card--active": selectedEmployeeId() === e.id }}
                          onClick={() => { selectEmployee(e.id); setPanel(0); }}
                        >
                          {e.imagePath && <img src={e.imagePath} class="pos-employee-avatar" alt={e.name} />}
                          <SplitName name={e.name} class="pos-employee-card-name" />
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Simplu view */}
                <Show when={empViewMode() === "simplu"}>
                  <div class="pos-employee-grid">
                    <For each={[...employees()].sort((a, b) => a.name.localeCompare(b.name, "ro"))}>
                      {(e) => (
                        <button
                          class="pos-employee-card"
                          classList={{ "pos-employee-card--active": selectedEmployeeId() === e.id }}
                          onClick={() => { selectEmployee(e.id); setPanel(0); }}
                        >
                          {e.imagePath && <img src={e.imagePath} class="pos-employee-avatar" alt={e.name} />}
                          <SplitName name={e.name} class="pos-employee-card-name" />
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Linie view */}
                <Show when={empViewMode() === "linie"}>
                  <div class="pos-emp-linie">
                    <For each={employeeGroups()}>
                      {(group) => (
                        <>
                          <div class="pos-emp-linie-header">
                            {group.label || "Fără categorie"}
                          </div>
                          <For each={group.list}>
                            {(e) => (
                              <button
                                class="pos-emp-linie-item"
                                classList={{ "pos-emp-linie-item--active": selectedEmployeeId() === e.id }}
                                onClick={() => { selectEmployee(e.id); setPanel(0); }}
                              >
                                {e.imagePath && <img src={e.imagePath} class="pos-employee-avatar" alt={e.name} />}
                                <span class="pos-emp-linie-name">{e.name}</span>
                              </button>
                            )}
                          </For>
                        </>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

            </div>
          </div>
        </div>

      </div>

      <Show when={showNewDevizConfirm()}>
        <div class="sl-modal-overlay" style="z-index:500">
          <div class="sl-modal" style="max-width:520px;width:100%;text-align:center">
            <div class="sl-modal-header" style="justify-content:center;border-bottom:none;padding-bottom:0">
              <span class="sl-modal-title">Deviz Nou</span>
            </div>
            <div style="padding:16px 24px 8px;display:flex;flex-direction:column;align-items:center;gap:12px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style="color:var(--text);font-size:15px;line-height:1.5;margin:0">
                Lista curentă (produse, client, mașină, observații, angajat, departament și context POS-Hotel) va fi <strong>ștearsă complet</strong>.
                <br />Continui?
              </p>
            </div>
            <div class="sl-modal-footer" style="justify-content:center;gap:16px;padding:20px 24px 24px;border-top:none">
              <button
                class="btn btn-ghost"
                style="min-width:160px;min-height:96px;font-size:16px;font-weight:600;border-radius:10px;border:2px solid var(--border)"
                onClick={() => setShowNewDevizConfirm(false)}
              >
                Anulează
              </button>
              <button
                class="btn btn-primary"
                style="min-width:160px;min-height:96px;font-size:16px;font-weight:700;border-radius:10px"
                onClick={confirmNewDeviz}
              >
                Începe Deviz Nou
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showDevizModal()}>
        <div class="sl-modal-overlay">
          <div class="deviz-modal">
            <div class="sl-modal-header">
              <span class="sl-modal-title">Devize neplatite</span>
              <button class="btn btn-ghost btn-sm" onClick={() => setShowDevizModal(false)}>✕</button>
            </div>
            <input
              class="input"
              type="search"
              placeholder="Cauta dupa nume..."
              value={devizSearch()}
              onInput={(e) => { setDevizSearch(e.currentTarget.value); setVisibleCount(PAGE_SIZE); }}
              autofocus
            />
            <div
              class="deviz-modal-list"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
                  setVisibleCount((c) => Math.min(c + PAGE_SIZE, unpaidFiltered().length));
                }
              }}
            >
              <Show when={unpaidFiltered().length === 0}>
                <div class="deviz-modal-empty">Niciun deviz neplatit</div>
              </Show>
              <For each={unpaidFiltered().slice(0, visibleCount())}>
                {(r) => (
                  <button class="deviz-modal-row" onClick={() => selectDeviz(r)}>
                    <span class="deviz-modal-row-title">{r.titlu}</span>
                    <span class="deviz-modal-row-time">{formatDevizTime(r.date)}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
