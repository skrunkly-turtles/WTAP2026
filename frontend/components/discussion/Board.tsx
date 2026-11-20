"use client";
import { useCallback, useEffect, useState } from "react";
import { Lock, MessageSquare, Plus, Search, SlidersHorizontal, ThumbsUp, X } from "lucide-react";
import { api, Post } from "@/lib/api";
import { useView } from "@/lib/view";
import { titleCase } from "@/lib/format";
import { Button, Card, cx, ErrorNote, inputCls, Spinner } from "../ui";
import { AuthorLine } from "./PostMeta";
import NewPostModal from "./NewPostModal";
import PostDetail from "./PostDetail";

export default function Board() {
  const { meta, isAdmin, version } = useView();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = (category ? 1 : 0) + (audience ? 1 : 0);

  const load = useCallback(() => {
    api.posts({ category, q, audience }).then((ps) => {
      setPosts(ps);
      setSelected((s) => (s && ps.some((p) => p.id === s) ? s : ps[0]?.id ?? null));
    }).catch((e) => setError(e.message));
  }, [category, q, audience]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load, version]);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col overflow-hidden">
        <div className="space-y-2 border-b border-line p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
              <input className={cx(inputCls, "pl-8")} placeholder="Search posts" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-label="Filters" title="Filters"
              className={cx("relative grid w-10 shrink-0 place-items-center rounded-lg border transition",
                showFilters ? "border-brand bg-brand-tint text-brand" : "border-line bg-white text-muted hover:text-ink")}>
              <SlidersHorizontal className="h-4 w-4" />
              {activeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{activeCount}</span>
              )}
            </button>
            <Button onClick={() => setComposing(true)} variant="accent"><Plus className="h-4 w-4" />Post</Button>
          </div>
          {showFilters ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {["", ...(meta?.categories ?? [])].map((c) => (
                  <button key={c || "all"} onClick={() => setCategory(c)}
                    className={cx("whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
                      category === c ? "border-brand bg-brand text-white" : "border-line bg-white text-muted hover:text-ink")}>
                    {c ? titleCase(c) : "All"}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <select className={cx(inputCls, "py-1 text-xs")} value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience filter">
                  <option value="">All audiences</option>
                  <option value="everyone">Everyone posts</option>
                  <option value="admins_only">Admins-only posts (private to HR)</option>
                </select>
              )}
            </>
          ) : activeCount > 0 && (
            // Collapsed: keep active filters visible so the list isn't silently filtered.
            <div className="flex flex-wrap gap-1.5">
              {category && (
                <button onClick={() => setCategory("")} className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white">
                  {titleCase(category)} <X className="h-3 w-3" />
                </button>
              )}
              {audience && (
                <button onClick={() => setAudience("")} className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white">
                  {audience === "admins_only" ? "Admins only" : "Everyone"} <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto scroll-thin">
          {error && <li className="p-3"><ErrorNote message={error} /></li>}
          {!posts && !error && <li><Spinner /></li>}
          {posts?.length === 0 && <li className="p-6 text-center text-sm text-muted">No posts yet.</li>}
          {posts?.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelected(p.id)}
                className={cx("block w-full border-l-4 px-3 py-3 text-left transition",
                  selected === p.id ? "border-accent bg-brand-tint/60" : "border-transparent hover:bg-surface")}>
                <div className="line-clamp-2 text-sm font-semibold">
                  {p.audience === "admins_only" && (
                    <span title="Admins & HR only" className="mr-1 inline-flex align-[-2px] text-accent-dark">
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Admins only: </span>
                    </span>
                  )}
                  {p.title}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <AuthorLine author={p.author} anonymity={p.anonymity} createdAt={p.created_at} revealed={p.revealed} />
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{p.upvotes}</span>
                    <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{p.comment_count}</span>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="h-[calc(100vh-13rem)] min-h-[480px] overflow-hidden">
        {selected ? <PostDetail key={selected} postId={selected} onChanged={load} />
          : <div className="grid h-full place-items-center text-sm text-muted">Select a post</div>}
      </Card>

      <NewPostModal open={composing} onClose={() => setComposing(false)} categories={meta?.categories ?? ["general"]}
        onCreated={(p) => { setSelected(p.id); load(); }} />
    </div>
  );
}
