'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const source = fs.readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js', 'utf8');
const validResponse = (type = 'action_done', failed = []) => ({ conversation_id: 'synthetic-response', response: { response_type: type, language: 'en', speech: { plain: { speech: 'Synthetic response' } }, data: { success: [{ name: 'Synthetic target', type: 'custom' }], failed } } });
function fixture(callWS) {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  dom.window.eval(source);
  const card = dom.window.document.createElement('ha-sentence-manager');
  card._hass = { user: { id: 'synthetic-admin', is_admin: true }, config: { language: 'en' }, callWS };
  card._lang = 'en'; card.currentTab = 'test';
  return { dom, card };
}
for (const [label, response] of [
  ['null', null], ['empty object', {}], ['missing response', { conversation_id: 'synthetic' }],
  ['invalid response type', { response: { response_type: 'unexpected' } }],
  ['typed but malformed action', { response: { response_type: 'action_done', data: {} } }],
]) {
  test(`Assist ${label} is visibly unconfirmed, never a successful match`, async () => {
    let calls = 0; const { dom, card } = fixture(async () => { calls++; return response; });
    try {
      await card._testSentenceHA('synthetic command');
      assert.equal(card._testResultHA.success, false);
      assert.equal(card._testResultHA.status, 'unconfirmed');
      assert.match(card.renderTest(), /Unconfirmed/);
      assert.doesNotMatch(card.renderTest(), /badge-success/);
      assert.equal(card.shadowRoot.querySelector('#test-input').value, 'synthetic command');
      assert.equal(calls, 1, 'no automatic retry');
    } finally { dom.window.close(); }
  });
}
for (const type of ['action_done', 'query_answer']) {
  test(`valid ${type} response is success`, async () => {
    const { dom, card } = fixture(async () => validResponse(type));
    try { await card._testSentenceHA('synthetic command'); assert.equal(card._testResultHA.status, 'success'); assert.equal(card._testResultHA.success, true); }
    finally { dom.window.close(); }
  });
}
test('known Assist error is error, with the command preserved', async () => {
  const { dom, card } = fixture(async () => ({ response: { response_type: 'error', data: { code: 'no_intent_match' }, speech: { plain: { speech: 'No match' } } } }));
  try { await card._testSentenceHA('synthetic command'); assert.equal(card._testResultHA.status, 'error'); assert.equal(card._testResultHA.success, false); assert.match(card.renderTest(), /Error/); }
  finally { dom.window.close(); }
});
test('mixed action outcomes are partial, not complete success', async () => {
  const { dom, card } = fixture(async () => validResponse('action_done', [{ name: 'Synthetic failed target', type: 'custom' }]));
  try { await card._testSentenceHA('synthetic command'); assert.equal(card._testResultHA.status, 'partial'); assert.equal(card._testResultHA.success, false); assert.match(card.renderTest(), /Partial/); }
  finally { dom.window.close(); }
});
test('a conscious retry warns, supports cancel, and sends only after confirmation', async () => {
  let calls=0; const {dom,card}=fixture(async()=>{calls++;return null;});
  try {
    await card._testSentenceHA('synthetic command');
    dom.window.confirm=warning=>{assert.match(warning,/already|repeat/i);return false;};
    assert.equal(typeof card.retryTestSentenceHA,'function');
    await card.retryTestSentenceHA();assert.equal(calls,1);
    dom.window.confirm=()=>true;await card.retryTestSentenceHA();assert.equal(calls,2);
  } finally {dom.window.close();}
});
test('partial YAML import lists failed row and retries it without duplicating successful rows', async () => {
  const stored=[];let failedOnce=false;
  const {dom,card}=fixture(async msg=>{
    if(msg.type==='ha_sentence_manager/list')return stored;
    if(msg.type==='ha_sentence_manager/reload')return {};
    assert.equal(msg.type,'ha_sentence_manager/create');
    if(msg.sentences[0]==='synthetic two'&&!failedOnce){failedOnce=true;const error=new Error('private raw payload');error.code='invalid_payload';throw error;}
    stored.push({id:'synthetic-'+stored.length,...msg});return stored.at(-1);
  });
  try {
    card.currentTab='export';
    await card.importFromYaml('custom_sentences:\n  - trigger: "synthetic one"\n    intent: Synthetic\n  - trigger: "synthetic two"\n    intent: Synthetic\n  - trigger: "synthetic three"\n    intent: Synthetic\n');
    assert.equal(stored.length,2);assert.equal(card._importResult?.status,'partial');
    assert.equal(card._importResult.created,2);assert.equal(card._importResult.failed.length,1);
    assert.equal(card._importResult.failed[0].row,2);assert.match(card.renderExport(),/Partial/);
    assert.doesNotMatch(card.renderExport(),/private raw payload/);
    await card.retryImportFailed();assert.equal(stored.length,3);
    assert.equal(new Set(stored.map(r=>r.sentences[0])).size,3);
    assert.equal(card._importResult.status,'success');assert.equal(card._importResult.failed.length,0);
  } finally {dom.window.close();}
});
test('role loss drops the import retry queue before any further write', async () => {
  let writes=0;const {dom,card}=fixture(async msg=>{
    if(msg.type==='ha_sentence_manager/create'){writes++;const e=new Error('bad payload');e.code='invalid_payload';throw e;}
    if(msg.type==='ha_sentence_manager/list')return [];return {};
  });
  try {
    await card.importFromYaml('- trigger: "synthetic one"\n  intent: Synthetic');
    assert.equal(card._importResult?.status,'error');
    card._hass.user.is_admin=false;card._invalidateSession(true);
    await card.retryImportFailed();assert.equal(writes,1);assert.equal(card._importResult,null);
  } finally {dom.window.close();}
});
