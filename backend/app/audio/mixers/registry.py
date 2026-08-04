from __future__ import annotations

from app.audio.mixers.allen_heath_driver import AllenHeathDriver
from app.audio.mixers.base_driver import MixerDriver
from app.audio.mixers.m32_driver import M32Driver
from app.audio.mixers.x32_driver import X32Driver
from app.audio.mixers.yamaha_driver import YamahaDriver


def get_mixer_driver(mixer_type: str) -> MixerDriver:
    normalized = (mixer_type or "").strip().lower().replace(" ", "_").replace("&", "")
    if normalized in {"midas_m32", "m32", "midas"}:
        return M32Driver()
    if normalized in {"allen_heath", "allenheath", "allen_&_heath"}:
        return AllenHeathDriver()
    if normalized in {"yamaha", "cl5", "ql5", "tf5"}:
        return YamahaDriver()
    if normalized in {"behringer_x32", "x32", "behringer"}:
        return X32Driver()
    return X32Driver()
