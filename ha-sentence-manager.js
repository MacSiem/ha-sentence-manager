/* HA Tools split — ha-sentence-manager v4.0.0 (2026-05-10) — single-tool standalone repo */
(function() {
'use strict';

// XSS protection helper (reuse global from panel, fallback for standalone)
const _esc = window._haToolsEsc || ((s) => typeof s === 'string' ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]) : (s ?? ''));

// -- HA Tools Persistence (stub -- full impl in ha-tools-panel.js) --
window._haToolsPersistence = window._haToolsPersistence || { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-sentence-manager-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-sentence-manager] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-sentence-manager-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-sentence-manager-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };


/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
if (typeof window !== 'undefined' && !window.HAToolsBentoCSS) {
  window.HAToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v1.0
   ═══════════════════════════════════════════════ */

/* ── CSS Custom Properties ───────────────────── */
:host {
  /* Primary palette */
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);

  /* Theme — maps to HA theme vars with light fallbacks */
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);

  /* Radii */
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;

  /* Shadows */
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);

  /* Transition */
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: block;
  color: var(--bento-text);
}

/* ── Dark mode ───────────────────────────────── */
@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-border: var(--divider-color, #2a2a4a);
    --bento-text: var(--primary-text-color, #e0e0e0);
    --bento-text-secondary: var(--secondary-text-color, #a0a0b0);
    --bento-text-muted: var(--disabled-text-color, #6a6a7a);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --bento-primary-light: rgba(59,130,246,0.15);
    --bento-success-light: rgba(16,185,129,0.15);
    --bento-error-light: rgba(239,68,68,0.15);
    --bento-warning-light: rgba(245,158,11,0.15);
    color-scheme: dark !important;
  }
  .card, .card-container, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg); color: var(--bento-text); border-color: var(--bento-border); }
  .stat, .stat-card, .summary-card, .metric-card, .kpi-card, .health-card { background: var(--bento-bg); border-color: var(--bento-border); }
  .tab-content, .section { color: var(--bento-text); }
  table th { background: var(--bento-bg); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  tr:hover td { background: rgba(59,130,246,0.08); }
  .empty-state, .no-data { color: var(--bento-text-secondary); }
  .schedule-section, .settings-section, .detail-panel, .details, .device-detail { background: var(--bento-bg); border-color: var(--bento-border); }
  .addon-list, .content-item { background: rgba(255,255,255,0.05); }
  .chart-container { background: var(--bento-bg); border-color: var(--bento-border); }
  pre, code { background: #1e293b !important; color: #e2e8f0 !important; }
}

/* ── Reset ───────────────────────────────────── */
* { box-sizing: border-box; }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-sm);
  color: var(--bento-text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 16px 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-icon { font-size: 22px; }
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-border);
  color: var(--bento-text-secondary);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 500;
}
.content { padding: 16px 20px 20px; }

/* ── Tabs (Bento unified) ────────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important;
  gap: 4px !important;
  border-bottom: 2px solid var(--bento-border, var(--divider-color, #334155)) !important;
  padding: 0 4px !important;
  margin-bottom: 20px !important;
  overflow-x: auto !important; overflow-y: hidden !important; -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 10px 18px !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text-secondary, var(--secondary-text-color, #94A3B8)) !important;
  border-bottom: 2px solid transparent !important;
  margin-bottom: -2px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  white-space: nowrap !important;
  border-radius: 0 !important;
  flex: none !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.08) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  color: var(--bento-primary, #3B82F6) !important;
  border-bottom-color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.04) !important;
  font-weight: 600 !important;
}

/* ── Tab content animation ───────────────────── */
.tab-content {
  display: block;
}
.tab-content.active {
  animation: bentoFadeIn 0.3s ease-out;
}
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards ────────────────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-card, var(--card-background-color, #1E293B)) !important;
  border: 1px solid var(--bento-border, var(--divider-color, #334155)) !important;
  border-radius: var(--bento-radius-sm, 10px) !important;
  padding: 16px !important;
  text-align: center !important;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  box-shadow: var(--bento-shadow-md);
}
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--bento-text);
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px;
  color: var(--bento-text-secondary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ── Overview grid (2×2 stat layout) ─────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

/* ── Section headers ─────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--bento-text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 12px 0 8px;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--bento-primary), transparent);
  border-radius: 2px;
  animation: bentoLoad 1s infinite;
  margin-bottom: 8px;
}
@keyframes bentoLoad { 0% { background-position: 0; } 100% { background-position: 200px; } }

.empty-state, .no-data, .no-results {
  text-align: center;
  color: var(--bento-text-secondary);
  padding: 32px 16px;
  font-size: 13px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
}
.info-note, .tip-box {
  font-size: 12px;
  color: var(--bento-text-secondary);
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
  padding: 8px 10px;
  border-left: 3px solid var(--bento-primary);
  margin-top: 8px;
}
.last-updated {
  font-size: 11px;
  color: var(--bento-text-muted);
  text-align: right;
  margin-top: 8px;
}

/* ── Buttons ─────────────────────────────────── */
.refresh-btn {
  background: var(--bento-border);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--bento-text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.refresh-btn:hover { background: var(--bento-primary); color: white; }

.toggle-btn, .action-btn {
  background: var(--bento-primary);
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.toggle-btn:hover, .action-btn:hover { opacity: .85; }

.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--bento-transition);
}
.send-btn:hover, .btn-primary:hover {
  background: var(--bento-primary-hover);
  transform: translateY(-1px);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Badges / Status ─────────────────────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* ── Count badges (inline) ───────────────────── */
.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.error-badge { background: rgba(239,68,68,0.13); color: var(--bento-error); }
.warn-badge  { background: rgba(245,158,11,0.13); color: var(--bento-warning); }
.info-badge  { background: rgba(59,130,246,0.13); color: var(--bento-primary); }
.ok-badge    { background: rgba(16,185,129,0.13); color: var(--bento-success); }

/* ── Tables ───────────────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg);
  color: var(--bento-text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid var(--bento-border);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text);
  font-size: 13px;
}
tr:hover td { background: var(--bento-primary-light); }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  font-size: 13px;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-border);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 14px;
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px 6px;
  padding: 8px;
  border-radius: var(--bento-radius-sm);
  margin-bottom: 4px;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
}
.error-entry { background: var(--bento-error-light); border: 1px solid rgba(239,68,68,0.13); }
.warn-entry  { background: var(--bento-warning-light); border: 1px solid rgba(245,158,11,0.13); }
.log-time { color: var(--bento-text-muted); flex-shrink: 0; }
.log-domain {
  font-weight: 600;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary);
  flex-basis: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  min-width: 0;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 10px 14px;
  border-radius: var(--bento-radius-sm);
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 12px; }
  .tabs { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; gap: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 10px !important; font-size: 12px !important; white-space: nowrap !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 18px !important; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px !important; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; }
  .log-domain { max-width: 60%; font-size: 11px; }
  .log-msg { flex-basis: 100%; max-width: 100%; overflow-wrap: anywhere; font-size: 11px; }
  pre { white-space: pre-wrap; word-break: break-all; max-width: calc(100vw - 80px); overflow-x: auto; }
  .panels, .board { flex-direction: column; }
  .column { min-width: unset; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
}

/* ── Mobile — 480 px ─────────────────────────── */
@media (max-width: 480px) {
  .tabs { gap: 1px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 8px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 16px !important; }
}
`;
}
// XSS escape singleton (idempotent)
if (typeof window !== 'undefined') {
  window._haToolsEsc = window._haToolsEsc || (function(){
    var MAP = {};
    MAP[String.fromCharCode(38)] = '&amp;';
    MAP[String.fromCharCode(60)] = '&lt;';
    MAP[String.fromCharCode(62)] = '&gt;';
    MAP[String.fromCharCode(34)] = '&quot;';
    MAP[String.fromCharCode(39)] = '&#39;';
    return function(s){ return typeof s === 'string' ? s.replace(/[&<>"']/g, function(c){ return MAP[c]; }) : (s == null ? '' : s); };
  })();
}
/* ============================================================ */

class HASentenceManager extends HTMLElement {
  constructor() {
    super();
    this._toolId = this.tagName.toLowerCase().replace('ha-', '');
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this._hass = null;
    this.config = {};
    this.sentences = [];
    this._loadData();
    this.currentTab = 'ha-sentences';
    this.editingIndex = null;
    this._haSentences = null;
    this._haSentencesLoading = false;
    this._haSentencesError = null;
    this._autoDetectRan = false;
    this._testResultHA = null;
    this._testLoading = false;
    // --- Throttle fields ---
    this._lastRenderTime = 0;
    this._renderScheduled = false;
    this._firstHassRender = false;
    // --- Pagination ---
    this._currentPage = {};
    this._pageSize = 15;
    this.templateLibrary = {
      lights: [
        { trigger: 'Turn on {area} lights', intent: 'turn_on', slots: { area: 'string' } },
        { trigger: 'Turn off {area} lights', intent: 'turn_off', slots: { area: 'string' } },
        { trigger: 'Set {area} brightness to {level} percent', intent: 'set_brightness', slots: { area: 'string', level: 'number' } },
      ],
      climate: [
        { trigger: 'Set temperature to {degrees} degrees', intent: 'set_temperature', slots: { degrees: 'number' } },
        { trigger: 'Set {room} thermostat to {temperature}', intent: 'set_room_temp', slots: { room: 'string', temperature: 'number' } },
      ],
      media: [
        { trigger: 'Play {playlist}', intent: 'play_media', slots: { playlist: 'string' } },
        { trigger: 'Pause music', intent: 'pause_media', slots: {} },
        { trigger: 'Next track', intent: 'next_track', slots: {} },
      ],
      covers: [
        { trigger: 'Open {cover_name} blinds', intent: 'open_cover', slots: { cover_name: 'string' } },
        { trigger: 'Close {cover_name}', intent: 'close_cover', slots: { cover_name: 'string' } },
      ],
      locks: [
        { trigger: 'Lock the {lock_name}', intent: 'lock', slots: { lock_name: 'string' } },
        { trigger: 'Unlock the {lock_name}', intent: 'unlock', slots: { lock_name: 'string' } },
      ],
      scenes: [
        { trigger: 'Activate {scene_name}', intent: 'activate_scene', slots: { scene_name: 'string' } },
        { trigger: 'Turn on {scene_name} scene', intent: 'activate_scene', slots: { scene_name: 'string' } },
      ],
    };
  }

  setConfig(config) {
    this.config = config;
    this.render();
  }

  set hass(hass) {

    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';    const prevHass = this._hass;
    this._hass = hass;
    if (!hass) return;
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this.render();
      this._lastRenderTime = Date.now();
      // Auto-detect intents on first hass load if on ha-sentences tab
      if (this.currentTab === 'ha-sentences' && !this._autoDetectRan && !this._haSentences) {
        this._autoDetectRan = true;
        setTimeout(() => this._autoDetectIntents(), 500);
      }
      return;
    }
    // Only re-render on hass update if entities actually changed
    // Sentence Manager has no entity dependencies — skip re-render on hass updates
    // Re-rendering is handled explicitly by user actions (tab switch, save, etc.)
  }

  get hass() {
    return this._hass;
  }

  get _t() {
    const T = {
      pl: {
        title: 'Mened\u017Cer Zda\u0144',
        loading: 'Wczytywanie...',
        noData: 'Brak danych',
        error: 'B\u0142\u0105d',
        save: 'Zapisz',
        cancel: 'Anuluj',
        delete: 'Usu\u0144',
        edit: 'Edytuj',
        add: 'Dodaj',
        search: 'Szukaj...',
        sentences: 'Zdania',
        intents: 'Intencje',
        responses: 'Odpowiedzi',
        saved: 'Zapisano',
        deleted: 'Usuni\u0119to',
        confirmDelete: 'Czy na pewno chcesz usun\u0105\u0107?',
        customActionDesc: 'Twórz własne akcje głosowe powiązane z usługami HA. Każda akcja generuje sentence + automation YAML.',
        triggerPhraseEg: 'np. włącz tryb filmowy',
        helpTitle: 'Jak działają komendy głosowe?',
        helpEditor: 'Editor — tworzysz zdania (sentences), które HA rozpoznaje jako komendy głosowe.',
        helpSyntax: 'Składnia: użyj [opcja1|opcja2] dla alternatyw, {slot_name} dla zmiennych.',
        helpIntent: 'Intent — nazwa akcji (np. TurnOnLight). HA mapuje intent na automatyzację.',
        helpTest: 'Test — testuj zdania w zakładce Test — wyślij tekst do Conversation API.',
        helpImportExport: 'Import/Export — eksportuj do YAML, importuj z pliku.',
        helpExample: '[włącz|zapal] [światło|lampę] w {room}',
        detectViaAPI: 'Wykryte przez Conversation API',
        language: 'Język:',
        categoryBaby: '👶 Dziecko',
        categoryLighting: '💡 Oświetlenie',
        categoryClimate: '🌡️ Klimat',
        categoryMedia: '🎵 Media',
        categoryCovers: '🏠 Rolety',
        categorySecurity: '🔒 Bezpieczeństwo',
        categoryScenes: '🎭 Sceny',
        categoryOther: '🔧 Inne',
        intentsCount: 'Intentów',
        sentencesCount: 'Zdań',
        slotListsTitle: '📖 Listy slotów',
        valuesLabel: 'wartości',
        refreshBtn: 'Odśwież',
        directoryStructure: 'Struktura katalogów:',
        autoDetectHint: 'Testuje znane frazy przez Conversation API, aby wykryć działające intenty.',
        pasteYamlHint: 'Skopiuj zawartość pliku YAML z katalogu custom_sentences i wklej poniżej.',
        customVoiceCommands: 'Niestandardowe komendy głosowe skonfigurowane w Home Assistant.',
        importedSentences: 'Zaimportowano {count} zdań z HA',
        allSentencesExist: 'Wszystkie zdania już istnieją w edytorze',
        detectedIntents: 'Wykryto {count} działających intentów!',
        noCustomIntents: 'Nie wykryto żadnych custom intentów.',
        inputLabel: 'Wejście:',
        responseLabel: 'Odpowiedź HA:',
        errorLabel: 'Błąd:',
        testDirectly: 'Testuj zdania bezpośrednio przez Home Assistant Conversation API.',
        enterVoiceCommand: 'Wpisz komendę głosową...',
        quickTest: 'Szybki test:',
        breastfeedLeft: 'karmiać piersią lewą',
        breastfeedEnd: 'koniec karmienia',
        diaperWet: 'zmieniono pieluchę mokra',
        bottleFeeding: 'karmiać butelką',
        pumping: 'odciąganie mleka',
        diaperCount: 'ile pieluch',
        yamlParsedSuccess: 'YAML sparsowany pomyślnie!',
        noIntentsFound: 'Nie znaleziono intentów w YAML',
        loadingCustomSentences: 'Wczytywanie custom sentences z HA...',
        customSentencesInfo: 'HA automatycznie wczytuje pliki YAML z katalogu config/custom_sentences/ dla każdego języka (np. pl/, en/). Narzędzie szuka w katalogu skonfigurowanego języka.',
        configYamlNote: 'ℹ️ Nie trzeba nic dodawać do configuration.yaml — HA automatycznie wykrywa pliki w tym katalogu po restarcie.',
        autoDetect: '📍 Automatyczne wykrywanie',
        pasteYaml: '📋 Wklej YAML',
        newFile: 'Nowy plik...',
        orEnterFileName: 'lub wpisz nazwę nowego pliku...',
        pasteContent: 'Wklej zawartość...',
      },
      en: {
        title: 'Sentence Manager',
        loading: 'Loading...',
        noData: 'No data',
        error: 'Error',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search...',
        sentences: 'Sentences',
        intents: 'Intents',
        responses: 'Responses',
        saved: 'Saved',
        deleted: 'Deleted',
        confirmDelete: 'Are you sure you want to delete?',
        customActionDesc: 'Create your own voice actions linked to HA services. Each action generates sentence + automation YAML.',
        triggerPhraseEg: 'e.g. turn on movie mode',
        helpTitle: 'How do voice commands work?',
        helpEditor: 'Editor — you create sentences that HA recognizes as voice commands.',
        helpSyntax: 'Syntax: use [option1|option2] for alternatives, {slot_name} for variables.',
        helpIntent: 'Intent — the action name (e.g., TurnOnLight). HA maps the intent to automation.',
        helpTest: 'Test — test sentences in the Test tab — send text to Conversation API.',
        helpImportExport: 'Import/Export — export to YAML, import from file.',
        helpExample: '[turn on|light] [light|lamp] in {room}',
        detectViaAPI: 'Detected via Conversation API',
        language: 'Language:',
        categoryBaby: '👶 Baby',
        categoryLighting: '💡 Lighting',
        categoryClimate: '🌡️ Climate',
        categoryMedia: '🎵 Media',
        categoryCovers: '🏠 Covers',
        categorySecurity: '🔒 Security',
        categoryScenes: '🎭 Scenes',
        categoryOther: '🔧 Other',
        intentsCount: 'Intents',
        sentencesCount: 'Sentences',
        slotListsTitle: '📖 Slot Lists',
        valuesLabel: 'values',
        refreshBtn: 'Refresh',
        directoryStructure: 'Directory structure:',
        autoDetectHint: 'Tests known phrases via Conversation API to detect working intents.',
        pasteYamlHint: 'Copy YAML file content from custom_sentences directory and paste below.',
        customVoiceCommands: 'Custom voice commands configured in Home Assistant.',
        importedSentences: 'Imported {count} sentences from HA',
        allSentencesExist: 'All sentences already exist in editor',
        detectedIntents: 'Detected {count} working intents!',
        noCustomIntents: 'No custom intents detected.',
        inputLabel: 'Input:',
        responseLabel: 'HA Response:',
        errorLabel: 'Error:',
        testDirectly: 'Test sentences directly via Home Assistant Conversation API.',
        enterVoiceCommand: 'Enter voice command...',
        quickTest: 'Quick test:',
        breastfeedLeft: 'start breastfeeding left breast',
        breastfeedEnd: 'end breastfeeding',
        diaperWet: 'changed wet diaper',
        bottleFeeding: 'bottle feeding',
        pumping: 'pumping',
        diaperCount: 'diaper count today',
        yamlParsedSuccess: 'YAML parsed successfully!',
        noIntentsFound: 'No intents found in YAML',
        loadingCustomSentences: 'Loading custom sentences from HA...',
        customSentencesInfo: 'HA automatically loads YAML files from config/custom_sentences/ directory for each language (e.g., pl/, en/). The tool searches in the configured language directory.',
        configYamlNote: 'ℹ️ No need to add anything to configuration.yaml — HA automatically detects files in this directory after restart.',
        autoDetect: '📍 Auto Detection',
        pasteYaml: '📋 Paste YAML',
        newFile: 'New file...',
        orEnterFileName: 'or enter new file name...',
        pasteContent: 'Paste content...',
      },
    };
    return T[this._lang] || T.en;
  }

  static getConfigElement() {
    return document.createElement('ha-sentence-manager-editor');
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return {
      type: 'custom:ha-sentence-manager',
      title: 'Sentence Manager',
      language: 'pl',
    };
  }

  // --- localStorage persistence ---
  _storageKey() { return 'ha-sentence-manager-data'; }
  _saveData() {
    try { localStorage.setItem(this._storageKey(), JSON.stringify(this.sentences)); }
    catch (e) { console.warn('Sentence Manager: save failed', e); }
  }
  _loadData() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (raw) this.sentences = JSON.parse(raw);
    } catch (e) { console.warn('Sentence Manager: load failed', e); }
  }

  async loadIntents() {
    if (!this.hass) return [];
    try {
      const result = await this.hass.callWS({
        type: 'assist_pipeline/list_intents',
        language: this.config.language || 'pl',
      });
      return result.intents || [];
    } catch (e) {
      console.log('Could not load intents from Home Assistant');
      return [];
    }
  }

  // Load custom sentences from HA config directory
  async _loadHaSentences() {
    if (!this._hass || this._haSentencesLoading) return;
    this._haSentencesLoading = true;
    this._haSentencesError = null;
    this.render();
    try {
      // Use HA REST API to list custom_sentences directory
      const token = this._hass.auth.accessToken;
      const lang = this.config.language || 'pl';
      // Try fetching known file paths via Supervisor API or direct file read
      const files = [];
      // Approach: use HA's /api/config/custom_sentences endpoint if available,
      // otherwise try to read the file via the config directory listing
      let yamlContent = null;
      // Try direct fetch of common paths
      const paths = [
        `/api/config/custom_sentences/${lang}`,
        `/local/custom_sentences/${lang}`,
      ];
      // Most reliable: use Supervisor API to read file
      try {
        const svResp = await fetch(`/api/supervisor/fs/config/custom_sentences`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (svResp.ok) {
          const listing = await svResp.json();
          files.push(...(listing.data || listing || []));
        }
      } catch(e) { console.debug('[ha-sentence-manager] caught:', e); }
      // Try reading known baby.yaml directly
      const knownFiles = [`custom_sentences/${lang}/baby.yaml`];
      for (const fp of knownFiles) {
        try {
          const resp = await fetch(`/api/supervisor/fs/config/${fp}`, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (resp.ok) {
            yamlContent = await resp.text();
          }
        } catch(e) { console.debug('[ha-sentence-manager] caught:', e); }
      }
      // If supervisor didn't work, try hassio API
      if (!yamlContent) {
        try {
          const resp = await this._hass.callWS({
            type: 'supervisor/api',
            endpoint: `/addons/core_configurator/api/files/custom_sentences/${lang}`,
            method: 'get'
          });
          if (resp) yamlContent = typeof resp === 'string' ? resp : JSON.stringify(resp);
        } catch(e) { console.debug('[ha-sentence-manager] caught:', e); }
      }
      // Parse custom_sentences YAML manually (lightweight parser for known structure)
      if (yamlContent) {
        this._haSentences = this._parseCustomSentencesYaml(yamlContent);
      } else {
        // Fallback: try conversation/process to detect what intents exist
        this._haSentences = await this._detectIntentsViaConversation();
      }
    } catch(e) {
      this._haSentencesError = e.message;
      this._haSentences = null;
    }
    this._haSentencesLoading = false;
    this.render();
  }

  // Parse custom_sentences YAML into structured data
  _parseCustomSentencesYaml(yaml) {
    const result = { language: null, intents: {}, lists: {} };
    const lines = yaml.split('\n');
    let section = null; // 'intents' or 'lists'
    let currentIntent = null;
    let currentList = null;
    let inSentences = false;
    let inValues = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Top-level keys
      if (line.match(/^language:/)) {
        result.language = trimmed.replace('language:', '').replace(/['"]/g, '').trim();
        continue;
      }
      if (line.match(/^intents:/)) { section = 'intents'; continue; }
      if (line.match(/^lists:/)) { section = 'lists'; inSentences = false; continue; }
      if (section === 'intents') {
        // Intent name (2-space indent, no dash)
        const intentMatch = line.match(/^  (\w+):$/);
        if (intentMatch) {
          currentIntent = intentMatch[1];
          result.intents[currentIntent] = [];
          inSentences = false;
          continue;
        }
        if (trimmed === '- sentences:' || trimmed === 'sentences:') {
          inSentences = true;
          continue;
        }
        if (trimmed === 'data:') continue;
        if (inSentences && trimmed.startsWith('- "') && currentIntent) {
          const sentence = trimmed.replace(/^- /, '').replace(/^"/, '').replace(/"$/, '');
          result.intents[currentIntent].push(sentence);
        }
      }
      if (section === 'lists') {
        const listMatch = line.match(/^  (\w+):$/);
        if (listMatch) {
          currentList = listMatch[1];
          result.lists[currentList] = [];
          inValues = false;
          continue;
        }
        if (trimmed === 'values:') { inValues = true; continue; }
        if (inValues && currentList) {
          const inMatch = trimmed.match(/^- in: "(.+)"$/);
          const simpleMatch = trimmed.match(/^- "(.+)"$/);
          const outMatch = trimmed.match(/^out: "(.+)"$/);
          if (inMatch) {
            result.lists[currentList].push({ in: inMatch[1], out: null });
          } else if (simpleMatch) {
            result.lists[currentList].push({ value: simpleMatch[1] });
          } else if (outMatch && result.lists[currentList].length > 0) {
            const last = result.lists[currentList][result.lists[currentList].length - 1];
            if (last && last.out === null) last.out = outMatch[1];
          }
        }
      }
    }
    return result;
  }

  // Detect available intents by testing known sentences
  async _detectIntentsViaConversation() {
    // We know the structure from the file — parse it from local knowledge
    // Since we can't read the file via API, show guidance
    return null;
  }

  // Test sentence via HA Conversation API
  async _testSentenceHA(text) {
    if (!this._hass || !text.trim()) return;
    this._testLoading = true;
    this._testResultHA = null;
    this.render();
    try {
      const lang = this.config.language || 'pl';
      const result = await this._hass.callWS({
        type: 'conversation/process',
        text: text.trim(),
        language: lang,
        agent_id: 'conversation.home_assistant'
      });
      this._testResultHA = {
        success: true,
        input: text,
        response: result?.response?.speech?.plain?.speech || 'No response',
        responseType: result?.response?.response_type || 'unknown',
        conversationId: result?.conversation_id,
        data: result?.response?.data || null
      };
    } catch(e) {
      this._testResultHA = {
        success: false,
        input: text,
        error: e.message
      };
    }
    this._testLoading = false;
    this.render();
  }

  highlightSlots(text) {
    const safe = _esc(text);
    const slotRegex = /\{([^}]+)\}/g;
    return safe.replace(slotRegex, '<span class="slot-highlight">{$1}</span>');
  }

  testSentenceMatching(testInput) {
    const results = [];
    this.sentences.forEach((sentence, index) => {
      const pattern = sentence.trigger.replace(/\{[^}]+\}/g, '([\\w\\s-]+)');
      const regex = new RegExp(`^${pattern}$`, 'i');
      const match = testInput.match(regex);
      if (match) {
        const slotNames = (sentence.trigger.match(/\{([^}]+)\}/g) || []).map(s => s.slice(1, -1));
        const slots = {};
        slotNames.forEach((name, i) => {
          slots[name] = match[i + 1];
        });
        results.push({
          index,
          sentence: sentence.trigger,
          intent: sentence.intent,
          slots,
          response: sentence.response,
        });
      }
    });
    return results;
  }

  exportAsYaml() {
    let yaml = 'custom_sentences:\n';
    this.sentences.forEach(sentence => {
      yaml += `  - trigger: "${sentence.trigger}"\n`;
      yaml += `    intents:\n`;
      yaml += `      - intent: ${sentence.intent}\n`;
      if (Object.keys(sentence.slots).length > 0) {
        yaml += `        slots:\n`;
        Object.entries(sentence.slots).forEach(([name, type]) => {
          yaml += `          ${name}: ${type}\n`;
        });
      }
      if (sentence.response) {
        yaml += `    response: "${sentence.response}"\n`;
      }
    });
    return yaml;
  }

  importFromYaml(yamlText) {
    try {
      const lines = yamlText.split('\n');
      const imported = [];
      let currentSentence = null;

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- trigger:')) {
          if (currentSentence) imported.push(currentSentence);
          const trigger = trimmed.replace('- trigger:', '').replace(/['"]/g, '').trim();
          currentSentence = { trigger, intent: '', slots: {}, response: '' };
        } else if (trimmed.startsWith('intent:') && currentSentence) {
          currentSentence.intent = trimmed.replace('intent:', '').trim();
        } else if (trimmed.match(/^\w+:/) && currentSentence && line.includes(':') && !line.includes('trigger:') && !line.includes('intent:')) {
          const [key, value] = trimmed.split(':');
          if (key && value && !['slots', 'response', 'intents'].includes(key)) {
            currentSentence.slots[key.trim()] = value.trim();
          }
        } else if (trimmed.startsWith('response:') && currentSentence) {
          currentSentence.response = trimmed.replace('response:', '').replace(/['"]/g, '').trim();
        }
      });

      if (currentSentence && currentSentence.trigger) imported.push(currentSentence);
      this.sentences = imported;
      this._saveData();
      this.render();
      this.showNotification('Sentences imported successfully', 'success');
    } catch (error) {
      this.showNotification('Error importing YAML', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    this.shadowRoot.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  saveSentence() {
    const trigger = this.shadowRoot.querySelector('#trigger-input').value.trim();
    const intent = this.shadowRoot.querySelector('#intent-input').value.trim();
    const response = this.shadowRoot.querySelector('#response-input').value.trim();

    if (!trigger || !intent) {
      this.showNotification('Trigger and intent are required', 'error');
      return;
    }

    const slots = {};
    this.shadowRoot.querySelectorAll('.slot-input').forEach(input => {
      const name = input.dataset.slotName;
      const type = input.value || 'string';
      if (name) slots[name] = type;
    });

    const sentence = { trigger, intent, slots, response };

    if (this.editingIndex !== null) {
      this.sentences[this.editingIndex] = sentence;
      this.editingIndex = null;
    } else {
      this.sentences.push(sentence);
    }
    this._saveData();

    this.clearForm();
    this.render();
    this.showNotification('Sentence saved', 'success');
  }

  clearForm() {
    this.shadowRoot.querySelector('#trigger-input').value = '';
    this.shadowRoot.querySelector('#intent-input').value = '';
    this.shadowRoot.querySelector('#response-input').value = '';
    this.shadowRoot.querySelector('#slots-container').innerHTML = '';
    this.editingIndex = null;
  }

  editSentence(index) {
    const sentence = this.sentences[index];
    this.editingIndex = index;
    this.shadowRoot.querySelector('#trigger-input').value = sentence.trigger;
    this.shadowRoot.querySelector('#intent-input').value = sentence.intent;
    this.shadowRoot.querySelector('#response-input').value = sentence.response || '';

    const slotsContainer = this.shadowRoot.querySelector('#slots-container');
    slotsContainer.innerHTML = '';
    Object.entries(sentence.slots).forEach(([name, type]) => {
      const slotElement = document.createElement('div');
      slotElement.className = 'slot-item';
      slotElement.innerHTML = `
        <label>${_esc(name)}:</label>
        <input type="text" class="slot-input" data-slot-name="${_esc(name)}" value="${_esc(type)}">
        <button class="remove-slot-btn">Remove</button>
      `;
      slotElement.querySelector('.remove-slot-btn').addEventListener('click', () => slotElement.remove());
      slotsContainer.appendChild(slotElement);
    });

    this.currentTab = 'editor';
    this.render();
    window.scrollTo(0, 0);
  }

  deleteSentence(index) {
    if (confirm('Delete this sentence?')) {
      this.sentences.splice(index, 1);
      this._saveData();
      this.render();
      this.showNotification('Sentence deleted', 'success');
    }
  }

  addSlotToForm() {
    const slotName = prompt('Enter slot name (e.g., area, temperature):');
    if (slotName && slotName.trim()) {
      const slotsContainer = this.shadowRoot.querySelector('#slots-container');
      const slotElement = document.createElement('div');
      slotElement.className = 'slot-item';
      slotElement.innerHTML = `
        <label>${_esc(slotName)}:</label>
        <input type="text" class="slot-input" data-slot-name="${_esc(slotName)}" placeholder="e.g., string, number, area">
        <button class="remove-slot-btn">Remove</button>
      `;
      slotElement.querySelector('.remove-slot-btn').addEventListener('click', () => slotElement.remove());
      slotsContainer.appendChild(slotElement);
    }
  }

  applyTemplate(category) {
    const templates = this.templateLibrary[category] || [];
    if (templates.length === 0) return;

    const template = templates[0]  // Use first template (stable selection);
    this.shadowRoot.querySelector('#trigger-input').value = template.trigger;
    this.shadowRoot.querySelector('#intent-input').value = template.intent;

    const slotsContainer = this.shadowRoot.querySelector('#slots-container');
    slotsContainer.innerHTML = '';
    Object.entries(template.slots).forEach(([name, type]) => {
      const slotElement = document.createElement('div');
      slotElement.className = 'slot-item';
      slotElement.innerHTML = `
        <label>${_esc(name)}:</label>
        <input type="text" class="slot-input" data-slot-name="${_esc(name)}" value="${_esc(type)}">
        <button class="remove-slot-btn">Remove</button>
      `;
      slotElement.querySelector('.remove-slot-btn').addEventListener('click', () => slotElement.remove());
      slotsContainer.appendChild(slotElement);
    });
  }

  render() {
    if (!this._hass) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = this.getStyles();
    }

    // Build only the active tab content to avoid unnecessary DOM
    let activeTabContent = '';
    switch (this.currentTab) {
      case 'ha-sentences': activeTabContent = this._renderHaSentencesTab(); break;
      case 'editor': activeTabContent = this.renderEditor(); break;
      case 'list': activeTabContent = this.renderList(); break;
      case 'test': activeTabContent = this.renderTest(); break;
      case 'export': activeTabContent = this.renderExport(); break;
      case 'actions': activeTabContent = this._renderActionsTab(); break;
    }

    const tipDismissed = (() => {
      try { return localStorage.getItem('ha-tools-sentence-manager-tips-v3.0.0') === 'dismissed'; } catch(e) { return false; }
    })();

    const container = document.createElement('div');
    container.className = 'card';
    container.innerHTML = `
      <div class="card-header">
        <h1 class="card-title">${_esc(this.config.title) || 'Sentence Manager'}</h1>
      </div>

      <div class="tip-banner ${tipDismissed ? 'hidden' : ''}" id="tip-banner">
        <button class="tip-dismiss" id="tip-dismiss" aria-label="Dismiss">\u2715</button>
        <div class="tip-banner-title">💡 ${this._lang === 'pl' ? 'Jak działają komendy głosowe?' : 'How do voice commands work?'}</div>
        <ul>
          <li><strong>Editor</strong> — ${this._lang === 'pl' ? 'tworzysz zdania (sentences), które HA rozpoznaje jako komendy głosowe.' : 'you create sentences that HA recognizes as voice commands.'}</li>
          <li><strong>${this._lang === 'pl' ? 'Składnia:' : 'Syntax:'}</strong> ${this._lang === 'pl' ? 'użyj <code>[opcja1|opcja2]</code> dla alternatyw, <code>{slot_name}</code> dla zmiennych.' : 'use <code>[option1|option2]</code> for alternatives, <code>{slot_name}</code> for variables.'}</li>
          <li><strong>Intent</strong> — ${this._lang === 'pl' ? 'nazwa akcji (np. TurnOnLight). HA mapuje intent na automatyzację.' : 'the action name (e.g., TurnOnLight). HA maps the intent to automation.'}</li>
          <li><strong>${this._lang === 'pl' ? 'Test' : 'Test'}</strong> — ${this._lang === 'pl' ? 'testuj zdania w zakładce Test — wyślij tekst do Conversation API.' : 'test sentences in the Test tab — send text to Conversation API.'}</li>
          <li><strong>Import/Export</strong> — ${this._lang === 'pl' ? 'eksportuj do YAML, importuj z pliku.' : 'export to YAML, import from file.'}</li>
          <li><strong>${this._lang === 'pl' ? 'Przykład:' : 'Example:'}</strong> <code>${this._lang === 'pl' ? '[włącz|zapal] [światło|lampę]' : '[turn on|light] [light|lamp]'} w/in {room}</code></li>
        </ul>
      </div>

      <div class="tabs">
        <button class="tab-btn ${this.currentTab === 'ha-sentences' ? 'active' : ''}" data-tab="ha-sentences">\u{1F3E0} HA Sentences</button>
        <button class="tab-btn ${this.currentTab === 'editor' ? 'active' : ''}" data-tab="editor">\u270F\uFE0F Editor</button>
        <button class="tab-btn ${this.currentTab === 'list' ? 'active' : ''}" data-tab="list">\u{1F4CB} Sentences</button>
        <button class="tab-btn ${this.currentTab === 'test' ? 'active' : ''}" data-tab="test">\u{1F9EA} Test</button>
        <button class="tab-btn ${this.currentTab === 'export' ? 'active' : ''}" data-tab="export">\u{1F4E6} Import/Export</button>
        <button class="tab-btn ${this.currentTab === 'actions' ? 'active' : ''}" data-tab="actions">⚙️ Custom Actions</button>
      </div>

      <div class="tab-content active">
        ${activeTabContent}
      </div>
    `;

    const html = container.innerHTML;
    const oldContainer = this.shadowRoot.querySelector('.card');
    if (oldContainer) {
      if (this._lastHtml === html) return;
      this._lastHtml = html;
      oldContainer.innerHTML = html;
    } else {
      this._lastHtml = html;
      this.shadowRoot.appendChild(container);
    }

    this.attachEventListeners();
  }

  _renderHaSentencesTab() {
    const lang = this.config.language || 'pl';
    const isActive = this.currentTab === 'ha-sentences';

    // If we have parsed sentences (loaded from file via PowerShell deploy)
    const haData = this._haSentences;

    let contentHtml = '';
    if (this._haSentencesLoading) {
      contentHtml = `<div class="loading-spinner"><div class="spinner"></div> ${this._lang === 'pl' ? 'Wczytywanie custom sentences z HA...' : 'Loading custom sentences from HA...'}</div>`;
    } else if (haData && haData.intents && Object.keys(haData.intents).length > 0) {
      const intents = Object.entries(haData.intents);
      const totalSentences = intents.reduce((sum, [, arr]) => sum + arr.length, 0);
      const lists = haData.lists ? Object.entries(haData.lists) : [];
      // Group intents by category (guess from name prefix)
      const categorize = (name) => {
        const n = name.toLowerCase();
        if (n.includes('breastfeed') || n.includes('bottle') || n.includes('diaper') || n.includes('pump') || n.includes('baby') || n.includes('sleep')) return this._lang === 'pl' ? '👶 Dziecko' : '👶 Baby';
        if (n.includes('light') || n.includes('lamp') || n.includes('brightness')) return this._lang === 'pl' ? '💡 Oświetlenie' : '💡 Lighting';
        if (n.includes('climate') || n.includes('temp') || n.includes('thermostat') || n.includes('heat')) return this._lang === 'pl' ? '🌡️ Klimat' : '🌡️ Climate';
        if (n.includes('media') || n.includes('play') || n.includes('music') || n.includes('track')) return this._lang === 'pl' ? '🎵 Media' : '🎵 Media';
        if (n.includes('cover') || n.includes('blind') || n.includes('shutter')) return this._lang === 'pl' ? '🏠 Rolety' : '🏠 Covers';
        if (n.includes('lock') || n.includes('alarm') || n.includes('security')) return this._lang === 'pl' ? '🔒 Bezpieczeństwo' : '🔒 Security';
        if (n.includes('scene') || n.includes('routine')) return this._lang === 'pl' ? '🎭 Sceny' : '🎭 Scenes';
        return this._lang === 'pl' ? '🔧 Inne' : '🔧 Other';
      };
      const categories = {};
      for (const [name, sents] of intents) {
        const cat = categorize(name);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push([name, sents]);
      }
      const categoryEntries = Object.entries(categories);

      contentHtml = `
        <div class="ha-sentences-summary">
          <div class="stats-row">
            <div class="stat-card">
              <div class="stat-value">${intents.length}</div>
              <div class="stat-label">${this._lang === 'pl' ? 'Intentów' : 'Intents'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalSentences}</div>
              <div class="stat-label">${this._lang === 'pl' ? 'Zdań' : 'Sentences'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${lists.length}</div>
              <div class="stat-label">List</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${categoryEntries.length}</div>
              <div class="stat-label">${this._lang === 'pl' ? 'Kategorii' : 'Categories'}</div>
            </div>
          </div>
          <p style="font-size:11px;color:var(--bento-text-muted);margin-top:8px;">
            ℹ️ ${haData._detectedViaAPI ? (this._lang === 'pl' ? 'Wykryte przez Conversation API' : 'Detected via Conversation API') : (this._lang === 'pl' ? 'Język:' : 'Language:') + ` ${haData.language || lang}`}
            ${haData._sourceFile ? ` \u2022 Plik: ${haData._sourceFile}` : ''}
          </p>
        </div>
        <div class="ha-sentences-detail">
          ${categoryEntries.map(([cat, catIntents]) => `
            <div class="category-section" style="margin-bottom:20px;">
              <h3 class="category-header" style="font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--bento-border);">${cat}
                <span style="font-size:11px;color:var(--bento-text-muted);font-weight:400;margin-left:8px;">${catIntents.length} ${this._lang === 'pl' ? (catIntents.length === 1 ? 'intent' : 'intentów') : (catIntents.length === 1 ? 'intent' : 'intents')}</span>
              </h3>
              ${catIntents.map(([name, sentences]) => `
                <div class="intent-group">
                  <div class="intent-header" style="cursor:pointer;" data-toggle-intent="${_esc(name)}">
                    <span class="intent-name">${_esc(name)}</span>
                    <span class="badge badge-info">${sentences.length} ${this._lang === 'pl' ? 'zdań' : 'sentences'}</span>
                    <span class="toggle-arrow" style="margin-left:auto;font-size:12px;color:var(--bento-text-muted);">\u25BC</span>
                  </div>
                  <div class="intent-sentences" data-intent-body="${name}">
                    ${sentences.map(s => `<div class="ha-sentence-item"><code>${this._escapeHtml(s)}</code></div>`).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
          ${lists.length > 0 ? `
            <div class="category-section" style="margin-bottom:20px;">
              <h3 class="category-header" style="font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--bento-border);">📖 ${this._lang === 'pl' ? 'Listy slotów' : 'Slot Lists'}
                <span style="font-size:11px;color:var(--bento-text-muted);font-weight:400;margin-left:8px;">${lists.length} list</span>
              </h3>
              ${lists.map(([name, values]) => `
                <div class="intent-group">
                  <div class="intent-header">
                    <span class="intent-name">{${_esc(name)}}</span>
                    <span class="badge badge-info">${values.length} ${this._lang === 'pl' ? 'wartości' : 'values'}</span>
                  </div>
                  <div class="slot-values">
                    ${values.map(v => {
                      if (v.value) return `<span class="slot-badge">${_esc(v.value)}</span>`;
                      return `<span class="slot-badge">${_esc(v.in)} \u2192 ${_esc(v.out || '')}</span>`;
                    }).join(' ')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="ha-sentences-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="import-ha-btn">📥 ${this._lang === 'pl' ? 'Importuj do edytora' : 'Import to editor'}</button>
          <button class="btn btn-secondary" id="reload-ha-btn">🔄 ${this._lang === 'pl' ? 'Odśwież' : 'Refresh'}</button>
        </div>
      `;
    } else {
      // No data loaded yet or file not found — show structured info + load options
      contentHtml = `
        <div class="ha-sentences-info">
          <div class="info-card">
            <h3>📁 ${this._lang === 'pl' ? 'Custom Sentences w Home Assistant' : 'Custom Sentences in Home Assistant'}</h3>
            <p>${this._lang === 'pl' ? 'HA automatycznie wczytuje pliki YAML z katalogu <code>config/custom_sentences/</code> dla każdego języka (np. <code>pl/</code>, <code>en/</code>). Narzędzie szuka w katalogu skonfigurowanego języka (<code>' : 'HA automatically loads YAML files from <code>config/custom_sentences/</code> directory for each language (e.g., <code>pl/</code>, <code>en/</code>). The tool searches in the configured language directory (<code>'}${lang}${this._lang === 'pl' ? '</code>).' : '</code>).'}</p>
            <p style="font-size:12px;color:var(--bento-text-secondary);margin-top:4px;">
              ℹ️ ${this._lang === 'pl' ? 'Nie trzeba nic dodawać do <code>configuration.yaml</code> — HA automatycznie wykrywa pliki w tym katalogu po restarcie.' : 'No need to add anything to <code>configuration.yaml</code> — HA automatically detects files in this directory after restart.'}
            </p>
            <div class="file-path-info" style="margin-top:12px;">
              <strong>📄 ${this._lang === 'pl' ? 'Struktura katalogów:' : 'Directory structure:'}</strong><br>
              <code style="display:block;margin-top:4px;padding:8px 12px;background:var(--bento-bg);border-radius:var(--bento-radius-xs);font-size:12px;line-height:1.6;">
                config/<br>
                └─ custom_sentences/<br>
                &nbsp;&nbsp;&nbsp;└─ ${lang}/<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ baby.yaml<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ lights.yaml<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ ... ${this._lang === 'pl' ? '(dowolna nazwa)' : '(any name)'}
              </code>
            </div>
          </div>

          <div class="load-options" style="margin-top:16px;display:grid;gap:12px;">
            <div class="info-card" style="padding:16px;">
              <h4 style="margin-bottom:8px;font-size:14px;">🔍 ${this._lang === 'pl' ? 'Automatyczne wykrywanie' : 'Auto Detection'}</h4>
              <p class="hint" style="font-size:12px;color:var(--bento-text-muted);margin-bottom:8px;">${this._lang === 'pl' ? 'Testuje znane frazy przez Conversation API, aby wykryć działające intenty.' : 'Tests known phrases via Conversation API to detect working intents.'}</p>
              <button class="btn btn-primary" id="detect-ha-btn">🔍 ${this._lang === 'pl' ? 'Wykryj automatycznie' : 'Auto Detect'}</button>
              <span id="detect-status" style="margin-left:8px;font-size:12px;color:var(--bento-text-muted);"></span>
            </div>

            <div class="info-card" style="padding:16px;">
              <h4 style="margin-bottom:8px;font-size:14px;">📋 ${this._lang === 'pl' ? 'Wklej YAML' : 'Paste YAML'}</h4>
              <p class="hint" style="font-size:12px;color:var(--bento-text-muted);margin-bottom:8px;">${this._lang === 'pl' ? 'Skopiuj zawartość pliku YAML z katalogu custom_sentences i wklej poniżej.' : 'Copy YAML file content from custom_sentences directory and paste below.'}</p>
              <div style="display:flex;gap:8px;align-items:flex-start;">
                <select id="ha-file-select" style="min-width:180px;padding:8px;">
                  <option value="">${this._lang === 'pl' ? 'Nowy plik...' : 'New file...'}</option>
                  <option value="baby.yaml">baby.yaml</option>
                  <option value="lights.yaml">lights.yaml</option>
                  <option value="climate.yaml">climate.yaml</option>
                  <option value="media.yaml">media.yaml</option>
                  <option value="custom.yaml">custom.yaml</option>
                </select>
                <input type="text" id="ha-new-file-name" placeholder="${this._lang === 'pl' ? 'lub wpisz nazwę nowego pliku...' : 'or enter new file name...'}" style="flex:1;">
              </div>
              <textarea id="ha-yaml-paste" class="yaml-editor" style="margin-top:8px;" placeholder="${this._lang === 'pl' ? 'Wklej zawartość pliku custom_sentences/' : 'Paste content of custom_sentences/'}${lang}${this._lang === 'pl' ? '/*.yaml tutaj...' : '/*.yaml here...'}"></textarea>
              <button class="btn btn-primary" id="parse-ha-yaml-btn" style="margin-top:8px;">🔍 ${this._lang === 'pl' ? 'Parsuj YAML' : 'Parse YAML'}</button>
            </div>

          </div>
        
        <!-- Support / Donation -->
        <div class="donate-section" data-source="ha-tools-split">
          <div class="donate-text">
            <h3>❤️ ${this._lang === 'pl' ? 'Wesprzyj rozwój HA Tools' : 'Support HA Tools Development'}</h3>
            <p>${this._lang === 'pl' ? 'Jeśli to narzędzie ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!' : 'If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!'}</p>
          </div>
          <div class="donate-buttons">
            <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
            <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>
          </div>
        </div>
        </div>
      `;
    }

    return `
      <div class="tab-panel ${isActive ? 'active' : ''}" data-tab-content="ha-sentences">
        <div class="ha-sentences-section">
          <h2>🏠 HA Custom Sentences</h2>
          <p class="section-desc">${this._lang === 'pl' ? 'Niestandardowe komendy głosowe skonfigurowane w Home Assistant.' : 'Custom voice commands configured in Home Assistant.'}</p>
          ${contentHtml}
          <div style="margin-top:20px;padding:16px;background:var(--bento-bg,#f8fafc);border:1px solid var(--bento-border,#e2e8f0);border-radius:10px">
            <h3 style="margin:0 0 8px;font-size:14px">${this._lang === 'pl' ? 'Sterowanie głosowe' : 'Voice Control'}</h3>
            <p style="margin:0 0 8px;font-size:12px;color:var(--bento-text-secondary,#64748B)">${this._lang === 'pl' ? 'Po dodaniu custom sentences HA automatycznie rozpoznaje je w Assist.' : 'After adding custom sentences, HA automatically recognizes them in Assist.'}</p>
            <details>
              <summary style="cursor:pointer;font-weight:600;font-size:12px;color:var(--bento-primary,#3B82F6)">${this._lang === 'pl' ? 'Przykłady komend + konfiguracja' : 'Example commands + configuration'}</summary>
              <div style="margin-top:8px;font-size:12px;line-height:1.8;color:var(--bento-text-secondary,#64748B)">
                <div><code>${this._lang === 'pl' ? 'Włącz światło w salonie' : 'Turn on the light in the living room'}</code> — HassLightSet</div>
                <div><code>${this._lang === 'pl' ? 'Jaka jest temperatura?' : 'What is the temperature?'}</code> — HassGetState</div>
                <div><code>${this._lang === 'pl' ? 'Zamknij rolety' : 'Close the blinds'}</code> — custom sentence</div>
                <div style="margin-top:8px"><strong>${this._lang === 'pl' ? 'Konfiguracja:' : 'Configuration:'}</strong> Settings > Voice assistants > Assist > Language: ${this._lang === 'pl' ? 'Polski' : 'English'}</div>
                <div><strong>${this._lang === 'pl' ? 'Test:' : 'Test:'}</strong> ${this._lang === 'pl' ? 'Ikona mikrofonu w HA lub Dev Tools > Assist' : 'Microphone icon in HA or Dev Tools > Assist'}</div>
              </div>
            </details>
          </div>
        </div>
      </div>
    `;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Import HA sentences into the editor's local storage
  _importHaSentencesToEditor() {
    if (!this._haSentences || !this._haSentences.intents) return;
    const imported = [];
    for (const [intentName, sentences] of Object.entries(this._haSentences.intents)) {
      for (const sentence of sentences) {
        // Check if already exists
        const exists = this.sentences.some(s => s.trigger === sentence && s.intent === intentName);
        if (!exists) {
          const slotNames = (sentence.match(/\{([^}]+)\}/g) || []).map(s => s.slice(1, -1));
          const slots = {};
          slotNames.forEach(name => { slots[name] = 'string'; });
          imported.push({ trigger: sentence, intent: intentName, slots, response: '' });
        }
      }
    }
    if (imported.length > 0) {
      this.sentences.push(...imported);
      this._saveData();
      this.showNotification(this._lang === 'pl' ? `Zaimportowano ${imported.length} zdań z HA` : `Imported ${imported.length} sentences from HA`, 'success');
    } else {
      this.showNotification(this._lang === 'pl' ? 'Wszystkie zdania już istnieją w edytorze' : 'All sentences already exist in editor', 'info');
    }
    this.render();
  }

  // Auto-detect intents by testing known phrases
  async _autoDetectIntents() {
    if (!this._hass) return;
    this._haSentencesLoading = true;
    this.render();
    const lang = this.config.language || 'pl';
    const testPhrases = lang === 'pl' ? [
      { text: 'zaczynam karmiać lewą piersią', expectedIntent: 'BreastfeedingStart' },
      { text: 'skończyłam karmiać', expectedIntent: 'BreastfeedingEnd' },
      { text: 'ile czasu już karmię', expectedIntent: 'BreastfeedingElapsed' },
      { text: 'kiedy ostatnie karmienie', expectedIntent: 'BreastfeedingLast' },
      { text: 'zaczynam karmiać butelką', expectedIntent: 'BottleFeedingStart' },
      { text: 'skończyłam karmiać butelką', expectedIntent: 'BottleFeedingEnd' },
      { text: 'zmieniłem pieluchę', expectedIntent: 'DiaperAdd' },
      { text: 'ile dziś pieluch', expectedIntent: 'DiaperTodayCount' },
      { text: 'zaczynam odciąganie mleka', expectedIntent: 'PumpStart' },
      { text: 'skończyłam odciąganie', expectedIntent: 'PumpEnd' },
    ] : [
      { text: 'start breastfeeding left breast', expectedIntent: 'BreastfeedingStart' },
      { text: 'finished breastfeeding', expectedIntent: 'BreastfeedingEnd' },
      { text: 'how long breastfeeding', expectedIntent: 'BreastfeedingElapsed' },
      { text: 'when last feeding', expectedIntent: 'BreastfeedingLast' },
      { text: 'start bottle feeding', expectedIntent: 'BottleFeedingStart' },
      { text: 'finished bottle feeding', expectedIntent: 'BottleFeedingEnd' },
      { text: 'changed diaper', expectedIntent: 'DiaperAdd' },
      { text: 'diaper count today', expectedIntent: 'DiaperTodayCount' },
      { text: 'start pumping', expectedIntent: 'PumpStart' },
      { text: 'finished pumping', expectedIntent: 'PumpEnd' },
    ];
    const detected = {};
    for (const phrase of testPhrases) {
      try {
        const result = await this._hass.callWS({
          type: 'conversation/process',
          text: phrase.text,
          language: lang,
          agent_id: 'conversation.home_assistant'
        });
        const respType = result?.response?.response_type;
        const speech = result?.response?.speech?.plain?.speech || '';
        if (respType === 'action_done' || respType === 'query_answer') {
          if (!detected[phrase.expectedIntent]) detected[phrase.expectedIntent] = [];
          detected[phrase.expectedIntent].push({ sentence: phrase.text, response: speech });
        }
      } catch(e) { /* skip */ }
    }
    if (Object.keys(detected).length > 0) {
      this._haSentences = {
        language: lang,
        intents: {},
        lists: {},
        _detectedViaAPI: true
      };
      for (const [intent, items] of Object.entries(detected)) {
        this._haSentences.intents[intent] = items.map(i => i.sentence);
      }
      this.showNotification(this._lang === 'pl' ? `Wykryto ${Object.keys(detected).length} działających intentów!` : `Detected ${Object.keys(detected).length} working intents!`, 'success');
    } else {
      this._haSentencesError = this._lang === 'pl' ? 'Nie wykryto żadnych custom intentów.' : 'No custom intents detected.';
    }
    this._haSentencesLoading = false;
    this.render();
  }

  renderEditor() {
    return `
      <div class="tab-panel ${this.currentTab === 'editor' ? 'active' : ''}" data-tab-content="editor">
        <div class="editor-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <h2 style="margin:0;">${this.editingIndex !== null ? '\u270F\uFE0F Edytuj zdanie' : '\u2795 Nowe zdanie'}</h2>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0;">
              <select id="sentence-selector" style="min-width:220px;padding:8px 12px;font-size:13px;border-radius:var(--bento-radius-sm);border:1.5px solid var(--bento-border);background:var(--bento-card);color:var(--bento-text);">
                <option value="">Wybierz zdanie do edycji...</option>
                ${this.sentences.map((s, i) => `<option value="${i}">${_esc(s.trigger.substring(0, 50))}${s.trigger.length > 50 ? '...' : ''} [${_esc(s.intent)}]</option>`).join('')}
              </select>
              <button class="btn btn-secondary" id="new-sentence-btn" style="white-space:nowrap;">+ Nowe</button>
            </div>
          </div>

          <div class="form-group">
            <label for="trigger-input">Trigger Sentence (use {slot} for placeholders)</label>
            <input type="text" id="trigger-input" placeholder="e.g., Turn on {area} lights" class="trigger-input">
            <div class="preview-slots"></div>
          </div>

          <div class="form-group">
            <label for="intent-input">Intent Name</label>
            <input type="text" id="intent-input" placeholder="e.g., turn_on" class="intent-input">
          </div>

          <div class="form-group">
            <label>Slots Definition</label>
            <div id="slots-container" class="slots-container"></div>
            <button class="btn btn-secondary" id="add-slot-btn">+ Add Slot</button>
          </div>

          <div class="form-group">
            <label for="response-input">Response Template (optional)</label>
            <input type="text" id="response-input" placeholder="e.g., {area} lights are now on" class="response-input">
          </div>

          <div class="template-library">
            <p>Quick Templates:</p>
            <button class="btn btn-template" data-template="lights">Lights</button>
            <button class="btn btn-template" data-template="climate">Climate</button>
            <button class="btn btn-template" data-template="media">Media</button>
            <button class="btn btn-template" data-template="covers">Covers</button>
            <button class="btn btn-template" data-template="locks">Locks</button>
            <button class="btn btn-template" data-template="scenes">Scenes</button>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" id="save-btn">Save Sentence</button>
            <button class="btn btn-secondary" id="clear-btn">Clear</button>
          </div>
        </div>
      </div>
    `;
  }

  renderList() {
    const grouped = this.groupBySentenceIntent();
    return `
      <div class="tab-panel ${this.currentTab === 'list' ? 'active' : ''}" data-tab-content="list">
        <div class="list-section">
          <h2>Custom Sentences</h2>
          <input type="text" id="search-input" placeholder="Search sentences..." class="search-input">
          <div class="sentences-list">
            ${this.sentences.length === 0 ? '<p class="empty-state">No sentences yet. Create one in the editor!</p>' : ''}
            ${grouped.map(group => `
              <div class="sentence-group">
                <h3 class="group-header">${_esc(group.intent)}</h3>
                ${group.sentences.map((s, idx) => `
                  <div class="sentence-item">
                    <div class="sentence-content">
                      <div class="sentence-trigger">${this.highlightSlots(s.trigger)}</div>
                      ${s.response ? `<div class="sentence-response">Response: ${_esc(s.response)}</div>` : ''}
                    </div>
                    <div class="sentence-actions">
                      <button class="btn btn-small" data-edit="${this.sentences.indexOf(s)}">Edit</button>
                      <button class="btn btn-small btn-danger" data-delete="${this.sentences.indexOf(s)}">Delete</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderTest() {
    const haResult = this._testResultHA;
    let haResultHtml = '';
    if (this._testLoading) {
      haResultHtml = '<div class="loading-spinner"><div class="spinner"></div> Testowanie przez HA Conversation API...</div>';
    } else if (haResult) {
      if (haResult.success) {
        const isMatch = haResult.responseType === 'action_done' || haResult.responseType === 'query_answer';
        haResultHtml = `
          <div class="ha-test-result ${isMatch ? 'test-match' : 'test-no-match'}">
            <div class="result-header">
              <span class="badge ${isMatch ? 'badge-success' : 'badge-warning'}">${isMatch ? '\u2705 Rozpoznano' : '\u26A0\uFE0F Brak dopasowania'}</span>
              <span class="result-type">${haResult.responseType}</span>
            </div>
            <div class="result-input"><strong>${this._lang === 'pl' ? 'Wejście:' : 'Input:'}</strong> ${this._escapeHtml(haResult.input)}</div>
            <div class="result-response"><strong>${this._lang === 'pl' ? 'Odpowiedź HA:' : 'HA Response:'}</strong> ${this._escapeHtml(haResult.response)}</div>
          </div>
        `;
      } else {
        haResultHtml = `<div class="ha-test-result test-error"><strong>${this._lang === 'pl' ? 'Błąd:' : 'Error:'}</strong> ${this._escapeHtml(haResult.error)}</div>`;
      }
    }
    return `
      <div class="tab-panel ${this.currentTab === 'test' ? 'active' : ''}" data-tab-content="test">
        <div class="test-section">
          <h2>🧪 ${this._lang === 'pl' ? 'Test Sentence' : 'Test Sentence'}</h2>
          <p class="section-desc">${this._lang === 'pl' ? 'Testuj zdania bezpośrednio przez Home Assistant Conversation API.' : 'Test sentences directly via Home Assistant Conversation API.'}</p>
          <div class="test-input-row">
            <input type="text" id="test-input" placeholder="${this._lang === 'pl' ? 'Wpisz komendę głosową, np. zaczynam karmiać lewą piersią...' : 'Enter voice command, e.g. start breastfeeding left breast...'}" class="test-input" style="flex:1;">
            <button class="btn btn-primary" id="test-ha-btn">🏠 ${this._lang === 'pl' ? 'Test HA' : 'Test HA'}</button>
            <button class="btn btn-secondary" id="test-btn">🔍 ${this._lang === 'pl' ? 'Test lokalny' : 'Test local'}</button>
          </div>
          <div class="quick-test-phrases" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">
            <span style="font-size:12px; color:var(--bento-text-muted); margin-right:4px;">${this._lang === 'pl' ? 'Szybki test:' : 'Quick test:'}</span>
            <button class="btn btn-small quick-test-btn" data-phrase="zaczynam karmiać lewą piersią">${this._lang === 'pl' ? 'karmiać piersią' : 'left breast'}</button>
            <button class="btn btn-small quick-test-btn" data-phrase="zmieniono pieluchę mokra">${this._lang === 'pl' ? 'pielucha' : 'diaper'}</button>
            <button class="btn btn-small quick-test-btn" data-phrase="zaczynam karmiać butelką">${this._lang === 'pl' ? 'butelka' : 'bottle'}</button>
            <button class="btn btn-small quick-test-btn" data-phrase="zaczynam odciąganie mleka">${this._lang === 'pl' ? 'odciąganie' : 'pumping'}</button>
            <button class="btn btn-small quick-test-btn" data-phrase="ile dziś pieluch">${this._lang === 'pl' ? 'ile pieluch' : 'diaper count'}</button>
          </div>
          ${haResultHtml}
          <div id="test-results" class="test-results" style="margin-top:12px;"></div>
        </div>
      </div>
    `;
  }

  renderExport() {
    return `
      <div class="tab-panel ${this.currentTab === 'export' ? 'active' : ''}" data-tab-content="export">
        <div class="export-section">
          <h2>Import / Export</h2>

          <div class="export-container">
            <h3>Export as YAML</h3>
            <textarea id="yaml-output" class="yaml-editor" readonly>${this.exportAsYaml()}</textarea>
            <button class="btn btn-primary" id="copy-yaml-btn">Copy to Clipboard</button>
          </div>

          <div class="import-container">
            <h3>Import from YAML</h3>
            <textarea id="yaml-input" class="yaml-editor" placeholder="Paste YAML here..."></textarea>
            <button class="btn btn-primary" id="import-yaml-btn">Import Sentences</button>
          </div>
        </div>
      </div>
    `;
  }

  groupBySentenceIntent() {
    const groups = {};
    this.sentences.forEach(sentence => {
      if (!groups[sentence.intent]) {
        groups[sentence.intent] = [];
      }
      groups[sentence.intent].push(sentence);
    });

    return Object.entries(groups).map(([intent, sentences]) => ({
      intent,
      sentences,
    }));
  }

  attachEventListeners() {
    // Tip banner dismiss
    const _tipB = this.shadowRoot.querySelector('#tip-banner');
    if (_tipB) {
      const _tipV = 'ha-tools-sentence-manager-tips-v3.0.0';
      if (localStorage.getItem(_tipV) === 'dismissed') {
        _tipB.classList.add('hidden');
      }
      const _tipDismiss = this.shadowRoot.querySelector('#tip-dismiss');
      if (_tipDismiss) {
        _tipDismiss.addEventListener('click', (e) => {
          e.stopPropagation();
          _tipB.classList.add('hidden');
          localStorage.setItem(_tipV, 'dismissed');
        });
      }
    }
    // Tab switching
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.currentTab = e.target.dataset.tab;
        history.replaceState(null, '', location.pathname + '#' + this._toolId + '/' + this.currentTab);
        // Update tab buttons active state without full re-render
        this.shadowRoot.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === this.currentTab));
        // Update only tab content
        let tabHtml = '';
        switch (this.currentTab) {
          case 'ha-sentences': tabHtml = this._renderHaSentencesTab(); break;
          case 'editor': tabHtml = this.renderEditor(); break;
          case 'list': tabHtml = this.renderList(); break;
          case 'test': tabHtml = this.renderTest(); break;
          case 'export': tabHtml = this.renderExport(); break;
          case 'actions': tabHtml = this._renderActionsTab(); break;
        }
        const tc = this.shadowRoot.querySelector('.tab-content');
        if (tc) { tc.innerHTML = tabHtml; this._lastHtml = null; }
        this.attachEventListeners();
        // Auto-detect intents on first visit to HA Sentences tab
        if (this.currentTab === 'ha-sentences' && !this._autoDetectRan && !this._haSentences && !this._haSentencesLoading && this._hass) {
          this._autoDetectRan = true;
          this._autoDetectIntents();
        }
      });
    });

    // Editor - sentence selector
    this.shadowRoot.querySelector('#sentence-selector')?.addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx !== '') this.editSentence(parseInt(idx));
    });
    this.shadowRoot.querySelector('#new-sentence-btn')?.addEventListener('click', () => {
      this.editingIndex = null;
      this.clearForm();
      this.render();
    });
    // Editor
    this.shadowRoot.querySelector('#add-slot-btn')?.addEventListener('click', () => this.addSlotToForm());
    this.shadowRoot.querySelector('#save-btn')?.addEventListener('click', () => this.saveSentence());
    this.shadowRoot.querySelector('#clear-btn')?.addEventListener('click', () => this.clearForm());

    // Template buttons
    this.shadowRoot.querySelectorAll('.btn-template').forEach(btn => {
      btn.addEventListener('click', e => {
        this.applyTemplate(e.target.dataset.template);
      });
    });

    // List actions
    this.shadowRoot.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => this.editSentence(parseInt(e.target.dataset.edit)));
    });
    this.shadowRoot.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', e => this.deleteSentence(parseInt(e.target.dataset.delete)));
    });

    // Test - HA Conversation API
    this.shadowRoot.querySelector('#test-ha-btn')?.addEventListener('click', () => {
      const input = this.shadowRoot.querySelector('#test-input')?.value;
      if (input && input.trim()) this._testSentenceHA(input);
    });
    // Test - Local matching
    this.shadowRoot.querySelector('#test-btn')?.addEventListener('click', () => {
      const input = this.shadowRoot.querySelector('#test-input').value;
      const results = this.testSentenceMatching(input);
      this.displayTestResults(results, input);
    });
    // Quick test phrases
    this.shadowRoot.querySelectorAll('.quick-test-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phrase = e.target.dataset.phrase;
        const input = this.shadowRoot.querySelector('#test-input');
        if (input) input.value = phrase;
        this._testSentenceHA(phrase);
      });
    });
    // HA Sentences tab buttons
    this.shadowRoot.querySelector('#import-ha-btn')?.addEventListener('click', () => this._importHaSentencesToEditor());
    this.shadowRoot.querySelector('#reload-ha-btn')?.addEventListener('click', () => this._loadHaSentences());
    this.shadowRoot.querySelector('#detect-ha-btn')?.addEventListener('click', () => this._autoDetectIntents());
    this.shadowRoot.querySelector('#parse-ha-yaml-btn')?.addEventListener('click', () => {
      const yaml = this.shadowRoot.querySelector('#ha-yaml-paste')?.value;
      const fileSelect = this.shadowRoot.querySelector('#ha-file-select')?.value;
      const newFileName = this.shadowRoot.querySelector('#ha-new-file-name')?.value?.trim();
      const sourceFile = newFileName || fileSelect || '';
      if (yaml && yaml.trim()) {
        this._haSentences = this._parseCustomSentencesYaml(yaml);
        if (this._haSentences) {
          this._haSentences._sourceFile = sourceFile;
        }
        if (this._haSentences && Object.keys(this._haSentences.intents).length > 0) {
          this.showNotification(this._lang === 'pl' ? 'YAML sparsowany pomyślnie!' : 'YAML parsed successfully!', 'success');
        } else {
          this.showNotification(this._lang === 'pl' ? 'Nie znaleziono intentów w YAML' : 'No intents found in YAML', 'error');
        }
        this.render();
      }
    });
    // Collapsible intent sections
    this.shadowRoot.querySelectorAll('[data-toggle-intent]').forEach(header => {
      header.addEventListener('click', () => {
        const intentName = header.dataset.toggleIntent;
        const body = this.shadowRoot.querySelector(`[data-intent-body="${intentName}"]`);
        const arrow = header.querySelector('.toggle-arrow');
        if (body) {
          const isHidden = body.style.display === 'none';
          body.style.display = isHidden ? '' : 'none';
          if (arrow) arrow.textContent = isHidden ? '\u25BC' : '\u25B6';
        }
      });
    });
    // File select / new file name toggle
    const fileSelect = this.shadowRoot.querySelector('#ha-file-select');
    const newFileInput = this.shadowRoot.querySelector('#ha-new-file-name');
    if (fileSelect && newFileInput) {
      fileSelect.addEventListener('change', () => {
        if (fileSelect.value) newFileInput.value = '';
      });
      newFileInput.addEventListener('input', () => {
        if (newFileInput.value) fileSelect.value = '';
      });
    }

    // Export/Import
    this.shadowRoot.querySelector('#copy-yaml-btn')?.addEventListener('click', () => {
      const textarea = this.shadowRoot.querySelector('#yaml-output');
      textarea.select();
      document.execCommand('copy');
      this.showNotification('YAML copied to clipboard', 'success');
    });

    this.shadowRoot.querySelector('#import-yaml-btn')?.addEventListener('click', () => {
      const yaml = this.shadowRoot.querySelector('#yaml-input').value;
      if (yaml.trim()) {
        this.importFromYaml(yaml);
      } else {
        this.showNotification('Paste YAML first', 'error');
      }
    });
  }

  displayTestResults(results, input) {
    const container = this.shadowRoot.querySelector('#test-results');
    if (results.length === 0) {
      const div = document.createElement('div');
      div.className = 'test-no-match';
      div.textContent = `No matches found for: "${input}"`;
      container.innerHTML = '';
      container.appendChild(div);
      return;
    }

    container.innerHTML = `
      <div class="test-match-results">
        <h3>${results.length} match(es) found:</h3>
        ${results.map(r => `
          <div class="test-match-item">
            <div class="match-intent">${_esc(r.intent)}</div>
            <div class="match-trigger">Pattern: ${this.highlightSlots(_esc(r.sentence))}</div>
            ${Object.keys(r.slots).length > 0 ? `
              <div class="match-slots">
                Extracted: ${Object.entries(r.slots).map(([k, v]) => `<span class="slot-badge">${_esc(k)}=${_esc(v)}</span>`).join(' ')}
              </div>
            ` : ''}
            ${r.response ? `<div class="match-response">Response: ${_esc(r.response)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  getStyles() {
    return `
      <style>${window.HAToolsBentoCSS || ""}
/* === Support / Donation Section (HA Tools split) === */
.donate-section { margin: 20px 0 4px; padding: 18px 20px;  background: var(--donate-bg, linear-gradient(135deg, #fff5f5 0%, #fff0f6 50%, #f8f0ff 100%));  border: 1px solid var(--donate-border, #f3d3e0); border-radius: var(--bento-radius-md, 16px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.donate-section h3 { margin: 0 0 6px; font-size: 15px; color: var(--donate-heading, #be185d); }
.donate-section p  { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--donate-text, #6b21a8); }
.donate-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.donate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;  font-weight: 600; font-size: 12.5px; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
.donate-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.donate-btn.coffee { background: #FFDD00; color: #000; border: 1px solid #e6c700; }
.donate-btn.paypal { background: #0070ba; color: #fff; border: 1px solid #005ea6; }
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, #2a1525 0%, #1e1530 50%, #251530 100%); border-color: #4a3555; }  .donate-section h3 { color: #f0c0d8; }  .donate-section p  { color: #d4a0b8; }  .donate-btn.coffee { background: #b8a100; color: #fff; border-color: #8a7a00; }  .donate-btn.paypal { background: #005a96; color: #e0f0ff; border-color: #004a7a; } }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 16px; }  .donate-buttons { justify-content: center; } }


/* ===== BENTO LIGHT MODE DESIGN SYSTEM ===== */

:host {
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Card */
.card, .ha-card, ha-card, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
  background: var(--bento-card) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-md) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text) !important;
  overflow: hidden;
  position: relative;
  padding: 20px;
}

/* Headers */
.card-header, .header, .card-title, h1, h2, h3 {
  color: var(--bento-text) !important;
  font-family: 'Inter', sans-serif !important;
}
.card-header, .header {
  border-bottom: 1px solid var(--bento-border) !important;
  padding-bottom: 12px !important;
  margin-bottom: 16px !important;
}

/* Tabs */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 2px solid var(--bento-border);
  padding: 0 4px;
  margin-bottom: 20px;
}
.tab, .tab-btn, .tab-btn {
  padding: 10px 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: var(--bento-text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: var(--bento-transition);
  white-space: nowrap;
  border-radius: 0;
}
.tab:hover, .tab-btn:hover, .tab-btn:hover {
  color: var(--bento-primary);
  background: var(--bento-primary-light);
}
.tab.active, .tab-btn.active, .tab-btn.active {
  color: var(--bento-primary);
  border-bottom-color: var(--bento-primary);
  background: rgba(59, 130, 246, 0.04);
  font-weight: 600;
}

/* Tab content */
.tab-content { display: none; }
.tab-content.active { display: block; animation: bentoFadeIn 0.3s ease-out; }
@keyframes bentoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* Buttons */
button, .btn, .action-btn {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--bento-radius-xs);
  transition: var(--bento-transition);
  cursor: pointer;
}
button.active, .btn.active, .btn-primary, .action-btn.active {
  background: var(--bento-primary) !important;
  color: white !important;
  border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

/* Status badges */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-success, .status-ok, .status-good { background: var(--bento-success-light); color: var(--bento-success); }
.badge-error, .status-error, .status-critical { background: var(--bento-error-light); color: var(--bento-error); }
.badge-warning, .status-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info, .status-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* Tables */
table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Inter', sans-serif; }
th { background: var(--bento-bg); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid var(--bento-border); }
td { padding: 12px 14px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: none; }

/* Inputs & selects */
input, select, textarea {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Stat cards */
.stat-card, .stat, .metric-card, .stat-box, .overview-stat, .kpi-card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 16px;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat:hover, .metric-card:hover { box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-value, .metric-value, .stat-number { font-size: 28px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.stat-label, .metric-label, .stat-title { font-size: 12px; font-weight: 500; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

/* Canvas override (prevent Bento CSS from distorting charts) */
canvas {
  max-width: 100% !important;
  height: auto !important;
  width: auto !important;
  border: none !important;
}

/* Pagination */
.pagination, .pag {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 16px 0;
  border-top: 1px solid var(--bento-border);
}
.pagination-btn, .pag-btn {
  padding: 8px 14px;
  border: 1.5px solid var(--bento-border);
  background: var(--bento-card);
  color: var(--bento-text);
  border-radius: var(--bento-radius-xs);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
}
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-select { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); font-size: 12px; font-family: 'Inter', sans-serif; }

/* Empty state */
.empty-state, .no-data, .no-results {
  text-align: center;
  padding: 48px 24px;
  color: var(--bento-text-secondary);
  font-size: 14px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ===== HA Sentences Tab ===== */
.ha-sentences-section { padding: 16px; }
.section-desc { font-size: 13px; color: var(--bento-text-secondary); margin-bottom: 16px; }
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin-bottom: 20px; }
.ha-sentences-detail { margin-top: 16px; }
.intent-group { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 12px; margin-bottom: 10px; }
.intent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.intent-name { font-weight: 600; font-size: 14px; color: var(--bento-primary); }
.intent-sentences { display: flex; flex-direction: column; gap: 4px; }
.ha-sentence-item { padding: 4px 8px; background: var(--bento-card); border-radius: var(--bento-radius-xs); border: 1px solid var(--bento-border); }
.ha-sentence-item code { font-size: 12px; color: var(--bento-text); word-break: break-all; }
.slot-values { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.slot-badge { padding: 3px 8px; background: var(--bento-primary-light); color: var(--bento-primary); border-radius: 12px; font-size: 11px; font-weight: 500; }
.info-card { background: var(--bento-primary-light); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: var(--bento-radius-sm); padding: 16px; }
.info-card h3 { margin-top: 0; }
.file-path-info { margin-top: 8px; padding: 8px; background: var(--bento-card); border-radius: var(--bento-radius-xs); font-size: 13px; }
.hint { font-size: 12px; color: var(--bento-text-muted); }
.test-input-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.test-input-row input { flex: 1; min-width: 0; box-sizing: border-box; }
.ha-test-result { padding: 12px; border-radius: var(--bento-radius-sm); margin-top: 12px; }
.ha-test-result.test-match { background: var(--bento-success-light); border: 1px solid rgba(16, 185, 129, 0.3); }
.ha-test-result.test-no-match { background: var(--bento-warning-light); border: 1px solid rgba(245, 158, 11, 0.3); }
.ha-test-result.test-error { background: var(--bento-error-light); border: 1px solid rgba(239, 68, 68, 0.3); }
.result-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.result-type { font-size: 12px; color: var(--bento-text-muted); }
.result-input, .result-response { font-size: 13px; margin: 4px 0; }
.loading-spinner { display: flex; align-items: center; gap: 8px; padding: 20px; color: var(--bento-text-secondary); }
.spinner { width: 20px; height: 20px; border: 2px solid var(--bento-border); border-top-color: var(--bento-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.quick-test-btn { padding: 3px 8px !important; font-size: 11px !important; background: var(--bento-bg) !important; border: 1px solid var(--bento-border) !important; color: var(--bento-text-secondary) !important; }
.quick-test-btn:hover { background: var(--bento-primary-light) !important; color: var(--bento-primary) !important; }

/* ===== END BENTO LIGHT MODE ===== */

        :host {
          --primary-color: var(--bento-primary);
          --error-color: var(--bento-error);
          --success-color: var(--bento-success);
          --background-color: var(--bento-card);
          --text-color: var(--bento-text);
          --secondary-text: var(--bento-text-secondary);
          --border-color: var(--bento-border);
        }

        .card {
          background: var(--background-color);
          color: var(--text-color);
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
          position: relative;
        }

        .card-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .card-title {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          background: var(--ha-card-background);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tab-btn {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: none;
          color: var(--secondary-text);
          cursor: pointer;
          font-size: 14px;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .tab-btn:hover {
          color: var(--text-color);
        }

        .tab-btn.active {
          color: var(--primary-color);
          border-bottom-color: var(--primary-color);
        }

        .tab-content {
          position: relative;
          min-height: 400px;
        }

        .tab-panel {
          display: none;
          padding: 20px;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
          max-width: 100%;
        }

        .tab-panel.active {
          display: block;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .form-group {
          margin-bottom: 16px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--text-color);
          font-size: 14px;
        }

        input[type="text"],
        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--background-color);
          color: var(--text-color);
          font-family: monospace;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }

        input[type="text"]:focus,
        textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(3,169,244,0.1);
        }

        .slot-highlight {
          background: rgba(3,169,244,0.15);
          color: var(--primary-color);
          padding: 2px 4px;
          border-radius: 2px;
          font-weight: 600;
          font-family: monospace;
        }

        .slots-container {
          margin: 12px 0;
          padding: 12px;
          background: rgba(0,0,0,0.02);
          border-radius: 4px;
          border-left: 3px solid var(--primary-color);
        }

        .slot-item {
          display: grid;
          grid-template-columns: 120px 1fr 80px;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        .slot-item > * {
          min-width: 0;
        }

        .slot-item input {
          padding: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .remove-slot-btn {
          padding: 6px 12px;
          background: rgba(244,67,54,0.1);
          color: var(--error-color);
          border: 1px solid var(--error-color);
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .remove-slot-btn:hover {
          background: rgba(244,67,54,0.2);
        }

        .template-library {
          margin: 20px 0;
          padding: 12px;
          background: rgba(3,169,244,0.05);
          border-radius: 4px;
        }

        .template-library p {
          margin: 0 0 10px 0;
          font-weight: 500;
          color: var(--text-color);
        }

        .btn {
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: rgba(0,0,0,0.02);
          color: var(--text-color);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn:hover {
          background: rgba(0,0,0,0.06);
        }

        .btn-primary {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
          margin-right: 8px;
        }

        .btn-primary:hover {
          background: var(--primary-color);
          opacity: 0.9;
        }

        .btn-secondary {
          background: rgba(0,0,0,0.03);
          color: var(--text-color);
          margin-right: 8px;
        }

        .btn-template {
          margin-right: 6px;
          margin-bottom: 6px;
          padding: 6px 12px;
          font-size: 12px;
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }

        .btn-template:hover {
          opacity: 0.9;
        }

        .btn-small {
          padding: 4px 12px;
          font-size: 12px;
          margin-right: 4px;
        }

        .btn-danger {
          color: var(--error-color);
          border-color: var(--error-color);
        }

        .btn-danger:hover {
          background: rgba(244,67,54,0.1);
        }

        .form-actions {
          margin-top: 20px;
          display: flex;
          gap: 8px;
        }

        .sentences-list {
          margin-top: 16px;
        }

        .empty-state {
          text-align: center;
          color: var(--secondary-text);
          padding: 40px 20px;
        }

        .sentence-group {
          margin-bottom: 24px;
        }

        .group-header {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 16px 0 8px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border-color);
        }

        .sentence-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          margin-bottom: 8px;
          background: rgba(0,0,0,0.02);
          border-radius: 4px;
          border-left: 3px solid var(--primary-color);
          transition: background 0.2s;
        }

        .sentence-item:hover {
          background: rgba(0,0,0,0.05);
        }

        .sentence-content {
          flex: 1;
        }

        .sentence-trigger {
          font-family: monospace;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .sentence-response {
          font-size: 12px;
          color: var(--secondary-text);
          font-style: italic;
        }

        .sentence-actions {
          display: flex;
          gap: 4px;
          margin-left: 12px;
        }

        .search-input {
          margin-bottom: 16px;
        }

        .test-section {
          padding: 20px;
        }

        .test-input {
          margin-bottom: 12px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .test-results {
          margin-top: 20px;
        }

        .test-no-match {
          padding: 16px;
          background: rgba(244,67,54,0.1);
          color: var(--error-color);
          border-radius: 4px;
          text-align: center;
        }

        .test-match-results h3 {
          margin-top: 0;
          color: var(--success-color);
        }

        .test-match-item {
          padding: 12px;
          margin-bottom: 12px;
          background: rgba(76,175,80,0.05);
          border-left: 3px solid var(--success-color);
          border-radius: 4px;
        }

        .match-intent {
          font-weight: 600;
          color: var(--primary-color);
          margin-bottom: 4px;
        }

        .match-trigger {
          font-family: monospace;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .slot-badge {
          display: inline-block;
          background: var(--primary-color);
          color: white;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          margin-right: 6px;
          font-family: monospace;
        }

        .match-slots {
          margin: 8px 0;
          font-size: 12px;
        }

        .match-response {
          font-size: 12px;
          color: var(--secondary-text);
          font-style: italic;
          margin-top: 8px;
        }

        .export-container,
        .import-container {
          margin-bottom: 24px;
        }

        .export-container h3,
        .import-container h3 {
          margin-top: 0;
          color: var(--text-color);
        }

        .yaml-editor {
          width: 100%;
          height: 300px;
          padding: 12px;
          background: rgba(0,0,0,0.02);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          resize: vertical;
          margin-bottom: 12px;
          box-sizing: border-box;
        }

        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 4px;
          color: white;
          font-weight: 500;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        .notification-success {
          background: var(--success-color);
        }

        .notification-error {
          background: var(--error-color);
        }

        .notification-info {
          background: var(--primary-color);
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      
/* === Modern Bento Light Mode === */

:host {
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-success: #10B981;
  --bento-warning: #F59E0B;
  --bento-error: #EF4444;
  --bento-radius-sm: 10px;
  --bento-radius-xs: 6px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
  color-scheme: light dark;
}
* { box-sizing: border-box; }

.card, .card-container, .reports-card, .export-card {
  background: var(--bento-card); border-radius: var(--bento-radius-sm); box-shadow: var(--bento-shadow-sm);
  padding: 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--bento-text); border: 1px solid var(--bento-border); animation: fadeSlideIn 0.4s ease-out;
}
.card-header { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--bento-text); letter-spacing: -0.01em; display: flex; justify-content: space-between; align-items: center; }
.card-header h2 { font-size: 20px; font-weight: 700; color: var(--bento-text); margin: 0; letter-spacing: -0.01em; }
.card-title, .title, .header-title, .pan-title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.header, .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 4px; border-bottom: 2px solid var(--bento-border); margin-bottom: 24px; padding-bottom: 0; }
.tab, .tab-btn, .tab-btn { padding: 8px 14px; border: none; background: transparent; color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; transition: var(--bento-transition); white-space: nowrap; margin-bottom: -2px; border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif; }
.tab.active, .tab-btn.active, .tab-btn.active { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab:hover, .tab-btn:hover, .tab-btn:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab-icon { margin-right: 6px; }
.tab-content { display: none; }
.tab-content.active { display: block; animation: fadeSlideIn 0.3s ease-out; }

button, .btn, .btn-s { padding: 9px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
button:hover, .btn:hover, .btn-s:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
button.active, .btn.active, .btn-act { background: var(--bento-primary); color: white; border-color: var(--bento-primary); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary { padding: 9px 16px; background: var(--bento-primary); color: white; border: 1.5px solid var(--bento-primary); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; transition: var(--bento-transition); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary:hover { background: var(--bento-primary-hover); border-color: var(--bento-primary-hover); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35); transform: translateY(-1px); }
.btn-secondary { padding: 9px 16px; background: var(--bento-card); color: var(--bento-text); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-secondary:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.btn-danger { padding: 9px 16px; background: var(--bento-card); color: var(--bento-error); border: 1.5px solid var(--bento-error); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-danger:hover { background: var(--bento-error); color: white; }
.btn-small { padding: 5px 12px; font-size: 12px; border: 1px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text-secondary); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-small:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

input[type="text"], input[type="number"], input[type="date"], input[type="time"], input[type="email"], input[type="search"], select, textarea, .search-input, .sinput, .sinput-sm, .alert-search-box, .period-select { padding: 9px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); font-size: 13px; background: var(--bento-card); color: var(--bento-text); font-family: 'Inter', sans-serif; transition: var(--bento-transition); outline: none; }
input[type="text"]:focus, input[type="number"]:focus, input[type="date"]:focus, input[type="time"]:focus, select:focus, textarea:focus, .search-input:focus, .sinput:focus, .sinput-sm:focus, .alert-search-box:focus, .period-select:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input::placeholder, .search-input::placeholder, .sinput::placeholder, .sinput-sm::placeholder { color: var(--bento-text-secondary); opacity: 0.7; }
.form-group { margin-bottom: 16px; }
.form-group.full { grid-column: 1 / -1; }
.form-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
label, .cg label, .clbl { display: block; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
.add-form { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; margin-bottom: 20px; }
textarea { min-height: 80px; resize: vertical; }

.stats, .stats-grid, .stats-container, .summary-grid, .network-stats, .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat, .stat-card, .summary-card, .network-stat, .metric-card, .kpi-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); text-align: center; }
.stat:hover, .stat-card:hover, .summary-card:hover, .network-stat:hover, .metric-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-card.online { border-left: 3px solid var(--bento-success); }
.stat-card.offline { border-left: 3px solid var(--bento-error); }
.sv, .stat-value, .summary-value, .network-stat-value, .metric-value { font-size: 24px; font-weight: 700; color: var(--bento-primary); line-height: 1.2; }
.stat.ok .sv { color: var(--bento-success); }
.stat.err .sv { color: var(--bento-error); }
.sl, .stat-label, .summary-label, .network-stat-label, .metric-label { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat-trend { font-size: 12px; font-weight: 600; margin-top: 4px; }
.stat-trend.positive, .trend-up { color: var(--bento-success); }
.stat-trend.negative, .trend-down { color: var(--bento-error); }

.device-table, .entity-table, .table, .alert-table, .data-table, .backup-table, .history-table, .log-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; }
.device-table th, .entity-table th, .table th, .alert-table th, .data-table th, .backup-table th, table th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--bento-border); font-weight: 600; color: var(--bento-text-secondary); background: var(--bento-bg); cursor: pointer; user-select: none; white-space: nowrap; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.device-table th:first-child, .entity-table th:first-child, .table th:first-child, table th:first-child { border-radius: var(--bento-radius-xs) 0 0 0; }
.device-table th:last-child, .entity-table th:last-child, .table th:last-child, table th:last-child { border-radius: 0 var(--bento-radius-xs) 0 0; }
.device-table th:hover, .entity-table th:hover, .table th:hover, table th:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.device-table th.sorted, .entity-table th.sorted, .table th.sorted, table th.sorted { background: rgba(59, 130, 246, 0.08); color: var(--bento-primary); }
.device-table td, .entity-table td, .table td, .alert-table td, .data-table td, .backup-table td, table td { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; font-family: 'Inter', sans-serif; }
.device-table tr:hover, .entity-table tr:hover, .table tbody tr:hover, .alert-table tr:hover, table tr:hover { background: rgba(59, 130, 246, 0.03); }
.table-container { overflow-x: auto; border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); }
.sort-indicator { font-size: 10px; margin-left: 4px; color: var(--bento-primary); }

.status-badge, .severity-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.status-online, .status-home, .status-active, .status-ok, .status-healthy, .status-running, .status-complete, .status-completed, .status-success, .badge-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.status-offline, .status-error, .status-failed, .status-critical, .severity-critical, .badge-error, .badge-danger { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.status-away, .status-warning, .severity-warning, .badge-warning { background: rgba(245, 158, 11, 0.1); color: #B45309; }
.status-unavailable, .status-unknown, .status-idle, .status-inactive, .status-stopped, .badge-neutral { background: rgba(100, 116, 139, 0.1); color: var(--bento-text-secondary); }
.status-zone, .severity-info, .badge-info { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.alert-item { padding: 14px 18px; border-left: 4px solid var(--bento-border); border-radius: 0 var(--bento-radius-sm) var(--bento-radius-sm) 0; margin-bottom: 10px; background: var(--bento-bg); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.alert-item:hover { box-shadow: var(--bento-shadow-sm); }
.alert-critical { border-color: var(--bento-error); background: rgba(239, 68, 68, 0.04); }
.alert-warning { border-color: var(--bento-warning); background: rgba(245, 158, 11, 0.04); }
.alert-info { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.alert-text { flex: 1; }
.alert-type { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: var(--bento-text); }
.alert-time { font-size: 12px; color: var(--bento-text-secondary); }
.alert-actions { display: flex; gap: 8px; }
.alert-dismiss { padding: 6px 12px; font-size: 12px; background: var(--bento-card); color: var(--bento-text-secondary); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; transition: var(--bento-transition); }
.alert-dismiss:hover { background: var(--bento-error); color: white; border-color: var(--bento-error); }

.section { margin-bottom: 24px; }
.editor-section, .list-section, .export-section {
  background: var(--bento-card); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); padding: 20px; margin-bottom: 16px;
}
.editor-section h2, .list-section h2, .export-section h2 {
  font-size: 16px; font-weight: 600; color: var(--bento-text); margin: 0 0 16px 0;
}
.preview-slots {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 12px;
  background: var(--bento-bg); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); margin-top: 8px; min-height: 36px;
}
.section h3, .section-title, .pan-head { font-size: 16px; font-weight: 600; color: var(--bento-text); margin-bottom: 12px; letter-spacing: -0.01em; }

.battery-grid, .grid, .items-grid, .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.battery-card, .item-card, .chore-card, .entry-card, .backup-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); }
.battery-card:hover, .item-card:hover, .chore-card:hover, .entry-card:hover, .backup-card:hover { box-shadow: var(--bento-shadow-md); border-color: var(--bento-primary); transform: translateY(-1px); }
.chore-card.priority-high { border-left: 3px solid var(--bento-error); }
.chore-card.priority-medium { border-left: 3px solid var(--bento-warning); }
.chore-card.priority-low { border-left: 3px solid var(--bento-success); }
.chore-title, .entry-title, .item-title { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 6px; }
.chore-meta, .entry-meta, .item-meta { font-size: 12px; color: var(--bento-text-secondary); }
.chore-assignee { font-size: 12px; color: var(--bento-primary); font-weight: 500; }
.chore-actions, .item-actions, .entry-actions { display: flex; gap: 6px; margin-top: 10px; }

.battery-bar, .progress-bar, .bandwidth-bar-bg { width: 100%; height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.battery-fill, .progress-fill, .bandwidth-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-success); }
.battery-fill.battery_critical { background: var(--bento-error) !important; }
.battery-fill.battery_warning { background: var(--bento-warning) !important; }
.battery-label, .bandwidth-label { font-size: 13px; color: var(--bento-text); font-weight: 500; display: flex; justify-content: space-between; align-items: center; }

.pagination, .pag { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; padding: 16px 0; border-top: 1px solid var(--bento-border); }
.pagination-btn, .pag-btn { padding: 8px 14px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-xs); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-selector, .pag-size { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); background: var(--bento-card); color: var(--bento-text); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }

.col-main { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--bento-text); }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.panels { display: flex; gap: 12px; }
.pan-left, .pan-center, .pan-right { background: var(--bento-card); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.cbar { display: flex; gap: 8px; align-items: center; padding: 12px; background: var(--bento-bg); border-bottom: 1px solid var(--bento-border); }
.cg { display: flex; gap: 8px; align-items: center; }
.cg-r { margin-left: auto; }

.dd { position: relative; }
.dd-menu { position: absolute; top: 100%; left: 0; background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); box-shadow: var(--bento-shadow-md); min-width: 180px; z-index: 100; display: none; overflow: hidden; }
.dd.open .dd-menu { display: block; }
.dd-i { padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--bento-text); transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.dd-div { border-top: 1px solid var(--bento-border); margin: 4px 0; }

.auto-item, .tr-item, .list-item, .automation-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--bento-border); display: flex; align-items: center; gap: 10px; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.auto-item:hover, .tr-item:hover, .list-item:hover, .automation-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel, .tr-item.sel, .list-item.selected, .automation-item.selected { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); }
.auto-item.error-item, .automation-item.error-item { border-left: 3px solid var(--bento-error); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.auto-meta { font-size: 12px; color: var(--bento-text-secondary); }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bento-text-secondary); }
.auto-dot.s-running { background: var(--bento-success); }
.auto-dot.s-stopped { background: var(--bento-text-secondary); }
.auto-dot.s-error { background: var(--bento-error); }
.auto-count { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; }

.tgroup { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h { padding: 10px 14px; background: var(--bento-bg); display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { transition: transform 0.2s; font-size: 12px; color: var(--bento-text-secondary); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.tg-cnt { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; background: var(--bento-border); padding: 2px 8px; border-radius: 10px; }

.device-detail, .detail-panel, .details { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); }
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bento-border); font-size: 13px; }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--bento-text-secondary); font-weight: 500; }
.detail-value { color: var(--bento-text); font-weight: 600; }

.board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
.column { min-width: 260px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 12px; border: 1px solid var(--bento-border); }
.column-header { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.column-count { background: var(--bento-border); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }

.schedule, .calendar { margin-top: 16px; }
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 16px; }
.week-header { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; border-radius: var(--bento-radius-xs); }
.week-cell { padding: 8px; text-align: center; font-size: 12px; background: var(--bento-bg); border: 1px solid var(--bento-border); cursor: pointer; transition: var(--bento-transition); border-radius: var(--bento-radius-xs); }
.week-cell:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.chore-item { padding: 8px 12px; border-bottom: 1px solid var(--bento-border); font-size: 13px; }

.leaderboard { background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.leaderboard-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--bento-border); gap: 12px; font-size: 13px; transition: var(--bento-transition); }
.leaderboard-row:last-child { border-bottom: none; }
.leaderboard-row:hover { background: rgba(59, 130, 246, 0.04); }
.rank { font-weight: 700; color: var(--bento-primary); font-size: 14px; min-width: 28px; }
.name { font-weight: 500; color: var(--bento-text); flex: 1; }
.streak { color: var(--bento-warning); font-weight: 600; }
.completion { color: var(--bento-success); font-weight: 600; }

.baby-selector { display: flex; gap: 8px; margin-bottom: 16px; }
.quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.quick-btn, .action-btn { padding: 10px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); display: flex; align-items: center; gap: 6px; color: var(--bento-text); }
.quick-btn:hover, .action-btn:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.quick-btn.active, .action-btn.active { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.timeline { position: relative; padding-left: 24px; }
.timeline-item { padding: 12px 0; border-bottom: 1px solid var(--bento-border); position: relative; }
.timeline-time { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; }
.timeline-content { font-size: 13px; color: var(--bento-text); margin-top: 4px; }

canvas, .canvas-container canvas { width: 100%; height: 200px; border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); margin-bottom: 16px; }
.canvas-container { position: relative; margin-bottom: 16px; }
.chart-container { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 16px; }

.empty, .empty-state { text-align: center; padding: 48px 24px; color: var(--bento-text-secondary); font-size: 14px; font-family: 'Inter', sans-serif; }
.empty-ico, .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.spinner { width: 32px; height: 32px; border: 3px solid var(--bento-border); border-top: 3px solid var(--bento-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 24px auto; }

.search-box, .search-bar, .controls, .ctrls, .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.control-group { display: flex; gap: 8px; align-items: center; }

.domain-group-header { margin-top: 20px; padding: 10px 16px; background: var(--bento-bg); border-radius: var(--bento-radius-xs); font-weight: 600; font-size: 14px; color: var(--bento-text); border: 1px solid var(--bento-border); }
.domain-group-header:first-child { margin-top: 0; }
.domain-group-count { font-weight: 500; color: var(--bento-text-secondary); font-size: 12px; margin-left: 8px; }

.automation-list, .list, .item-list { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); overflow: hidden; }
.automation-name, .entity-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.automation-id, .entity-id { font-size: 11px; color: var(--bento-text-secondary); }
.error-badge, .count-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }
.tab .error-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }

.health-score, .score { font-size: 48px; font-weight: 700; color: var(--bento-primary); text-align: center; margin: 16px 0; }
.emoji { font-size: 20px; line-height: 1; }
.device-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.08); border-radius: var(--bento-radius-xs); font-size: 16px; }

.recommendation-card, .tip-card, .suggestion-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 12px; transition: var(--bento-transition); }
.recommendation-card:hover, .tip-card:hover, .suggestion-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); }

.export-options, .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.export-option, .option-card { background: var(--bento-bg); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; cursor: pointer; transition: var(--bento-transition); text-align: center; }
.export-option:hover, .option-card:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.export-option.selected, .option-card.selected { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.08); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.storage-bar, .usage-bar { width: 100%; height: 24px; background: var(--bento-border); border-radius: var(--bento-radius-xs); overflow: hidden; margin-bottom: 12px; }
.storage-fill, .usage-fill { height: 100%; border-radius: var(--bento-radius-xs); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-primary); }

.check-item, .security-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.check-item:hover, .security-item:hover { background: rgba(59, 130, 246, 0.03); }
.check-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 16px; }
.check-icon.pass { background: rgba(16, 185, 129, 0.1); }
.check-icon.fail { background: rgba(239, 68, 68, 0.1); }
.check-icon.warn { background: rgba(245, 158, 11, 0.1); }
.check-text, .security-text { flex: 1; }
.check-title { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.check-desc { font-size: 12px; color: var(--bento-text-secondary); margin-top: 2px; }

.waveform { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; margin-bottom: 16px; }
.analysis-result, .result-card { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; text-align: center; margin-bottom: 16px; }
.confidence-bar { height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.confidence-fill { height: 100%; border-radius: 4px; background: var(--bento-primary); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

.sentence-item, .intent-item { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.sentence-item:hover, .intent-item:hover { background: rgba(59, 130, 246, 0.03); }
.sentence-text { font-size: 13px; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.intent-badge { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.backup-item, .backup-entry { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.backup-item:hover, .backup-entry:hover { background: rgba(59, 130, 246, 0.03); }
.backup-name { font-weight: 500; font-size: 14px; color: var(--bento-text); }
.backup-date, .backup-size { font-size: 12px; color: var(--bento-text-secondary); }

.report-section { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 20px; border: 1px solid var(--bento-border); margin-bottom: 16px; }
.insight-card { padding: 14px; border-left: 3px solid var(--bento-primary); background: rgba(59, 130, 246, 0.04); border-radius: 0 var(--bento-radius-xs) var(--bento-radius-xs) 0; margin-bottom: 10px; }

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-secondary); }

@media (max-width: 768px) {
  .card, .card-container, .reports-card, .export-card { padding: 16px; }
  .stats, .stats-grid, .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .panels { flex-direction: column; }
  .board { flex-direction: column; }
  .column { min-width: unset; }
  .editor-section select { min-width: 0 !important; width: 100% !important; }
  .editor-section .btn { flex-shrink: 0; }
  .editor-section h2 { font-size: 16px !important; }
  .form-group input, .form-group select, .form-group textarea { font-size: 16px !important; }
}

/* Tips banner */
.tip-banner {
  background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03));
  border: 1.5px solid rgba(59,130,246,0.2);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.6;
  position: relative;
}
.tip-banner-title { font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #3B82F6; }
.tip-banner ul { margin: 6px 0 0 16px; padding: 0; }
.tip-banner li { margin-bottom: 3px; }
.tip-banner .tip-dismiss {
  position: absolute; top: 8px; right: 10px;
  background: none; border: none; cursor: pointer;
  font-size: 16px; color: var(--secondary-text-color, #888); opacity: 0.6;
}
.tip-banner .tip-dismiss:hover { opacity: 1; }
.tip-banner.hidden { display: none; }


@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
}
/* === DARK MODE ADDED - old comment below === */

/* B8: voice section added */

        /* === MOBILE FIX === */
        @media (max-width: 768px) {
          .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
          .tab, .tab-btn, .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
          .card, .card-container { padding: 14px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val, .kpi-val, .metric-val { font-size: 18px; }
          .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
          .panels, .board { flex-direction: column; }
          .column { min-width: unset; }
          h2 { font-size: 18px; }
          h3 { font-size: 15px; }
        }
        @media (max-width: 480px) {
          .tabs { gap: 1px; }
          .tab, .tab-btn, .tab-btn { padding: 5px 8px; font-size: 11px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: 1fr 1fr; }
          .stat-val, .kpi-val, .metric-val { font-size: 16px; }
          .slot-item { grid-template-columns: 1fr; }
        }

</style>
    `;
  }

  _renderActionsTab() {
    const defaultActions = [
      { intent: 'HassLightSet', slots: 'name, brightness, color', desc: 'Steruj swiatlem — wlacz, wylacz, jasnosc, kolor' },
      { intent: 'HassTurnOn', slots: 'name', desc: 'Wlacz dowolny urzadzenie (switch, fan, media_player...)' },
      { intent: 'HassTurnOff', slots: 'name', desc: 'Wylacz dowolne urzadzenie' },
      { intent: 'HassClimateSetTemperature', slots: 'name, temperature', desc: 'Ustaw temperature klimatyzacji/ogrzewania' },
      { intent: 'HassMediaPause', slots: 'name', desc: 'Pauza media player' },
      { intent: 'HassMediaNext', slots: 'name', desc: 'Nastepny utwor' },
      { intent: 'HassVacuumStart', slots: 'name', desc: 'Uruchom odkurzacz' },
      { intent: 'HassSetPosition', slots: 'name, position', desc: 'Ustaw pozycje rolety/zaslony' },
    ];

    const customActions = this._customActions || [];

    let html = '<div class="section-title">⚙️ Custom Actions Panel</div>';
    html += `<p style="color:var(--bento-text-secondary,#64748b);font-size:13px;margin-bottom:16px;">${this._t.customActionDesc}</p>`;

    // Built-in intents reference
    html += '<div class="section-title" style="margin-top:20px;">📋 Built-in HA Intents (reference)</div>';
    html += '<div style="overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch;border-radius:8px;border:1px solid var(--bento-border,#e2e8f0);">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:0;">';
    html += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid var(--bento-border,#e2e8f0);">Intent</th><th style="text-align:left;padding:8px;border-bottom:2px solid var(--bento-border,#e2e8f0);">Slots</th><th style="text-align:left;padding:8px;border-bottom:2px solid var(--bento-border,#e2e8f0);">Opis</th></tr></thead><tbody>';
    defaultActions.forEach(a => {
      html += `<tr><td style="padding:6px 8px;border-bottom:1px solid var(--bento-border,#e2e8f0);"><code>${a.intent}</code></td><td style="padding:6px 8px;border-bottom:1px solid var(--bento-border,#e2e8f0);font-size:12px;">${a.slots}</td><td style="padding:6px 8px;border-bottom:1px solid var(--bento-border,#e2e8f0);font-size:12px;color:var(--bento-text-secondary,#64748b);">${a.desc}</td></tr>`;
    });
    html += '</tbody></table></div>';
    html += '<div style="margin-bottom:20px;"></div>';

    // Custom action builder
    html += '<div class="section-title" style="margin-top:24px;">🛠️ Create Custom Action</div>';
    html += '<div style="background:var(--bento-bg,#f8fafc);border:1.5px solid var(--bento-border,#e2e8f0);border-radius:12px;padding:16px;margin-bottom:16px;">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
    html += `<div><label style="font-size:12px;font-weight:600;color:var(--bento-text-secondary,#64748b);display:block;margin-bottom:4px;">Trigger phrase (PL)</label><input type="text" id="action-trigger" placeholder="${this._t.triggerPhraseEg}" style="width:100%;padding:8px 12px;border:1.5px solid var(--bento-border,#e2e8f0);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>`;
    html += '<div><label style="font-size:12px;font-weight:600;color:var(--bento-text-secondary,#64748b);display:block;margin-bottom:4px;">Trigger phrase (EN)</label><input type="text" id="action-trigger-en" placeholder="e.g. turn on movie mode" style="width:100%;padding:8px 12px;border:1.5px solid var(--bento-border,#e2e8f0);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
    html += '<div><label style="font-size:12px;font-weight:600;color:var(--bento-text-secondary,#64748b);display:block;margin-bottom:4px;">HA Service</label><input type="text" id="action-service" placeholder="np. scene.turn_on, script.movie_mode" style="width:100%;padding:8px 12px;border:1.5px solid var(--bento-border,#e2e8f0);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>';
    html += '<div><label style="font-size:12px;font-weight:600;color:var(--bento-text-secondary,#64748b);display:block;margin-bottom:4px;">Entity ID</label><input type="text" id="action-entity" placeholder="np. scene.movie_mode" style="width:100%;padding:8px 12px;border:1.5px solid var(--bento-border,#e2e8f0);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>';
    html += '</div>';
    html += '<button class="btn-primary" id="btn-generate-action" style="margin-top:8px;">📝 Generate YAML</button>';
    html += '</div>';

    // Generated YAML output
    html += '<div id="action-yaml-output" style="display:none;margin-top:16px;">';
    html += '<div class="section-title">📄 Generated YAML</div>';
    html += '<pre id="action-yaml-code" style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:10px;font-size:12px;overflow-x:auto;line-height:1.6;"></pre>';
    html += '<button class="btn-secondary" id="btn-copy-action-yaml" style="margin-top:8px;">📋 Copy to Clipboard</button>';
    html += '</div>';

    // Saved custom actions list
    if (customActions.length > 0) {
      html += '<div class="section-title" style="margin-top:24px;">💾 Saved Actions (' + customActions.length + ')</div>';
      customActions.forEach((a, idx) => {
        html += `<div style="padding:10px 14px;background:var(--bento-bg,#f8fafc);border:1px solid var(--bento-border,#e2e8f0);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><div><strong style="font-size:13px;">"${_esc(a.trigger)}"</strong> <span style="font-size:12px;color:var(--bento-text-secondary,#64748b);">⚡ ${_esc(a.service)} (${_esc(a.entity)})</span></div><button class="btn-danger-sm" data-remove-action="${idx}" style="padding:4px 10px;font-size:11px;border-radius:6px;background:var(--bento-error,#ef4444);color:white;border:none;cursor:pointer;">🗑️</button></div>`;
      });
    }

    return html;
  }

  disconnectedCallback() {
    // Cleanup any active event listeners or timers
  }

  // --- Pagination helper ---
  _renderPagination(tabName, totalItems) {
    if (!this._currentPage[tabName]) this._currentPage[tabName] = 1;
    const pageSize = this._pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(this._currentPage[tabName], totalPages);
    this._currentPage[tabName] = page;
    return `
      <div class="pagination">
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>&#8249; Prev</button>
        <span class="pagination-info">${page} / ${totalPages} (${totalItems})</span>
        <button class="pagination-btn" data-page-tab="${tabName}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next &#8250;</button>
        <select class="page-size-select" data-page-tab="${tabName}" data-action="page-size">
          ${[10,15,25,50].map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}/page</option>`).join('')}
        </select>
      </div>`;
  }

  _paginateItems(items, tabName) {
    if (!this._currentPage[tabName]) this._currentPage[tabName] = 1;
    const start = (this._currentPage[tabName] - 1) * this._pageSize;
    return items.slice(start, start + this._pageSize);
  }

  _setupPaginationListeners() {
    if (!this.shadowRoot) return;
    this.shadowRoot.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.pageTab;
        const page = parseInt(e.target.dataset.page);
        if (tab && page > 0) {
          this._currentPage[tab] = page;
          this._render();
        }
      });
    });
    this.shadowRoot.querySelectorAll('.page-size-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this._pageSize = parseInt(e.target.value);
        // Reset all pages to 1
        Object.keys(this._currentPage).forEach(k => this._currentPage[k] = 1);
        this._render();
      });
    });
  }
  // --- Seeded random for stable data ---
  _seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }



  setActiveTab(tabId) {
    this.currentTab = tabId;
    this._render();
  }

}

if (!customElements.get('ha-sentence-manager')) { customElements.define('ha-sentence-manager', HASentenceManager); }
;

class HASentenceManagerEditor extends HTMLElement {
  setConfig(config) {
    this.config = config;
  }

  connectedCallback() {
    const _esc = window._haToolsEsc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    this.innerHTML = `
      <div style="padding: 20px;">
        <h2>Sentence Manager Configuration</h2>
        <p>Basic card configuration. Most settings are managed within the card interface.</p>
        <div style="margin: 20px 0;">
          <label style="display: block; margin-bottom: 10px;">
            Title:
            <input type="text" id="title" placeholder="Sentence Manager" value="${_esc(this.config?.title || 'Sentence Manager')}">
          </label>
          <label style="display: block; margin-bottom: 10px;">
            Language:
            <input type="text" id="language" placeholder="en" value="${_esc(this.config?.language || 'en')}">
          </label>
        </div>
      </div>
    `;
  }

}

if (!customElements.get('ha-sentence-manager-editor')) { customElements.define('ha-sentence-manager-editor', HASentenceManagerEditor); };

})();

window.customCards = window.customCards || [];
window.customCards.push({ type: 'ha-sentence-manager', name: 'Sentence Manager', description: 'Manage voice assistant sentences and intents', preview: false });
