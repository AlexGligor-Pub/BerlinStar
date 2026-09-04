import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import type { ColumnDef } from "@tanstack/solid-table";
import { Badge, Button, ConfirmDialog, EmptyState, Modal, Spinner } from "../../components/ui";
import { notify } from "../../store/notificationsStore";
import { radarApi, type RadarKind, type RadarSource } from "../../api/radar";
import { KIND_BY_ID, KINDS, KV, RadarTable, errMsg, fmtDateTime } from "./shared";

function metaText(s: RadarSource): string {
  const m = s.meta ?? {};
  const str = (k: string) => (typeof m[k] === "string" && m[k] ? String(m[k]) : null);
  const parts: (string | null)[] = [];
  if (s.kind === "youtube") parts.push(str("title"));
  else if (s.kind === "company") parts.push(str("name"), m.cui ? `CUI ${String(m.cui)}` : null);
  else if (s.kind === "website") parts.push(str("title"));
  else if (s.kind === "gbusiness") parts.push(str("name"), m.rating != null ? `★ ${String(m.rating)}` : null);
  const txt = parts.filter(Boolean).join(" · ");
  return txt || s.value;
}

export default function SurseTab(props: { placesConfigured: boolean }) {
  const [sources, { refetch, mutate }] = createResource(() => radarApi.sources());
  const [filter, setFilter] = createSignal<RadarKind | "">("");
  const [toDelete, setToDelete] = createSignal<RadarSource | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  const [adding, setAdding] = createSignal(false);
  const [kind, setKind] = createSignal<RadarKind>("youtube");
  const [value, setValue] = createSignal("");
  const [label, setLabel] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  const all = () => sources() ?? [];
  const counts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const s of all()) c[s.kind] = (c[s.kind] ?? 0) + 1;
    return c;
  });
  const rows = createMemo(() => (filter() ? all().filter((s) => s.kind === filter()) : all()));

  function openAdd() {
    setKind("youtube");
    setValue("");
    setLabel("");
    setFormError("");
    setAdding(true);
  }

  async function submit() {
    const v = value().trim();
    if (!v) { setFormError("Completează valoarea sursei."); return; }
    setSaving(true);
    setFormError("");
    try {
      const created = await radarApi.createSource({ kind: kind(), value: v, label: label().trim() || undefined });
      setAdding(false);
      notify(`Sursă adăugată: ${metaText(created)}`, "success");
      void refetch();
    } catch (e) {
      setFormError(errMsg(e, "Nu am putut adăuga sursa."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(s: RadarSource) {
    try {
      const updated = await radarApi.updateSource(s.id, { enabled: !s.enabled });
      mutate(all().map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      notify(errMsg(e, "Eroare la salvarea sursei."), "error");
    }
  }

  async function confirmDelete() {
    const s = toDelete();
    if (!s) return;
    setDeleting(true);
    try {
      await radarApi.deleteSource(s.id);
      setToDelete(null);
      notify("Sursă ștearsă.", "success");
      void refetch();
    } catch (e) {
      notify(errMsg(e, "Eroare la ștergerea sursei."), "error");
    } finally {
      setDeleting(false);
    }
  }

  function stateBadge(s: RadarSource) {
    if (s.last_error) return <span title={s.last_error}><Badge kind="danger">Eroare</Badge></span>;
    if (s.last_collected_at) return <Badge kind="success">OK</Badge>;
    return <Badge kind="neutral">Necolectat</Badge>;
  }

  const columns: ColumnDef<RadarSource>[] = [
    {
      id: "kind",
      accessorKey: "kind",
      header: "Tip",
      cell: (info) => {
        const k = KIND_BY_ID[info.row.original.kind];
        return <Badge kind={k?.badge ?? "neutral"}>{k ? `${k.icon} ${k.label}` : info.row.original.kind}</Badge>;
      },
    },
    { id: "label", accessorKey: "label", header: "Etichetă", cell: (info) => info.row.original.label || "—" },
    { id: "meta", accessorFn: (s) => metaText(s), header: "Detalii", cell: (info) => metaText(info.row.original) },
    {
      id: "last_collected_at",
      accessorFn: (s) => s.last_collected_at ?? "",
      header: "Ultima colectare",
      cell: (info) => <span class="radar-mono">{fmtDateTime(info.row.original.last_collected_at)}</span>,
    },
    { id: "state", header: "Stare", enableSorting: false, cell: (info) => stateBadge(info.row.original) },
    {
      id: "actions",
      header: "Acțiuni",
      enableSorting: false,
      cell: (info) => {
        const s = info.row.original;
        return (
          <div class="radar-actions">
            <Button variant="ghost" size="sm" onClick={() => void toggle(s)}>
              {s.enabled ? "Dezactivează" : "Activează"}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setToDelete(s)}>Șterge</Button>
          </div>
        );
      },
    },
  ];

  const mobileCard = (s: RadarSource) => {
    const k = KIND_BY_ID[s.kind];
    return (
      <div class="radar-row">
        <div class="radar-row-head">
          <span class="radar-row-title">{s.label || metaText(s)}</span>
          <Badge kind={k?.badge ?? "neutral"}>{k ? `${k.icon} ${k.label}` : s.kind}</Badge>
        </div>
        <KV label="Detalii">{metaText(s)}</KV>
        <KV label="Ultima colectare"><span class="radar-mono">{fmtDateTime(s.last_collected_at)}</span></KV>
        <KV label="Stare">{stateBadge(s)}</KV>
        <div class="radar-actions">
          <Button variant="ghost" size="sm" onClick={() => void toggle(s)}>
            {s.enabled ? "Dezactivează" : "Activează"}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setToDelete(s)}>Șterge</Button>
        </div>
      </div>
    );
  };

  const activeKind = () => KIND_BY_ID[kind()];

  return (
    <div class="radar-panel">
      <div class="radar-toolbar">
        <div class="radar-filters">
          <button type="button" class="radar-chip" classList={{ "radar-chip--active": filter() === "" }} onClick={() => setFilter("")}>
            Toate ({all().length})
          </button>
          <For each={KINDS}>
            {(k) => (
              <button
                type="button"
                class="radar-chip"
                classList={{ "radar-chip--active": filter() === k.kind }}
                onClick={() => setFilter(k.kind)}
              >
                {k.icon} {k.label} ({counts()[k.kind] ?? 0})
              </button>
            )}
          </For>
        </div>
        <span class="radar-spacer" />
        <Button onClick={openAdd}>Adaugă sursă</Button>
      </div>

      <Show when={!sources.loading} fallback={<div class="radar-center"><Spinner /></div>}>
        <Show when={!sources.error} fallback={<p class="radar-error">Nu am putut încărca sursele.</p>}>
          <RadarTable
            data={rows()}
            columns={columns}
            mobileCard={mobileCard}
            initialSorting={[{ id: "kind", desc: false }]}
            empty={
              <EmptyState
                title="Nicio sursă urmărită"
                message="Adaugă un canal YouTube, un CUI de concurent, un site sau o afacere Google, iar radarul le va verifica la fiecare rulare."
                action={<Button onClick={openAdd}>Adaugă prima sursă</Button>}
              />
            }
          />
        </Show>
      </Show>

      <Modal
        open={adding()}
        onClose={() => setAdding(false)}
        title="Adaugă sursă"
        size="lg"
        closeDisabled={saving()}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving()}>Anulează</Button>
            <Button size="sm" loading={saving()} onClick={() => void submit()}>Adaugă</Button>
          </>
        }
      >
        <div class="radar-card-body">
          <div class="radar-kinds">
            <For each={KINDS}>
              {(k) => (
                <button
                  type="button"
                  class="radar-kind"
                  classList={{ "radar-kind--active": kind() === k.kind }}
                  onClick={() => { setKind(k.kind); setFormError(""); }}
                >
                  <span class="radar-kind-icon">{k.icon}</span>
                  <span class="radar-kind-name">{k.label}</span>
                  <span class="radar-kind-hint">{k.hint}</span>
                </button>
              )}
            </For>
          </div>

          <Show when={kind() === "gbusiness" && !props.placesConfigured}>
            <p class="radar-muted">
              Cheia Google Places nu este configurată pe platformă — recenziile nu vor putea fi colectate.
            </p>
          </Show>

          <div class="radar-field">
            <label class="form-label" for="radar-source-value">{activeKind()?.valueLabel}</label>
            <input
              id="radar-source-value"
              class="input"
              value={value()}
              placeholder={activeKind()?.placeholder}
              onInput={(e) => setValue(e.currentTarget.value)}
            />
            <span class="radar-muted">Exemplu: {activeKind()?.placeholder}</span>
          </div>

          <div class="radar-field">
            <label class="form-label" for="radar-source-label">Etichetă (opțional)</label>
            <input
              id="radar-source-label"
              class="input"
              value={label()}
              placeholder="Cum vrei să apară în listă"
              onInput={(e) => setLabel(e.currentTarget.value)}
            />
          </div>

          <p class="radar-muted">Sursa este verificată la salvare, iar denumirea reală se completează automat.</p>
          <Show when={formError()}><p class="radar-error">{formError()}</p></Show>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete() !== null}
        title="Ștergi sursa?"
        message={`Sursa „${toDelete()?.label || toDelete()?.value || ""}” și istoricul ei de colectări vor fi șterse definitiv.`}
        confirmLabel="Șterge"
        variant="danger"
        loading={deleting()}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
