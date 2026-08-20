"""Regression tests for dynamic values interpolated into card HTML."""

from __future__ import annotations

import unittest
from pathlib import Path


CARD_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "ha_sentence_manager"
    / "www"
    / "ha-sentence-manager.js"
)


class CardEscapingTests(unittest.TestCase):
    def test_ha_sentence_values_are_escaped_before_html_interpolation(self) -> None:
        source = CARD_PATH.read_text(encoding="utf-8")

        self.assertIn("${_esc(haData._sourceFile)}", source)
        self.assertIn("${_esc(cat)}", source)
        self.assertIn('data-intent-body="${_esc(name)}"', source)


if __name__ == "__main__":
    unittest.main()
