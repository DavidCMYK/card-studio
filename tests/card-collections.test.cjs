const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const collection=require('../.build/project-collections.js');
const guides=require('../.build/card-guides.js');
const {canvasCard}=require('../.build/png-renderer.js');

function reset(){
 const state=model.initial();
 model.replaceState(state);
 return model.S;
}
function addTemplate(name){
 const t=collection.createTemplate(model.S.templates[0]);
 t.name=name;
 return t;
}
test('legacy single-template decks become one template and one card set without changing artwork or card data',()=>{
 const legacy=model.initial();
 const elements=structuredClone(legacy.template.elements);
 legacy.cards[0].values[legacy.template.elements[3].id]='Stored name';
 delete legacy.templates;delete legacy.cardSets;delete legacy.selectedTemplateId;delete legacy.side;
 for(const c of legacy.cards)delete c.setId;
 model.replaceState(legacy);
 const state=model.S;
 assert.equal(state.templates.length,1);assert.equal(state.cardSets.length,1);
 assert.strictEqual(state.template,state.templates[0]);
 assert.equal(state.cards[0].setId,state.cardSets[0].id);
 assert.deepEqual(state.template.elements,elements);
 assert.equal(state.cards[0].values[state.template.elements[3].id],'Stored name');
});
test('four templates can serve four card sets in any front/back combination; edits are shared',()=>{
 const s=reset(),a=s.templates[0];a.name='A';
 const b=addTemplate('B'),c=addTemplate('C'),d=addTemplate('D');
 const sets=[s.cardSets[0],collection.newCardSet('Set 2',a.id),
  collection.newCardSet('Set 3',b.id),collection.newCardSet('Set 4',b.id)];
 sets[0].name='Set 1';
 collection.assignSetTemplate(sets[0].id,'back',c.id);
 collection.assignSetTemplate(sets[1].id,'back',d.id);
 collection.assignSetTemplate(sets[2].id,'back',c.id);
 collection.assignSetTemplate(sets[3].id,'back',d.id);
 assert.deepEqual(sets.map(x=>[x.frontTemplateId,x.backTemplateId]),[
  [a.id,c.id],[a.id,d.id],[b.id,c.id],[b.id,d.id]]);
 s.cards=sets.map((set,i)=>({id:'card-'+i,name:'Card '+(i+1),setId:set.id,values:{},overrides:{},extraElements:[]}));
 a.elements[0].fill1='#f00';c.elements[0].fill1='#0f0';
 assert.equal(model.assignedTemplate(0,'front').elements[0].fill1,'#f00');
 assert.equal(model.assignedTemplate(1,'front').elements[0].fill1,'#f00');
 assert.equal(model.assignedTemplate(0,'back').elements[0].fill1,'#0f0');
 assert.equal(model.assignedTemplate(2,'back').elements[0].fill1,'#0f0');
 s.mode='cards';s.cardIndex=2;s.side='back';model.syncEditorTemplate();
 assert.strictEqual(s.template,c);
 s.cardIndex=1;model.syncEditorTemplate();assert.strictEqual(s.template,d);
 assert.deepEqual(s.templates,[a,b,c,d]);
});
test('set template assignments reject mismatched physical cut dimensions and deleting assigned templates',()=>{
 const s=reset(),other=addTemplate('Wide');
 guides.setCutDimension(other,'width',70);
 assert.throws(()=>collection.assignSetTemplate(s.cardSets[0].id,'back',other.id),/matching finished cut/);
 assert.equal(s.cardSets[0].backTemplateId,undefined);
 assert.throws(()=>collection.deleteTemplate(s.templates[0].id),/assigned/);
 assert.equal(s.templates.length,2);
 collection.deleteTemplate(other.id);assert.equal(s.templates.length,1);
});
test('duplicated or independently imported templates remap all element and link IDs',()=>{
 reset();
 const a=model.S.templates[0],linked=structuredClone(a.elements[1]);
 linked.id='linked-dummy';linked.linkedTextId=a.elements[3].id;
 a.elements.push(linked);
 const b=collection.cloneTemplate(a,'Copied');
 assert.notEqual(b.id,a.id);
 assert.equal(b.elements.length,a.elements.length);
 for(let i=0;i<a.elements.length;i++)assert.notEqual(b.elements[i].id,a.elements[i].id);
 assert.equal(b.elements.at(-1).linkedTextId,b.elements[3].id);
});
test('per-card set moves keep values and overrides for the old template without applying to unrelated templates',()=>{
 const s=reset(),a=s.templates[0],b=addTemplate('B');
 const set=collection.newCardSet('Other',b.id);
 const entry=s.cards[0],key=a.elements[3].id;
 entry.values[key]='Keep me';entry.overrides[key]={x:123};
 collection.moveCardToSet(entry,set.id);
 assert.equal(entry.setId,set.id);assert.equal(entry.values[key],'Keep me');
 assert.equal(model.assignedTemplate(0,'front'),b);
 collection.moveCardToSet(entry,s.cardSets[0].id);
 assert.equal(model.assignedTemplate(0,'front'),a);
 assert.equal(entry.overrides[key].x,123);
});
test('rendering a different card-set template never switches the editor template',async()=>{
 const s=reset(),a=s.templates[0],b=addTemplate('B');
 a.elements=[];b.elements=[];b.background='#008080';
 b.width=75;b.height=98;
 const set=collection.newCardSet('Other',b.id);
 s.cards.push({id:'other',name:'Other',setId:set.id,values:{},overrides:{},extraElements:[]});
 s.mode='template';model.selectProjectTemplate(a.id);
 const original=s.template;
 let lastFill;
 global.document={createElement(tag){
  assert.equal(tag,'canvas');
  return {width:0,height:0,getContext(){return {scale(){},set fillStyle(v){lastFill=v},fillRect(){}}}};
 }};
 const canvas=await canvasCard(1,'cards','front');
 assert.equal(canvas.width,Math.round(75*300/25.4));
 assert.equal(canvas.height,Math.round(98*300/25.4));
 assert.equal(lastFill,'#008080');
 assert.strictEqual(s.template,original);
});
