"""
utils/validators.py — Request payload validation helpers.
"""
import re


SUPPORTED_LANGUAGES = {
    "python", "javascript", "typescript", "java",
    "cpp", "csharp", "go", "rust", "php", "ruby",
}

PERSONALITIES = {"friendly", "professional", "brutal", "hacker"}


def validate_judge_request(data: dict) -> list[str]:
    """Return a list of error strings (empty = valid)."""
    errors = []

    code = data.get("code", "")
    if not code or not code.strip():
        errors.append("code is required and cannot be empty.")
    elif len(code) > 50_000:
        errors.append("code exceeds maximum size of 50,000 characters.")

    language = data.get("language", "")
    if not language:
        errors.append("language is required.")
    elif language.lower() not in SUPPORTED_LANGUAGES:
        errors.append(f"Unsupported language '{language}'. Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}")

    personality = data.get("personality", "friendly")
    if personality not in PERSONALITIES:
        errors.append(f"Invalid personality '{personality}'. Choose from: {', '.join(PERSONALITIES)}")

    return errors


def validate_register_request(data: dict) -> list[str]:
    errors = []

    username = data.get("username", "").strip()
    if not username:
        errors.append("username is required.")
    elif not re.match(r'^[a-zA-Z0-9_]{3,32}$', username):
        errors.append("username must be 3–32 characters and contain only letters, numbers, or underscores.")

    email = data.get("email", "").strip()
    if not email:
        errors.append("email is required.")
    elif not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        errors.append("email is not valid.")

    password = data.get("password", "")
    if not password:
        errors.append("password is required.")
    elif len(password) < 8:
        errors.append("password must be at least 8 characters.")

    return errors


def validate_login_request(data: dict) -> list[str]:
    errors = []
    if not data.get("email", "").strip():
        errors.append("email is required.")
    if not data.get("password", ""):
        errors.append("password is required.")
    return errors
