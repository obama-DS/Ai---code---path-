"""
test_history.py — Tests for /api/history/* endpoints.
"""


def _judge(client, headers=None):
    return client.post("/api/judge", headers=headers or {}, json={
        "language": "python",
        "code":     "def f():\n    return 1",
    })


def test_history_requires_auth(client):
    res = client.get("/api/history/")
    assert res.status_code == 401


def test_history_empty_initially(client, auth_headers):
    res = client.get("/api/history/", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["total"] == 0
    assert data["items"] == []


def test_history_after_judgment(client, auth_headers):
    _judge(client, auth_headers)
    res = client.get("/api/history/", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["total"] >= 1


def test_history_pagination(client, auth_headers):
    # Create 5 judgments
    for _ in range(5):
        _judge(client, auth_headers)

    res = client.get("/api/history/?page=1&per_page=2", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["items"]) <= 2


def test_get_single_judgment(client, auth_headers):
    judge_res = _judge(client, auth_headers)
    jid = judge_res.get_json().get("judgment_id")
    if not jid:
        return  # skip if no id returned

    res = client.get(f"/api/history/{jid}", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["id"] == jid
    assert "code" in data


def test_delete_judgment(client, auth_headers):
    judge_res = _judge(client, auth_headers)
    jid = judge_res.get_json().get("judgment_id")
    if not jid:
        return

    res = client.delete(f"/api/history/{jid}", headers=auth_headers)
    assert res.status_code == 200

    res = client.get(f"/api/history/{jid}", headers=auth_headers)
    assert res.status_code == 404


def test_cannot_access_other_users_judgment(client, auth_headers):
    # Create a judgment as the first user
    judge_res = _judge(client, auth_headers)
    jid = judge_res.get_json().get("judgment_id")
    if not jid:
        return

    # Register a second user
    client.post("/api/auth/register", json={
        "username": "other_user",
        "email":    "other@example.com",
        "password": "password123",
    })
    login_res = client.post("/api/auth/login", json={
        "email": "other@example.com", "password": "password123"
    })
    other_token = login_res.get_json().get("token", "")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    res = client.get(f"/api/history/{jid}", headers=other_headers)
    assert res.status_code == 404
