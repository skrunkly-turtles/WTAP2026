"""Per-participant risk-of-leaving score.

Signals (agreed with product):
  1. Negative sentiment trend: low recent mean + drop vs. the participant's own baseline.
  2. Risk keywords/themes: phrases like "other offer", "burnout", "not valued".

Anonymous posts/comments count: this is an HR-only signal. Output includes plain-English
reasons so admins can see why someone is flagged.
"""
from collections import defaultdict
from datetime import timedelta

from models import Comment, Post, User, utcnow
from services.themes import RISK_KEYWORDS

RECENT_DAYS = 30
WEIGHTS = {
    "low_mean_max": 40,  # recent mean of -1.0 earns all of this
    "decline_max": 25,  # drop of ~0.8 vs baseline earns all of this
    "keyword_cap": 45,
    "older_keyword_factor": 0.4,  # keywords older than RECENT_DAYS count less
    "comment_weight": 0.5,  # replies are often empathetic ("so sorry, that's awful") and read negative
    "full_confidence_weight": 2.0,  # sentiment points scale up to full once this much weighted activity exists
}
LEVELS = [(65, "high"), (35, "medium"), (0, "low")]


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _w(item) -> float:
    return item[4] if len(item) > 4 else 1.0


def level_for(score: int) -> str:
    return next(name for threshold, name in LEVELS if score >= threshold)


def _activity_by_user():
    """user_id -> list of (created_at, sentiment, risk_keywords, themes)."""
    acts = defaultdict(list)
    for p in Post.query.all():
        acts[p.author_id].append((p.created_at, p.sentiment or 0.0, p.risk_keywords or [], p.themes or [], 1.0))
    for c in Comment.query.all():
        acts[c.author_id].append(
            (c.created_at, c.sentiment or 0.0, c.risk_keywords or [], c.themes or [], WEIGHTS["comment_weight"]))
    return acts


def score_activity(items, now=None) -> dict:
    now = now or utcnow()
    cutoff = now - timedelta(days=RECENT_DAYS)
    recent = [i for i in items if i[0] >= cutoff]
    older = [i for i in items if i[0] < cutoff]
    reasons, signals = [], {}

    def wmean(xs):
        w = sum(_w(i) for i in xs)
        return sum(i[1] * _w(i) for i in xs) / w if w else None

    recent_mean, baseline_mean = wmean(recent), wmean(older)
    confidence = min(1.0, sum(_w(i) for i in recent) / WEIGHTS["full_confidence_weight"])
    signals.update(recent_mean=recent_mean, baseline_mean=baseline_mean, recent_count=len(recent), confidence=confidence)

    pts = 0.0
    if recent_mean is not None and recent_mean < 0:
        p = confidence * _clamp(-recent_mean * WEIGHTS["low_mean_max"], 0, WEIGHTS["low_mean_max"])
        pts += p
        if p >= 8:
            reasons.append(f"Recent posts are negative in tone (avg sentiment {recent_mean:+.2f}, last {RECENT_DAYS} days)")
    if recent_mean is not None and baseline_mean is not None:
        delta = recent_mean - baseline_mean
        signals["delta"] = delta
        if delta < 0:
            p = confidence * _clamp(-delta / 0.8 * WEIGHTS["decline_max"], 0, WEIGHTS["decline_max"])
            pts += p
            if p >= 6:
                reasons.append(f"Sentiment dropped {abs(delta):.2f} vs. their earlier baseline ({baseline_mean:+.2f} → {recent_mean:+.2f})")

    kw_recent = {k for i in recent for k in i[2]}
    kw_older = {k for i in older for k in i[2]} - kw_recent
    kw_pts = sum(RISK_KEYWORDS.get(k, 0) for k in kw_recent) + WEIGHTS["older_keyword_factor"] * sum(
        RISK_KEYWORDS.get(k, 0) for k in kw_older
    )
    kw_pts = min(kw_pts, WEIGHTS["keyword_cap"])
    pts += kw_pts
    if kw_recent:
        ranked = sorted(kw_recent, key=lambda k: -RISK_KEYWORDS.get(k, 0))
        reasons.append("Mentioned " + ", ".join(f"“{k}”" for k in ranked[:4]))
    elif kw_older:
        reasons.append("Earlier mentions of " + ", ".join(f"“{k}”" for k in sorted(kw_older)[:3]))

    theme_counts = defaultdict(int)
    for i in recent:
        if i[1] < -0.1:
            for t in i[3]:
                theme_counts[t] += 1
    top_themes = sorted(theme_counts, key=lambda t: -theme_counts[t])[:3]

    score = int(round(_clamp(pts, 0, 100)))
    return {
        "score": score,
        "level": level_for(score),
        "reasons": reasons,
        "keywords": sorted(kw_recent | kw_older),
        "top_negative_themes": top_themes,
        "signals": signals,
        "last_activity": max((i[0] for i in items), default=None),
    }


def all_participant_risk(program: str | None = None) -> list[dict]:
    acts = _activity_by_user()
    q = User.query.filter_by(role="participant")
    if program:
        q = q.filter_by(program=program)
    rows = []
    for u in q.all():
        r = score_activity(acts.get(u.id, []))
        r["user"] = u.to_admin()
        r["last_activity"] = r["last_activity"].isoformat() if r["last_activity"] else None
        rows.append(r)
    rows.sort(key=lambda r: -r["score"])
    return rows


def user_risk(user: User) -> dict:
    items = _activity_by_user().get(user.id, [])
    r = score_activity(items)
    r["last_activity"] = r["last_activity"].isoformat() if r["last_activity"] else None
    # Weekly sentiment timeline for the sparkline.
    now = utcnow()
    weeks = defaultdict(list)
    for created, s, *_ in items:
        weeks[(now - created).days // 7].append(s)
    r["timeline"] = [
        {"weeks_ago": w, "avg_sentiment": round(sum(v) / len(v), 3), "count": len(v)}
        for w, v in sorted(weeks.items(), reverse=True)
    ]
    return r
