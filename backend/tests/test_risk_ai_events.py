from services.ai_agent import AskAnswer, ProgramSummary, RiskBrief
from tests.conftest import ADMIN, ALEX, MARCUS, as_user


def test_seeded_personas_flagged(client):
    rows = client.get("/api/admin/at-risk", headers=as_user(ADMIN)).get_json()
    by_name = {r["user"]["name"]: r for r in rows}
    for name in ("Zoe Tremblay", "Marcus Johnson", "Liam O'Connor"):
        assert by_name[name]["level"] == "high", name
    assert by_name["Priya Sharma"]["level"] in ("medium", "high")
    assert by_name["Alex Chen"]["level"] == "low"
    coop = client.get("/api/admin/at-risk?program=coop", headers=as_user(ADMIN)).get_json()
    assert {r["user"]["program"] for r in coop} == {"coop"}


def test_ai_fallback_schema_valid_without_key(client):
    s = client.post("/api/ai/summary", headers=as_user(ADMIN), json={}).get_json()
    assert s["source"] == "fallback"
    ProgramSummary.model_validate(s["data"])
    b = client.post(f"/api/ai/risk-brief/{MARCUS}", headers=as_user(ADMIN), json={}).get_json()
    RiskBrief.model_validate(b["data"])
    a = client.post("/api/ai/ask", headers=as_user(ADMIN), json={"question": "What are co-ops saying about return offers?"}).get_json()
    AskAnswer.model_validate(a["data"])
    assert a["data"]["cited_post_ids"]
    logs = client.get("/api/admin/reveals", headers=as_user(ADMIN)).get_json()
    assert any(l["target_type"] == "risk_brief" for l in logs)


def test_events_create_join_leave(client):
    r = client.post("/api/events", headers=as_user(ALEX), json={"title": "Board games", "starts_at": "2030-01-01T18:00", "capacity": 2})
    assert r.status_code == 201
    ev = r.get_json()
    assert ev["attending"] and ev["attendee_count"] == 1
    j = client.post(f"/api/events/{ev['id']}/rsvp", headers=as_user(MARCUS)).get_json()
    assert j["attendee_count"] == 2
    assert client.post(f"/api/events/{ev['id']}/rsvp", headers=as_user(ADMIN)).status_code == 400  # full
    left = client.delete(f"/api/events/{ev['id']}/rsvp", headers=as_user(MARCUS)).get_json()
    assert left["attendee_count"] == 1 and not left["attending"]


def test_concerning_posts(client):
    rows = client.get("/api/admin/concerning?days=90", headers=as_user(ADMIN)).get_json()
    assert rows and all(r["sentiment"] <= -0.25 or r["risk_keywords"] for r in rows)
    assert [r["sentiment"] for r in rows] == sorted(r["sentiment"] for r in rows)
    assert all(r["author"] is None for r in rows if r["anonymity"] == "anonymous")
    coop = client.get("/api/admin/concerning?days=90&program=coop", headers=as_user(ADMIN)).get_json()
    assert {r["program"] for r in coop} == {"coop"}
    assert client.get("/api/admin/concerning?days=5", headers=as_user(ADMIN)).status_code == 400
    assert client.get("/api/admin/concerning", headers=as_user(ALEX)).status_code == 403
