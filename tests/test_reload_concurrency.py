"""Regression tests for CRUD jobs overlapping config-entry reload."""
from __future__ import annotations
import asyncio
import importlib.util
import itertools
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import threading
import types
from concurrent.futures import ThreadPoolExecutor

SOURCE = Path(__file__).resolve().parents[1]
DOMAIN = "ha_sentence_manager"
LANG, INTENT = "en", "QAStatus"
BASE_ID = "en:QAStatus:00000001"


def module(name, **values):
    value = types.ModuleType(name)
    value.__dict__.update(values)
    sys.modules[name] = value
    return value


def load_sources(storage_source):
    module("homeassistant", __path__=[])
    module("homeassistant.core", HomeAssistant=object, ServiceCall=object)
    module("homeassistant.config_entries", ConfigEntry=object)
    module("homeassistant.helpers", __path__=[])
    module("homeassistant.helpers.service", async_register_admin_service=lambda *a: None)
    module("homeassistant.components", __path__=[])
    identity = lambda f: f
    module("homeassistant.components.websocket_api", websocket_command=lambda s: identity,
           async_response=identity, require_admin=identity,
           ActiveConnection=object, async_register_command=lambda *a: None)
    module("voluptuous", Required=lambda k, **kw: k, Optional=lambda k, **kw: k)
    pkg = "_lifecycle_proposal"
    module(pkg, __path__=[])
    async def noop(*args):
        return True
    module(pkg + ".frontend", async_register_card=noop, async_register_panel=noop,
           async_register_static=noop, async_unregister_card=noop,
           async_unregister_panel=lambda *a: None)
    component = SOURCE / "custom_components/ha_sentence_manager"
    def load(name, path, package=False):
        spec = importlib.util.spec_from_file_location(name, path,
            submodule_search_locations=[] if package else None)
        obj = importlib.util.module_from_spec(spec)
        sys.modules[name] = obj
        spec.loader.exec_module(obj)
        return obj
    load(pkg + ".const", component / "const.py")
    storage = load(pkg + ".storage", storage_source)
    numbers = itertools.count(2)
    storage.uuid = types.SimpleNamespace(uuid4=lambda: types.SimpleNamespace(
        hex=f"{next(numbers):08x}" + "0" * 24))
    ws = load(pkg + ".websocket_api", component / "websocket_api.py")
    integration = load(pkg, component / "__init__.py", package=True)
    return storage, ws, integration


class FakeHass:
    def __init__(self, root, pool, loop):
        self.data = {}
        self.config = types.SimpleNamespace(path=lambda name: str(root / name))
        self.services = types.SimpleNamespace(async_remove=lambda *a: None)
        self.pool, self.loop = pool, loop
    def async_add_executor_job(self, fn, *args):
        return self.loop.run_in_executor(self.pool, fn, *args)


class Connection:
    def __init__(self):
        self.result = None
        self.error = None
    def send_result(self, _id, value):
        self.result = value
    def send_error(self, _id, code, detail):
        self.error = {"code": code, "detail": detail}


class ObservedLock:
    """Report contender admission without guessing from elapsed time."""
    def __init__(self, lock, loop, attempted):
        self.lock, self.loop, self.attempted = lock, loop, attempted
    def __enter__(self):
        acquired = self.lock.acquire(blocking=False)
        self.loop.call_soon_threadsafe(self.attempted.set_result, acquired)
        if not acquired:
            self.lock.acquire()
        return self
    def __exit__(self, *args):
        self.lock.release()


async def run_scenario(kind, storage_module, ws, integration):
    loop = asyncio.get_running_loop()
    release = threading.Event()
    paused = loop.create_future()
    attempted = loop.create_future()
    events = []
    with tempfile.TemporaryDirectory(prefix=f"{kind}-", dir=tempfile.gettempdir()) as temp:
        root = Path(temp)
        with ThreadPoolExecutor(max_workers=2) as pool:
            hass = FakeHass(root, pool, loop)
            entry = types.SimpleNamespace(entry_id="synthetic")
            await integration.async_setup_entry(hass, entry)
            old = hass.data[DOMAIN]["storage"]
            await hass.async_add_executor_job(old._create_sync, LANG, INTENT,
                                             ["base"], {}, "initial", BASE_ID)
            rows = await old.list_all(LANG)
            revision = rows[0]["revision"]
            path = old._path_for(LANG, INTENT)
            def pause():
                events.append("old executor paused inside serialized operation")
                loop.call_soon_threadsafe(paused.set_result, True)
                if not release.wait(6):
                    raise RuntimeError("fixture gate watchdog; not a test success")
            if kind == "create_sidecar":
                original = old._dump_meta
                def hooked(meta_path, ids):
                    pause()
                    return original(meta_path, ids)
                old._dump_meta = hooked
            else:
                original = old._file_revision
                def hooked(file):
                    result = original(file)
                    if file == path:
                        pause()
                    return result
                old._file_revision = hooked
            old_conn, new_conn = Connection(), Connection()
            def create_msg(number, phrase):
                return {"id": number, "language": LANG, "intent": INTENT,
                        "sentences": [phrase]}
            if kind in ("create_compare_replace", "create_sidecar"):
                first = ws._ws_create(hass, old_conn, create_msg(1, "old create"))
                new_handler, new_msg = ws._ws_create, create_msg(2, "new create")
            elif kind == "update_compare_replace":
                first = ws._ws_update(hass, old_conn, {"id": 1,
                    "sentence_id": BASE_ID, "patch": {"response": "old update"},
                    "revision": revision})
                new_handler, new_msg = ws._ws_update, {"id": 2,
                    "sentence_id": BASE_ID, "patch": {"response": "new update"},
                    "revision": revision}
            elif kind == "last_delete_create":
                first = ws._ws_delete(hass, old_conn, {"id": 1,
                    "sentence_id": BASE_ID, "revision": revision})
                new_handler, new_msg = ws._ws_create, create_msg(2, "new create")
            else:
                raise ValueError(kind)
            old_task = asyncio.create_task(first)
            await asyncio.wait_for(asyncio.shield(paused), 6)
            try:
                assert not old_task.done()
                await integration.async_unload_entry(hass, entry)
                await integration.async_setup_entry(hass, entry)
                new = hass.data[DOMAIN]["storage"]
                assert new is not old
                events.append("actual unload/setup returned while old WS task pending")
                new._io_lock = ObservedLock(new._io_lock, loop, attempted)
                new_task = asyncio.create_task(new_handler(hass, new_conn, new_msg))
                admitted = await asyncio.wait_for(asyncio.shield(attempted), 6)
                events.append(f"new executor immediately admitted={admitted}")
                if admitted:
                    await asyncio.wait_for(asyncio.shield(new_task), 6)
                    events.append("new WS request completed before releasing old executor")
                release.set()
                await asyncio.wait_for(asyncio.gather(old_task, new_task), 6)
                # One observed acquisition is sufficient; restore before readback.
                new._io_lock = new._io_lock.lock
                meta_path = new._meta_path_for(LANG, INTENT)
                before_repair = new._safe_load(meta_path)
                final_rows = await new.list_all(LANG)
                after_repair = new._safe_load(meta_path)
                behavior_errors = []
                def require(condition, message):
                    if not condition:
                        behavior_errors.append(message)
                if kind in ("create_compare_replace", "create_sidecar"):
                    require(old_conn.error is None and new_conn.error is None,
                            "both lifecycle creates should finish successfully")
                    actual = {row["sentences"][0]: row["id"] for row in final_rows}
                    expected = {"base": BASE_ID,
                        "old create": (old_conn.result or {}).get("id"),
                        "new create": (new_conn.result or {}).get("id")}
                    require(actual == expected,
                            "acknowledged create IDs must stay attached to all three phrases")
                elif kind == "update_compare_replace":
                    success_count = sum(conn.result == {"ok": True}
                                        for conn in (old_conn, new_conn))
                    require(success_count == 1,
                            "exactly one update using original revision may commit")
                    require(new_conn.error is not None and new_conn.error["code"] == "conflict",
                            "contending new update should receive a conflict")
                    require(len(final_rows) == 1 and final_rows[0]["id"] == BASE_ID,
                            "original metadata ID must survive")
                elif kind == "last_delete_create":
                    require(old_conn.result == {"ok": True} and new_conn.error is None,
                            "delete then create should finish successfully")
                    actual = {row["sentences"][0]: row["id"] for row in final_rows}
                    expected = {"new create": (new_conn.result or {}).get("id")}
                    require(actual == expected,
                            "new acknowledged create must survive old last-delete")
                return {"scenario": kind, "events": events,
                    "old_response": old_conn.__dict__, "new_response": new_conn.__dict__,
                    "main_exists": Path(path).exists(), "sidecar_before_read_repair": before_repair,
                    "sidecar_after_read_repair": after_repair, "final_rows": final_rows,
                    "behavior_assertion_failures": behavior_errors}
            finally:
                release.set()


class ReloadConcurrencyTests(unittest.TestCase):
    """Persisted CRUD semantics across real setup/unload with pending WS jobs.

    Only HA registration is mocked. Two executor threads and YAML/ID files are
    real; event gates enforce each collision without timing sleeps. This tests
    config-entry reload, independently of conversation.reload.
    """
    def check_scenario(self, kind):
        with mock.patch.dict(sys.modules):
            storage, ws, integration = load_sources(
                SOURCE / "custom_components/ha_sentence_manager/storage.py")
            result = asyncio.run(run_scenario(kind, storage, ws, integration))
        self.assertEqual(result["behavior_assertion_failures"], [], result)

    def test_reload_create_preserves_acknowledged_ids_at_revision_check(self):
        self.check_scenario("create_compare_replace")

    def test_reload_create_preserves_acknowledged_ids_at_sidecar_write(self):
        self.check_scenario("create_sidecar")

    def test_reload_update_conflicts_on_original_revision(self):
        self.check_scenario("update_compare_replace")

    def test_reload_last_delete_does_not_remove_new_create(self):
        self.check_scenario("last_delete_create")
