"""Lightweight backend tests for table_runtime (python -m unittest tests.backend.test_table_runtime)."""

import unittest


class TableRuntimeFingerprintTests(unittest.TestCase):
    def test_view_fingerprint_matches_ts_fixture(self) -> None:
        from backend.table_runtime import (  # pylint: disable=import-outside-toplevel
            _canonical_view_for_fingerprint,
            _table_query_view_fingerprint,
        )

        view_eff = {
            "offset": 10,
            "limit": 100,
            "sort": [],
            "filters": [],
            "group": [],
            "search": None,
            "expandedGroups": ["b", "a"],
        }
        canonical = _canonical_view_for_fingerprint(view_eff)
        fp = _table_query_view_fingerprint(
            page_name="p",
            attr_name="t",
            provider="file",
            source_key="value",
            canonical_view=canonical,
        )

        self.assertEqual(fp, "view_0843f0bab1ec7f91")


class TableExportWindowTests(unittest.TestCase):
    def test_export_window_slices_match_concat_of_full_export(self) -> None:
        from backend.table_runtime import export_table_value, export_table_window

        cfg = {
            "widget": "table",
            "table_attrs": "x",
            "value": [[str(i)] for i in range(47)],
        }
        view = {
            "offset": 0,
            "limit": 100,
            "sort": [],
            "filters": [],
            "group": [],
            "search": None,
            "expandedGroups": [],
        }
        full = export_table_value(cfg, view)["rows"]
        merged = []
        off = 0
        chunk = 11
        while off < len(full):
            window = export_table_window(cfg, view, off, chunk)
            merged.extend(window["rows"])
            if not window.get("export_has_more"):
                break
            off += len(window["rows"])
        self.assertEqual(merged, full)

    def test_query_sort_changes_view_id(self) -> None:
        from backend.table_runtime import query_table_view

        cfg = {
            "widget": "table",
            "table_attrs": "a\nb",
            "value": [[2, "x"], [1, "y"]],
        }
        base = {
            "offset": 0,
            "limit": 50,
            "filters": [],
            "group": [],
            "search": None,
            "expandedGroups": [],
        }
        r1 = query_table_view(page_name="p", attr_name="t", config=cfg, view={**base, "sort": []})
        r2 = query_table_view(
            page_name="p",
            attr_name="t",
            config=cfg,
            view={
                **base,
                "sort": [{"columnKey": "a", "direction": "asc"}],
            },
        )
        self.assertNotEqual(r1.get("view_id"), r2.get("view_id"))

    def test_query_grouping_supports_multiple_levels(self) -> None:
        from backend.table_runtime import query_table_view

        cfg = {
            "widget": "table",
            "table_attrs": "region\nstatus\nname",
            "value": [
                ["North", "Active", "A"],
                ["North", "Closed", "B"],
                ["South", "Active", "C"],
            ],
        }
        result = query_table_view(
            page_name="p",
            attr_name="t",
            config=cfg,
            view={
                "offset": 0,
                "limit": 20,
                "sort": [],
                "filters": [],
                "group": [{"columnKey": "region"}, {"columnKey": "status"}],
                "search": None,
                "expandedGroups": ["region:North"],
            },
        )
        items = result.get("items") or []
        self.assertEqual(
            [(item.get("kind"), item.get("columnKey"), item.get("level"), item.get("key")) for item in items[:4]],
            [
                ("group", "region", 0, "North"),
                ("group", "status", 1, "Active"),
                ("group", "status", 1, "Closed"),
                ("group", "region", 0, "South"),
            ],
        )


class PrepareTableAttrsTests(unittest.TestCase):
    def test_huge_inline_value_truncated_and_remote_sidecar(self) -> None:
        from backend.table_runtime import LOCAL_FULL_MAX_ROWS, prepare_table_attrs_for_runtime

        row_count = LOCAL_FULL_MAX_ROWS + 120
        attrs = {
            "demo": {
                "widget": "table",
                "table_attrs": "c0",
                "value": [[str(i)] for i in range(row_count)],
            }
        }
        prepared, rt = prepare_table_attrs_for_runtime("page", attrs, ["demo"])
        self.assertEqual(rt["demo"].get("mode"), "remote-paged")
        sliced = prepared["demo"].get("value")
        self.assertIsInstance(sliced, list)
        self.assertLessEqual(len(sliced), LOCAL_FULL_MAX_ROWS)


class FileTableTotalHintTests(unittest.TestCase):
    def test_tail_query_honors_total_hint_without_shipping_prior_rows(self) -> None:
        from backend.table_runtime import query_table_view

        cfg = {
            "widget": "table",
            "table_attrs": "a / A\nb / B\nc / C",
            "value": {
                "kind": "file",
                "path": "tests/fixtures/table_total_hint_small.csv",
                "format": "csv",
                "header": True,
                "total": 1_000_000,
            },
        }
        view = {
            "offset": 999_990,
            "limit": 10,
            "sort": [],
            "filters": [],
            "group": [],
            "search": None,
            "expandedGroups": [],
        }
        result = query_table_view(page_name="p", attr_name="t", config=cfg, view=view)
        self.assertEqual(result.get("total"), 1_000_000)
        self.assertEqual(result.get("offset"), 999_990)
        self.assertEqual(len(result.get("items") or []), 0)
        self.assertTrue(result.get("has_more"))


if __name__ == "__main__":
    unittest.main()
