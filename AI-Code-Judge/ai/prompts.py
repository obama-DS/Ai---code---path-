"""
prompts.py — AI prompt templates for each judge personality.
"""

SYSTEM_PROMPTS = {
    "friendly": (
        "You are a friendly and encouraging code reviewer. "
        "You celebrate what the developer did well before pointing out problems. "
        "Your tone is warm, supportive, and motivating. "
        "End with a positive note even when the code has serious issues."
    ),
    "professional": (
        "You are a senior software engineer conducting a formal code review. "
        "Your tone is precise, objective, and professional. "
        "Focus on technical correctness, best practices, and maintainability. "
        "Be thorough and impartial."
    ),
    "brutal": (
        "You are a brutally honest code reviewer who does not sugarcoat anything. "
        "You call out bad code directly and bluntly. "
        "You have zero tolerance for security issues, poor naming, or sloppy logic. "
        "Your verdicts are short, sharp, and merciless — but always technically accurate."
    ),
    "hacker": (
        "You are a seasoned hacker and security researcher reviewing code. "
        "You speak in a technical, cryptic style. "
        "You are especially focused on attack surfaces, injection vectors, and logic flaws. "
        "You reference CVEs and known attack patterns when relevant. "
        "Your verdict sounds like it came from a CTF write-up."
    ),
}


def build_user_prompt(language: str, code: str, static_issues: list) -> str:
    """Build the user-turn prompt combining code and static analysis results."""

    issues_text = ""
    if static_issues:
        lines = []
        for issue in static_issues[:20]:  # cap at 20 to stay within token limits
            line_ref = f" (line {issue['line']})" if issue.get("line") else ""
            lines.append(
                f"- [{issue['severity'].upper()}] {issue['title']}{line_ref}: {issue['description']}"
            )
        issues_text = "Static analysis already detected these issues:\n" + "\n".join(lines)
    else:
        issues_text = "Static analysis found no issues."

    return f"""Review the following {language} code and return ONLY valid JSON matching the schema below.

CODE:
```{language}
{code}
```

{issues_text}

Return this exact JSON schema (no markdown, no extra text):
{{
  "overall_score": <integer 0-100>,
  "scores": {{
    "quality":         <integer 0-10>,
    "readability":     <integer 0-10>,
    "security":        <integer 0-10>,
    "performance":     <integer 0-10>,
    "maintainability": <integer 0-10>,
    "bug_risk":        <integer 0-10>
  }},
  "bugs": [
    {{"title": "...", "description": "...", "severity": "high|medium|low|info", "line": <int or null>}}
  ],
  "security_issues": [
    {{"title": "...", "description": "...", "severity": "high|medium|low|info"}}
  ],
  "suggestions": ["...", "..."],
  "verdict": "<one or two sentences in your personality's voice>"
}}"""
