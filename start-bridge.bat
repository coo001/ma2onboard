@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo === grandMA2 Onboarding Bridge ===
echo.

if "%~1"=="" (
    echo 서버 주소를 입력하세요 (기본값: http://localhost:8000)
    set /p SERVER_URL="서버 주소: "
    if "!SERVER_URL!"=="" set SERVER_URL=http://localhost:8000
) else (
    set SERVER_URL=%~1
)

echo.
echo grandMA2 onPC를 먼저 실행해주세요.
echo.

python bridge.py %SERVER_URL%
pause
