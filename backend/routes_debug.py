# backend/routes_debug.py
from __future__ import annotations

import os
import sys
import platform
import re
from datetime import datetime
from typing import Dict, Any
from flask import jsonify, render_template, send_from_directory, request
import logging

logger = logging.getLogger(__name__)


def register_debug_routes(app, CONFIG: Dict[str, Any], LOG_FILE_PATH: str):
    """Регистрирует debug-панель и связанные /api/debug/* маршруты."""

    # -------- UI --------
    @app.route("/debug")
    def debug_panel():
        return render_template("debug.html")

    # -------- API: /api/debug/structure --------
    @app.route("/api/debug/structure")
    def api_debug_structure():
        """Возвращает **только** список файлов проекта (yaml / py / js)."""
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

        yaml_files: list[str] = []
        py_files: list[str] = []
        js_files: list[str] = []

        for root, dirs, files in os.walk(project_root):
            # Пропускаем виртуальное окружение, VCS и скрытые каталоги
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {'.venv', '.git', '__pycache__'}]
            for fname in files:
                path_rel = os.path.relpath(os.path.join(root, fname), project_root)
                if fname.endswith((".yaml", ".yml")):
                    yaml_files.append(path_rel)
                elif fname.endswith(".py"):
                    py_files.append(path_rel)
                elif fname.endswith(".js"):
                    js_files.append(path_rel)

        payload = {
            "yaml": sorted(yaml_files),
            "python": sorted(py_files),
            "js": sorted(js_files),
        }
        return jsonify(payload)

    # -------- API: /api/debug/modules --------
    @app.route("/api/debug/modules")
    def api_loaded_modules():
        try:
            modules = sorted(sys.modules.keys())
            return jsonify({"count": len(modules), "modules": modules})
        except Exception as e:  # pragma: no cover
            return jsonify({"error": str(e)}), 500

    # -------- API: /api/debug/logs --------
    @app.route("/api/debug/logs")
    def api_get_logs():
        log_file = LOG_FILE_PATH
        parsed_logs = []
        try:
            if os.path.exists(log_file):
                with open(log_file, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.readlines()[-300:]
                pattern = re.compile(r"^(?P<ts>[^ ]+ [^ ]+)\s+(?P<level>[A-Z]+)\s+(?P<logger>[^:]+):\s+(?P<msg>.*)$")
                for line in lines:
                    m = pattern.match(line.rstrip("\n"))
                    if m:
                        parsed_logs.append({
                            "timestamp": m["ts"],
                            "level": m["level"],
                            "message": m["msg"],
                        })
                    else:
                        parsed_logs.append({"timestamp": "", "level": "INFO", "message": line})
            else:
                parsed_logs.append({
                    "timestamp": datetime.now().isoformat(),
                    "level": "INFO",
                    "message": "Файл лога ещё не создан. Он появится при первом лог-сообщении.",
                })
        except Exception as e:  # pragma: no cover
            parsed_logs = [{"timestamp": datetime.now().isoformat(), "level": "ERROR", "message": str(e)}]
        return jsonify({"logs": parsed_logs, "path": log_file})

    # -------- API: /api/debug/routes --------
    @app.route("/api/debug/routes")
    def api_list_routes():
        include_debug = request.args.get("include_debug") == "1"
        collected: dict[str, set[str]] = {}
        for r in app.url_map.iter_rules():
            rule = str(r)
            if not rule.startswith("/api/"):
                continue  # интересуют только API
            if not include_debug and rule.startswith("/api/debug"):
                continue  # исключаем debug-api (если не запросили явно)
            methods = {m for m in (r.methods or []) if m not in {"HEAD", "OPTIONS"}}
            collected.setdefault(rule, set()).update(methods)

        routes = [
            {"rule": k, "methods": sorted(v)}
            for k, v in collected.items()
        ]
        routes_sorted = sorted(routes, key=lambda x: x["rule"])
        return jsonify(routes_sorted)
