// Typed API client. Demo identity: the acting user's id is sent as X-User-Id (no real auth yet).
export type Program = "coop" | "new_grad";
export type Anonymity = "public" | "anonymous";
export type Audience = "everyone" | "admins_only";
export type RiskLevel = "low" | "medium" | "high";

export interface PublicUser { id: number; name: string; program: Program | null; team: string | null }
export interface AdminUser extends PublicUser { email: string; role: "participant" | "admin"; manager: string | null; start_date: string | null }
export interface Persona { id: number; name: string; role: "participant" | "admin"; program: Program | null }

export interface Comment {
  id: number; post_id: number; body: string; anonymity: Anonymity; created_at: string;
  author: PublicUser | null; author_is_admin: boolean; is_mine: boolean;
  sentiment?: number; sentiment_label?: string; revealed?: boolean;
}
export interface Post {
  id: number; title: string; body: string; category: string; anonymity: Anonymity; audience: Audience;
  created_at: string; upvotes: number; comment_count: number; author: PublicUser | null; is_mine: boolean;
  sentiment?: number; sentiment_label?: string; themes?: string[]; risk_keywords?: string[];
  program?: Program; revealed?: boolean; comments?: Comment[];
}
export interface EventItem {
  id: number; title: string; description: string; starts_at: string; location: string; capacity: number | null;
  creator: PublicUser; attendee_count: number; attending: boolean; is_mine: boolean;
}
export interface Meta { personas: Persona[]; categories: string[]; themes: Record<string, string> }

export interface Overview {
  totals: {
    posts: number; comments: number; participants: number; active_participants_30d: number;
    avg_sentiment_30d: number | null; anonymous_share: number; admins_only_posts: number; high_risk: number; medium_risk: number;
  };
  trend: { week_start: string; weeks_ago: number; all: number | null; coop: number | null; new_grad: number | null; count: number }[];
  themes: { theme: string; label: string; count: number; recent: number; negative_share: number; avg_sentiment: number }[];
  concerning_posts: Post[];
}
export interface RiskRow {
  score: number; level: RiskLevel; reasons: string[]; keywords: string[]; top_negative_themes: string[];
  last_activity: string | null; user: AdminUser;
  signals: { recent_mean: number | null; baseline_mean: number | null; recent_count: number };
}
export interface Activity {
  type: "post" | "comment"; id: number; created_at: string; anonymity: Anonymity; masked?: boolean; revealed: boolean;
  title?: string; body?: string; post_title?: string; post_id?: number; sentiment?: number; audience?: Audience;
}
export interface UserDetail { user: AdminUser; risk: RiskRow & { timeline: { weeks_ago: number; avg_sentiment: number; count: number }[] }; activity: Activity[] }

export interface AIResult<T> { source: "gemini" | "fallback"; model: string | null; generated_at: string; cached?: boolean; data: T }
export interface ProgramSummary {
  executive_summary: string; overall_health: "healthy" | "mixed" | "concerning";
  top_concerns: { theme: string; title: string; severity: RiskLevel; description: string; affected_program: Program | "both"; evidence_post_ids: number[] }[];
  positive_signals: string[];
  systemic_recommendations: { title: string; rationale: string; owner: string; effort: RiskLevel }[];
  next_steps: string[];
}
export interface RiskBrief {
  risk_level: RiskLevel; summary: string; key_drivers: string[];
  recommended_interventions: { action: string; owner: string; timing: string }[];
  conversation_starters: string[]; watch_signals: string[];
}
export interface AskAnswer { answer: string; cited_post_ids: number[]; follow_up_questions: string[] }
export interface RevealLogEntry { id: number; target_type: string; target_id: number; reason: string; admin: string; created_at: string }

let actingUserId = 1;
export function setActingUserId(id: number) { actingUserId = id; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-User-Id": String(actingUserId), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}
const post = <T,>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });
const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : "";
};

export const api = {
  meta: () => request<Meta>("/meta"),
  posts: (p: { category?: string; q?: string; audience?: string } = {}) => request<Post[]>(`/posts${qs(p)}`),
  post: (id: number) => request<Post>(`/posts/${id}`),
  createPost: (d: { title: string; body: string; category: string; anonymity: Anonymity; audience: Audience }) => post<Post>("/posts", d),
  comment: (id: number, d: { body: string; anonymity: Anonymity }) => post<Comment>(`/posts/${id}/comments`, d),
  upvote: (id: number) => post<{ upvotes: number }>(`/posts/${id}/upvote`),
  events: () => request<EventItem[]>("/events"),
  createEvent: (d: { title: string; description: string; starts_at: string; location: string; capacity: number | null }) => post<EventItem>("/events", d),
  join: (id: number) => post<EventItem>(`/events/${id}/rsvp`),
  leave: (id: number) => request<EventItem>(`/events/${id}/rsvp`, { method: "DELETE" }),
  overview: (program?: string) => request<Overview>(`/admin/overview${qs({ program })}`),
  atRisk: (program?: string) => request<RiskRow[]>(`/admin/at-risk${qs({ program })}`),
  userDetail: (id: number) => request<UserDetail>(`/admin/users/${id}`),
  reveal: (d: { target_type: "post" | "comment"; target_id: number; reason: string }) =>
    post<{ author: AdminUser; body: string; title: string | null }>("/admin/reveal", d),
  reveals: () => request<RevealLogEntry[]>("/admin/reveals"),
  summary: (program?: string, regenerate = false) => post<AIResult<ProgramSummary>>("/ai/summary", { program, regenerate }),
  riskBrief: (userId: number, regenerate = false) => post<AIResult<RiskBrief>>(`/ai/risk-brief/${userId}`, { regenerate }),
  ask: (question: string, history: { role: string; content: string }[], program?: string) =>
    post<AIResult<AskAnswer>>("/ai/ask", { question, history, program }),
};
