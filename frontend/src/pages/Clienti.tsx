import { For, Show, createSignal, onMount } from "solid-js";
import { apiFetch } from "../utils/api";
import { adminVisible } from "../store/adminStore";

interface Client {
  id: number;
  tip: "fizic" | "juridic";
  nume: string;
  description: string | null;
  cui: string | null;
  reprezentant: string | null;
  telefon: string | null;
  email: string | null;
  adresa: string | null;
  comments: string | null;
}

function DeleteModal(props: { label: string; onConfirm: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div class="cfg-confirm-overlay">
      <div class="cfg-confirm-modal">
        <p class="cfg-confirm-text">Stergi <strong>{props.label}</strong>?</p>
        <div class="cfg-confirm-actions">
          <button class="btn btn-sm btn-ghost" onClick={props.onCancel}>Anulează</button>
          <button class="btn btn-sm btn-danger" disabled={props.saving} onClick={props.onConfirm}>Șterge</button>
        </div>
      </div>
    </div>
  );
}

function emptyForm() {
  return { tip: "fizic" as "fizic" | "juridic", nume: "", description: "", cui: "", reprezentant: "", telefon: "", email: "", adresa: "", comments: "" };
}

export default function Clienti() {
  const [clienti, setClienti] = createSignal<Client[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");

  const [viewId, setViewId] = createSignal<number | null>(null);
  const [editId, setEditId] = createSignal<number | null>(null);
  const [form, setForm] = createSignal(emptyForm());

  const [addMode, setAddMode] = createSignal(false);
  const [newForm, setNewForm] = createSignal(emptyForm());

  const [deleteTarget, setDeleteTarget] = createSignal<Client | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = search() ? `&q=${encodeURIComponent(search())}` : "";
      const res = await apiFetch(`/api/clienti?limit=200${q}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClienti(data.items ?? []);
    } catch {
      setError("Eroare la încărcare.");
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  function startEdit(c: Client) {
    setEditId(c.id);
    setViewId(null);
    setForm({ tip: c.tip, nume: c.nume, description: c.description ?? "", cui: c.cui ?? "", reprezentant: c.reprezentant ?? "", telefon: c.telefon ?? "", email: c.email ?? "", adresa: c.adresa ?? "", comments: c.comments ?? "" });
    setAddMode(false);
    setError(null);
  }

  function cancelEdit() { setEditId(null); setError(null); }

  async function saveEdit() {
    const f = form();
    if (!f.nume.trim()) { setError("Numele este obligatoriu."); return; }
    setSaving(true); setError(null);
    try {
      const res = await apiFetch(`/api/clienti/${editId()}`, {
        method: "PATCH",
        body: JSON.stringify({
          tip: f.tip, nume: f.nume.trim(),
          description: f.description.trim() || null,
          cui: f.cui.trim() || null, reprezentant: f.reprezentant.trim() || null,
          telefon: f.telefon.trim() || null, email: f.email.trim() || null,
          adresa: f.adresa.trim() || null, comments: f.comments.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated: Client = await res.json();
      setClienti(clienti().map((c) => c.id === updated.id ? updated : c));
      setEditId(null);
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  function startView(c: Client) { setViewId(c.id); setEditId(null); setAddMode(false); setError(null); }
  function closeView() { setViewId(null); }

  function startAdd() { setNewForm(emptyForm()); setAddMode(true); setEditId(null); setViewId(null); setError(null); }
  function cancelAdd() { setAddMode(false); setError(null); }

  async function saveAdd() {
    const f = newForm();
    if (!f.nume.trim()) { setError("Numele este obligatoriu."); return; }
    setSaving(true); setError(null);
    try {
      const res = await apiFetch("/api/clienti", {
        method: "POST",
        body: JSON.stringify({
          tip: f.tip, nume: f.nume.trim(),
          description: f.description.trim() || null,
          cui: f.cui.trim() || null, reprezentant: f.reprezentant.trim() || null,
          telefon: f.telefon.trim() || null, email: f.email.trim() || null,
          adresa: f.adresa.trim() || null, comments: f.comments.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: Client = await res.json();
      setClienti([created, ...clienti()]);
      setAddMode(false);
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget();
    if (!target) return;
    setSaving(true);
    try {
      await apiFetch(`/api/clienti/${target.id}`, { method: "DELETE" });
      setClienti(clienti().filter((c) => c.id !== target.id));
      setDeleteTarget(null);
    } catch {
      setError("Eroare la ștergere.");
    } finally {
      setSaving(false);
    }
  }

  function ClientForm(props: { f: ReturnType<typeof emptyForm>; setF: (f: ReturnType<typeof emptyForm>) => void }) {
    return (
      <div class="cfg-location-fields">
        <div style="display:flex;gap:8px">
          <button
            class={`btn btn-sm ${props.f.tip === "fizic" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => props.setF({ ...props.f, tip: "fizic" })}
          >Persoană fizică</button>
          <button
            class={`btn btn-sm ${props.f.tip === "juridic" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => props.setF({ ...props.f, tip: "juridic" })}
          >Persoană juridică</button>
        </div>
        <input class="input" placeholder="Nume *" value={props.f.nume} onInput={(e) => props.setF({ ...props.f, nume: e.currentTarget.value })} />
        <input class="input" placeholder="Descriere" value={props.f.description} onInput={(e) => props.setF({ ...props.f, description: e.currentTarget.value })} />
        <Show when={props.f.tip === "juridic"}>
          <input class="input" placeholder="CUI" value={props.f.cui} onInput={(e) => props.setF({ ...props.f, cui: e.currentTarget.value })} />
          <input class="input" placeholder="Reprezentant" value={props.f.reprezentant} onInput={(e) => props.setF({ ...props.f, reprezentant: e.currentTarget.value })} />
        </Show>
        <input class="input" placeholder="Telefon" value={props.f.telefon} onInput={(e) => props.setF({ ...props.f, telefon: e.currentTarget.value })} />
        <input class="input" placeholder="Email" value={props.f.email} onInput={(e) => props.setF({ ...props.f, email: e.currentTarget.value })} />
        <input class="input" placeholder="Adresă" value={props.f.adresa} onInput={(e) => props.setF({ ...props.f, adresa: e.currentTarget.value })} />
        <textarea class="input" placeholder="Comentarii" rows={3} style="resize:vertical" value={props.f.comments} onInput={(e) => props.setF({ ...props.f, comments: e.currentTarget.value })} />
      </div>
    );
  }

  return (
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Clienți</h1>
        <div style="display:flex;gap:8px;align-items:center">
          <input
            class="input reception-search"
            type="search"
            placeholder="Caută după nume..."
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); load(); }}
          />
          <button class="btn btn-primary btn-sm" onClick={startAdd}>+ Adaugă client</button>
        </div>
      </div>

      <Show when={error()}>
        <p class="cfg-error" style="margin-bottom:8px">{error()}</p>
      </Show>

      <Show when={addMode()}>
        <div class="cfg-location-row cfg-location-row--edit" style="margin-bottom:12px">
          <ClientForm f={newForm()} setF={setNewForm} />
          <div class="cfg-location-actions" style="margin-top:8px">
            <button class="btn btn-sm btn-ghost" onClick={cancelAdd}>Anulează</button>
            <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveAdd}>
              {saving() ? "Se salvează..." : "Salvează"}
            </button>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="cfg-hint">Se încarcă...</p>
      </Show>

      <Show when={!loading() && clienti().length === 0}>
        <p class="cfg-hint">Niciun client înregistrat.</p>
      </Show>

      <div class="cfg-location-list">
        <For each={clienti()}>
          {(c) => (
            <div class="cfg-location-row" classList={{ "cfg-location-row--edit": editId() === c.id || viewId() === c.id }}>
              <Show when={editId() === c.id}>
                <ClientForm f={form()} setF={setForm} />
                <div class="cfg-location-actions" style="margin-top:8px">
                  <button class="btn btn-sm btn-ghost" onClick={cancelEdit}>Anulează</button>
                  <Show when={adminVisible()}>
                    <button class="btn btn-sm btn-danger" onClick={() => setDeleteTarget(c)}>Șterge</button>
                  </Show>
                  <button class="btn btn-sm btn-primary" disabled={saving()} onClick={saveEdit}>
                    {saving() ? "Se salvează..." : "Salvează"}
                  </button>
                </div>
              </Show>
              <Show when={viewId() === c.id}>
                <div class="cfg-location-info">
                  <span class="cfg-location-name">
                    {c.nume}
                    <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": c.tip === "juridic" }}>
                      {c.tip === "juridic" ? "Juridică" : "Fizică"}
                    </span>
                  </span>
                  <Show when={c.description}>
                    <span class="cfg-location-desc"><strong>Descriere:</strong> {c.description}</span>
                  </Show>
                  <Show when={c.tip === "juridic" && c.cui}>
                    <span class="cfg-location-desc"><strong>CUI:</strong> {c.cui}</span>
                  </Show>
                  <Show when={c.tip === "juridic" && c.reprezentant}>
                    <span class="cfg-location-desc"><strong>Reprezentant:</strong> {c.reprezentant}</span>
                  </Show>
                  <Show when={c.telefon}>
                    <span class="cfg-location-desc"><strong>Telefon:</strong> {c.telefon}</span>
                  </Show>
                  <Show when={c.email}>
                    <span class="cfg-location-desc"><strong>Email:</strong> {c.email}</span>
                  </Show>
                  <Show when={c.adresa}>
                    <span class="cfg-location-desc"><strong>Adresă:</strong> {c.adresa}</span>
                  </Show>
                  <Show when={c.comments}>
                    <span class="cfg-location-desc" style="font-style:italic"><strong>Comentarii:</strong> {c.comments}</span>
                  </Show>
                </div>
                <div class="cfg-location-actions" style="margin-top:8px">
                  <button class="btn btn-sm btn-ghost" onClick={closeView}>Închide</button>
                  <button class="btn btn-sm btn-primary" onClick={() => startEdit(c)}>Editează</button>
                </div>
              </Show>
              <Show when={editId() !== c.id && viewId() !== c.id}>
                <div class="cfg-location-info" style="cursor:pointer;flex:1" onClick={() => startView(c)}>
                  <span class="cfg-location-name">
                    {c.nume}
                    <span class="client-tip-badge" classList={{ "client-tip-badge--juridic": c.tip === "juridic" }}>
                      {c.tip === "juridic" ? "Juridică" : "Fizică"}
                    </span>
                  </span>
                  <Show when={c.description}>
                    <span class="cfg-location-desc">{c.description}</span>
                  </Show>
                  <Show when={c.tip === "juridic" && (c.cui || c.reprezentant)}>
                    <span class="cfg-location-desc">
                      {[c.cui && `CUI: ${c.cui}`, c.reprezentant && `Rep: ${c.reprezentant}`].filter(Boolean).join(" · ")}
                    </span>
                  </Show>
                  <Show when={c.telefon || c.email}>
                    <span class="cfg-location-desc">
                      {[c.telefon, c.email].filter(Boolean).join(" · ")}
                    </span>
                  </Show>
                  <Show when={c.comments}>
                    <span class="cfg-location-desc" style="font-style:italic">{c.comments}</span>
                  </Show>
                </div>
                <div class="cfg-location-actions">
                  <button class="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Editează</button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={deleteTarget()}>
        <DeleteModal
          label={deleteTarget()!.nume}
          saving={saving()}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Show>
    </div>
  );
}
