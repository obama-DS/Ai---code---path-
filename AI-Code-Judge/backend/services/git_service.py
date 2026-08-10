"""
backend/services/git_service.py — Git helpers called from the auto-commit watcher.
"""
import subprocess
from pathlib import Path


def run(cmd: list[str], cwd: str) -> tuple[int, str, str]:
    """Run a git command and return (returncode, stdout, stderr)."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def is_git_repo(path: str) -> bool:
    code, _, _ = run(["git", "rev-parse", "--is-inside-work-tree"], path)
    return code == 0


def has_changes(path: str, file_path: str) -> bool:
    code, stdout, _ = run(["git", "status", "--porcelain", file_path], path)
    return code == 0 and bool(stdout)


def stage_file(repo_path: str, file_path: str) -> bool:
    code, _, _ = run(["git", "add", file_path], repo_path)
    return code == 0


def commit(repo_path: str, message: str) -> tuple[bool, str]:
    """
    Create a commit.
    Returns (success, commit_hash).
    """
    code, _, _ = run(["git", "commit", "-m", message], repo_path)
    if code != 0:
        return False, ""
    _, hash_out, _ = run(["git", "rev-parse", "HEAD"], repo_path)
    return True, hash_out


def get_diff(repo_path: str, file_path: str) -> str:
    """Return the staged diff for a file."""
    _, diff, _ = run(["git", "diff", "--cached", "--", file_path], repo_path)
    if not diff:
        # Fall back to unstaged diff
        _, diff, _ = run(["git", "diff", "--", file_path], repo_path)
    return diff
