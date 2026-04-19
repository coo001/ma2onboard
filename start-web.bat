@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo === grandMA2 Onboarding Web Server ===
echo.

if not exist backend\.env (
    echo [경고] backend\.env 파일이 없습니다.
    echo        backend\.env 를 만들고 아래 내용을 입력하세요:
    echo.
    echo        OPENAI_API_KEY=sk-...
    echo.
    pause
)

echo [1/2] 프론트엔드 빌드 중...
cd frontend
call npm run build
if errorlevel 1 (
    echo.
    echo 빌드 실패. 아래 명령을 먼저 실행하세요:
    echo   cd frontend ^&^& npm install
    pause
    exit /b 1
)
cd ..

echo.
echo [2/2] 웹서버 시작...
echo.
cd backend
python serve.py
pause
