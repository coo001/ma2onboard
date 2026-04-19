#!/usr/bin/env python3
"""
grandMA2 Onboarding - 로컬 브릿지
grandMA2 onPC가 설치된 PC에서 실행하세요.

사용법:
    python bridge.py                          # 기본 (localhost:8000)
    python bridge.py wss://yourapp.com        # 클라우드 서버 지정
    python bridge.py wss://yourapp.com ABC123 # 향후 확장용

의존 패키지: pip install websockets python-dotenv
"""
import asyncio
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / "backend" / ".env")
except ImportError:
    pass

sys.path.insert(0, str(Path(__file__).parent / "backend"))

try:
    from telnet_client import ma2_client
except ImportError as exc:
    print(f"오류: backend 폴더를 찾을 수 없습니다. ({exc})")
    sys.exit(1)

try:
    import websockets
except ImportError:
    print("websockets 패키지가 필요합니다:")
    print("  pip install websockets")
    sys.exit(1)

# 접속할 서버 URL (ws:// 또는 wss://)
_raw_url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("BRIDGE_SERVER_URL", "http://localhost:8000")
SERVER_WS = (
    _raw_url
    .replace("https://", "wss://")
    .replace("http://", "ws://")
    .rstrip("/") + "/ws/bridge"
)

MA2_HOST = os.getenv("MA2_HOST", "127.0.0.1")
MA2_PORT = int(os.getenv("MA2_PORT", "30000"))
MA2_USER = os.getenv("MA2_USER", "administrator")
MA2_PASSWORD = os.getenv("MA2_PASSWORD", "admin")


async def handle(ws, msg: dict):
    t = msg.get("type")
    msg_id = msg.get("id")

    if t == "connect":
        r = await ma2_client.connect(
            msg.get("host", MA2_HOST),
            int(msg.get("port", MA2_PORT)),
            msg.get("user", MA2_USER),
            msg.get("password", MA2_PASSWORD),
        )
        await ws.send(json.dumps({"type": "connect_result", "id": msg_id, **r}))
        if r.get("ok"):
            print("  ✅ grandMA2 연결됨")
        else:
            print(f"  ❌ grandMA2 연결 실패: {r.get('error')}")

    elif t == "disconnect":
        await ma2_client.disconnect()
        await ws.send(json.dumps({"type": "disconnect_result", "id": msg_id, "ok": True}))
        print("  grandMA2 연결 해제됨")

    elif t == "exec":
        r = await ma2_client.send_command(msg["command"])
        await ws.send(json.dumps({"type": "exec_result", "id": msg_id, **r}))

    elif t == "ping":
        await ws.send(json.dumps({"type": "pong"}))


async def run():
    print(f"\n서버 연결 중: {SERVER_WS}")

    async with websockets.connect(SERVER_WS, ping_interval=20, ping_timeout=15) as ws:
        raw = await ws.recv()
        msg = json.loads(raw)

        if msg.get("type") == "error":
            print(f"오류: {msg.get('error')}")
            return

        url = msg.get("url", SERVER_WS)
        print(f"\n{'='*50}")
        print(f"  브릿지 연결 성공!")
        print(f"  브라우저 접속 주소: {url}")
        print(f"{'='*50}")
        print(f"  grandMA2 연결 대기 중... (브라우저에서 접속하면 자동 연결)")
        print(f"  종료: Ctrl+C\n")

        async for raw in ws:
            try:
                await handle(ws, json.loads(raw))
            except Exception as exc:
                print(f"[오류] {exc}")


async def main_loop():
    while True:
        try:
            await run()
        except (OSError, websockets.exceptions.WebSocketException) as exc:
            print(f"\n연결 끊김: {exc}")
            print("5초 후 재연결 시도...")
            await asyncio.sleep(5)
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\n브릿지 종료.")
