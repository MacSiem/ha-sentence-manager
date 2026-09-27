"""HA Sentence Manager — Home Assistant integration entry points.

Wires :class:`SentenceStorage` and the WebSocket API handlers into Home
Assistant, then registers the bundled Lovelace card as a frontend
resource so users only have to install the integration — the card is
served and registered automatically.
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.service import async_register_admin_service

from .const import DOMAIN
from .frontend import (
    async_register_card,
    async_register_panel,
    async_register_static,
    async_unregister_card,
    async_unregister_panel,
)
from .storage import SentenceStorage
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

# Sentinels under hass.data so we register the static path / JS url and
# the websocket commands at most once per HA process even across
# config-entry reloads (HA's websocket_api raises on duplicate names).
_FRONTEND_REGISTERED = "_frontend_registered"
_PANEL_REGISTERED = "_panel_registered"
_WS_REGISTERED = "_ws_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HA Sentence Manager from a config entry."""
    bucket = hass.data.setdefault(DOMAIN, {})
    bucket["storage"] = SentenceStorage(hass)

    if not bucket.get(_WS_REGISTERED):
        async_register_commands(hass)
        bucket[_WS_REGISTERED] = True

    if not bucket.get(_FRONTEND_REGISTERED):
        await async_register_static(hass)
        await async_register_card(hass)
        bucket[_FRONTEND_REGISTERED] = True
    if not bucket.get(_PANEL_REGISTERED):
        bucket[_PANEL_REGISTERED] = await async_register_panel(hass)

    async def _handle_reload(_: ServiceCall) -> None:
        """Service callback: ask the conversation integration to reload."""
        await hass.services.async_call(
            "conversation", "reload", {}, blocking=True
        )

    async_register_admin_service(hass, DOMAIN, "reload", _handle_reload)

    _LOGGER.debug("HA Sentence Manager set up (entry_id=%s)", entry.entry_id)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the config entry.

    Remove owned resource and sidebar panel; the static path remains safe to
    reuse if this integration is reinstalled in the same HA process.
    """
    hass.services.async_remove(DOMAIN, "reload")
    bucket = hass.data.get(DOMAIN, {})
    bucket.pop("storage", None)
    if bucket.pop(_PANEL_REGISTERED, False):
        async_unregister_panel(hass)
    if bucket.pop(_FRONTEND_REGISTERED, False):
        await async_unregister_card(hass)
    _LOGGER.debug("HA Sentence Manager unloaded (entry_id=%s)", entry.entry_id)
    return True
