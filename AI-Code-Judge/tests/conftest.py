"""
conftest.py — Pytest fixtures shared across all tests.
"""
import pytest

from backend.config import TestingConfig
from backend.app import create_app
from database.database import db as _db

# Session-level cache so `registered_user` registers the same user only once.
# The app/database fixtures are session-scoped (shared across tests); without
# this cache, a second registration attempt would return 409 and yield an
# empty token.
_REGISTERED_USERS = {}


@pytest.fixture(scope="session")
def app():
    """Create an application instance configured for testing."""
    application = create_app(TestingConfig())
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture(scope="function")
def db(app):
    """Yield the database session; roll back after each test."""
    with app.app_context():
        yield _db
        _db.session.rollback()


@pytest.fixture
def registered_user(client):
    """Register a fixed test user once per session and return the response data.

    Idempotent across tests: the app/database fixtures are session-scoped
    (shared across tests), so a second registration of the same credentials
    would return 409 with no token.
    """
    if "test@example.com" in _REGISTERED_USERS:
        return _REGISTERED_USERS["test@example.com"]
    res = client.post("/api/auth/register", json={
        "username":   "testuser",
        "email":      "test@example.com",
        "password":   "password123",
        "first_name": "Test",
    })
    data = res.get_json()
    _REGISTERED_USERS["test@example.com"] = data
    return data


@pytest.fixture
def auth_headers(registered_user):
    """Return Authorization headers for the registered test user."""
    token = registered_user.get("token", "")
    return {"Authorization": f"Bearer {token}"}
