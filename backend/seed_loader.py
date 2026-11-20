"""Load seed JSON into the DB. Dates are relative (days_ago) so the demo always looks current."""
import json
from datetime import timedelta
from pathlib import Path

from models import AIInsight, Comment, Event, EventRSVP, Post, RevealLog, User, db, utcnow
from services.enrich import enrich

SEED_DIR = Path(__file__).resolve().parent / "seed"


def _load(name):
    return json.loads((SEED_DIR / name).read_text())


def seed(reset: bool = False):
    if reset:
        db.drop_all()
    db.create_all()
    if User.query.first():
        return False

    now = utcnow().replace(minute=0, second=0, microsecond=0)
    for u in _load("users.json"):
        db.session.add(User(
            id=u["id"], name=u["name"], email=u["email"], role=u["role"], program=u["program"],
            team=u["team"], manager=u["manager"], start_date=(now - timedelta(days=u["start_days_ago"])).date(),
        ))
    db.session.flush()

    for i, p in enumerate(_load("posts.json")):
        created = now - timedelta(days=p["days_ago"], hours=(i * 7) % 9)
        post = Post(author_id=p["author"], title=p["title"], body=p["body"], category=p["category"],
                    anonymity=p["anonymity"], audience=p["audience"], upvotes=p["upvotes"], created_at=created)
        enrich(post, f"{p['title']}. {p['body']}")
        db.session.add(post)
        for j, c in enumerate(p["comments"]):
            c_created = max(created + timedelta(hours=1 + j), now - timedelta(days=c["days_ago"], hours=j))
            comment = Comment(post=post, author_id=c["author"], body=c["body"], anonymity=c["anonymity"],
                              created_at=min(c_created, now))
            enrich(comment, c["body"])
            db.session.add(comment)

    for e in _load("events.json"):
        ev = Event(title=e["title"], description=e["description"], location=e["location"], capacity=e["capacity"],
                   creator_id=e["creator"],
                   starts_at=(now + timedelta(days=e["days_from_now"])).replace(hour=e["hour"]))
        db.session.add(ev)
        db.session.flush()
        for uid in e["rsvps"]:
            db.session.add(EventRSVP(event_id=ev.id, user_id=uid))

    db.session.commit()
    return True


__all__ = ["seed", "AIInsight", "RevealLog"]
