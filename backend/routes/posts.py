from flask import Blueprint, abort, jsonify, request
from sqlalchemy import or_

from models import Comment, Post, db
from routes.meta import CATEGORIES
from services.enrich import enrich
from services.identity import current_user
from services.serializers import comment_dict, post_dict, revealed_ids

bp = Blueprint("posts", __name__, url_prefix="/api/posts")

ANONYMITY = {"public", "anonymous"}
AUDIENCE = {"everyone", "admins_only"}


def visible_posts_query(viewer):
    q = Post.query
    if viewer.role != "admin":
        # Participants see everyone-posts plus their OWN admins-only posts.
        q = q.filter(or_(Post.audience == "everyone", Post.author_id == viewer.id))
    return q


def get_visible_post(post_id, viewer) -> Post:
    post = visible_posts_query(viewer).filter(Post.id == post_id).first()
    if post is None:
        abort(404, "Post not found")
    return post


@bp.get("")
def list_posts():
    viewer = current_user()
    q = visible_posts_query(viewer)
    if cat := request.args.get("category"):
        q = q.filter(Post.category == cat)
    if aud := request.args.get("audience"):
        q = q.filter(Post.audience == aud)
    if text := request.args.get("q"):
        like = f"%{text}%"
        q = q.filter(or_(Post.title.ilike(like), Post.body.ilike(like)))
    posts = q.order_by(Post.created_at.desc()).all()
    rp = revealed_ids("post")
    return jsonify([post_dict(p, viewer, revealed_posts=rp) for p in posts])


@bp.get("/<int:post_id>")
def get_post(post_id):
    viewer = current_user()
    return jsonify(post_dict(get_visible_post(post_id, viewer), viewer, with_comments=True))


def _clean(data, key, maxlen, required=True):
    val = (data.get(key) or "").strip()
    if required and not val:
        abort(400, f"'{key}' is required")
    if len(val) > maxlen:
        abort(400, f"'{key}' is too long")
    return val


@bp.post("")
def create_post():
    viewer = current_user()
    data = request.get_json(silent=True) or {}
    title = _clean(data, "title", 200)
    body = _clean(data, "body", 5000)
    category = data.get("category", "general")
    anonymity = data.get("anonymity", "public")
    audience = data.get("audience", "everyone")
    if category not in CATEGORIES or anonymity not in ANONYMITY or audience not in AUDIENCE:
        abort(400, "Invalid category, anonymity or audience")
    post = Post(author_id=viewer.id, title=title, body=body, category=category, anonymity=anonymity, audience=audience)
    enrich(post, f"{title}. {body}")
    db.session.add(post)
    db.session.commit()
    return jsonify(post_dict(post, viewer, with_comments=True)), 201


@bp.post("/<int:post_id>/comments")
def add_comment(post_id):
    viewer = current_user()
    post = get_visible_post(post_id, viewer)
    # Admins-only posts are private threads between the author and HR/admins.
    if post.audience == "admins_only" and viewer.role != "admin" and post.author_id != viewer.id:
        abort(403)
    data = request.get_json(silent=True) or {}
    body = _clean(data, "body", 3000)
    anonymity = data.get("anonymity", "public")
    if anonymity not in ANONYMITY:
        abort(400, "Invalid anonymity")
    c = Comment(post=post, author_id=viewer.id, body=body, anonymity=anonymity)
    enrich(c, body)
    db.session.add(c)
    db.session.commit()
    return jsonify(comment_dict(c, viewer)), 201


@bp.post("/<int:post_id>/upvote")
def upvote(post_id):
    viewer = current_user()
    post = get_visible_post(post_id, viewer)
    post.upvotes = (post.upvotes or 0) + 1
    db.session.commit()
    return jsonify(upvotes=post.upvotes)
