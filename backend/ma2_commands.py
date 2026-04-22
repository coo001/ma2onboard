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
    return 'Attribute "Zoom" At {value}'.format(value=value)


def cmd_store_cue(cue_number: str) -> str:
    return f"Store Cue {cue_number}"


def cmd_delete_cue(cue_number: str) -> str:
    return f"Delete Cue {cue_number}"


def cmd_goto_cue(cue_number: str, fade: float = 0.0) -> str:
    if fade > 0:
        return f"Goto Cue {cue_number} Fade {fade}"
    return f"Goto Cue {cue_number}"


def cmd_clear_all() -> str:
    return "Clear"


def cmd_clear_selection() -> str:
    return "Clear"


def cmd_off_fixtures(fixture_numbers: List[int]) -> str:
    nums = " + ".join(str(number) for number in fixture_numbers)
    return f"Off Fixture {nums}"


def cmd_q(value: int) -> str:
    value = max(0, min(100, value))
    return f'Attribute "Q" At {value}'


def cmd_strobe(value: int) -> str:
    """Strobe speed via Shutter attribute. 0 = off, 100 = fastest."""
    value = max(0, min(100, value))
    return f'Attribute "Shutter" At {value}'


def cmd_effect_slot(slot: int, value: int) -> str:
    """Run a pre-saved Effect pool entry. slot: 1..99, value: 0..100."""
    slot = max(1, min(99, slot))
    value = max(0, min(100, value))
    return f"Effect {slot} At {value}"


def cmd_effect_off() -> str:
    """Release effects on currently selected fixtures."""
    return "Off Effect"


def cmd_effect_rate(value: int) -> str:
    """Effect tempo/rate. 0..100 percent of max speed."""
    value = max(0, min(100, value))
    return f'Attribute "EffRate" At {value}'


def cmd_effect_high(value: int) -> str:
    """Effect high boundary. 0..100."""
    value = max(0, min(100, value))
    return f'Attribute "EffHigh" At {value}'


def cmd_effect_low(value: int) -> str:
    """Effect low boundary. 0..100."""
    value = max(0, min(100, value))
    return f'Attribute "EffLow" At {value}'
