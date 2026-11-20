"""The single place that decides what identity information leaves the server.

Rules:
- Anonymous items never include the author, for anyone, unless an admin has revealed
  that specific item (recorded in RevealLog).
- Viewers always learn whether an item is their own (`is_mine`) so they can see their
  own admins-only posts.
"""
from models import Comment, Event, Post, RevealLog, User
from services.sentiment import label


def revealed_ids(target_type: str) -> set[int]:
    return {r.target_id for r in RevealLog.query.filter_by(target_type=target_type).all()}


def _author(item, viewer: User, revealed: set[int]):
    if item.anonymity == "public":
        return item.author.to_public()
    if viewer.role == "admin" and item.id in revealed:
        return item.author.to_public()
    return None


def comment_dict(c: Comment, viewer: User, revealed: set[int] | None = None) -> dict:
    revealed = revealed if revealed is not None else set()
    d = {
        "id": c.id,
        "post_id": c.post_id,
        "body": c.body,
        "anonymity": c.anonymity,
        "created_at": c.created_at.isoformat(),
        "author": _author(c, viewer, revealed),
        "author_is_admin": c.author.role == "admin" and c.anonymity == "public",
        "is_mine": c.author_id == viewer.id,
    }
    if viewer.role == "admin":
        d.update(
            sentiment=c.sentiment,
            sentiment_label=label(c.sentiment),
            revealed=c.anonymity == "anonymous" and c.id in revealed,
        )
    return d


def post_dict(p: Post, viewer: User, *, with_comments=False, revealed_posts=None, revealed_comments=None) -> dict:
    revealed_posts = revealed_posts if revealed_posts is not None else revealed_ids("post")
    d = {
        "id": p.id,
        "title": p.title,
        "body": p.body,
        "category": p.category,
        "anonymity": p.anonymity,
        "audience": p.audience,
        "created_at": p.created_at.isoformat(),
        "upvotes": p.upvotes,
        "comment_count": len(p.comments),
        "author": _author(p, viewer, revealed_posts),
        "is_mine": p.author_id == viewer.id,
    }
    if viewer.role == "admin":
        d.update(
            sentiment=p.sentiment,
            sentiment_label=label(p.sentiment),
            themes=p.themes or [],
            risk_keywords=p.risk_keywords or [],
            program=p.author.program,
            revealed=p.anonymity == "anonymous" and p.id in revealed_posts,
        )
    if with_comments:
        rc = revealed_comments if revealed_comments is not None else revealed_ids("comment")
        d["comments"] = [comment_dict(c, viewer, rc) for c in p.comments]
    return d


def event_dict(e: Event, viewer: User) -> dict:
    attendee_ids = {r.user_id for r in e.rsvps}
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "starts_at": e.starts_at.isoformat(),
        "location": e.location,
        "capacity": e.capacity,
        "creator": e.creator.to_public(),
        "attendee_count": len(attendee_ids),
        "attending": viewer.id in attendee_ids,
        "is_mine": e.creator_id == viewer.id,
    }
