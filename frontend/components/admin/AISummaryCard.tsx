"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles, ThumbsUp } from "lucide-react";
import { AIResult, api, ProgramSummary } from "@/lib/api";
import { PROGRAM_LABEL, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ErrorNote, Spinner } from "../ui";

export function SourceBadge({ r }: { r: { source: string; model: string | null; generated_at: string; cached?: boolean } }) {
  return r.source === "gemini" ? (
    <span className="text-xs text-white/80">Gemini · {r.model} · {r.cached ? "cached " : ""}{timeAgo(r.generated_at)}</span>
  ) : (
    <Badge tone="accent" className="!border-accent">Offline fallback — add GEMINI_API_KEY for AI analysis</Badge>
  );
}

const healthTone = { healthy: "low", mixed: "medium", concerning: "high" } as const;

export default function AISummaryCard({ program, onOpenPost }: { program?: string; onOpenPost: (id: number) => void }) {
  const [res, setRes] = useState<AIResult<ProgramSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = (regenerate = false) => {
    setLoading(true); setError("");
    api.summary(program, regenerate).then(setRes).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRes(null); load(); }, [program]);

  const s = res?.data;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-brand-dark to-brand px-5 py-4 text-white">
        <Sparkles className="h-5 w-5 text-accent" />
        <div className="mr-auto">
          <h2 className="font-semibold">AI Insights {program && `· ${PROGRAM_LABEL[program]}`}</h2>
          {res && <SourceBadge r={res} />}
        </div>
        {s && <Badge tone={healthTone[s.overall_health]}>Program health: {s.overall_health}</Badge>}
        <Button variant="accent" onClick={() => load(true)} loading={loading} className="py-1.5"><RefreshCw className="h-4 w-4" />Regenerate</Button>
      </div>
      {error && <div className="p-4"><ErrorNote message={error} /></div>}
      {!s && !error && <Spinner label="Analysing the discussion board…" />}
      {s && (
        <div className="space-y-5 p-5">
          <p className="text-[15px] leading-relaxed">{s.executive_summary}</p>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Top concerns</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {s.top_concerns.map((c, i) => (
                <div key={i} className="rounded-lg border border-line p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={c.severity}>{c.severity}</Badge>
                    <span className="font-semibold">{c.title}</span>
                    <span className="ml-auto text-xs text-muted">{PROGRAM_LABEL[c.affected_program]}</span>
                  </div>
                  <p className="text-sm text-muted">{c.description}</p>
                  {c.evidence_post_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.evidence_post_ids.map((id) => (
                        <button key={id} onClick={() => onOpenPost(id)} className="rounded bg-brand-tint px-1.5 py-0.5 text-xs font-medium text-brand hover:underline">#{id}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Recommended systemic changes</h3>
              <ul className="space-y-2">
                {s.systemic_recommendations.map((r, i) => (
                  <li key={i} className="rounded-lg border-l-4 border-accent bg-accent-tint/50 p-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.title}</span><Badge>{r.effort} effort</Badge></div>
                    <p className="mt-0.5 text-sm text-muted">{r.rationale}</p>
                    <p className="mt-1 text-xs font-medium text-brand">Owner: {r.owner}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Next steps this week</h3>
                <ul className="space-y-1.5">
                  {s.next_steps.map((n, i) => <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{n}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">What&apos;s working</h3>
                <ul className="space-y-1.5">
                  {s.positive_signals.map((n, i) => <li key={i} className="flex gap-2 text-sm"><ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-risk-low" />{n}</li>)}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </Card>
  );
}
