import { Show, createMemo } from "solid-js";

interface SplitNameProps {
  name: string;
  class: string;
}

/** Sparge `name` la primul spatiu in doua spans (first, rest), pentru styling
 *  per-segment (CSS controleaza layout/spacing). Daca nu exista spatiu,
 *  randeaza un singur span cu numele intreg. */
export default function SplitName(props: SplitNameProps) {
  const parts = createMemo(() => {
    const idx = props.name.indexOf(" ");
    return idx === -1
      ? { first: props.name, rest: null as string | null }
      : { first: props.name.slice(0, idx), rest: props.name.slice(idx + 1) };
  });
  return (
    <span class={props.class}>
      <Show when={parts().rest !== null} fallback={parts().first}>
        <span>{parts().first}</span>
        <span>{parts().rest}</span>
      </Show>
    </span>
  );
}
