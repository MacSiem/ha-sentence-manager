const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
async function fixture(language = 'en', tab = 'editor') {
 const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
 dom.window.scrollTo = () => {};
 dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8'));
 const card = dom.window.document.createElement('ha-sentence-manager');
 card.currentTab = tab; card.setConfig({ show_support: false }); dom.window.document.body.append(card);
 const requests = [];
 const hass = { language, user: { is_admin: true }, themes: {}, states: {}, config: { language: 'en' },
  callWS: async message => { requests.push(message); return []; } };
 card.hass = hass; await new Promise(resolve => setImmediate(resolve));
 return { card, dom, hass, requests };
}
test('ordinary locale changes translate navigation and tips independently without another storage read', async () => {
 const a = await fixture('en'), b = await fixture('pl');
 try {
  a.card.hass = { ...a.hass, language: 'pl' };
  assert.match(a.card.shadowRoot.querySelector('[data-tab="editor"]').textContent, /Edytor/);
  assert.match(a.card.shadowRoot.querySelector('.tip-banner-title').textContent, /Jak działają/);
  b.card.hass = { ...b.hass, language: 'en' };
  assert.match(b.card.shadowRoot.querySelector('[data-tab="editor"]').textContent, /Editor/);
  assert.match(a.card.shadowRoot.querySelector('[data-tab="editor"]').textContent, /Edytor/);
  assert.equal(a.requests.length, 1); assert.equal(b.requests.length, 1);
 } finally { a.dom.window.close(); b.dom.window.close(); }
});
test('ordinary locale updates preserve an edited sentence, revision, dynamic slots and focus selection', async () => {
 const { card, dom, hass, requests } = await fixture();
 try {
  card.sentences = [{ id: 'qa-id', trigger: 'QA {room}', intent: 'QAIntent', response: 'QA reply', slots: { room: 'string' }, revision: 'rev-before', _allSentences: ['QA {room}', 'QA sibling'] }];
  card.editSentence(0);
  const input = card.shadowRoot.querySelector('#trigger-input'); input.value = 'QA new unsaved {room}';
  card.shadowRoot.querySelector('#intent-input').value = 'UnsavedIntent';
  card.shadowRoot.querySelector('#response-input').value = 'Unsaved response';
  card.shadowRoot.querySelector('.slot-input').value = 'living:room';
  input.focus(); input.setSelectionRange(2, 9, 'backward');
  card.hass = { ...hass, language: 'pl' };
  assert.match(card.shadowRoot.querySelector('[data-tab="editor"]').textContent, /Edytor/);
  const current = card.shadowRoot.querySelector('#trigger-input');
  assert.equal(current.value, 'QA new unsaved {room}'); assert.equal(card.shadowRoot.activeElement, current);
  assert.equal(current.selectionStart, 2); assert.equal(current.selectionEnd, 9); assert.equal(current.selectionDirection, 'backward');
  assert.equal(card.shadowRoot.querySelector('#intent-input').value, 'UnsavedIntent');
  assert.equal(card.shadowRoot.querySelector('#response-input').value, 'Unsaved response');
  assert.equal(card.shadowRoot.querySelector('.slot-input').value, 'living:room');
  assert.equal(card.editingId, 'qa-id'); assert.equal(card.sentences[0].revision, 'rev-before');
  assert.equal(card.shadowRoot.querySelector('.remove-slot-btn').textContent, 'Usuń');
  card.shadowRoot.querySelector('.remove-slot-btn').click();
  assert.equal(card.shadowRoot.querySelector('.slot-input'), null);
  card.hass = hass;
  assert.equal(card.shadowRoot.querySelector('#trigger-input').value, 'QA new unsaved {room}');
  assert.equal(card.shadowRoot.querySelector('#slots-container').children.length, 0); assert.equal(requests.length, 1);
 } finally { dom.window.close(); }
});
test('an import draft remains unsubmitted across ordinary locale changes', async () => {
 const { card, dom, hass, requests } = await fixture('en', 'export');
 try {
  const input = card.shadowRoot.querySelector('#yaml-input'); input.value = 'custom_sentences:\n  - trigger: QA unsaved';
  input.focus(); input.select(); card.hass = { ...hass, language: 'pl' };
  assert.match(card.shadowRoot.querySelector('#import-yaml-btn').textContent, /Importuj/);
  const current = card.shadowRoot.querySelector('#yaml-input');
  assert.equal(current.value, 'custom_sentences:\n  - trigger: QA unsaved'); assert.equal(card.shadowRoot.activeElement, current);
  assert.equal(current.selectionStart, 0); assert.equal(current.selectionEnd, current.value.length);
  assert.equal(requests.length, 1);
 } finally { dom.window.close(); }
});
test('same-language state updates retain the actual editor DOM', async () => {
 const { card, dom, hass } = await fixture();
 try {
  const input = card.shadowRoot.querySelector('#trigger-input'); input.value = 'QA live draft'; input.focus();
  card.hass = { ...hass, states: { 'sensor.qa': { state: '2' } } };
  assert.equal(card.shadowRoot.querySelector('#trigger-input'), input); assert.equal(card.shadowRoot.activeElement, input);
 } finally { dom.window.close(); }
});
test('a simultaneous role and locale change still removes privileged editing and sends no mutation', async () => {
 const { card, dom, hass, requests } = await fixture();
 try {
  card.shadowRoot.querySelector('#trigger-input').value = 'QA privileged unsaved';
  card.hass = { ...hass, language: 'pl', user: { is_admin: false } };
  assert.equal(card.shadowRoot.querySelector('#trigger-input'), null);
  assert.equal(card.shadowRoot.querySelector('#save-btn'), null);
  assert.match(card.shadowRoot.querySelector('.tab-content').textContent, /administrator/);
  assert.equal(requests.length, 1);
 } finally { dom.window.close(); }
});
