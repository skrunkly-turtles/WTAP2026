"use client";
import { X, Loader2 } from "lucide-react";
import { useEffect } from "react";
import type { RiskLevel } from "@/lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "accent" | "ghost" | "outline" | "danger";
export function Button({ variant = "primary", className, loading, children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    accent: "bg-accent text-brand-dark hover:brightness-95",
    ghost: "text-brand hover:bg-brand-tint",
    outline: "border border-line bg-white text-ink hover:bg-surface",
    danger: "bg-risk-high text-white hover:brightness-95",
  };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("rounded-xl border border-line bg-white shadow-sm", className)}>{children}</div>;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "brand" | "accent" | RiskLevel; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface text-muted border-line",
    brand: "bg-brand-tint text-brand border-brand/20",
    accent: "bg-accent-tint text-brand-dark border-accent",
    high: "bg-risk-high-tint text-risk-high border-risk-high/30",
    medium: "bg-risk-med-tint text-risk-med border-risk-med/30",
    low: "bg-risk-low-tint text-risk-low border-risk-low/30",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx("-mb-px flex items-center gap-1.5 border-b-[3px] px-4 py-2.5 text-sm font-semibold transition",
            value === t.id ? "border-accent text-brand" : "border-transparent text-muted hover:text-ink")}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx("max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl", wide ? "max-w-2xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-brand" /> {label ?? "Loading…"}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-lg border border-risk-high/30 bg-risk-high-tint px-3 py-2 text-sm text-risk-high">{message}</div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function SentimentDot({ value }: { value?: number }) {
  if (value === undefined) return null;
  const tone = value <= -0.25 ? "bg-risk-high" : value >= 0.25 ? "bg-risk-low" : "bg-muted/50";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title="Sentiment (VADER, −1 to +1)">
      <span className={cx("h-2 w-2 rounded-full", tone)} />
      {value >= 0 ? "+" : ""}{value.toFixed(2)}
    </span>
  );
}
