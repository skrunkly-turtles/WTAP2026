from flask import Blueprint, jsonify

from models import User
from services.identity import current_user
from services.themes import THEME_LABELS

bp = Blueprint("meta", __name__, url_prefix="/api")

CATEGORIES = ["general", "career", "workload", "manager", "onboarding", "belonging", "growth", "social", "compensation"]


@bp.get("/me")
def me():
    return jsonify(current_user().to_admin())


@bp.get("/meta")
def meta():
    """Demo personas for the view switcher + taxonomy for the UI."""
    users = User.query.order_by(User.id).all()
    return jsonify(
        personas=[{"id": u.id, "name": u.name, "role": u.role, "program": u.program} for u in users],
        categories=CATEGORIES,
        themes=THEME_LABELS,
    )
