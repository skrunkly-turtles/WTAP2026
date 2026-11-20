import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402
from models import db  # noqa: E402
from seed_loader import seed  # noqa: E402

ADMIN, PRIYA, ALEX, MARCUS = 1, 5, 4, 22


@pytest.fixture()
def app(tmp_path):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 't.db'}", "GEMINI_API_KEY": ""})
    with app.app_context():
        seed(reset=True)
        yield app
        db.session.remove()


@pytest.fixture()
def client(app):
    return app.test_client()


def as_user(uid):
    return {"X-User-Id": str(uid)}
