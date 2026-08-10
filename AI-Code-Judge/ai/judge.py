"""
ai/judge.py — Orchestrates the full judgment pipeline.

Flow:
  1. Static analysis  (code_analyzer)
  2. Static scoring   (scoring)
  3. AI review        (OpenAI / Anthropic / fallback)
  4. Merge & return
"""
import os

from ai.prompts import SYSTEM_PROMPTS, build_user_prompt
from ai.parser  import parse_ai_response
from backend.services.code_analyzer import analyze
from backend.services.scoring       import calculate_scores


# ─── Public entry point ───────────────────────────────────────────────────────

def judge_code(language: str, code: str, personality: str = "friendly") -> dict:
    """
    Run the full pipeline and return a structured result dict.
    Falls back to static-only scoring when no AI key is configured.
    """
    # 1. Static analysis
    analysis     = analyze(code, language)
    static_data  = calculate_scores(analysis)
    static_issues = [vars(i) for i in analysis.issues]

    # 2. Try AI
    ai_result = _call_ai(language, code, personality, static_issues)

    if ai_result:
        # AI succeeded — surface any static security issues it may have missed
        existing = {i["title"] for i in ai_result.get("security_issues", [])}
        for issue in analysis.security_issues:
            if issue.title not in existing:
                ai_result["security_issues"].append(vars(issue))
        return ai_result

    # 3. Static-only fallback
    return {
        "overall_score":   static_data["overall_score"],
        "scores":          static_data["scores"],
        "bugs":            [vars(i) for i in analysis.bug_issues],
        "security_issues": [vars(i) for i in analysis.security_issues],
        "suggestions":     _default_suggestions(analysis),
        "verdict":         _static_verdict(static_data["overall_score"], personality),
    }


# ─── AI call ─────────────────────────────────────────────────────────────────

def _call_ai(language: str, code: str, personality: str, static_issues: list) -> dict | None:
    """
    Try to call the configured AI provider.
    Returns parsed result dict or None on failure / no key.
    """
    provider = os.getenv("AI_PROVIDER", "openai").lower()
    model    = os.getenv("AI_MODEL", "gpt-4o-mini")

    system_prompt = SYSTEM_PROMPTS.get(personality, SYSTEM_PROMPTS["friendly"])
    user_prompt   = build_user_prompt(language, code, static_issues)

    try:
        if provider == "openai":
            return _call_openai(system_prompt, user_prompt, model)
        if provider == "anthropic":
            return _call_anthropic(system_prompt, user_prompt, model)
    except Exception as e:
        print(f"[AI Judge] Provider call failed ({provider}): {e}")

    return None


def _call_openai(system: str, user: str, model: str) -> dict | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system",  "content": system},
            {"role": "user",    "content": user},
        ],
        temperature=0.3,
        max_tokens=1500,
    )
    raw = response.choices[0].message.content
    return parse_ai_response(raw)


def _call_anthropic(system: str, user: str, model: str) -> dict | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model or "claude-3-haiku-20240307",
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = response.content[0].text
    return parse_ai_response(raw)


# ─── Static fallback helpers ─────────────────────────────────────────────────

def _default_suggestions(analysis) -> list:
    suggestions = []
    if not analysis.has_comments:
        suggestions.append("Add docstrings and inline comments to explain your logic.")
    if analysis.max_nesting >= 4:
        suggestions.append("Reduce nesting depth by extracting logic into helper functions.")
    if analysis.function_count == 0 and analysis.line_count > 30:
        suggestions.append("Break your code into functions to improve reusability.")
    if analysis.max_line_length > 120:
        suggestions.append("Keep lines under 120 characters for better readability.")
    high_issues = [i for i in analysis.issues if i.severity == "high"]
    for issue in high_issues[:3]:
        suggestions.append(f"Fix: {issue.title} — {issue.description}")
    if not suggestions:
        suggestions.append("Code looks clean. Keep it up!")
    return suggestions


def _static_verdict(score: int, personality: str) -> str:
    verdicts = {
        "friendly": {
            90: "Fantastic work — clean, readable, and secure!",
            75: "Good job overall. A few small things to polish.",
            50: "Not bad! There's room to improve, but you're on the right track.",
            0:  "There are some issues here, but every problem is a learning opportunity!",
        },
        "professional": {
            90: "Code quality is high. Minor improvements possible.",
            75: "Acceptable quality. Review flagged items before merging.",
            50: "Several issues require attention. Refactoring recommended.",
            0:  "Code does not meet production standards. Significant rework needed.",
        },
        "brutal": {
            90: "Fine. I can't complain much.",
            75: "It works. Barely presentable.",
            50: "This needs work. Several obvious problems.",
            0:  "This is a mess. Start over or fix every single flagged issue.",
        },
        "hacker": {
            90: "Attack surface minimal. Logic sound. Ship it.",
            75: "A few vectors open. Patch them before prod.",
            50: "Multiple entry points for exploitation. Harden this.",
            0:  "Critical vulnerabilities detected. Do not deploy.",
        },
    }
    p = verdicts.get(personality, verdicts["professional"])
    for threshold in sorted(p.keys(), reverse=True):
        if score >= threshold:
            return p[threshold]
    return p[0]
