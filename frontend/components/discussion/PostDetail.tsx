"use client";
import { useEffect, useState } from "react";
import { ThumbsUp, VenetianMask } from "lucide-react";
import { api, Anonymity, Post } from "@/lib/api";
import { useView } from "@/lib/view";
import { PROGRAM_LABEL, titleCase } from "@/lib/format";
import { Badge, Button, cx, ErrorNote, inputCls, SentimentDot, Spinner } from "../ui";
import { AuthorLine, PostBadges } from "./PostMeta";
import RevealDialog from "../admin/RevealDialog";

export default function PostDetail({ postId, onChanged }: { postId: number; onChanged: () => void }) {
  const { isAdmin, version } = useView();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyAnon, setReplyAnon] = useState<Anonymity>("public");
  const [sending, setSending] = useState(false);
  const [reveal, setReveal] = useState<{ type: "post" | "comment"; id: number } | null>(null);

  const load = () => api.post(postId).then(setPost).catch((e) => setError(e.message));
  useEffect(() => {
    setPost(null); setError("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, version]);

  if (error) return <div className="p-6"><ErrorNote message={error} /></div>;
  if (!post) return <Spinner />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.comment(post.id, { body: reply, anonymity: replyAnon });
      setReply("");
      await load();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const upvote = async () => {
    const r = await api.upvote(post.id);
    setPost({ ...post, upvotes: r.upvotes });
    onChanged();
  };

  return (
    <article className="flex h-full flex-col">
      <div className="border-b border-line p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2"><PostBadges post={post} /></div>
        <h2 className="text-xl font-semibold leading-snug">{post.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <AuthorLine author={post.author} anonymity={post.anonymity} createdAt={post.created_at} revealed={post.revealed} />
          {isAdmin && post.anonymity === "anonymous" && !post.revealed && (
            <button onClick={() => setReveal({ type: "post", id: post.id })} className="text-xs font-medium text-brand underline-offset-2 hover:underline">
              Reveal identity…
            </button>
          )}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{post.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={upvote} className="py-1"><ThumbsUp className="h-4 w-4" /> {post.upvotes}</Button>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-xs text-muted">
              <span className="font-semibold text-ink">HR insight</span>
              <SentimentDot value={post.sentiment} />
              {post.program && <span>· {PROGRAM_LABEL[post.program]}</span>}
              {post.themes?.map((t) => <Badge key={t} tone="brand">{titleCase(t)}</Badge>)}
              {post.risk_keywords?.map((k) => <Badge key={k} tone="high">{k}</Badge>)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5 scroll-thin">
        <h3 className="text-sm font-semibold text-muted">{post.comments?.length ?? 0} {post.comments?.length === 1 ? "reply" : "replies"}</h3>
        {post.comments?.map((c) => (
          <div key={c.id} className={cx("rounded-lg border p-3", c.author_is_admin ? "border-brand/30 bg-brand-tint/60" : "border-line bg-white")}>
            <div className="flex flex-wrap items-center gap-2">
              <AuthorLine author={c.author} anonymity={c.anonymity} isAdminAuthor={c.author_is_admin} createdAt={c.created_at} revealed={c.revealed} />
              {isAdmin && <SentimentDot value={c.sentiment} />}
              {isAdmin && c.anonymity === "anonymous" && !c.revealed && (
                <button onClick={() => setReveal({ type: "comment", id: c.id })} className="text-xs font-medium text-brand hover:underline">Reveal…</button>
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="border-t border-line bg-surface/60 p-4">
        <textarea className={cx(inputCls, "min-h-20")} placeholder={isAdmin ? "Reply as HR / Admin…" : "Add a reply…"}
          value={reply} onChange={(e) => setReply(e.target.value)} maxLength={3000} required />
        <div className="mt-2 flex items-center justify-between gap-2">
          {!isAdmin ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={replyAnon === "anonymous"} onChange={(e) => setReplyAnon(e.target.checked ? "anonymous" : "public")} />
              <VenetianMask className="h-3.5 w-3.5" /> Reply anonymously
            </label>
          ) : <span className="text-xs text-muted">Replies from admins show an HR badge.</span>}
          <Button type="submit" loading={sending}>Reply</Button>
        </div>
      </form>

      {reveal && (
        <RevealDialog target={reveal} onClose={() => setReveal(null)} onRevealed={() => { setReveal(null); load(); onChanged(); }} />
      )}
    </article>
  );
}
