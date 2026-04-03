import os

from backend import create_app  # noqa: E402


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    app = create_app()
    debug = _parse_bool_env("YAMLS_FLASK_DEBUG", False)
    use_reloader = _parse_bool_env("YAMLS_FLASK_RELOADER", debug)
    host = os.getenv("YAMLS_FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("YAMLS_FLASK_PORT", "8000"))
    app.run(debug=debug, use_reloader=use_reloader, host=host, port=port)
