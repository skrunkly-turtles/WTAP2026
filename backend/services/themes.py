"""Keyword-based theme tagging and risk-keyword detection.

Kept deliberately simple and transparent so HR can see *why* something was tagged.
Gemini does the nuanced reading on top of this.
"""
import re

THEMES: dict[str, list[str]] = {
    "return_offers": ["return offer", "full-time offer", "full time offer", "conversion", "convert to full", "offer decision", "headcount"],
    "workload": ["workload", "overtime", "late night", "weekend", "too much work", "overwhelmed", "burnout", "burned out", "burnt out", "exhausted", "long hours", "on-call", "on call"],
    "manager_support": ["manager", "1:1", "one-on-one", "one on one", "feedback", "mentor", "supervisor", "check-in", "check in"],
    "onboarding": ["onboarding", "access request", "laptop", "setup", "set up", "permissions", "training", "documentation", "first week", "credentials"],
    "compensation": ["pay", "salary", "compensation", "bonus", "housing", "stipend", "relocation", "cost of living"],
    "belonging": ["lonely", "isolated", "included", "belong", "remote", "culture", "community", "social", "friends", "connect"],
    "growth": ["growth", "learning", "career", "promotion", "impact", "meaningful", "skills", "rotation", "development"],
}

THEME_LABELS = {
    "return_offers": "Return offers",
    "workload": "Workload & burnout",
    "manager_support": "Manager support",
    "onboarding": "Onboarding & access",
    "compensation": "Compensation",
    "belonging": "Belonging & connection",
    "growth": "Growth & development",
}

# Phrase -> weight. Weights feed services.risk; tune here.
RISK_KEYWORDS: dict[str, int] = {
    "quit": 25,
    "quitting": 25,
    "resign": 25,
    "leaving": 18,
    "leave the company": 25,
    "other offer": 25,
    "another offer": 25,
    "competing offer": 25,
    "interviewing": 20,
    "job hunting": 20,
    "final rounds": 20,
    "another bank": 15,
    "other options": 12,
    "accepted an interview": 20,
    "looking elsewhere": 20,
    "not coming back": 25,
    "won't come back": 25,
    "decline the return offer": 25,
    "burnout": 15,
    "burned out": 15,
    "burnt out": 15,
    "not valued": 15,
    "undervalued": 15,
    "no growth": 12,
    "dead end": 12,
    "miserable": 12,
    "unhappy": 10,
    "regret": 10,
    "exhausted": 10,
    "overwhelmed": 8,
    "isolated": 8,
    "invisible": 8,
}

_NEGATORS = {"not", "never", "no", "don't", "dont", "isn't", "wasn't", "won't", "without"}


def _phrase_re(phrase: str, plural: bool = False) -> re.Pattern:
    suffix = r"s?" if plural else ""
    return re.compile(r"(?<![\w])" + re.escape(phrase) + suffix + r"(?![\w])", re.IGNORECASE)


_THEME_RES = {t: [_phrase_re(p, plural=True) for p in ps] for t, ps in THEMES.items()}
_RISK_RES = {k: _phrase_re(k) for k in RISK_KEYWORDS}


def tag_themes(text: str) -> list[str]:
    return [t for t, pats in _THEME_RES.items() if any(p.search(text or "") for p in pats)]


def _negated(text: str, start: int) -> bool:
    preceding = re.findall(r"[\w']+", text[max(0, start - 40):start].lower())[-3:]
    return any(w in _NEGATORS for w in preceding)


def find_risk_keywords(text: str) -> list[str]:
    """Risk phrases present in text, skipping simple negations ("not leaving")."""
    found = []
    for kw, pat in _RISK_RES.items():
        for m in pat.finditer(text or ""):
            # Keywords that already contain a negation ("not valued") are never negated away.
            if kw.split()[0] in _NEGATORS or not _negated(text, m.start()):
                found.append(kw)
                break
    return found
