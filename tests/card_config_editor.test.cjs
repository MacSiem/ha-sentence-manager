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
  assert.equal(events.length,1);assert.equal(events[0].detail.config.title,title.value);
  assert.equal(events[0].detail.config.show_support,false);assert.equal(events[0].bubbles,true);assert.equal(events[0].composed,true);assert.equal(original.title,'Before');
  const language=editor.querySelector('#language');language.value='en';language.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(events[1].detail.config.language,'en');assert.equal(events[1].detail.config.title,title.value);
  editor.setConfig({...original,title:'From HA',language:'en'});
  assert.equal(editor.querySelector('#title').value,'From HA');assert.equal(editor.querySelector('#language').value,'en');
  assert.equal(editor.querySelectorAll('img,script').length,0);
 } finally {dom.window.close();}
});
