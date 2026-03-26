import os

from backend import app  # noqa: E402  (создаётся при импорте backend)


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    debug = _parse_bool_env("LOWCODE_FLASK_DEBUG", False)
    use_reloader = _parse_bool_env("LOWCODE_FLASK_RELOADER", debug)
    host = os.getenv("LOWCODE_FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("LOWCODE_FLASK_PORT", "8000"))
    app.run(debug=debug, use_reloader=use_reloader, host=host, port=port)
