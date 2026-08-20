"""Pure-python tests for storage.py (SentenceStorage) logic.

``storage.py`` imports ``homeassistant.core`` at module scope (only used
for a type hint) and ``yaml`` (a real, importable stdlib-adjacent
dependency already vendored by Home Assistant / present in this
environment). A minimal ``homeassistant.core`` stub is inserted into
``sys.modules`` before the module is exec'd so the real ``homeassistant``
package is never required.

Exercised behavior:
  * ``_parse_id`` / ``_normalize`` / ``_aligned_ids`` — pure id + shape
    helpers used by every CRUD path.
  * ``_path_for`` / ``_meta_path_for`` — the documented filename
    convention: ``custom_sentences/<lang>/ha_sentence_manager_<intent>.yaml``
    and its dot-prefixed ``.meta.yaml`` sidecar.
  * ``_create_sync`` — end-to-end write against a real temp directory
    (no event loop / hass needed, it only touches the filesystem),
    verifying the on-disk YAML shape and the sidecar id list.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path


def _stub_homeassistant() -> None:
    if "homeassistant.core" in sys.modules:
        return
    ha = types.ModuleType("homeassistant")
    ha_core = types.ModuleType("homeassistant.core")
    ha_core.HomeAssistant = type("HomeAssistant", (), {})
    ha.core = ha_core
    sys.modules["homeassistant"] = ha
    sys.modules["homeassistant.core"] = ha_core


_stub_homeassistant()

COMPONENT_DIR = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "ha_sentence_manager"
)

# storage.py does ``from .const import (...)`` — needs a real parent
# package for the relative import to resolve.
_PKG = "_ha_sentence_manager_test_pkg"
if _PKG not in sys.modules:
    pkg_module = types.ModuleType(_PKG)
    pkg_module.__path__ = [str(COMPONENT_DIR)]
    sys.modules[_PKG] = pkg_module

    const_spec = importlib.util.spec_from_file_location(
        f"{_PKG}.const", COMPONENT_DIR / "const.py"
    )
    assert const_spec and const_spec.loader
    const_module = importlib.util.module_from_spec(const_spec)
    sys.modules[f"{_PKG}.const"] = const_module
    const_spec.loader.exec_module(const_module)

spec = importlib.util.spec_from_file_location(f"{_PKG}.storage", COMPONENT_DIR / "storage.py")
assert spec and spec.loader
storage_module = importlib.util.module_from_spec(spec)
storage_module.__package__ = _PKG
sys.modules[f"{_PKG}.storage"] = storage_module
spec.loader.exec_module(storage_module)

SentenceStorage = storage_module.SentenceStorage
CUSTOM_SENTENCES_DIR_NAME = sys.modules[f"{_PKG}.const"].CUSTOM_SENTENCES_DIR_NAME
FILE_PREFIX = sys.modules[f"{_PKG}.const"].FILE_PREFIX


class _FakeConfig:
    """Duck-types ``hass.config.path(name)`` without needing homeassistant."""

    def __init__(self, base: str) -> None:
        self._base = base

    def path(self, name: str) -> str:
        return os.path.join(self._base, name)


class _FakeHass:
    def __init__(self, base: str) -> None:
        self.config = _FakeConfig(base)


class ParseIdTests(unittest.TestCase):
    def test_valid_three_part_id_splits_cleanly(self) -> None:
        parsed = SentenceStorage._parse_id("en:HassTurnOn:ab12cd34")
        self.assertEqual(parsed, ("en", "HassTurnOn", "ab12cd34"))

    def test_wrong_part_count_returns_none(self) -> None:
        self.assertIsNone(SentenceStorage._parse_id("en:HassTurnOn"))
        self.assertIsNone(SentenceStorage._parse_id("en:HassTurnOn:ab12:extra"))

    def test_empty_part_returns_none(self) -> None:
        self.assertIsNone(SentenceStorage._parse_id("en::ab12cd34"))

    def test_non_string_returns_none(self) -> None:
        self.assertIsNone(SentenceStorage._parse_id(None))  # type: ignore[arg-type]

    def test_path_traversal_parts_return_none(self) -> None:
        for sentence_id in (
            "..:HassTurnOn:ab12cd34",
            "../en:HassTurnOn:ab12cd34",
            "en:../../configuration:ab12cd34",
            "en:Hass/TurnOn:ab12cd34",
            r"en:Hass\TurnOn:ab12cd34",
        ):
            with self.subTest(sentence_id=sentence_id):
                self.assertIsNone(SentenceStorage._parse_id(sentence_id))


class NormalizeTests(unittest.TestCase):
    def test_valid_entry_normalizes_all_fields(self) -> None:
        result = SentenceStorage._normalize(
            "en:HassTurnOn:ab12cd34",
            "en",
            "HassTurnOn",
            {"sentences": ["turn on {name}"], "slots": {"name": "light"}, "response": "OK"},
        )
        self.assertEqual(
            result,
            {
                "id": "en:HassTurnOn:ab12cd34",
                "language": "en",
                "intent": "HassTurnOn",
                "sentences": ["turn on {name}"],
                "slots": {"name": "light"},
                "response": "OK",
            },
        )

    def test_missing_sentences_returns_none(self) -> None:
        self.assertIsNone(
            SentenceStorage._normalize("en:X:1", "en", "X", {"slots": {}})
        )

    def test_empty_sentences_list_returns_none(self) -> None:
        self.assertIsNone(
            SentenceStorage._normalize("en:X:1", "en", "X", {"sentences": []})
        )

    def test_non_dict_entry_returns_none(self) -> None:
        self.assertIsNone(SentenceStorage._normalize("en:X:1", "en", "X", "not a dict"))  # type: ignore[arg-type]

    def test_bad_slots_and_response_fall_back_to_defaults(self) -> None:
        result = SentenceStorage._normalize(
            "en:X:1",
            "en",
            "X",
            {"sentences": ["hi"], "slots": "not-a-dict", "response": 123},
        )
        assert result is not None
        self.assertEqual(result["slots"], {})
        self.assertEqual(result["response"], "")


class AlignedIdsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = SentenceStorage(hass=None)  # __init__ only stores hass

    def test_pads_missing_ids_and_flags_dirty(self) -> None:
        aligned, dirty = self.storage._aligned_ids(
            "en", "HassTurnOn", data=[{}, {}, {}], existing=["en:HassTurnOn:aaaaaaaa"]
        )
        self.assertEqual(len(aligned), 3)
        self.assertEqual(aligned[0], "en:HassTurnOn:aaaaaaaa")
        self.assertTrue(aligned[1])
        self.assertTrue(aligned[2])
        self.assertNotEqual(aligned[1], aligned[2])
        self.assertTrue(dirty)

    def test_trims_extra_ids_and_flags_dirty(self) -> None:
        aligned, dirty = self.storage._aligned_ids(
            "en",
            "HassTurnOn",
            data=[{}],
            existing=["en:HassTurnOn:aaaaaaaa", "en:HassTurnOn:bbbbbbbb"],
        )
        self.assertEqual(aligned, ["en:HassTurnOn:aaaaaaaa"])
        self.assertTrue(dirty)

    def test_matching_lengths_with_all_ids_present_is_not_dirty(self) -> None:
        aligned, dirty = self.storage._aligned_ids(
            "en", "HassTurnOn", data=[{}, {}], existing=["en:X:a", "en:X:b"]
        )
        self.assertEqual(aligned, ["en:X:a", "en:X:b"])
        self.assertFalse(dirty)

    def test_falsy_existing_entry_is_regenerated(self) -> None:
        aligned, dirty = self.storage._aligned_ids(
            "en", "HassTurnOn", data=[{}], existing=[""]
        )
        self.assertTrue(aligned[0])
        self.assertTrue(dirty)


class PathNamingConventionTests(unittest.TestCase):
    """The documented custom_sentences/<lang>/ha_sentence_manager_<intent>.yaml layout."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.storage = SentenceStorage(hass=_FakeHass(self._tmp.name))

    def test_path_for_uses_prefix_and_lang_subdir(self) -> None:
        path = self.storage._path_for("en", "HassTurnOn")
        expected = os.path.realpath(
            os.path.join(
                self._tmp.name,
                CUSTOM_SENTENCES_DIR_NAME,
                "en",
                f"{FILE_PREFIX}HassTurnOn.yaml",
            )
        )
        self.assertEqual(path, expected)

    def test_meta_path_for_is_dot_prefixed_sidecar(self) -> None:
        path = self.storage._meta_path_for("pl", "HassLightSet")
        expected = os.path.realpath(
            os.path.join(
                self._tmp.name,
                CUSTOM_SENTENCES_DIR_NAME,
                "pl",
                f".{FILE_PREFIX}HassLightSet.meta.yaml",
            )
        )
        self.assertEqual(path, expected)

    def test_path_for_rejects_unsafe_language_or_intent(self) -> None:
        unsafe_pairs = (
            ("../..", "HassTurnOn"),
            ("en/us", "HassTurnOn"),
            (r"en\us", "HassTurnOn"),
            ("en", "../../configuration"),
            ("en", "Hass/TurnOn"),
            ("en", r"Hass\TurnOn"),
        )

        for language, intent in unsafe_pairs:
            with self.subTest(language=language, intent=intent):
                with self.assertRaises(ValueError):
                    self.storage._path_for(language, intent)

    def test_path_for_rejects_language_symlink_outside_root(self) -> None:
        root = os.path.join(self._tmp.name, CUSTOM_SENTENCES_DIR_NAME)
        outside = os.path.join(self._tmp.name, "outside")
        os.makedirs(root)
        os.makedirs(outside)
        os.symlink(outside, os.path.join(root, "en"))

        with self.assertRaises(ValueError):
            self.storage._path_for("en", "HassTurnOn")


class CreateSyncWritesExpectedFilesTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.storage = SentenceStorage(hass=_FakeHass(self._tmp.name))

    def test_create_sync_writes_yaml_and_sidecar_with_matching_id(self) -> None:
        self.storage._create_sync(
            "en",
            "HassTurnOn",
            ["turn on {name}"],
            {"name": "light"},
            "",
            "en:HassTurnOn:deadbeef",
        )

        main_path = self.storage._path_for("en", "HassTurnOn")
        meta_path = self.storage._meta_path_for("en", "HassTurnOn")
        self.assertTrue(os.path.isfile(main_path))
        self.assertTrue(os.path.isfile(meta_path))

        loaded = self.storage._safe_load(main_path)
        assert loaded is not None
        self.assertEqual(loaded["language"], "en")
        entries = loaded["intents"]["HassTurnOn"]["data"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["sentences"], ["turn on {name}"])
        # No extra keys should be written into the entry itself (schema
        # compatible with HA's intent_script loader) — no "id" key here.
        self.assertNotIn("id", entries[0])
        self.assertNotIn("response", entries[0])  # empty response omitted

        meta_loaded = self.storage._safe_load(meta_path)
        assert meta_loaded is not None
        self.assertEqual(meta_loaded["ids"], ["en:HassTurnOn:deadbeef"])

    def test_create_sync_appends_to_existing_intent_block(self) -> None:
        self.storage._create_sync(
            "en", "HassTurnOn", ["first"], {}, "", "en:HassTurnOn:11111111"
        )
        self.storage._create_sync(
            "en", "HassTurnOn", ["second"], {}, "", "en:HassTurnOn:22222222"
        )

        main_path = self.storage._path_for("en", "HassTurnOn")
        loaded = self.storage._safe_load(main_path)
        assert loaded is not None
        entries = loaded["intents"]["HassTurnOn"]["data"]
        self.assertEqual([e["sentences"][0] for e in entries], ["first", "second"])

        meta_path = self.storage._meta_path_for("en", "HassTurnOn")
        meta_loaded = self.storage._safe_load(meta_path)
        assert meta_loaded is not None
        self.assertEqual(
            meta_loaded["ids"], ["en:HassTurnOn:11111111", "en:HassTurnOn:22222222"]
        )


if __name__ == "__main__":
    unittest.main()
