"""AI natural language → grandMA2 command parser (OpenAI backend)."""
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from openai import AsyncOpenAI

_client = AsyncOpenAI()

# 조명별 현재 상태 추적 (상대 명령어 처리용)
_states: dict[int, dict] = {}

_SYSTEM = """\
당신은 grandMA2 조명 콘솔 제어 AI입니다.
사용자의 한국어 명령과 현재 조명 상태를 보고, 실행할 설정값을 JSON으로만 반환하세요.

## JSON 스키마 (변경 없는 항목은 null)
{
  "fixtures": [1, 2],
  "intensity": 80,
  "color": {"r": 100, "g": 0, "b": 0},
  "pan": 50,
  "tilt": 65,
  "focus": 0,
  "store_cue": null,
  "explanation": "한국어로 실행 내용 설명"
}

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


async def parse_command(text: str) -> dict:
    """한국어 조명 명령을 파싱해 구조화된 dict 반환."""
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
