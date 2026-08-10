"""
parser.py — Safely parse the AI's JSON response.
Falls back gracefully when the model returns malformed output.
"""
import json
import re
from typing import Any


# ─── Expected schema with defaults ───────────────────────────────────────────

_DEFAULTS: dict = {
    "overall_score": 50,
    "scores": {
        "quality":         5,
        "readability":     5,
        "security":        5,
        "performance":     5,
        "maintainability": 5,
        "bug_risk":        5,
    },
    "bugs":             [],
    "security_issues":  [],
    "suggestions":      [],
    "verdict":          "The AI did not return a structured response.",
}


def parse_ai_response(raw: str) -> dict:
    """
    Extract and validate the AI JSON from a raw string.
    Returns a well-formed result dict even if the AI output is broken.
    """
    data = _extract_json(raw)
    if data is None:
        return dict(_DEFAULTS)

    return _validate(data)


def _extract_json(raw: str) -> dict | None:
    """Try several strategies to pull JSON out of the raw string."""
    # 1. Direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown code fences  ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Find first { ... } block
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _validate(data: dict) -> dict:
    """Ensure all required keys exist and values are within valid ranges."""
    result = dict(_DEFAULTS)

    result["overall_score"] = _clamp(
        _int(data.get("overall_score"), 50), 0, 100
    )

    raw_scores = data.get("scores", {})
    if isinstance(raw_scores, dict):
        for key in result["scores"]:
            result["scores"][key] = _clamp(
                _int(raw_scores.get(key), 5), 0, 10
            )

    result["bugs"]            = _clean_issues(data.get("bugs", []))
    result["security_issues"] = _clean_issues(data.get("security_issues", []))
    result["suggestions"]     = _clean_list(data.get("suggestions", []))
    result["verdict"]         = str(data.get("verdict", _DEFAULTS["verdict"]))[:1000]

    return result


def _clean_issues(items: Any) -> list:
    if not isinstance(items, list):
        return []
    cleaned = []
    for item in items:
        if not isinstance(item, dict):
            continue
        cleaned.append({
            "title":       str(item.get("title", "Issue"))[:200],
            "description": str(item.get("description", ""))[:500],
            "severity":    _valid_severity(item.get("severity", "info")),
            "line":        item.get("line"),
        })
    return cleaned


def _clean_list(items: Any) -> list:
    if not isinstance(items, list):
        return []
    return [str(i)[:500] for i in items if i]


def _valid_severity(val: Any) -> str:
    val = str(val).lower()
    return val if val in ("high", "medium", "low", "info") else "info"


def _clamp(val: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, val))


def _int(val: Any, default: int) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default
