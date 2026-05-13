"""WebSocket API for HA Sentence Manager.

Exposes five admin-only commands consumed by the bundled Lovelace card:

* ``ha_sentence_manager/list``    – list every persisted sentence (optional language filter)
* ``ha_sentence_manager/create``  – add a new sentence for a (language, intent) pair
* ``ha_sentence_manager/update``  – patch sentences / slots / response on an existing entry
* ``ha_sentence_manager/delete``  – remove an entry (and its file if it ends up empty)
* ``ha_sentence_manager/reload``  – ask the conversation integration to reload sentences

The storage helper (``SentenceStorage``) is looked up from
``hass.data[DOMAIN]["storage"]`` on each call, which keeps these handlers
stateless and safe to register at integration setup.
"""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .storage import SentenceStorage

_LOGGER = logging.getLogger(__name__)


def _storage(hass: HomeAssistant) -> SentenceStorage:
    """Return the storage instance registered by ``async_setup_entry``."""
    return hass.data[DOMAIN]["storage"]


@websocket_api.websocket_command(
    {
        vol.Required("type"): "ha_sentence_manager/list",
        vol.Optional("language"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return every persisted sentence, optionally filtered by language."""
    try:
        items = await _storage(hass).list_all(msg.get("language"))
    except Exception as err:  # noqa: BLE001 — surface as a WS error
        _LOGGER.exception("list failed: %s", err)
        connection.send_error(msg["id"], "list_failed", str(err))
        return
    connection.send_result(msg["id"], items)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "ha_sentence_manager/create",
        vol.Required("intent"): str,
        vol.Required("sentences"): [str],
        vol.Required("language"): str,
        vol.Optional("slots", default=dict): {str: str},
        vol.Optional("response", default=""): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_create(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create a new sentence entry and return its generated id."""
    payload = {
        "language": msg["language"],
        "intent": msg["intent"],
        "sentences": msg["sentences"],
        "slots": msg.get("slots") or {},
        "response": msg.get("response") or "",
    }
    try:
        sentence_id = await _storage(hass).create(payload)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_payload", str(err))
        return
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("create failed: %s", err)
        connection.send_error(msg["id"], "create_failed", str(err))
        return
    connection.send_result(msg["id"], {"id": sentence_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "ha_sentence_manager/update",
        vol.Required("sentence_id"): str,
        vol.Required("patch"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Patch sentences / slots / response on an existing entry."""
    try:
        ok = await _storage(hass).update(msg["sentence_id"], msg["patch"])
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("update failed: %s", err)
        connection.send_error(msg["id"], "update_failed", str(err))
        return
    connection.send_result(msg["id"], {"ok": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "ha_sentence_manager/delete",
        vol.Required("sentence_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an entry; the file is removed when it ends up empty."""
    try:
        ok = await _storage(hass).delete(msg["sentence_id"])
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("delete failed: %s", err)
        connection.send_error(msg["id"], "delete_failed", str(err))
        return
    connection.send_result(msg["id"], {"ok": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "ha_sentence_manager/reload",
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_reload(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Tell the ``conversation`` integration to reload sentence files."""
    try:
        await hass.services.async_call(
            "conversation", "reload", {}, blocking=True
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("reload failed: %s", err)
        connection.send_error(msg["id"], "reload_failed", str(err))
        return
    connection.send_result(msg["id"], {"ok": True})


def async_register_commands(hass: HomeAssistant) -> None:
    """Register every websocket command exported by this module."""
    for handler in (_ws_list, _ws_create, _ws_update, _ws_delete, _ws_reload):
        websocket_api.async_register_command(hass, handler)
