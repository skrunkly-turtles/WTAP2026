"""Gemini-powered insight agent.

Privacy: prompts never contain names or emails. Participants appear as pseudonyms
("P-12"); posts by ID. Names are joined back server-side only where the admin UI needs them.

Resilience: if GEMINI_API_KEY is missing or the call fails, a deterministic fallback built
from the same aggregates is returned, tagged source="fallback", so the demo never breaks.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import timedelta
from typing import Literal

from flask import current_app
from pydantic import BaseModel, Field

from models import Post, User, utcnow
from services.risk import all_participant_risk, user_risk
from services.themes import THEME_LABELS

log = logging.getLogger(__name__)

Severity = Literal["low", "medium", "high"]


# ---------- output schemas (shared by Gemini and fallback) ----------
class Concern(BaseModel):
    theme: str
    title: str
    severity: Severity
    description: str
    affected_program: Literal["coop", "new_grad", "both"]
    evidence_post_ids: list[int] = Field(default_factory=list)


class Recommendation(BaseModel):
    title: str
    rationale: str
    owner: str
    effort: Severity


class ProgramSummary(BaseModel):
    executive_summary: str
    overall_health: Literal["healthy", "mixed", "concerning"]
    top_concerns: list[Concern]
    positive_signals: list[str]
    systemic_recommendations: list[Recommendation]
    next_steps: list[str]


class Intervention(BaseModel):
    action: str
    owner: str
    timing: str


class RiskBrief(BaseModel):
    risk_level: Severity
    summary: str
    key_drivers: list[str]
    recommended_interventions: list[Intervention]
    conversation_starters: list[str]
    watch_signals: list[str]


class AskAnswer(BaseModel):
    answer: str
    cited_post_ids: list[int] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)


SYSTEM = (
    "You are RBConnect Insights, an analyst supporting an Early Talent program team and HR. "
    "Participants are co-ops and new grads. You read their discussion-board posts and help HR "
    "understand systemic issues and support people at risk of leaving. Be specific, evidence-based "
    "and compassionate. Cite post IDs as evidence. Never guess identities of anonymous posters, "
    "never invent facts not in the data, and prefer systemic fixes over blaming individuals. "
    "Keep language concise and actionable."
)


# ---------- Gemini call ----------
def _client():
    key = current_app.config.get("GEMINI_API_KEY")
    if not key:
        return None
    from google import genai

    return genai.Client(api_key=key)


def _generate(prompt: str, schema: type[BaseModel]) -> BaseModel | None:
    client = _client()
    if client is None:
        return None
    from google.genai import types

    try:
        resp = client.models.generate_content(
            model=current_app.config["GEMINI_MODEL"],
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.3,
            ),
        )
        if getattr(resp, "parsed", None) is not None:
            return resp.parsed if isinstance(resp.parsed, schema) else schema.model_validate(resp.parsed)
        return schema.model_validate_json(resp.text)
    except Exception:  # network, quota, validation: fall back
        log.exception("Gemini call failed; using fallback")
        return None


def _result(model: BaseModel, source: str) -> dict:
    return {"source": source, "model": current_app.config["GEMINI_MODEL"] if source == "gemini" else None,
            "generated_at": utcnow().isoformat(), "data": model.model_dump()}


# ---------- context builders ----------
def _pseudo(uid: int) -> str:
    return f"P-{uid}"


def _post_context(posts: list[Post], body_chars=500) -> list[dict]:
    now = utcnow()
    out = []
    for p in posts:
        out.append({
            "post_id": p.id,
            "program": p.author.program,
            "audience": p.audience,
            "anonymous": p.anonymity == "anonymous",
            "days_ago": (now - p.created_at).days,
            "category": p.category,
            "themes": p.themes,
            "sentiment": round(p.sentiment or 0, 2),
            "upvotes": p.upvotes,
            "title": p.title,
            "body": p.body[:body_chars],
            "comments": [
                {"by": "HR/admin" if c.author.role == "admin" else c.author.program,
                 "sentiment": round(c.sentiment or 0, 2), "text": c.body[:200]}
                for c in p.comments[:6]
            ],
        })
    return out


def _participant_posts(program: str | None, days: int = 75) -> list[Post]:
    q = Post.query.join(User, Post.author_id == User.id).filter(
        User.role == "participant", Post.created_at >= utcnow() - timedelta(days=days))
    if program:
        q = q.filter(User.program == program)
    return q.order_by(Post.created_at.desc()).all()


def _aggregates(posts: list[Post], program: str | None) -> dict:
    theme_counts = Counter(t for p in posts for t in (p.themes or []))
    neg = Counter(t for p in posts if (p.sentiment or 0) <= -0.25 for t in (p.themes or []))
    risk = all_participant_risk(program)
    return {
        "post_count": len(posts),
        "avg_sentiment": round(sum(p.sentiment or 0 for p in posts) / len(posts), 3) if posts else None,
        "theme_counts": dict(theme_counts),
        "negative_theme_counts": dict(neg),
        "risk_levels": dict(Counter(r["level"] for r in risk)),
        "admins_only_posts": sum(p.audience == "admins_only" for p in posts),
    }


# ---------- 1. program summary ----------
def program_summary(program: str | None) -> dict:
    posts = _participant_posts(program)
    agg = _aggregates(posts, program)
    scope = {"coop": "co-op participants only", "new_grad": "new grad participants only"}.get(program, "all early talent participants (co-ops and new grads)")
    prompt = (
        f"Analyse the discussion board for {scope} over the last ~10 weeks.\n"
        "Produce: an executive summary (3-4 sentences) for program leadership; overall health; "
        "the top 3-5 concerns ranked by severity with evidence post IDs and which program is affected; "
        "positive signals worth keeping; 3-5 systemic recommendations with an owner (e.g. Early Talent Program team, "
        "HR, team managers, IT) and effort; and 3-5 concrete next steps for this week.\n"
        "Weigh recent posts, strongly negative sentiment, upvotes and admins-only posts (private concerns sent to HR) more heavily.\n\n"
        f"AGGREGATES:\n{json.dumps(agg)}\n\nPOSTS:\n{json.dumps(_post_context(posts))}"
    )
    model = _generate(prompt, ProgramSummary)
    if model:
        return _result(model, "gemini")
    return _result(_fallback_summary(posts, agg, program), "fallback")


_RECS = {
    "return_offers": Recommendation(title="Publish a return-offer timeline", rationale="Uncertainty about return offers is pushing co-ops to interview elsewhere.", owner="Early Talent Program team + HR", effort="low"),
    "workload": Recommendation(title="Workload review with high-pressure teams", rationale="Repeated reports of weekends and late nights indicate unsustainable workload.", owner="HR + team leads", effort="medium"),
    "manager_support": Recommendation(title="Minimum 1:1 cadence for early talent", rationale="Cancelled 1:1s and lack of feedback leave participants unsupported.", owner="Team managers", effort="low"),
    "onboarding": Recommendation(title="Pre-provision access before day one", rationale="Access and setup delays waste weeks of early talent time.", owner="IT + hiring managers", effort="medium"),
    "belonging": Recommendation(title="Buddy program and in-office anchor days", rationale="Remote participants report isolation and low connection.", owner="Early Talent Program team", effort="low"),
    "growth": Recommendation(title="Scope review for rotations", rationale="Participants report low-impact work and lack of growth.", owner="Rotation leads", effort="medium"),
    "compensation": Recommendation(title="Clarify compensation and stipends", rationale="Questions about pay and stipends recur.", owner="HR", effort="low"),
}


def _fallback_summary(posts: list[Post], agg: dict, program: str | None) -> ProgramSummary:
    neg = Counter(agg["negative_theme_counts"])
    concerns = []
    for theme, n in neg.most_common(4):
        evidence = sorted([p for p in posts if theme in (p.themes or []) and (p.sentiment or 0) <= -0.25],
                          key=lambda p: (p.sentiment or 0))[:4]
        progs = {p.author.program for p in evidence}
        concerns.append(Concern(
            theme=theme, title=THEME_LABELS.get(theme, theme),
            severity="high" if n >= 5 else "medium" if n >= 3 else "low",
            description=f"{n} negative posts mention {THEME_LABELS.get(theme, theme).lower()}.",
            affected_program=progs.pop() if len(progs) == 1 else "both",
            evidence_post_ids=[p.id for p in evidence]))
    positive = [p for p in posts if (p.sentiment or 0) >= 0.5]
    pos_themes = Counter(t for p in positive for t in (p.themes or []) or ["general"])
    high = agg["risk_levels"].get("high", 0)
    avg = agg["avg_sentiment"] or 0
    health = "concerning" if avg < -0.05 or high >= 3 else "mixed" if avg < 0.3 else "healthy"
    top = ", ".join(c.title.lower() for c in concerns[:3]) or "no dominant issue"
    return ProgramSummary(
        executive_summary=(f"Across {agg['post_count']} recent posts the average sentiment is {avg:+.2f}. "
                           f"The most negative themes are {top}. {high} participant(s) are currently flagged high risk "
                           f"and {agg['admins_only_posts']} concern(s) were sent privately to HR."),
        overall_health=health,
        top_concerns=concerns,
        positive_signals=[f"Positive posts about {THEME_LABELS.get(t, 'community and events').lower()}" for t, _ in pos_themes.most_common(3)],
        systemic_recommendations=[_RECS[c.theme] for c in concerns if c.theme in _RECS],
        next_steps=["Reach out to every high-risk participant this week",
                    "Reply publicly on the most-upvoted negative threads",
                    "Share this summary with program leadership"],
    )


# ---------- 2. per-person risk brief ----------
def risk_brief(user: User) -> dict:
    risk = user_risk(user)
    items = []
    for p in Post.query.filter_by(author_id=user.id).all():
        items.append({"kind": "post", "id": p.id, "anonymous": p.anonymity == "anonymous", "audience": p.audience,
                      "days_ago": (utcnow() - p.created_at).days, "sentiment": round(p.sentiment or 0, 2),
                      "text": f"{p.title}. {p.body}"[:600]})
    from models import Comment
    for c in Comment.query.filter_by(author_id=user.id).all():
        items.append({"kind": "comment", "id": c.id, "anonymous": c.anonymity == "anonymous",
                      "days_ago": (utcnow() - c.created_at).days, "sentiment": round(c.sentiment or 0, 2), "text": c.body[:300]})
    items.sort(key=lambda i: i["days_ago"])
    tenure = (utcnow().date() - user.start_date).days if user.start_date else None
    profile = {"participant": _pseudo(user.id), "program": user.program, "team": user.team, "tenure_days": tenure,
               "risk_score": risk["score"], "risk_level": risk["level"], "reasons": risk["reasons"],
               "weekly_sentiment": risk["timeline"]}
    prompt = (
        "Write an intervention brief for HR about one participant who may be at risk of leaving.\n"
        "Explain the key drivers using the evidence, recommend 2-4 interventions (who should act, what, and when), "
        "give 3 empathetic conversation starters that do NOT reveal or quote anything they posted anonymously, "
        "and list signals to watch. Refer to the person only as their pseudonym.\n\n"
        f"PROFILE:\n{json.dumps(profile, default=str)}\n\nACTIVITY (newest first):\n{json.dumps(items)}"
    )
    model = _generate(prompt, RiskBrief)
    if model:
        return _result(model, "gemini")
    return _result(_fallback_brief(user, risk), "fallback")


_INTERVENTIONS = {
    "return_offers": Intervention(action="Share the return-offer timeline and where they stand", owner="Early Talent Program lead", timing="This week"),
    "workload": Intervention(action="Workload check-in with manager; reprioritise and protect weekends", owner="HR Business Partner + manager", timing="Within 48 hours"),
    "manager_support": Intervention(action="Reinstate weekly 1:1s and assign a mentor", owner="Manager + Early Talent Program team", timing="This week"),
    "belonging": Intervention(action="Pair with a buddy and invite to upcoming in-person events", owner="Early Talent Program team", timing="This week"),
    "growth": Intervention(action="Review role scope and add a stretch project", owner="Manager / rotation lead", timing="Within 2 weeks"),
    "onboarding": Intervention(action="Escalate outstanding access requests", owner="IT + manager", timing="Within 48 hours"),
}


def _fallback_brief(user: User, risk: dict) -> RiskBrief:
    themes = risk["top_negative_themes"] or ["manager_support"]
    interventions = [_INTERVENTIONS[t] for t in themes if t in _INTERVENTIONS] or [_INTERVENTIONS["manager_support"]]
    interventions.insert(0, Intervention(action="Confidential, supportive check-in conversation", owner="HR Business Partner", timing="Within 48 hours"))
    labels = [THEME_LABELS.get(t, t).lower() for t in themes]
    return RiskBrief(
        risk_level=risk["level"],
        summary=f"Risk score {risk['score']}/100. Recent activity points to concerns about {', '.join(labels)}.",
        key_drivers=risk["reasons"] or ["No strong signals"],
        recommended_interventions=interventions[:4],
        conversation_starters=["How has the term been going for you overall?",
                               "What's one thing that would make your day-to-day better?",
                               "How are you feeling about what comes after this term?"],
        watch_signals=["Further drop in sentiment", "Reduced participation in events or the board",
                       "Mentions of other offers or leaving"],
    )


# ---------- 3. ask the agent ----------
_STOP = set("the a an and or of to in on for is are was were what which who how why do does did with about our we they "
            "there their this that it be most main any have has".split())


def _retrieve(question: str, posts: list[Post], k=25) -> list[Post]:
    terms = {w for w in re.findall(r"[a-z']+", question.lower()) if w not in _STOP and len(w) > 2}
    theme_hits = {t for t, label in THEME_LABELS.items() if terms & set(re.findall(r"[a-z]+", (t + " " + label).lower()))}

    def score(p: Post):
        text = f"{p.title} {p.body} {' '.join(c.body for c in p.comments)}".lower()
        s = sum(text.count(t) for t in terms) + 3 * len(theme_hits & set(p.themes or []))
        return s + max(0, -(p.sentiment or 0))  # tie-break toward concerns

    ranked = sorted(posts, key=score, reverse=True)
    return ranked[:k]


def ask(question: str, history: list[dict] | None = None, program: str | None = None) -> dict:
    posts = _participant_posts(program, days=120)
    context = _retrieve(question, posts)
    agg = _aggregates(posts, program)
    hist = "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')[:500]}" for m in (history or [])[-6:])
    prompt = (
        "Answer the HR admin's question using only the data below. Cite post IDs you relied on. "
        "If the data doesn't answer it, say so. Suggest up to 3 follow-up questions.\n\n"
        f"CONVERSATION SO FAR:\n{hist or '(none)'}\n\nQUESTION: {question}\n\n"
        f"AGGREGATES:\n{json.dumps(agg)}\n\nRELEVANT POSTS:\n{json.dumps(_post_context(context, 400))}"
    )
    model = _generate(prompt, AskAnswer)
    if model:
        return _result(model, "gemini")
    top = context[:5]
    answer = ("Gemini is not configured, so here are the most relevant posts by keyword match: "
              + "; ".join(f"#{p.id} “{p.title}” (sentiment {p.sentiment:+.2f})" for p in top)) if top else "No matching posts found."
    return _result(AskAnswer(answer=answer, cited_post_ids=[p.id for p in top],
                             follow_up_questions=["Which themes are most negative this month?",
                                                  "Who is currently flagged high risk?"]), "fallback")
