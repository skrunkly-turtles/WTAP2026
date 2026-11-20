"use client";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AdminUser, api } from "@/lib/api";
import { PROGRAM_LABEL } from "@/lib/format";
import { Button, cx, ErrorNote, Field, inputCls, Modal } from "../ui";

export default function RevealDialog({ target, onClose, onRevealed }: {
  target: { type: "post" | "comment"; id: number }; onClose: () => void; onRevealed: (r: { author: AdminUser; body: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ author: AdminUser; body: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      setResult(await api.reveal({ target_type: target.type, target_id: target.id, reason }));
    } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={result ? () => onRevealed(result) : onClose} title="Reveal anonymous identity">
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">{result.author.name}</p>
          <p className="text-muted">{result.author.email} · {PROGRAM_LABEL[result.author.program ?? ""]} · {result.author.team} · Manager: {result.author.manager ?? "—"}</p>
          <p className="rounded-lg bg-surface p-3">{result.body}</p>
          <p className="text-xs text-muted">This reveal was recorded in the audit log.</p>
          <div className="flex justify-end"><Button onClick={() => onRevealed(result)}>Done</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2 rounded-lg border border-risk-med/30 bg-risk-med-tint p-3 text-sm text-risk-med">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Only reveal when intervention is needed for the participant&apos;s wellbeing or safety. Your name, time and reason are logged permanently.</span>
          </div>
          <Field label="Reason for reveal" hint="At least 10 characters">
            <textarea className={cx(inputCls, "min-h-20")} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} />
          </Field>
          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="danger" loading={saving} disabled={reason.trim().length < 10}>Reveal & log</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
