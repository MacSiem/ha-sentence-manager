// Written before the matching presentation implementation; execute only through owner FIFO.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const source = "custom_components/ha_sentence_manager/www/ha-sentence-manager.js";
const tag = "ha-sentence-manager";
const stateKey = "currentTab";
async function fixture() {
  const dom = new JSDOM('', {runScripts:'dangerously', pretendToBeVisual:true,
    url:'http://synthetic.invalid/', virtualConsole:new VirtualConsole()});
  const observers = [];
  dom.window.ResizeObserver = class {
    constructor(callback) {this.callback=callback;this.targets=new Set();observers.push(this);}
    observe(target) {this.targets.add(target);}
    disconnect() {this.targets.clear();}
  };
  dom.window.eval(readFileSync(source,'utf8'));
  const card=dom.window.document.createElement(tag);
  card[stateKey]="editor";
  card.getBoundingClientRect=()=>({width:900,height:600});
  card.setConfig({show_support:false, unknown_setting:{keep:'synthetic'}});
  dom.window.document.body.append(card);
  const requests=[];
  const hass={language:'en',user:{id:'synthetic-admin',is_admin:true},themes:{},states:{},
    config:{components:[],language:'en',version:'2026.9.4'},
    callWS:async message=>{requests.push(message);if(tag==='ha-sentence-manager')return [];
      if(message.type==='config_entries/get')return [];throw Error('Synthetic unavailable');},
    callApi:async (...args)=>{requests.push(args);throw Error('Synthetic unavailable');}};
  card.hass=hass;
  for(let i=0;i<80&&(card._loading||i<3);i++)await new Promise(resolve=>setImmediate(resolve));
  const resize=width=>{const observer=observers.find(o=>o.targets.has(card));assert.ok(observer,'host observer exists');
    observer.callback([{target:card,contentRect:{width}}]);};
  return {dom,card,hass,requests,resize,observers};
}
const picker = card=>card.shadowRoot.getElementById('ha-tools-tab-picker');
const buttons = card=>[...card.shadowRoot.querySelectorAll('.tabs [data-tab]')];
const choose=(f,value)=>{const input=picker(f.card);assert.ok(input,'narrow navigation exists');input.value=value;
  input.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));};

test('picker names and navigation match every current native navigation button',async()=>{
  const f=await fixture();try{
    const input=picker(f.card);assert.ok(input);
    assert.deepEqual([...input.options].map(o=>o.value),buttons(f.card).map(b=>b.dataset.tab));
    assert.deepEqual([...input.options].map(o=>o.textContent),buttons(f.card).map(b=>b.getAttribute('aria-label')||b.textContent.trim()));
    assert.equal(input.value,f.card[stateKey]);
    const reads=f.requests.length;choose(f,"list");
    assert.equal(f.card[stateKey],"list");assert.equal(picker(f.card),input);
    assert.equal(buttons(f.card).find(b=>b.dataset.tab==="list").classList.contains('active'),true);
    const hash=f.dom.window.location.hash;
    const content=f.card.shadowRoot.querySelector('#content,#tab-content,.tab-content').textContent;
    buttons(f.card).find(b=>b.dataset.tab==="editor").click();
    buttons(f.card).find(b=>b.dataset.tab==="list").click();
    assert.equal(input.value,"list");assert.equal(f.dom.window.location.hash,hash);
    assert.equal(f.card.shadowRoot.querySelector('#content,#tab-content,.tab-content').textContent,content);
    assert.equal(f.requests.length,reads,'presentation and passive tabs do not call APIs');
  }finally{f.dom.window.close();}
});

test('unknown picker option cannot navigate or issue requests',async()=>{
  const f=await fixture();try{
    const input=picker(f.card);assert.ok(input);const reads=f.requests.length;
    const foreign=f.dom.window.document.createElement('option');foreign.value='unauthorized-tab';foreign.textContent='Unknown';input.append(foreign);
    choose(f,foreign.value);assert.equal(f.card[stateKey],"editor");assert.equal(f.requests.length,reads);
    assert.equal(input.value,"editor");
  }finally{f.dom.window.close();}
});

test('ordinary locale and configuration changes keep active navigation, focus and unknown configuration',async()=>{
  const f=await fixture();try{
    const reads=f.requests.length;choose(f,"list");f.resize(260);picker(f.card).focus();
    f.card.hass={...f.hass,language:'pl'};
    const translated=picker(f.card);assert.ok(translated);assert.equal(translated.value,"list");
    assert.equal(f.card.shadowRoot.activeElement,translated);
    assert.equal(translated.labels[0].textContent.trim(),'Zakładka');
    assert.deepEqual([...translated.options].map(o=>o.textContent),buttons(f.card).map(b=>b.getAttribute('aria-label')||b.textContent.trim()));
    const options=[...translated.options].map(o=>o.textContent);
    f.card.hass={...f.hass,language:'en'};assert.equal(picker(f.card).labels[0].textContent.trim(),'Tab');
    assert.notDeepEqual([...picker(f.card).options].map(o=>o.textContent),options);
    f.card.setConfig({show_support:false,title:'Synthetic revised',unknown_setting:{keep:'synthetic'}});
    assert.equal(picker(f.card).value,"list");
    assert.equal(f.card["config"].unknown_setting.keep,'synthetic');assert.equal(f.requests.length,reads);
  }finally{f.dom.window.close();}
});

test('host width switches transfer navigation focus while preserving editor DOM and caret',async()=>{
  const f=await fixture();try{
    const reads=f.requests.length,nav=f.card.shadowRoot.querySelector('.tabs'),input=picker(f.card);
    assert.ok(input);buttons(f.card).find(b=>b.dataset.tab==="editor").focus();
    f.resize(260);assert.equal(nav.hidden,true);assert.equal(input.parentElement.hidden,false);
    assert.equal(f.card.shadowRoot.activeElement,input);
    f.resize(900);assert.equal(nav.hidden,false);assert.equal(input.parentElement.hidden,true);
    assert.equal(f.card.shadowRoot.activeElement,buttons(f.card).find(b=>b.dataset.tab==="editor"));
    const editorId="trigger-input";
    if(editorId){const editor=f.card.shadowRoot.getElementById(editorId);editor.value='synthetic unsaved draft';editor.focus();editor.setSelectionRange(2,8,'backward');
      f.resize(260);f.resize(900);assert.equal(f.card.shadowRoot.getElementById(editorId),editor);
      assert.equal(f.card.shadowRoot.activeElement,editor);assert.equal(editor.value,'synthetic unsaved draft');
      assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,8);assert.equal(editor.selectionDirection,'backward');}
    assert.equal(picker(f.card),input);assert.equal(f.requests.length,reads);
  }finally{f.dom.window.close();}
});

test('role change exposes exactly the pre-existing navigation and preserves authorization',async()=>{
  const f=await fixture();try{
    const reads=f.requests.length;f.resize(260);
    f.card.hass={...f.hass,user:{id:'synthetic-admin',is_admin:false},language:'pl'};
    const native=buttons(f.card),input=picker(f.card);
    if(!native.length)assert.equal(input,null);
    else {assert.ok(input);assert.deepEqual([...input.options].map(o=>o.value),native.map(b=>b.dataset.tab));}
    assert.equal(f.card.shadowRoot.querySelector('#save-btn'),null);
    assert.equal(f.requests.length,reads);
  }finally{f.dom.window.close();}
});

test('configuration editor keeps unrecognized settings when its title changes',async()=>{
  const f=await fixture();try{
    const editor=f.dom.window.document.createElement(tag+'-editor');
    editor.setConfig({title:'Synthetic',language:'en',show_support:false,unknown_setting:{keep:'synthetic'}});
    f.dom.window.document.body.append(editor);let changed;
    editor.addEventListener('config-changed',event=>{changed=event.detail.config;});
    const root=editor.shadowRoot||editor,input=root.getElementById?root.getElementById("title"):root.querySelector('#'+"title");
    input.value='Synthetic revised';input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    assert.equal(changed.title,'Synthetic revised');assert.equal(changed.show_support,false);assert.equal(changed.unknown_setting.keep,'synthetic');
    f.card.remove();assert.equal(f.observers.some(o=>o.targets.has(f.card)),false,'observer cleaned on detach');
  }finally{f.dom.window.close();}
});

// Added before the corresponding native expansion-control change.
test('intent expansion is a named native button retaining the existing body and data',async()=>{
  const f=await fixture();try{
    f.card._autoDetectRan=true;
    f.card._haSentences={intents:{HassTurnOn:['synthetic on']},lists:{}};
    const data=f.card._haSentences,reads=f.requests.length;
    choose(f,'ha-sentences');
    const header=f.card.shadowRoot.querySelector('[data-toggle-intent]');
    assert.ok(header);assert.equal(header.tagName,'BUTTON');assert.equal(header.type,'button');
    assert.match(header.textContent,/HassTurnOn/);assert.equal(header.getAttribute('aria-expanded'),'true');
    const body=f.card.shadowRoot.querySelector('[data-intent-body]');
    header.click();assert.equal(body.style.display,'none');assert.equal(header.getAttribute('aria-expanded'),'false');
    header.click();assert.equal(body.style.display,'');assert.equal(header.getAttribute('aria-expanded'),'true');
    assert.equal(f.card._haSentences,data);assert.equal(f.requests.length,reads);
  }finally{f.dom.window.close();}
});
