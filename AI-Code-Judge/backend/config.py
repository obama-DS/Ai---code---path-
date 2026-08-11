"""
config.py — Flask application configuration.
Reads from environment variables (loaded from .env by python-dotenv).
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_db_uri(uri: str) -> str:
    """
    Resolve relative sqlite:/// paths against the project base directory.

    Flask-SQLAlchemy 3.x resolves relative SQLite paths against
    ``app.instance_path`` instead of the working directory, which breaks
    ``DATABASE_URL=sqlite:///database/judge.db``. Normalising here makes the
    app start from any working directory.
    """
    prefix = "sqlite:///"
    if uri.startswith(prefix) and not uri.startswith("sqlite:////"):
        rel = uri[len(prefix):]
        if not Path(rel).is_absolute():
            return f"{prefix}{(BASE_DIR / rel).as_posix()}"
    return uri


class Config:
    """Base configuration shared by all environments."""

    # Flask
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JSON_SORT_KEYS: bool = False

    # Database
    SQLALCHEMY_DATABASE_URI: str = _resolve_db_uri(os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BASE_DIR / 'database' / 'judge.db').as_posix()}"
    ))
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES: int = 86400  # 24 hours

    # AI
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")
    AI_MODEL: str    = os.getenv("AI_MODEL", "gpt-4o-mini")
    OPENAI_API_KEY: str   = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))

    # CORS — allow all origins in development so file:// and any Live Server port work
    CORS_ORIGINS: list | str = os.getenv("CORS_ORIGINS", "*")

    # Code size limits
    MAX_CODE_SIZE: int = 50_000  # characters


class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = 300  # 5 min for tests


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    # Lock down CORS in production — override via env var
    CORS_ORIGINS: list = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000"
    ).split(",")


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing":     TestingConfig,
    "production":  ProductionConfig,
}


def get_config() -> Config:
    env = os.getenv("FLASK_ENV", "development")
    return CONFIG_MAP.get(env, DevelopmentConfig)()
