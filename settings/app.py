import os

from backend import create_app  # noqa: E402
from backend.env_utils import parse_bool_env


if __name__ == "__main__":
    app = create_app()
    debug = parse_bool_env("YAMLS_FLASK_DEBUG", False, invalid_default=False)
    use_reloader = parse_bool_env("YAMLS_FLASK_RELOADER", debug, invalid_default=False)
    host = os.getenv("YAMLS_FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("YAMLS_FLASK_PORT", "8000"))
    app.run(debug=debug, use_reloader=use_reloader, host=host, port=port)
