import { Show } from "solid-js";
import type { Product } from "../store/productsStore";
import { addToCart } from "../store/cartStore";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  return (
    <div class="product-card" onClick={() => addToCart(product)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && addToCart(product)}>
      <Show when={product.imagePath}>
        <img src={product.imagePath!} class="product-card-img" alt={product.name} />
      </Show>
      <div class="product-card-name">{product.name}</div>
      <div class="product-card-price">
        {product.price.toFixed(1)} lei
        <span class="product-card-per"> / {product.unit}</span>
      </div>
      <div class="product-card-unit">{product.type}</div>
    </div>
  );
}
