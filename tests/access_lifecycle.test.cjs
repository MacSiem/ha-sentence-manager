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

test('role change retries a pending first list rather than keeping an empty loaded state',async()=>{
  const {dom,card,hass}=fixture();let release;let calls=0;
  const rows=[{id:'en:QA:new',intent:'QA',language:'en',sentences:['saved phrase'],revision:'new'}];
  try {
    hass.callWS=()=>{calls++;return calls===1?new Promise(resolve=>release=resolve):Promise.resolve(rows);};
    const old=card._reloadFromApi();hass.user.is_admin=false;card.hass=hass;
    release(rows);await old;await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,2);assert.equal(card.sentences[0]?.trigger,'saved phrase');
  } finally {card.disconnectedCallback();dom.window.close();}
});

test('prototype-like intent names are ordinary rows in both grouped views',async()=>{
  const {dom,card,hass}=fixture();
  try {
    const rows=['constructor','toString','__proto__'].map(intent=>({intent,sentences:['qa '+intent],slots:{}}));
    hass.callWS=async()=>rows;await card._loadHaSentences();
    assert.equal(card._haSentencesError,null);assert.equal(Object.keys(card._haSentences.intents).length,3);
    card.sentences=rows;assert.equal(card.groupBySentenceIntent().length,3);
  } finally {card.disconnectedCallback();dom.window.close();}
});

test('save completion after disconnect cannot append a stale success notice',async()=>{
  const {dom,card}=fixture();let release;const notices=[];
  try {
    card.shadowRoot.querySelector('#trigger-input').value='QA';card.shadowRoot.querySelector('#intent-input').value='QA';
    card._apiCreate=async()=>({id:'qa'});card._reloadFromApi=async()=>{};
    card._apiReload=()=>new Promise(resolve=>release=resolve);card.showNotification=(...args)=>notices.push(args);
    const save=card.saveSentence();await new Promise(resolve=>setImmediate(resolve));
    card.disconnectedCallback();release();await save;
    assert.equal(notices.length,0);assert.equal(card.shadowRoot.children.length,0);
  } finally {dom.window.close();}
});
