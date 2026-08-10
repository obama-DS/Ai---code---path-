"""
routes/github.py — GitHub repository analysis endpoint.
"""
from flask import Blueprint, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from backend.services.github_service import analyse_repo

github_bp = Blueprint("github", __name__)


@github_bp.post("/analyse")
def analyse():
    data    = request.get_json(silent=True) or {}
    repo_url = data.get("url", "").strip()

    if not repo_url:
        return jsonify({"error": "url is required."}), 400

    try:
        result = analyse_repo(repo_url)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
