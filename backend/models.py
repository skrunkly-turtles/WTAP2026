from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(200), nullable=False, unique=True)
    role = db.Column(db.String(20), nullable=False, default="participant")  # participant | admin
    program = db.Column(db.String(20))  # coop | new_grad (null for admins)
    team = db.Column(db.String(120))
    manager = db.Column(db.String(120))
    start_date = db.Column(db.Date)

    def to_public(self):
        return {"id": self.id, "name": self.name, "program": self.program, "team": self.team}

    def to_admin(self):
        return {
            **self.to_public(),
            "email": self.email,
            "role": self.role,
            "manager": self.manager,
            "start_date": self.start_date.isoformat() if self.start_date else None,
        }


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40), nullable=False, default="general")
    anonymity = db.Column(db.String(20), nullable=False, default="public")  # public | anonymous
    audience = db.Column(db.String(20), nullable=False, default="everyone")  # everyone | admins_only
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    sentiment = db.Column(db.Float, default=0.0)
    themes = db.Column(db.JSON, default=list)
    risk_keywords = db.Column(db.JSON, default=list)
    upvotes = db.Column(db.Integer, default=0)

    author = db.relationship("User")
    comments = db.relationship(
        "Comment", back_populates="post", order_by="Comment.created_at", cascade="all, delete-orphan"
    )


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("post.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    anonymity = db.Column(db.String(20), nullable=False, default="public")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    sentiment = db.Column(db.Float, default=0.0)
    themes = db.Column(db.JSON, default=list)
    risk_keywords = db.Column(db.JSON, default=list)

    author = db.relationship("User")
    post = db.relationship("Post", back_populates="comments")


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    starts_at = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(200), default="")
    capacity = db.Column(db.Integer)
    creator_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    creator = db.relationship("User")
    rsvps = db.relationship("EventRSVP", cascade="all, delete-orphan")


class EventRSVP(db.Model):
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), primary_key=True)
    created_at = db.Column(db.DateTime, default=utcnow)


class RevealLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(20), nullable=False)  # post | comment
    target_id = db.Column(db.Integer, nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    admin = db.relationship("User")


class AIInsight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(40), nullable=False)  # summary | risk_brief
    scope_key = db.Column(db.String(80), nullable=False)
    payload = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
