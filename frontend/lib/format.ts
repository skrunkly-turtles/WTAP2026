export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const PROGRAM_LABEL: Record<string, string> = { coop: "Co-op", new_grad: "New Grad", both: "Co-op & New Grad" };

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
