@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Python virtual environment not found.
  echo Run setup-local.bat first.
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo frontend\dist not found.
  echo Run setup-local.bat first.
  exit /b 1
)

set APP_HOST=127.0.0.1
set APP_PORT=8000

echo Starting local server on http://%APP_HOST%:%APP_PORT%
call ".venv\Scripts\python.exe" backend\serve.py
endlocal
