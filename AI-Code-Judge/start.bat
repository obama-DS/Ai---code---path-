@echo off
REM Start the AI Code Judge backend (Flask) on http://127.0.0.1:5000
cd /d "%~dp0"
python backend\app.py
pause
