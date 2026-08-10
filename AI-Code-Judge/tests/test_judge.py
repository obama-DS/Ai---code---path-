"""
test_judge.py — Tests for POST /api/judge.
The AI call is not made in tests; static fallback is used.
"""


PYTHON_SNIPPET = """
def add(a, b):
    return a + b

result = add(1, 2)
print(result)
"""

UNSAFE_PYTHON = """
import os
user_input = input()
eval(user_input)
os.system(user_input)
"""


def test_judge_basic(client):
    res = client.post("/api/judge", json={
        "language": "python",
        "code":     PYTHON_SNIPPET,
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "overall_score" in data
    assert 0 <= data["overall_score"] <= 100
    assert "scores" in data
    assert "verdict" in data
    assert "suggestions" in data


def test_judge_all_personalities(client):
    for p in ("friendly", "professional", "brutal", "hacker"):
        res = client.post("/api/judge", json={
            "language":    "python",
            "code":        PYTHON_SNIPPET,
            "personality": p,
        })
        assert res.status_code == 200


def test_judge_detects_security_issues(client):
    res = client.post("/api/judge", json={
        "language": "python",
        "code":     UNSAFE_PYTHON,
    })
    assert res.status_code == 200
    data = res.get_json()
    titles = [i["title"] for i in data.get("security_issues", [])]
    assert any("eval" in t.lower() for t in titles)


def test_judge_missing_code(client):
    res = client.post("/api/judge", json={"language": "python"})
    assert res.status_code == 400


def test_judge_missing_language(client):
    res = client.post("/api/judge", json={"code": PYTHON_SNIPPET})
    assert res.status_code == 400


def test_judge_unsupported_language(client):
    res = client.post("/api/judge", json={"language": "brainfuck", "code": "+++"})
    assert res.status_code == 400


def test_judge_code_too_large(client):
    res = client.post("/api/judge", json={
        "language": "python",
        "code":     "x = 1\n" * 10_001,
    })
    assert res.status_code == 400


def test_judge_saves_to_db(client, db, auth_headers):
    from backend.models.judgment import Judgment
    before = Judgment.query.count()
    client.post("/api/judge", headers=auth_headers, json={
        "language": "python",
        "code":     PYTHON_SNIPPET,
    })
    assert Judgment.query.count() == before + 1
