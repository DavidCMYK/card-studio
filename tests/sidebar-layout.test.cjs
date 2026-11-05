const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const {renderLeft,openSidebarSection}=require('../.build/interface.js');
const base=path.join(__dirname,'..');

test('Desktop sidebar expands one section at a time, preserves lists and remembers scroll positions',()=>{
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(base,'styles.css'),'utf8');
 assert.match(html,/<header class="top">[\s\S]*?<nav class="mode-switch"[\s\S]*?<\/header>/);
 assert.match(html,/<aside class="side side-left"[^>]*>[\s\S]*?<div id="leftBody" class="sidebar-stack"><\/div>/);
 assert.match(css,/\.sidebar-panel-scroll\{[^}]*overflow-y:auto/);
 assert.match(css,/\.sidebar-stack\{[^}]*display:flex;flex-direction:column/);
 assert.match(css,/\.sidebar-panel\.expanded\{flex:1;min-height:0/);
 assert.match(css,/\.sidebar-panel:not\(\.expanded\) \.sidebar-panel-scroll[\s\S]*?\{display:none\}/);
 const mobileCSS=fs.readFileSync(path.join(base,'mobile.css'),'utf8');
 assert.match(mobileCSS,/:root\[data-layout="mobile"\] \.sidebar-panel\{display:none;flex:1/);

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
  assert.equal((markup.match(/class="sidebar-panel sidebar-/g)||[]).length,5);
  for(const id of ['layersScroll','templatesScroll','cardSetsScroll','cardsScroll','setsScroll'])assert.match(markup,new RegExp('id="'+id+'"'));
  assert.match(markup,/TEMPLATES/);
  assert.match(markup,/CARD SETS/);
  assert.match(markup,/Front template/);
  assert.match(markup,/Back template/);
  assert.match(markup,/STAGED CARDS/);
  assert.match(markup,/Illustrations/);
  assert.match(markup,/Manage images/);
  assert.equal(get('#btnTemplate').attributes['aria-pressed'],'true');
  assert.equal((markup.match(/aria-expanded="true"/g)||[]).length,1);
  assert.match(markup,/sidebar-layers expanded/);
  assert.match(markup,/data-sidebar-toggle="templates"/);
  assert.match(markup,/aria-controls="templatesScroll"/);
  get('#layersScroll').scrollTop=145;
  openSidebarSection('templates');
  assert.match(get('#leftBody').innerHTML,/sidebar-templates expanded/);
  assert.doesNotMatch(get('#leftBody').innerHTML,/sidebar-layers expanded/);
  get('#templatesScroll').scrollTop=56;
  openSidebarSection('cardsets');
  get('#cardSetsScroll').scrollTop=65;
  openSidebarSection('cards');
  get('#cardsScroll').scrollTop=85;
  openSidebarSection('images');
  get('#setsScroll').scrollTop=38;
  openSidebarSection('layers');
  assert.equal(get('#layersScroll').scrollTop,145);
  openSidebarSection('templates');
  assert.equal(get('#templatesScroll').scrollTop,56);
  openSidebarSection('cardsets');
  assert.equal(get('#cardSetsScroll').scrollTop,65);
  openSidebarSection('cards');
  assert.equal(get('#cardsScroll').scrollTop,85);
  openSidebarSection('images');
  assert.equal(get('#setsScroll').scrollTop,38);
  state.selected=state.template.elements[0].id;
  renderLeft();
  assert.match(get('#leftBody').innerHTML,/sidebar-sets expanded/);
  state.mode='cards';state.cardIndex=1;renderLeft();
  assert.equal(get('#btnCards').attributes['aria-pressed'],'true');
  assert.match(get('#leftBody').innerHTML,/Reset layout edits/);
 }finally{global.document=previous}
});