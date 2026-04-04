"""Guarded registration for the optional Sudoku feature."""

from __future__ import annotations

from typing import Any

from flask import abort, jsonify, render_template_string, request, send_from_directory

from . import WEB_DIR, is_sudoku_available
from .engine import DIFFICULTY_HINTS, blank_board, copy_board, generate_puzzle, solve_puzzle, validate_puzzle
from .storage import load_saved_board, load_users_data, normalize_users_data, save_saved_board, save_users_data


def register_sudoku(app) -> None:
    if app.extensions.get("sudoku_registered"):
        return
    app.extensions["sudoku_registered"] = True

    template_path = WEB_DIR / "index.html"

    def ensure_available_or_404() -> None:
        if not is_sudoku_available():
            abort(404)

    def json_success(data: dict[str, Any] | None = None, message: str | None = None):
        payload: dict[str, Any] = {"ok": True}
        if data is not None:
            payload["data"] = data
        if message is not None:
            payload["message"] = message
        return jsonify(payload)

    def json_error(message: str, status: int = 200):
        return jsonify({"ok": False, "message": message}), status

    def payload_json() -> dict[str, Any]:
        payload = request.get_json(silent=True)
        return payload if isinstance(payload, dict) else {}

    @app.route("/sudoku")
    def sudoku_page():
        try:
            ensure_available_or_404()
            template_source = template_path.read_text(encoding="utf-8")
            return render_template_string(
                template_source,
                debug_tooling_enabled=bool(app.config.get("DEBUG_TOOLING_ENABLED")),
                header_active="sudoku",
            )
        except Exception:
            abort(404)

    @app.route("/sudoku/assets/<path:filename>")
    def sudoku_asset(filename: str):
        try:
            ensure_available_or_404()
            return send_from_directory(str(WEB_DIR), filename)
        except Exception:
            abort(404)

    @app.route("/sudoku/api/bootstrap")
    def sudoku_api_bootstrap():
        ensure_available_or_404()
        try:
            return json_success(
                {
                    "usersData": load_users_data(),
                    "savedBoard": load_saved_board(),
                    "board": blank_board(),
                    "difficultyOptions": list(DIFFICULTY_HINTS.keys()),
                    "difficultyHints": DIFFICULTY_HINTS,
                    "initialDifficulty": "средний",
                    "toggles": {
                        "highlightLines": False,
                        "showHints": False,
                        "highlightAnswers": False,
                    },
                    "consoleVisible": True,
                }
            )
        except Exception:
            return json_error("Не удалось подготовить Sudoku.")

    @app.route("/sudoku/api/users", methods=["POST"])
    def sudoku_api_users():
        ensure_available_or_404()
        try:
            payload = payload_json()
            action = str(payload.get("action") or "").strip().lower()
            users_data = load_users_data()

            if action == "create":
                username = str(payload.get("username") or "").strip()
                if not username:
                    return json_success({"usersData": users_data, "currentUser": None})
                if username not in users_data:
                    users_data[username] = {"games": 0, "wins": 0, "win_rate": 0.0}
                    users_data = save_users_data(users_data)
                    return json_success(
                        {"usersData": users_data, "currentUser": username},
                        f"Создан новый пользователь: {username}",
                    )
                return json_success(
                    {"usersData": users_data, "currentUser": username},
                    f'Пользователь "{username}" уже существует!',
                )

            if action == "sync":
                normalized_users = save_users_data(payload.get("usersData"))
                current_user_raw = payload.get("currentUser")
                current_user = str(current_user_raw).strip() if current_user_raw is not None else ""
                if current_user and current_user not in normalized_users:
                    current_user = ""
                return json_success(
                    {
                        "usersData": normalized_users,
                        "currentUser": current_user or None,
                    }
                )

            return json_error("Неизвестная операция с пользователями.")
        except Exception:
            return json_error("Не удалось обработать пользователей.")

    @app.route("/sudoku/api/generate", methods=["POST"])
    def sudoku_api_generate():
        ensure_available_or_404()
        try:
            payload = payload_json()
            current_user_raw = payload.get("currentUser")
            current_user = str(current_user_raw).strip() if current_user_raw is not None else ""
            result = generate_puzzle(
                str(payload.get("difficulty") or ""),
                current_user=current_user or None,
                users_data=load_users_data(),
            )
            if not result.get("ok"):
                return json_error(str(result.get("message") or "Не удалось сгенерировать головоломку."))

            users_data = normalize_users_data(result.get("users_data"))
            if current_user:
                users_data = save_users_data(users_data)

            return json_success(
                {
                    "cellValues": result.get("cell_values"),
                    "solvedCache": result.get("solved_cache"),
                    "solvedCacheField": result.get("solved_cache_field"),
                    "solutionMap": result.get("solution_map"),
                    "solutionMapReady": result.get("solution_map_ready"),
                    "solutionMapField": result.get("solution_map_field"),
                    "usersData": users_data,
                    "puzzleSolved": result.get("puzzle_solved"),
                },
                str(result.get("message") or ""),
            )
        except Exception:
            return json_error("Не удалось сгенерировать головоломку.")

    @app.route("/sudoku/api/validate", methods=["POST"])
    def sudoku_api_validate():
        ensure_available_or_404()
        try:
            payload = payload_json()
            result = validate_puzzle(payload.get("board"))
            if not result.get("ok"):
                return json_error(str(result.get("message") or "Валидация завершилась ошибкой."))
            return json_success(
                {
                    "solutionMap": result.get("solution_map"),
                    "solutionMapReady": result.get("solution_map_ready"),
                },
                str(result.get("message") or ""),
            )
        except Exception:
            return json_error("Не удалось выполнить валидацию.")

    @app.route("/sudoku/api/solve", methods=["POST"])
    def sudoku_api_solve():
        ensure_available_or_404()
        try:
            payload = payload_json()
            current_user_raw = payload.get("currentUser")
            current_user = str(current_user_raw).strip() if current_user_raw is not None else ""
            result = solve_puzzle(
                payload.get("board"),
                current_user=current_user or None,
                solution_map=payload.get("solutionMap"),
                solution_map_ready=bool(payload.get("solutionMapReady")),
            )
            if not result.get("ok"):
                return json_error(str(result.get("message") or "Решение не найдено."))
            solved_board = copy_board(result.get("cell_values"))
            return json_success(
                {
                    "cellValues": solved_board,
                    "solvedCache": result.get("solved_cache") or solved_board,
                    "solvedCacheField": result.get("solved_cache_field") or solved_board,
                    "puzzleSolved": bool(result.get("puzzle_solved")),
                },
                str(result.get("message") or ""),
            )
        except Exception:
            return json_error("Не удалось решить Sudoku.")

    @app.route("/sudoku/api/save", methods=["POST"])
    def sudoku_api_save():
        ensure_available_or_404()
        try:
            payload = payload_json()
            saved_board = save_saved_board(payload.get("board"))
            return json_success({"cellValues": saved_board}, "Сохранено!")
        except Exception:
            return json_error("Не удалось сохранить игру.")

    @app.route("/sudoku/api/load")
    def sudoku_api_load():
        ensure_available_or_404()
        try:
            saved_board = load_saved_board()
            return json_success({"cellValues": saved_board}, "Загружено!")
        except Exception as exc:
            return json_error(f"Ошибка загрузки: {exc}")
