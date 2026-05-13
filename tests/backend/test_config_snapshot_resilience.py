"""Backend config snapshot resilience tests."""

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest


class ConfigSnapshotResilienceTests(unittest.TestCase):
    def test_page_with_widget_errors_stays_published_with_error_attrs(self) -> None:
        from backend.config_snapshot import build_config_snapshot

        with TemporaryDirectory() as tmp:
            pages_dir = Path(tmp)
            page_dir = pages_dir / "demo"
            page_dir.mkdir()
            (page_dir / "gui.yaml").write_text(
                "\n".join(
                    [
                        'title: "Demo"',
                        'url: "/demo"',
                        "row: bad_list, bad_voc, missing_widget",
                    ]
                ),
                encoding="utf-8",
            )
            (page_dir / "attrs.yaml").write_text(
                "\n".join(
                    [
                        "bad_list:",
                        "  widget: list",
                        '  label: "Bad list"',
                        "  columns: code",
                        "bad_voc:",
                        "  widget: voc",
                        '  label: "Bad voc"',
                        "  columns: |",
                        "    code /Code",
                    ]
                ),
                encoding="utf-8",
            )

            snapshot = build_config_snapshot(str(pages_dir), strict=False)

        self.assertIn("demo", snapshot["pages"])
        self.assertEqual(snapshot["pages_by_url"].get("/demo"), "demo")
        self.assertEqual(snapshot["meta"]["page_count"], 1)

        attrs = snapshot["pages"]["demo"]["attrs"]
        for attr_name in ("bad_list", "bad_voc", "missing_widget"):
            with self.subTest(attr_name=attr_name):
                self.assertEqual(attrs[attr_name]["widget"], "str")
                self.assertEqual(attrs[attr_name]["regex"], "(?!)")
                self.assertEqual(attrs[attr_name]["err_text"], "error!")
                self.assertEqual(attrs[attr_name]["sup_text"], "error!")

        codes = {item["code"] for item in snapshot["diagnostics"]}
        self.assertIn("unsupported_attr_option", codes)
        self.assertIn("invalid_attr_option_value", codes)
        self.assertIn("missing_attr_reference", codes)
        self.assertNotIn("page_skipped_due_to_errors", codes)

        page_codes = {item["code"] for item in snapshot["pages"]["demo"]["diagnostics"]}
        self.assertIn("missing_attr_reference", page_codes)


if __name__ == "__main__":
    unittest.main()
