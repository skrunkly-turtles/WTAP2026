"use client";
import { useState } from "react";
import { Globe2, Lock, UserRound, VenetianMask } from "lucide-react";
import { api, Anonymity, Audience, Post } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { Button, cx, ErrorNote, Field, inputCls, Modal } from "../ui";

function Choice({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cx("flex flex-1 items-start gap-2 rounded-lg border p-3 text-left transition",
        selected ? "border-brand bg-brand-tint ring-2 ring-brand/20" : "border-line hover:bg-surface")}>
      <span className={cx("mt-0.5", selected ? "text-brand" : "text-muted")}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  );
}

export default function NewPostModal({ open, onClose, categories, onCreated }: {
  open: boolean; onClose: () => void; categories: string[]; onCreated: (p: Post) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [anonymity, setAnonymity] = useState<Anonymity>("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const p = await api.createPost({ title, body, category, audience, anonymity });
      onCreated(p);
      setTitle(""); setBody(""); setCategory("general"); setAudience("everyone"); setAnonymity("public");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const preview = `Visible to ${audience === "everyone" ? "all participants and admins" : "admins & HR only"}, ${anonymity === "public" ? "with your name" : "posted anonymously"}.`;

  return (
    <Modal open={open} onClose={onClose} title="New post" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
        <Field label="What's on your mind?">
          <textarea className={cx(inputCls, "min-h-32")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
        </Field>
        <Field label="Category">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
          </select>
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium">Who can see this?</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Choice selected={audience === "everyone"} onClick={() => setAudience("everyone")} icon={<Globe2 className="h-4 w-4" />}
              title="Everyone" desc="All participants and admins" />
            <Choice selected={audience === "admins_only"} onClick={() => setAudience("admins_only")} icon={<Lock className="h-4 w-4" />}
              title="Admins & HR only" desc="Private thread between you and HR" />
          </div>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Show my name?</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Choice selected={anonymity === "public"} onClick={() => setAnonymity("public")} icon={<UserRound className="h-4 w-4" />}
              title="Show my name" desc="Your name appears on the post" />
            <Choice selected={anonymity === "anonymous"} onClick={() => setAnonymity("anonymous")} icon={<VenetianMask className="h-4 w-4" />}
              title="Anonymous" desc="Hidden from everyone. HR may view identity only if support is needed." />
          </div>
        </div>
        <p className="rounded-lg bg-accent-tint px-3 py-2 text-xs text-brand-dark">{preview}</p>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Post</Button>
        </div>
      </form>
    </Modal>
  );
}
