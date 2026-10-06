"""Recover sentence/ID pairs after interrupted operations on real files."""
import os
import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_storage import SentenceStorage, _FakeHass


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.hass = _FakeHass(self.tmp.name)
        self.storage = SentenceStorage(self.hass)
        self.a, self.b = "en:QARecovery:aaaa", "en:QARecovery:bbbb"
        self.storage._create_sync("en", "QARecovery", ["first"], {}, "", self.a)
        self.storage._create_sync("en", "QARecovery", ["second"], {}, "", self.b)
        self.path = self.storage._path_for("en", "QARecovery")
        self.meta = self.storage._meta_path_for("en", "QARecovery")

    def rows(self):
        return SentenceStorage(self.hass)._list_all_sync("en")

    def test_metadata_failure_keeps_yaml_and_ids_before_delete(self):
        old = Path(self.path).read_bytes()
        revision = self.rows()[0]["revision"]
        with mock.patch.object(self.storage, "_dump_meta", side_effect=OSError("metadata interrupted")):
            with self.assertRaises(OSError):
                self.storage._delete_sync("en", "QARecovery", self.a, revision)
        self.assertEqual(Path(self.path).read_bytes(), old)
        self.assertEqual([r["id"] for r in self.rows()], [self.a, self.b])

    def test_create_after_external_removal_retains_acknowledged_new_id(self):
        loaded = self.storage._safe_load(self.path)
        loaded["intents"]["QARecovery"]["data"].pop()
        self.storage._dump(self.path, loaded)
        sid = "en:QARecovery:cccc"
        self.storage._create_sync("en", "QARecovery", ["third"], {}, "", sid)
        self.assertEqual([r["id"] for r in self.rows()], [self.a, sid])

    def test_external_reorder_retains_ids_for_unchanged_entries(self):
        self.rows()
        loaded = self.storage._safe_load(self.path)
        loaded["intents"]["QARecovery"]["data"].reverse()
        self.storage._dump(self.path, loaded)
        self.assertEqual([r["id"] for r in self.rows()], [self.b, self.a])

    def test_yaml_failure_after_metadata_preparation_recovers_original_ids(self):
        old = Path(self.path).read_bytes()
        dump = self.storage._dump
        def fail_yaml(path, *args, **kwargs):
            if path == self.path:
                raise OSError("YAML interrupted")
            return dump(path, *args, **kwargs)
        with mock.patch.object(self.storage, "_dump", side_effect=fail_yaml):
            with self.assertRaises(OSError):
                self.storage._delete_sync("en", "QARecovery", self.a, self.rows()[0]["revision"])
        self.assertEqual(Path(self.path).read_bytes(), old)
        self.assertEqual([r["id"] for r in self.rows()], [self.a, self.b])

    def test_restart_after_yaml_replace_retains_remaining_id(self):
        dump = self.storage._dump
        def interrupt_after_replace(path, *args, **kwargs):
            dump(path, *args, **kwargs)
            if path == self.path:
                raise OSError("process interrupted after replace")
        with mock.patch.object(self.storage, "_dump", side_effect=interrupt_after_replace):
            with self.assertRaises(OSError):
                self.storage._delete_sync("en", "QARecovery", self.a, self.rows()[0]["revision"])
        self.assertEqual([(r["id"], r["sentences"]) for r in self.rows()], [(self.b, ["second"])])

    def test_list_skips_sentence_symlink_outside_root(self):
        outside = Path(self.tmp.name) / "private.yaml"
        outside.write_text("language: en\nintents:\n  Private:\n    data:\n      - sentences: [private text]\n")
        os.symlink(outside, Path(self.path).parent / "ha_sentence_manager_Private.yaml")
        self.assertEqual([r["id"] for r in self.rows()], [self.a, self.b])

    def test_colon_intent_can_be_created_read_edited_and_deleted_by_its_id(self):
        async def executor(method, *args):
            return method(*args)
        self.hass.async_add_executor_job = executor
        async def roundtrip(language):
            sid = await self.storage.create({"language":language, "intent":"QA:literal", "sentences":["literal phrase"]})
            row = await self.storage.get_one(sid)
            self.assertIsNotNone(row)
            self.assertTrue(await self.storage.update(sid, {"response":"literal: answer"}, row["revision"]))
            row = await self.storage.get_one(sid)
            self.assertEqual(row["response"], "literal: answer")
            self.assertTrue(await self.storage.delete(sid, row["revision"]))
            self.assertIsNone(await self.storage.get_one(sid))
        asyncio.run(roundtrip("en"))
        asyncio.run(roundtrip("en:custom"))
