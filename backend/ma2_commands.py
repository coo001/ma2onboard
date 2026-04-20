"""
grandMA2 command builders.

Notes:
- Color mixing attributes in grandMA2 are typically addressed as ColorRGB1, ColorRGB2, ColorRGB3.
- The exact attribute set still depends on the loaded fixture profile.
- Value range is currently treated as percent-based 0..100.
"""

from typing import List


def cmd_select_fixtures(fixture_numbers: List[int]) -> str:
    nums = " + ".join(str(number) for number in fixture_numbers)
    return f"Fixture {nums}"


def cmd_intensity(value: int) -> str:
    value = max(0, min(100, value))
    return f"At {value}"


def cmd_color_rgb(r: int, g: int, b: int) -> List[str]:
    r, g, b = (max(0, min(100, value)) for value in (r, g, b))
    return [
        f'Attribute "ColorRGB1" At {r}',
        f'Attribute "ColorRGB2" At {g}',
        f'Attribute "ColorRGB3" At {b}',
    ]


COLOR_PRESETS = {
    "Red": (100, 0, 0),
    "Green": (0, 100, 0),
    "Blue": (0, 0, 100),
    "White": (100, 100, 100),
    "Amber": (100, 60, 0),
    "Magenta": (100, 0, 100),
}


def cmd_color_preset(name: str) -> List[str]:
    rgb = COLOR_PRESETS.get(name, (100, 100, 100))
    return cmd_color_rgb(*rgb)


def cmd_pan(value: int) -> str:
    value = max(0, min(100, value))
    return 'Attribute "Pan" At {value}'.format(value=value)


def cmd_tilt(value: int) -> str:
    value = max(0, min(100, value))
    return 'Attribute "Tilt" At {value}'.format(value=value)


def cmd_focus(value: int) -> str:
    value = max(0, min(100, value))
    return 'Attribute "Focus" At {value}'.format(value=value)


def cmd_store_cue(cue_number: str) -> str:
    return f"Store Cue {cue_number}"


def cmd_clear_all() -> str:
    return "Clear"


def cmd_clear_selection() -> str:
    return "Clear"


def cmd_off_fixtures(fixture_numbers: List[int]) -> str:
    nums = " + ".join(str(number) for number in fixture_numbers)
    return f"Off Fixture {nums}"


def cmd_delete_cue(cue_number: str) -> str:
    return f"Delete Cue {cue_number}"


def cmd_save_show() -> str:
    return "SaveShow"
