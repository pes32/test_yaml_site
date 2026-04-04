"""Sudoku engine and long-running operations."""

from __future__ import annotations

import copy
import multiprocessing
import random
from typing import Any


GRID_SIZE = 9
SQUARE_SIZE = 3
SOLVER_TIMEOUT_SECONDS = 10

DIFFICULTY_HINTS: dict[str, tuple[int, int]] = {
    "лёгкий": (29, 31),
    "средний": (25, 26),
    "сложный": (21, 23),
    "мамкино дупло": (17, 19),
}


def blank_board() -> list[list[int]]:
    return [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]


def coerce_board(value: Any) -> list[list[int]]:
    if not isinstance(value, list) or len(value) != GRID_SIZE:
        return blank_board()

    normalized: list[list[int]] = []
    for row in value:
        if not isinstance(row, list) or len(row) != GRID_SIZE:
            return blank_board()
        normalized_row: list[int] = []
        for cell in row:
            try:
                number = int(cell)
            except (TypeError, ValueError):
                return blank_board()
            if number < 0 or number > GRID_SIZE:
                return blank_board()
            normalized_row.append(number)
        normalized.append(normalized_row)
    return normalized


def copy_board(board: Any) -> list[list[int]]:
    return [row[:] for row in coerce_board(board)]


def _recalculate_win_rate(record: dict[str, Any]) -> dict[str, Any]:
    games = max(0, int(record.get("games", 0)))
    wins = max(0, int(record.get("wins", 0)))
    win_rate = (wins / games) * 100 if games > 0 else 0.0
    return {
        "games": games,
        "wins": wins,
        "win_rate": win_rate,
    }


def increment_games(users_data: dict[str, Any], current_user: str | None) -> dict[str, Any]:
    updated = copy.deepcopy(users_data if isinstance(users_data, dict) else {})
    if not current_user:
        return updated

    record = dict(updated.get(current_user) or {"games": 0, "wins": 0, "win_rate": 0.0})
    record["games"] = int(record.get("games", 0)) + 1
    updated[current_user] = _recalculate_win_rate(record)
    return updated


def increment_wins(users_data: dict[str, Any], current_user: str | None) -> dict[str, Any]:
    updated = copy.deepcopy(users_data if isinstance(users_data, dict) else {})
    if not current_user:
        return updated

    record = dict(updated.get(current_user) or {"games": 0, "wins": 0, "win_rate": 0.0})
    record["wins"] = int(record.get("wins", 0)) + 1
    updated[current_user] = _recalculate_win_rate(record)
    return updated


def sudoku_solver_worker(board: list[list[int]], queue) -> None:
    try:
        solved, solved_board = solve_sudoku_func(board)
        queue.put((solved, solved_board, None))
    except Exception as exc:  # pragma: no cover - worker isolation
        queue.put((False, None, str(exc)))


def solve_sudoku_func(board: Any) -> tuple[bool, list[list[int]] | None]:
    """MRV-based solver copied from the desktop version."""

    board_copy = copy_board(board)

    def remove_candidates(
        board_state: list[list[int]],
        candidates: list[list[set[int]]],
        row: int,
        col: int,
        number: int,
    ) -> None:
        for index in range(GRID_SIZE):
            if board_state[row][index] == 0 and number in candidates[row][index]:
                candidates[row][index].remove(number)
            if board_state[index][col] == 0 and number in candidates[index][col]:
                candidates[index][col].remove(number)

        block_row = (row // SQUARE_SIZE) * SQUARE_SIZE
        block_col = (col // SQUARE_SIZE) * SQUARE_SIZE
        for delta_row in range(SQUARE_SIZE):
            for delta_col in range(SQUARE_SIZE):
                next_row = block_row + delta_row
                next_col = block_col + delta_col
                if board_state[next_row][next_col] == 0 and number in candidates[next_row][next_col]:
                    candidates[next_row][next_col].remove(number)

    candidates = [[set(range(1, 10)) for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            if board_copy[row][col] != 0:
                candidates[row][col] = set()
                remove_candidates(board_copy, candidates, row, col, board_copy[row][col])

    def backtrack() -> bool:
        nonlocal candidates

        min_candidates = 10
        best_row, best_col = -1, -1
        for row in range(GRID_SIZE):
            for col in range(GRID_SIZE):
                if board_copy[row][col] == 0 and len(candidates[row][col]) < min_candidates:
                    min_candidates = len(candidates[row][col])
                    best_row, best_col = row, col
                    if min_candidates == 1:
                        break
            if min_candidates == 1:
                break

        if min_candidates == 10:
            return True
        if min_candidates == 0:
            return False

        for number in list(candidates[best_row][best_col]):
            board_copy[best_row][best_col] = number
            old_candidates = copy.deepcopy(candidates)
            remove_candidates(board_copy, candidates, best_row, best_col, number)
            if backtrack():
                return True

            board_copy[best_row][best_col] = 0
            for row in range(GRID_SIZE):
                for col in range(GRID_SIZE):
                    candidates[row][col] = old_candidates[row][col].copy()
        return False

    if backtrack():
        return True, board_copy
    return False, None


def is_valid(board: list[list[int]], row: int, col: int, number: int) -> bool:
    for index in range(GRID_SIZE):
        if board[row][index] == number or board[index][col] == number:
            return False

    block_row = (row // SQUARE_SIZE) * SQUARE_SIZE
    block_col = (col // SQUARE_SIZE) * SQUARE_SIZE
    for delta_row in range(SQUARE_SIZE):
        for delta_col in range(SQUARE_SIZE):
            if board[block_row + delta_row][block_col + delta_col] == number:
                return False
    return True


def solve_sudoku(board: list[list[int]]) -> bool:
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            if board[row][col] == 0:
                for number in range(1, 10):
                    if is_valid(board, row, col, number):
                        board[row][col] = number
                        if solve_sudoku(board):
                            return True
                        board[row][col] = 0
                return False
    return True


def solve_sudoku_with_timeout(
    board: Any,
    timeout_sec: int = SOLVER_TIMEOUT_SECONDS,
) -> tuple[bool, list[list[int]] | None, str | None]:
    normalized_board = copy_board(board)
    context = multiprocessing.get_context("spawn")
    queue = context.Queue()
    process = context.Process(target=sudoku_solver_worker, args=(normalized_board, queue))
    process.start()
    process.join(timeout=timeout_sec)

    if process.is_alive():
        process.terminate()
        process.join()
        return False, None, f"Таймаут {timeout_sec} секунд: решение не найдено."

    try:
        solved, solved_board, error = queue.get_nowait()
    except Exception as exc:  # pragma: no cover - IPC edge case
        return False, None, f"Ошибка получения результата: {exc}"

    if solved and solved_board is not None:
        return True, copy_board(solved_board), None
    return False, None, error


def generate_solved_board() -> list[list[int]]:
    board = blank_board()
    numbers = list(range(1, 10))
    random.shuffle(numbers)
    board[0] = numbers
    solve_sudoku(board)
    return board


def generate_puzzle(
    difficulty: str | None,
    current_user: str | None = None,
    users_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    difficulty_name = difficulty if difficulty in DIFFICULTY_HINTS else "средний"
    min_hints, max_hints = DIFFICULTY_HINTS[difficulty_name]

    for _attempt in range(3):
        solved_board = generate_solved_board()
        puzzle_board = copy.deepcopy(solved_board)
        positions = [(row, col) for row in range(GRID_SIZE) for col in range(GRID_SIZE)]
        random.shuffle(positions)
        removed_count = 0
        target_removed = 81 - random.randint(min_hints, max_hints)

        for row, col in positions:
            if removed_count >= target_removed:
                break

            symmetric_row = GRID_SIZE - 1 - row
            symmetric_col = GRID_SIZE - 1 - col

            if puzzle_board[row][col] != 0:
                puzzle_board[row][col] = 0
                removed_count += 1

            if (symmetric_row, symmetric_col) != (row, col) and puzzle_board[symmetric_row][symmetric_col] != 0:
                puzzle_board[symmetric_row][symmetric_col] = 0
                removed_count += 1

        solved, solution_map, _reason = solve_sudoku_with_timeout(puzzle_board, SOLVER_TIMEOUT_SECONDS)
        if not solved or solution_map is None:
            continue

        canonical_solution = copy_board(solution_map)
        actual_hints = sum(1 for row in range(GRID_SIZE) for col in range(GRID_SIZE) if puzzle_board[row][col] != 0)
        updated_users = increment_games(users_data or {}, current_user)
        message = (
            f'Сгенерирована головоломка уровня "{difficulty_name}" '
            f"с {actual_hints} подсказками (диапазон: {min_hints}-{max_hints})"
        )
        if current_user:
            message += f"\nНовая игра для пользователя {current_user}"

        return {
            "ok": True,
            "message": message,
            "cell_values": copy_board(puzzle_board),
            "solved_cache": canonical_solution,
            "solved_cache_field": copy_board(puzzle_board),
            "solution_map": canonical_solution,
            "solution_map_ready": True,
            "solution_map_field": copy_board(puzzle_board),
            "users_data": updated_users,
            "puzzle_solved": False,
        }

    return {
        "ok": False,
        "message": "Не удалось сгенерировать решаемую головоломку. Попробуйте еще раз.",
    }


def validate_puzzle(board: Any) -> dict[str, Any]:
    normalized_board = copy_board(board)
    solved, solution_map, reason = solve_sudoku_with_timeout(normalized_board, SOLVER_TIMEOUT_SECONDS)
    if solved and solution_map is not None:
        return {
            "ok": True,
            "message": "Валидация: карта решений построена, ошибки будут подсвечены.",
            "solution_map": copy_board(solution_map),
            "solution_map_ready": True,
        }

    message = "Валидация: не удалось построить решение для текущего поля."
    if reason:
        message += f"\nПричина ошибки: {reason}"
    return {
        "ok": False,
        "message": message,
    }


def solve_puzzle(
    board: Any,
    current_user: str | None = None,
    solution_map: Any | None = None,
    solution_map_ready: bool = False,
) -> dict[str, Any]:
    source_board = copy_board(board)
    if solution_map_ready:
        cached_solution = copy_board(solution_map)
        if cached_solution != blank_board():
            message = (
                f"Лох, гей, нет друзей. Пользователь {current_user} не смог судоку решить..."
                if current_user
                else "Решение взято из кэша"
            )
            return {
                "ok": True,
                "message": message,
                "cell_values": cached_solution,
                "solved_cache": copy_board(cached_solution),
                "solved_cache_field": source_board,
                "puzzle_solved": True,
            }

    solved, solved_board, reason = solve_sudoku_with_timeout(board, SOLVER_TIMEOUT_SECONDS)
    if solved and solved_board is not None:
        message = (
            f"Лох, гей, нет друзей. Пользователь {current_user} не смог судоку решить..."
            if current_user
            else "Судоку решено."
        )
        return {
            "ok": True,
            "message": message,
            "cell_values": copy_board(solved_board),
            "solved_cache": copy_board(solved_board),
            "solved_cache_field": source_board,
            "puzzle_solved": True,
        }

    message = "Решение не найдено или превышен таймаут!"
    if reason:
        message += f"\nПричина ошибки: {reason}"
    return {
        "ok": False,
        "message": message,
    }


__all__ = [
    "DIFFICULTY_HINTS",
    "GRID_SIZE",
    "SQUARE_SIZE",
    "SOLVER_TIMEOUT_SECONDS",
    "blank_board",
    "coerce_board",
    "copy_board",
    "generate_puzzle",
    "generate_solved_board",
    "increment_games",
    "increment_wins",
    "is_valid",
    "solve_puzzle",
    "solve_sudoku",
    "solve_sudoku_func",
    "solve_sudoku_with_timeout",
    "sudoku_solver_worker",
    "validate_puzzle",
]
