"""
utils/security.py — Security helpers: input sanitisation and auth guards.
"""
import re
from functools import wraps

from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from backend.models.user import User


def sanitize_code(code: str, max_size: int = 50_000) -> str:
    """Strip null bytes and enforce a max size limit."""
    code = code.replace("\x00", "")
    return code[:max_size]


def jwt_required_optional(f):
    """
    Decorator: attach the current user to the request if a valid JWT is present.
    Does NOT block unauthenticated requests — user will simply be None.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            request.current_user = User.query.get(user_id) if user_id else None
        except Exception:
            request.current_user = None
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    """Decorator: blocks the route unless the caller is an admin user."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_admin:
                return jsonify({"error": "Admin access required"}), 403
            request.current_user = user
        except Exception:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper
