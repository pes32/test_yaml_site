"""WSGI entrypoint for Waitress and other production-style servers."""

from __future__ import annotations

import os

from werkzeug.middleware.proxy_fix import ProxyFix

from backend import create_app


app = create_app()

if os.getenv("YAMLS_TRUST_PROXY") == "1":
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_proto=1,
        x_host=1,
        x_port=1,
        x_for=1,
    )
