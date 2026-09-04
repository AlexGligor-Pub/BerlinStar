import { For, Show, createMemo, type JSX } from "solid-js";
import { Badge, Button, EmptyState } from "../../components/ui";
import { renderMarkdown } from "../../utils/markdown";
import type {
  CompanyDigest, Confidence, Horizon, NoveltyCategory, RadarRun, ReviewDigest, Trend, WebsiteDigest, YoutubeDigest,
} from "../../api/radar";
import { IMPACT_BADGE, IMPACT_LABEL, SENTIMENT_BADGE, SENTIMENT_LABEL, fmtDay, fmtInt, fmtUsd } from "./shared";

const HORIZON_LABEL: Record<Horizon, string> = {
  acum: "Acum",
  "30_zile": "În 30 de zile",
  trimestru: "Acest trimestru",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Încredere mare",
  medium: "Încredere medie",
  low: "Încredere mică",
};

const TREND_ARROW: Record<Trend, string> = { up: "↑", down: "↓", flat: "→", unknown: "—" };
const TREND_LABEL: Record<Trend, string> = {
  up: "În creștere",
  down: "În scădere",
  flat: "Stabil",
  unknown: "Necunoscut",
};

const CATEGORY_LABEL: Record<NoveltyCategory, string> = {
  echipament: "Echipament",
  serviciu: "Serviciu",
  tehnologie: "Tehnologie",
  pret: "Preț",
  altceva: "Altceva",
};

function Section(props: { title: string; count: number; children: JSX.Element }) {
  return (
    <Show when={props.count > 0}>
      <details class="rv-section" open>
        <summary>
          <span>{props.title}</span>
          <span class="radar-muted">{props.count}</span>
        </summary>
        <div class="rv-section-body">{props.children}</div>
      </details>
    </Show>
  );
}

function hideBrokenImage(e: Event) {
  (e.currentTarget as HTMLImageElement).classList.add("is-hidden");
}

export default function ReportView(props: { run: RadarRun; onBack: () => void; onPdf: () => void }) {
  const doc = () => props.run.report ?? null;
  const signals = () => doc()?.key_signals ?? [];
  const recs = createMemo(() => [...(doc()?.recommendations ?? [])].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9)));
  const frame = () => doc()?.decision_frame ?? null;
  const yt = (): YoutubeDigest[] => doc()?.sections?.youtube ?? [];
  const companies = (): CompanyDigest[] => doc()?.sections?.companies ?? [];
  const websites = (): WebsiteDigest[] => doc()?.sections?.websites ?? [];
  const reviews = (): ReviewDigest[] => doc()?.sections?.reviews ?? [];

  return (
    <div class="radar-panel">
      <div class="radar-toolbar">
        <Button variant="ghost" size="sm" onClick={() => props.onBack()}>← Înapoi la istoric</Button>
        <span class="radar-spacer" />
        <Button size="sm" onClick={() => props.onPdf()}>Salvează PDF</Button>
      </div>

      <Show
        when={doc()}
        fallback={<EmptyState title="Raport indisponibil" message="Această rulare nu conține un raport." />}
      >
        {(d) => (
          <>
            <header class="rv-head">
              <h2 class="rv-title">{d().title || `Raport #${props.run.id}`}</h2>
              <div class="rv-chips">
                <Badge kind="neutral">{fmtDay(d().period?.from)} – {fmtDay(d().period?.to)}</Badge>
                <Badge kind="neutral">{fmtInt(props.run.tokens_in + props.run.tokens_out)} tokeni</Badge>
                <Badge kind="neutral">{fmtUsd(props.run.cost_usd)}</Badge>
              </div>
            </header>

            <section class="radar-card">
              <h2>Sumar executiv</h2>
              <div class="radar-card-body">
                {/* eslint-disable-next-line solid/no-innerhtml -- renderMarkdown escapeaza HTML-ul sursei */}
                <div class="rv-md" innerHTML={renderMarkdown(d().executive_summary || "")} />
              </div>
            </section>

            <Show when={signals().length > 0}>
              <section class="radar-card">
                <h2>Semnale cheie</h2>
                <div class="radar-card-body">
                  <div class="rv-grid">
                    <For each={signals()}>
                      {(s) => (
                        <article class={`rv-signal rv-signal--${s.impact}`}>
                          <span class="rv-item-title">{s.title}</span>
                          <div class="rv-chips">
                            <Badge kind={IMPACT_BADGE[s.impact] ?? "neutral"}>{IMPACT_LABEL[s.impact] ?? s.impact}</Badge>
                            <Badge kind={SENTIMENT_BADGE[s.sentiment] ?? "neutral"}>
                              {SENTIMENT_LABEL[s.sentiment] ?? s.sentiment}
                            </Badge>
                          </div>
                          <p class="rv-text">{s.insight}</p>
                        </article>
                      )}
                    </For>
                  </div>
                </div>
              </section>
            </Show>

            <Show when={recs().length > 0}>
              <section class="radar-card">
                <h2>Recomandări</h2>
                <div class="radar-card-body">
                  <For each={recs()}>
                    {(r) => (
                      <article class="rv-rec">
                        <div class="radar-row-head">
                          <span class="rv-item-title"><span class="rv-prio">{r.priority}</span> {r.title}</span>
                        </div>
                        <div class="rv-chips">
                          <Badge kind="info">{HORIZON_LABEL[r.horizon] ?? r.horizon}</Badge>
                          <Badge kind="neutral">{CONFIDENCE_LABEL[r.confidence] ?? r.confidence}</Badge>
                        </div>
                        <p class="rv-text">{r.rationale}</p>
                        <p class="rv-action">{r.action}</p>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <Show when={frame()?.question}>
              <section class="radar-card">
                <h2>Cadrul de decizie</h2>
                <p class="radar-card-hint">{frame()!.question}</p>
                <div class="radar-card-body">
                  <div class="rv-options">
                    <For each={frame()!.options ?? []}>
                      {(o) => (
                        <article class="rv-option" classList={{ "rv-option--best": o.option === frame()!.recommended }}>
                          <span class="rv-item-title">{o.option}</span>
                          <Show when={o.option === frame()!.recommended}>
                            <div><Badge kind="success">Recomandat</Badge></div>
                          </Show>
                          <Show when={(o.pros ?? []).length > 0}>
                            <div class="rv-sublabel">Avantaje</div>
                            <ul class="rv-list"><For each={o.pros}>{(p) => <li>{p}</li>}</For></ul>
                          </Show>
                          <Show when={(o.cons ?? []).length > 0}>
                            <div class="rv-sublabel">Dezavantaje</div>
                            <ul class="rv-list"><For each={o.cons}>{(c) => <li>{c}</li>}</For></ul>
                          </Show>
                          <Show when={(o.evidence ?? []).length > 0}>
                            <div class="rv-sublabel">Dovezi</div>
                            <ul class="rv-list"><For each={o.evidence}>{(ev) => <li>{ev}</li>}</For></ul>
                          </Show>
                        </article>
                      )}
                    </For>
                  </div>
                  <Show when={(frame()!.risks ?? []).length > 0}>
                    <div class="rv-sublabel">Riscuri</div>
                    <ul class="rv-list"><For each={frame()!.risks}>{(r) => <li>{r}</li>}</For></ul>
                  </Show>
                </div>
              </section>
            </Show>

            <Section title="YouTube" count={yt().length}>
              <For each={yt()}>
                {(v) => (
                  <article class="rv-entry">
                    <a class="rv-item-title" href={v.url} target="_blank" rel="noopener noreferrer">{v.video_title}</a>
                    <div class="rv-chips">
                      <Badge kind="neutral">{v.source_label}</Badge>
                      <Show when={v.published_at}><Badge kind="neutral">{fmtDay(v.published_at)}</Badge></Show>
                      <Badge kind={SENTIMENT_BADGE[v.sentiment] ?? "neutral"}>
                        {SENTIMENT_LABEL[v.sentiment] ?? v.sentiment}
                      </Badge>
                    </div>
                    <p class="rv-text">{v.summary}</p>
                    <Show when={(v.achievements ?? []).length > 0}>
                      <div class="rv-sublabel">Realizări</div>
                      <ul class="rv-list"><For each={v.achievements}>{(a) => <li>{a}</li>}</For></ul>
                    </Show>
                    <Show when={v.selling && v.selling_what}>
                      <p class="rv-text"><b>Vinde:</b> {v.selling_what}</p>
                    </Show>
                    <Show when={v.call_to_action}>
                      <p class="radar-muted">Îndemn: {v.call_to_action}</p>
                    </Show>
                    <div class="radar-kv">
                      <span class="radar-kv-label">Relevanță</span>
                      <span class="radar-kv-value radar-mono">{v.relevance}%</span>
                    </div>
                    <div class="rv-meter">
                      <div class="rv-meter-fill" style={{ width: `${Math.max(0, Math.min(100, v.relevance))}%` }} />
                    </div>
                  </article>
                )}
              </For>
            </Section>

            <Section title="Firme" count={companies().length}>
              <For each={companies()}>
                {(c) => (
                  <article class="rv-entry">
                    <span class="rv-item-title">{c.name} <span class="radar-muted">· CUI {c.cui}</span></span>
                    <div class="rv-chips">
                      <Badge kind="neutral">{c.source_label}</Badge>
                      <Badge kind="info">{TREND_ARROW[c.trend] ?? "—"} {TREND_LABEL[c.trend] ?? c.trend}</Badge>
                      <Show when={c.status}><Badge kind="neutral">{c.status}</Badge></Show>
                      <Show when={c.vat_payer !== null}>
                        <Badge kind={c.vat_payer ? "success" : "neutral"}>{c.vat_payer ? "Plătitor TVA" : "Neplătitor TVA"}</Badge>
                      </Show>
                    </div>
                    <Show when={(c.financials ?? []).length > 0}>
                      <table class="rv-fin">
                        <thead>
                          <tr><th>An</th><th>Cifră afaceri</th><th>Profit</th><th>Angajați</th></tr>
                        </thead>
                        <tbody>
                          <For each={c.financials}>
                            {(f) => (
                              <tr>
                                <td>{f.year}</td>
                                <td>{f.turnover == null ? "—" : fmtInt(f.turnover)}</td>
                                <td>{f.profit == null ? "—" : fmtInt(f.profit)}</td>
                                <td>{f.employees == null ? "—" : fmtInt(f.employees)}</td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </Show>
                    <p class="rv-text">{c.commentary}</p>
                  </article>
                )}
              </For>
            </Section>

            <Section title="Site-uri" count={websites().length}>
              <For each={websites()}>
                {(w) => (
                  <article class="rv-entry">
                    <a class="rv-item-title" href={w.url} target="_blank" rel="noopener noreferrer">{w.title || w.url}</a>
                    <div class="rv-chips"><Badge kind="neutral">{w.source_label}</Badge></div>
                    <Show when={(w.novelties ?? []).length > 0}>
                      <div class="rv-novelties">
                        <For each={w.novelties}>
                          {(n) => (
                            <div class="rv-novelty">
                              <Show when={n.image_url}>
                                <img class="rv-thumb" src={n.image_url!} alt="" loading="lazy" onError={hideBrokenImage} />
                              </Show>
                              <div class="rv-novelty-body">
                                <Badge kind="info">{CATEGORY_LABEL[n.category] ?? n.category}</Badge>
                                <span class="rv-item-title">{n.title}</span>
                                <p class="radar-muted">{n.description}</p>
                                <Show when={n.link}>
                                  <a class="radar-muted" href={n.link!} target="_blank" rel="noopener noreferrer">Deschide</a>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <p class="rv-text">{w.commentary}</p>
                  </article>
                )}
              </For>
            </Section>

            <Section title="Recenzii" count={reviews().length}>
              <For each={reviews()}>
                {(rv) => (
                  <article class="rv-entry">
                    <span class="rv-item-title">{rv.name}</span>
                    <div class="rv-chips">
                      <Badge kind="neutral">{rv.source_label}</Badge>
                      <Show when={rv.rating != null}><Badge kind="warn">★ {rv.rating}</Badge></Show>
                      <Show when={rv.reviews_count != null}><Badge kind="neutral">{fmtInt(rv.reviews_count)} recenzii</Badge></Show>
                    </div>
                    <Show when={(rv.themes ?? []).length > 0}>
                      <div class="rv-sublabel">Teme</div>
                      <For each={rv.themes}>
                        {(t) => (
                          <div class="radar-kv">
                            <span class="radar-kv-label">{t.theme}</span>
                            <span class="radar-kv-value">
                              <Badge kind={SENTIMENT_BADGE[t.sentiment] ?? "neutral"}>
                                {SENTIMENT_LABEL[t.sentiment] ?? t.sentiment}
                              </Badge>{" "}
                              <span class="radar-mono">{fmtInt(t.count)}</span>
                            </span>
                          </div>
                        )}
                      </For>
                    </Show>
                    <Show when={(rv.praise ?? []).length > 0}>
                      <div class="rv-sublabel">Apreciat</div>
                      <ul class="rv-list"><For each={rv.praise}>{(p) => <li>{p}</li>}</For></ul>
                    </Show>
                    <Show when={(rv.complaints ?? []).length > 0}>
                      <div class="rv-sublabel">Reclamat</div>
                      <ul class="rv-list"><For each={rv.complaints}>{(c) => <li>{c}</li>}</For></ul>
                    </Show>
                    <p class="rv-text">{rv.commentary}</p>
                  </article>
                )}
              </For>
            </Section>

            <Show when={d().history_delta}>
              <section class="radar-card">
                <h2>Ce s-a schimbat</h2>
                <div class="radar-card-body"><p class="rv-text">{d().history_delta}</p></div>
              </section>
            </Show>

            <Show when={(d().data_gaps ?? []).length > 0}>
              <section class="radar-card">
                <h2>Limitări ale datelor</h2>
                <div class="radar-card-body">
                  <ul class="rv-list"><For each={d().data_gaps}>{(g) => <li>{g}</li>}</For></ul>
                </div>
              </section>
            </Show>

            <div class="radar-toolbar">
              <Button variant="ghost" onClick={() => props.onBack()}>Înapoi la istoric</Button>
              <span class="radar-spacer" />
              <Button onClick={() => props.onPdf()}>Salvează PDF</Button>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
