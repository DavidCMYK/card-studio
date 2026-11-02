const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const {renderLeft}=require('../.build/interface.js');
const base=path.join(__dirname,'..');

test('Template/Cards mode is outside the sidebar and toolboxes have separate scroll areas',()=>{
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(base,'styles.css'),'utf8');
 assert.match(html,/<header class="top">[\s\S]*?<nav class="mode-switch"[\s\S]*?<\/header>/);
 assert.match(html,/<aside class="side side-left"[^>]*>[\s\S]*?<div id="leftBody" class="sidebar-stack"><\/div>/);
 assert.match(css,/\.sidebar-panel-scroll\{[^}]*overflow-y:auto/);
 const state=model.initial();
 state.cards.push({id:'second',name:'Card 002',values:{},overrides:{},extraElements:[]});
 state.sets=[{id:'set',name:'Illustrations',images:[{name:'sample.png',data:'data:image/png;base64,YQ=='}]}];
 model.replaceState(state);
 const nodes=new Map(),previous=global.document;
 const get=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{
   innerHTML:'',scrollTop:0,attributes:{},
   classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name)}},
   setAttribute(name,value){this.attributes[name]=value}
  });
  return nodes.get(selector);
 };
 global.document={querySelector:get};
 try{
  renderLeft();
  const markup=get('#leftBody').innerHTML;
  assert.equal((markup.match(/class="sidebar-panel sidebar-/g)||[]).length,3);
  for(const id of ['layersScroll','cardsScroll','setsScroll'])assert.match(markup,new RegExp('id="'+id+'"'));
  assert.match(markup,/STAGED CARDS/);
  assert.match(markup,/Illustrations/);
  assert.match(markup,/Manage images/);
  assert.equal(get('#btnTemplate').attributes['aria-pressed'],'true');
  get('#layersScroll').scrollTop=145;
  get('#cardsScroll').scrollTop=85;
  get('#setsScroll').scrollTop=38;
  state.selected=state.template.elements[0].id;
  renderLeft();
  assert.equal(get('#layersScroll').scrollTop,145);
  assert.equal(get('#cardsScroll').scrollTop,85);
  assert.equal(get('#setsScroll').scrollTop,38);
  state.mode='cards';state.cardIndex=1;renderLeft();
  assert.equal(get('#btnCards').attributes['aria-pressed'],'true');
  assert.match(get('#leftBody').innerHTML,/Reset layout edits/);
 }finally{global.document=previous}
});