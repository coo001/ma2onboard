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
  "focus": null,
  "store_cue": null,
  "delete_cue": null,
  "save_show": false,
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
- "포커스 올리기/높이기/올려줘" = 현재 focus+15 (0-100 클램핑)
- "포커스 낮추기/내리기/내려줘" = 현재 focus-15 (0-100 클램핑)

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
