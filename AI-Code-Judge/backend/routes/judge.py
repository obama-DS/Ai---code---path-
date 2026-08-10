"""
routes/judge.py — POST /api/judge  (the core endpoint)
"""
from flask import Blueprint, request, jsonify

from database.database import db
from backend.models.judgment import Judgment
from backend.utils.validators import validate_judge_request
from backend.utils.security import sanitize_code, jwt_required_optional
from ai.judge import judge_code

judge_bp = Blueprint("judge", __name__)


@judge_bp.post("/judge")
@jwt_required_optional
def judge():
    data   = request.get_json(silent=True) or {}
    errors = validate_judge_request(data)
    if errors:
        return jsonify({"error": errors[0]}), 400

    language    = data["language"].lower().strip()
    code        = sanitize_code(data["code"])
    personality = data.get("personality", "friendly")

    # Run the full pipeline
    result = judge_code(language, code, personality)

    # Persist to DB (user_id may be None for unauthenticated requests)
    user = getattr(request, "current_user", None)
    judgment = Judgment(
        user_id     = user.id if user else None,
        language    = language,
        code        = code,
        score       = result["overall_score"],
        personality = personality,
    )
    judgment.result = result
    db.session.add(judgment)
    db.session.commit()

    result["judgment_id"] = judgment.id
    return jsonify(result), 200
