from flask import Blueprint, abort, jsonify, request

from models import AIInsight, RevealLog, User, db
from routes.admin import PROGRAMS
from services import ai_agent
from services.identity import require_admin

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


def _cached(kind, scope_key):
    return AIInsight.query.filter_by(kind=kind, scope_key=scope_key).order_by(AIInsight.created_at.desc()).first()


def _store(kind, scope_key, result):
    # Only cache real Gemini output so adding a key later takes effect immediately.
    if result["source"] == "gemini":
        AIInsight.query.filter_by(kind=kind, scope_key=scope_key).delete()
        db.session.add(AIInsight(kind=kind, scope_key=scope_key, payload=result))
        db.session.commit()
    return result


@bp.post("/summary")
def summary():
    require_admin()
    data = request.get_json(silent=True) or {}
    program = data.get("program") or None
    if program and program not in PROGRAMS:
        abort(400, "Invalid program")
    key = program or "all"
    if not data.get("regenerate") and (hit := _cached("summary", key)):
        return jsonify({**hit.payload, "cached": True})
    return jsonify(_store("summary", key, ai_agent.program_summary(program)))


@bp.post("/risk-brief/<int:user_id>")
def risk_brief(user_id):
    admin = require_admin()
    user = db.session.get(User, user_id) or abort(404, "User not found")
    if user.role != "participant":
        abort(400, "Risk briefs are for participants")
    data = request.get_json(silent=True) or {}
    key = str(user_id)
    if not data.get("regenerate") and (hit := _cached("risk_brief", key)):
        return jsonify({**hit.payload, "cached": True})
    # The brief reads this person's anonymous activity too, so record it in the audit log.
    db.session.add(RevealLog(target_type="risk_brief", target_id=user_id, admin_id=admin.id,
                             reason="AI risk brief generated (uses the participant's anonymous activity)"))
    db.session.commit()
    return jsonify(_store("risk_brief", key, ai_agent.risk_brief(user)))


@bp.post("/ask")
def ask():
    require_admin()
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question or len(question) > 1000:
        abort(400, "question is required (max 1000 chars)")
    program = data.get("program") or None
    if program and program not in PROGRAMS:
        abort(400, "Invalid program")
    history = data.get("history") if isinstance(data.get("history"), list) else []
    return jsonify(ai_agent.ask(question, history, program))
