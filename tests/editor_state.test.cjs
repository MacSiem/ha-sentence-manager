const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
function fixture(tab) {
 const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
 dom.window.scrollTo = () => {};
 dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
 const card = dom.window.document.createElement('ha-sentence-manager');
 card._hass = { user: { is_admin: true }, states: {}, themes: {} }; card.config = {};
 card.currentTab = tab; card._lang = 'en';
 card.sentences = [{ id: 'qa-id', trigger: 'QA {area}', intent: 'QAIntent', response: 'QA response', slots: {area:'string'}, revision:'rev-before', _allSentences:['QA {area}','QA sibling'] }];
 card.render(); return {dom,card};
}
for (const tab of ['editor','list']) test(`editing from ${tab} preserves trigger, intent, response and slots`, () => {
 const {dom,card}=fixture(tab);
 try {
  card.editSentence(0);
  assert.equal(card.shadowRoot.querySelector('#trigger-input').value,'QA {area}');
  assert.equal(card.shadowRoot.querySelector('#intent-input').value,'QAIntent');
  assert.equal(card.shadowRoot.querySelector('#response-input').value,'QA response');
  assert.equal(card.shadowRoot.querySelector('.slot-input').dataset.slotName,'area');
  assert.equal(card.shadowRoot.querySelector('.slot-input').value,'string');
  assert.equal(card.editingId,'qa-id');
 } finally {dom.window.close();}
});
test('conflicting save keeps the draft, old revision and sibling sentence for retry', async () => {
 const {dom,card}=fixture('editor');
 try {
  card.editSentence(0);
  card.shadowRoot.querySelector('#trigger-input').value='QA new {area}';
  let request;
  card._apiUpdate=async(id,patch,revision)=>{request={id,patch,revision};throw new Error('conflict');};
  await card.saveSentence();
  assert.equal(card.shadowRoot.querySelector('#trigger-input').value,'QA new {area}');
  assert.equal(card.shadowRoot.querySelector('#response-input').value,'QA response');
  assert.equal(card.editingId,'qa-id');
  assert.equal(request.revision,'rev-before');
  assert.deepEqual(Array.from(request.patch.sentences),['QA new {area}','QA sibling']);
  assert.match(card.shadowRoot.querySelector('.notification').textContent,/conflict/);
 } finally {dom.window.close();}
});
