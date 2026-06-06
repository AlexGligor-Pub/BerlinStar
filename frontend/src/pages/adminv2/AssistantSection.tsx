import { For, Show, createSignal, onCleanup } from "solid-js";
import { API_BASE, readJsonSafe } from "../../utils/api";
import { adminFetch } from "./admin-auth";
import { renderMarkdown } from "../../utils/markdown";

/**
 * Asistent AI — widget flotant (FAB dreapta-jos) care deschide un panou de chat
 * cu Claude Code agentic ruland PE SERVER (host) in ~/berlinstar.
 * Backend-ul proxeaza catre agent-bridge; aici doar trimitem prompt-ul si
 * afisam stream-ul SSE (text markdown + pasi tool). Mobile-friendly.
 *
 * ⚠️ Claude ruleaza cu autonomie totala pe host. Acces doar super-admin.
 */

type Kind = "user" | "assistant" | "thinking" | "tool" | "tool_result" | "error";

interface Msg {
  kind: Kind;
  text?: string;
  tool?: string;
  input?: unknown;
}

export default function AssistantSection() {
  const [open, setOpen] = createSignal(false);
  const [messages, setMessages] = createSignal<Msg[]>([]);
  const [input, setInput] = createSignal("");
  const [streaming, setStreaming] = createSignal(false);
  const [chatId, setChatId] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");

  let es: EventSource | null = null;
  let scrollEl: HTMLDivElement | undefined;

  function push(m: Msg) {
    setMessages((prev) => [...prev, m]);
    queueMicrotask(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }

  function closeStream() {
    if (es) { es.close(); es = null; }
    setStreaming(false);
  }
  onCleanup(closeStream);

  function openStream(id: string, token: string) {
    closeStream();
    setStreaming(true);
    const url = `${API_BASE}/api/admin/assistant/chats/${id}/events?token=${encodeURIComponent(token)}`;
    es = new EventSource(url);
    es.onmessage = (e) => {
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      switch (data.type) {
        case "assistant_text": if (data.text?.trim()) push({ kind: "assistant", text: data.text }); break;
        case "thinking": if (data.text?.trim()) push({ kind: "thinking", text: data.text }); break;
        case "tool_use": push({ kind: "tool", tool: data.name, input: data.input }); break;
        case "tool_result": push({ kind: "tool_result", text: data.text, ...(data.is_error ? { tool: "error" } : {}) }); break;
        case "error": push({ kind: "error", text: data.message ?? "Eroare." }); break;
        case "result": if (data.is_error) push({ kind: "error", text: "Rularea s-a încheiat cu eroare." }); break;
        case "done": closeStream(); break;
        case "idle": closeStream(); break;
      }
    };
    es.onerror = () => {
      if (es && es.readyState === EventSource.CLOSED) { setStreaming(false); es = null; }
    };
  }

  async function send(e: Event) {
    e.preventDefault();
    const prompt = input().trim();
    if (!prompt || streaming()) return;
    setError("");
    setInput("");
    push({ kind: "user", text: prompt });
    const id = chatId();
    const path = id ? `/api/admin/assistant/chats/${id}/turns` : "/api/admin/assistant/chats";
    try {
      const res = await adminFetch(path, { method: "POST", body: JSON.stringify({ prompt }) });
      if (!res.ok) {
        const d = await readJsonSafe<{ detail?: string }>(res);
        setError(d.detail ?? `Eroare ${res.status}`);
        return;
      }
      const d = await readJsonSafe<{ chat_id?: string; stream_token?: string }>(res);
      const newId = d.chat_id ?? id;
      if (!newId || !d.stream_token) { setError("Răspuns invalid de la server."); return; }
      if (!id && d.chat_id) setChatId(d.chat_id);
      openStream(newId, d.stream_token);
    } catch {
      setError("Eroare de conexiune.");
    }
  }

  function resetChat() {
    closeStream();
    setChatId(null);
    setMessages([]);
    setError("");
  }

  return (
    <>
      <Show when={!open()}>
        <button class="ai-fab" onClick={() => setOpen(true)} aria-label="Asistent AI" title="Asistent AI">
          🤖
        </button>
      </Show>

      <Show when={open()}>
        <div class="ai-panel">
          <div class="ai-panel__header">
            <span class="ai-panel__title">🤖 Asistent AI</span>
            <div class="ai-panel__actions">
              <button class="btn btn-ghost btn-sm" onClick={resetChat} disabled={streaming()}>Nou</button>
              <button class="ai-panel__close" onClick={() => setOpen(false)} aria-label="Închide">✕</button>
            </div>
          </div>

          <div ref={scrollEl} class="ai-panel__body">
            <Show when={messages().length === 0}>
              <div class="ai-empty">
                Întreabă-l ceva — ex. „rulează <code>git status</code> și rezumă branch-ul".
                <div class="ai-warn">⚠️ Rulează agentic pe server cu autonomie totală.</div>
              </div>
            </Show>
            <For each={messages()}>{(m) => <MessageBubble m={m} />}</For>
            <Show when={streaming()}>
              <div class="ai-working"><span class="spinner ai-spinner" /> Claude lucrează…</div>
            </Show>
          </div>

          <Show when={error()}>
            <div class="ai-error">{error()}</div>
          </Show>

          <form onSubmit={send} class="ai-panel__input">
            <textarea
              class="input ai-textarea"
              placeholder="Scrie un mesaj… (Enter trimite)"
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
              }}
              disabled={streaming()}
              rows={1}
            />
            <button class="btn btn-primary ai-send" type="submit" disabled={streaming() || !input().trim()}>
              {streaming() ? "…" : "➤"}
            </button>
          </form>
        </div>
      </Show>
    </>
  );
}

function MessageBubble(props: { m: Msg }) {
  const m = props.m;
  if (m.kind === "user") {
    return <div class="ai-msg ai-msg--user">{m.text}</div>;
  }
  if (m.kind === "tool") {
    return (
      <div class="ai-msg ai-msg--tool">
        🔧 <b>{m.tool}</b>
        <Show when={m.input && Object.keys(m.input as object).length > 0}>
          <span> · {shortInput(m.input)}</span>
        </Show>
      </div>
    );
  }
  if (m.kind === "tool_result") {
    return <div class="ai-msg ai-msg--toolres" classList={{ "ai-msg--toolerr": m.tool === "error" }}>{m.text}</div>;
  }
  if (m.kind === "thinking") {
    return <div class="ai-msg ai-msg--thinking">💭 {m.text}</div>;
  }
  if (m.kind === "error") {
    return <div class="ai-msg ai-msg--error">⚠️ {m.text}</div>;
  }
  // assistant — markdown
  return <div class="ai-msg ai-msg--assistant ai-md" innerHTML={renderMarkdown(m.text ?? "")} />;
}

function shortInput(input: unknown): string {
  try {
    const obj = input as Record<string, unknown>;
    if (typeof obj?.command === "string") return obj.command as string;
    if (typeof obj?.file_path === "string") return obj.file_path as string;
    if (typeof obj?.path === "string") return obj.path as string;
    if (typeof obj?.pattern === "string") return obj.pattern as string;
    const s = JSON.stringify(input);
    return s.length > 100 ? s.slice(0, 100) + "…" : s;
  } catch {
    return "";
  }
}
