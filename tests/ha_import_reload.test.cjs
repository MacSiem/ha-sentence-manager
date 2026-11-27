const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');

function fixture(lang = 'en') {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://localhost/' });
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8'));
  const card = dom.window.document.createElement('ha-sentence-manager');
  card._hass = { user: { is_admin: true }, config: { language: lang } };
  card._lang = lang;
  card._haSentences = { intents: { QA: ['one', 'two'] } };
  card.sentences = [];
  const notices = [];
  card.showNotification = (...args) => notices.push(args);
  card._reloadFromApi = async () => {};
  return { dom, card, notices };
}

for (const lang of ['en', 'pl']) for (const reload of [true, false]) {
  test(`HA import ${lang}: saved rows and reload ${reload}`, async () => {
    const { dom, card, notices } = fixture(lang);
    try {
      const writes = [];
      card._apiCreate = async payload => writes.push(payload.sentences[0]);
      card._apiReload = async () => reload;
      await card._importHaSentencesToEditor();
      assert.deepEqual(writes, ['one', 'two']);
      assert.match(notices.at(-1)[0], lang === 'pl' ? /2.*(zda|zdania)/i : /2.*sentences/i);
      assert.match(notices.at(-1)[0], reload ? (lang === 'pl' ? /przeładowan.*zakończ/i : /reload.*completed/i) : (lang === 'pl' ? /nie potwierdzono przeładowan/i : /reload.*not confirmed/i));
      assert.equal(notices.at(-1)[1], reload ? 'success' : 'error');
    } finally { dom.window.close(); }
  });
}

test('HA import with zero saved rows cannot report success', async () => {
  const { dom, card, notices } = fixture();
  try {
    card._apiCreate = async () => { throw new Error('failure'); };
    card._apiReload = async () => true;
    await card._importHaSentencesToEditor();
    assert.notEqual(notices.at(-1)[1], 'success');
    assert.match(notices.at(-1)[0], /0.*sentences/i);
  } finally { dom.window.close(); }
});

test('HA import suppresses late reload notification after epoch changes', async () => {
  const { dom, card, notices } = fixture();
  try {
    card._apiCreate = async () => {};
    let finish;
    card._apiReload = () => new Promise(resolve => { finish = resolve; });
    const pending = card._importHaSentencesToEditor();
    while (!finish) await Promise.resolve();
    card._dataEpoch++;
    finish(false);
    await pending;
    assert.equal(notices.length, 0);
  } finally { dom.window.close(); }
});

test('partial import retains confirmed row and reports failed row without retry', async () => {
  const { dom, card, notices } = fixture();
  try {
    const writes = [];
    card._apiCreate = async payload => {
      writes.push(payload.sentences[0]);
      if (payload.sentences[0] === 'two') throw new Error('failure');
    };
    card._apiReload = async () => true;
    await card._importHaSentencesToEditor();
    assert.deepEqual(writes, ['one', 'two']);
    assert.equal(notices.at(-1)[1], 'error');
    assert.match(notices.at(-1)[0], /1 sentences.*reload request completed.*not all sentences/i);
  } finally { dom.window.close(); }
});

test('Assist help does not promise automatic recognition', () => {
  const { dom, card } = fixture();
  try {
    const source = readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8');
    assert.doesNotMatch(source, /After adding custom sentences, HA automatically recognizes them in Assist/);
    assert.doesNotMatch(source, /Po dodaniu custom sentences HA automatycznie rozpoznaje je w Assist/);
    assert.match(source, /check the HA reload result, then test them in Assist/);
  } finally { dom.window.close(); }
});

for (const [label, result, expected] of [
  ['acknowledged', { ok: true }, true],
  ['explicit false', { ok: false }, false],
  ['missing ack', {}, false],
  ['undefined', undefined, false],
  ['null', null, false],
]) test(`reload requires explicit success: ${label}`, async () => {
  const { dom, card } = fixture();
  try {
    card._hass.callWS = async request => {
      assert.equal(request.type, 'ha_sentence_manager/reload');
      return result;
    };
    assert.equal(await card._apiReload(), expected);
  } finally { dom.window.close(); }
});

test('reload exception remains unconfirmed', async () => {
  const { dom, card } = fixture();
  try {
    card._hass.callWS = async () => { throw new Error('disconnected'); };
    assert.equal(await card._apiReload(), false);
  } finally { dom.window.close(); }
});
