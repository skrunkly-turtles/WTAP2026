from datetime import datetime

from flask import Blueprint, abort, jsonify, request

from models import Event, EventRSVP, db
from services.identity import current_user
from services.serializers import event_dict

bp = Blueprint("events", __name__, url_prefix="/api/events")


@bp.get("")
def list_events():
    viewer = current_user()
    events = Event.query.order_by(Event.starts_at).all()
    return jsonify([event_dict(e, viewer) for e in events])


@bp.post("")
def create_event():
    viewer = current_user()
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title or len(title) > 200:
        abort(400, "Title is required (max 200 chars)")
    try:
        starts_at = datetime.fromisoformat(data["starts_at"]).replace(tzinfo=None)
    except (KeyError, TypeError, ValueError):
        abort(400, "starts_at must be an ISO datetime")
    capacity = data.get("capacity")
    if capacity in ("", None):
        capacity = None
    elif not isinstance(capacity, int) or capacity < 1:
        abort(400, "capacity must be a positive integer")
    ev = Event(title=title, description=(data.get("description") or "").strip()[:3000],
               location=(data.get("location") or "").strip()[:200], starts_at=starts_at,
               capacity=capacity, creator_id=viewer.id)
    db.session.add(ev)
    db.session.flush()
    db.session.add(EventRSVP(event_id=ev.id, user_id=viewer.id))  # creator attends
    db.session.commit()
    return jsonify(event_dict(ev, viewer)), 201


@bp.post("/<int:event_id>/rsvp")
def join(event_id):
    viewer = current_user()
    ev = db.session.get(Event, event_id) or abort(404, "Event not found")
    if not db.session.get(EventRSVP, (event_id, viewer.id)):
        if ev.capacity and len(ev.rsvps) >= ev.capacity:
            abort(400, "Event is full")
        db.session.add(EventRSVP(event_id=event_id, user_id=viewer.id))
        db.session.commit()
    db.session.refresh(ev)
    return jsonify(event_dict(ev, viewer))


@bp.delete("/<int:event_id>/rsvp")
def leave(event_id):
    viewer = current_user()
    ev = db.session.get(Event, event_id) or abort(404, "Event not found")
    rsvp = db.session.get(EventRSVP, (event_id, viewer.id))
    if rsvp:
        db.session.delete(rsvp)
        db.session.commit()
    db.session.refresh(ev)
    return jsonify(event_dict(ev, viewer))
