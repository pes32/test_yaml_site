"""Optional Sudoku feature package."""

from __future__ import annotations

from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parent
WEB_DIR = PACKAGE_DIR / "web"

REQUIRED_PATHS = (
    PACKAGE_DIR / "__init__.py",
    PACKAGE_DIR / "registrar.py",
    PACKAGE_DIR / "engine.py",
    WEB_DIR / "index.html",
    WEB_DIR / "style.css",
    WEB_DIR / "app.js",
)


def _can_read_text(path: Path) -> bool:
    try:
        path.read_text(encoding="utf-8")
    except OSError:
        return False
    return True


def _python_source_is_valid(path: Path) -> bool:
    try:
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec")
    except (OSError, SyntaxError, ValueError):
        return False
    return True


def is_sudoku_available() -> bool:
    """Fail-closed feature availability check with no side effects."""

    for path in REQUIRED_PATHS:
        if not path.is_file():
            return False
        if path.suffix == ".py":
            if not _python_source_is_valid(path):
                return False
            continue
        if not _can_read_text(path):
            return False
    return True


__all__ = [
    "PACKAGE_DIR",
    "WEB_DIR",
    "REQUIRED_PATHS",
    "is_sudoku_available",
]
