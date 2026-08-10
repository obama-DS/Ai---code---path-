"""
test_auth.py — Tests for /api/auth/* endpoints.
"""


def test_register_success(client):
    res = client.post("/api/auth/register", json={
        "username": "alice",
        "email":    "alice@example.com",
        "password": "securepass1",
    })
    assert res.status_code == 201
    data = res.get_json()
    assert "token" in data
    assert data["user"]["username"] == "alice"


def test_register_duplicate_email(client):
    payload = {"username": "bob", "email": "bob@example.com", "password": "pass1234"}
    client.post("/api/auth/register", json=payload)
    res = client.post("/api/auth/register", json={**payload, "username": "bob2"})
    assert res.status_code == 409


def test_register_duplicate_username(client):
    payload = {"username": "carol", "email": "carol@example.com", "password": "pass1234"}
    client.post("/api/auth/register", json=payload)
    res = client.post("/api/auth/register", json={**payload, "email": "carol2@example.com"})
    assert res.status_code == 409


def test_register_missing_fields(client):
    res = client.post("/api/auth/register", json={"username": "dave"})
    assert res.status_code == 400


def test_register_short_password(client):
    res = client.post("/api/auth/register", json={
        "username": "eve", "email": "eve@example.com", "password": "short"
    })
    assert res.status_code == 400


def test_login_success(client, registered_user):
    res = client.post("/api/auth/login", json={
        "email": "test@example.com", "password": "password123"
    })
    assert res.status_code == 200
    assert "token" in res.get_json()


def test_login_wrong_password(client, registered_user):
    res = client.post("/api/auth/login", json={
        "email": "test@example.com", "password": "wrongpassword"
    })
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post("/api/auth/login", json={
        "email": "nobody@example.com", "password": "password123"
    })
    assert res.status_code == 401


def test_me_authenticated(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["user"]["email"] == "test@example.com"


def test_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401
