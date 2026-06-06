import { For, Show, createSignal, onCleanup } from "solid-js";
import { API_BASE, readJsonSafe } from "../../utils/api";
import { adminFetch } from "./admin-auth";
import Spinner from "../../components/ui/Spinner";

/**
 * Asistent AI — chat cu Claude Code agentic care ruleaza PE SERVER (host),
 * in ~/berlinstar. Backend-ul proxeaza catre agent-bridge; aici doar trimitem
 * prompt-ul si afisam stream-ul SSE (text + pasi tool).
 *
 * ⚠️ Claude ruleaza cu autonomie totala pe host (poate rula comenzi, edita cod,
 * docker, deploy). Acces doar super-admin.
 */

type Kind = "user" | "assistant" | "thinking" | "tool" | "tool_result" | "error" | "system";

interface Msg {
  kind: Kind;
  text?: string;
  tool?: string;
  input?: unknown;
}

export default function AssistantSection() {
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
    if (es) {
      es.close();
      es = null;
    }
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
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (data.type) {
        case "assistant_text":
          if (data.text?.trim()) push({ kind: "assistant", text: data.text });
          break;
        case "thinking":
          if (data.text?.trim()) push({ kind: "thinking", text: data.text });
          break;
        case "tool_use":
          push({ kind: "tool", tool: data.name, input: data.input });
          break;
        case "tool_result":
          push({ kind: "tool_result", text: data.text, ...(data.is_error ? { tool: "error" } : {}) });
          break;
        case "error":
          push({ kind: "error", text: data.message ?? "Eroare." });
          break;
        case "result":
          if (data.is_error) push({ kind: "error", text: "Rularea s-a încheiat cu eroare." });
          break;
        case "done":
          closeStream();
          break;
        case "idle":
          closeStream();
          break;
      }
    };
    es.onerror = () => {
      // Cand stream-ul se inchide normal (dupa "done"), EventSource emite error.
      if (es && es.readyState === EventSource.CLOSED) {
        setStreaming(false);
        es = null;
      }
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
      if (!newId || !d.stream_token) {
        setError("Răspuns invalid de la server.");
        return;
      }
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
    <div>
      <div class="page-header" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <h2 class="page-title" style="font-size:1.25rem">🤖 Asistent AI</h2>
        <button class="btn btn-ghost btn-sm" onClick={resetChat} disabled={streaming()}>Conversație nouă</button>
      </div>

      <div style="background:color-mix(in srgb, var(--danger) 6%, transparent);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.85rem;color:var(--text-muted)">
        Claude rulează <b>agentic pe server</b> în <code>~/berlinstar</code> cu autonomie totală
        (poate rula comenzi, edita cod, docker, deploy). Folosește cu grijă.
      </div>

      <div
        ref={scrollEl}
        class="card"
        style="padding:14px;height:min(60vh,520px);overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:var(--surface-2)"
      >
        <Show when={messages().length === 0}>
          <div class="text-muted" style="margin:auto;text-align:center">
            Întreabă-l ceva — ex. „rulează <code>git status</code> și rezumă branch-ul și modificările".
          </div>
        </Show>
        <For each={messages()}>
          {(m) => <MessageBubble m={m} />}
        </For>
        <Show when={streaming()}>
          <div class="text-muted" style="font-size:.8rem;display:flex;align-items:center;gap:6px">
            <Spinner size={12} /> Claude lucrează…
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <div class="login-error" style="margin-top:10px">{error()}</div>
      </Show>

      <form onSubmit={send} style="margin-top:12px;display:flex;gap:8px;align-items:flex-end">
        <textarea
          class="input"
          style="flex:1;min-height:48px;max-height:160px;resize:vertical;font-family:inherit"
          placeholder="Scrie un mesaj pentru Claude… (Enter trimite, Shift+Enter rând nou)"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          disabled={streaming()}
        />
        <button class="btn btn-primary" type="submit" disabled={streaming() || !input().trim()}>
          {streaming() ? "…" : "Trimite"}
        </button>
      </form>
    </div>
  );
}

function MessageBubble(props: { m: Msg }) {
  const m = props.m;
  if (m.kind === "user") {
    return (
      <div style="align-self:flex-end;max-width:85%;background:var(--accent);color:#fff;padding:8px 12px;border-radius:12px 12px 2px 12px;white-space:pre-wrap;word-break:break-word">
        {m.text}
      </div>
    );
  }
  if (m.kind === "tool") {
    return (
      <div style="align-self:flex-start;font-size:.82rem;color:var(--text-muted);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-family:ui-monospace,monospace">
        🔧 <b>{m.tool}</b>
        <Show when={m.input && Object.keys(m.input as object).length > 0}>
          <span> · {shortInput(m.input)}</span>
        </Show>
      </div>
    );
  }
  if (m.kind === "tool_result") {
    return (
      <div style={`align-self:flex-start;max-width:85%;font-size:.78rem;color:${m.tool === "error" ? "var(--danger)" : "var(--text-muted)"};background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow:auto`}>
        {m.text}
      </div>
    );
  }
  if (m.kind === "thinking") {
    return (
      <div style="align-self:flex-start;max-width:85%;font-size:.82rem;font-style:italic;color:var(--text-muted);white-space:pre-wrap;word-break:break-word">
        💭 {m.text}
      </div>
    );
  }
  if (m.kind === "error") {
    return (
      <div style="align-self:flex-start;max-width:85%;color:var(--danger);background:color-mix(in srgb,var(--danger) 8%,transparent);border:1px solid var(--danger);border-radius:10px;padding:8px 12px;white-space:pre-wrap">
        ⚠️ {m.text}
      </div>
    );
  }
  // assistant
  return (
    <div style="align-self:flex-start;max-width:85%;background:var(--surface);border:1px solid var(--border);padding:8px 12px;border-radius:12px 12px 12px 2px;white-space:pre-wrap;word-break:break-word">
      {m.text}
    </div>
  );
}

function shortInput(input: unknown): string {
  try {
    const obj = input as Record<string, unknown>;
    if (typeof obj?.command === "string") return obj.command as string;
    if (typeof obj?.file_path === "string") return obj.file_path as string;
    if (typeof obj?.path === "string") return obj.path as string;
    if (typeof obj?.pattern === "string") return obj.pattern as string;
    const s = JSON.stringify(input);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  } catch {
    return "";
  }
}
