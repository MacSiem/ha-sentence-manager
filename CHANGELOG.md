# Changelog

## [5.0.4] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [5.0.3] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [5.0.2] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.

## [5.0.1] - 2026-06-13

### Added
- getGridOptions() for sections (grid) layout sizing.

# Changelog

## 5.0.0 — 2026-05-13

**Breaking architectural rewrite.** The card no longer stores sentences in browser `localStorage`. Persistence is now handled by a bundled Python integration that writes sentences as YAML into Home Assistant's official `custom_sentences/<language>/` directory.

### Added
- `custom_components/ha_sentence_manager/` Python integration with `config_flow` setup.
- WebSocket API: `ha_sentence_manager/list`, `/create`, `/update`, `/delete`, `/reload`.
- Multi-language storage: each sentence is written to `custom_sentences/<lang>/ha_sentence_manager_<intent>.yaml`.
- Automatic `conversation.reload` after every create / update / delete.

### Removed
- Browser `localStorage` persistence for sentences (all CRUD now goes through the integration's WS API).
- False README claim about `frontend/set_user_data` cross-device persistence (the API was never used and is not the right API for application data anyway).
- Google Fonts CDN imports for Inter / JetBrains Mono. The card now uses the system font stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, etc.), so it makes no external network calls.

### Migration
- Existing 4.x browser-saved sentences are **not** auto-migrated. Use 4.x's "Export YAML" tab before upgrading if you need to keep them.

## 4.0.0 — 2026-05-10
- HA Tools monorepo split — sentence manager extracted into its own HACS-installable repo.

## 3.x and earlier
- Pre-split history available in the original `MacSiem/ha-tools` repository.
