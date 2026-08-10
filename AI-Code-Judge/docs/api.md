# API Reference

Base URL: `http://localhost:5000`

---

## Core

### `GET /`
Returns API info.

### `GET /api/health`
```json
{ "status": "ok" }
```

---

## Auth — `/api/auth`

### `POST /api/auth/register`
**Body:**
```json
{ "username": "alex", "email": "alex@example.com", "password": "secret123", "first_name": "Alex" }
```
**Returns:** `201` `{ "token": "...", "user": {...} }`

### `POST /api/auth/login`
**Body:** `{ "email": "...", "password": "..." }`
**Returns:** `200` `{ "token": "...", "user": {...} }`

### `GET /api/auth/me`
Requires `Authorization: Bearer <token>`
**Returns:** `200` `{ "user": {...} }`

### `POST /api/auth/logout`
Requires auth. Client discards token.

---

## Judge — `/api/judge`

### `POST /api/judge`
**Body:**
```json
{
  "language":    "python",
  "code":        "def hello(): pass",
  "personality": "friendly"
}
```
**Returns:** `200`
```json
{
  "overall_score": 82,
  "scores": {
    "quality": 8, "readability": 9, "security": 10,
    "performance": 7, "maintainability": 8, "bug_risk": 7
  },
  "bugs":            [ { "title": "...", "description": "...", "severity": "high", "line": 3 } ],
  "security_issues": [],
  "suggestions":     ["Use descriptive names."],
  "verdict":         "Not bad at all.",
  "judgment_id":     42
}
```

Supported languages: `python`, `javascript`, `typescript`, `java`, `cpp`, `csharp`, `go`, `rust`, `php`, `ruby`

Personalities: `friendly`, `professional`, `brutal`, `hacker`

---

## History — `/api/history`  *(auth required)*

### `GET /api/history/?page=1&per_page=20&language=python`
Returns paginated list of past judgments.

### `GET /api/history/<id>`
Full judgment detail including code.

### `DELETE /api/history/<id>`
Delete a judgment.

### `POST /api/history/commit`
Called by the auto-commit watcher.
```json
{
  "file_name":      "app.py",
  "commit_hash":    "abc1234...",
  "commit_message": "Auto: app.py",
  "language":       "python",
  "score":          76,
  "judgment_id":    42
}
```

---

## Statistics — `/api/stats`  *(auth required)*

### `GET /api/stats/`
Returns aggregated dashboard data:
```json
{
  "total": 47,
  "average_score": 78,
  "best_score": 96,
  "worst_score": 42,
  "languages": { "python": 30, "javascript": 17 },
  "common_problems": [ { "title": "eval() detected", "count": 5 } ],
  "score_history": [ { "score": 76, "language": "python", "created_at": "..." } ],
  "category_averages": { "quality": 7.8, "security": 9.1, ... }
}
```
