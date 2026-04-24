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

import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
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
        cmd_effect_high,
        cmd_effect_low,
        cmd_effect_off,
        cmd_effect_rate,
        cmd_effect_slot,
        cmd_focus,
        cmd_goto_cue,
        cmd_intensity,
        cmd_off_fixtures,
        cmd_pan,
        cmd_preview_color,
        cmd_preview_position,
        cmd_q,
        cmd_select_fixtures,
        cmd_store_cue,
        cmd_strobe,
        cmd_tilt,
        cmd_update_cue,
    )
    from .excel_importer import (
        parse_workbook, build_commands as excel_build_commands, generate_template_xlsx, RowValidationError,
        is_template_format, extract_sheet_text, normalize_ai_rows, build_commands_from_ai,
        detect_missing_fields, apply_patches,
    )
    from .telnet_client import MA2_DEFAULT_PORT, ma2_client
except ImportError:
    from excel_importer import (
        parse_workbook, build_commands as excel_build_commands, generate_template_xlsx, RowValidationError,
        is_template_format, extract_sheet_text, normalize_ai_rows, build_commands_from_ai,
        detect_missing_fields, apply_patches,
    )
    from ma2_commands import (
        COLOR_PRESETS,
        cmd_clear_all,
        cmd_clear_selection,
        cmd_color_preset,
        cmd_color_rgb,
        cmd_delete_cue,
        cmd_effect_high,
        cmd_effect_low,
        cmd_effect_off,
        cmd_effect_rate,
        cmd_effect_slot,
        cmd_focus,
        cmd_goto_cue,
        cmd_intensity,
        cmd_off_fixtures,
        cmd_pan,
        cmd_preview_color,
        cmd_preview_position,
        cmd_q,
        cmd_select_fixtures,
        cmd_store_cue,
        cmd_strobe,
        cmd_tilt,
        cmd_update_cue,
    )
    from telnet_client import MA2_DEFAULT_PORT, ma2_client

try:
    from .ai_controller import parse_command as ai_parse, update_states as ai_update, parse_excel_sheet, chat_complete_cues
except ImportError:
    from ai_controller import parse_command as ai_parse, update_states as ai_update, parse_excel_sheet, chat_complete_cues

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ws_clients: List[WebSocket] = []
PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

GROUPS_FILE = Path(__file__).resolve().parent / "groups.json"
_groups_lock = asyncio.Lock()

CUES_FILE = Path(__file__).resolve().parent / "cues.json"
_cues_lock = asyncio.Lock()

_GROUP_NAME_RE = re.compile(r"^[A-Za-z0-9_\-]+$")

_preview_snapshot_lock = asyncio.Lock()


from dataclasses import dataclass, field as dc_field

@dataclass
class CueSession:
    rows: list
    issues: list
    history: list = dc_field(default_factory=list)
    completed: bool = False

_cue_sessions: dict = {}

# Stores pre-edit color/position snapshot keyed by fixture number (str) for preview restore.
_preview_snapshot: dict = {}


def _read_groups() -> dict:
    if not GROUPS_FILE.exists():
        return {}
    with GROUPS_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_groups(data: dict) -> None:
    with GROUPS_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _read_cues() -> tuple[list, bool]:
    """큐 목록을 읽어 (cues, migrated) 튜플로 반환한다.
    migrated=True 이면 구버전 문자열 배열을 객체 배열로 변환한 것이므로
    호출자(lock 안)에서 _write_cues()를 호출해야 한다.
    """
    if not CUES_FILE.exists():
        return [], False
    with CUES_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        return [], False
    if data and isinstance(data[0], str):
        return [{"number": c, "label": ""} for c in data], True
    return data, False


def _write_cues(data: list) -> None:
    with CUES_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class BridgeSession:
    """로컬 PC에서 실행 중인 bridge.py와의 WebSocket 세션."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.ma2_connected = False
        self._pending: dict[str, asyncio.Future] = {}

    async def request(self, msg: dict, timeout: float = 8.0) -> dict:
        msg_id = str(_uuid.uuid4())
        msg["id"] = msg_id
        loop = asyncio.get_event_loop()
        fut: asyncio.Future = loop.create_future()
        self._pending[msg_id] = fut
        await self.ws.send_text(json.dumps(msg, ensure_ascii=False))
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(msg_id, None)
            logger.warning(f"[Bridge] 응답 타임아웃 (id={msg_id})")
            return {"ok": False, "error": "브릿지 응답 타임아웃"}

    def resolve(self, msg: dict):
        msg_id = msg.get("id")
        if msg_id and msg_id in self._pending:
            fut = self._pending.pop(msg_id)
            if not fut.done():
                fut.set_result(msg)
        elif msg_id:
            logger.warning(f"[Bridge] 타임아웃 후 늦은 응답 수신 (id={msg_id})")


_bridge: BridgeSession | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await ma2_client.disconnect()


app = FastAPI(title="grandMA2 Onboarding API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
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
    fixture_numbers: Optional[List[int]] = None


class PositionRequest(BaseModel):
    pan: int
    tilt: int
    focus: Optional[int] = None
    fixture_numbers: Optional[List[int]] = None


class EffectRequest(BaseModel):
    mode: str  # "none" | "strobe" | "slot"
    strobe: Optional[int] = None
    slot: Optional[int] = None
    tempo: Optional[int] = None
    high: Optional[int] = None
    low: Optional[int] = None
    value: Optional[int] = None
    fixture_numbers: Optional[List[int]] = None


class StoreCueRequest(BaseModel):
    cue_number: str


class RawCommandRequest(BaseModel):
    command: str


class ClearFixturesRequest(BaseModel):
    fixture_numbers: List[int] = Field(min_length=1)


class GroupRequest(BaseModel):
    name: str
    fixture_numbers: List[int] = Field(min_length=1)


class CueRequest(BaseModel):
    cue_number: str
    label: Optional[str] = ""


class CompleteChatRequest(BaseModel):
    message: str


class ApplySessionRequest(BaseModel):
    on_error: str = "skip"


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


@app.get("/api/cues")
async def list_cues():
    async with _cues_lock:
        cues, migrated = _read_cues()
        if migrated:
            _write_cues(cues)
    for c in cues:
        c.setdefault("source", "web")
    return {"cues": cues}


@app.post("/api/cues/sync")
async def sync_cues():
    if _bridge is not None:
        return {"ok": False, "error": "브릿지 모드에서는 직접 sync를 지원하지 않습니다", "cues": [], "synced_count": 0}
    if not ma2_client.connected:
        return {"ok": False, "error": "MA2에 연결되어 있지 않습니다", "cues": [], "synced_count": 0}
    try:
        ma2_cues = await ma2_client.read_cue_list()
    except Exception as e:
        return {"ok": False, "cues": [], "synced_count": 0, "error": str(e)}

    async with _cues_lock:
        cues, migrated = _read_cues()
        if migrated:
            _write_cues(cues)

        # 기존 web 큐에 source 보장
        for c in cues:
            c.setdefault("source", "web")

        existing = {c["number"]: c for c in cues}
        synced_count = 0
        for mc in ma2_cues:
            num = mc["number"]
            if num not in existing:
                cues.append({"number": num, "label": mc["label"], "source": "ma2"})
                synced_count += 1
            # 이미 있는 큐는 cues.json 레이블 우선 — 변경 없음

        _write_cues(cues)

    return {"ok": True, "cues": cues, "synced_count": synced_count, "error": None}

@app.post("/api/cues")
async def add_cue(req: CueRequest):
    if not re.match(r'^\d+(\.\d+)?$', req.cue_number.strip()):
        raise HTTPException(status_code=400, detail="큐 번호는 숫자 형식이어야 합니다.")
    num = req.cue_number.strip()
    async with _cues_lock:
        cues, migrated = _read_cues()
        if migrated:
            _write_cues(cues)
        if any(c["number"] == num for c in cues):
            return JSONResponse(status_code=409, content={"ok": False, "detail": "이미 존재하는 큐 번호입니다"})
        cues.append({"number": num, "label": req.label or "", "source": "web"})
        _write_cues(cues)
    return {"ok": True, "cues": cues}

def _row_stub(r: dict) -> dict:
    return {"row_index": r["row_index"], "cue": r["cue"], "label": r.get("label", "")}


@app.post("/api/cues/import-excel")
async def import_cues_excel(
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    on_error: str = Form("skip"),
):
    if on_error not in ("skip", "abort"):
        raise HTTPException(status_code=400, detail="on_error는 skip|abort 중 하나여야 합니다.")
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail=".xlsx 파일만 지원합니다.")

    content = await file.read()

    # 포맷 자동 감지 및 파싱
    parser_type = "template"
    if is_template_format(content):
        try:
            rows, errors = parse_workbook(content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # AI 파싱 경로
        parser_type = "ai"
        try:
            sheet_text = extract_sheet_text(content)
            ai_rows = await parse_excel_sheet(sheet_text)
            if not ai_rows:
                raise HTTPException(status_code=400, detail="AI가 큐 데이터를 인식하지 못했습니다. 파일을 확인해 주세요.")
            rows = normalize_ai_rows(ai_rows)
            errors = []  # AI 파싱은 행 단위 에러 없이 전체 성공/실패

            issues = detect_missing_fields(rows)
            if issues:
                first = await chat_complete_cues([], issues, "큐시트 보완을 시작합니다")
                session_id = str(_uuid.uuid4())[:8]
                sess = CueSession(rows=rows, issues=issues)
                if first.get("next_question"):
                    sess.history.append({"role": "assistant", "content": first["next_question"]})
                _cue_sessions[session_id] = sess
                return {
                    "session_id": session_id,
                    "question": first.get("next_question"),
                    "issues_count": len(issues),
                    "parser": "ai",
                }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"AI 파싱에 실패했습니다: {e}")

    cmd_builder = build_commands_from_ai if parser_type == "ai" else excel_build_commands
    valid_rows = []
    for r in rows:
        try:
            r["commands"] = cmd_builder(r)
            valid_rows.append(r)
        except ValueError as e:
            errors.append({"row_index": r.get("row_index", "?"), "column": "cue", "message": str(e)})
    rows = valid_rows

    total_rows = len(rows) + len(errors)
    valid_rows = len(rows)
    results = []

    if dry_run:
        for r in rows:
            results.append({
                **_row_stub(r),
                "ok": True,
                "error": "",
                "commands": r["commands"],
            })
        return {
            "ok": len(errors) == 0,
            "dry_run": True,
            "parser": parser_type,
            "total_rows": total_rows,
            "valid_rows": valid_rows,
            "errors": errors,
            "results": results,
        }

    # 1단계: lock 안에서 기존 번호 확인 및 처리 대상 예약
    to_process = []
    async with _cues_lock:
        cues_list, migrated = _read_cues()
        if migrated:
            _write_cues(cues_list)
        existing_numbers = {c["number"] for c in cues_list}
        for r in rows:
            if r["cue"] in existing_numbers:
                results.append({**_row_stub(r), "ok": False, "error": "중복 큐 번호(skip)", "commands": r["commands"]})
            else:
                to_process.append(r)
                existing_numbers.add(r["cue"])  # 예약

    # 2단계: lock 밖에서 Telnet 명령 전송
    succeeded_cues = []
    aborted = False
    for r in to_process:
        if aborted:
            results.append({**_row_stub(r), "ok": False, "error": "이전 오류로 중단됨", "commands": r["commands"]})
            continue
        try:
            for cmd in r["commands"]:
                res = await send_and_log(cmd)
                if not res.get("ok"):
                    raise RuntimeError(res.get("error") or "명령 실패")
            succeeded_cues.append({"number": r["cue"], "label": r.get("label", ""), "source": "excel"})
            results.append({**_row_stub(r), "ok": True, "error": "", "commands": r["commands"]})
        except Exception as exc:
            results.append({**_row_stub(r), "ok": False, "error": str(exc), "commands": r["commands"]})
            if on_error == "abort":
                aborted = True

    # 3단계: lock 안에서 성공한 항목만 한 번에 저장
    if succeeded_cues:
        async with _cues_lock:
            cues_list, _ = _read_cues()
            existing = {c["number"] for c in cues_list}
            for c in succeeded_cues:
                if c["number"] not in existing:
                    cues_list.append(c)
            _write_cues(cues_list)

    succeeded = [x for x in results if x["ok"]]
    return {
        "ok": len(succeeded) > 0 and not errors,
        "dry_run": False,
        "parser": parser_type,
        "total_rows": total_rows,
        "valid_rows": valid_rows,
        "errors": errors,
        "results": results,
    }


@app.get("/api/cues/import-template")
async def import_cues_template():
    tmp_path = Path(tempfile.gettempdir()) / "cues_template.xlsx"
    generate_template_xlsx(tmp_path)
    return FileResponse(
        tmp_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="cues_template.xlsx",
    )


@app.post("/api/cues/complete/{session_id}")
async def complete_cue_chat(session_id: str, req: CompleteChatRequest):
    sess = _cue_sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    if sess.completed:
        return {"session_id": session_id, "next_question": None, "all_resolved": True, "issues_remaining": 0}

    result = await chat_complete_cues(sess.history, sess.issues, req.message)

    if result.get("patches"):
        sess.rows = apply_patches(sess.rows, result["patches"])
        sess.issues = detect_missing_fields(sess.rows)

    sess.history.append({"role": "user", "content": req.message})
    if result.get("next_question"):
        sess.history.append({"role": "assistant", "content": result["next_question"]})

    sess.completed = result.get("all_resolved", False) or len(sess.issues) == 0

    return {
        "session_id": session_id,
        "next_question": result.get("next_question"),
        "all_resolved": sess.completed,
        "issues_remaining": len(sess.issues),
    }


@app.post("/api/cues/complete/{session_id}/apply")
async def apply_cue_session(session_id: str, req: ApplySessionRequest = None):
    if req is None:
        req = ApplySessionRequest()
    sess = _cue_sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    on_error = req.on_error if req.on_error in ("skip", "abort") else "skip"
    rows = sess.rows
    valid_rows, errors = [], []
    for r in rows:
        try:
            r["commands"] = build_commands_from_ai(r)
            valid_rows.append(r)
        except ValueError as e:
            errors.append({"row_index": r.get("row_index", "?"), "column": "cue", "message": str(e)})

    results = []
    to_process = []
    async with _cues_lock:
        cues_list, migrated = _read_cues()
        if migrated:
            _write_cues(cues_list)
        existing_numbers = {c["number"] for c in cues_list}
        for r in valid_rows:
            if r["cue"] in existing_numbers:
                results.append({**_row_stub(r), "ok": False, "error": "중복 큐 번호(skip)", "commands": r["commands"]})
            else:
                to_process.append(r)
                existing_numbers.add(r["cue"])

    succeeded_cues, aborted = [], False
    for r in to_process:
        if aborted:
            results.append({**_row_stub(r), "ok": False, "error": "이전 오류로 중단됨", "commands": r["commands"]})
            continue
        try:
            for cmd in r["commands"]:
                res = await send_and_log(cmd)
                if not res.get("ok"):
                    raise RuntimeError(res.get("error") or "명령 실패")
            succeeded_cues.append({"number": r["cue"], "label": r.get("label", ""), "source": "excel"})
            results.append({**_row_stub(r), "ok": True, "error": "", "commands": r["commands"]})
        except Exception as exc:
            results.append({**_row_stub(r), "ok": False, "error": str(exc), "commands": r["commands"]})
            if on_error == "abort":
                aborted = True

    if succeeded_cues:
        async with _cues_lock:
            cues_list, _ = _read_cues()
            existing = {c["number"] for c in cues_list}
            for c in succeeded_cues:
                if c["number"] not in existing:
                    cues_list.append(c)
            _write_cues(cues_list)

    _cue_sessions.pop(session_id, None)

    succeeded = [x for x in results if x["ok"]]
    return {
        "ok": len(succeeded) > 0 and not errors,
        "dry_run": False,
        "parser": "ai",
        "total_rows": len(rows),
        "valid_rows": len(valid_rows),
        "errors": errors,
        "results": results,
    }


class ColorModel(BaseModel):
    r: int = Field(ge=0, le=100)
    g: int = Field(ge=0, le=100)
    b: int = Field(ge=0, le=100)


class PositionModel(BaseModel):
    pan: Optional[int] = Field(default=None, ge=0, le=100)
    tilt: Optional[int] = Field(default=None, ge=0, le=100)
    focus: Optional[int] = Field(default=None, ge=0, le=100)


class BulkEditRequest(BaseModel):
    cue_numbers: List[str]
    fixture_numbers: List[int] = Field(min_length=1)
    color: Optional[ColorModel] = None
    position: Optional[PositionModel] = None


class PreviewColorRequest(BaseModel):
    fixture_numbers: List[int]
    color: ColorModel


class PreviewPositionRequest(BaseModel):
    fixture_numbers: List[int]
    pan: Optional[int] = Field(default=None, ge=0, le=100)
    tilt: Optional[int] = Field(default=None, ge=0, le=100)
    focus: Optional[int] = Field(default=None, ge=0, le=100)


class PreviewSnapshotRequest(BaseModel):
    cue_numbers: List[str]
    fixture_numbers: List[int]


@app.post("/api/cues/bulk-edit")
async def bulk_edit_cues(req: BulkEditRequest):
    if not req.cue_numbers:
        raise HTTPException(status_code=400, detail="cue_numbers가 비어 있습니다.")
    if not req.fixture_numbers:
        raise HTTPException(status_code=400, detail="fixture_numbers가 비어 있습니다.")
    if not req.color and not req.position:
        raise HTTPException(status_code=400, detail="color 또는 position 중 하나는 필요합니다.")

    # Validate all cue numbers exist in cues.json
    async with _cues_lock:
        cues, migrated = _read_cues()
        if migrated:
            _write_cues(cues)
    existing_nums = {c["number"] for c in cues}
    invalid = [n for n in req.cue_numbers if n not in existing_nums]
    if invalid:
        raise HTTPException(status_code=400, detail=f"존재하지 않는 큐 번호: {invalid}")

    updated, failed = [], []
    for cue_num in req.cue_numbers:
        try:
            await send_and_log(cmd_goto_cue(cue_num))
            if req.color:
                cmds = cmd_preview_color(
                    req.fixture_numbers,
                    req.color.r,
                    req.color.g,
                    req.color.b,
                )
                for c in cmds:
                    await send_and_log(c)
            if req.position:
                cmds = cmd_preview_position(
                    req.fixture_numbers,
                    pan=req.position.pan,
                    tilt=req.position.tilt,
                    focus=req.position.focus,
                )
                for c in cmds:
                    await send_and_log(c)
            await send_and_log(cmd_update_cue(cue_num))
            await asyncio.sleep(0.1)
            updated.append(cue_num)
        except Exception as exc:
            logger.warning(f"[bulk-edit] 큐 {cue_num} 실패: {exc}")
            failed.append({"cue": cue_num, "error": str(exc)})

    await send_and_log(cmd_clear_all())

    # Persist color/position meta to cues.json
    async with _cues_lock:
        cues, _ = _read_cues()
        for c in cues:
            if c["number"] in updated:
                if req.color:
                    c["color"] = req.color.model_dump()
                if req.position:
                    c["position"] = req.position.model_dump(exclude_none=True)
        _write_cues(cues)
        refreshed = cues

    return {"ok": len(failed) == 0, "updated": updated, "failed": failed, "cues": refreshed}


@app.post("/api/preview/snapshot")
async def preview_snapshot(req: PreviewSnapshotRequest):
    global _preview_snapshot
    async with _cues_lock:
        cues, _ = _read_cues()
    cue_map = {c["number"]: c for c in cues}
    snapshot: dict = {}
    for num in req.cue_numbers:
        cue = cue_map.get(num, {})
        snapshot[num] = {
            "color": cue.get("color"),
            "position": cue.get("position"),
        }
    async with _preview_snapshot_lock:
        _preview_snapshot = {"cue_numbers": req.cue_numbers, "fixture_numbers": req.fixture_numbers, "data": snapshot}
    return {"ok": True, "snapshot": _preview_snapshot}


@app.post("/api/preview/color")
async def preview_color(req: PreviewColorRequest):
    cmds = cmd_preview_color(
        req.fixture_numbers,
        req.color.r,
        req.color.g,
        req.color.b,
    )
    results = await send_commands(cmds, delay=0.02)
    return summarize_results(results)


@app.post("/api/preview/position")
async def preview_position(req: PreviewPositionRequest):
    cmds = cmd_preview_position(
        req.fixture_numbers,
        pan=req.pan,
        tilt=req.tilt,
        focus=req.focus,
    )
    results = await send_commands(cmds, delay=0.02)
    return summarize_results(results)


@app.post("/api/preview/restore")
async def preview_restore():
    global _preview_snapshot
    async with _preview_snapshot_lock:
        if not _preview_snapshot:
            # No snapshot — fall back to ClearAll
            result = await send_and_log(cmd_clear_all())
            return {"ok": result.get("ok", False), "restored": False}

        fixture_numbers = _preview_snapshot.get("fixture_numbers", [])
        data = _preview_snapshot.get("data", {})
        snapshot_copy = dict(data)
        _preview_snapshot = {}

    # Send restore commands outside the lock to avoid blocking other snapshot requests.
    # Only send commands for cues that have stored color/position values.
    for cue_num, vals in snapshot_copy.items():
        color = vals.get("color")
        position = vals.get("position")
        if not color and not position:
            # No stored state for this cue — skip entirely
            continue
        if color and fixture_numbers:
            cmds = cmd_preview_color(
                fixture_numbers,
                int(color.get("r", 0)),
                int(color.get("g", 0)),
                int(color.get("b", 0)),
            )
            for c in cmds:
                await send_and_log(c)
        if position and fixture_numbers:
            cmds = cmd_preview_position(
                fixture_numbers,
                pan=position.get("pan"),
                tilt=position.get("tilt"),
                focus=position.get("focus"),
            )
            for c in cmds:
                await send_and_log(c)

    # Clean programmer state after all restore commands
    await send_and_log(cmd_clear_all())
    return {"ok": True, "restored": True}


@app.post("/api/preview/release")
async def preview_release():
    global _preview_snapshot
    async with _preview_snapshot_lock:
        _preview_snapshot = {}
    result = await send_and_log(cmd_clear_all())
    return {"ok": result.get("ok", False)}


@app.delete("/api/cues/{cue_number}")
async def delete_cue(cue_number: str):
    if not re.match(r'^\d+(\.\d+)?$', cue_number.strip()):
        raise HTTPException(status_code=400, detail="큐 번호는 숫자 형식이어야 합니다.")
    async with _cues_lock:
        cues, migrated = _read_cues()
        if migrated:
            _write_cues(cues)
        if not any(c["number"] == cue_number for c in cues):
            raise HTTPException(status_code=404, detail=f"큐 '{cue_number}'를 찾을 수 없습니다.")
        cues = [c for c in cues if c["number"] != cue_number]
        _write_cues(cues)
    await send_and_log(cmd_delete_cue(cue_number))
    return {"ok": True, "cues": cues}

class ExecuteCueRequest(BaseModel):
    fade: float = 0.0

@app.post("/api/cues/{cue_number}/execute")
async def execute_cue(cue_number: str, req: ExecuteCueRequest = None):
    if not re.match(r'^\d+(\.\d+)?$', cue_number.strip()):
        raise HTTPException(status_code=400, detail="큐 번호는 숫자 형식이어야 합니다.")
    fade = req.fade if req else 0.0
    return await send_and_log(cmd_goto_cue(cue_number, fade))


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

    results = await send_commands(commands)

    if req.fixture_numbers:
        state_update: dict = {"intensity": req.intensity}
        if req.color_preset and req.color_preset in COLOR_PRESETS:
            rgb = COLOR_PRESETS[req.color_preset]
            state_update["color"] = {"r": rgb[0], "g": rgb[1], "b": rgb[2]}
        elif req.color_rgb:
            state_update["color"] = req.color_rgb
        ai_update(req.fixture_numbers, state_update)

    return summarize_results(results)


@app.post("/api/wizard/position")
async def wizard_position(req: PositionRequest):
    commands = [cmd_pan(req.pan), cmd_tilt(req.tilt)]
    if req.focus is not None:
        commands.append(cmd_focus(req.focus))
    results = await send_commands(commands)
    if req.fixture_numbers:
        state_update: dict = {"pan": req.pan, "tilt": req.tilt}
        if req.focus is not None:
            state_update["focus"] = req.focus
        ai_update(req.fixture_numbers, state_update)
    return summarize_results(results)


@app.post("/api/wizard/effect")
async def wizard_effect(req: EffectRequest):
    mode = (req.mode or "none").lower()
    if mode == "none":
        commands = [cmd_effect_off()]
        state_update: dict = {"effect": {"mode": "none"}}
    elif mode == "strobe":
        strobe_val = 0 if req.strobe is None else int(req.strobe)
        commands = [cmd_strobe(strobe_val)]
        state_update = {"effect": {"mode": "strobe", "strobe": strobe_val}}
    elif mode == "slot":
        if req.slot is None or req.value is None:
            raise HTTPException(status_code=400, detail="slot 모드는 slot과 value가 필요합니다.")
        slot = int(req.slot)
        val = int(req.value)
        if not (1 <= slot <= 99):
            raise HTTPException(status_code=400, detail="slot은 1..99 범위여야 합니다.")
        if not (0 <= val <= 100):
            raise HTTPException(status_code=400, detail="value는 0..100 범위여야 합니다.")
        commands = [cmd_effect_slot(slot, val)]
        if req.tempo is not None:
            commands.append(cmd_effect_rate(max(0, min(100, int(req.tempo)))))
        if req.high is not None:
            commands.append(cmd_effect_high(max(0, min(100, int(req.high)))))
        if req.low is not None:
            commands.append(cmd_effect_low(max(0, min(100, int(req.low)))))
        state_update = {"effect": {"mode": "slot", "slot": slot, "value": val,
                                   "tempo": req.tempo, "high": req.high, "low": req.low}}
    else:
        raise HTTPException(status_code=400, detail=f"알 수 없는 mode: {req.mode}")
    results = await send_commands(commands)
    if req.fixture_numbers:
        ai_update(req.fixture_numbers, state_update)
    return summarize_results(results)


@app.post("/api/wizard/store-cue")
async def wizard_store_cue(req: StoreCueRequest):
    if not re.match(r'^\d+(\.\d+)?$', req.cue_number.strip()):
        raise HTTPException(status_code=400, detail="큐 번호는 숫자 형식이어야 합니다. (예: 1, 1.5)")
    return await send_and_log(cmd_store_cue(req.cue_number.strip()))


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


class QRequest(BaseModel):
    q: int = Field(..., ge=0, le=100)


@app.post("/api/wizard/q")
async def wizard_q(req: QRequest):
    return await send_and_log(cmd_q(req.q))


class AICommandRequest(BaseModel):
    text: str


async def _apply_fixture_group(group: dict, actions: list[str]) -> None:
    """scene_fixtures 배열의 단일 그룹을 실행하고 상태를 갱신한다."""
    fixtures: list[int] = group.get("fixtures") or []
    if not fixtures:
        return

    await send_and_log(cmd_select_fixtures(fixtures))
    actions.append(f"조명 {fixtures}번 선택")

    if group.get("intensity") is not None:
        await send_and_log(cmd_intensity(int(group["intensity"])))
        actions.append(f"밝기 {group['intensity']}%")

    color = group.get("color")
    if color:
        for cmd in cmd_color_rgb(int(color["r"]), int(color["g"]), int(color["b"])):
            await send_and_log(cmd)
        actions.append(f"색상 RGB({color['r']}, {color['g']}, {color['b']})")

    if group.get("pan") is not None:
        await send_and_log(cmd_pan(int(group["pan"])))
        actions.append(f"Pan {group['pan']}")

    if group.get("tilt") is not None:
        await send_and_log(cmd_tilt(int(group["tilt"])))
        actions.append(f"Tilt {group['tilt']}")

    if group.get("effect"):
        eff = group["effect"]
        eff_mode = (eff.get("mode") or "none").lower()
        if eff_mode == "strobe":
            await send_and_log(cmd_strobe(int(eff.get("strobe", 0))))
            actions.append(f"스트로브 {eff.get('strobe', 0)}")
        elif eff_mode == "slot":
            await send_and_log(cmd_effect_slot(int(eff["slot"]), int(eff["value"])))
            actions.append(f"Effect Slot {eff['slot']} @ {eff['value']}")
        elif eff_mode == "none":
            await send_and_log(cmd_effect_off())

    if group.get("store_cue"):
        try:
            await send_and_log(cmd_store_cue(str(group["store_cue"])))
            actions.append(f"큐 {group['store_cue']}번 저장")
        except ValueError as e:
            logger.warning(f"[AI] store_cue 건너뜀: {e}")

    ai_update(fixtures, group)


@app.post("/api/ai-command")
async def ai_command_endpoint(req: AICommandRequest):
    if not req.text.strip():
        return {"ok": False, "error": "명령을 입력해주세요."}
    try:
        parsed = await ai_parse(req.text)
    except Exception as exc:
        return {"ok": False, "error": f"AI 파싱 실패: {exc}"}

    actions: list[str] = []

    if parsed.get("mode") == "scene":
        scene_fixtures: list[dict] = parsed.get("scene_fixtures") or []
        if not scene_fixtures:
            return {"ok": False, "error": "씬 파싱 결과가 없습니다.", "parsed": parsed}
        for group in scene_fixtures:
            await _apply_fixture_group(group, actions)
        return {
            "ok": True,
            "explanation": parsed.get("explanation", ""),
            "actions": actions,
            "parsed": parsed,
        }

    # command 모드 (기존 로직)
    fixtures: list[int] = parsed.get("fixtures") or []

    if fixtures:
        await send_and_log(cmd_select_fixtures(fixtures))
        actions.append(f"조명 {fixtures}번 선택")

    if parsed.get("intensity") is not None:
        await send_and_log(cmd_intensity(int(parsed["intensity"])))
        actions.append(f"밝기 {parsed['intensity']}%")

    color = parsed.get("color")
    if color:
        for cmd in cmd_color_rgb(int(color["r"]), int(color["g"]), int(color["b"])):
            await send_and_log(cmd)
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

    if parsed.get("effect"):
        eff = parsed["effect"]
        eff_mode = (eff.get("mode") or "none").lower()
        if eff_mode == "strobe":
            await send_and_log(cmd_strobe(int(eff.get("strobe", 0))))
            actions.append(f"스트로브 {eff.get('strobe', 0)}")
        elif eff_mode == "slot":
            await send_and_log(cmd_effect_slot(int(eff["slot"]), int(eff["value"])))
            actions.append(f"Effect Slot {eff['slot']} @ {eff['value']}")
        elif eff_mode == "none":
            await send_and_log(cmd_effect_off())

    if parsed.get("store_cue"):
        try:
            await send_and_log(cmd_store_cue(str(parsed["store_cue"])))
            actions.append(f"큐 {parsed['store_cue']}번 저장")
        except ValueError as e:
            logger.warning(f"[AI] store_cue 건너뜀: {e}")

    ai_update(fixtures, parsed)

    return {
        "ok": True,
        "explanation": parsed.get("explanation", ""),
        "actions": actions,
        "parsed": parsed,
    }


_DANGEROUS_FIRST_TOKENS = frozenset([
    "delete", "clearall", "clear", "remove", "login", "logout",
])


def _validate_raw_command(command: str) -> None:
    if any(ch in command for ch in ('\r', '\n', ';')):
        raise HTTPException(
            status_code=400,
            detail="명령에 제어 문자(\\r, \\n) 또는 세미콜론을 포함할 수 없습니다."
        )
    tokens = command.strip().lower().split()
    if not tokens:
        raise HTTPException(status_code=400, detail="빈 명령입니다.")
    if tokens[0] in _DANGEROUS_FIRST_TOKENS:
        raise HTTPException(
            status_code=400,
            detail=f"위험 명령은 직접 전송할 수 없습니다: {command[:50]}"
        )
    if len(tokens) >= 2 and tokens[0] == "off" and tokens[1] == "all":
        raise HTTPException(
            status_code=400,
            detail="위험 명령은 직접 전송할 수 없습니다: off all"
        )


@app.post("/api/command")
async def raw_command(req: RawCommandRequest):
    _validate_raw_command(req.command)
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
    if not os.getenv("APP_DEBUG"):
        raise HTTPException(status_code=404, detail="Not found")
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


@app.get("/api/fixture-states")
async def fixture_states_endpoint():
    try:
        from ai_controller import get_state
    except ImportError:
        from .ai_controller import get_state
    return {"states": {str(i): get_state(i) for i in range(1, 11)}}


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
