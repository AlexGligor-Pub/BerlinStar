import { Show } from "solid-js";
import type { Product } from "../store/productsStore";
import { addToCart } from "../store/cartStore";

interface Props {
  product: Product;
}

export default function ProductCard(props: Props) {
  return (
    <div
      class="product-card"
      onClick={() => addToCart(props.product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && addToCart(props.product)}
    >
      <Show when={props.product.imagePath}>
        <img src={props.product.imagePath!} class="product-card-img" alt={props.product.name} />
      </Show>
      <div class="product-card-name">{props.product.name}</div>
      <div class="product-card-price">
        {props.product.price.toFixed(1)} lei
        <span class="product-card-per"> / {props.product.unit}</span>
      </div>
      <div class="product-card-unit">{props.product.type}</div>
    </div>
  );
}
