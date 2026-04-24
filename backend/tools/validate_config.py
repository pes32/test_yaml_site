"""CLI-валидация YAML-конфигурации без запуска UI."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.config_shared import ConfigLoadError, ROOT_DIR
from backend.config_snapshot import build_config_snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Валидация YAML-конфигурации YAML System snapshot")
    parser.add_argument(
        "--pages-dir",
        default=str(Path(ROOT_DIR) / "pages"),
        help="Путь к каталогу pages/",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Печатать результат в JSON",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        snapshot = build_config_snapshot(args.pages_dir)
    except ConfigLoadError as exc:
        if args.json:
            print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        else:
            print(f"ERROR: {exc}")
        return 1

    result = {
        "ok": True,
        "snapshot_version": snapshot.get("meta", {}).get("version"),
        "page_count": len(snapshot.get("pages") or {}),
        "diagnostics": snapshot.get("diagnostics") or [],
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"OK: snapshot_version={result['snapshot_version']} page_count={result['page_count']}")
    if result["diagnostics"]:
        print("Diagnostics:")
        for item in result["diagnostics"]:
            level = item.get("level", "info").upper()
            code = item.get("code", "unknown")
            message = item.get("message", "")
            page = item.get("page")
            file_path = item.get("file")
            location = " ".join(part for part in [page and f"page={page}", file_path and f"file={file_path}"] if part)
            if location:
                print(f"- {level} {code}: {message} ({location})")
            else:
                print(f"- {level} {code}: {message}")
    else:
        print("Diagnostics: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
