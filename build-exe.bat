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

call ".venv\Scripts\python.exe" -m pip install pyinstaller
if errorlevel 1 exit /b 1

call ".venv\Scripts\pyinstaller.exe" ^
  --noconfirm ^
  --clean ^
  --windowed ^
  --name grandma2-onboarding ^
  --add-data "backend;backend" ^
  --add-data "frontend\\dist;frontend\\dist" ^
  --add-data "launcher_config.json;." ^
  launcher.py

copy /Y "launcher_config.json" "dist\grandma2-onboarding\launcher_config.json" >nul

echo.
echo Build complete.
echo EXE: dist\grandma2-onboarding\grandma2-onboarding.exe
endlocal
