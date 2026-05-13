"""Regression tests for DB-backed YAML public API contracts."""

import unittest
from typing import Any


class _FakeConfigService:
    def __init__(self, snapshot: dict[str, Any]) -> None:
        self._snapshot = snapshot

    def get_snapshot(self) -> dict[str, Any]:
        return self._snapshot

    def force_reload(self) -> dict[str, Any]:
        return {"snapshot": self._snapshot, "updated": False, "last_error": None}


class _FakeDbExecutor:
    def __init__(self, result: Any) -> None:
        self.result = result
        self.calls: list[Any] = []

    def __call__(self, descriptor: Any) -> Any:
        self.calls.append(descriptor)
        return self.result


def _snapshot(attrs: dict[str, Any]) -> dict[str, Any]:
    page_config = {
        "name": "p",
        "url": "/p",
        "title": "P",
        "gui": {},
        "parsedGui": {"menus": [], "modals": {}, "rootContentOnly": True},
        "attrs": attrs,
        "diagnostics": [],
    }
    return {
        "meta": {"version": "v", "created_at": "now", "page_count": 1},
        "pages": {"p": page_config},
        "page_attrs": {"p": attrs},
        "diagnostics": [],
    }


def _client(snapshot: dict[str, Any]):
    from flask import Flask

    import backend.routes_api as routes_api

    app = Flask(__name__)
    app.config["TESTING"] = True
    routes_api.register_api_routes(app, _FakeConfigService(snapshot), "")
    return app.test_client()


class YamlDbPublicPayloadTests(unittest.TestCase):
    def test_page_and_config_payloads_hide_yaml_sql(self) -> None:
        from backend.api_response import page_data_payload, public_snapshot_payload
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, PUBLIC_DB_SOURCE_TOKEN

        page_config = {
            "name": "p",
            "url": "/p",
            "title": "P",
            "gui": {},
            "parsedGui": {"menus": [], "modals": {}, "rootContentOnly": True},
            "attrs": {
                "load": {
                    "widget": "button",
                    "command": "SELECT secret FROM private_table;",
                    "select_attrs": "target",
                },
                "choices": {
                    "widget": "list",
                    "columns": "code",
                    "source": "test_voc_1 -pg",
                },
                "target": {"widget": "str"},
            },
            "diagnostics": [],
        }
        snapshot = {
            "meta": {"version": "v", "created_at": "now"},
            "pages": {"p": page_config},
            "page_attrs": {"p": page_config["attrs"]},
            "diagnostics": [],
        }

        page_payload = page_data_payload(page_config)
        self.assertEqual(page_payload["attrs"]["load"]["command"], PUBLIC_DB_COMMAND_TOKEN)
        self.assertEqual(page_payload["attrs"]["choices"]["source"], PUBLIC_DB_SOURCE_TOKEN)

        public_snapshot = public_snapshot_payload(snapshot)
        as_text = str(public_snapshot)
        self.assertNotIn("SELECT secret", as_text)
        self.assertNotIn("test_voc_1 -pg", as_text)


class YamlDbExecutePayloadTests(unittest.TestCase):
    def _install_fake_db_executor(self, result: Any) -> _FakeDbExecutor:
        import backend.routes_api as routes_api

        original = routes_api.execute_yaml_db_descriptor
        fake = _FakeDbExecutor(result)
        routes_api.execute_yaml_db_descriptor = fake
        self.addCleanup(lambda: setattr(routes_api, "execute_yaml_db_descriptor", original))
        return fake

    def test_execute_response_hides_sql_but_returns_table_updates(self) -> None:
        import backend.routes_api as routes_api
        from backend.contracts import ExecuteRequest
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, YamlDbResult

        snapshot = {
            "pages": {
                "p": {
                    "attrs": {
                        "load_table": {
                            "widget": "button",
                            "command": "SELECT user_id, last_seen_at, user_agent FROM user_sessions;",
                            "select_attrs": "back_table",
                        },
                        "back_table": {
                            "widget": "table",
                            "table_attrs": "user_id :100\nlast_seen_at :200\nuser_agent :300",
                        },
                    }
                }
            }
        }

        original = routes_api.execute_yaml_db_descriptor
        try:
            routes_api.execute_yaml_db_descriptor = lambda _command: YamlDbResult(
                query="SELECT user_id, last_seen_at, user_agent FROM user_sessions;",
                columns=["user_id", "last_seen_at", "user_agent"],
                rows=[{"user_id": 7, "last_seen_at": None, "user_agent": "browser"}],
                row_count=1,
            )
            result = routes_api._execute_yaml_db_button(
                snapshot,
                ExecuteRequest(
                    command=PUBLIC_DB_COMMAND_TOKEN,
                    page="p",
                    widget="load_table",
                ),
            )
        finally:
            routes_api.execute_yaml_db_descriptor = original

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["command"], PUBLIC_DB_COMMAND_TOKEN)
        self.assertIsNone(result["data"])
        self.assertEqual(
            result["updates"]["values"]["back_table"],
            [[7, None, "browser"]],
        )
        self.assertNotIn("SELECT user_id", str(result))

    def test_execute_endpoint_fills_mapped_fields_from_yaml_command(self) -> None:
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, YamlDbResult

        snapshot = _snapshot(
            {
                "load": {
                    "widget": "button",
                    "command": "SELECT db_name, db_count FROM secret_table;",
                    "select_attrs": {"name_field": "db_name", "count_field": "db_count"},
                },
                "name_field": {"widget": "str"},
                "count_field": {"widget": "int"},
            }
        )
        fake = self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT db_name, db_count FROM secret_table;",
                columns=["db_name", "db_count"],
                rows=[{"db_name": "Alice", "db_count": 3}],
                row_count=1,
            )
        )

        response = _client(snapshot).post(
            "/api/execute",
            json={
                "command": "SELECT injected FROM browser_payload;",
                "page": "p",
                "widget": "load",
            },
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(fake.calls, ["SELECT db_name, db_count FROM secret_table;"])
        self.assertEqual(payload["data"]["command"], PUBLIC_DB_COMMAND_TOKEN)
        self.assertIsNone(payload["data"]["data"])
        self.assertTrue(payload["data"]["silent_success"])
        self.assertEqual(
            payload["data"]["updates"]["values"],
            {"name_field": "Alice", "count_field": 3},
        )
        self.assertNotIn("secret_table", str(payload))
        self.assertNotIn("browser_payload", str(payload))

    def test_execute_endpoint_fills_same_named_fields_from_csv_select_attrs(self) -> None:
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, YamlDbResult

        snapshot = _snapshot(
            {
                "load": {
                    "widget": "button",
                    "command": "test_select_1 -pg",
                    "select_attrs": "code, title",
                },
                "code": {"widget": "str"},
                "title": {"widget": "str"},
            }
        )
        self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT * FROM test_select_1();",
                columns=["code", "title"],
                rows=[{"code": "A-1", "title": "Alpha"}],
                row_count=1,
            )
        )

        response = _client(snapshot).post(
            "/api/execute",
            json={"command": PUBLIC_DB_COMMAND_TOKEN, "page": "p", "widget": "load"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["updates"]["values"], {"code": "A-1", "title": "Alpha"})

    def test_execute_endpoint_rejects_multirow_scalar_result(self) -> None:
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, YamlDbResult

        snapshot = _snapshot(
            {
                "load": {
                    "widget": "button",
                    "command": "SELECT code FROM rows;",
                    "select_attrs": "code",
                },
                "code": {"widget": "str"},
            }
        )
        self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT code FROM rows;",
                columns=["code"],
                rows=[{"code": "A"}, {"code": "B"}],
                row_count=2,
            )
        )

        response = _client(snapshot).post(
            "/api/execute",
            json={"command": PUBLIC_DB_COMMAND_TOKEN, "page": "p", "widget": "load"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "yaml_db_scalar_row_count")
        self.assertNotIn("SELECT code", str(payload))

    def test_execute_endpoint_replaces_table_with_ordered_rows(self) -> None:
        from backend.db_yaml_runtime import PUBLIC_DB_COMMAND_TOKEN, YamlDbResult

        snapshot = _snapshot(
            {
                "load_table": {
                    "widget": "button",
                    "command": "SELECT user_agent, user_id, last_seen_at FROM user_sessions;",
                    "select_attrs": "back_table",
                },
                "back_table": {
                    "widget": "table",
                    "table_attrs": "user_id :100\nlast_seen_at :200\nuser_agent :300",
                },
            }
        )
        self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT user_agent, user_id, last_seen_at FROM user_sessions;",
                columns=["user_agent", "user_id", "last_seen_at"],
                rows=[
                    {"user_agent": "Browser A", "user_id": 11, "last_seen_at": "2026-05-14"},
                    {"user_agent": "Browser B", "user_id": 12, "last_seen_at": "2026-05-15"},
                ],
                row_count=2,
            )
        )

        response = _client(snapshot).post(
            "/api/execute",
            json={"command": PUBLIC_DB_COMMAND_TOKEN, "page": "p", "widget": "load_table"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(
            payload["data"]["updates"]["values"]["back_table"],
            [
                [11, "2026-05-14", "Browser A"],
                [12, "2026-05-15", "Browser B"],
            ],
        )


class YamlDbWidgetSourceTests(unittest.TestCase):
    def _install_fake_db_executor(self, result: Any) -> _FakeDbExecutor:
        import backend.routes_api as routes_api

        original = routes_api.execute_yaml_db_descriptor
        fake = _FakeDbExecutor(result)
        routes_api.execute_yaml_db_descriptor = fake
        self.addCleanup(lambda: setattr(routes_api, "execute_yaml_db_descriptor", original))
        return fake

    def test_widget_source_endpoint_loads_list_options(self) -> None:
        from backend.db_yaml_runtime import YamlDbResult

        snapshot = _snapshot(
            {
                "back_list": {
                    "widget": "list",
                    "source": "test_list_source -pg",
                    "columns": "code",
                },
            }
        )
        fake = self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT * FROM test_list_source();",
                columns=["code", "title"],
                rows=[{"code": "A", "title": "Alpha"}, {"code": "B", "title": "Beta"}],
                row_count=2,
            )
        )

        response = _client(snapshot).post(
            "/api/widget-source",
            json={"page": "p", "widget": "back_list", "snapshot_version": "v"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(fake.calls, ["test_list_source -pg"])
        self.assertEqual(
            payload["data"],
            {"page": "p", "widget": "back_list", "patch": {"source": ["A", "B"]}},
        )
        self.assertNotIn("test_list_source", str(payload))

    def test_widget_source_endpoint_loads_voc_rows_and_labels(self) -> None:
        from backend.db_yaml_runtime import YamlDbResult

        snapshot = _snapshot(
            {
                "voc_db": {
                    "widget": "voc",
                    "source": "SELECT code, title FROM voc_values;",
                    "columns": ["Code", "Title"],
                    "x_db_columns": ["code", "title"],
                },
            }
        )
        self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT code, title FROM voc_values;",
                columns=["code", "title"],
                rows=[{"code": "A", "title": "Alpha"}, {"code": "B", "title": "Beta"}],
                row_count=2,
            )
        )

        response = _client(snapshot).post(
            "/api/widget-source",
            json={"page": "p", "widget": "voc_db", "snapshot_version": "v"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(
            payload["data"]["patch"],
            {
                "columns": ["Code", "Title"],
                "source": [["A", "Alpha"], ["B", "Beta"]],
                "x_db_columns": ["code", "title"],
            },
        )
        self.assertNotIn("voc_values", str(payload))

    def test_widget_source_endpoint_reports_missing_columns(self) -> None:
        from backend.db_yaml_runtime import YamlDbResult

        snapshot = _snapshot(
            {
                "voc_db": {
                    "widget": "voc",
                    "source": "SELECT code FROM voc_values;",
                    "columns": ["Code", "Title"],
                    "x_db_columns": ["code", "title"],
                },
            }
        )
        self._install_fake_db_executor(
            YamlDbResult(
                query="SELECT code FROM voc_values;",
                columns=["code"],
                rows=[{"code": "A"}],
                row_count=1,
            )
        )

        response = _client(snapshot).post(
            "/api/widget-source",
            json={"page": "p", "widget": "voc_db", "snapshot_version": "v"},
        )

        payload = response.get_json()
        self.assertEqual(response.status_code, 400)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "yaml_db_missing_columns")
        self.assertIn("title", payload["error"]["message"])
        self.assertNotIn("voc_values", str(payload))


if __name__ == "__main__":
    unittest.main()
