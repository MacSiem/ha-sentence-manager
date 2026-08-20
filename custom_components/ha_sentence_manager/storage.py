"""Filesystem-backed storage for HA Sentence Manager.

Persists user-defined HA Assist sentences to Home Assistant's official
``custom_sentences/<lang>/`` directory, one YAML file per ``(language,
intent)`` pair, named ``ha_sentence_manager_<intent>.yaml``.

To keep the main file 100% schema-compatible with HA's intent_script
loader, no extra keys are ever written into the data entries themselves.
Stable per-entry IDs live in a sibling sidecar file with a dot prefix
(``.ha_sentence_manager_<intent>.meta.yaml``) which HA ignores. The
sidecar stores an ``ids`` list parallel to the main file's
``intents.<intent>.data`` list (same length, same order).

If the sidecar is missing or out of sync (e.g. someone hand-edited the
main file or copied it from elsewhere), fresh IDs are generated on read
and persisted back so subsequent reads stay stable.

All filesystem operations go through ``hass.async_add_executor_job`` so
the event loop is never blocked. Reads are defensive: missing
directories, missing files and corrupt YAML degrade to "empty" rather
than raising.
"""

from __future__ import annotations

import glob
import logging
import os
import uuid
from typing import Any

import yaml

from homeassistant.core import HomeAssistant

from .const import CUSTOM_SENTENCES_DIR_NAME, FILE_PREFIX

_LOGGER = logging.getLogger(__name__)

_META_FILE_PREFIX = "."


class SentenceStorage:
    """CRUD wrapper around ``custom_sentences/<lang>/ha_sentence_manager_*.yaml``."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Bind the storage helper to a Home Assistant instance."""
        self.hass = hass

    # ---------------------------------------------------------------- public

    async def list_all(self, language: str | None = None) -> list[dict[str, Any]]:
        """Return every persisted sentence as a flat list of normalized dicts.

        Each dict has shape::

            {
                "id": "en:HassTurnOn:ab12cd34",
                "language": "en",
                "intent": "HassTurnOn",
                "sentences": [str, ...],
                "slots": {str: str, ...},
                "response": str,  # may be empty
            }

        If ``language`` is given, only that language's files are scanned.
        Missing directories yield an empty list rather than an error.
        """
        return await self.hass.async_add_executor_job(self._list_all_sync, language)

    async def get_one(self, sentence_id: str) -> dict[str, Any] | None:
        """Return the normalized dict for a single sentence id, or ``None``."""
        parsed = self._parse_id(sentence_id)
        if parsed is None:
            return None
        lang, intent, _ = parsed
        return await self.hass.async_add_executor_job(
            self._get_one_sync, lang, intent, sentence_id
        )

    async def create(self, payload: dict[str, Any]) -> str:
        """Append a new sentence entry and return its generated id."""
        language = str(payload["language"]).strip()
        intent = str(payload["intent"]).strip()
        sentences = list(payload["sentences"])
        slots = dict(payload.get("slots") or {})
        response = str(payload.get("response") or "")
        if not language or not intent or not sentences:
            raise ValueError("language, intent, and non-empty sentences are required")

        sentence_id = f"{language}:{intent}:{uuid.uuid4().hex[:8]}"
        await self.hass.async_add_executor_job(
            self._create_sync,
            language,
            intent,
            sentences,
            slots,
            response,
            sentence_id,
        )
        return sentence_id

    async def update(self, sentence_id: str, patch: dict[str, Any]) -> bool:
        """Apply ``patch`` (sentences / slots / response) to an existing entry."""
        if "language" in patch or "intent" in patch:
            _LOGGER.warning(
                "update: cannot change language/intent of %s in v5.0", sentence_id
            )
            return False
        parsed = self._parse_id(sentence_id)
        if parsed is None:
            return False
        lang, intent, _ = parsed
        return await self.hass.async_add_executor_job(
            self._update_sync, lang, intent, sentence_id, patch
        )

    async def delete(self, sentence_id: str) -> bool:
        """Remove an entry; drop the file (and sidecar) if it ends up empty."""
        parsed = self._parse_id(sentence_id)
        if parsed is None:
            return False
        lang, intent, _ = parsed
        return await self.hass.async_add_executor_job(
            self._delete_sync, lang, intent, sentence_id
        )

    # ---------------------------------------------------------------- path helpers

    def _root(self) -> str:
        """Absolute path to the ``custom_sentences`` directory."""
        return os.path.realpath(self.hass.config.path(CUSTOM_SENTENCES_DIR_NAME))

    @staticmethod
    def _validate_path_component(value: str, label: str) -> str:
        """Return a safe single path component or reject traversal input."""
        if (
            not isinstance(value, str)
            or not value
            or ".." in value
            or "/" in value
            or "\\" in value
            or "\x00" in value
        ):
            raise ValueError(f"invalid {label}")
        return value

    def _lang_dir(self, language: str) -> str:
        root = self._root()
        safe_language = self._validate_path_component(language, "language")
        language_dir = os.path.realpath(os.path.join(root, safe_language))
        if os.path.commonpath((root, language_dir)) != root:
            raise ValueError("language path escapes custom_sentences")
        return language_dir

    def _path_for(self, language: str, intent: str) -> str:
        root = self._root()
        safe_intent = self._validate_path_component(intent, "intent")
        path = os.path.realpath(
            os.path.join(self._lang_dir(language), f"{FILE_PREFIX}{safe_intent}.yaml")
        )
        if os.path.commonpath((root, path)) != root:
            raise ValueError("sentence path escapes custom_sentences")
        return path

    def _meta_path_for(self, language: str, intent: str) -> str:
        root = self._root()
        safe_intent = self._validate_path_component(intent, "intent")
        path = os.path.realpath(
            os.path.join(
                self._lang_dir(language),
                f"{_META_FILE_PREFIX}{FILE_PREFIX}{safe_intent}.meta.yaml",
            )
        )
        if os.path.commonpath((root, path)) != root:
            raise ValueError("metadata path escapes custom_sentences")
        return path

    @staticmethod
    def _parse_id(sentence_id: str) -> tuple[str, str, str] | None:
        """Split an opaque id into (language, intent, short)."""
        if not isinstance(sentence_id, str):
            return None
        parts = sentence_id.split(":")
        if len(parts) != 3 or not all(parts):
            return None
        try:
            SentenceStorage._validate_path_component(parts[0], "language")
            SentenceStorage._validate_path_component(parts[1], "intent")
        except ValueError:
            return None
        return parts[0], parts[1], parts[2]

    # ---------------------------------------------------------------- yaml helpers

    def _safe_load(self, path: str) -> dict[str, Any] | None:
        """Load a YAML file, returning ``None`` on missing/corrupt files."""
        try:
            with open(path, encoding="utf-8") as handle:
                loaded = yaml.safe_load(handle)
        except FileNotFoundError:
            return None
        except (yaml.YAMLError, OSError) as err:
            _LOGGER.warning("Failed to load %s: %s", path, err)
            return None
        if not isinstance(loaded, dict):
            _LOGGER.warning("Unexpected top-level YAML shape in %s", path)
            return None
        return loaded

    def _dump(self, path: str, data: dict[str, Any]) -> None:
        """Atomically rewrite a YAML file with the supplied data."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            yaml.safe_dump(
                data,
                handle,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
            )

    # ---------------------------------------------------------------- metadata helpers

    def _load_meta(self, meta_path: str) -> list[str]:
        """Return the ``ids`` list from a sidecar; empty list when absent."""
        loaded = self._safe_load(meta_path)
        if not loaded:
            return []
        ids = loaded.get("ids") or []
        if not isinstance(ids, list):
            return []
        return [str(x) for x in ids]

    def _dump_meta(self, meta_path: str, ids: list[str]) -> None:
        """Persist the ``ids`` list into the sidecar (or remove if empty)."""
        if not ids:
            self._remove_if_exists(meta_path)
            return
        self._dump(meta_path, {"ids": ids})

    @staticmethod
    def _remove_if_exists(path: str) -> None:
        try:
            os.remove(path)
        except FileNotFoundError:
            return
        except OSError as err:
            _LOGGER.warning("Failed to remove %s: %s", path, err)

    def _aligned_ids(
        self, language: str, intent: str, data: list[Any], existing: list[str]
    ) -> tuple[list[str], bool]:
        """Pad/trim the existing ids list to match ``data`` length.

        Returns the aligned list and a ``dirty`` flag indicating whether
        the sidecar should be rewritten.
        """
        aligned: list[str] = []
        dirty = False
        for idx in range(len(data)):
            if idx < len(existing) and existing[idx]:
                aligned.append(existing[idx])
            else:
                aligned.append(f"{language}:{intent}:{uuid.uuid4().hex[:8]}")
                dirty = True
        if len(existing) != len(data):
            dirty = True
        return aligned, dirty

    @staticmethod
    def _normalize(
        sentence_id: str,
        language: str,
        intent: str,
        entry: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Translate a YAML data entry into the WS API response shape."""
        if not isinstance(entry, dict):
            return None
        sentences = entry.get("sentences") or []
        if not isinstance(sentences, list) or not sentences:
            return None
        slots = entry.get("slots") or {}
        if not isinstance(slots, dict):
            slots = {}
        response = entry.get("response") or ""
        if not isinstance(response, str):
            response = ""
        return {
            "id": sentence_id,
            "language": language,
            "intent": intent,
            "sentences": [str(s) for s in sentences],
            "slots": {str(k): str(v) for k, v in slots.items()},
            "response": response,
        }

    # ---------------------------------------------------------------- list / get

    def _list_all_sync(self, language: str | None) -> list[dict[str, Any]]:
        root = self._root()
        if not os.path.isdir(root):
            return []
        if language is not None:
            languages = [language] if os.path.isdir(self._lang_dir(language)) else []
        else:
            languages = sorted(
                name
                for name in os.listdir(root)
                if os.path.isdir(os.path.join(root, name))
            )
        out: list[dict[str, Any]] = []
        for lang in languages:
            pattern = os.path.join(self._lang_dir(lang), f"{FILE_PREFIX}*.yaml")
            for path in sorted(glob.glob(pattern)):
                loaded = self._safe_load(path)
                if not loaded:
                    continue
                intents = loaded.get("intents") or {}
                if not isinstance(intents, dict):
                    _LOGGER.warning("Malformed intents block in %s", path)
                    continue
                for intent, block in intents.items():
                    data = (block or {}).get("data") or []
                    if not isinstance(data, list):
                        continue
                    meta_path = self._meta_path_for(lang, str(intent))
                    aligned, dirty = self._aligned_ids(
                        lang, str(intent), data, self._load_meta(meta_path)
                    )
                    if dirty:
                        # Persist newly-generated ids so subsequent reads are stable.
                        self._dump_meta(meta_path, aligned)
                    for idx, entry in enumerate(data):
                        normalized = self._normalize(
                            aligned[idx], lang, str(intent), entry
                        )
                        if normalized is not None:
                            out.append(normalized)
        return out

    def _get_one_sync(
        self, language: str, intent: str, sentence_id: str
    ) -> dict[str, Any] | None:
        path = self._path_for(language, intent)
        loaded = self._safe_load(path)
        if not loaded:
            return None
        block = (loaded.get("intents") or {}).get(intent) or {}
        data = block.get("data") or []
        if not isinstance(data, list):
            return None
        meta_path = self._meta_path_for(language, intent)
        aligned, dirty = self._aligned_ids(
            language, intent, data, self._load_meta(meta_path)
        )
        if dirty:
            self._dump_meta(meta_path, aligned)
        for idx, entry in enumerate(data):
            if aligned[idx] != sentence_id:
                continue
            normalized = self._normalize(sentence_id, language, intent, entry)
            if normalized is not None:
                return normalized
        return None

    # ---------------------------------------------------------------- create / update / delete

    def _create_sync(
        self,
        language: str,
        intent: str,
        sentences: list[str],
        slots: dict[str, Any],
        response: str,
        sentence_id: str,
    ) -> None:
        path = self._path_for(language, intent)
        loaded = self._safe_load(path) or {"language": language, "intents": {}}
        loaded.setdefault("language", language)
        intents = loaded.setdefault("intents", {})
        block = intents.setdefault(intent, {"data": []})
        data = block.setdefault("data", [])
        entry: dict[str, Any] = {
            "sentences": [str(s) for s in sentences],
            "slots": {str(k): str(v) for k, v in slots.items()},
        }
        if response:
            entry["response"] = response
        data.append(entry)
        self._dump(path, loaded)

        # Keep the sidecar parallel to the main file.
        meta_path = self._meta_path_for(language, intent)
        ids = self._load_meta(meta_path)
        # Pad to len(data) - 1 (everything before the new entry).
        while len(ids) < len(data) - 1:
            ids.append(f"{language}:{intent}:{uuid.uuid4().hex[:8]}")
        ids.append(sentence_id)
        self._dump_meta(meta_path, ids)

    def _update_sync(
        self,
        language: str,
        intent: str,
        sentence_id: str,
        patch: dict[str, Any],
    ) -> bool:
        path = self._path_for(language, intent)
        loaded = self._safe_load(path)
        if not loaded:
            return False
        block = (loaded.get("intents") or {}).get(intent) or {}
        data = block.get("data") or []
        if not isinstance(data, list):
            return False
        meta_path = self._meta_path_for(language, intent)
        aligned, dirty = self._aligned_ids(
            language, intent, data, self._load_meta(meta_path)
        )
        for idx, entry in enumerate(data):
            if not isinstance(entry, dict) or aligned[idx] != sentence_id:
                continue
            if "sentences" in patch:
                new_sentences = [str(s) for s in patch["sentences"] if str(s).strip()]
                if not new_sentences:
                    _LOGGER.warning(
                        "update: refusing to set empty sentences list on %s",
                        sentence_id,
                    )
                    if dirty:
                        self._dump_meta(meta_path, aligned)
                    return False
                entry["sentences"] = new_sentences
            if "slots" in patch:
                entry["slots"] = {
                    str(k): str(v) for k, v in (patch["slots"] or {}).items()
                }
            if "response" in patch:
                response = patch["response"] or ""
                if response:
                    entry["response"] = str(response)
                else:
                    entry.pop("response", None)
            self._dump(path, loaded)
            if dirty:
                self._dump_meta(meta_path, aligned)
            return True
        if dirty:
            self._dump_meta(meta_path, aligned)
        return False

    def _delete_sync(
        self, language: str, intent: str, sentence_id: str
    ) -> bool:
        path = self._path_for(language, intent)
        loaded = self._safe_load(path)
        if not loaded:
            return False
        intents = loaded.get("intents") or {}
        block = intents.get(intent) or {}
        data = block.get("data") or []
        if not isinstance(data, list):
            return False
        meta_path = self._meta_path_for(language, intent)
        aligned, _ = self._aligned_ids(
            language, intent, data, self._load_meta(meta_path)
        )

        new_data: list[Any] = []
        new_ids: list[str] = []
        removed = False
        for idx, entry in enumerate(data):
            if aligned[idx] == sentence_id:
                removed = True
                continue
            new_data.append(entry)
            new_ids.append(aligned[idx])
        if not removed:
            return False

        if new_data:
            block["data"] = new_data
            intents[intent] = block
            loaded["intents"] = intents
            self._dump(path, loaded)
            self._dump_meta(meta_path, new_ids)
            return True

        # Last entry for this intent removed.
        intents.pop(intent, None)
        if intents:
            loaded["intents"] = intents
            self._dump(path, loaded)
        else:
            self._remove_if_exists(path)
        self._remove_if_exists(meta_path)
        return True
