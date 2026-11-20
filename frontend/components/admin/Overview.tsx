"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, MessageSquare, Smile, Users, VenetianMask } from "lucide-react";
import { api, Overview as OverviewData } from "@/lib/api";
import { Card, ErrorNote, SentimentDot, Spinner } from "../ui";
import { AuthorLine } from "../discussion/PostMeta";
import AISummaryCard from "./AISummaryCard";
import AgentChat from "./AgentChat";
import { SentimentTrend, ThemeBars } from "./Charts";

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export default function Overview({ program, onOpenPost, onShowRisk }: { program?: string; onOpenPost: (id: number) => void; onShowRisk: () => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { setData(null); api.overview(program).then(setData).catch((e) => setError(e.message)); }, [program]);

  if (error) return <ErrorNote message={error} />;
  const t = data?.totals;
  const avg = t?.avg_sentiment_30d;
  return (
    <div className="space-y-5">
      {t && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Posts" value={t.posts} sub={`${t.comments} replies`} />
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Active (30d)" value={`${t.active_participants_30d}/${t.participants}`} sub="participants" />
          <Stat icon={<Smile className="h-3.5 w-3.5" />} label="Avg sentiment" value={avg == null ? "—" : `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}`} sub="last 30 days, −1 to +1" />
          <Stat icon={<VenetianMask className="h-3.5 w-3.5" />} label="Anonymous" value={`${Math.round(t.anonymous_share * 100)}%`}
            sub={`${t.admins_only_posts} sent privately to HR`} />
          <button onClick={onShowRisk} className="text-left">
            <Card className="h-full border-risk-high/40 bg-risk-high-tint p-4 transition hover:shadow-md">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-risk-high"><AlertTriangle className="h-3.5 w-3.5" />At risk</div>
              <div className="mt-1 text-2xl font-bold text-risk-high">{t.high_risk} high</div>
              <div className="text-xs text-risk-med">{t.medium_risk} medium · view →</div>
            </Card>
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <AISummaryCard program={program} onOpenPost={onOpenPost} />
        <AgentChat program={program} onOpenPost={onOpenPost} />
      </div>

      {!data ? <Spinner /> : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold">Sentiment trend</h3>
              <p className="mb-3 text-xs text-muted">Weekly average of posts & replies (−1 negative to +1 positive)</p>
              <SentimentTrend data={data.trend} program={program} />
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold">Themes</h3>
              <p className="mb-3 text-xs text-muted">Mentions across posts & replies, ranked by negative volume</p>
              <ThemeBars data={data.themes} />
            </Card>
          </div>
          <Card>
            <div className="border-b border-line px-5 py-3">
              <h3 className="font-semibold">Most concerning recent posts</h3>
              <p className="text-xs text-muted">Lowest sentiment in the last 30 days</p>
            </div>
            <ul className="divide-y divide-line">
              {data.concerning_posts.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onOpenPost(p.id)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-surface">
                    <SentimentDot value={p.sentiment} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.title}{p.audience === "admins_only" && <Lock className="ml-1 inline h-3.5 w-3.5 text-accent-dark" />}</div>
                      <p className="line-clamp-1 text-sm text-muted">{p.body}</p>
                      <AuthorLine author={p.author} anonymity={p.anonymity} createdAt={p.created_at} revealed={p.revealed} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
