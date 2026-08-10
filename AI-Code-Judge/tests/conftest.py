"""
conftest.py — Pytest fixtures shared across all tests.
"""
import pytest

from backend.config import TestingConfig
from backend.app import create_app
from database.database import db as _db


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
    """Register a test user and return the response data."""
    res = client.post("/api/auth/register", json={
        "username":   "testuser",
        "email":      "test@example.com",
        "password":   "password123",
        "first_name": "Test",
    })
    return res.get_json()


@pytest.fixture
def auth_headers(registered_user):
    """Return Authorization headers for the registered test user."""
    token = registered_user.get("token", "")
    return {"Authorization": f"Bearer {token}"}
