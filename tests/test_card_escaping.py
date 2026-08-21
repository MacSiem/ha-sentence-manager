"""Regression tests for dynamic values interpolated into card HTML."""

from __future__ import annotations

import json
import unittest
from pathlib import Path


CARD_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "ha_sentence_manager"
    / "www"
    / "ha-sentence-manager.js"
)
INIT_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "ha_sentence_manager"
    / "__init__.py"
)
ROOT = Path(__file__).resolve().parents[1]


class CardEscapingTests(unittest.TestCase):
    def test_ha_sentence_values_are_escaped_before_html_interpolation(self) -> None:
        source = CARD_PATH.read_text(encoding="utf-8")

        self.assertIn("${_esc(haData._sourceFile)}", source)
        self.assertIn("${_esc(cat)}", source)
        self.assertIn('data-intent-body="${_esc(name)}"', source)

    def test_export_and_language_config_are_escaped_before_inner_html(self) -> None:
        source = CARD_PATH.read_text(encoding="utf-8")

        self.assertIn("${_esc(this.exportAsYaml())}", source)
        self.assertIn("const lang = _esc(this.config.language || 'pl');", source)

    def test_frontend_stat_and_declared_floor_match_used_apis(self) -> None:
        init_source = INIT_PATH.read_text(encoding="utf-8")
        hacs = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))

        self.assertIn(
            "await hass.async_add_executor_job(os.path.isfile, card_path)",
            init_source,
        )
        self.assertEqual(hacs["homeassistant"], "2024.7.0")


if __name__ == "__main__":
    unittest.main()
