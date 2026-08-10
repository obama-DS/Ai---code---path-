"""
app.py — Flask application factory and entry point.

Run:
    python backend/app.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env before anything else
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

from backend.config import get_config
from database.database import db, init_db


def create_app(config=None) -> Flask:
    """Application factory."""
    app = Flask(__name__, static_folder=None)

    # ── Configuration ────────────────────────────────────────────────────────
    cfg = config or get_config()
    app.config.from_object(cfg)

    # ── Extensions ───────────────────────────────────────────────────────────
    cors_origins = cfg.CORS_ORIGINS
    CORS(app, origins=cors_origins, supports_credentials=(cors_origins != "*"))
    JWTManager(app)
    Limiter(
        get_remote_address,
        app=app,
        default_limits=[f"{cfg.RATE_LIMIT_PER_MINUTE} per minute"],
        storage_uri="memory://",
    )

    # ── Database ─────────────────────────────────────────────────────────────
    db.init_app(app)
    Migrate(app, db)
    with app.app_context():
        init_db(app)

    # ── Blueprints ───────────────────────────────────────────────────────────
    from backend.routes.judge      import judge_bp
    from backend.routes.auth       import auth_bp
    from backend.routes.history    import history_bp
    from backend.routes.statistics import stats_bp
    from backend.routes.github     import github_bp
    from backend.routes.admin      import admin_bp

    app.register_blueprint(judge_bp,   url_prefix="/api")
    app.register_blueprint(auth_bp,    url_prefix="/api/auth")
    app.register_blueprint(history_bp, url_prefix="/api/history")
    app.register_blueprint(stats_bp,   url_prefix="/api/stats")
    app.register_blueprint(github_bp,  url_prefix="/api/github")
    app.register_blueprint(admin_bp,   url_prefix="/api/admin")

    # ── Core routes ──────────────────────────────────────────────────────────
    @app.route("/")
    def index():
        return jsonify({
            "name":    "AI Code Judge API",
            "version": "1.0.0",
            "status":  "running",
        })

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    # ── Error handlers ───────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Too many requests. Slow down."}), 429

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


# ── Entry point ───────────────────────────────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
