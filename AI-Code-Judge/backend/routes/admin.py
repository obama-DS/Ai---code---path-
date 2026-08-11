"""
routes/admin.py — Admin-only endpoints at /api/admin/*
Requires is_admin=True on the JWT user.
"""
from collections import Counter

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from database.database import db
from backend.models.user     import User
from backend.models.judgment import Judgment
from backend.models.commit   import Commit
from backend.utils.security  import admin_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/overview")
@admin_required
def overview():
    """High-level platform statistics."""
    total_users      = User.query.count()
    total_judgments  = Judgment.query.count()
    total_commits    = Commit.query.count()

    avg_score = db.session.query(func.avg(Judgment.score)).scalar()
    avg_score = round(float(avg_score), 1) if avg_score else None

    # Language popularity
    lang_rows = (
        db.session.query(Judgment.language, func.count(Judgment.id))
        .group_by(Judgment.language)
        .order_by(func.count(Judgment.id).desc())
        .all()
    )
    languages = {row[0]: row[1] for row in lang_rows}

    # Recent activity — last 10 judgments across all users
    recent = (
        Judgment.query
        .order_by(Judgment.created_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        "total_users":     total_users,
        "total_judgments": total_judgments,
        "total_commits":   total_commits,
        "average_score":   avg_score,
        "languages":       languages,
        "recent_activity": [j.to_dict(include_code=False) for j in recent],
    }), 200


@admin_bp.get("/users")
@admin_required
def list_users():
    """Paginated list of all users."""
    page     = request.args.get("page",     1,  type=int)
    per_page = request.args.get("per_page", 25, type=int)
    search   = request.args.get("q", "").strip()

    query = User.query
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    paginated = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=min(per_page, 100), error_out=False
    )

    # Attach judgment count per user
    items = []
    for user in paginated.items:
        d = user.to_dict()
        d["judgment_count"] = Judgment.query.filter_by(user_id=user.id).count()
        items.append(d)

    return jsonify({
        "items":    items,
        "total":    paginated.total,
        "page":     paginated.page,
        "pages":    paginated.pages,
    }), 200


@admin_bp.delete("/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    """Delete a user and all their data."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.is_admin:
        return jsonify({"error": "Cannot delete an admin account"}), 403
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"User {user.username} deleted"}), 200


@admin_bp.post("/users/<int:user_id>/make-admin")
@admin_required
def make_admin(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    user.is_admin = True
    db.session.commit()
    return jsonify({"message": f"{user.username} is now an admin"}), 200


@admin_bp.get("/judgments")
@admin_required
def list_judgments():
    """Paginated list of all judgments across all users."""
    page     = request.args.get("page",     1,  type=int)
    per_page = request.args.get("per_page", 25, type=int)

    paginated = (
        Judgment.query
        .order_by(Judgment.created_at.desc())
        .paginate(page=page, per_page=min(per_page, 100), error_out=False)
    )

    return jsonify({
        "items":  [j.to_dict(include_code=False) for j in paginated.items],
        "total":  paginated.total,
        "page":   paginated.page,
        "pages":  paginated.pages,
    }), 200
