"""
routes/history.py — Judgment history endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.database import db
from backend.models.judgment import Judgment

history_bp = Blueprint("history", __name__)


@history_bp.get("/")
@jwt_required()
def get_history():
    user_id  = get_jwt_identity()
    page     = request.args.get("page",     1,    type=int)
    per_page = request.args.get("per_page", 20,   type=int)
    language = request.args.get("language", None)

    query = Judgment.query.filter_by(user_id=user_id)
    if language:
        query = query.filter_by(language=language.lower())

    query    = query.order_by(Judgment.created_at.desc())
    paginated = query.paginate(page=page, per_page=min(per_page, 100), error_out=False)

    return jsonify({
        "items":       [j.to_dict(include_code=False) for j in paginated.items],
        "total":       paginated.total,
        "page":        paginated.page,
        "pages":       paginated.pages,
        "per_page":    paginated.per_page,
    }), 200


@history_bp.get("/<int:judgment_id>")
@jwt_required()
def get_judgment(judgment_id):
    user_id  = get_jwt_identity()
    judgment = Judgment.query.filter_by(id=judgment_id, user_id=user_id).first()
    if not judgment:
        return jsonify({"error": "Judgment not found"}), 404
    return jsonify(judgment.to_dict(include_code=True)), 200


@history_bp.delete("/<int:judgment_id>")
@jwt_required()
def delete_judgment(judgment_id):
    user_id  = get_jwt_identity()
    judgment = Judgment.query.filter_by(id=judgment_id, user_id=user_id).first()
    if not judgment:
        return jsonify({"error": "Judgment not found"}), 404
    db.session.delete(judgment)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@history_bp.post("/commit")
def record_commit():
    """Called by the auto-commit watcher after a git commit + judgment."""
    from backend.models.commit import Commit
    data = request.get_json(silent=True) or {}
    required = ("file_name", "commit_hash", "commit_message")
    if not all(data.get(k) for k in required):
        return jsonify({"error": f"Required fields: {', '.join(required)}"}), 400

    commit = Commit(
        user_id        = data.get("user_id"),
        file_name      = data["file_name"],
        commit_hash    = data["commit_hash"],
        commit_message = data["commit_message"],
        language       = data.get("language"),
        score          = data.get("score"),
        judgment_id    = data.get("judgment_id"),
    )
    db.session.add(commit)
    db.session.commit()
    return jsonify({"id": commit.id}), 201
