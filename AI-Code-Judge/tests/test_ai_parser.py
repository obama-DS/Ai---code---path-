"""
test_ai_parser.py — Tests for the AI JSON response parser.
"""
import json
from ai.parser import parse_ai_response


VALID_RESPONSE = {
    "overall_score": 82,
    "scores": {
        "quality": 8, "readability": 9, "security": 10,
        "performance": 7, "maintainability": 8, "bug_risk": 7,
    },
    "bugs":             [],
    "security_issues":  [],
    "suggestions":      ["Use descriptive names."],
    "verdict":          "Pretty solid.",
}


def test_parse_valid_json():
    result = parse_ai_response(json.dumps(VALID_RESPONSE))
    assert result["overall_score"] == 82
    assert result["scores"]["quality"] == 8
    assert result["verdict"] == "Pretty solid."


def test_parse_json_with_markdown_fences():
    raw = "```json\n" + json.dumps(VALID_RESPONSE) + "\n```"
    result = parse_ai_response(raw)
    assert result["overall_score"] == 82


def test_parse_json_with_preamble():
    raw = "Here is the result:\n" + json.dumps(VALID_RESPONSE)
    result = parse_ai_response(raw)
    assert result["overall_score"] == 82


def test_parse_fallback_on_garbage():
    result = parse_ai_response("This is not JSON at all.")
    assert result["overall_score"] == 50   # default
    assert isinstance(result["bugs"], list)


def test_parse_clamps_scores():
    bad = {**VALID_RESPONSE, "overall_score": 150}
    result = parse_ai_response(json.dumps(bad))
    assert result["overall_score"] == 100


def test_parse_clamps_category_scores():
    bad = {**VALID_RESPONSE, "scores": {"quality": 99}}
    result = parse_ai_response(json.dumps(bad))
    assert result["scores"]["quality"] == 10


def test_parse_cleans_issues():
    data = {
        **VALID_RESPONSE,
        "bugs": [
            {"title": "Bad issue", "description": "desc", "severity": "high", "line": 5},
            "not a dict",  # should be ignored
        ],
    }
    result = parse_ai_response(json.dumps(data))
    assert len(result["bugs"]) == 1
    assert result["bugs"][0]["severity"] == "high"


def test_parse_invalid_severity_defaults_to_info():
    data = {**VALID_RESPONSE, "bugs": [
        {"title": "X", "description": "y", "severity": "critical"}
    ]}
    result = parse_ai_response(json.dumps(data))
    assert result["bugs"][0]["severity"] == "info"
