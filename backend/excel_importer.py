"""
Excel cue sheet parser and validator.
Pure module — no FastAPI/telnet imports. No side effects.
"""

import io
import re
import tempfile
from pathlib import Path
from typing import Optional

import openpyxl
from openpyxl.styles import Font

CUE_NUMBER_RE = re.compile(r"^\d+(\.\d+)?$")

TEMPLATE_COLUMNS = [
    "cue", "label", "fixtures", "intensity",
    "color_r", "color_g", "color_b",
    "pan", "tilt", "focus", "strobe",
    "effect_slot", "effect_value", "effect_rate",
]

HEADER_ALIASES = {
    "큐번호": "cue", "큐": "cue", "cue": "cue",
    "이름": "label", "레이블": "label", "label": "label",
    "조명": "fixtures", "픽스처": "fixtures", "fixtures": "fixtures",
    "밝기": "intensity", "intensity": "intensity",
    "r": "color_r", "color_r": "color_r",
    "g": "color_g", "color_g": "color_g",
    "b": "color_b", "color_b": "color_b",
    "팬": "pan", "pan": "pan",
    "틸트": "tilt", "tilt": "tilt",
    "포커스": "focus", "줌": "focus", "focus": "focus",
    "스트로브": "strobe", "strobe": "strobe",
    "이펙트슬롯": "effect_slot", "effect_slot": "effect_slot",
    "이펙트값": "effect_value", "effect_value": "effect_value",
    "이펙트속도": "effect_rate", "effect_rate": "effect_rate",
}


class RowValidationError(Exception):
    def __init__(self, column: str, message: str):
        self.column = column
        self.message = message
        super().__init__(message)


def _normalize_header(raw: str) -> Optional[str]:
    return HEADER_ALIASES.get(str(raw).strip().lower())


def _parse_cue_number(value) -> str:
    if value is None or str(value).strip() == "":
        raise RowValidationError("cue", "큐번호가 비어있습니다.")
    if isinstance(value, float):
        value = str(int(value)) if value == int(value) else str(value)
    else:
        value = str(value).strip()
    if re.match(r"^\d+\.0$", value):
        value = value[:-2]
    if not CUE_NUMBER_RE.match(value):
        raise RowValidationError("cue", f"큐번호 형식 오류: '{value}' (예: 1, 1.5, 220)")
    return value


def _parse_fixtures(raw) -> list:
    if raw is None or str(raw).strip() == "":
        raise RowValidationError("fixtures", "조명 번호가 비어있습니다.")
    raw = str(raw).strip()
    result = set()
    for token in re.split(r"[,\s]+", raw):
        token = token.strip()
        if not token:
            continue
        if re.match(r"^\d+$", token):
            result.add(int(token))
        elif re.match(r"^\d+-\d+$", token):
            a, b = token.split("-")
            a, b = int(a), int(b)
            if a > b:
                raise RowValidationError("fixtures", f"범위 오류: {token} (시작이 끝보다 큼)")
            result.update(range(a, b + 1))
        else:
            raise RowValidationError("fixtures", f"조명 형식 오류: '{token}' (예: 1,2,5-7)")
    if not result:
        raise RowValidationError("fixtures", "유효한 조명 번호가 없습니다.")
    return sorted(result)


def _parse_int_range(value, field: str, lo: int = 0, hi: int = 100) -> Optional[int]:
    if value is None or str(value).strip() == "":
        return None
    try:
        v = int(float(str(value)))
    except (ValueError, TypeError):
        raise RowValidationError(field, f"{field} 값이 숫자가 아닙니다: '{value}'")
    if not (lo <= v <= hi):
        raise RowValidationError(field, f"{field} 범위 오류({lo}-{hi}): {v}")
    return v


def _validate_row(col_map: dict, row_values: dict, row_index: int) -> dict:
    def get(key):
        idx = col_map.get(key)
        return row_values.get(idx) if idx is not None else None

    cue = _parse_cue_number(get("cue"))
    label = str(get("label") or "").strip()[:40]
    fixtures = _parse_fixtures(get("fixtures"))
    intensity = _parse_int_range(get("intensity"), "intensity")
    pan = _parse_int_range(get("pan"), "pan")
    tilt = _parse_int_range(get("tilt"), "tilt")
    focus = _parse_int_range(get("focus"), "focus")
    strobe = _parse_int_range(get("strobe"), "strobe")
    effect_slot = _parse_int_range(get("effect_slot"), "effect_slot", 1, 99)
    effect_value = _parse_int_range(get("effect_value"), "effect_value")
    effect_rate = _parse_int_range(get("effect_rate"), "effect_rate")

    r = _parse_int_range(get("color_r"), "color_r")
    g = _parse_int_range(get("color_g"), "color_g")
    b = _parse_int_range(get("color_b"), "color_b")
    color_parts = [r, g, b]
    if any(v is not None for v in color_parts):
        if any(v is None for v in color_parts):
            raise RowValidationError("color_r/g/b", "color_r, color_g, color_b는 모두 함께 제공해야 합니다.")
        color = {"r": r, "g": g, "b": b}
    else:
        color = None

    effect = None
    if effect_slot is not None and effect_value is not None:
        effect = {"mode": "slot", "slot": effect_slot, "value": effect_value, "rate": effect_rate}
    elif strobe is not None:
        effect = {"mode": "strobe", "strobe": strobe}

    return {
        "row_index": row_index,
        "cue": cue,
        "label": label,
        "fixtures": fixtures,
        "intensity": intensity,
        "color": color,
        "pan": pan,
        "tilt": tilt,
        "focus": focus,
        "effect": effect,
    }


def parse_workbook(file_bytes: bytes) -> tuple:
    """Returns (rows, errors). rows = validated, errors = [{row_index, column, message}]."""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception as e:
        raise ValueError(f"xlsx 파일을 읽을 수 없습니다: {e}")

    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not all_rows:
        raise ValueError("파일이 비어있습니다.")

    header_row = all_rows[0]
    col_map: dict = {}
    for i, cell in enumerate(header_row):
        if cell is None:
            continue
        norm = _normalize_header(str(cell))
        if norm and norm not in col_map:
            col_map[norm] = i

    if "cue" not in col_map:
        raise ValueError("'cue' 또는 '큐번호' 헤더 컬럼이 없습니다.")
    if "fixtures" not in col_map:
        raise ValueError("'fixtures' 또는 '조명' 헤더 컬럼이 없습니다.")

    rows: list = []
    errors: list = []

    for row_i, row in enumerate(all_rows[1:], start=2):
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        row_values = {i: v for i, v in enumerate(row)}
        try:
            parsed = _validate_row(col_map, row_values, row_i)
            rows.append(parsed)
        except RowValidationError as e:
            errors.append({"row_index": row_i, "column": e.column, "message": e.message})

    return rows, errors


def build_commands(row: dict) -> list:
    """검증된 행을 MA2 Telnet 명령어 리스트로 변환."""
    try:
        from .ma2_commands import (
            cmd_select_fixtures, cmd_intensity, cmd_color_rgb,
            cmd_pan, cmd_tilt, cmd_focus, cmd_strobe,
            cmd_effect_slot, cmd_effect_rate, cmd_effect_off,
            cmd_store_cue, cmd_clear_all,
        )
    except ImportError:
        from ma2_commands import (
            cmd_select_fixtures, cmd_intensity, cmd_color_rgb,
            cmd_pan, cmd_tilt, cmd_focus, cmd_strobe,
            cmd_effect_slot, cmd_effect_rate, cmd_effect_off,
            cmd_store_cue, cmd_clear_all,
        )
    cmds: list = []
    cmds.append(cmd_clear_all())
    cmds.append(cmd_select_fixtures(row["fixtures"]))
    if row.get("intensity") is not None:
        cmds.append(cmd_intensity(row["intensity"]))
    if row.get("color"):
        c = row["color"]
        cmds.extend(cmd_color_rgb(c["r"], c["g"], c["b"]))
    if row.get("pan") is not None:
        cmds.append(cmd_pan(row["pan"]))
    if row.get("tilt") is not None:
        cmds.append(cmd_tilt(row["tilt"]))
    if row.get("focus") is not None:
        cmds.append(cmd_focus(row["focus"]))
    eff = row.get("effect")
    if eff:
        if eff["mode"] == "strobe":
            cmds.append(cmd_strobe(eff["strobe"]))
        elif eff["mode"] == "slot":
            cmds.append(cmd_effect_slot(eff["slot"], eff["value"]))
            if eff.get("rate") is not None:
                cmds.append(cmd_effect_rate(eff["rate"]))
    else:
        cmds.append(cmd_effect_off())
    cmds.append(cmd_store_cue(row["cue"]))
    return cmds


def generate_template_xlsx(path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cues"
    ws.append(TEMPLATE_COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.append(["1", "오프닝", "1-4", 80, 100, 0, 0, 50, 50, "", "", "", "", ""])
    ws.append(["2", "블루워시", "5,6,7", 60, 0, 0, 100, "", "", "", "", "", "", ""])
    wb.save(path)
