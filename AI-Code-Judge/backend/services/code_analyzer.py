"""
code_analyzer.py — Language-aware static code analysis.
Detects common problems without executing any submitted code.
"""
import re
from dataclasses import dataclass, field
from typing import List, Optional


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class Issue:
    title:       str
    description: str
    severity:    str            # high | medium | low | info
    line:        Optional[int] = None
    category:    str = "quality"  # quality | security | performance | maintainability


@dataclass
class AnalysisResult:
    issues:          List[Issue] = field(default_factory=list)
    line_count:      int   = 0
    char_count:      int   = 0
    has_comments:    bool  = False
    avg_line_length: float = 0.0
    max_line_length: int   = 0
    max_nesting:     int   = 0
    function_count:  int   = 0

    @property
    def bug_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.category in ("quality", "maintainability")]

    @property
    def security_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.category == "security"]

    def to_dict(self) -> dict:
        return {
            "issues":          [vars(i) for i in self.issues],
            "metrics": {
                "line_count":      self.line_count,
                "char_count":      self.char_count,
                "has_comments":    self.has_comments,
                "avg_line_length": round(self.avg_line_length, 1),
                "max_line_length": self.max_line_length,
                "max_nesting":     self.max_nesting,
                "function_count":  self.function_count,
            }
        }


# ─── Public entry point ───────────────────────────────────────────────────────

def analyze(code: str, language: str) -> AnalysisResult:
    """Run static analysis and return an AnalysisResult."""
    result = AnalysisResult()
    lines  = code.splitlines()

    # Basic metrics
    result.line_count   = len(lines)
    result.char_count   = len(code)
    result.has_comments = _has_comments(code, language)

    if lines:
        lengths = [len(ln) for ln in lines]
        result.avg_line_length = sum(lengths) / len(lengths)
        result.max_line_length = max(lengths)

    result.max_nesting    = _max_nesting(lines, language)
    result.function_count = _count_functions(code, language)

    # Run language-specific checks
    lang = language.lower()
    if lang == "python":
        _check_python(code, lines, result)
    elif lang in ("javascript", "typescript"):
        _check_js(code, lines, result)
    elif lang == "java":
        _check_java(code, lines, result)
    elif lang in ("cpp", "c++", "c"):
        _check_cpp(code, lines, result)

    # Universal checks (apply to all languages)
    _check_universal(code, lines, result)

    return result


# ─── Universal checks ─────────────────────────────────────────────────────────

def _check_universal(code: str, lines: List[str], result: AnalysisResult):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # TODO / FIXME comments
        if re.search(r'\bTODO\b', line, re.IGNORECASE):
            result.issues.append(Issue(
                title="TODO comment",
                description="Unresolved TODO found. This suggests unfinished work.",
                severity="info", line=i, category="maintainability"
            ))
        if re.search(r'\bFIXME\b', line, re.IGNORECASE):
            result.issues.append(Issue(
                title="FIXME comment",
                description="FIXME comment indicates a known bug that has not been addressed.",
                severity="low", line=i, category="maintainability"
            ))

        # Hardcoded credentials
        if re.search(r'(password|passwd|secret|api_?key|token)\s*=\s*["\'][^"\']{4,}["\']', line, re.IGNORECASE):
            result.issues.append(Issue(
                title="Hardcoded credential",
                description="A sensitive value appears to be hardcoded. Use environment variables instead.",
                severity="high", line=i, category="security"
            ))

        # Long lines
        if len(line) > 120:
            result.issues.append(Issue(
                title="Line too long",
                description=f"Line is {len(line)} characters. Keep lines under 120 for readability.",
                severity="info", line=i, category="maintainability"
            ))

    # Large file
    if result.line_count > 500:
        result.issues.append(Issue(
            title="Large file",
            description=f"File has {result.line_count} lines. Consider splitting into smaller modules.",
            severity="medium", category="maintainability"
        ))

    # Deep nesting
    if result.max_nesting >= 5:
        result.issues.append(Issue(
            title="Deep nesting",
            description=f"Maximum nesting depth is {result.max_nesting}. Deep nesting hurts readability.",
            severity="medium", category="quality"
        ))

    # No comments at all on non-trivial code
    if not result.has_comments and result.line_count > 30:
        result.issues.append(Issue(
            title="No comments or documentation",
            description="No comments found in a sizeable file. Consider adding docstrings or inline comments.",
            severity="low", category="maintainability"
        ))


# ─── Python checks ────────────────────────────────────────────────────────────

def _check_python(code: str, lines: List[str], result: AnalysisResult):
    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        if re.search(r'\beval\s*\(', line):
            result.issues.append(Issue(
                title="eval() detected",
                description="eval() executes arbitrary code and is a critical security risk.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bexec\s*\(', line):
            result.issues.append(Issue(
                title="exec() detected",
                description="exec() executes arbitrary code. Avoid using it with user-supplied input.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bos\.system\s*\(', line):
            result.issues.append(Issue(
                title="os.system() detected",
                description="os.system() can be dangerous with unsanitised input. Prefer subprocess with a list of args.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bsubprocess\.call\s*\(.*shell\s*=\s*True', line):
            result.issues.append(Issue(
                title="subprocess with shell=True",
                description="shell=True in subprocess can lead to shell injection. Use a list of arguments instead.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bpickle\.loads?\s*\(', line):
            result.issues.append(Issue(
                title="pickle.load() detected",
                description="Loading pickle data from untrusted sources can execute arbitrary code.",
                severity="high", line=i, category="security"
            ))

        # SQL string concatenation
        if re.search(r'(SELECT|INSERT|UPDATE|DELETE).*(\"|\').*\+', line, re.IGNORECASE):
            result.issues.append(Issue(
                title="Possible SQL injection",
                description="String concatenation in a SQL query is dangerous. Use parameterised queries.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bprint\s*\(', line):
            result.issues.append(Issue(
                title="print() used",
                description="print() is fine for debugging but should be replaced by logging in production code.",
                severity="info", line=i, category="quality"
            ))

        if re.search(r'except\s*:', stripped) or re.search(r'except\s+Exception\s*:', stripped):
            result.issues.append(Issue(
                title="Bare except clause",
                description="Catching all exceptions hides bugs. Catch specific exception types.",
                severity="medium", line=i, category="quality"
            ))

        # Poor variable names (single letter except i/j/k/x/y/n)
        if re.search(r'\b([a-wz])\s*=\s*', stripped) and not stripped.startswith('#'):
            result.issues.append(Issue(
                title="Short variable name",
                description="Single-letter variable names (excluding loop counters) hurt readability.",
                severity="low", line=i, category="quality"
            ))

    # Missing __main__ guard for scripts
    if result.function_count > 0 and 'if __name__' not in code:
        result.issues.append(Issue(
            title="Missing __main__ guard",
            description='Script-level code should be inside `if __name__ == "__main__":` to avoid side effects on import.',
            severity="low", category="maintainability"
        ))


# ─── JavaScript / TypeScript checks ──────────────────────────────────────────

def _check_js(code: str, lines: List[str], result: AnalysisResult):
    for i, line in enumerate(lines, 1):
        if re.search(r'\beval\s*\(', line):
            result.issues.append(Issue(
                title="eval() detected",
                description="eval() is a security risk and a performance bottleneck. Avoid it.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'innerHTML\s*=', line):
            result.issues.append(Issue(
                title="innerHTML assignment",
                description="Setting innerHTML with unsanitised data causes XSS vulnerabilities. Use textContent or DOMPurify.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'document\.write\s*\(', line):
            result.issues.append(Issue(
                title="document.write() used",
                description="document.write() can overwrite the entire document and is considered harmful.",
                severity="medium", line=i, category="quality"
            ))

        if re.search(r'\bvar\s+\w+', line):
            result.issues.append(Issue(
                title="var declaration",
                description="Use const or let instead of var to avoid hoisting issues and improve scoping.",
                severity="low", line=i, category="quality"
            ))

        if re.search(r'==(?!=)', line):
            result.issues.append(Issue(
                title="Loose equality (==)",
                description="Use === for strict equality to avoid unexpected type coercion.",
                severity="low", line=i, category="quality"
            ))

        if re.search(r'console\.log\s*\(', line):
            result.issues.append(Issue(
                title="console.log() left in code",
                description="Debug logs should be removed before committing to production.",
                severity="info", line=i, category="maintainability"
            ))


# ─── Java checks ──────────────────────────────────────────────────────────────

def _check_java(code: str, lines: List[str], result: AnalysisResult):
    for i, line in enumerate(lines, 1):
        if re.search(r'catch\s*\(\s*Exception\b', line):
            result.issues.append(Issue(
                title="Catching generic Exception",
                description="Catch specific exceptions rather than the generic Exception class.",
                severity="medium", line=i, category="quality"
            ))

        if re.search(r'System\.out\.print', line):
            result.issues.append(Issue(
                title="System.out.print used",
                description="Use a logging framework (SLF4J, Log4j) instead of System.out in production.",
                severity="info", line=i, category="quality"
            ))

        if re.search(r'\.equals\s*\(null\)', line):
            result.issues.append(Issue(
                title="Null comparison via .equals()",
                description="Use == null for null checks. Calling .equals(null) will throw a NullPointerException.",
                severity="high", line=i, category="quality"
            ))

        if re.search(r'String\s+\w+\s*=\s*\".*\"\s*\+', line):
            result.issues.append(Issue(
                title="String concatenation in loop",
                description="Use StringBuilder for string concatenation in loops for better performance.",
                severity="low", line=i, category="performance"
            ))


# ─── C / C++ checks ───────────────────────────────────────────────────────────

def _check_cpp(code: str, lines: List[str], result: AnalysisResult):
    for i, line in enumerate(lines, 1):
        if re.search(r'\bgets\s*\(', line):
            result.issues.append(Issue(
                title="gets() is unsafe",
                description="gets() has no bounds checking and causes buffer overflows. Use fgets() instead.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bstrcpy\s*\(', line):
            result.issues.append(Issue(
                title="strcpy() is unsafe",
                description="strcpy() does not check buffer size. Use strncpy() or std::string.",
                severity="high", line=i, category="security"
            ))

        if re.search(r'\bsprintf\s*\(', line):
            result.issues.append(Issue(
                title="sprintf() without bounds",
                description="Use snprintf() to prevent buffer overflow.",
                severity="medium", line=i, category="security"
            ))

        if re.search(r'\bnew\b', line) and 'delete' not in code:
            result.issues.append(Issue(
                title="Possible memory leak",
                description="new is used but no matching delete found. Consider smart pointers.",
                severity="medium", line=i, category="quality"
            ))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _has_comments(code: str, language: str) -> bool:
    lang = language.lower()
    if lang == "python":
        return bool(re.search(r'#|"""', code))
    return bool(re.search(r'//|/\*', code))


def _max_nesting(lines: List[str], language: str) -> int:
    """Count maximum indentation depth as a nesting proxy."""
    lang      = language.lower()
    max_depth = 0
    for line in lines:
        if not line.strip():
            continue
        if lang == "python":
            depth = (len(line) - len(line.lstrip())) // 4
        else:
            depth = line.count('{') - line.count('}')
        max_depth = max(max_depth, depth)
    return max_depth


def _count_functions(code: str, language: str) -> int:
    lang = language.lower()
    if lang == "python":
        return len(re.findall(r'^\s*def\s+\w+', code, re.MULTILINE))
    if lang in ("javascript", "typescript"):
        return len(re.findall(r'\bfunction\s+\w+|\w+\s*=\s*(async\s+)?\(.*\)\s*=>', code))
    if lang == "java":
        return len(re.findall(r'(public|private|protected|static)\s+\w+\s+\w+\s*\(', code))
    return 0
