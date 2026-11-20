import hashlib

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


@bp.get("/risk-brief/<int:user_id>")
def saved_risk_brief(user_id):
    """Return the saved brief for this participant without generating one (null if none yet)."""
    require_admin()
    hit = _cached("risk_brief", str(user_id))
    return jsonify({**hit.payload, "cached": True} if hit else None)


CHAT_LIMIT = 50  # messages kept per admin


def _normalize(q: str) -> str:
    return " ".join(q.lower().split()).rstrip("?!. ")


def _chat_row(admin_id: int) -> AIInsight | None:
    return _cached("chat", str(admin_id))


def _chat_messages(admin_id: int) -> list[dict]:
    row = _chat_row(admin_id)
    return list(row.payload.get("messages", [])) if row else []


def _save_chat(admin_id: int, messages: list[dict]):
    row = _chat_row(admin_id)
    payload = {"messages": messages[-CHAT_LIMIT:]}
    if row:
        row.payload = payload  # reassign so SQLAlchemy sees the JSON change
    else:
        db.session.add(AIInsight(kind="chat", scope_key=str(admin_id), payload=payload))
    db.session.commit()


@bp.get("/chat")
def get_chat():
    """This admin's saved Insights Agent conversation."""
    admin = require_admin()
    return jsonify(messages=_chat_messages(admin.id))


@bp.delete("/chat")
def clear_chat():
    admin = require_admin()
    AIInsight.query.filter_by(kind="chat", scope_key=str(admin.id)).delete()
    db.session.commit()
    return jsonify(messages=[])


@bp.post("/ask")
def ask():
    admin = require_admin()
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question or len(question) > 1000:
        abort(400, "question is required (max 1000 chars)")
    program = data.get("program") or None
    if program and program not in PROGRAMS:
        abort(400, "Invalid program")

    messages = _chat_messages(admin.id)
    history = [{"role": m["role"], "content": m["content"]} for m in messages]

    # A question asked at the start of a conversation doesn't depend on earlier turns, so a saved
    # Gemini answer to the same question can be reused. Follow-ups always go to Gemini.
    answer_key = hashlib.sha1(f"{program or 'all'}|{_normalize(question)}".encode()).hexdigest()
    hit = None if history else _cached("ask", answer_key)
    if hit:
        result = {**hit.payload, "cached": True}
    else:
        result = ai_agent.ask(question, history, program)
        if not history:
            _store("ask", answer_key, result)

    messages += [
        {"role": "user", "content": question},
        {"role": "assistant", "content": result["data"]["answer"], "data": result["data"],
         "source": result["source"], "reason": result.get("fallback_reason"), "cached": bool(hit)},
    ]
    _save_chat(admin.id, messages)
    return jsonify(result)
