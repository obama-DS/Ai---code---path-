"""
scoring.py — Converts static analysis results into a 0-100 score.

Six categories, each 0-10, averaged and scaled to 100.
The AI layer may override or adjust these values with its own judgment.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services.code_analyzer import AnalysisResult


# ─── Category weights (must sum to 1.0) ──────────────────────────────────────

WEIGHTS = {
    "quality":         0.20,
    "readability":     0.15,
    "security":        0.20,
    "performance":     0.15,
    "maintainability": 0.20,
    "bug_risk":        0.10,
}


# ─── Severity penalty values ──────────────────────────────────────────────────

SEVERITY_PENALTY = {
    "high":   3.0,
    "medium": 1.5,
    "low":    0.5,
    "info":   0.1,
}


# ─── Public entry point ───────────────────────────────────────────────────────

def calculate_scores(result: "AnalysisResult") -> dict:
    """
    Given an AnalysisResult, return a dict with:
      - scores   : {quality, readability, security, performance, maintainability, bug_risk}  (each 0-10)
      - overall_score : int 0-100
    """
    scores = {
        "quality":         _score_quality(result),
        "readability":     _score_readability(result),
        "security":        _score_security(result),
        "performance":     _score_performance(result),
        "maintainability": _score_maintainability(result),
        "bug_risk":        _score_bug_risk(result),
    }

    # Clamp each to [0, 10]
    scores = {k: max(0, min(10, round(v, 1))) for k, v in scores.items()}

    # Weighted average → 0-100
    overall = sum(scores[cat] * WEIGHTS[cat] for cat in WEIGHTS) * 10
    overall = max(0, min(100, round(overall)))

    return {"scores": scores, "overall_score": overall}


# ─── Category scorers ─────────────────────────────────────────────────────────

def _score_quality(r: "AnalysisResult") -> float:
    """Start at 10 and deduct for quality issues."""
    score = 10.0
    quality_issues = [i for i in r.issues if i.category == "quality"]
    for issue in quality_issues:
        score -= SEVERITY_PENALTY.get(issue.severity, 0.5)
    # Bonus for having comments
    if r.has_comments:
        score += 0.5
    return score


def _score_readability(r: "AnalysisResult") -> float:
    score = 10.0
    # Penalise long average lines
    if r.avg_line_length > 100:
        score -= 2.0
    elif r.avg_line_length > 80:
        score -= 1.0
    # Penalise very long single lines
    if r.max_line_length > 150:
        score -= 1.5
    elif r.max_line_length > 120:
        score -= 0.5
    # Penalise deep nesting
    if r.max_nesting >= 6:
        score -= 2.5
    elif r.max_nesting >= 4:
        score -= 1.5
    elif r.max_nesting >= 3:
        score -= 0.5
    # Reward comments
    if r.has_comments:
        score += 0.5
    return score


def _score_security(r: "AnalysisResult") -> float:
    score = 10.0
    for issue in r.security_issues:
        score -= SEVERITY_PENALTY.get(issue.severity, 1.0)
    return score


def _score_performance(r: "AnalysisResult") -> float:
    score = 10.0
    perf_issues = [i for i in r.issues if i.category == "performance"]
    for issue in perf_issues:
        score -= SEVERITY_PENALTY.get(issue.severity, 0.5)
    # Large files are harder to optimise
    if r.line_count > 300:
        score -= 1.0
    return score


def _score_maintainability(r: "AnalysisResult") -> float:
    score = 10.0
    maint_issues = [i for i in r.issues if i.category == "maintainability"]
    for issue in maint_issues:
        score -= SEVERITY_PENALTY.get(issue.severity, 0.5)
    # No functions at all in a large file
    if r.line_count > 50 and r.function_count == 0:
        score -= 1.5
    return score


def _score_bug_risk(r: "AnalysisResult") -> float:
    score = 10.0
    bug_issues = [i for i in r.issues if i.category == "quality"]
    high_count = sum(1 for i in bug_issues if i.severity == "high")
    score -= high_count * 2.0
    med_count = sum(1 for i in bug_issues if i.severity == "medium")
    score -= med_count * 1.0
    return score
