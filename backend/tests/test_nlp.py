from services.sentiment import score
from services.themes import find_risk_keywords, tag_themes


def test_vader_polarity():
    assert score("I love my team, this is amazing!") > 0.5
    assert score("I'm burned out, exhausted and miserable.") < -0.5
    assert score("") == 0.0


def test_themes():
    assert "return_offers" in tag_themes("When are return offer decisions made?")
    assert "workload" in tag_themes("Working weekends again")


def test_risk_keywords_and_negation():
    assert "other offer" in find_risk_keywords("I got an other offer from a fintech")
    assert "leaving" not in find_risk_keywords("I'm definitely not leaving, love it here")
    assert "not valued" in find_risk_keywords("I feel not valued")
    assert "leave the company" not in find_risk_keywords("I don't want to leave the company")
