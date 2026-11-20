"""DEMO-ONLY identity.

There is no login: the frontend sends X-User-Id and the role is read from the DB.
Headers are trivially spoofable, so replace this with real auth (SSO/JWT) before any
real participant data goes in.
"""
from flask import abort, request

from models import User, db


def current_user() -> User:
    # Cache per request (not on `g`, which can outlive a request when an app context is reused).
    cached = request.environ.get("rbconnect.user")
    if cached is None:
        uid = request.headers.get("X-User-Id", type=int)
        user = db.session.get(User, uid) if uid else None
        if user is None:
            user = User.query.filter_by(role="admin").order_by(User.id).first()
        if user is None:
            abort(401)
        request.environ["rbconnect.user"] = cached = user
    return cached


def require_admin() -> User:
    user = current_user()
    if user.role != "admin":
        abort(403)
    return user
