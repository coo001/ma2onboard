"""AI natural language → grandMA2 command parser (OpenAI backend)."""
import json
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from openai import AsyncOpenAI

_GROUPS_FILE = Path(__file__).resolve().parent / "groups.json"


def _load_groups() -> dict:
    if not _GROUPS_FILE.exists():
        return {}
    with _GROUPS_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def _substitute_groups(text: str) -> str:
    """텍스트에서 그룹명을 fixture 번호 목록으로 치환한다. 긴 이름 우선."""
    groups = _load_groups()
    if not groups:
        return text
    for name in sorted(groups.keys(), key=len, reverse=True):
        if name in text:
            nums = ", ".join(str(n) for n in groups[name])
            text = text.replace(name, f"{nums}번 조명")
    return text

_client = AsyncOpenAI()

# 조명별 현재 상태 추적 (상대 명령어 처리용)
_states: dict[int, dict] = {}

_SYSTEM = """\
당신은 grandMA2 조명 콘솔 제어 AI입니다.
사용자의 한국어 명령과 현재 조명 상태를 보고, 실행할 설정값을 JSON으로만 반환하세요.

## 모드 선택 규칙
- 입력에 fixture 번호가 명시된 경우 → 반드시 "command" 모드
  예: "1번 조명 빨간색", "3~5번 조명 끄기", "전체 조명 50%"
- 분위기·씬·장면 등 서술형 입력이고 fixture 번호가 없는 경우 → "scene" 모드
  예: "석양 분위기", "공포 장면", "로맨틱한 조명"

## command 모드 JSON 스키마 (변경 없는 항목은 null)
{
  "mode": "command",
  "fixtures": [1, 2],
  "intensity": 80,
  "color": {"r": 100, "g": 0, "b": 0},
  "pan": 50,
  "tilt": 65,
  "focus": 0,
  "store_cue": null,
  "effect": null,
  "explanation": "한국어로 실행 내용 설명"
}

## scene 모드 JSON 스키마
{
  "mode": "scene",
  "scene_fixtures": [
    {"fixtures": [1,2,3], "intensity": 70, "color": {"r":100,"g":50,"b":0}, "pan": 50, "tilt": 65},
    {"fixtures": [4,5,6], "intensity": 40, "color": {"r":80,"g":20,"b":5},  "pan": 50, "tilt": 35}
  ],
  "explanation": "한국어로 씬 설명"
}
- scene_fixtures는 빈 배열이어선 안 됩니다. 분위기에 맞게 fixture 1~10 중에서 그룹을 나눠 설정하세요.
- 각 그룹의 pan/tilt는 생략 가능합니다 (생략 시 null).

## effect 필드 (없으면 null)
{"mode": "none"} | {"mode": "strobe", "strobe": 0-100} | {"mode": "slot", "slot": 1-99, "value": 0-100}
- "스트로브 켜", "번쩍번쩍" → mode=strobe
- "이펙트 끄기" → mode=none

## 색상 매핑 (RGB 0-100 기준)
- 빨간색/적색/찐한빨간색/진한빨간색: r=100 g=0 b=0
- 파란색/청색: r=0 g=0 b=100
- 초록색/녹색: r=0 g=100 b=0
- 흰색/화이트: r=100 g=100 b=100
- 노란색/옐로우: r=100 g=100 b=0
- 마젠타/자홍: r=100 g=0 b=100
- 시안/하늘색: r=0 g=100 b=100
- 주황색/오렌지: r=100 g=60 b=0
- 보라색/퍼플: r=60 g=0 b=100
- 분홍/핑크: r=100 g=40 b=70
- 끄기/off: intensity=0

## 방향 (현재 상태 기반 절댓값 계산, 반드시 0-100 클램핑)
- 위쪽=tilt+N, 아래쪽=tilt-N, 오른쪽=pan+N, 왼쪽=pan-N
- "조금"=±15, "많이/크게"=±30
- "포커스 풀고/초점 없애고/흐릿하게" = focus=0
- "포커스 최대/선명하게" = focus=100

## 조명 번호 파싱
- "1번 조명" → fixtures=[1]
- "1, 2, 3번" → fixtures=[1,2,3]
- "1~3번" → fixtures=[1,2,3]
- "전체/모든 조명" → fixtures=[1,2,3,4,5,6,7,8,9,10]\
"""


def _default_state() -> dict:
    return {"intensity": 50, "r": 100, "g": 100, "b": 100, "pan": 50, "tilt": 50, "focus": 50}


def get_state(fixture: int) -> dict:
    if fixture not in _states:
        _states[fixture] = _default_state()
    return _states[fixture]


def update_states(fixtures: list[int], parsed: dict) -> None:
    for f in fixtures:
        s = get_state(f)
        if parsed.get("intensity") is not None:
            s["intensity"] = int(parsed["intensity"])
        color = parsed.get("color")
        if color:
            s["r"] = int(color["r"])
            s["g"] = int(color["g"])
            s["b"] = int(color["b"])
        if parsed.get("pan") is not None:
            s["pan"] = int(parsed["pan"])
        if parsed.get("tilt") is not None:
            s["tilt"] = int(parsed["tilt"])
        if parsed.get("focus") is not None:
            s["focus"] = int(parsed["focus"])
        if parsed.get("effect") is not None:
            s["effect"] = parsed["effect"]


async def parse_command(text: str) -> dict:
    """한국어 조명 명령을 파싱해 구조화된 dict 반환."""
    text = _substitute_groups(text)
    state_lines = []
    for f in sorted(_states.keys()):
        s = _states[f]
        state_lines.append(
            f"조명{f}번: 밝기={s['intensity']} Pan={s['pan']} Tilt={s['tilt']} Focus={s['focus']}"
        )
    state_ctx = "\n".join(state_lines) if state_lines else "없음 (기본: 밝기50 Pan50 Tilt50 Focus50)"

    response = await _client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=600,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"현재 상태:\n{state_ctx}\n\n명령: {text}"},
        ],
    )

    return json.loads(response.choices[0].message.content)


async def chat_complete_cues(
    history: list,
    issues: list,
    user_message: str,
) -> dict:
    """
    GPT를 호출하여 사용자 답변을 파싱하고 patches + next_question을 반환한다.
    history: OpenAI messages format의 이전 대화 목록
    issues: 현재 미해결 이슈 목록 (detect_missing_fields 결과)
    반환: {"patches": [...], "next_question": str|None, "all_resolved": bool}
    """
    system_prompt = """당신은 공연 조명 큐시트 보완 전문 AI입니다.
사용자와 대화하며 부족한 큐시트 정보를 채워나갑니다.

반환 JSON 스키마:
{
  "patches": [
    {"cue": "3", "field": "fixtures", "value": [5, 6, 7]},
    {"cue": "7", "field": "label", "value": "등장"}
  ],
  "next_question": "다음으로 확인할 내용이 있으면 질문 문장, 없으면 null",
  "all_resolved": false
}

필드별 value 타입:
- fixtures: 정수 배열 [1, 2, 3]
- intensity: 0~100 정수
- label: 문자열 (단일 큐) 또는 {"큐번호": "레이블"} (배치)
- color: {"r": 0~100, "g": 0~100, "b": 0~100}
- fade: float

규칙:
- 한 번에 하나의 주제만 질문
- 여러 큐에 같은 필드 누락 시 묶어서 질문
- "모르겠어요", "기본값으로" 답변 시 합리적 기본값 적용 (fixtures: [1,2,3,4], intensity: 80)
- 배치 label 패치 시 cue 필드를 "__batch_label__"으로 설정
- all_resolved는 현재 issues 중 해결된 것이 모두 처리됐을 때 true
- 반드시 JSON만 반환"""

    issues_context = json.dumps(issues, ensure_ascii=False)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"현재 미해결 이슈:\n{issues_context}"},
    ] + history + [
        {"role": "user", "content": user_message},
    ]

    for attempt in range(2):
        try:
            resp = await _client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0,
                response_format={"type": "json_object"},
            )
            parsed = json.loads(resp.choices[0].message.content)
            return {
                "patches": parsed.get("patches", []),
                "next_question": parsed.get("next_question"),
                "all_resolved": bool(parsed.get("all_resolved", False)),
            }
        except Exception as e:
            if attempt == 1:
                raise RuntimeError(f"AI 대화 처리 실패: {e}")
    return {"patches": [], "next_question": None, "all_resolved": False}


async def parse_excel_sheet(rows_text: str) -> list:
    """
    엑셀 시트의 텍스트 표현을 받아 AI로 파싱하여 큐 목록 JSON을 반환한다.
    rows_text: "행N: [값1, 값2, ...]" 형식의 문자열
    반환: 큐 딕셔너리 리스트
    """
    system_prompt = """당신은 공연 조명 큐시트 엑셀 파일 구조 분석 전문가입니다.
주어진 엑셀 시트 내용을 분석하여 각 행이 어떤 grandMA2 큐를 나타내는지 파악하고
JSON 배열로 변환하세요.

출력 JSON 스키마 (배열):
[
  {
    "row_index": 4,
    "cue": "1",
    "label": "오프닝",
    "fixtures": [1, 2, 3],
    "intensity_per_fixture": {"1": 80, "2": 60, "3": 0},
    "intensity": null,
    "color": null,
    "pan": null,
    "tilt": null,
    "fade": 2.0
  }
]

파싱 규칙:
- 헤더 행: 빈 행, 그룹 레이블 행을 건너뛰고 실제 컬럼명이 있는 행을 헤더로 식별
- 큐 번호: "큐", "cue", "Q", "번호" 등으로 표기된 컬럼에서 추출. 없으면 데이터 행 순서를 1부터 자동 부여
- 레이블: 장면명, 이름, label 등의 컬럼에서 추출
- 조명별 밝기가 열로 펼쳐진 경우(헤더에 숫자나 "조명N"): intensity_per_fixture에 {fixture번호: 밝기값} 형태로 매핑. 빈 셀은 0으로 처리
- 단일 fixtures 컬럼이 있으면 fixtures 배열과 intensity 단일값 사용
- 페이드: "페이드", "fade", "Fade" 컬럼 → fade 필드 (float, 없으면 null)
- 데이터가 없는 행(모든 셀 빈값)은 건너뜀
- 큐 번호는 반드시 문자열 형태의 숫자 (예: "1", "1.5")로 반환
- color는 {r, g, b} 딕셔너리 또는 null
- 반드시 JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요"""

    user_msg = f"다음 엑셀 시트 내용을 분석해 큐 목록 JSON으로 변환해주세요:\n\n{rows_text}"

    for attempt in range(2):
        try:
            resp = await _client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content
            parsed = json.loads(content)
            # JSON 객체로 감싸진 경우 배열 추출
            if isinstance(parsed, dict):
                for v in parsed.values():
                    if isinstance(v, list):
                        return v
                raise RuntimeError("AI 응답에서 큐 목록을 찾을 수 없습니다.")
            if isinstance(parsed, list):
                return parsed
            raise RuntimeError("AI 응답이 예상 형식이 아닙니다.")
        except Exception as e:
            if attempt == 1:
                raise RuntimeError(f"AI 엑셀 파싱 실패: {e}")
    return []
