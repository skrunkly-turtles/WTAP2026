import click
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from models import db


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})
    db.init_app(app)

    from routes.admin import bp as admin_bp
    from routes.ai import bp as ai_bp
    from routes.events import bp as events_bp
    from routes.meta import bp as meta_bp
    from routes.posts import bp as posts_bp

    for bp in (meta_bp, posts_bp, events_bp, admin_bp, ai_bp):
        app.register_blueprint(bp)

    @app.errorhandler(400)
    @app.errorhandler(403)
    @app.errorhandler(404)
    def _err(e):
        return jsonify(error=e.description or e.name), e.code

    @app.cli.command("seed")
    @click.option("--reset", is_flag=True, help="Drop all tables and reload seed JSON.")
    def seed_cmd(reset):
        from seed_loader import seed

        click.echo("Seeded." if seed(reset=reset) else "DB already has data (use --reset).")

    with app.app_context():
        if not app.config.get("TESTING"):
            from seed_loader import seed

            seed()  # auto-create + seed on first run

    return app


app = create_app()

if __name__ == "__main__":
    app.run(port=5001, debug=True)
