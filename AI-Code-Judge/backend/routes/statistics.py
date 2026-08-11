"""
routes/statistics.py — Aggregated stats for the dashboard.
"""
from collections import Counter

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.models.judgment import Judgment

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/", strict_slashes=False)
@jwt_required()
def get_stats():
    user_id   = int(get_jwt_identity())
    judgments = (
        Judgment.query
        .filter_by(user_id=user_id)
        .order_by(Judgment.created_at.asc())
        .all()
    )

    if not judgments:
        return jsonify({
            "total":             0,
            "average_score":     None,
            "best_score":        None,
            "worst_score":       None,
            "languages":         {},
            "common_problems":   [],
            "score_history":     [],
            "category_averages": {},
        }), 200

    scores = [j.score for j in judgments]

    # Language breakdown
    lang_counter = Counter(j.language for j in judgments)

    # Aggregate issue titles and category scores
    problem_counter: Counter = Counter()
    security_total    = 0
    bugs_total        = 0
    suggestions_total = 0
    cat_sums = {
        "quality": 0, "readability": 0, "security": 0,
        "performance": 0, "maintainability": 0, "bug_risk": 0,
    }
    cat_counts = {k: 0 for k in cat_sums}

    for j in judgments:
        result = j.result
        for issue in result.get("bugs", []):
            problem_counter[issue.get("title", "Unknown")] += 1
            bugs_total += 1
        for issue in result.get("security_issues", []):
            problem_counter[issue.get("title", "Unknown")] += 1
            security_total += 1
        suggestions_total += len(result.get("suggestions", []))
        s = result.get("scores", {})
        for key in cat_sums:
            if key in s:
                cat_sums[key]   += s[key]
                cat_counts[key] += 1

    category_averages = {
        k: round(cat_sums[k] / cat_counts[k], 1) if cat_counts[k] else 0
        for k in cat_sums
    }

    # Score history for chart (newest last)
    score_history = [
        {
            "score":      j.score,
            "language":   j.language,
            "created_at": j.created_at.isoformat(),
        }
        for j in judgments
    ]

    return jsonify({
        "total":             len(judgments),
        "average_score":     round(sum(scores) / len(scores)),
        "best_score":        max(scores),
        "worst_score":       min(scores),
        "languages":         dict(lang_counter.most_common()),
        "common_problems":   [
            {"title": t, "count": c}
            for t, c in problem_counter.most_common(10)
        ],
        "score_history":     score_history,
        "category_averages": category_averages,
        "security_total":    security_total,
        "bugs_total":        bugs_total,
        "suggestions_total": suggestions_total,
    }), 200
