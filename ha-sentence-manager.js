class HASentenceManager extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this.config = {};
    this.sentences = [];
    this._loadData();
    this.currentTab = 'editor';
    this.editingIndex = null;
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
    this._hass = hass;
    if (!hass) return;
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this.render();
      this._lastRenderTime = now;
      return;
    }
    if (now - (this._lastRenderTime || 0) < 5000) {
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        setTimeout(() => {
          this._renderScheduled = false;
          this.render();
          this._lastRenderTime = Date.now();
        }, 5000 - (now - (this._lastRenderTime || 0)));
      }
      return;
    }
    this.render();
    this._lastRenderTime = now;
  }

  get hass() {
    return this._hass;
  }

  static getConfigElement() {
    return document.createElement('ha-sentence-manager-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:ha-sentence-manager',
      title: 'Sentence Manager',
      language: 'en',
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
        language: this.config.language || 'en',
      });
      return result.intents || [];
    } catch (e) {
      console.log('Could not load intents from Home Assistant');
      return [];
    }
  }

  highlightSlots(text) {
    const slotRegex = /\{([^}]+)\}/g;
    return text.replace(slotRegex, '<span class="slot-highlight">{$1}</span>');
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
        <label>${name}:</label>
        <input type="text" class="slot-input" data-slot-name="${name}" value="${type}">
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
        <label>${slotName}:</label>
        <input type="text" class="slot-input" data-slot-name="${slotName}" placeholder="e.g., string, number, area">
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
        <label>${name}:</label>
        <input type="text" class="slot-input" data-slot-name="${name}" value="${type}">
        <button class="remove-slot-btn">Remove</button>
      `;
      slotElement.querySelector('.remove-slot-btn').addEventListener('click', () => slotElement.remove());
      slotsContainer.appendChild(slotElement);
    });
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = this.getStyles();
    }

    const container = document.createElement('div');
    container.className = 'card';
    container.innerHTML = `
      <div class="card-header">
        <h1 class="card-title">${this.config.title || 'Sentence Manager'}</h1>
      </div>

      <div class="tabs">
        <button class="tab-button ${this.currentTab === 'editor' ? 'active' : ''}" data-tab="editor">Editor</button>
        <button class="tab-button ${this.currentTab === 'list' ? 'active' : ''}" data-tab="list">Sentences</button>
        <button class="tab-button ${this.currentTab === 'test' ? 'active' : ''}" data-tab="test">Test</button>
        <button class="tab-button ${this.currentTab === 'export' ? 'active' : ''}" data-tab="export">Import/Export</button>
      </div>

      <div class="tab-content">
        ${this.renderEditor()}
        ${this.renderList()}
        ${this.renderTest()}
        ${this.renderExport()}
      </div>
    `;

    const oldContainer = this.shadowRoot.querySelector('.card');
    if (oldContainer) oldContainer.replaceWith(container);
    else this.shadowRoot.appendChild(container);

    this.attachEventListeners();
  }

  renderEditor() {
    return `
      <div class="tab-panel ${this.currentTab === 'editor' ? 'active' : ''}" data-tab-content="editor">
        <div class="editor-section">
          <h2>Create/Edit Sentence</h2>

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
                <h3 class="group-header">${group.intent}</h3>
                ${group.sentences.map((s, idx) => `
                  <div class="sentence-item">
                    <div class="sentence-content">
                      <div class="sentence-trigger">${this.highlightSlots(s.trigger)}</div>
                      ${s.response ? `<div class="sentence-response">Response: ${s.response}</div>` : ''}
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
    return `
      <div class="tab-panel ${this.currentTab === 'test' ? 'active' : ''}" data-tab-content="test">
        <div class="test-section">
          <h2>Test Sentence Matching</h2>
          <input type="text" id="test-input" placeholder="Type a sentence to test..." class="test-input">
          <button class="btn btn-primary" id="test-btn">Test</button>
          <div id="test-results" class="test-results"></div>
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
    // Tab switching
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', e => {
        this.currentTab = e.target.dataset.tab;
        this.render();
      });
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

    // Test
    this.shadowRoot.querySelector('#test-btn')?.addEventListener('click', () => {
      const input = this.shadowRoot.querySelector('#test-input').value;
      const results = this.testSentenceMatching(input);
      this.displayTestResults(results, input);
    });

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
      container.innerHTML = `<div class="test-no-match">No matches found for: "${input}"</div>`;
      return;
    }

    container.innerHTML = `
      <div class="test-match-results">
        <h3>${results.length} match(es) found:</h3>
        ${results.map(r => `
          <div class="test-match-item">
            <div class="match-intent">${r.intent}</div>
            <div class="match-trigger">Pattern: ${this.highlightSlots(r.sentence)}</div>
            ${Object.keys(r.slots).length > 0 ? `
              <div class="match-slots">
                Extracted: ${Object.entries(r.slots).map(([k, v]) => `<span class="slot-badge">${k}=${v}</span>`).join(' ')}
              </div>
            ` : ''}
            ${r.response ? `<div class="match-response">Response: ${r.response}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  getStyles() {
    return `
      <style>
/* ===== BENTO LIGHT MODE DESIGN SYSTEM ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

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
  --bento-bg: #F8FAFC;
  --bento-card: #FFFFFF;
  --bento-border: #E2E8F0;
  --bento-text: #1E293B;
  --bento-text-secondary: #64748B;
  --bento-text-muted: #94A3B8;
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
  gap: 4px;
  border-bottom: 2px solid var(--bento-border);
  padding: 0 4px;
  margin-bottom: 20px;
  overflow-x: auto;
}
.tab, .tab-btn, .tab-button {
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
.tab:hover, .tab-btn:hover, .tab-button:hover {
  color: var(--bento-primary);
  background: var(--bento-primary-light);
}
.tab.active, .tab-btn.active, .tab-button.active {
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

/* ===== END BENTO LIGHT MODE ===== */

        :host {
          --primary-color: var(--primary-color, #03a9f4);
          --error-color: var(--error-color, #f44336);
          --success-color: var(--success-color, #4caf50);
          --background-color: var(--ha-card-background, #ffffff);
          --text-color: var(--primary-text-color, #212121);
          --secondary-text: var(--secondary-text-color, #757575);
          --border-color: var(--divider-color, #e0e0e0);
        }

        .card {
          background: var(--background-color);
          color: var(--text-color);
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
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
        }

        .tab-button {
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

        .tab-button:hover {
          color: var(--text-color);
        }

        .tab-button.active {
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

        .slot-item input {
          padding: 8px;
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

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:host {
  --bento-bg: #F8FAFC;
  --bento-card: #FFFFFF;
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-text: #1E293B;
  --bento-text-secondary: #64748B;
  --bento-border: #E2E8F0;
  --bento-success: #10B981;
  --bento-warning: #F59E0B;
  --bento-error: #EF4444;
  --bento-radius: 16px;
  --bento-radius-sm: 10px;
  --bento-radius-xs: 6px;
  --bento-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
  color-scheme: light !important;
}
* { box-sizing: border-box; }

.card, .card-container, .reports-card, .export-card {
  background: var(--bento-card); border-radius: var(--bento-radius); box-shadow: var(--bento-shadow);
  padding: 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--bento-text); border: 1px solid var(--bento-border); animation: fadeSlideIn 0.4s ease-out;
}
.card-header { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--bento-text); letter-spacing: -0.01em; display: flex; justify-content: space-between; align-items: center; }
.card-header h2 { font-size: 20px; font-weight: 700; color: var(--bento-text); margin: 0; letter-spacing: -0.01em; }
.card-title, .title, .header-title, .pan-title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.header, .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--bento-border); margin-bottom: 24px; overflow-x: auto; padding-bottom: 0; }
.tab, .tab-btn, .tab-button { padding: 10px 20px; border: none; background: transparent; color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; transition: var(--bento-transition); white-space: nowrap; margin-bottom: -2px; border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif; }
.tab.active, .tab-btn.active, .tab-button.active { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab:hover, .tab-btn:hover, .tab-button:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
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
.alert-item:hover { box-shadow: var(--bento-shadow); }
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
  border-radius: var(--bento-radius); padding: 20px; margin-bottom: 16px;
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
}

</style>
    `;
  }
}

if (!customElements.get('ha-sentence-manager')) { customElements.define('ha-sentence-manager', HASentenceManager); };

class HASentenceManagerEditor extends HTMLElement {
  setConfig(config) {
    this.config = config;
  }

  connectedCallback() {
    this.innerHTML = `
      <div style="padding: 20px;">
        <h2>Sentence Manager Configuration</h2>
        <p>Basic card configuration. Most settings are managed within the card interface.</p>
        <div style="margin: 20px 0;">
          <label style="display: block; margin-bottom: 10px;">
            Title:
            <input type="text" id="title" placeholder="Sentence Manager" value="${this.config?.title || 'Sentence Manager'}">
          </label>
          <label style="display: block; margin-bottom: 10px;">
            Language:
            <input type="text" id="language" placeholder="en" value="${this.config?.language || 'en'}">
          </label>
        </div>
      </div>
    `;
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
          this._render ? this._render() : (this.render ? this.render() : this.renderCard());
        }
      });
    });
    this.shadowRoot.querySelectorAll('.page-size-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this._pageSize = parseInt(e.target.value);
        // Reset all pages to 1
        Object.keys(this._currentPage).forEach(k => this._currentPage[k] = 1);
        this._render ? this._render() : (this.render ? this.render() : this.renderCard());
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


}

if (!customElements.get('ha-sentence-manager-editor')) { customElements.define('ha-sentence-manager-editor', HASentenceManagerEditor); };
