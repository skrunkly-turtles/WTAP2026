"use client";
import { useEffect, useState } from "react";
import { Lock, MessageSquare, ThumbsUp } from "lucide-react";
import { api, Post } from "@/lib/api";
import { PROGRAM_LABEL, titleCase } from "@/lib/format";
import { Badge, Card, cx, ErrorNote, SentimentDot, Spinner } from "../ui";
import { AuthorLine } from "../discussion/PostMeta";

const RANGES = [7, 30, 90] as const;

export default function ConcerningPosts({ program, onOpenPost }: { program?: string; onOpenPost: (id: number) => void }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPosts(null); setError("");
    api.concerning(program, days).then(setPosts).catch((e) => setError(e.message));
  }, [program, days]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <h3 className="font-semibold">Most concerning posts</h3>
          <p className="text-xs text-muted">Negative tone or a risk phrase, most negative first</p>
        </div>
        <div className="flex rounded-lg border border-line bg-white p-1 text-xs" role="group" aria-label="Time range">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={cx("rounded-md px-2.5 py-1 font-medium", days === d ? "bg-brand text-white" : "text-muted hover:text-ink")}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {error && <div className="p-4"><ErrorNote message={error} /></div>}
      {!posts && !error && <Spinner />}
      {posts?.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No concerning posts in this period.</p>}
      <ul className="divide-y divide-line">
        {posts?.map((p) => (
          <li key={p.id}>
            <button onClick={() => onOpenPost(p.id)} className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-surface">
              <span className="shrink-0 pt-[3px]"><SentimentDot value={p.sentiment} hideValue /></span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {p.audience === "admins_only" && <Lock className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-accent-dark" aria-label="Admins only" />}
                  {p.title}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.body}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <AuthorLine author={p.author} anonymity={p.anonymity} createdAt={p.created_at} revealed={p.revealed} />
                  {p.program && !p.author && <span className="text-xs text-muted">{PROGRAM_LABEL[p.program]}</span>}
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{p.upvotes}</span>
                    <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{p.comment_count}</span>
                  </span>
                </div>
                {(p.risk_keywords?.length || p.themes?.length) ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.risk_keywords?.map((k) => <Badge key={k} tone="high">{k}</Badge>)}
                    {p.themes?.map((t) => <Badge key={t} tone="brand">{titleCase(t)}</Badge>)}
                  </div>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
