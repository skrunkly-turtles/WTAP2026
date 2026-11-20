"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { AIResult, api, ProgramSummary } from "@/lib/api";
import { PROGRAM_LABEL, timeAgo } from "@/lib/format";
import { Button, Card, cx, ErrorNote, Spinner } from "../ui";

export function SourceBadge({ r }: { r: { source: string; model: string | null; generated_at: string; cached?: boolean } }) {
  if (r.source !== "gemini") return null;
  return <span className="text-xs text-white/80">Gemini · {r.model} · {r.cached ? "cached " : ""}{timeAgo(r.generated_at)}</span>;
}

const SEVERITY_DOT = { high: "bg-risk-high", medium: "bg-risk-med", low: "bg-risk-low" } as const;

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
                    <span role="img" aria-label={`${c.severity} severity`} title={`${c.severity[0].toUpperCase()}${c.severity.slice(1)} severity`}
                      className={cx("h-2.5 w-2.5 shrink-0 rounded-full", SEVERITY_DOT[c.severity])} />
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
        </div>
      )}
    </Card>
  );
}
