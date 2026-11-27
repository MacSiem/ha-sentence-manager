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

test('same non-admin hass restores the card after a temporary missing hass',async()=>{
  const {dom,card,hass}=fixture();let release;
  try {
    hass.user.is_admin=false;card.hass=hass;
    hass.callWS=()=>new Promise(resolve=>{release=resolve;});
    card.hass=null;card.hass=hass;
    assert.ok(card.shadowRoot.querySelector('.card'));
    assert.ok(card.shadowRoot.querySelector('style'));
  } finally {if (release) release([]);await new Promise(resolve=>setImmediate(resolve));card.disconnectedCallback();dom.window.close();}
});

test('disconnect and reconnect restores card styles while invalidating the old read',async()=>{
  const {dom,card,hass}=fixture();let release;let calls=0;
  try {
    hass.callWS=()=>++calls===1?new Promise(resolve=>{release=resolve;}):Promise.resolve([]);
    const stale=card._reloadFromApi();card.disconnectedCallback();card.connectedCallback();card.hass=hass;
    assert.ok(card.shadowRoot.querySelector('.card'));
    assert.ok(card.shadowRoot.querySelector('style'));
    release([{id:'old',intent:'Old',sentences:['private']}]);await stale;
    assert.equal(card.sentences.some(row=>row.trigger==='private'),false);
  } finally {if (release) release([]);await new Promise(resolve=>setImmediate(resolve));card.disconnectedCallback();dom.window.close();}
});

test('first pending list preserves an active editor draft and focus',async()=>{
  const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});let release;
  dom.window.scrollTo=()=>{};dom.window.prompt=()=> 'room';
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const card=dom.window.document.createElement('ha-sentence-manager');card.currentTab='editor';card.setConfig({});dom.window.document.body.append(card);
  const hass={user:{id:'admin',is_admin:true},language:'en',states:{},themes:{},callWS:()=>new Promise(resolve=>{release=resolve;})};
  try {
    card.hass=hass;
    const trigger=card.shadowRoot.querySelector('#trigger-input');trigger.value='switch {room}';trigger.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    card.shadowRoot.querySelector('#intent-input').value='DraftIntent';card.shadowRoot.querySelector('#response-input').value='draft response';
    card.shadowRoot.querySelector('#add-slot-btn').click();card.shadowRoot.querySelector('.slot-input').value='kitchen';
    trigger.focus();trigger.setSelectionRange(2,8,'backward');
    release([{id:'en:Existing',language:'en',intent:'ExistingIntent',sentences:['existing phrase'],revision:'v1'}]);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(card.sentences[0].intent,'ExistingIntent');
    const current=card.shadowRoot.querySelector('#trigger-input');
    assert.equal(current.value,'switch {room}');assert.equal(card.shadowRoot.querySelector('#intent-input').value,'DraftIntent');
    assert.equal(card.shadowRoot.querySelector('#response-input').value,'draft response');assert.equal(card.shadowRoot.querySelector('.slot-input').value,'kitchen');
    assert.equal(card.shadowRoot.activeElement,current);assert.equal(current.selectionStart,2);assert.equal(current.selectionEnd,8);assert.equal(current.selectionDirection,'backward');
  } finally {card.disconnectedCallback();dom.window.close();}
});

test('pending first read cannot restore an editor draft after role or account change',async()=>{
  for (const change of ['role','account']) {
    const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});const releases=[];
    dom.window.scrollTo=()=>{};dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
    const card=dom.window.document.createElement('ha-sentence-manager');card.currentTab='editor';card.setConfig({});dom.window.document.body.append(card);
    const hass={user:{id:'admin',is_admin:true},language:'en',states:{},themes:{},callWS:()=>new Promise(resolve=>releases.push(resolve))};
    try {
      card.hass=hass;card.shadowRoot.querySelector('#trigger-input').value='private draft';
      card.hass={...hass,user:change==='role'?{id:'admin',is_admin:false}:{id:'other',is_admin:true}};
      releases[0]([{id:'old',intent:'Old',sentences:['private row']}]);
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(card.sentences.some(row=>row.trigger==='private row'),false);
      assert.notEqual(card.shadowRoot.querySelector('#trigger-input')?.value,'private draft');
      for (const release of releases.slice(1)) release([]);
      await new Promise(resolve=>setImmediate(resolve));
      assert.notEqual(card.shadowRoot.querySelector('#trigger-input')?.value,'private draft');
    } finally {card.disconnectedCallback();dom.window.close();}
  }
});

async function connectedMoveFixture() {
  const dom=new JSDOM('',{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});dom.window.scrollTo=()=>{};
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const left=dom.window.document.createElement('div'),right=dom.window.document.createElement('section');dom.window.document.body.append(left,right);
  const card=dom.window.document.createElement('ha-sentence-manager');card.currentTab='editor';card.setConfig({});left.append(card);
  const hass={user:{id:'admin',is_admin:true},language:'en',states:{},themes:{},callWS:async()=>[]};card.hass=hass;
  await new Promise(resolve=>setImmediate(resolve));card.shadowRoot.querySelector('#trigger-input').value='private draft';return {dom,left,right,card,hass};
}
test('moving the same connected card preserves hass, styles and draft without reassignment',async()=>{
  const {dom,right,card,hass}=await connectedMoveFixture();
  try {await Promise.resolve().then(()=>right.append(card));await Promise.resolve();assert.equal(card.hass,hass);assert.ok(card.shadowRoot.querySelector('style'));assert.equal(card.shadowRoot.querySelector('#trigger-input').value,'private draft');}
  finally {card.remove();await Promise.resolve();dom.window.close();}
});
test('permanent disconnect invalidates pending read and clears private state',async()=>{
  const {dom,card,hass}=await connectedMoveFixture();let release;
  try {hass.callWS=()=>new Promise(resolve=>{release=resolve;});const read=card._reloadFromApi();card.remove();await Promise.resolve();release([{id:'old',intent:'Old',sentences:['secret']}]);await read;assert.equal(card.hass,null);assert.equal(card.shadowRoot.children.length,0);assert.equal(card.sentences.length,0);}
  finally {dom.window.close();}
});
test('queued save completion cannot start a reload while the card is detached',async()=>{
  const {dom,card,hass}=await connectedMoveFixture();let reloads=0,clears=0;
  try {card.shadowRoot.querySelector('#intent-input').value='QA';hass.callWS=()=>dom.window.Promise.resolve({ok:true});card._reloadFromApi=async()=>{reloads++;};card._apiReload=async()=>{reloads++;};const clear=card.clearForm.bind(card);card.clearForm=()=>{clears++;clear();};const save=card.saveSentence();await Promise.resolve();card.remove();await save;await Promise.resolve();assert.equal(reloads,0);assert.equal(clears,0);assert.equal(card.hass,null);}
  finally {dom.window.close();}
});
test('identity or role change after a move clears the private draft',async()=>{
  for(const change of ['account','role']) {const {dom,right,card,hass}=await connectedMoveFixture();try {right.append(card);card.hass={...hass,user:change==='role'?{id:'admin',is_admin:false}:{id:'other',is_admin:true}};assert.notEqual(card.shadowRoot.querySelector('#trigger-input')?.value,'private draft');await Promise.resolve();assert.notEqual(card.shadowRoot.querySelector('#trigger-input')?.value,'private draft');}finally{card.remove();await Promise.resolve();dom.window.close();}}
});

test('pending list survives a synchronous move and retains the draft',async()=>{
  const {dom,right,card,hass}=await connectedMoveFixture();let release;
  try {hass.callWS=()=>new Promise(resolve=>{release=resolve;});const read=card._reloadFromApi({preserveDrafts:true});right.append(card);release([{id:'ok',intent:'QA',sentences:['stored']}]);await read;await Promise.resolve();assert.equal(card.sentences[0].trigger,'stored');assert.equal(card.shadowRoot.querySelector('#trigger-input').value,'private draft');}
  finally {card.remove();await Promise.resolve();dom.window.close();}
});
