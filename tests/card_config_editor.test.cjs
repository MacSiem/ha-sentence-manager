const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
test('native config editor emits immutable complete config and accepts subsequent HA config',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously'});
 try {
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const editor=dom.window.document.createElement('ha-sentence-manager-editor');
  const original={type:'custom:ha-sentence-manager',title:'Before',language:'pl',show_support:false};
  editor.setConfig(original);dom.window.document.body.append(editor);
  const events=[];editor.addEventListener('config-changed',e=>events.push(e));
  const title=editor.querySelector('#title');title.value='<title> & "quoted"';title.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  title.focus();title.setSelectionRange(2,5);editor.setConfig(events[0].detail.config);
  assert.equal(editor.querySelector('#title'),title);assert.equal(dom.window.document.activeElement,title);assert.equal(title.selectionStart,2);assert.equal(title.selectionEnd,5);
  assert.equal(events.length,1);assert.equal(events[0].detail.config.title,title.value);
  assert.equal(events[0].detail.config.show_support,false);assert.equal(events[0].bubbles,true);assert.equal(events[0].composed,true);assert.equal(original.title,'Before');
  const language=editor.querySelector('#language');language.value='en';language.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(events[1].detail.config.language,'en');assert.equal(events[1].detail.config.title,title.value);
  editor.setConfig({...original,title:'From HA',language:'en'});
  assert.equal(editor.querySelector('#title').value,'From HA');assert.equal(editor.querySelector('#language').value,'en');
  assert.equal(editor.querySelectorAll('img,script').length,0);
 } finally {dom.window.close();}
});

// Catch hardcoded editor copy and stale HA locale updates without replacing focused fields.
test('editor follows HA UI language independently of the Assist language',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously'});
 try {
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const editor=dom.window.document.createElement('ha-sentence-manager-editor');
  const config={type:'custom:ha-sentence-manager',title:'Voice',language:'en',show_support:false};
  editor.setConfig(config);editor.hass={language:'pl-PL'};dom.window.document.body.append(editor);
  assert.match(editor.querySelector('h2').textContent,/Konfiguracja/);
  assert.match(editor.querySelector('p').textContent,/Podstawowa konfiguracja/);
  const title=editor.querySelector('#title'),language=editor.querySelector('#language');
  assert.match(title.labels[0].textContent,/Tytuł/);
  assert.match(language.labels[0].textContent,/Język/);
  assert.equal(language.value,'en');assert.equal(title.value,'Voice');
  editor.hass={language:'en'};
  assert.match(editor.querySelector('h2').textContent,/Configuration/);
  assert.match(title.labels[0].textContent,/Title/);
  assert.match(language.labels[0].textContent,/Language/);
  editor.setConfig({...config,language:'pl'});
  assert.match(title.labels[0].textContent,/Title/);
  assert.equal(language.value,'pl');
 } finally {dom.window.close();}
});

test('late editor locale updates preserve draft, focus, selection and complete config echoes',()=>{
 const dom=new JSDOM('',{runScripts:'dangerously'});
 try {
  dom.window.eval(readFileSync('custom_components/ha_sentence_manager/www/ha-sentence-manager.js','utf8'));
  const editor=dom.window.document.createElement('ha-sentence-manager-editor');
  const config={type:'custom:ha-sentence-manager',title:'Original',language:'en',show_support:false,unknown:{keep:true}};
  editor.setConfig(config);dom.window.document.body.append(editor);
  const title=editor.querySelector('#title'),language=editor.querySelector('#language');
  const events=[];editor.addEventListener('config-changed',e=>events.push(e.detail.config));
  title.value='Draft title';title.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  title.focus();title.setSelectionRange(3,7);editor.hass={language:'pl'};
  assert.match(title.labels[0].textContent,/Tytuł/);
  editor.setConfig(events[0]);editor.hass={language:'pl'};
  assert.equal(editor.querySelector('#title'),title);assert.equal(editor.querySelector('#language'),language);
  assert.equal(dom.window.document.activeElement,title);assert.equal(title.selectionStart,3);assert.equal(title.selectionEnd,7);
  assert.equal(title.value,'Draft title');assert.equal(events.length,1);
  assert.equal(events[0].unknown.keep,true);assert.equal(events[0].show_support,false);assert.equal(config.title,'Original');
  editor.hass={language:'de'};
  assert.match(title.labels[0].textContent,/Title/);assert.equal(dom.window.document.activeElement,title);
 } finally {dom.window.close();}
});
