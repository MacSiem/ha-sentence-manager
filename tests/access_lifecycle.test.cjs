const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM} = require('jsdom');

function fixture() {
  const dom = new JSDOM('', {runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
  dom.window.scrollTo=()=>{};
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const card=dom.window.document.createElement('ha-sentence-manager');
  card.config={};card._sentencesLoaded=true;card._firstHassRender=true;
  card._sentenceAdmin=true;card._lang='en';
  const hass={user:{id:'admin',is_admin:true},language:'en',states:{},themes:{},callWS:async()=>[]};
  card._hass=hass;card.currentTab='editor';card.render();
  return {dom,card,hass};
}

test('mutable role loss clears the old editing identity before admin returns',()=>{
  const {dom,card,hass}=fixture();
  try {
    card.editingId='en:QA:old';card.editingIndex=0;
    card.shadowRoot.querySelector('#trigger-input').value='private draft';
    hass.user.is_admin=false;card.hass=hass;
    assert.equal(card.editingId,null);
    assert.equal(card.shadowRoot.querySelector('#trigger-input'),null);
    hass.user.is_admin=true;card.hass=hass;
    assert.equal(card.shadowRoot.querySelector('#trigger-input').value,'');
  } finally {dom.window.close();}
});

test('late sentence read cannot restore stale content after disconnect',async()=>{
  const {dom,card,hass}=fixture();let release;
  try {
    hass.callWS=()=>new Promise(resolve=>{release=resolve;});
    const read=card._reloadFromApi();card.disconnectedCallback();
    release([{id:'en:QA:old',language:'en',intent:'QA',sentences:['old account'],revision:'old'}]);
    await read;
    assert.equal(card.sentences.length,0);
    assert.equal(card.hass,null);
  } finally {dom.window.close();}
});

test('failed HA sentence read shows an error, then a successful retry clears it',async()=>{
  const {dom,card,hass}=fixture();
  try {
    hass.callWS=async()=>{throw new Error('QA backend unavailable');};
    await card._loadHaSentences();
    assert.match(card._haSentencesError || '',/QA backend unavailable/);
    hass.callWS=async()=>[];
    await card._loadHaSentences();
    assert.equal(card._haSentencesError,null);
    assert.equal(card._apiError,null);
  } finally {dom.window.close();}
});

test('Assist error response is displayed as a failed test',async()=>{
  const {dom,card,hass}=fixture();
  try {
    hass.callWS=async()=>({response:{response_type:'error',speech:{plain:{speech:'No matching intent'}},data:{code:'no_intent_match'}}});
    await card._testSentenceHA('qa unmatched phrase');
    assert.equal(card._testResultHA.success,false);
    assert.equal(card._testResultHA.responseType,'error');
  } finally {dom.window.close();}
});
