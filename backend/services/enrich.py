from services.sentiment import score
from services.themes import find_risk_keywords, tag_themes


def enrich(item, text: str):
    """Compute sentiment/themes/risk keywords on write."""
    item.sentiment = score(text)
    item.themes = tag_themes(text)
    item.risk_keywords = find_risk_keywords(text)
    return item
