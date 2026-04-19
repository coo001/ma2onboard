@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Creating backend venv...
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
)

echo [2/4] Installing backend dependencies...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
call ".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

echo [3/4] Installing frontend dependencies...
call npm.cmd --prefix frontend install

echo [4/4] Building frontend...
call npm.cmd --prefix frontend run build

echo.
echo Setup complete.
echo Start the app with start-local.bat
endlocal
