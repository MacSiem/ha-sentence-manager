"""HA Sentence Manager — Home Assistant integration entry points.

Wires :class:`SentenceStorage` and the WebSocket API handlers into Home
Assistant, then registers the bundled Lovelace card as a frontend
resource so users only have to install the integration — the card is
served and registered automatically.
"""

from __future__ import annotations

import json
import logging
import os

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

from .const import DOMAIN
from .storage import SentenceStorage
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

# URL the integration registers for the bundled Lovelace card.
_CARD_URL_PATH = "/ha_sentence_manager/ha-sentence-manager.js"
_CARD_FILENAME = "ha-sentence-manager.js"
_CARD_PACKAGE_DIR = "www"

# Sentinels under hass.data so we register the static path / JS url and
# the websocket commands at most once per HA process even across
# config-entry reloads (HA's websocket_api raises on duplicate names).
_FRONTEND_REGISTERED = "_frontend_registered"
_WS_REGISTERED = "_ws_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HA Sentence Manager from a config entry."""
    bucket = hass.data.setdefault(DOMAIN, {})
    bucket["storage"] = SentenceStorage(hass)

    if not bucket.get(_WS_REGISTERED):
        async_register_commands(hass)
        bucket[_WS_REGISTERED] = True

    await _async_register_frontend(hass)

    async def _handle_reload(_: ServiceCall) -> None:
        """Service callback: ask the conversation integration to reload."""
        await hass.services.async_call(
            "conversation", "reload", {}, blocking=True
        )

    hass.services.async_register(DOMAIN, "reload", _handle_reload)

    _LOGGER.debug("HA Sentence Manager set up (entry_id=%s)", entry.entry_id)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the config entry.

    Static paths and extra-JS-URL registrations stay in place — HA does
    not expose a stable public deregister API, and they cost nothing if
    the integration is reinstalled later.
    """
    hass.services.async_remove(DOMAIN, "reload")
    bucket = hass.data.get(DOMAIN, {})
    bucket.pop("storage", None)
    _LOGGER.debug("HA Sentence Manager unloaded (entry_id=%s)", entry.entry_id)
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Register the bundled Lovelace card so the user gets it for free.

    Runs once per HA process. The static path makes the bundled JS file
    reachable at ``_CARD_URL_PATH``; ``add_extra_js_url`` tells the HA
    frontend to load it eagerly so the ``custom:ha-sentence-manager``
    element is defined before any dashboard renders it.
    """
    bucket = hass.data.setdefault(DOMAIN, {})
    if bucket.get(_FRONTEND_REGISTERED):
        return

    card_path = os.path.join(
        os.path.dirname(__file__), _CARD_PACKAGE_DIR, _CARD_FILENAME
    )
    if not os.path.isfile(card_path):
        _LOGGER.error(
            "Bundled card file missing at %s; card will not load", card_path
        )
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(_CARD_URL_PATH, card_path, cache_headers=True)]
        )
    except Exception as err:  # pragma: no cover - defensive
        _LOGGER.exception(
            "Failed to register static path %s -> %s: %s",
            _CARD_URL_PATH,
            card_path,
            err,
        )
        return

    # Cache-bust the URL on integration upgrades.
    version_suffix = ""
    manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
    try:
        with open(manifest_path, encoding="utf-8") as handle:
            version_suffix = f"?v={json.load(handle).get('version', '0')}"
    except Exception:  # pragma: no cover - non-fatal
        version_suffix = ""

    add_extra_js_url(hass, f"{_CARD_URL_PATH}{version_suffix}")
    bucket[_FRONTEND_REGISTERED] = True
    _LOGGER.debug(
        "Registered Lovelace card at %s (file=%s)", _CARD_URL_PATH, card_path
    )
