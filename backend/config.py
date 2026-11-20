import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'rbconnect.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    # Tried in order if the primary model is overloaded (503), times out, or is retired (404).
    GEMINI_FALLBACK_MODELS = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-3.8-flash").split(",") if m.strip()]
    GEMINI_TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "45"))
    # "Today" for the demo. Seed data is anchored to this date so risk windows stay meaningful.
    DEMO_NOW = os.getenv("DEMO_NOW", "")
