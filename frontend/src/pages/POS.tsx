import { For, Show, createEffect, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { products, loadProducts } from "../store/productsStore";
import { catalogDepartments, loadCatalogDepartments } from "../store/catalogThemesStore";
import { employees, loadEmployees, selectedEmployeeId, selectEmployee } from "../store/employeesStore";
import { receipts, loadReceipts, connectPosSSE, disconnectPosSSE, type Receipt } from "../store/receiptsStore";
import { triggerLoad } from "../store/resumeStore";
import { device } from "../store/deviceStore";
import ProductCard from "../components/ProductCard";
import ShoppingList from "../components/ShoppingList";

const PAGE_SIZE = 20;

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
  const TYPE_CYCLE = ["Produse/Servicii", "Servicii", "Produse"] as const;
  const [typeFilter, setTypeFilter] = createSignal<typeof TYPE_CYCLE[number]>("Produse/Servicii");

  const [showDevizModal, setShowDevizModal] = createSignal(false);
  const [devizSearch, setDevizSearch] = createSignal("");
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);

  const unpaidFiltered = createMemo(() => {
    const q = devizSearch().toLowerCase().trim();
    return receipts()
      .filter((r) => r.metodaPlata === undefined)
      .filter((r) => !q || r.titlu.toLowerCase().includes(q));
  });

  function openDevizModal() {
    setDevizSearch("");
    setVisibleCount(PAGE_SIZE);
    loadReceipts();
    setShowDevizModal(true);
  }

  function selectDeviz(r: Receipt) {
    triggerLoad({
      titlu: r.titlu,
      descriere: r.descriere ?? "",
      dateTehn: r.dateTehn ?? "",
      items: r.items,
    });
    setShowDevizModal(false);
  }

  function cycleType() {
    const idx = TYPE_CYCLE.indexOf(typeFilter());
    setTypeFilter(TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length]);
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

  const categories = createMemo(() => {
    const tid = selectedDepartmentId();
    const base = tid === null ? products() : products().filter((p) => p.departmentId === tid);
    const cats = new Set(base.map((p) => p.category));
    return ["Toate", ...Array.from(cats)];
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    const tf = typeFilter();
    const tid = selectedDepartmentId();
    return products().filter((p) => {
      const matchCat = category() === "Toate" || p.category === category();
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchType = tf === "Produse/Servicii" || p.type === (tf === "Servicii" ? "Serviciu" : "Produs");
      const matchTheme = tid === null || p.departmentId === tid;
      return matchCat && matchSearch && matchType && matchTheme;
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
            <div class="pos-toolbar">
              <input
                class="input pos-search"
                type="search"
                placeholder="Cauta..."
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
              />
              <button class="btn btn-sm btn-ghost type-cycle-btn" onClick={cycleType}>
                {typeFilter()}
              </button>
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
              <button class="btn btn-sm btn-ghost" onClick={openDevizModal}>
                Deviz existent
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

            <div class="pos-layout">
              <div class="product-grid">
                <For each={filtered()}>
                  {(product) => <ProductCard product={product} />}
                </For>
              </div>
              <ShoppingList />
            </div>
          </div>
        </div>

        {/* ── Panel 2: Catalog Themes ── */}
        <div class="pos-panel pos-panel--theme">
          <div class="pos-panel-inner">
            <div class="pos-theme-header">
              <button
                class="btn btn-sm btn-ghost"
                disabled={selectedEmployeeId() === null}
                onClick={() => setPanel(0)}
              >
                ◀ POS
              </button>
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
                      <div class={`pos-theme-preview pos-theme-preview--c${(i() % 6) + 1}`} />
                      <span class="pos-theme-label">{t.name}</span>
                    </button>
                  )}
                </For>
              </div>

              <h2 class="pos-theme-title" style="margin-top:28px">Angajati</h2>
              <div class="pos-employee-grid">
                <For each={employees()}>
                  {(e) => (
                    <button
                      class="pos-employee-card"
                      classList={{ "pos-employee-card--active": selectedEmployeeId() === e.id }}
                      onClick={() => { selectEmployee(e.id); setPanel(0); }}
                    >
                      {e.name}
                      {e.target > 0 && (
                        <span class="pos-employee-pct">
                          {Math.round(e.currentTargetAccumulation / e.target * 100)}%
                        </span>
                      )}
                    </button>
                  )}
                </For>
              </div>

            </div>
          </div>
        </div>

      </div>

      <Show when={showDevizModal()}>
        <div class="sl-modal-overlay" onClick={() => setShowDevizModal(false)}>
          <div class="deviz-modal" onClick={(e) => e.stopPropagation()}>
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
