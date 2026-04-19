# grandMA2 Onboarding

각자 자기 컴퓨터에서 실행하는 `로컬 웹앱`입니다.

목표는 다음과 같습니다.

- 친구가 자기 PC에서 grandMA2 onPC를 켠다
- 같은 PC에서 이 앱을 실행한다
- 브라우저로 `http://127.0.0.1:8000`에 접속한다
- 웹에서 grandMA2 onPC를 보조 조작한다

즉, 이 프로젝트는 클라우드 원격 제어용이 아니라 `각 사용자의 PC에 로컬 배포`하는 구조입니다.

## 구조

- `frontend`: React + Vite
- `backend`: FastAPI + WebSocket + Telnet client
- 운영 모드에서는 FastAPI가 `frontend/dist`를 같이 서빙함

## 처음 설치

Windows 기준:

```bat
setup-local.bat
```

이 스크립트가 다음을 처리합니다.

1. `.venv` 생성
2. 백엔드 의존성 설치
3. 프론트 의존성 설치
4. 프론트 빌드

## 실행

```bat
start-local.bat
```

실행 후 브라우저에서 아래 주소로 접속합니다.

- `http://127.0.0.1:8000`

## 개발 모드

프론트와 백엔드를 따로 실행하고 싶으면:

### backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### frontend

```bash
cd frontend
npm run dev
```

개발 모드 브라우저 주소:

- `http://localhost:5173`

## grandMA2 onPC 설정

같은 PC에서 grandMA2 onPC가 실행 중이어야 합니다.

확인 항목:

1. grandMA2 onPC 실행
2. `Setup > Console > Network Configuration > Network Command Line` 활성화
3. 포트 `30000` 확인
4. 계정 정보 확인

현재 기본 연결값:

- Host: `127.0.0.1`
- Port: `30000`
- User: `administrator`
- Password: `admin`

환경에 따라 계정/비밀번호는 수정이 필요할 수 있습니다.

## EXE 배포

Windows 기준으로 `exe`로 묶을 수 있습니다.

1. 먼저 설치:

```bat
setup-local.bat
```

2. 그 다음 exe 빌드:

```bat
build-exe.bat
```

3. 생성 위치:

- `dist\grandma2-onboarding\grandma2-onboarding.exe`

이 exe는 실행 시 다음 순서로 동작합니다.

1. grandMA2 onPC 실행 파일 자동 탐지
2. grandMA2 onPC 자동 실행
3. 로컬 FastAPI 서버 실행
4. 브라우저에서 `http://127.0.0.1:8000` 자동 열기

설치 경로가 다르면 루트의 `launcher_config.json`에서 `grandma2_path`를 지정하면 됩니다.

## 배포 방식

친구들에게 배포할 때는 두 방식 중 하나를 고르면 됩니다.

1. 폴더째 전달:
   `setup-local.bat`, `start-local.bat` 방식
2. exe 전달:
   `dist\grandma2-onboarding` 폴더 전체 전달

최소 전달 항목:

- `backend/`
- `frontend/`
- `setup-local.bat`
- `start-local.bat`

상대방 PC에는 다음만 있으면 됩니다.

- Python 3.10+
- Node.js 18+

## 현재 동작

- Fixture 선택
- Intensity 설정
- RGB 색 설정
- Pan / Tilt / Focus 설정
- Cue 저장
- 전체 `ClearAll`
- 특정 fixture만 `Off Fixture ...`로 programmer에서 제거

## 주의

- 색 제어는 fixture profile이 RGB MixColor를 지원해야 합니다
- 현재 RGB는 `ColorRGB1/2/3` 기준으로 전송합니다
- 일부 장비는 Color, Focus, Position attribute 구성이 다를 수 있습니다
- 실제 공연 투입 전에는 command line에서 fixture profile별 명령 검증이 필요합니다
