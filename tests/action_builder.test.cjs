const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { parse: parseYaml } = require('yaml');
const { JSDOM } = require('jsdom');
async function fixture(language = 'en') {
 const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
 dom.window.scrollTo = () => {};
 dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8'));
 const card = dom.window.document.createElement('ha-sentence-manager');
 card.currentTab = 'actions'; card.setConfig({ show_support: false }); dom.window.document.body.append(card);
 const requests = [], notices = [], copies = [];
 const hass = { language, user: { is_admin: true }, themes: {}, states: {}, config: { language: 'en' }, callWS: async message => { requests.push(message); return []; } };
 card.hass = hass; await new Promise(resolve => setImmediate(resolve));
 card.showNotification = (message, type) => notices.push({ message, type });
 Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async text => copies.push(text) }, configurable: true });
 const field = (id, value) => { const el = card.shadowRoot.getElementById(id); el.value = value; el.dispatchEvent(new dom.window.Event('input')); return el; };
 const click = id => card.shadowRoot.getElementById(id).click();
 return { card, dom, hass, requests, notices, copies, field, click };
}
test('actual Generate click creates safely quoted sentence-trigger automation without executing HA', async () => {
 const f = await fixture();
 try {
  const pl = 'tryb "kino": # <img src=x>', en = "movie (mode|time) [please]";
  f.field('action-trigger', pl); f.field('action-trigger-en', en); f.field('action-service', 'scene.turn_on'); f.field('action-entity', 'scene.qa_movie'); f.click('btn-generate-action');
  const output = f.card.shadowRoot.getElementById('action-yaml-output');
  assert.notEqual(output.style.display, 'none');
  const yaml = f.card.shadowRoot.getElementById('action-yaml-code').textContent, parsed = parseYaml(yaml);
  assert.deepEqual(parsed.triggers, [{ trigger: 'conversation', command: [pl, en] }]);
  assert.deepEqual(parsed.actions, [{ action: 'scene.turn_on', target: { entity_id: 'scene.qa_movie' } }]);
  assert.equal(parsed.mode, 'single'); assert.equal(output.querySelector('img'), null); assert.equal(f.requests.length, 1);
 } finally { f.dom.window.close(); }
});
test('English-only phrase and a targetless script generate a valid standalone automation', async () => {
 const f = await fixture();
 try {
  f.field('action-trigger-en', 'start QA mode'); f.field('action-service', 'script.qa_mode'); f.click('btn-generate-action');
  const parsed = parseYaml(f.card.shadowRoot.getElementById('action-yaml-code').textContent);
  assert.deepEqual(parsed.triggers[0].command, ['start QA mode']); assert.deepEqual(parsed.actions, [{ action: 'script.qa_mode' }]); assert.equal(f.requests.length, 1);
 } finally { f.dom.window.close(); }
});
test('missing phrases and malformed services or entity IDs give a localized error without output or requests', async () => {
 const f = await fixture('pl');
 try {
  for (const [phrase, service, entity] of [['', 'scene.turn_on', ''], ['QA', 'bad: service', ''], ['QA', 'scene.turn_on', 'scene.bad\n- action: evil']]) {
   f.field('action-trigger', phrase); f.field('action-service', service); f.field('action-entity', entity); f.click('btn-generate-action');
   assert.equal(f.notices.at(-1)?.type, 'error'); assert.match(f.notices.at(-1).message, /fraza|usług|encj/i); assert.equal(f.card.shadowRoot.getElementById('action-yaml-output').style.display, 'none');
  }
  assert.equal(f.requests.length, 1);
 } finally { f.dom.window.close(); }
});
test('Copy awaits the clipboard, reports denial truthfully, and remains local after locale change', async () => {
 const f = await fixture();
 try {
  f.field('action-trigger', 'QA movie'); f.field('action-service', 'script.qa_movie'); f.click('btn-generate-action');
  const generated = f.card.shadowRoot.getElementById('action-yaml-code').textContent;
  assert.ok(generated.length > 0); f.card.hass = { ...f.hass, language: 'pl' };
  assert.equal(f.card.shadowRoot.getElementById('action-yaml-code').textContent, generated); assert.notEqual(f.card.shadowRoot.getElementById('action-yaml-output').style.display, 'none');
  f.click('btn-copy-action-yaml'); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(f.copies, [generated]); assert.equal(f.notices.at(-1).type, 'success');
  f.dom.window.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  f.click('btn-copy-action-yaml'); await new Promise(resolve => setImmediate(resolve)); assert.equal(f.notices.at(-1).type, 'error'); assert.match(f.notices.at(-1).message, /schow/i); assert.equal(f.requests.length, 1);
 } finally { f.dom.window.close(); }
});
test('editing a generated draft invalidates the old output rather than copying an obsolete action', async () => {
 const f = await fixture();
 try {
  f.field('action-trigger', 'QA movie'); f.field('action-service', 'script.qa_movie'); f.click('btn-generate-action'); assert.ok(f.card.shadowRoot.getElementById('action-yaml-code').textContent);
  f.field('action-service', 'script.qa_new'); assert.equal(f.card.shadowRoot.getElementById('action-yaml-output').style.display, 'none'); assert.equal(f.card.shadowRoot.getElementById('action-yaml-code').textContent, '');
  f.click('btn-copy-action-yaml'); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(f.copies, []); assert.equal(f.requests.length, 1);
 } finally { f.dom.window.close(); }
});
