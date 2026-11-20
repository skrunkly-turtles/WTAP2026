"use client";
import { useEffect, useState } from "react";
import { ChevronRight, Lock, ShieldCheck, Sparkles, VenetianMask, X } from "lucide-react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { AIResult, api, RevealLogEntry, RiskBrief, RiskRow, UserDetail } from "@/lib/api";
import { PROGRAM_LABEL, timeAgo, titleCase } from "@/lib/format";
import { Badge, Button, Card, cx, ErrorNote, SentimentDot, Spinner } from "../ui";
import RevealDialog from "./RevealDialog";
import { SourceBadge } from "./AISummaryCard";

function ScoreBar({ score, level }: { score: number; level: RiskRow["level"] }) {
  const color = { high: "bg-risk-high", medium: "bg-risk-med", low: "bg-risk-low" }[level];
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface"><div className={cx("h-full rounded-full", color)} style={{ width: `${score}%` }} /></div>
      <span className="w-7 text-right text-sm tabular-nums">{score}</span>
    </div>
  );
}

function Brief({ userId }: { userId: number }) {
  const [res, setRes] = useState<AIResult<RiskBrief> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const gen = (regenerate = false) => {
    setLoading(true); setError("");
    api.riskBrief(userId, regenerate).then(setRes).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  const b = res?.data;
  return (
    <div className="rounded-xl border border-brand/20 bg-brand-tint/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <h4 className="mr-auto font-semibold">AI intervention brief</h4>
        <Button variant={b ? "outline" : "primary"} onClick={() => gen(!!b)} loading={loading} className="py-1">{b ? "Regenerate" : "Generate brief"}</Button>
      </div>
      {!b && !loading && <p className="mt-1 text-xs text-muted">Uses this person&apos;s posts (incl. anonymous) via pseudonym. Generation is audit-logged.</p>}
      {error && <div className="mt-2"><ErrorNote message={error} /></div>}
      {res && (
        <div className="mt-3 space-y-3 text-sm">
          <div className="[&_*]:!text-muted">{res.source === "gemini" ? <span className="text-xs">Gemini · {res.model}</span> : <SourceBadge r={res} />}</div>
          <p>{b!.summary}</p>
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-muted">Key drivers</h5>
            <ul className="list-disc space-y-0.5 pl-5">{b!.key_drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-muted">Recommended interventions</h5>
            <ul className="space-y-1.5">
              {b!.recommended_interventions.map((iv, i) => (
                <li key={i} className="rounded-lg border border-line bg-white p-2.5">
                  <div className="font-medium">{iv.action}</div>
                  <div className="text-xs text-muted">{iv.owner} · {iv.timing}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-muted">Conversation starters</h5>
            <ul className="space-y-1">{b!.conversation_starters.map((c, i) => <li key={i} className="italic">“{c}”</li>)}</ul>
          </div>
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-muted">Watch for</h5>
            <div className="flex flex-wrap gap-1">{b!.watch_signals.map((w, i) => <Badge key={i}>{w}</Badge>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [d, setD] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<{ type: "post" | "comment"; id: number } | null>(null);
  const load = () => api.userDetail(userId).then(setD).catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setD(null); load(); }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl scroll-thin" onClick={(e) => e.stopPropagation()} aria-label="Participant risk detail">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-3">
          <h2 className="font-semibold">{d?.user.name ?? "Loading…"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="p-5"><ErrorNote message={error} /></div>}
        {!d && !error && <Spinner />}
        {d && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={d.risk.level}>{d.risk.level} risk · {d.risk.score}</Badge>
              <span>{PROGRAM_LABEL[d.user.program ?? ""]} · {d.user.team}</span>
              <span>· Manager: {d.user.manager}</span>
              <span>· {d.user.email}</span>
            </div>

            <Card className="p-4">
              <h4 className="mb-2 text-sm font-semibold">Why flagged</h4>
              {d.risk.reasons.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">{d.risk.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              ) : <p className="text-sm text-muted">No significant risk signals.</p>}
              {d.risk.top_negative_themes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">{d.risk.top_negative_themes.map((t) => <Badge key={t} tone="brand">{titleCase(t)}</Badge>)}</div>
              )}
              {d.risk.timeline.length > 1 && (
                <div className="mt-3">
                  <p className="text-xs text-muted">Weekly sentiment (oldest → newest)</p>
                  <ResponsiveContainer width="100%" height={70}>
                    <LineChart data={d.risk.timeline}>
                      <YAxis domain={[-1, 1]} hide />
                      <ReferenceLine y={0} stroke="#9AA5B1" strokeDasharray="3 3" />
                      <Tooltip formatter={(v: number) => [v.toFixed(2), "Avg sentiment"]} labelFormatter={(_, p) => p?.[0] ? `${p[0].payload.weeks_ago} weeks ago` : ""}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Line dataKey="avg_sentiment" stroke="#005DAA" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Brief userId={userId} />

            <div>
              <h4 className="mb-2 text-sm font-semibold">Activity ({d.activity.length})</h4>
              <ul className="space-y-2">
                {d.activity.map((a) => (
                  <li key={`${a.type}-${a.id}`} className="rounded-lg border border-line p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge>{a.type}</Badge>
                      {a.anonymity === "anonymous" && <span className="flex items-center gap-1"><VenetianMask className="h-3 w-3" />anonymous</span>}
                      {a.audience === "admins_only" && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />admins only</span>}
                      <SentimentDot value={a.sentiment} />
                      <span className="ml-auto">{timeAgo(a.created_at)}</span>
                    </div>
                    {a.masked ? (
                      <div className="flex items-center justify-between gap-2 text-muted">
                        <span className="italic">Anonymous content hidden — counted in risk score.</span>
                        <Button variant="ghost" className="py-1 text-xs" onClick={() => setReveal({ type: a.type, id: a.id })}>Reveal…</Button>
                      </div>
                    ) : (
                      <>
                        {a.title && <div className="font-medium">{a.title}</div>}
                        {a.post_title && <div className="text-xs text-muted">on “{a.post_title}”</div>}
                        <p className="mt-0.5 line-clamp-3">{a.body}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {reveal && <RevealDialog target={reveal} onClose={() => setReveal(null)} onRevealed={() => { setReveal(null); load(); }} />}
      </aside>
    </div>
  );
}

function AuditLog() {
  const [logs, setLogs] = useState<RevealLogEntry[] | null>(null);
  useEffect(() => { api.reveals().then(setLogs).catch(() => setLogs([])); }, []);
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <ShieldCheck className="h-4 w-4 text-brand" /><h3 className="font-semibold">Identity reveal audit log</h3>
      </div>
      {!logs ? <Spinner /> : logs.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No reveals yet.</p> : (
        <ul className="divide-y divide-line text-sm">
          {logs.map((l) => (
            <li key={l.id} className="px-5 py-2.5">
              <span className="font-medium">{l.admin}</span> · {titleCase(l.target_type)} #{l.target_id} · <span className="text-muted">{timeAgo(l.created_at)}</span>
              <p className="text-xs text-muted">{l.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AtRisk({ program }: { program?: string }) {
  const [rows, setRows] = useState<RiskRow[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [logKey, setLogKey] = useState(0);
  useEffect(() => { setRows(null); api.atRisk(program).then(setRows).catch((e) => setError(e.message)); }, [program]);

  if (error) return <ErrorNote message={error} />;
  if (!rows) return <Spinner />;
  const visible = showAll ? rows : rows.filter((r) => r.level !== "low");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <div>
            <h3 className="font-semibold">Participants at risk of leaving</h3>
            <p className="text-xs text-muted">Score = negative sentiment trend + risk keywords. Includes anonymous activity (HR-only).</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show low risk
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2 font-medium">Participant</th>
                <th className="px-3 py-2 font-medium">Program</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Top reason</th>
                <th className="px-3 py-2 font-medium">Last active</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.user.id} onClick={() => setOpen(r.user.id)} className="cursor-pointer hover:bg-brand-tint/40">
                  <td className="px-5 py-3"><div className="font-medium">{r.user.name}</div><div className="text-xs text-muted">{r.user.team}</div></td>
                  <td className="px-3 py-3">{PROGRAM_LABEL[r.user.program ?? ""]}</td>
                  <td className="px-3 py-3"><Badge tone={r.level}>{r.level}</Badge></td>
                  <td className="px-3 py-3"><ScoreBar score={r.score} level={r.level} /></td>
                  <td className="max-w-xs px-3 py-3 text-muted"><span className="line-clamp-2">{r.reasons[0] ?? "—"}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{r.last_activity ? timeAgo(r.last_activity) : "—"}</td>
                  <td className="pr-4"><ChevronRight className="h-4 w-4 text-muted" /></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">No participants flagged.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <AuditLog key={logKey} />
      {open && <RiskDrawer userId={open} onClose={() => { setOpen(null); setLogKey((k) => k + 1); }} />}
    </div>
  );
}
