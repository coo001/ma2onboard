"""
grandMA2 Onboarding API

Development:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Production-like local use:
    python serve.py
"""

import asyncio
import json
import logging
import os
import re
import uuid as _uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from .ma2_commands import (
        COLOR_PRESETS,
        cmd_clear_all,
        cmd_clear_selection,
        cmd_color_preset,
        cmd_color_rgb,
        cmd_delete_cue,
        cmd_focus,
        cmd_intensity,
        cmd_off_fixtures,
        cmd_pan,
        cmd_save_show,
        cmd_select_fixtures,
        cmd_store_cue,
        cmd_tilt,
    )
    from .telnet_client import MA2_DEFAULT_PORT, ma2_client
except ImportError:
    from ma2_commands import (
        COLOR_PRESETS,
        cmd_clear_all,
        cmd_clear_selection,
        cmd_color_preset,
        cmd_color_rgb,
        cmd_delete_cue,
        cmd_focus,
        cmd_intensity,
        cmd_off_fixtures,
        cmd_pan,
        cmd_save_show,
        cmd_select_fixtures,
        cmd_store_cue,
        cmd_tilt,
    )
    from telnet_client import MA2_DEFAULT_PORT, ma2_client

try:
    from .ai_controller import parse_command as ai_parse, update_states as ai_update
except ImportError:
    from ai_controller import parse_command as ai_parse, update_states as ai_update

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ws_clients: List[WebSocket] = []
PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

GROUPS_FILE = Path(__file__).resolve().parent / "groups.json"
_groups_lock = asyncio.Lock()

_GROUP_NAME_RE = re.compile(r"^[A-Za-z0-9_\-]+$")


def _read_groups() -> dict:
    if not GROUPS_FILE.exists():
        return {}
    with GROUPS_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_groups(data: dict) -> None:
    with GROUPS_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class BridgeSession:
    """로컬 PC에서 실행 중인 bridge.py와의 WebSocket 세션."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.ma2_connected = False
        self._pending: dict[str, asyncio.Future] = {}

    async def request(self, msg: dict, timeout: float = 8.0) -> dict:
        msg_id = str(_uuid.uuid4())[:8]
        msg["id"] = msg_id
        loop = asyncio.get_event_loop()
        fut: asyncio.Future = loop.create_future()
        self._pending[msg_id] = fut
        await self.ws.send_text(json.dumps(msg, ensure_ascii=False))
        try:
            return await asyncio.wait_for(asyncio.shield(fut), timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(msg_id, None)
            return {"ok": False, "error": "브릿지 응답 타임아웃"}

    def resolve(self, msg: dict):
        msg_id = msg.get("id")
        if msg_id and msg_id in self._pending:
            fut = self._pending.pop(msg_id)
            if not fut.done():
                fut.set_result(msg)


_bridge: BridgeSession | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await ma2_client.disconnect()


app = FastAPI(title="grandMA2 Onboarding API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


async def broadcast(payload: dict):
    disconnected: List[WebSocket] = []
    for websocket in ws_clients:
        try:
            await websocket.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            disconnected.append(websocket)

    for websocket in disconnected:
        if websocket in ws_clients:
            ws_clients.remove(websocket)


async def _exec_command(command: str) -> dict:
    """브릿지 연결 시 브릿지로, 아니면 로컬 Telnet으로 명령 실행."""
    if _bridge is not None:
        return await _bridge.request({"type": "exec", "command": command})
    return await ma2_client.send_command(command)


async def send_and_log(command: str) -> dict:
    result = await _exec_command(command)
    await broadcast(
        {
            "type": "cmd_log",
            "command": command,
            "response": result.get("response", ""),
            "ok": result.get("ok", False),
            "error": result.get("error", ""),
        }
    )
    return result


async def send_commands(commands: List[str], delay: float = 0.05) -> List[dict]:
    results = []
    for command in commands:
        result = await send_and_log(command)
        results.append(result)
        await asyncio.sleep(delay)
    return results


def summarize_results(results: List[dict]) -> dict:
    first_error = next((item.get("error") or item.get("response") for item in results if item.get("ok") is False), "")
    return {
        "ok": all(item.get("ok") for item in results),
        "results": results,
        "error": first_error,
    }


class ConnectRequest(BaseModel):
    host: str
    port: int = MA2_DEFAULT_PORT
    user: str = "administrator"
    password: str = ""


class FixtureSelectRequest(BaseModel):
    fixture_numbers: List[int] = Field(min_length=1)


class IntensityColorRequest(BaseModel):
    intensity: int
    color_preset: Optional[str] = None
    color_rgb: Optional[dict] = None


class PositionRequest(BaseModel):
    pan: int
    tilt: int
    focus: Optional[int] = None


class StoreCueRequest(BaseModel):
    cue_number: str


class RawCommandRequest(BaseModel):
    command: str


class ClearFixturesRequest(BaseModel):
    fixture_numbers: List[int] = Field(min_length=1)


class GroupRequest(BaseModel):
    name: str
    fixture_numbers: List[int] = Field(min_length=1)


@app.post("/api/groups")
async def create_group(req: GroupRequest):
    if not _GROUP_NAME_RE.match(req.name):
        raise HTTPException(status_code=400, detail="그룹명은 영숫자, 하이픈, 언더스코어만 허용됩니다.")
    async with _groups_lock:
        groups = _read_groups()
        groups[req.name] = req.fixture_numbers
        _write_groups(groups)
    return {"ok": True, "group": {"name": req.name, "fixture_numbers": req.fixture_numbers}}


@app.get("/api/groups")
async def list_groups():
    async with _groups_lock:
        groups = _read_groups()
    return {"groups": [{"name": k, "fixture_numbers": v} for k, v in groups.items()]}


@app.delete("/api/groups/{name}")
async def delete_group(name: str):
    async with _groups_lock:
        groups = _read_groups()
        if name not in groups:
            raise HTTPException(status_code=404, detail=f"그룹 '{name}'을 찾을 수 없습니다.")
        del groups[name]
        _write_groups(groups)
    return {"ok": True, "deleted": name}


@app.post("/api/connect")
async def connect(req: ConnectRequest):
    global _bridge
    if _bridge is not None:
        result = await _bridge.request({
            "type": "connect",
            "host": req.host, "port": req.port,
            "user": req.user, "password": req.password,
        })
        _bridge.ma2_connected = result.get("ok", False)
    else:
        if ma2_client.connected:
            await ma2_client.disconnect()
        result = await ma2_client.connect(req.host, req.port, req.user, req.password)

    await broadcast({"type": "connection", "connected": result.get("ok", False), **result})
    return result


@app.post("/api/disconnect")
async def disconnect():
    global _bridge
    if _bridge is not None:
        await _bridge.request({"type": "disconnect"})
        _bridge.ma2_connected = False
    else:
        await ma2_client.disconnect()
    await broadcast({"type": "connection", "connected": False})
    return {"ok": True}


@app.get("/api/status")
async def status():
    if _bridge is not None:
        return {
            "connected": _bridge.ma2_connected,
            "mode": "bridge",
            "bridge_active": True,
        }
    return {
        "connected": ma2_client.connected,
        "host": ma2_client.host,
        "port": ma2_client.port,
        "mode": "local",
        "bridge_active": False,
    }


@app.post("/api/wizard/select-fixtures")
async def wizard_select_fixtures(req: FixtureSelectRequest):
    return await send_and_log(cmd_select_fixtures(req.fixture_numbers))


@app.post("/api/wizard/intensity-color")
async def wizard_intensity_color(req: IntensityColorRequest):
    commands = [cmd_intensity(req.intensity)]

    if req.color_preset and req.color_preset in COLOR_PRESETS:
        commands.extend(cmd_color_preset(req.color_preset))
    elif req.color_rgb:
        commands.extend(
            cmd_color_rgb(
                req.color_rgb.get("r", 100),
                req.color_rgb.get("g", 100),
                req.color_rgb.get("b", 100),
            )
        )

    return summarize_results(await send_commands(commands))


@app.post("/api/wizard/position")
async def wizard_position(req: PositionRequest):
    commands = [cmd_pan(req.pan), cmd_tilt(req.tilt)]
    if req.focus is not None:
        commands.append(cmd_focus(req.focus))
    return summarize_results(await send_commands(commands))


@app.post("/api/wizard/store-cue")
async def wizard_store_cue(req: StoreCueRequest):
    return await send_and_log(cmd_store_cue(req.cue_number))


@app.post("/api/wizard/clear")
async def wizard_clear():
    # ClearAll empties the whole programmer immediately.
    return summarize_results(await send_commands([cmd_clear_all()]))


@app.post("/api/wizard/clear-fixtures")
async def wizard_clear_fixtures(req: ClearFixturesRequest):
    commands = [
        cmd_off_fixtures(req.fixture_numbers),
        cmd_clear_selection(),
    ]
    return summarize_results(await send_commands(commands))


class AICommandRequest(BaseModel):
    text: str


@app.post("/api/ai-command")
async def ai_command_endpoint(req: AICommandRequest):
    if not req.text.strip():
        return {"ok": False, "error": "명령을 입력해주세요."}
    try:
        parsed = await ai_parse(req.text)
    except Exception as exc:
        return {"ok": False, "error": f"AI 파싱 실패: {exc}"}

    fixtures: list[int] = parsed.get("fixtures") or []
    actions: list[str] = []

    if fixtures:
        await send_and_log(cmd_select_fixtures(fixtures))
        actions.append(f"조명 {fixtures}번 선택")

    if parsed.get("intensity") is not None:
        await send_and_log(cmd_intensity(int(parsed["intensity"])))
        actions.append(f"밝기 {parsed['intensity']}%")

    color = parsed.get("color")
    if color:
        await send_commands(cmd_color_rgb(int(color["r"]), int(color["g"]), int(color["b"])))
        actions.append(f"색상 RGB({color['r']}, {color['g']}, {color['b']})")

    if parsed.get("pan") is not None:
        await send_and_log(cmd_pan(int(parsed["pan"])))
        actions.append(f"Pan {parsed['pan']}")

    if parsed.get("tilt") is not None:
        await send_and_log(cmd_tilt(int(parsed["tilt"])))
        actions.append(f"Tilt {parsed['tilt']}")

    if parsed.get("focus") is not None:
        await send_and_log(cmd_focus(int(parsed["focus"])))
        actions.append(f"Focus {parsed['focus']}")

    if parsed.get("store_cue"):
        await send_and_log(cmd_store_cue(str(parsed["store_cue"])))
        actions.append(f"큐 {parsed['store_cue']}번 저장")

    if parsed.get("delete_cue") is not None:
        await send_commands([cmd_delete_cue(str(parsed["delete_cue"])), ""])
        actions.append(f"큐 {parsed['delete_cue']}번 삭제")

    if parsed.get("save_show"):
        await send_and_log(cmd_save_show())
        actions.append("쇼 저장")

    ai_update(fixtures, parsed)

    return {
        "ok": True,
        "explanation": parsed.get("explanation", ""),
        "actions": actions,
        "parsed": parsed,
    }


@app.post("/api/command")
async def raw_command(req: RawCommandRequest):
    return await send_and_log(req.command)


@app.get("/api/color-presets")
async def color_presets():
    return {
        "presets": [
            {"name": name, "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]}}
            for name, rgb in COLOR_PRESETS.items()
        ]
    }


@app.get("/api/debug-telnet")
async def debug_telnet():
    import asyncio as _asyncio

    result = {}
    try:
        reader, writer = await _asyncio.wait_for(
            _asyncio.open_connection("127.0.0.1", 30000), timeout=5
        )

        buf = b""
        for _ in range(10):
            try:
                chunk = await _asyncio.wait_for(reader.read(4096), timeout=0.4)
                if not chunk:
                    break
                buf += chunk
            except _asyncio.TimeoutError:
                break

        result["raw_hex"] = buf.hex()
        result["raw_text"] = buf.decode("utf-8", errors="replace")
        result["length"] = len(buf)

        writer.write(b"Fixture 1\r\n")
        await writer.drain()

        buf2 = b""
        for _ in range(5):
            try:
                chunk = await _asyncio.wait_for(reader.read(4096), timeout=0.4)
                if not chunk:
                    break
                buf2 += chunk
            except _asyncio.TimeoutError:
                break

        result["after_command_hex"] = buf2.hex()
        result["after_command_text"] = buf2.decode("utf-8", errors="replace")
        writer.close()
    except Exception as exc:
        result["error"] = str(exc)

    return result


@app.websocket("/ws/bridge")
async def ws_bridge(websocket: WebSocket):
    """로컬 PC의 bridge.py가 접속하는 엔드포인트."""
    global _bridge
    await websocket.accept()

    if _bridge is not None:
        await websocket.send_text(json.dumps({"type": "error", "error": "다른 브릿지가 이미 연결되어 있습니다."}))
        await websocket.close()
        return

    _bridge = BridgeSession(websocket)
    logger.info("Bridge connected")
    await broadcast({"type": "bridge_status", "active": True})
    await websocket.send_text(json.dumps({"type": "registered", "url": BASE_URL}))

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            t = msg.get("type", "")

            if t.endswith("_result"):
                _bridge.resolve(msg)

            if t == "cmd_log":
                await broadcast(msg)
    except WebSocketDisconnect:
        pass
    finally:
        _bridge = None
        logger.info("Bridge disconnected")
        await broadcast({"type": "bridge_status", "active": False})
        await broadcast({"type": "connection", "connected": False})


@app.websocket("/ws/log")
async def ws_log(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    await websocket.send_text(
        json.dumps(
            {
                "type": "connection",
                "connected": ma2_client.connected,
                "host": ma2_client.host,
            },
            ensure_ascii=False,
        )
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in ws_clients:
            ws_clients.remove(websocket)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "frontend_built": FRONTEND_DIST.exists(),
        "connected": ma2_client.connected,
    }


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if not FRONTEND_DIST.exists():
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "error": "frontend/dist 가 없습니다. 먼저 프론트를 빌드해야 합니다.",
            },
        )

    if not full_path or full_path == "/":
        return FileResponse(FRONTEND_DIST / "index.html")

    candidate = FRONTEND_DIST / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)

    return FileResponse(FRONTEND_DIST / "index.html")
