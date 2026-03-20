import { For, createMemo, createSignal, onMount } from "solid-js";
import { products, loadProducts } from "../store/productsStore";
import ProductCard from "../components/ProductCard";
import ShoppingList from "../components/ShoppingList";

export default function POS() {
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal("Toate");

  onMount(() => {
    loadProducts();
  });

  const categories = createMemo(() => {
    const cats = new Set(products().map((p) => p.category));
    return ["Toate", ...Array.from(cats)];
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return products().filter((p) => {
      const matchCat = category() === "Toate" || p.category === category();
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  });

  return (
    <div class="page-content">
      {/* Filtru + Cautare */}
      <div class="flex gap-8 mt-8" style="flex-wrap:wrap;margin-bottom:12px">
        <input
          class="input"
          type="search"
          placeholder="Cauta produs..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style="max-width:220px;flex:1"
        />
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
