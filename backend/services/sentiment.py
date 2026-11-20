"""Per-text sentiment using VADER (fast, offline, good on short informal text)."""
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def score(text: str) -> float:
    """Compound score in [-1, 1]."""
    if not text or not text.strip():
        return 0.0
    return round(_analyzer.polarity_scores(text)["compound"], 4)


def label(value: float) -> str:
    if value >= 0.25:
        return "positive"
    if value <= -0.25:
        return "negative"
    return "neutral"
