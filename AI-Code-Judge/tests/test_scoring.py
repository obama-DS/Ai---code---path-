"""
test_scoring.py — Unit tests for the static code analyzer and scoring engine.
"""
from backend.services.code_analyzer import analyze
from backend.services.scoring import calculate_scores


CLEAN_PYTHON = '''
def greet(name: str) -> str:
    """Return a greeting string."""
    if not isinstance(name, str):
        raise TypeError("name must be a string")
    return f"Hello, {name}!"
'''

DIRTY_PYTHON = '''
import os
password = "hunter2"
def f(x):
    eval(x)
    os.system(x)
    for i in range(100):
        for j in range(100):
            for k in range(100):
                print(i,j,k)
'''


# ── Analyzer tests ────────────────────────────────────────────────────────────

def test_analyze_clean_code():
    result = analyze(CLEAN_PYTHON, "python")
    high_issues = [i for i in result.issues if i.severity == "high"]
    assert len(high_issues) == 0


def test_analyze_detects_eval():
    result = analyze(DIRTY_PYTHON, "python")
    titles = [i.title for i in result.issues]
    assert any("eval" in t.lower() for t in titles)


def test_analyze_detects_os_system():
    result = analyze(DIRTY_PYTHON, "python")
    titles = [i.title for i in result.issues]
    assert any("os.system" in t.lower() for t in titles)


def test_analyze_detects_hardcoded_password():
    result = analyze(DIRTY_PYTHON, "python")
    titles = [i.title for i in result.issues]
    assert any("hardcoded" in t.lower() or "credential" in t.lower() for t in titles)


def test_analyze_metrics():
    result = analyze(CLEAN_PYTHON, "python")
    assert result.line_count > 0
    assert result.char_count > 0


def test_analyze_javascript():
    js_code = 'var x = 1;\nif (x == 1) { eval("alert(1)"); }'
    result = analyze(js_code, "javascript")
    titles = [i.title for i in result.issues]
    assert any("eval" in t.lower() for t in titles)
    assert any("var" in t.lower() for t in titles)


def test_analyze_todo_comment():
    code = "# TODO: fix this\nx = 1"
    result = analyze(code, "python")
    titles = [i.title for i in result.issues]
    assert any("TODO" in t for t in titles)


# ── Scoring tests ─────────────────────────────────────────────────────────────

def test_scores_structure():
    result = analyze(CLEAN_PYTHON, "python")
    scores = calculate_scores(result)
    assert "overall_score" in scores
    assert "scores" in scores
    for key in ("quality", "readability", "security", "performance", "maintainability", "bug_risk"):
        assert key in scores["scores"]


def test_clean_code_scores_higher():
    clean_result = analyze(CLEAN_PYTHON, "python")
    dirty_result = analyze(DIRTY_PYTHON, "python")
    clean_scores = calculate_scores(clean_result)
    dirty_scores = calculate_scores(dirty_result)
    assert clean_scores["overall_score"] > dirty_scores["overall_score"]


def test_scores_clamped():
    result = analyze(CLEAN_PYTHON, "python")
    scores = calculate_scores(result)
    assert 0 <= scores["overall_score"] <= 100
    for v in scores["scores"].values():
        assert 0 <= v <= 10


def test_security_score_penalised():
    result = analyze(DIRTY_PYTHON, "python")
    scores = calculate_scores(result)
    assert scores["scores"]["security"] < 5
