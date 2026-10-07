import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
  type JSX,
} from 'solid-js'
import { ApiError, api, type Booking, type PublicConfig, type Slot } from './api'
import { DEFAULT_SITE_NAME, loadEnvConfig, resolveSiteName } from './config'
import { addDays, dayKey, dayShort, hhmm, longDay, weekdayShort } from './dates'

export default function App() {
  const [siteName, setSiteName] = createSignal(DEFAULT_SITE_NAME)
  const [cfg, setCfg] = createSignal<PublicConfig | null>(null)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [tab, setTab] = createSignal<'book' | 'mine'>('book')

  onMount(async () => {
    const env = await loadEnvConfig()
    setSiteName(resolveSiteName(env.siteName))
    try {
      const c = await api.config()
      setCfg(c)
      setSiteName(resolveSiteName(env.siteName, c.site_name))
    } catch (e) {
      setLoadError(
        e instanceof ApiError && (e.status === 401 || e.status === 403)
          ? 'Programările online nu sunt disponibile momentan. Vă rugăm să ne sunați.'
          : e instanceof Error
            ? e.message
            : 'A apărut o eroare.',
      )
    }
  })

  createEffect(() => {
    document.title = `${siteName()} — Programări online`
  })

  return (
    <div class="page">
      <header class="hero">
        <h1>{siteName()}</h1>
        <p class="subtitle">Programări online</p>
        <Show when={cfg()}>
          {(c) => (
            <p class="contact">
              <Show when={c().address}>
                <span>{c().address}</span>
              </Show>
              <Show when={c().phone}>
                <a href={`tel:${c().phone!.replace(/\s/g, '')}`}>{c().phone}</a>
              </Show>
            </p>
          )}
        </Show>
      </header>

      <main class="card">
        <Show when={!loadError()} fallback={<p class="alert">{loadError()}</p>}>
          <Show when={cfg()} fallback={<p class="muted">Se încarcă…</p>}>
            {(c) => (
              <>
                <nav class="tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={tab() === 'book'}
                    classList={{ active: tab() === 'book' }}
                    onClick={() => setTab('book')}
                  >
                    Programare nouă
                  </button>
                  <button
                    role="tab"
                    aria-selected={tab() === 'mine'}
                    classList={{ active: tab() === 'mine' }}
                    onClick={() => setTab('mine')}
                  >
                    Programările mele
                  </button>
                </nav>
                <Show when={tab() === 'book'} fallback={<MyBookings cfg={c()} />}>
                  <BookingFlow cfg={c()} />
                </Show>
              </>
            )}
          </Show>
        </Show>
      </main>

      <Show when={cfg() && mcpUrl(cfg()!)}>
        <AssistantCard url={mcpUrl(cfg()!)!} siteName={siteName()} />
      </Show>

      <footer class="footer">Programări gestionate cu Berlin Star</footer>
    </div>
  )
}

// ─── Asistent AI (MCP) ───────────────────────────────────────────────────────

/** Adresa serverului MCP al garajului. Cand Berlin Star nu isi stie adresa
 *  publica, serverul e pe acelasi domeniu cu site-ul (instalarea standard). */
function mcpUrl(c: PublicConfig): string | null {
  if (c.mcp_url) return c.mcp_url
  return c.mcp_path ? new URL(c.mcp_path, location.origin).href : null
}

/** `navigator.clipboard` lipseste pe origini fara HTTPS. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* cade pe varianta de mai jos */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}

function AssistantCard(props: { url: string; siteName: string }) {
  const [copied, setCopied] = createSignal<boolean | null>(null)
  const slugName = () =>
    props.siteName
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-') || 'garaj'
  return (
    <section class="card assistant">
      <h2>Programare prin asistentul AI</h2>
      <p>
        Puteți face programarea și vorbind cu un asistent AI (Claude, ChatGPT sau altul compatibil
        MCP). Adăugați în asistent un conector cu adresa de mai jos, apoi cereți-i, de exemplu:{' '}
        <em>„Fă-mi o programare pentru schimb de anvelope marți dimineață.”</em>
      </p>
      <div class="copyrow">
        <code class="url">{props.url}</code>
        <button
          class="secondary small"
          type="button"
          onClick={async () => setCopied(await copyText(props.url))}
        >
          {copied() === true ? 'Copiat ✓' : 'Copiază adresa'}
        </button>
      </div>
      <Show when={copied() === false}>
        <p class="muted">Copierea nu a mers — selectați adresa și copiați-o manual.</p>
      </Show>
      <details class="howto">
        <summary>Cum adaug conectorul?</summary>
        <ul>
          <li>
            <strong>Claude</strong> (claude.ai sau aplicația): Setări → Conectori → adăugați un
            conector personalizat și lipiți adresa.
          </li>
          <li>
            <strong>ChatGPT</strong>: în setări, la conectori / aplicații, adăugați un conector
            personalizat cu adresa de mai sus.
          </li>
          <li>
            <strong>Claude Code</strong>:{' '}
            <code>
              claude mcp add --transport http {slugName()} {props.url}
            </code>
          </li>
        </ul>
        <p class="muted">
          Asistentul vă cere confirmarea înainte să se conecteze. Programarea se face pe numele și
          telefonul pe care i le dați.
        </p>
      </details>
    </section>
  )
}

// ─── Programare noua ─────────────────────────────────────────────────────────

function BookingFlow(props: { cfg: PublicConfig }) {
  const today = dayKey(new Date())
  const lastDay = addDays(today, Math.min(props.cfg.horizon_days, 30))

  const [serviceId, setServiceId] = createSignal<number | null>(
    props.cfg.services[0]?.id ?? null,
  )
  // Sursa e un obiect, nu id-ul direct: createResource nu porneste pe null,
  // iar garajele fara servicii configurate au serviceId null.
  const [slots, { refetch }] = createResource(
    () => ({ sid: serviceId() }),
    ({ sid }) => api.slots(today, lastDay, sid),
  )
  const allSlots = (): Slot[] => (slots.error ? [] : (slots() ?? []))
  const loading = () => slots.loading
  const slotsError = () => slots.error as Error | undefined

  const byDay = createMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of allSlots()) {
      const k = dayKey(new Date(s.start))
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return map
  })
  const days = createMemo(() => {
    const out: string[] = []
    for (let k = today; k <= lastDay; k = addDays(k, 1)) out.push(k)
    return out
  })

  const [day, setDay] = createSignal<string | null>(null)
  const [slot, setSlot] = createSignal<Slot | null>(null)
  const daySlots = () => {
    const d = day()
    return d ? byDay().get(d) : undefined
  }
  // Prima zi cu locuri libere e selectata implicit.
  createEffect(() => {
    const map = byDay()
    const d = day()
    if (d === null || !map.has(d)) setDay(days().find((k) => map.has(k)) ?? null)
  })

  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [done, setDone] = createSignal<Booking | null>(null)

  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
    e.preventDefault()
    const s = slot()
    if (!s) return
    const f = new FormData(e.currentTarget)
    const str = (k: string) => String(f.get(k) ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      const an = str('an')
      const booking = await api.book({
        start: s.start,
        nume: str('nume'),
        telefon: str('telefon'),
        descriere: str('descriere'),
        service_id: serviceId(),
        marca: str('marca') || null,
        model: str('model') || null,
        an: an ? Number(an) : null,
        website: str('website'),
      })
      setDone(booking)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSlot(null)
        refetch()
      }
      setError(err instanceof Error ? err.message : 'A apărut o eroare.')
    } finally {
      setBusy(false)
    }
  }

  const serviceName = () => props.cfg.services.find((s) => s.id === serviceId())?.name

  return (
    <Show when={!done()} fallback={<Confirmation booking={done()!} cfg={props.cfg} />}>
      <Show when={props.cfg.services.length > 0}>
        <section class="step">
          <h2>1. Ce lucrare doriți?</h2>
          <div class="chips">
            <For each={props.cfg.services}>
              {(s) => (
                <button
                  type="button"
                  class="chip"
                  classList={{ selected: serviceId() === s.id }}
                  onClick={() => {
                    setServiceId(s.id)
                    setSlot(null)
                  }}
                >
                  {s.name}
                  <small>{s.duration_minutes} min</small>
                </button>
              )}
            </For>
          </div>
        </section>
      </Show>

      <section class="step">
        <h2>{props.cfg.services.length ? '2.' : '1.'} Alegeți ziua și ora</h2>
        <Show when={!slotsError()} fallback={<p class="alert">{slotsError()!.message}</p>}>
          <div class="days" role="listbox" aria-label="Ziua">
            <For each={days()}>
              {(k) => {
                const count = () => byDay().get(k)?.length ?? 0
                return (
                  <button
                    type="button"
                    class="day"
                    classList={{ selected: day() === k }}
                    disabled={count() === 0}
                    onClick={() => {
                      setDay(k)
                      setSlot(null)
                    }}
                  >
                    <span class="wd">{weekdayShort(k)}</span>
                    <span class="dn">{dayShort(k)}</span>
                  </button>
                )
              }}
            </For>
          </div>
          <Show when={!loading()} fallback={<p class="muted">Se caută locuri libere…</p>}>
            <Show
              when={daySlots()}
              fallback={<p class="muted">Nu mai sunt locuri libere în perioada următoare.</p>}
            >
              {(list) => (
                <div class="times">
                  <For each={list()}>
                    {(s) => (
                      <button
                        type="button"
                        class="time"
                        classList={{ selected: slot()?.start === s.start }}
                        onClick={() => setSlot(s)}
                      >
                        {hhmm(s.start)}
                      </button>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </section>

      <Show when={slot()}>
        {(s) => (
          <form class="step" onSubmit={onSubmit}>
            <h2>{props.cfg.services.length ? '3.' : '2.'} Datele dumneavoastră</h2>
            <p class="summary">
              {serviceName() ? `${serviceName()}, ` : ''}
              {longDay(s().start)}, ora {hhmm(s().start)}
            </p>
            <label>
              Nume
              <input name="nume" required minlength="2" maxlength="100" autocomplete="name" />
            </label>
            <label>
              Telefon
              <input
                name="telefon"
                type="tel"
                required
                minlength="6"
                maxlength="30"
                autocomplete="tel"
                placeholder="07xx xxx xxx"
              />
            </label>
            <label>
              Ce problemă are mașina?
              <textarea name="descriere" required minlength="3" maxlength="500" rows="3" />
            </label>
            <details class="car">
              <summary>Detalii mașină (opțional)</summary>
              <div class="row">
                <label>
                  Marca
                  <input name="marca" maxlength="60" />
                </label>
                <label>
                  Model
                  <input name="model" maxlength="60" />
                </label>
                <label class="narrow">
                  An
                  <input name="an" type="number" min="1950" max={new Date().getFullYear() + 1} />
                </label>
              </div>
            </details>
            {/* Capcana pentru boti — ascunsa oamenilor si cititoarelor de ecran. */}
            <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <Show when={error()}>
              <p class="alert">{error()}</p>
            </Show>
            <button class="primary" type="submit" disabled={busy()}>
              {busy() ? 'Se trimite…' : 'Confirmă programarea'}
            </button>
            <p class="fineprint">
              Folosim datele doar pentru această programare. Vă puteți anula programarea
              online cu cel puțin {Math.round(props.cfg.cancel_cutoff_minutes / 60)} ore înainte.
            </p>
          </form>
        )}
      </Show>
    </Show>
  )
}

function Confirmation(props: { booking: Booking; cfg: PublicConfig }) {
  return (
    <section class="done">
      <div class="check" aria-hidden="true">✓</div>
      <h2>Programarea e confirmată</h2>
      <p class="summary">
        {props.booking.service ? `${props.booking.service}, ` : ''}
        {longDay(props.booking.start)}, ora {hhmm(props.booking.start)}
      </p>
      <p>
        Codul programării: <strong class="ref">{props.booking.ref}</strong>
      </p>
      <p class="muted">
        Păstrați codul. Cu el și cu numărul de telefon puteți vedea sau anula programarea.
      </p>
      <Show when={props.cfg.phone}>
        <p class="muted">Pentru modificări ne găsiți la {props.cfg.phone}.</p>
      </Show>
      <button class="secondary" type="button" onClick={() => location.reload()}>
        Altă programare
      </button>
    </section>
  )
}

// ─── Programarile mele ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<Booking['status'], string> = {
  confirmed: 'Confirmată',
  in_progress: 'În lucru',
  completed: 'Finalizată',
  cancelled: 'Anulată',
}

function MyBookings(props: { cfg: PublicConfig }) {
  const [phone, setPhone] = createSignal('')
  const [list, setList] = createSignal<Booking[] | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const search = async (e?: SubmitEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setList(await api.myBookings(phone()))
    } catch (err) {
      setList(null)
      setError(err instanceof Error ? err.message : 'A apărut o eroare.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (b: Booking) => {
    if (!confirm(`Anulați programarea din ${longDay(b.start)}, ora ${hhmm(b.start)}?`)) return
    setError(null)
    try {
      const updated = await api.cancel(b.ref, phone())
      setList((l) => l?.map((x) => (x.ref === b.ref ? updated : x)) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare.')
    }
  }

  const canCancel = (b: Booking) =>
    b.status === 'confirmed' &&
    new Date(b.start).getTime() - Date.now() > props.cfg.cancel_cutoff_minutes * 60_000

  return (
    <section class="step">
      <form class="inline" onSubmit={search}>
        <label>
          Numărul de telefon folosit la programare
          <input
            type="tel"
            required
            minlength="6"
            maxlength="30"
            autocomplete="tel"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
          />
        </label>
        <button class="primary" type="submit" disabled={busy()}>
          Caută
        </button>
      </form>
      <Show when={error()}>
        <p class="alert">{error()}</p>
      </Show>
      <Show when={list()}>
        {(l) => (
          <Show when={l().length} fallback={<p class="muted">Nu există programări viitoare pe acest număr.</p>}>
            <ul class="bookings">
              <For each={l()}>
                {(b) => (
                  <li classList={{ cancelled: b.status === 'cancelled' }}>
                    <div>
                      <strong>
                        {longDay(b.start)}, {hhmm(b.start)}
                      </strong>
                      <span class="muted">
                        {b.service ? `${b.service} · ` : ''}
                        {STATUS_LABEL[b.status]} · cod {b.ref}
                      </span>
                    </div>
                    <Show when={canCancel(b)}>
                      <button class="link" type="button" onClick={() => cancel(b)}>
                        Anulează
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </section>
  )
}
