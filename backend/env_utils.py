"""Environment parsing helpers shared by app entry points."""

from __future__ import annotations

import os


TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def parse_bool_env(
    name: str,
    default: bool | None = None,
    *,
    invalid_default: bool | None = None,
) -> bool | None:
    raw = os.getenv(name)
    if raw is None:
        return default

    value = raw.strip().lower()
    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False
    return default if invalid_default is None else invalid_default
