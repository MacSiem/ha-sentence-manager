class HASentenceManager extends HTMLElement {
  constructor() {
    super();
    this.hass = null;
    this.config = {};
    this.sentences = [];
    this.currentTab = 'editor';
    this.editingIndex = null;
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
    this.hass = hass;
    this.render();
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

    const template = templates[Math.floor(Math.random() * templates.length)];
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
      </style>
    `;
  }
}

customElements.define('ha-sentence-manager', HASentenceManager);

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
}

customElements.define('ha-sentence-manager-editor', HASentenceManagerEditor);
