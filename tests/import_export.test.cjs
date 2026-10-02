const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');

function fixture() {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://localhost/' });
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8'));
  const card = dom.window.document.createElement('ha-sentence-manager');
  card._hass = { user: { is_admin: true }, config: { language: 'en' } };
  card._lang = 'en';
  card.showNotification = () => {};
  return { dom, card };
}

test('export/import preserves quoted phrases, response punctuation and slot values', async () => {
  const { dom, card } = fixture();
  try {
    card.sentences = [{ trigger: 'say "hello" to {name}', intent: 'QAGreeting',
      response: 'Hello: "friend" — it\'s ready', slots: { name: 'living:room' } }];
    const exported = card.exportAsYaml();
    assert.ok(exported.includes('trigger: "say \\"hello\\" to {name}"'));
    const writes = [];
    card._apiCreate = async row => { writes.push(JSON.parse(JSON.stringify(row))); };
    card._reloadFromApi = async () => {};
    card._apiReload = async () => {};
    await card.importFromYaml(exported);
    assert.deepEqual(writes, [{ language: 'en', intent: 'QAGreeting',
      sentences: ['say "hello" to {name}'], slots: { name: 'living:room' },
      response: 'Hello: "friend" — it\'s ready' }]);
  } finally { dom.window.close(); }
});

test('import reads response before treating indented values as slots', async () => {
  const { dom, card } = fixture();
  try {
    const writes = [];
    card._apiCreate = async row => { writes.push(JSON.parse(JSON.stringify(row))); };
    card._reloadFromApi = async () => {};
    card._apiReload = async () => {};
    await card.importFromYaml('custom_sentences:\n  - trigger: "QA phrase"\n    intents:\n      - intent: QAIntent\n        slots:\n          room: string\n    response: "QA: done"\n');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].intent, 'QAIntent');
    assert.equal(writes[0].response, 'QA: done');
    assert.deepEqual(writes[0].slots, { room: 'string' });
  } finally { dom.window.close(); }
});
