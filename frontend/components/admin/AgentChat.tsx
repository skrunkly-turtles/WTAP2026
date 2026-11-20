"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, RotateCcw, Send, X } from "lucide-react";
import { api, ChatMessage } from "@/lib/api";
import { Button, Card, cx, inputCls } from "../ui";

type Msg = ChatMessage;

// Gemini answers use **bold** markdown; render just that (no HTML injection, plain React text nodes).
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
const STARTERS = ["What are co-ops most worried about?", "Which teams have workload problems?", "What should we fix first to improve retention?"];

export default function AgentChat({ program, onOpenPost, onClose, className, active = true }: {
  program?: string; onOpenPost: (id: number) => void; onClose?: () => void; className?: string;
  active?: boolean; // false while the panel is hidden, so we can scroll to the latest message when it opens
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // The conversation is saved on the server, so it survives reloads.
  useEffect(() => { api.chat().then((r) => setMsgs(r.messages)).catch(() => {}); }, []);
  useEffect(() => {
    if (active) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active, msgs.length]);

  const clear = async () => {
    setMsgs([]);
    await api.clearChat().catch(() => {});
  };

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await api.ask(question, program);
      setMsgs((m) => [...m, { role: "assistant", content: r.data.answer, data: r.data, source: r.source, reason: r.fallback_reason, cached: r.cached }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cx("flex h-[520px] flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Bot className="h-5 w-5 text-brand" />
        <h3 className="mr-auto font-semibold">Ask the Insights Agent</h3>
        {msgs.length > 0 && (
          <button onClick={clear} disabled={busy} aria-label="Start a new chat" title="New chat"
            className="rounded p-1 text-muted hover:bg-surface disabled:opacity-50"><RotateCcw className="h-4 w-4" /></button>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Close chat" className="rounded p-1 text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted">Ask anything about what participants are saying.</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-brand-tint">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cx("max-w-[92%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-brand text-white" : "bg-surface")}>
            <p className="whitespace-pre-wrap">{renderBold(m.content)}</p>
            {m.data && m.data.cited_post_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                Sources:
                {m.data.cited_post_ids.map((id) => (
                  <button key={id} onClick={() => onOpenPost(id)} className="rounded bg-brand-tint px-1.5 py-0.5 font-medium text-brand hover:underline">#{id}</button>
                ))}
              </div>
            )}
            {m.source === "fallback" && (
              <p className="mt-1 text-[11px] text-muted">{m.reason === "no_key" ? "Offline fallback (no Gemini key)" : "Gemini unavailable, showing keyword matches"}</p>
            )}
            {m.data && i === msgs.length - 1 && m.data.follow_up_questions.length > 0 && (
              <div className="mt-2 space-y-1">
                {m.data.follow_up_questions.map((f) => (
                  <button key={f} onClick={() => ask(f)} className="block text-left text-xs font-medium text-brand hover:underline">→ {f}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="w-fit rounded-xl bg-surface px-3 py-2 text-sm text-muted">Thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-line p-3">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" maxLength={1000} />
        <Button type="submit" loading={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}
