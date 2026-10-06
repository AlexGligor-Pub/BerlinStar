import { createEffect, createSignal, splitProps, type JSX } from "solid-js";
import { formatDecimal, parseDecimal, type DecimalOptions } from "../../utils/decimal";

export interface DecimalInputProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "onInput" | "type" | "inputmode" | "inputMode"> {
  /**
   * Textul campului (string) SAU numarul din starea parintelui (number / null).
   * Cu numar, campul e rescris doar cand numarul difera de ce se citeste din
   * textul curent — deci „2," ramane „2," cat timp parintele tine 2 sau null.
   */
  value: string | number | null | undefined;
  /** `raw` = textul exact din camp; `value` = numarul citit (null daca e gol sau
   *  invalid); `valid` = false cand textul nu e un numar acceptat. */
  onInput?: (raw: string, value: number | null, valid: boolean) => void;
  integer?: boolean;
  maxDecimals?: number;
  allowNegative?: boolean;
}

/**
 * Camp numeric care nu rescrie niciodata ce tasteaza utilizatorul.
 *
 * E `type="text"` cu `inputmode` numeric: un `type="number"` legat de un semnal
 * raporteaza "" pentru text intermediar („12."), iar semnalul scris inapoi
 * stergea campul. Accepta „," si „." ca separator zecimal (vezi utils/decimal).
 */
export default function DecimalInput(props: DecimalInputProps) {
  const [local, rest] = splitProps(props, ["value", "onInput", "integer", "maxDecimals", "allowNegative", "ref"]);
  let el: HTMLInputElement | undefined;
  const [flagged, setFlagged] = createSignal(false);

  const opts = (): DecimalOptions => ({
    integer: local.integer,
    maxDecimals: local.maxDecimals,
    allowNegative: local.allowNegative,
  });

  function check(input: HTMLInputElement) {
    const r = parseDecimal(input.value, opts());
    // Un text neterminat („12,") nu e marcat ca gresit cat timp se tasteaza.
    setFlagged(!r.valid && !(r.incomplete && document.activeElement === input));
    return r;
  }

  // Sincronizare parinte -> DOM. Scriem in DOM doar cand valoarea parintelui
  // chiar difera de ce e deja in camp; altfel textul si cursorul raman neatinse.
  createEffect(() => {
    const v = local.value;
    const o = opts();
    if (!el) return;
    if (typeof v === "string") {
      if (el.value !== v) el.value = v;
    } else {
      const want = v ?? null;
      if (parseDecimal(el.value, o).value !== want) el.value = formatDecimal(want);
    }
    check(el);
  });

  createEffect(() => {
    if (el) el.style.borderColor = flagged() ? "var(--danger, #dc3545)" : "";
  });

  return (
    <input
      autocomplete="off"
      {...rest}
      ref={(e) => {
        el = e;
        e.addEventListener("focus", () => check(e));
        e.addEventListener("blur", () => check(e));
        const fwd = local.ref as ((node: HTMLInputElement) => void) | undefined;
        if (typeof fwd === "function") fwd(e);
      }}
      type="text"
      inputmode={local.integer ? "numeric" : "decimal"}
      aria-invalid={flagged() ? true : undefined}
      onInput={(e) => {
        const r = check(e.currentTarget);
        local.onInput?.(e.currentTarget.value, r.value, r.valid);
      }}
    />
  );
}
