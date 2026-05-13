"""Приём диагностики с клиента (ошибки виджетов)."""
from __future__ import annotations

from flask import request

from .api_response import json_response, success_payload


def register_client_diagnostic_routes(app):
    @app.route("/api/client-diagnostic", methods=["POST"])
    def api_client_diagnostic():
        _ = request.get_json(silent=True) or {}
        return json_response(success_payload(data={"ok": True}))
