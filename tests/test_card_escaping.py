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

    def test_card_does_not_install_cross_card_injectors(self) -> None:
        source = CARD_PATH.read_text(encoding="utf-8")

        self.assertIn("const _esc = (s) => _escBase(_asText(s));", source)
        self.assertIn("const _esc = (s) => _editorEscBase(String(s ?? ''));", source)
        for marker in ("SPLIT_TAGS", "deepFindAll", "injectAll", "__haToolsSplitDonateInjector", "window._haToolsEsc"):
            with self.subTest(marker=marker):
                self.assertNotIn(marker, source)

    def test_reload_service_is_admin_only(self) -> None:
        init_source = INIT_PATH.read_text(encoding="utf-8")

        self.assertIn(
            "from homeassistant.helpers.service import async_register_admin_service",
            init_source,
        )
        self.assertIn(
            'async_register_admin_service(hass, DOMAIN, "reload", _handle_reload)',
            init_source,
        )
        self.assertNotIn(
            'hass.services.async_register(DOMAIN, "reload", _handle_reload)',
            init_source,
        )


if __name__ == "__main__":
    unittest.main()
