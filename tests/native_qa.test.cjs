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

test('failed first list renders an explicit error and read-only retry restores real rows',async()=>{
 const {dom,card,hass}=fixture();
 try {
  card.currentTab='list';hass.callWS=async()=>{throw new Error('QA read unavailable');};
  await card._reloadFromApi();
  assert.match(card.shadowRoot.querySelector('[role="alert"]')?.textContent || '',/QA read unavailable/);
  assert.doesNotMatch(card.shadowRoot.textContent,/No sentences yet/);
  card.shadowRoot.querySelector('[data-tab="editor"]').click();
  card.shadowRoot.querySelector('[data-tab="list"]').click();
  const retry=card.shadowRoot.querySelector('#retry-sentences-btn');assert.ok(retry);
  let requests=[];hass.callWS=async(msg)=>{requests.push(msg.type);return [{id:'en:QA:id',language:'en',intent:'QA',sentences:['QA restored phrase'],slots:{},response:'Synthetic restored',revision:'revision'}];};
  retry.click();await new Promise(r=>setImmediate(r));
  assert.equal(card._apiError,null);assert.match(card.shadowRoot.textContent,/QA restored phrase/);
  assert.equal(card.shadowRoot.querySelector('[role="alert"]'),null);
  assert.equal(requests.length,2);assert.ok(requests.every(x=>x==='ha_sentence_manager/list'));
 } finally {dom.window.close();}
});
test('search filters phrase, intent and response without changing persisted rows and keeps filtering on locale change',()=>{
 const {dom,card,hass}=fixture();
 try {
  card.currentTab='list';card.sentences=[{id:'one',trigger:'QA żółć',intent:'Kitchen',response:'Synthetic first',slots:{}},{id:'two',trigger:'Different phrase',intent:'Bedroom',response:'Synthetic other',slots:{}}];card.render();
  function search(q){const f=card.shadowRoot.querySelector('#search-input');f.value=q;f.dispatchEvent(new dom.window.Event('input',{bubbles:true}));return [...card.shadowRoot.querySelectorAll('.sentence-item')].filter(x=>!x.hidden&&x.style.display!=='none').map(x=>x.textContent);}
  assert.equal(search('ŻÓŁĆ').length,1);assert.equal(search('Bedroom').length,1);assert.equal(search('Synthetic other').length,1);
  hass.language='pl';card.hass=hass;
  assert.equal(card.shadowRoot.querySelector('#search-input').value,'Synthetic other');
  assert.equal([...card.shadowRoot.querySelectorAll('.sentence-item')].filter(x=>!x.hidden&&x.style.display!=='none').length,1);
  assert.equal(search('no matching qa').length,0);assert.equal(search('').length,2);assert.equal(card.sentences.length,2);
 } finally {dom.window.close();}
});
test('Assist shows the actual error response speech',async()=>{
 const {dom,card,hass}=fixture();
 try {card.currentTab='test';hass.callWS=async()=>({response:{response_type:'error',speech:{plain:{speech:'No matching intent'}}}});
 await card._testSentenceHA('qa unmatched');assert.match(card.shadowRoot.querySelector('.tryit-speech-error').textContent,/No matching intent/);
 } finally {dom.window.close();}
});
test('revisiting tabs handles each activation once',()=>{
 const {dom,card}=fixture();
 try {let renders=0;const renderList=card.renderList.bind(card);card.renderList=()=>{renders++;return renderList();};
 card.shadowRoot.querySelector('[data-tab="list"]').click();assert.equal(renders,1);
 card.shadowRoot.querySelector('[data-tab="editor"]').click();renders=0;
 card.shadowRoot.querySelector('[data-tab="list"]').click();assert.equal(renders,1);
 } finally {dom.window.close();}
});
