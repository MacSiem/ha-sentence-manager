'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(language = 'en') {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://localhost/' });
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8'));
  const card = dom.window.document.createElement('ha-sentence-manager');
  let requests = 0;
  card._hass = { user: { is_admin: true }, config: { language }, callWS: async () => { requests++; throw new Error('Unexpected request'); } };
  card._lang = language;
  card.currentTab = 'export';
  card.sentences = [{ trigger: 'synthetic "phrase": {room}', intent: 'Synthetic', slots: { room: 'string' }, response: 'synthetic response' }];
  dom.window.document.body.append(card);
  card.render();
  const notices = [];
  card.showNotification = (message, type) => notices.push({ message, type });
  const output = card.shadowRoot.querySelector('#yaml-output');
  const click = () => card.shadowRoot.querySelector('#copy-yaml-btn').click();
  const clipboard = value => Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value });
  return { dom, card, notices, output, click, clipboard, requests: () => requests };
}

test('actual Copy button waits for clipboard confirmation and copies precisely the visible YAML', async () => {
  const f = fixture();
  try {
    const shown = f.output.value;
    f.card.sentences[0].response = 'later state must not change visible copy';
    const copies = [];
    let confirm;
    f.clipboard({ writeText: text => { copies.push(text); return new Promise(resolve => { confirm = resolve; }); } });
    f.dom.window.document.execCommand = () => { throw new Error('Unexpected fallback'); };
    f.click();
    assert.deepEqual(copies, [shown]);
    assert.deepEqual(f.notices, []);
    confirm();
    await flush();
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0].type, 'success');
    assert.equal(f.requests(), 0);
  } finally { f.dom.window.close(); }
});

for (const language of ['pl', 'en']) {
  test(`clipboard rejection produces localized error without a second write (${language})`, async () => {
    const f = fixture(language);
    try {
      let fallback = 0;
      f.clipboard({ writeText: async () => { throw new Error('SYNTHETIC_PRIVATE_ERROR'); } });
      f.dom.window.document.execCommand = () => { fallback++; return true; };
      f.click();
      await flush();
      assert.equal(f.notices.length, 1);
      assert.equal(f.notices[0].type, 'error');
      assert.match(f.notices[0].message, language === 'pl' ? /schowka/ : /clipboard/);
      assert.doesNotMatch(f.notices[0].message, /SYNTHETIC_PRIVATE_ERROR/);
      assert.equal(fallback, 0);
      assert.equal(f.requests(), 0);
    } finally { f.dom.window.close(); }
  });
}

for (const outcome of ['true', 'false', 'throw', 'missing']) {
  test(`legacy clipboard ${outcome} only reports success for explicit true`, async () => {
    const f = fixture();
    try {
      f.clipboard(undefined);
      let copies = 0;
      if (outcome !== 'missing') f.dom.window.document.execCommand = operation => {
        copies++;
        assert.equal(operation, 'copy');
        assert.equal(f.output.selectionStart, 0);
        assert.equal(f.output.selectionEnd, f.output.value.length);
        if (outcome === 'throw') throw new Error('SYNTHETIC_PRIVATE_ERROR');
        return outcome === 'true';
      };
      f.click();
      await flush();
      assert.equal(f.notices.length, 1);
      assert.equal(f.notices[0].type, outcome === 'true' ? 'success' : 'error');
      assert.equal(copies, outcome === 'missing' ? 0 : 1);
      assert.equal(f.requests(), 0);
    } finally { f.dom.window.close(); }
  });
}

test('late clipboard confirmation does not announce success in a replacement session', async () => {
  const f = fixture();
  try {
    let confirm;
    f.clipboard({ writeText: () => new Promise(resolve => { confirm = resolve; }) });
    f.click();
    f.card._invalidateSession();
    confirm();
    await flush();
    assert.deepEqual(f.notices, []);
  } finally { f.dom.window.close(); }
});
