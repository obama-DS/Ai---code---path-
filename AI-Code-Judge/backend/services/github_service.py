"""
backend/services/github_service.py — Fetch and analyse a public GitHub repository.

Uses the GitHub REST API (no auth required for public repos, but a token
removes rate-limit restrictions).
"""
import os
import re
import base64
from urllib.parse import urlparse
from typing import Optional

import requests

from backend.services.code_analyzer import analyze
from backend.services.scoring       import calculate_scores

GITHUB_API   = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# File extensions we will analyse
ANALYSABLE = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".java": "java", ".cpp": "cpp", ".cs": "csharp",
    ".go": "go", ".rs": "rust", ".php": "php", ".rb": "ruby",
}

MAX_FILES   = 30    # cap to keep analysis fast
MAX_BYTES   = 50_000


# ─── Public entry point ───────────────────────────────────────────────────────

def analyse_repo(repo_url: str) -> dict:
    """
    Fetch a public GitHub repo, analyse its code files, and return a report.
    Raises ValueError on bad URL or private/missing repo.
    """
    owner, repo = _parse_url(repo_url)
    meta        = _get_repo_meta(owner, repo)
    tree        = _get_tree(owner, repo, meta["default_branch"])
    files       = _pick_files(tree)

    file_results  = []
    lang_counter  = {}
    total_score   = 0
    scored_count  = 0

    for item in files:
        content = _fetch_file(owner, repo, item["path"])
        if not content:
            continue

        ext  = "." + item["path"].rsplit(".", 1)[-1].lower()
        lang = ANALYSABLE.get(ext, "python")

        analysis     = analyze(content, lang)
        score_data   = calculate_scores(analysis)
        score        = score_data["overall_score"]

        lang_counter[lang] = lang_counter.get(lang, 0) + 1
        total_score  += score
        scored_count += 1

        file_results.append({
            "path":     item["path"],
            "language": lang,
            "score":    score,
            "scores":   score_data["scores"],
            "issues":   [vars(i) for i in analysis.issues[:10]],
            "lines":    analysis.line_count,
        })

    repo_score = round(total_score / scored_count) if scored_count else 0

    return {
        "repo":          f"{owner}/{repo}",
        "url":           repo_url,
        "description":   meta.get("description") or "",
        "stars":         meta.get("stargazers_count", 0),
        "language":      meta.get("language") or "Unknown",
        "default_branch":meta["default_branch"],
        "files_analysed":scored_count,
        "repo_score":    repo_score,
        "languages":     lang_counter,
        "file_results":  file_results,
        "top_issues":    _top_issues(file_results),
    }


# ─── GitHub API helpers ───────────────────────────────────────────────────────

def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _get_repo_meta(owner: str, repo: str) -> dict:
    url = f"{GITHUB_API}/repos/{owner}/{repo}"
    r   = requests.get(url, headers=_headers(), timeout=10)
    if r.status_code == 404:
        raise ValueError(f"Repository '{owner}/{repo}' not found or is private.")
    r.raise_for_status()
    return r.json()


def _get_tree(owner: str, repo: str, branch: str) -> list:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    r   = requests.get(url, headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json().get("tree", [])


def _pick_files(tree: list) -> list:
    """Select up to MAX_FILES analysable source files."""
    candidates = [
        item for item in tree
        if item["type"] == "blob"
        and "." in item["path"].rsplit("/", 1)[-1]
        and "." + item["path"].rsplit(".", 1)[-1].lower() in ANALYSABLE
        and _not_vendored(item["path"])
        and item.get("size", 0) <= MAX_BYTES
    ]
    return candidates[:MAX_FILES]


def _not_vendored(path: str) -> bool:
    skip = ("node_modules", "vendor", ".venv", "venv", "__pycache__",
            "dist", "build", "migrations", "test", "tests", "spec")
    parts = path.lower().split("/")
    return not any(p in skip for p in parts)


def _fetch_file(owner: str, repo: str, path: str) -> Optional[str]:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    r   = requests.get(url, headers=_headers(), timeout=10)
    if r.status_code != 200:
        return None
    data = r.json()
    if data.get("encoding") != "base64":
        return None
    try:
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    except Exception:
        return None


def _top_issues(file_results: list) -> list:
    counter: dict = {}
    for fr in file_results:
        for issue in fr.get("issues", []):
            key = issue.get("title", "Unknown")
            counter[key] = counter.get(key, 0) + 1
    return [
        {"title": t, "count": c}
        for t, c in sorted(counter.items(), key=lambda x: -x[1])[:10]
    ]


def _parse_url(url: str) -> tuple[str, str]:
    """Extract (owner, repo) from a GitHub URL."""
    url = url.strip().rstrip("/")
    # Try https://github.com/owner/repo
    match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
    if match:
        return match.group(1), match.group(2).replace(".git", "")
    # Try owner/repo shorthand
    match = re.match(r"^([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+)$", url)
    if match:
        return match.group(1), match.group(2)
    raise ValueError(
        "Invalid GitHub URL. Use https://github.com/owner/repo or owner/repo."
    )
