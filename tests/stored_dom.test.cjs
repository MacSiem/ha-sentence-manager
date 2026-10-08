const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const repo=process.env.SENTENCE_QA_REPO || resolve(__dirname,'..');
const {JSDOM}=require(resolve(repo,'node_modules/jsdom'));
const payload='</textarea><img src=x onerror="window.__sentenceQA=1"> &lt;/textarea&gt; "quoted" żółć';
function fixture(){
 const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
 dom.window.scrollTo=()=>{};dom.window.eval(readFileSync(resolve(repo,'custom_components/ha_sentence_manager/www/ha-sentence-manager.js'),'utf8'));
 const card=dom.window.document.createElement('ha-sentence-manager');card.config={};card._sentencesLoaded=true;card._firstHassRender=true;card._sentenceAdmin=true;card._lang='en';
 card._hass={user:{id:'qa',is_admin:true},language:'en',states:{},themes:{},callWS:async()=>[]};
 return {dom,card};
}
function safe(dom,card){
 assert.equal(card.shadowRoot.querySelectorAll('img,script,iframe,svg,object').length,0);
 for(const el of card.shadowRoot.querySelectorAll('*'))for(const attr of el.attributes)assert.ok(!/^on/i.test(attr.name),`untrusted handler ${attr.name}`);
 assert.equal(dom.window.__sentenceQA,undefined);
}
test('fallback language displays special characters once at the DOM text boundary',()=>{
 const {dom,card}=fixture();try{
  const language=`pl & <tag> "quoted" 'apostrophe'`;
  card.config={language};card.currentTab='ha-sentences';card._haSentences={intents:{QA:['safe']},lists:{}};card.render();
  assert.ok(card.shadowRoot.querySelector('.ha-sentences-summary p').textContent.includes(language));safe(dom,card);
 }finally{dom.window.close();}
});
test('language text, YAML placeholder and source metadata remain literal without active markup',()=>{
 const {dom,card}=fixture();try{
  card.config={language:payload};card.currentTab='ha-sentences';card._haSentences={language:payload,_sourceFile:[payload],intents:{[payload]:[payload]},lists:{}};card.render();
  assert.ok(card.shadowRoot.querySelector('.ha-sentences-summary p').textContent.includes(payload));
  assert.equal(card.shadowRoot.querySelector('[data-intent-body]').getAttribute('data-intent-body'),payload);safe(dom,card);
  card._haSentences=null;card.render();
  assert.ok(card.shadowRoot.querySelector('#ha-yaml-paste').placeholder.includes(payload));safe(dom,card);
 }finally{dom.window.close();}
});
test('stored API row survives actual list, edit and export DOM including encoded textarea terminator',async()=>{
 const {dom,card}=fixture();try{
  const row=process.env.SENTENCE_STORAGE_QA_ROW ? JSON.parse(readFileSync(process.env.SENTENCE_STORAGE_QA_ROW,'utf8')) : {id:'en:QA:id',language:'en',intent:payload,sentences:[payload],slots:{'<key>':'"<&>'},response:payload,revision:'qa'};
  const requests=[];card._hass.callWS=async msg=>{requests.push(msg.type);return [row]};card.currentTab='list';await card._reloadFromApi();
  assert.equal(card.sentences[0].trigger,row.sentences[0]);assert.ok(card.shadowRoot.textContent.includes(row.sentences[0]));safe(dom,card);
  card.currentTab='export';card.render();const area=card.shadowRoot.querySelector('#yaml-output');
  assert.equal(area.value,card.exportAsYaml());assert.ok(area.value.includes('&lt;/textarea&gt;'));assert.equal(card.shadowRoot.querySelectorAll('#yaml-output').length,1);safe(dom,card);
  card.currentTab='editor';card.render();card.editSentence(0);
  assert.equal(card.shadowRoot.querySelector('#trigger-input').value,row.sentences[0]);assert.equal(card.shadowRoot.querySelector('#response-input').value,row.response);safe(dom,card);
  assert.ok(requests.every(type=>type==='ha_sentence_manager/list'));
 }finally{dom.window.close();}
});
