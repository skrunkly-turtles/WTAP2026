"use client";
import { useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { api, AskAnswer } from "@/lib/api";
import { Button, Card, cx, inputCls } from "../ui";

type Msg = { role: "user" | "assistant"; content: string; data?: AskAnswer; source?: string };
const STARTERS = ["What are co-ops most worried about?", "Which teams have workload problems?", "What should we fix first to improve retention?"];

export default function AgentChat({ program, onOpenPost }: { program?: string; onOpenPost: (id: number) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await api.ask(question, history, program);
      setMsgs((m) => [...m, { role: "assistant", content: r.data.answer, data: r.data, source: r.source }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <Card className="flex h-[520px] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Bot className="h-5 w-5 text-brand" />
        <h3 className="font-semibold">Ask the Insights Agent</h3>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
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
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.data && m.data.cited_post_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                Sources:
                {m.data.cited_post_ids.map((id) => (
                  <button key={id} onClick={() => onOpenPost(id)} className="rounded bg-brand-tint px-1.5 py-0.5 font-medium text-brand hover:underline">#{id}</button>
                ))}
              </div>
            )}
            {m.source === "fallback" && <p className="mt-1 text-[11px] text-muted">Offline fallback (no Gemini key)</p>}
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
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-line p-3">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" maxLength={1000} />
        <Button type="submit" loading={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}
