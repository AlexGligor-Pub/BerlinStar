import { For, Index, Show, createEffect, createResource, createSignal, on } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { locationsApi } from "../../api/locations";
import { departmentsApi } from "../../api/departments";
import {
  programariOnlineApi,
  type BookingHours,
  type BookingSettingsWrite,
  type PublicApiKey,
  type PublicApiKeyCreated,
} from "../../api/programariOnline";
import { notify } from "../../store/notificationsStore";

const WEEKDAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

const hhmm = (t: string) => t.slice(0, 5);
// Serverul MCP sta pe acelasi domeniu cu Berlin Star, la /mcp/<identificator>;
// serverul trimite adresa publica exacta cand o are configurata.
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" }) : "—";

/** `navigator.clipboard` lipseste pe origini nesecurizate (QA merge pe http). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cade pe varianta de mai jos */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ProgramariOnlinePanel() {
  const [locations] = createResource(() => locationsApi.listAll());
  const [departments] = createResource(() => departmentsApi.listAll());
  const [locationId, setLocationId] = createSignal<number | null>(null);

  createEffect(() => {
    const locs = locations();
    if (locs?.length && locationId() === null) setLocationId(locs[0].id);
  });

  const [settings, { refetch: refetchSettings }] = createResource(locationId, (id) =>
    programariOnlineApi.getSettings(id),
  );
  const [form, setForm] = createStore<BookingSettingsWrite>({
    enabled: false,
    site_name: "",
    public_slug: null,
    department_id: null,
    slot_minutes: 60,
    capacity: 1,
    lead_minutes: 120,
    horizon_days: 30,
    cancel_cutoff_minutes: 120,
    closed_on_holidays: true,
    hours: [],
    services: [],
  });
  createEffect(on(settings, (s) => {
    if (!s) return;
    const { location_id: _, ...rest } = s;
    setForm(reconcile(structuredClone(rest)));
  }));

  const [saving, setSaving] = createSignal(false);

  async function save() {
    const id = locationId();
    if (id === null) return;
    setSaving(true);
    try {
      const body: BookingSettingsWrite = {
        ...form,
        site_name: form.site_name.trim(),
        public_slug: form.public_slug?.trim().toLowerCase() || null,
        hours: form.hours.map((h) => ({ ...h, open_time: hhmm(h.open_time), close_time: hhmm(h.close_time) })),
        services: form.services.filter((s) => s.name.trim()),
      };
      await programariOnlineApi.saveSettings(id, body);
      await refetchSettings();
      notify("Programările online au fost salvate.", "success");
    } catch (e: any) {
      notify(e?.message ?? "Eroare la salvare.", "error");
    } finally {
      setSaving(false);
    }
  }

  const hoursFor = (weekday: number) =>
    form.hours.map((h, i) => ({ h, i })).filter((x) => x.h.weekday === weekday);

  function addInterval(weekday: number) {
    const last = hoursFor(weekday).at(-1)?.h;
    const next: BookingHours = last
      ? { weekday, open_time: hhmm(last.close_time), close_time: "18:00" }
      : { weekday, open_time: "08:00", close_time: "17:00" };
    setForm("hours", (hs) => [...hs, next]);
  }

  // ─── Chei API ──────────────────────────────────────────────────────────────
  const [keys, { refetch: refetchKeys }] = createResource(() => programariOnlineApi.listKeys());
  const locationKeys = () => (keys() ?? []).filter((k) => k.location_id === locationId());
  const [newKeyName, setNewKeyName] = createSignal("Site public");
  const [created, setCreated] = createSignal<PublicApiKeyCreated | null>(null);

  async function createKey() {
    const id = locationId();
    if (id === null || !newKeyName().trim()) return;
    try {
      setCreated(await programariOnlineApi.createKey(id, newKeyName().trim()));
      await refetchKeys();
    } catch (e: any) {
      notify(e?.message ?? "Eroare la generarea cheii.", "error");
    }
  }

  async function revoke(k: PublicApiKey) {
    if (!confirm(`Revoci cheia „${k.name}” (${k.prefix}…)? Site-ul care o folosește nu va mai putea face programări.`)) return;
    try {
      await programariOnlineApi.revokeKey(k.id);
      await refetchKeys();
      notify("Cheia a fost revocată.", "success");
    } catch (e: any) {
      notify(e?.message ?? "Eroare la revocare.", "error");
    }
  }

  return (
    <div class="cfg-panel">
      <h2 class="cfg-panel-title">Programări online</h2>
      <p class="cfg-hint">
        Clienții își fac singuri programarea pe site-ul public al garajului. Programările apar imediat
        în pagina <strong>Programări</strong>, iar un slot ocupat nu mai poate fi rezervat de altcineva.
      </p>

      <Show when={(locations()?.length ?? 0) > 1}>
        <div class="cfg-field-row" style="max-width:520px">
          <label>Locația</label>
          <select
            class="input"
            value={locationId() ?? ""}
            onChange={(e) => setLocationId(Number(e.currentTarget.value))}
          >
            <For each={locations()}>{(l) => <option value={l.id}>{l.name}</option>}</For>
          </select>
        </div>
      </Show>

      <Show when={settings()} fallback={<p class="cfg-hint">Se încarcă…</p>}>
        <section class="po-section">
          <h3>Site-ul public</h3>
          <label class="po-check">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm("enabled", e.currentTarget.checked)}
            />
            <span>Acceptă programări online pentru această locație</span>
          </label>
          <div class="cfg-field-row">
            <label>Numele site-ului</label>
            <input
              class="input"
              maxlength="120"
              value={form.site_name}
              onInput={(e) => setForm("site_name", e.currentTarget.value)}
            />
          </div>
          <p class="cfg-hint">
            Apare în antetul și în titlul site-ului public. Clienții văd: <strong>{form.site_name.trim() || "—"}</strong>
          </p>
          <div class="cfg-field-row">
            <label>Identificator public</label>
            <input
              class="input"
              maxlength="60"
              value={form.public_slug ?? ""}
              onInput={(e) => setForm("public_slug", e.currentTarget.value)}
            />
          </div>
          <p class="cfg-hint">
            Apare în adresa pentru asistenții AI. Doar litere mici, cifre și cratime.
          </p>
          <Show when={settings()?.public_slug}>
            {(slug) => {
              const mcpUrl = () => settings()?.mcp_url ?? `${window.location.origin}/mcp/${slug()}`;
              return (
              <div class="po-mcp">
                <span class="po-mcp-label">Adresa pentru asistenți AI (MCP)</span>
                <div class="po-newkey">
                  <code class="po-key">{mcpUrl()}</code>
                  <button
                    class="btn btn-sm btn-ghost"
                    onClick={async () =>
                      notify((await copyToClipboard(mcpUrl())) ? "Adresa a fost copiată." : "Copierea a eșuat — selectați textul manual.", "info")}
                  >
                    Copiază
                  </button>
                </div>
                <p class="cfg-hint">
                  Clienții o adaugă în Claude, ChatGPT sau alt asistent compatibil MCP și își fac programarea
                  vorbind cu el. Aceleași sloturi și reguli ca pe site-ul public. Adresa apare și pe site.
                </p>
              </div>
              );
            }}
          </Show>
          <div class="cfg-field-row">
            <label>Divizia</label>
            <select
              class="input"
              value={form.department_id ?? ""}
              onChange={(e) => setForm("department_id", e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            >
              <option value="">— fără —</option>
              <For each={departments()}>{(d) => <option value={d.id}>{d.name}</option>}</For>
            </select>
          </div>
        </section>

        <section class="po-section">
          <h3>Program</h3>
          <div class="po-hours">
            <Index each={WEEKDAYS}>
              {(name, weekday) => (
                <div class="po-day">
                  <span class="po-day-name">{name()}</span>
                  <div class="po-intervals">
                    <Show when={hoursFor(weekday).length} fallback={<span class="cfg-hint">Închis</span>}>
                      <For each={hoursFor(weekday)}>
                        {(x) => (
                          <span class="po-interval">
                            <input
                              class="input"
                              type="time"
                              value={hhmm(x.h.open_time)}
                              onChange={(e) => setForm("hours", x.i, "open_time", e.currentTarget.value)}
                            />
                            –
                            <input
                              class="input"
                              type="time"
                              value={hhmm(x.h.close_time)}
                              onChange={(e) => setForm("hours", x.i, "close_time", e.currentTarget.value)}
                            />
                            <button
                              class="btn btn-sm btn-ghost"
                              title="Șterge intervalul"
                              onClick={() => setForm("hours", (hs) => hs.filter((_, j) => j !== x.i))}
                            >
                              ✕
                            </button>
                          </span>
                        )}
                      </For>
                    </Show>
                    <button class="btn btn-sm btn-ghost" onClick={() => addInterval(weekday)}>
                      + interval
                    </button>
                  </div>
                </div>
              )}
            </Index>
          </div>
          <label class="po-check">
            <input
              type="checkbox"
              checked={form.closed_on_holidays}
              onChange={(e) => setForm("closed_on_holidays", e.currentTarget.checked)}
            />
            <span>Închis în zilele de sărbătoare legală</span>
          </label>
        </section>

        <section class="po-section">
          <h3>Reguli</h3>
          <NumberRow label="Pasul sloturilor" suffix="min" min={10} max={480}
            value={form.slot_minutes} onChange={(v) => setForm("slot_minutes", v)} />
          <NumberRow label="Programări simultane" suffix="max" min={1} max={50}
            value={form.capacity} onChange={(v) => setForm("capacity", v)} />
          <p class="cfg-hint po-row-hint">Câte mașini puteți primi în același timp (ex. numărul de elevatoare). Se numără și programările făcute la recepție.</p>
          <NumberRow label="Rezervare cu cel puțin" suffix="min înainte" min={0} max={10080}
            value={form.lead_minutes} onChange={(v) => setForm("lead_minutes", v)} />
          <NumberRow label="Rezervare cu cel mult" suffix="zile înainte" min={1} max={365}
            value={form.horizon_days} onChange={(v) => setForm("horizon_days", v)} />
          <NumberRow label="Anulare online până la" suffix="min înainte" min={0} max={10080}
            value={form.cancel_cutoff_minutes} onChange={(v) => setForm("cancel_cutoff_minutes", v)} />
        </section>

        <section class="po-section">
          <h3>Servicii</h3>
          <p class="cfg-hint">
            Clientul alege întâi lucrarea; durata ei stabilește cât timp ocupă programarea. Fără servicii, fiecare
            programare durează cât pasul sloturilor.
          </p>
          <Index each={form.services}>
            {(s, i) => (
              <div class="po-service">
                <input
                  class="input"
                  placeholder="Denumire"
                  maxlength="120"
                  value={s().name}
                  onInput={(e) => setForm("services", i, "name", e.currentTarget.value)}
                />
                <span class="cfg-input-suffix-wrap po-duration">
                  <input
                    class="input"
                    type="number"
                    min="10"
                    max="600"
                    step="5"
                    value={s().duration_minutes}
                    onChange={(e) => setForm("services", i, "duration_minutes", Number(e.currentTarget.value))}
                  />
                  <span class="cfg-input-suffix">min</span>
                </span>
                <label class="po-check">
                  <input
                    type="checkbox"
                    checked={s().active}
                    onChange={(e) => setForm("services", i, "active", e.currentTarget.checked)}
                  />
                  <span>activ</span>
                </label>
                <button
                  class="btn btn-sm btn-ghost"
                  title="Scoate serviciul"
                  onClick={() => setForm("services", (ss) => ss.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            )}
          </Index>
          <button
            class="btn btn-sm btn-ghost"
            onClick={() => setForm("services", (ss) => [...ss, { id: null, name: "", duration_minutes: 60, active: true }])}
          >
            + serviciu
          </button>
        </section>

        <div class="po-actions">
          <button class="btn btn-primary" disabled={saving() || !form.site_name.trim()} onClick={save}>
            {saving() ? "Se salvează…" : "Salvează"}
          </button>
        </div>

        <section class="po-section">
          <h3>Chei API</h3>
          <p class="cfg-hint">
            Site-ul public folosește o cheie ca să citească și să scrie calendarul acestei locații. Cheia se pune
            în configurarea serverului site-ului (<code>BERLINSTAR_API_KEY</code>), nu se publică nicăieri.
          </p>
          <Show when={created()}>
            {(c) => (
              <div class="po-created">
                <p><strong>Cheia nouă „{c().name}”</strong> — copiați-o acum, nu se mai afișează:</p>
                <code class="po-key">{c().key}</code>
                <div class="po-created-actions">
                  <button
                    class="btn btn-sm btn-primary"
                    onClick={async () =>
                      notify((await copyToClipboard(c().key)) ? "Cheia a fost copiată." : "Copierea a eșuat — selectați textul manual.",
                        "info")}
                  >
                    Copiază
                  </button>
                  <button class="btn btn-sm btn-ghost" onClick={() => setCreated(null)}>Am salvat-o</button>
                </div>
              </div>
            )}
          </Show>
          <Show when={locationKeys().length} fallback={<p class="cfg-hint">Nicio cheie pentru această locație.</p>}>
            <table class="po-keys">
              <thead>
                <tr><th>Nume</th><th>Cheie</th><th>Creată</th><th>Folosită ultima dată</th><th /></tr>
              </thead>
              <tbody>
                <For each={locationKeys()}>
                  {(k) => (
                    <tr classList={{ "po-revoked": !!k.revoked_at }}>
                      <td>{k.name}</td>
                      <td><code>{k.prefix}…</code></td>
                      <td>{fmtDate(k.created_at)}</td>
                      <td>{fmtDate(k.last_used_at)}</td>
                      <td>
                        <Show when={!k.revoked_at} fallback={<span class="cfg-hint">revocată {fmtDate(k.revoked_at)}</span>}>
                          <button class="btn btn-sm btn-danger" onClick={() => revoke(k)}>Revocă</button>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
          <div class="po-newkey">
            <input
              class="input"
              maxlength="120"
              value={newKeyName()}
              onInput={(e) => setNewKeyName(e.currentTarget.value)}
            />
            <button class="btn btn-sm btn-primary" disabled={!newKeyName().trim()} onClick={createKey}>
              Generează cheie
            </button>
          </div>
        </section>
      </Show>
    </div>
  );
}

function NumberRow(props: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div class="cfg-field-row">
      <label>{props.label}</label>
      <span class="cfg-input-suffix-wrap po-number">
        <input
          class="input"
          type="number"
          min={props.min}
          max={props.max}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.currentTarget.value))}
        />
        <span class="cfg-input-suffix">{props.suffix}</span>
      </span>
    </div>
  );
}
