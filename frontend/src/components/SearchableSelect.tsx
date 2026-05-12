import { For, Show, createMemo, createSignal } from "solid-js";

export default function SearchableSelect<T extends { id: number }>(props: {
  items: T[];
  value: number | "";
  onSelect: (id: number | "") => void;
  getLabel: (item: T) => string;
  placeholder: string;
  onAddNew?: (value: string) => Promise<void> | void;
}) {
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);

  const selected = () => props.items.find((i) => i.id === props.value) ?? null;

  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return props.items;
    return props.items.filter((i) => props.getLabel(i).toLowerCase().includes(q));
  });

  return (
    <div style="position:relative;flex:1">
      <input
        class="input"
        style="width:100%"
        placeholder={props.placeholder}
        value={open() ? query() : (selected() ? props.getLabel(selected()!) : "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <Show when={open()}>
        <div style="position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.2)">
          <div
            style="padding:5px 10px;font-size:12px;color:var(--text-muted);cursor:pointer"
            onMouseDown={(e) => { e.preventDefault(); props.onSelect(""); setOpen(false); }}
          >
            — {props.placeholder} —
          </div>
          <For each={filtered()}>
            {(item) => (
              <div
                style={`padding:6px 10px;font-size:13px;cursor:pointer;${props.value === item.id ? "font-weight:600;background:var(--primary-bg,rgba(99,102,241,.1))" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); props.onSelect(item.id); setOpen(false); setQuery(""); }}
              >
                {props.getLabel(item)}
              </div>
            )}
          </For>
          <Show when={filtered().length === 0}>
            <Show
              when={query().trim() && props.onAddNew}
              fallback={<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Niciun rezultat</div>}
            >
              <div
                style="padding:6px 10px;font-size:12px;color:var(--primary);cursor:pointer;font-weight:500"
                onMouseDown={async (e) => {
                  e.preventDefault();
                  await props.onAddNew!(query().trim());
                  setOpen(false);
                  setQuery("");
                }}
              >
                + Adaugă "{query()}"
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}
