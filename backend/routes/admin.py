from collections import defaultdict
from datetime import timedelta

from flask import Blueprint, abort, jsonify, request

from models import Comment, Post, RevealLog, User, db, utcnow
from services.identity import require_admin
from services.risk import all_participant_risk, user_risk
from services.serializers import comment_dict, post_dict, revealed_ids
from services.themes import THEME_LABELS

bp = Blueprint("admin", __name__, url_prefix="/api/admin")
PROGRAMS = {"coop", "new_grad"}
TREND_WEEKS = 10


def _program_arg():
    program = request.args.get("program") or None
    if program and program not in PROGRAMS:
        abort(400, "program must be coop or new_grad")
    return program


def _items(program):
    posts = Post.query.join(User, Post.author_id == User.id).filter(User.role == "participant")
    comments = Comment.query.join(User, Comment.author_id == User.id).filter(User.role == "participant")
    if program:
        posts = posts.filter(User.program == program)
        comments = comments.filter(User.program == program)
    return posts.all(), comments.all()


@bp.get("/overview")
def overview():
    admin = require_admin()
    program = _program_arg()
    posts, comments = _items(program)
    now = utcnow()
    recent_cut = now - timedelta(days=30)
    items = [(p.created_at, p.sentiment or 0, p.author_id, p.author.program, p.themes or []) for p in posts] + [
        (c.created_at, c.sentiment or 0, c.author_id, c.author.program, c.themes or []) for c in comments
    ]
    recent = [i for i in items if i[0] >= recent_cut]

    # Weekly sentiment trend, overall + per program.
    buckets = defaultdict(lambda: defaultdict(list))
    for created, s, _, prog, _ in items:
        w = (now - created).days // 7
        if w < TREND_WEEKS:
            buckets[w]["all"].append(s)
            buckets[w][prog].append(s)
    avg = lambda v: round(sum(v) / len(v), 3) if v else None  # noqa: E731
    trend = []
    for w in range(TREND_WEEKS - 1, -1, -1):
        start = (now - timedelta(days=7 * w + 6)).date().isoformat()
        b = buckets.get(w, {})
        trend.append({"week_start": start, "weeks_ago": w, "all": avg(b.get("all", [])),
                      "coop": avg(b.get("coop", [])), "new_grad": avg(b.get("new_grad", [])),
                      "count": len(b.get("all", []))})

    # Theme breakdown (posts + comments), with share negative.
    theme_stats = defaultdict(lambda: {"count": 0, "negative": 0, "sum": 0.0, "recent": 0})
    for created, s, _, _, themes in items:
        for t in themes:
            st = theme_stats[t]
            st["count"] += 1
            st["sum"] += s
            st["negative"] += s <= -0.25
            st["recent"] += created >= recent_cut
    themes = sorted(
        [{"theme": t, "label": THEME_LABELS.get(t, t), "count": st["count"], "recent": st["recent"],
          "negative_share": round(st["negative"] / st["count"], 2), "avg_sentiment": round(st["sum"] / st["count"], 3)}
         for t, st in theme_stats.items()],
        key=lambda x: (-x["negative_share"] * x["count"], -x["count"]),
    )

    rp = revealed_ids("post")
    concerning = sorted([p for p in posts if p.created_at >= recent_cut], key=lambda p: p.sentiment or 0)[:6]
    risk = all_participant_risk(program)
    return jsonify(
        totals={
            "posts": len(posts),
            "comments": len(comments),
            "participants": User.query.filter_by(role="participant", **({"program": program} if program else {})).count(),
            "active_participants_30d": len({i[2] for i in recent}),
            "avg_sentiment_30d": avg([i[1] for i in recent]),
            "anonymous_share": round(sum(p.anonymity == "anonymous" for p in posts) / len(posts), 2) if posts else 0,
            "admins_only_posts": sum(p.audience == "admins_only" for p in posts),
            "high_risk": sum(r["level"] == "high" for r in risk),
            "medium_risk": sum(r["level"] == "medium" for r in risk),
        },
        trend=trend,
        themes=themes,
        concerning_posts=[post_dict(p, admin, revealed_posts=rp) for p in concerning],
    )


@bp.get("/at-risk")
def at_risk():
    require_admin()
    return jsonify(all_participant_risk(_program_arg()))


@bp.get("/users/<int:user_id>")
def user_detail(user_id):
    admin = require_admin()
    user = db.session.get(User, user_id) or abort(404, "User not found")
    rp, rc = revealed_ids("post"), revealed_ids("comment")
    activity = []
    for p in Post.query.filter_by(author_id=user.id).all():
        activity.append({"type": "post", "revealed": p.id in rp, **_masked(post_dict(p, admin, revealed_posts=rp), p, rp)})
    for c in Comment.query.filter_by(author_id=user.id).all():
        d = comment_dict(c, admin, rc)
        d["post_title"] = c.post.title
        activity.append({"type": "comment", "revealed": c.id in rc, **_masked(d, c, rc)})
    activity.sort(key=lambda a: a["created_at"], reverse=True)
    return jsonify(user=user.to_admin(), risk=user_risk(user), activity=activity)


def _masked(d: dict, item, revealed: set[int]) -> dict:
    """In a person's profile, anonymous items stay content-masked until an admin reveals them.

    Linking anonymous text to a named person *is* a reveal, so it must go through the audit log.
    """
    if item.anonymity == "anonymous" and item.id not in revealed:
        d = {k: v for k, v in d.items() if k not in ("title", "body", "post_title", "risk_keywords")}
        d["masked"] = True
    return d


@bp.post("/reveal")
def reveal():
    admin = require_admin()
    data = request.get_json(silent=True) or {}
    target_type, target_id = data.get("target_type"), data.get("target_id")
    reason = (data.get("reason") or "").strip()
    if target_type not in ("post", "comment") or not isinstance(target_id, int):
        abort(400, "target_type must be post|comment and target_id an integer")
    if len(reason) < 10:
        abort(400, "A reason (at least 10 characters) is required to reveal identity")
    model = Post if target_type == "post" else Comment
    item = db.session.get(model, target_id) or abort(404, "Not found")
    if item.anonymity != "anonymous":
        abort(400, "Item is not anonymous")
    db.session.add(RevealLog(target_type=target_type, target_id=target_id, admin_id=admin.id, reason=reason))
    db.session.commit()
    body = item.body if target_type == "comment" else f"{item.title}. {item.body}"
    return jsonify(author=item.author.to_admin(), body=body, title=getattr(item, "title", None))


@bp.get("/reveals")
def reveals():
    require_admin()
    logs = RevealLog.query.order_by(RevealLog.created_at.desc()).all()
    return jsonify([{"id": r.id, "target_type": r.target_type, "target_id": r.target_id, "reason": r.reason,
                     "admin": r.admin.name, "created_at": r.created_at.isoformat()} for r in logs])
