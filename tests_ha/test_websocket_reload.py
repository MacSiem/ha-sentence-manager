"""WebSocket reload outcomes through Home Assistant's service registry."""

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError

from custom_components.ha_sentence_manager.websocket_api import async_register_commands


async def test_reload_reports_completed_service_call(hass: HomeAssistant, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    async_register_commands(hass)
    calls = []

    async def reload_service(call: ServiceCall) -> None:
        calls.append(dict(call.data))

    hass.services.async_register("conversation", "reload", reload_service)
    await client.send_json_auto_id({"type": "ha_sentence_manager/reload"})
    assert await client.receive_json() == {
        "id": 1, "type": "result", "success": True, "result": {"ok": True}
    }
    assert calls == [{}]


async def test_reload_reports_service_exception(hass: HomeAssistant, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    async_register_commands(hass)

    async def reload_service(call: ServiceCall) -> None:
        raise HomeAssistantError("synthetic reload failure")

    hass.services.async_register("conversation", "reload", reload_service)
    await client.send_json_auto_id({"type": "ha_sentence_manager/reload"})
    assert await client.receive_json() == {
        "id": 1, "type": "result", "success": False,
        "error": {"code": "reload_failed", "message": "synthetic reload failure"},
    }
