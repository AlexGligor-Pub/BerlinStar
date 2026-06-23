import { Show, For, Index, createSignal, onMount, onCleanup, type JSX } from "solid-js";
import { apiFetch } from "../../utils/api";
import Input from "../../components/ui/Input";
import type { ClientLite, CompanyMeta, QuickInvoiceLine } from "./types";
import { VAT_OPTIONS, lineTotalGross, newLine } from "./types";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  accepted: { bg: "rgba(34,197,94,.15)", fg: "var(--success)" },
  rejected: { bg: "rgba(239,68,68,.12)", fg: "var(--danger)" },
  error: { bg: "rgba(239,68,68,.12)", fg: "var(--danger)" },
  in_prelucrare: { bg: "rgba(245,158,11,.15)", fg: "#d97706" },
  pending_upload: { bg: "var(--surface2)", fg: "var(--text-muted)" },
  draft: { bg: "var(--surface2)", fg: "var(--text-muted)" },
};

export function EFacturaStatusBadge(props: { status: string | null }) {
  const status = () => props.status ?? "draft";
  const colors = () => STATUS_COLORS[status()] ?? { bg: "var(--surface2)", fg: "var(--text-muted)" };
  return (
    <span
      style={`padding:2px 8px;border-radius:10px;background:${colors().bg};color:${colors().fg};font-size:11px;font-weight:600;border:1px solid ${colors().fg};white-space:nowrap`}
    >
      {status()}
    </span>
  );
}

export function CompanyPicker(props: {
  companies: CompanyMeta[];
  value: number | null;
  onChange: (companyId: number) => void;
  error?: string | null;
}) {
  return (
    <Show when={props.companies.length > 1}>
      <div class="field">
        <label class="field-label">Firma emitenta</label>
        <select
          class="input"
          value={props.value ?? ""}
          onChange={(e) => props.onChange(parseInt(e.currentTarget.value, 10))}
        >
          <option value="">— alege firma —</option>
          <For each={props.companies}>
            {(c) => <option value={c.company_id}>{c.name}</option>}
          </For>
        </select>
        <Show when={props.error}>
          <span class="field-error" role="alert">{props.error}</span>
        </Show>
      </div>
    </Show>
  );
}

export function LocationPicker(props: {
  locations: { id: number; name: string }[];
  value: number | null;
  onChange: (locationId: number) => void;
  error?: string | null;
}) {
  return (
    <Show when={props.locations.length > 1}>
      <div class="field">
        <label class="field-label">Locatie</label>
        <select
          class="input"
          value={props.value ?? ""}
          onChange={(e) => props.onChange(parseInt(e.currentTarget.value, 10))}
        >
          <option value="">— alege locatia —</option>
          <For each={props.locations}>
            {(l) => <option value={l.id}>{l.name}</option>}
          </For>
        </select>
        <Show when={props.error}>
          <span class="field-error" role="alert">{props.error}</span>
        </Show>
      </div>
    </Show>
  );
}

export function ClientSearch(props: {
  selected: ClientLite | null;
  onSelect: (c: ClientLite | null) => void;
}) {
  const [q, setQ] = createSignal("");
  const [results, setResults] = createSignal<ClientLite[]>([]);
  const [showDrop, setShowDrop] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  let timer: number | undefined;
  function onInput(v: string) {
    setQ(v);
    if (timer) window.clearTimeout(timer);
    if (!v.trim()) { setResults([]); setShowDrop(false); return; }
    timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/clienti?limit=20&q=${encodeURIComponent(v.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.items as ClientLite[]);
          setShowDrop(true);
        }
      } finally { setLoading(false); }
    }, 300);
  }

  function pick(c: ClientLite) {
    props.onSelect(c);
    setQ("");
    setResults([]);
    setShowDrop(false);
  }

  return (
    <div style="position:relative">
      <Show when={props.selected} fallback={
        <>
          <Input
            label="Cauta client (PF sau PJ)"
            value={q()}
            placeholder="Nume sau CUI..."
            onInput={(v) => onInput(v)}
            onFocus={() => { if (results().length) setShowDrop(true); }}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          />
          <Show when={showDrop() && (loading() || results().length)}>
            <div
              style="position:absolute;left:0;right:0;top:100%;z-index:10;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:4px;max-height:220px;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,.08)"
            >
              <Show when={loading()}>
                <div style="padding:8px 12px;color:var(--text-muted);font-size:13px">Cautare...</div>
              </Show>
              <For each={results()}>
                {(c) => (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                    style="display:block;width:100%;text-align:left;padding:8px 12px;background:transparent;border:none;cursor:pointer;border-bottom:1px solid var(--border)"
                  >
                    <div style="font-weight:600">{c.nume}</div>
                    <div style="font-size:12px;color:var(--text-muted)">
                      {c.tip === "juridic" ? `CUI ${c.cui ?? "—"}` : (c.cui ? `CNP ${c.cui}` : "Persoană fizică")}
                      <Show when={c.adresa}>{` · ${c.adresa}`}</Show>
                    </div>
                  </button>
                )}
              </For>
              <Show when={!loading() && results().length === 0}>
                <div style="padding:8px 12px;color:var(--text-muted);font-size:13px">Nu am gasit rezultate.</div>
              </Show>
            </div>
          </Show>
        </>
      }>
        {(c) => (
          <div class="field">
            <label class="field-label">Client selectat</label>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2)">
              <div>
                <div style="font-weight:600">{c().nume}</div>
                <div style="font-size:12px;color:var(--text-muted)">
                  {c().tip === "juridic" ? `CUI ${c().cui ?? "—"}` : (c().cui ? `CNP ${c().cui}` : "Persoană fizică")}
                  <Show when={c().adresa}>{` · ${c().adresa}`}</Show>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => props.onSelect(null)}
              >
                Schimba
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export function FizicClientForm(props: { onClientCreated: (c: ClientLite) => void }) {
  const [nume, setNume] = createSignal("");
  const [cnp, setCnp] = createSignal("");
  const [adresa, setAdresa] = createSignal("");
  const [telefon, setTelefon] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function save() {
    setError(null);
    if (!nume().trim()) { setError("Numele e obligatoriu."); return; }
    const cnpVal = cnp().trim();
    if (cnpVal && !/^\d{13}$/.test(cnpVal)) {
      setError("CNP invalid (trebuie 13 cifre) sau lasa gol pentru 13 zerouri.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: "fizic",
          nume: nume().trim(),
          cui: cnpVal || null,
          adresa: adresa().trim() || null,
          telefon: telefon().trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail ?? "Eroare la salvarea clientului.");
        return;
      }
      const created: ClientLite = await res.json();
      props.onClientCreated(created);
      setNume(""); setCnp(""); setAdresa(""); setTelefon("");
    } finally { setLoading(false); }
  }

  return (
    <div style="display:flex;flex-direction:column;gap:8px">
      <Input label="Nume *" value={nume()} placeholder="Nume si prenume" onInput={(v) => setNume(v)} />
      <Input label="CNP (optional — gol = 13 zerouri pe e-Factura)" value={cnp()} placeholder="13 cifre sau gol" onInput={(v) => setCnp(v)} />
      <Input label="Adresa" value={adresa()} placeholder="Adresa" onInput={(v) => setAdresa(v)} />
      <Input label="Telefon" value={telefon()} placeholder="Telefon" onInput={(v) => setTelefon(v)} />
      <Show when={error()}><span class="field-error" role="alert">{error()}</span></Show>
      <button type="button" class="btn btn-primary btn-sm" onClick={save} disabled={loading() || !nume().trim()}>
        {loading() ? "..." : "Salveaza client fizic"}
      </button>
    </div>
  );
}

export function AnafLookup(props: {
  onClientCreated: (c: ClientLite) => void;
}) {
  const [cui, setCui] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [preview, setPreview] = createSignal<{
    name: string;
    address: string;
    nr_reg_com: string | null;
    phone: string | null;
    is_vat_payer: boolean | null;
  } | null>(null);

  async function lookup() {
    setError(null);
    setPreview(null);
    const cuiNum = cui().trim().replace(/^RO/i, "");
    if (!/^\d+$/.test(cuiNum)) { setError("CUI invalid (doar cifre)."); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/companies/anaf/${cuiNum}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Firma nu a fost gasita la ANAF." : `Eroare ${res.status}`);
        return;
      }
      const data = await res.json();
      setPreview({
        name: data.name ?? "",
        address: data.address ?? "",
        nr_reg_com: data.nr_reg_com ?? null,
        phone: data.phone ?? null,
        is_vat_payer: data.is_vat_payer ?? null,
      });
    } finally { setLoading(false); }
  }

  async function saveAsClient() {
    const p = preview();
    if (!p) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: "juridic",
          nume: p.name,
          cui: cui().trim().replace(/^RO/i, ""),
          adresa: p.address,
          telefon: p.phone,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail ?? "Eroare la salvarea clientului.");
        return;
      }
      const created: ClientLite = await res.json();
      props.onClientCreated(created);
      setCui("");
      setPreview(null);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1">
          <Input
            label="CUI firma (ex: 12345678)"
            value={cui()}
            placeholder="Cifre, fara RO"
            onInput={(v) => setCui(v)}
            error={error()}
          />
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={lookup}
          disabled={loading() || !cui().trim()}
        >
          {loading() ? "..." : "Cauta"}
        </button>
      </div>
      <Show when={preview()}>
        {(p) => (
          <div style="margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2)">
            <div style="font-weight:600">{p().name}</div>
            <Show when={p().address}>
              <div style="font-size:13px;color:var(--text-muted)">{p().address}</div>
            </Show>
            <Show when={p().nr_reg_com}>
              <div style="font-size:12px;color:var(--text-muted)">Reg. com: {p().nr_reg_com}</div>
            </Show>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
              {p().is_vat_payer ? "Platitor TVA" : "Neplatitor TVA"}
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              style="margin-top:8px"
              onClick={saveAsClient}
              disabled={loading()}
            >
              Salveaza ca client
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}

export function ItemsEditor(props: {
  lines: QuickInvoiceLine[];
  onChange: (lines: QuickInvoiceLine[]) => void;
  errors: Record<string, string>;
}) {
  function update(idx: number, patch: Partial<QuickInvoiceLine>) {
    const next = props.lines.map((l, i) => i === idx ? { ...l, ...patch } : l);
    props.onChange(next);
  }
  function remove(idx: number) {
    props.onChange(props.lines.filter((_, i) => i !== idx));
  }
  function add() {
    props.onChange([...props.lines, newLine()]);
  }

  // Folosim <Index> in loc de <For> ca DOM-ul sa ramana stabil per index:
  // <For> ar recrea randul cand obiectul liniei e inlocuit (focus loss dupa fiecare tasta).
  return (
    <div>
      <div style="font-weight:600;margin-bottom:8px">Articole</div>
      <Index each={props.lines}>
        {(line, idx) => (
          <div
            class="fr-item-row"
            style="display:grid;grid-template-columns:1fr 70px 80px 110px 90px 36px;gap:8px;align-items:end;margin-bottom:8px"
          >
            <Input
              label={idx === 0 ? "Descriere" : undefined}
              value={line().name}
              placeholder="Servicii / produs"
              onInput={(v) => update(idx, { name: v })}
              error={props.errors[`name_${idx}`]}
            />
            <Input
              label={idx === 0 ? "Cant" : undefined}
              type="number"
              min="1"
              step="1"
              value={String(line().qty)}
              onInput={(v) => update(idx, { qty: Math.max(1, parseInt(v, 10) || 1) })}
            />
            <Input
              label={idx === 0 ? "UM" : undefined}
              value={line().unit}
              onInput={(v) => update(idx, { unit: v })}
            />
            <Input
              label={idx === 0 ? "Pret (net)" : undefined}
              type="number"
              min="0"
              step="0.01"
              value={String(line().price)}
              onInput={(v) => update(idx, { price: parseFloat(v) || 0 })}
              error={props.errors[`price_${idx}`]}
            />
            <div class="field">
              <Show when={idx === 0}>
                <label class="field-label">TVA</label>
              </Show>
              <select
                class="input"
                value={line().vatPercent}
                onChange={(e) => update(idx, { vatPercent: parseInt(e.currentTarget.value, 10) })}
              >
                <For each={VAT_OPTIONS}>
                  {(v) => <option value={v}>{v}%</option>}
                </For>
              </select>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              aria-label="Sterge linie"
              onClick={() => remove(idx)}
              disabled={props.lines.length <= 1}
              style="height:38px"
            >
              ✕
            </button>
          </div>
        )}
      </Index>
      <button type="button" class="btn btn-ghost btn-sm" onClick={add}>
        + Adauga linie
      </button>
      <div style="margin-top:12px;display:flex;justify-content:space-between;font-weight:600;border-top:1px solid var(--border);padding-top:8px">
        <span>Total (cu TVA)</span>
        <span>{props.lines.reduce((s, l) => s + lineTotalGross(l), 0).toFixed(2)} RON</span>
      </div>
    </div>
  );
}

export function RowKebab(props: {
  canEdit: boolean;
  canSend: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  let wrap: HTMLDivElement | undefined;

  function onOutside(e: MouseEvent) {
    if (!open()) return;
    if (wrap && !wrap.contains(e.target as Node)) setOpen(false);
  }

  onMount(() => {
    document.addEventListener("mousedown", onOutside);
    onCleanup(() => document.removeEventListener("mousedown", onOutside));
  });

  function item(label: string, onClick: () => void, disabled = false, danger = false): JSX.Element {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(false); onClick(); }}
        style={`display:block;width:100%;text-align:left;padding:8px 12px;background:transparent;border:none;cursor:${disabled ? "not-allowed" : "pointer"};opacity:${disabled ? 0.5 : 1};color:${danger ? "var(--danger)" : "var(--text)"};font-size:13px`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={wrap}
      onClick={(e) => e.stopPropagation()}
      style="position:relative;display:inline-block"
    >
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        aria-label="Actiuni"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style="padding:4px 8px"
      >
        ⋮
      </button>
      <Show when={open()}>
        <div
          style="position:absolute;right:0;top:100%;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:4px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,.1)"
        >
          {item("Vizualizeaza", props.onView)}
          {item("Editeaza", props.onEdit, !props.canEdit)}
          {item("Trimite la SPV", props.onSend, !props.canSend)}
          {item("Sterge", props.onDelete, !props.canDelete, true)}
        </div>
      </Show>
    </div>
  );
}
