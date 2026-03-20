import { For, createMemo, createSignal, onMount } from "solid-js";
import { products, loadProducts } from "../store/productsStore";
import ProductCard from "../components/ProductCard";
import ShoppingList from "../components/ShoppingList";

export default function POS() {
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal("Toate");
  const TYPE_CYCLE = ["Produse/Servicii", "Servicii", "Produse"] as const;
  const [typeFilter, setTypeFilter] = createSignal<typeof TYPE_CYCLE[number]>("Produse/Servicii");

  function cycleType() {
    const idx = TYPE_CYCLE.indexOf(typeFilter());
    setTypeFilter(TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length]);
  }

  onMount(() => {
    loadProducts();
  });

  const categories = createMemo(() => {
    const cats = new Set(products().map((p) => p.category));
    return ["Toate", ...Array.from(cats)];
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    const tf = typeFilter();
    return products().filter((p) => {
      const matchCat = category() === "Toate" || p.category === category();
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchType = tf === "Produse/Servicii" || p.type === (tf === "Servicii" ? "Serviciu" : "Produs");
      return matchCat && matchSearch && matchType;
    });
  });

  return (
    <div class="page-content">
      {/* Filtru + Cautare */}
      <div class="flex gap-8 mt-8" style="flex-wrap:wrap;margin-bottom:12px">
        <input
          class="input"
          type="search"
          placeholder="Cauta..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style="max-width:220px;flex:1"
        />
        <button class="btn btn-sm btn-ghost type-cycle-btn" onClick={cycleType}>
          {typeFilter()}
        </button>
        <div class="filter-divider" />
        <div class="flex gap-8" style="flex-wrap:wrap">
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

      <div class="pos-layout">
        <div class="product-grid">
          <For each={filtered()}>
            {(product) => <ProductCard product={product} />}
          </For>
        </div>

        <ShoppingList />
      </div>
    </div>
  );
}
