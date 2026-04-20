# grandMA2 Onboarding

## 프로젝트 목적
grandMA2 onPC를 같은 PC에서 웹으로 보조 조작하는 로컬 웹앱.
클라우드 원격 제어가 아닌 **각 사용자 PC에 로컬 배포**하는 구조.

## 스택
- Frontend: React + Vite (`frontend/src/`)
- Backend: FastAPI + WebSocket + Telnet client (`backend/`)
- Bridge 모드: 인터넷 배포 시 `bridge.py`가 로컬 PC에서 실행되어 WebSocket으로 연결

## 핵심 파일
- `backend/main.py` — FastAPI 진입점, API 라우터, WebSocket 핸들러
- `backend/telnet_client.py` — grandMA2 Telnet 연결
- `backend/ma2_commands.py` — grandMA2 명령어 생성 함수
- `backend/ai_controller.py` — AI 자연어 파싱 (OpenAI gpt-4o-mini)
- `bridge.py` — 인터넷 배포 시 로컬 브릿지
- `frontend/src/App.jsx` — 메인 UI
- `frontend/src/api.js` — API 호출 래퍼

## 개발 서버
```bash
# 백엔드
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드
cd frontend && npm run dev
```

## 개발 역할 분리 (Agent Workflow)

모든 기능 개발은 아래 3단계 역할을 순서대로 거친다.

1. **설계자 (Plan agent)** — 구현 전 변경 파일 목록, 데이터 흐름, 인터페이스를 먼저 제시. 사용자 승인 후 다음 단계 진행.
2. **구현자 (Implementer agent)** — 설계서를 받아 실제 코드를 작성. 설계 범위를 벗어난 추가 구현 금지.
3. **리뷰어 (Reviewer agent)** — 구현된 코드의 버그, 보안 문제, 설계 위반, 엣지 케이스를 검토. 문제 발견 시 구현자에게 재작업 요청.

> 역할은 `subagent_type: Plan / implementer / reviewer` 에이전트로 실행한다.

## Engineering Principles
- Minimal patch first: 작동하는 가장 단순한 버전을 먼저 만든다
- Plan before code: 구현 전 변경 파일 목록과 흐름을 먼저 제시한다
- No destructive commands without explicit approval

## Git Workflow
- 커밋 형식: `feat:` / `fix:` / `refactor:` / `chore:`
- main/master 직접 push 허용
- remote 없거나 인증 실패 시 push 강제하지 않음
