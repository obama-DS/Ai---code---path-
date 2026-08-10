"""
routes/auth.py — Register, login, logout, and current-user endpoints.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)

from database.database import db
from backend.models.user import User
from backend.utils.validators import validate_register_request, validate_login_request

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data   = request.get_json(silent=True) or {}
    errors = validate_register_request(data)
    if errors:
        return jsonify({"error": errors[0]}), 400

    username = data["username"].strip()
    email    = data["email"].strip().lower()

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists."}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "That username is already taken."}), 409

    user = User(
        username   = username,
        email      = email,
        first_name = data.get("first_name", "").strip() or None,
    )
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 201


@auth_bp.post("/login")
def login():
    data   = request.get_json(silent=True) or {}
    errors = validate_login_request(data)
    if errors:
        return jsonify({"error": errors[0]}), 400

    email = data["email"].strip().lower()
    user  = User.query.filter_by(email=email).first()

    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid email or password."}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # JWT is stateless; client should discard the token.
    return jsonify({"message": "Logged out successfully."}), 200
