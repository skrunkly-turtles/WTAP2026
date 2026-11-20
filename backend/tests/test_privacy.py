from models import Post, RevealLog
from tests.conftest import ADMIN, ALEX, PRIYA, as_user


def _anon_post(audience="everyone"):
    return Post.query.filter_by(anonymity="anonymous", audience=audience).first()


def test_anonymous_author_hidden_from_everyone(client):
    p = _anon_post()
    for uid in (ALEX, ADMIN):
        listing = client.get("/api/posts", headers=as_user(uid)).get_json()
        item = next(x for x in listing if x["id"] == p.id)
        assert item["author"] is None
        detail = client.get(f"/api/posts/{p.id}", headers=as_user(uid)).get_json()
        assert detail["author"] is None
        assert "author_id" not in detail
        assert all(c["author"] is None for c in detail["comments"] if c["anonymity"] == "anonymous")


def test_admins_only_hidden_from_other_participants(client):
    p = _anon_post("admins_only")
    assert p.author_id != ALEX
    ids = [x["id"] for x in client.get("/api/posts", headers=as_user(ALEX)).get_json()]
    assert p.id not in ids
    assert client.get(f"/api/posts/{p.id}", headers=as_user(ALEX)).status_code == 404
    assert client.post(f"/api/posts/{p.id}/comments", headers=as_user(ALEX), json={"body": "hi"}).status_code == 404
    # Author and admins can see it.
    author_ids = [x["id"] for x in client.get("/api/posts", headers=as_user(p.author_id)).get_json()]
    assert p.id in author_ids
    assert client.get(f"/api/posts/{p.id}", headers=as_user(ADMIN)).status_code == 200


def test_create_admins_only_post_and_reply(client):
    r = client.post("/api/posts", headers=as_user(ALEX), json={
        "title": "Private concern", "body": "Something private", "category": "general",
        "anonymity": "anonymous", "audience": "admins_only"})
    assert r.status_code == 201
    pid = r.get_json()["id"]
    assert client.get(f"/api/posts/{pid}", headers=as_user(PRIYA)).status_code == 404
    assert client.post(f"/api/posts/{pid}/comments", headers=as_user(ALEX), json={"body": "more"}).status_code == 201
    assert client.post(f"/api/posts/{pid}/comments", headers=as_user(ADMIN), json={"body": "HR here"}).status_code == 201


def test_reveal_requires_admin_and_reason_and_logs(client):
    p = _anon_post()
    body = {"target_type": "post", "target_id": p.id, "reason": "Wellbeing concern, need to reach out"}
    assert client.post("/api/admin/reveal", headers=as_user(ALEX), json=body).status_code == 403
    assert client.post("/api/admin/reveal", headers=as_user(ADMIN), json={**body, "reason": "x"}).status_code == 400
    r = client.post("/api/admin/reveal", headers=as_user(ADMIN), json=body)
    assert r.status_code == 200 and r.get_json()["author"]["id"] == p.author_id
    assert RevealLog.query.filter_by(target_type="post", target_id=p.id).count() == 1
    # Revealed author now visible to admins, still hidden from participants.
    assert client.get(f"/api/posts/{p.id}", headers=as_user(ADMIN)).get_json()["author"]["id"] == p.author_id
    assert client.get(f"/api/posts/{p.id}", headers=as_user(ALEX)).get_json()["author"] is None


def test_profile_masks_anonymous_content_until_revealed(client):
    detail = client.get(f"/api/admin/users/{PRIYA}", headers=as_user(ADMIN)).get_json()
    masked = [a for a in detail["activity"] if a.get("masked")]
    assert masked and all("body" not in a for a in masked)


def test_admin_endpoints_forbidden_for_participants(client):
    for url in ("/api/admin/overview", "/api/admin/at-risk", "/api/admin/reveals"):
        assert client.get(url, headers=as_user(ALEX)).status_code == 403
    assert client.post("/api/ai/summary", headers=as_user(ALEX), json={}).status_code == 403
