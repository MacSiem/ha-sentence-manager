'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');
const source = fs.readFileSync(process.env.SENTENCE_REPORT_SOURCE_PATH || 'custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const assist = (status = 'unconfirmed') => ({ status, success: status === 'success', input: 'SYNTHETIC_PRIVATE_PHRASE', response: '', responseType: status === 'success' ? 'action_done' : 'unknown', data: status === 'success' ? { success: [], failed: [] } : null });
async function fixture(language = 'en') {
  const dom = new JSDOM('', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  const { window } = dom;
  const listeners = new Map();
  const connection = {
    connected: true, socket: { readyState: 1 },
    addEventListener: (event, handler) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(handler); },
    removeEventListener: (event, handler) => listeners.get(event)?.delete(handler),
  };
  const emit = event => { for (const handler of [...(listeners.get(event) || [])]) handler(); };
  const requests = [], downloads = [], blobs = new Map();
  window.URL.createObjectURL = blob => { const url = 'blob:synthetic-' + blobs.size; blobs.set(url, blob); return url; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ filename: this.download, blob: blobs.get(this.href) }); };
  window.eval(source);
  const card = window.document.createElement('ha-sentence-manager');
  card.currentTab = 'export';
  window.document.body.append(card);
  const stored = [];
  const hass = { language, user: { id: 'synthetic-account', is_admin: true }, connection, themes: {}, config: { language: 'en' }, callWS: async request => {
    requests.push(request);
    if (request.type === 'ha_sentence_manager/list') return stored;
    if (request.type === 'ha_sentence_manager/reload') return {};
    if (request.type === 'ha_sentence_manager/create') {
      if (request.sentences[0] === 'synthetic rejected') { const error = new Error('SYNTHETIC_PRIVATE_ERROR'); error.code = 'invalid_payload'; throw error; }
      const row = { id: 'synthetic-' + stored.length, ...request }; stored.push(row); return row;
    }
    if (request.type === 'conversation/process') return null;
    throw new Error('Unexpected request');
  } };
  card.hass = hass;
  await flush();
  const report = () => card.shadowRoot.querySelector('[data-ha-tools-export]')?.shadowRoot;
  const field = name => report()?.querySelector(`[data-export="${name}"]`);
  const event = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
  const open = async () => { card.shadowRoot.querySelector('#download-sentence-report-btn').click(); await flush(); };
  const refresh = async () => { field('refresh').click(); await flush(); };
  const seed = () => { card._testResultHA = assist(); card.render(); };
  const readBlob = blob => new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob); });
  const close = () => { card.remove(); window.close(); };
  return { dom, window, card, hass, connection, emit, listeners, requests, downloads, open, refresh, field, event, seed, report, readBlob, close };
}

test('reviewed UI/export factories have exact source/runtime provenance in the sole served entrypoint', () => {
  const provenance = JSON.parse(fs.readFileSync('shared/diagnostic-export-provenance.json', 'utf8'));
  for (const [label, file, transform] of [
    ['HA TOOLS UI V3', 'shared/ha-tools-ui.js', text => text.split('// Node tests use the canonical factory;')[0].trimEnd()],
    ['HA TOOLS EXPORT V3', 'shared/ha-tools-export.js', text => text.replace('export function createExportDialog', 'function createExportDialog').trimEnd()],
  ]) {
    const raw = fs.readFileSync(file, 'utf8'), runtime = transform(raw);
    assert.equal(hash(raw), provenance.files[file].sourceSha256);
    assert.equal(hash(runtime), provenance.files[file].runtimeSha256);
    assert.ok(source.includes(`// BEGIN ${label} source-sha256=${hash(raw)}\n${runtime}\n// END ${label}`));
  }
  assert.equal(source.split('function createExportDialog(').length - 1, 1);
  assert.equal(source.split('function createUiV3(').length - 1, 1);
});

test('no operation result means No data and no downloadable or fabricated report', async () => {
  const f = await fixture();
  try {
    const button = f.card.shadowRoot.querySelector('#download-sentence-report-btn');
    assert.ok(button);
    assert.equal(button.disabled, true);
    assert.match(f.card.shadowRoot.querySelector('#sentence-report-state').textContent, /No data/);
    button.click(); await flush();
    assert.equal(f.report(), undefined);
    assert.deepEqual(f.downloads, []);
  } finally { f.close(); }
});

test('actual import and Assist outcomes create actionable row/reason results without another HA request', async () => {
  const f = await fixture();
  try {
    await f.card.importFromYaml('- trigger: "synthetic accepted"\n  intent: Synthetic\n- trigger: "synthetic rejected"\n  intent: Synthetic');
    await f.card._testSentenceHA('synthetic command');
    const before = f.requests.length;
    await f.open();
    const value = JSON.parse(f.field('preview').textContent);
    assert.equal(value.import.status, 'partial');
    assert.deepEqual(value.import.failed, [{ row: 2, reason: 'invalid_payload' }]);
    assert.equal(value.import.created, 1);
    assert.equal(value.import.attempted, 2);
    assert.equal(value.import.list_unavailable, false);
    assert.equal(value.import.reload_failed, false);
    assert.equal(value.import.parse_status, 'success');
    assert.equal(value.import.list_read_status, 'success');
    assert.equal(value.import.reload_status, 'success');
    assert.equal(value.assist.status, 'unconfirmed');
    assert.equal(value.status, 'unconfirmed');
    assert.notEqual(f.field('status').dataset.resultState, 'success');
    assert.match(f.field('source-limit').textContent, /Unconfirmed/);
    assert.equal(f.requests.length, before);
  } finally { f.close(); }
});

test('all private canaries and unknown free-form codes stay absent with private OFF and ON', async () => {
  const f = await fixture();
  try {
    const canaries = ['SYNTHETIC_TOKEN_123', 'synthetic.user@example.invalid', '198.51.100.44', 'SYNTHETIC_RAW_CONFIG', 'SYNTHETIC_PRIVATE_PHRASE'];
    f.card._importResult = { epoch: f.card._dataEpoch, status: 'error', total: 1, created: 0, failed: [{ row: 1, code: canaries.join(' '), payload: { token: canaries[0], user: canaries[1], address: canaries[2], raw: canaries[3] } }], listUnavailable: false, reloadFailed: true };
    f.card._testResultHA = { ...assist(), input: canaries[4], conversationId: canaries[0], response: canaries[1], responseType: canaries[3], data: { success: [{ name: canaries[1], type: canaries[2] }], failed: [], config: canaries[3] } };
    f.card.config.synthetic_private = canaries[3]; f.hass.user.name = canaries[1];
    f.card.render(); await f.open();
    assert.equal(f.field('private').checked, false);
    const off = f.field('preview').textContent;
    assert.equal(JSON.parse(off).import.failed[0].reason, 'unconfirmed');
    assert.equal(JSON.parse(off).assist.response_type, 'unknown');
    f.field('private').checked = true; f.event(f.field('private'), 'change'); await f.refresh();
    assert.equal(f.field('preview').textContent, off);
    for (const canary of canaries) assert.ok(!off.includes(canary));
    assert.match(f.field('source-limit').textContent, /does not add|never adds/);
    assert.match(f.field('excluded').textContent, /configuration/i);
  } finally { f.close(); }
});

test('parse failure is a real report result and retains the distinct parsing failure flag', async () => {
  const f = await fixture();
  try {
    await f.card.importFromYaml('- trigger: "unterminated');
    await f.open();
    const report = JSON.parse(f.field('preview').textContent);
    assert.equal(report.import.parse_failed, true);
    assert.equal(report.import.status, 'error');
    assert.equal(report.import.parse_status, 'error');
    assert.equal(report.import.list_read_status, 'not_checked');
    assert.equal(report.import.reload_status, 'not_checked');
    assert.equal(report.assist.available, false);
    assert.notEqual(f.field('status').dataset.resultState, 'success');
  } finally { f.close(); }
});

test('list read and reload uncertainty stay separate from confirmed sentence creates', async () => {
  const f = await fixture();
  try {
    f.card._importResult = { epoch: f.card._dataEpoch, status: 'partial', total: 1, created: 1, failed: [], listUnavailable: true, reloadFailed: true };
    f.card.render(); await f.open();
    const value = JSON.parse(f.field('preview').textContent);
    assert.equal(value.import.created, 1);
    assert.equal(value.import.list_unavailable, true);
    assert.equal(value.import.reload_failed, true);
    assert.equal(value.import.list_read_status, 'unconfirmed');
    assert.equal(value.import.reload_status, 'unconfirmed');
    assert.equal(value.import.status, 'partial');
  } finally { f.close(); }
});

test('malformed result shapes cannot create a confirmed report or turn missing data into zeros', async () => {
  const f = await fixture();
  try {
    for (const bad of [{}, { status: 'success' }, [], 'bad']) {
      f.card._importResult = bad; f.card._testResultHA = bad;
      f.card._syncSentenceReportState(); f.card._updateSentenceReportAvailability();
      assert.equal(f.card.shadowRoot.querySelector('#download-sentence-report-btn').disabled, true);
    }
    f.card._importResult = { epoch: f.card._dataEpoch, status: 'success', total: '3', created: 3, failed: [] };
    f.card._testResultHA = assist(); f.card.render(); await f.open();
    const value = JSON.parse(f.field('preview').textContent);
    assert.deepEqual(value.import, { available: false });
    assert.equal(value.assist.status, 'unconfirmed');
    assert.ok(!('created' in value.import));
  } finally { f.close(); }
});

test('inconsistent success with failures is downgraded and never shown as a green report', async () => {
  const f = await fixture();
  try {
    f.card._importResult = { epoch: f.card._dataEpoch, status: 'success', total: 2, created: 1, failed: [{ row: 2, code: 'create_failed' }] };
    f.card.render(); await f.open();
    assert.equal(JSON.parse(f.field('preview').textContent).import.status, 'unconfirmed');
    assert.notEqual(f.field('status').dataset.resultState, 'success');
  } finally { f.close(); }
});

test('Save hands off exactly preview bytes and JSON MIME, with an honest initiated result and no extra API', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open(); const before = f.requests.length;
    const preview = f.field('preview').textContent;
    f.field('save').click(); await flush();
    assert.equal(f.downloads.length, 1);
    assert.equal(f.downloads[0].filename, 'sentence-results.json');
    assert.equal(await f.readBlob(f.downloads[0].blob), preview);
    assert.match(f.downloads[0].blob.type, /application\/json/);
    assert.match(f.field('message').textContent, /initiated/);
    assert.notEqual(f.field('status').dataset.resultState, 'success');
    f.field('save').click(); await flush(); assert.equal(f.downloads.length, 1);
    assert.equal(f.requests.length, before);
  } finally { f.close(); }
});

test('invalid filenames, wrong extension and unoffered format block Save until explicitly refreshed', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open();
    for (const name of ['../secret.json', 'report.txt', 'CON.json', ' report.json']) {
      f.field('filename').value = name; f.event(f.field('filename'), 'input'); await f.refresh();
      assert.equal(f.field('save').disabled, true); f.field('save').click();
    }
    f.field('filename').value = 'reviewed.json'; f.event(f.field('filename'), 'input');
    const option = f.window.document.createElement('option'); option.value = 'yaml'; f.field('format').append(option); f.field('format').value = 'yaml';
    f.event(f.field('format'), 'change'); await f.refresh(); assert.equal(f.field('save').disabled, true);
    f.field('format').value = 'json'; f.event(f.field('format'), 'change'); await f.refresh(); assert.equal(f.field('save').disabled, false);
    assert.deepEqual(f.downloads, []);
  } finally { f.close(); }
});

test('repaint keeps the same dialog, filename draft, focused input and caret', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open(); const root = f.report(), filename = f.field('filename');
    filename.value = 'my-results.json'; f.event(filename, 'input'); filename.focus(); filename.setSelectionRange(3, 8);
    f.card.config.title = 'Repaint'; f.card.render();
    assert.equal(f.report(), root); assert.equal(f.field('filename'), filename); assert.equal(root.activeElement, filename);
    assert.equal(filename.value, 'my-results.json'); assert.equal(filename.selectionStart, 3); assert.equal(filename.selectionEnd, 8);
    assert.equal(f.field('save').disabled, true);
    f.field('cancel').click();
    assert.equal(f.card.shadowRoot.activeElement?.id, 'download-sentence-report-btn');
  } finally { f.close(); }
});

test('locale rebuild preserves filename/focus/caret while dropping bytes and private consent', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open();
    f.field('filename').value = 'my-results.json'; f.event(f.field('filename'), 'input');
    f.field('private').checked = true; f.event(f.field('private'), 'change'); await f.refresh();
    f.field('filename').focus(); f.field('filename').setSelectionRange(2, 7);
    f.card.hass = { ...f.hass, language: 'pl' }; await flush();
    assert.equal(f.field('filename').value, 'my-results.json');
    assert.equal(f.report().activeElement, f.field('filename'));
    assert.equal(f.field('filename').selectionStart, 2); assert.equal(f.field('filename').selectionEnd, 7);
    assert.equal(f.field('private').checked, false); assert.equal(f.field('preview').textContent, ''); assert.equal(f.field('save').disabled, true);
    assert.equal(f.field('save').textContent, 'Zapisz');
    await f.refresh(); assert.match(f.field('source-limit').textContent, /sesji/);
  } finally { f.close(); }
});

for (const change of ['account', 'role', 'connection', 'offline', 'result']) {
  test(`${change} invalidates already reviewed bytes before Save`, async () => {
    const f = await fixture();
    try {
      f.seed(); await f.open();
      const save = f.field('save');
      if (change === 'account') f.card.hass = { ...f.hass, user: { id: 'replacement', is_admin: true } };
      if (change === 'role') f.card.hass = { ...f.hass, user: { ...f.hass.user, is_admin: false } };
      if (change === 'connection') f.card.hass = { ...f.hass, connection: { ...f.connection, socket: { readyState: 1 } } };
      if (change === 'offline') { f.connection.connected = false; f.connection.socket.readyState = 3; }
      if (change === 'result') f.card._testResultHA = assist('success');
      save.click(); await flush();
      assert.deepEqual(f.downloads, []);
      assert.equal(f.field('preview').textContent, '');
      assert.equal(f.field('save').disabled, true);
    } finally { f.close(); }
  });
}

test('loss of admin removes past import results and reconnect does not resurrect the old report', async () => {
  const f = await fixture();
  try {
    await f.card.importFromYaml('- trigger: "synthetic rejected"\n  intent: Synthetic'); await f.open();
    f.card.hass = { ...f.hass, user: { ...f.hass.user, is_admin: false } }; await flush();
    assert.equal(f.card._importResult, null); assert.equal(f.field('preview').textContent, '');
    await f.refresh(); assert.equal(f.field('save').disabled, true);
    f.card.hass = f.hass; await flush(); await f.refresh(); assert.equal(f.field('save').disabled, true);
  } finally { f.close(); }
});

test('transport disconnect event invalidates immediately and pending Assist cannot resurrect after reconnect', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open();
    let finish;
    f.card._hass.callWS = request => { f.requests.push(request); return new Promise(resolve => { finish = resolve; }); };
    const operation = f.card._testSentenceHA('synthetic pending');
    assert.equal(f.field('preview').textContent, '');
    f.emit('disconnected'); f.emit('ready');
    finish({ response: { response_type: 'action_done', data: { success: [], failed: [] } } }); await operation;
    assert.equal(f.card._testResultHA, null); await f.refresh(); assert.equal(f.field('save').disabled, true);
  } finally { f.close(); }
});

test('late preview is ignored when the result changes while bytes are pending', async () => {
  const f = await fixture();
  try {
    f.seed(); const original = f.card._buildSentenceReportPayload.bind(f.card); let finish;
    f.card._buildSentenceReportPayload = args => { const payload = original(args); return new Promise(resolve => { finish = () => resolve(payload); }); };
    await f.open(); f.card._testResultHA = assist('success'); f.card.render(); finish(); await flush();
    assert.equal(f.field('preview').textContent, ''); assert.equal(f.field('save').disabled, true);
  } finally { f.close(); }
});

test('a connection replacement fences a pending import before another create or reload', async () => {
  const f = await fixture();
  try {
    let finish, creates = 0, reloads = 0;
    f.card._apiCreate = () => { creates++; return new Promise(resolve => { finish = resolve; }); };
    f.card._apiReload = async () => { reloads++; return true; };
    const operation = f.card.importFromYaml('- trigger: "synthetic one"\n  intent: Synthetic\n- trigger: "synthetic two"\n  intent: Synthetic');
    assert.equal(creates, 1);
    assert.equal(f.card.shadowRoot.querySelector('#download-sentence-report-btn').disabled, true);
    f.card.hass = { ...f.hass, connection: { ...f.connection, socket: { readyState: 1 } } };
    finish({ id: 'synthetic-stale-result' }); await operation;
    assert.equal(creates, 1); assert.equal(reloads, 0); assert.equal(f.card._importResult, null);
    assert.equal(f.card.shadowRoot.querySelector('#download-sentence-report-btn').disabled, true);
  } finally { f.close(); }
});

test('pending download remains latched across cancel/reopen and locale change', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open(); let finish, calls = 0;
    f.card._performSentenceReportDownload = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    f.field('save').click(); f.field('cancel').click(); await f.open();
    f.card.hass = { ...f.hass, language: 'pl' }; await flush();
    assert.equal(f.field('save').disabled, true); assert.equal(f.field('refresh').disabled, true);
    f.field('save').click(); assert.equal(calls, 1);
    finish({ outcome: 'unknown' }); await flush(); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(calls, 1); assert.equal(f.field('save').disabled, true);
    assert.equal(f.field('preview').textContent, '');
  } finally { f.close(); }
});

test('Escape restores report opener focus; detach removes dialog and transport listeners', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open();
    f.window.document.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(f.report(), undefined);
    assert.equal(f.card.shadowRoot.activeElement?.id, 'download-sentence-report-btn');
    await f.open(); f.card.remove();
    assert.equal(f.report(), undefined);
    for (const handlers of f.listeners.values()) assert.equal(handlers.size, 0);
    assert.deepEqual(f.downloads, []);
  } finally { f.close(); }
});

// Owner supplement after reviewing the child's runtime source; not child tests-first evidence.
test('an open report follows theme changes without replacing its draft, preview or focused field', async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open();
    const root = f.report(), filename = f.field('filename'), preview = f.field('preview').textContent;
    filename.value = 'wyniki-żółć.json'; filename.focus(); filename.setSelectionRange(1, 3);
    f.card.hass = { ...f.hass, themes: { darkMode: true } };
    assert.equal(root.host.classList.contains('bento-dark'), true);
    assert.equal(f.report(), root); assert.equal(f.field('filename'), filename);
    assert.equal(root.activeElement, filename); assert.equal(filename.selectionStart, 1); assert.equal(filename.selectionEnd, 3);
    assert.equal(filename.value, 'wyniki-żółć.json'); assert.equal(f.field('preview').textContent, preview);
    f.card.hass = { ...f.hass, themes: { darkMode: false } };
    assert.equal(root.host.classList.contains('bento-dark'), false);
    assert.equal(f.report(), root); assert.equal(root.activeElement, filename);
  } finally { f.close(); }
});

for (const change of ['browser-offline', 'inactive-user']) test(`${change} consumes preview and prevents Save even with a connected socket`, async () => {
  const f = await fixture();
  try {
    f.seed(); await f.open(); const save = f.field('save');
    if (change === 'browser-offline') Object.defineProperty(f.window.navigator, 'onLine', { configurable: true, value: false });
    else { f.hass.user.is_active = false; f.card.hass = f.hass; }
    save.click(); await flush();
    assert.equal(f.downloads.length, 0); assert.equal(f.field('preview').textContent, '');
    assert.equal(f.field('save').disabled, true);
  } finally { f.close(); }
});
for (const change of ['browser-roundtrip', 'command-language']) test(`${change} rejects the pending Assist outcome`, async () => {
  const f = await fixture();
  try {
    let finish;
    f.hass.callWS = () => new Promise(resolve => { finish = resolve; });
    const pending = f.card._testSentenceHA('synthetic pending');
    if (change === 'browser-roundtrip') { f.window.dispatchEvent(new f.window.Event('offline')); f.window.dispatchEvent(new f.window.Event('online')); }
    else f.card.setConfig({ ...f.card.config, language: 'pl' });
    finish({ response: { response_type: 'action_done', data: { success: [], failed: [] } } }); await pending;
    assert.equal(f.card._testResultHA, null); assert.equal(f.card._testLoading, false);
    assert.equal(f.card.shadowRoot.querySelector('#download-sentence-report-btn').disabled, true);
  } finally { f.close(); }
});
