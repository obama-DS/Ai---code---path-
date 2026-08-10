# Development Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- Git

---

## Setup

### 1. Clone & enter

```powershell
git clone <repo-url>
cd AI-Code-Judge
```

### 2. Python environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Node dependencies

```powershell
npm install
```

### 4. Environment variables

```powershell
Copy-Item .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

---

## Run the backend

```powershell
python backend/app.py
```

Runs at `http://127.0.0.1:5000`.

The SQLite database is created automatically at `database/judge.db`.

---

## Open the frontend

Open `frontend/index.html` directly in a browser, or use the Live Server extension in VS Code.

---

## Run the auto-commit watcher

```powershell
node auto-commit/watcher.js
```

Or point it at a specific project:

```powershell
node auto-commit/watcher.js C:\Projects\my-project
```

---

## Run tests

```powershell
pytest
```

Expected output: all tests pass. Tests use an in-memory SQLite database and do not call the real AI API.

---

## AI Configuration

Set `AI_PROVIDER` in `.env`:

| Provider   | Key needed        | Notes                        |
|------------|-------------------|------------------------------|
| `openai`   | `OPENAI_API_KEY`  | Default. Uses `gpt-4o-mini`. |
| `anthropic`| `ANTHROPIC_API_KEY` | Uses Claude Haiku by default.|

If no key is set, the app falls back to static scoring (fully functional, no AI cost).

---

## Project structure

```
AI-Code-Judge/
├── backend/          Flask API
│   ├── app.py        Application factory
│   ├── config.py     Configuration
│   ├── models/       SQLAlchemy models
│   ├── routes/       API blueprints
│   ├── services/     Business logic
│   └── utils/        Helpers
├── ai/               AI integration layer
├── auto-commit/      Node.js file watcher
├── database/         DB init + schema reference
├── frontend/         Static HTML/CSS/JS UI
├── tests/            Pytest suite
└── docs/             Documentation
```
