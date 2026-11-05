const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const collections=require('../.build/project-collections.js');
const {sheetTable,applyTable}=require('../.build/spreadsheet.js');

function fakeDOM(){
 const nodes=new Map();
 global.document={
  documentElement:{dataset:{layout:'desktop'}},
  querySelector(selector){
   if(!nodes.has(selector))nodes.set(selector,{
    innerHTML:'',textContent:'',value:'',scrollTop:0,disabled:false,style:{},
    classList:{toggle(){},add(){},remove(){}},
    setAttribute(){},querySelectorAll(){return []}
   });
   return nodes.get(selector);
  },
  createElement(name){
   if(name==='canvas')return {getContext(){return {measureText(value){return {width:String(value).length*9}}}}};
   return {};
  }
 };
 global.alert=message=>{throw Error('Unexpected alert: '+message)};
}

test('XLSX columns track the same top-to-bottom order as the Layers toolbox',()=>{
 const state=model.initial();
 model.replaceState(state);
 const topToBottom=()=>state.template.elements.slice().reverse()
  .filter(e=>(e.kind==='text'||e.kind==='image')&&e.includeInDataExport!==false)
  .map(e=>e.name);
 assert.deepEqual(sheetTable().heads,['Card Name',...topToBottom()]);
 assert.deepEqual(sheetTable().heads,['Card Name','Description','Card Title','Artwork']);
 // Changing paint/layer order must change the corresponding column sequence.
 const text=state.template.elements.find(e=>e.name==='Card Title');
 state.template.elements.splice(state.template.elements.indexOf(text),1);
 state.template.elements.push(text);
 assert.deepEqual(sheetTable().heads,['Card Name','Card Title','Description','Artwork']);
});

test('a card-set XLSX includes only its own rows and front/back layer fields',()=>{
 const state=model.initial();
 model.replaceState(state);
 const front=state.template;
 front.name='Front';
 const back=collections.createTemplate(front);
 back.name='Back';
 const otherTemplate=collections.createTemplate(front);
 otherTemplate.name='Other design';
 const setOne=state.cardSets[0];
 setOne.name='Characters';
 collections.assignSetTemplate(setOne.id,'back',back.id);
 const setTwo=collections.newCardSet('Equipment',otherTemplate.id);
 state.cards[0].name='Knight';
 const first=state.cards[0];
 state.cards.push({id:'equipment-card',name:'Shield',setId:setTwo.id,values:{},overrides:{},extraElements:[]});
 const {heads,rows}=sheetTable(setOne.id);
 assert.deepEqual(heads,[
  'Card Name','Card Set',
  'Front / Description','Front / Card Title','Front / Artwork',
  'Back / Description','Back / Card Title','Back / Artwork'
 ]);
 assert.equal(rows.length,1);
 assert.equal(rows[0][0],'Knight');
 assert.equal(rows[0][1],'Characters');
 assert.equal(rows[0][heads.indexOf('Front / Description')],front.elements.find(e=>e.name==='Description').text);
 assert.equal(rows[0][heads.indexOf('Back / Description')],back.elements.find(e=>e.name==='Description').text);
 assert.deepEqual(sheetTable(setTwo.id).heads,['Card Name','Card Set',
  'Other design / Description','Other design / Card Title','Other design / Artwork']);
 assert.deepEqual(sheetTable(setTwo.id).rows.map(r=>r[0]),['Shield']);
 assert.equal(sheetTable().rows.length,2,'All-cards export still includes both sets');
 assert.strictEqual(first,state.cards[0]);
 assert.throws(()=>sheetTable('unknown'),/Card set not found/);
});

test('importing one set updates card details while preserving other sets and named-card layouts',()=>{
 const previousDoc=global.document,previousAlert=global.alert;
 fakeDOM();
 try{
  const state=model.initial();
  model.replaceState(state);
  const firstSet=state.cardSets[0];
  firstSet.name='Characters';
  const front=state.template;
  const other=collections.createTemplate(front);
  other.name='Other layout';
  const secondSet=collections.newCardSet('Equipment',other.id);
  const original=state.cards[0];
  original.name='Knight';
  const title=front.elements.find(e=>e.name==='Card Title');
  const description=front.elements.find(e=>e.name==='Description');
  original.values[title.id]='Keep this non-exported value';
  original.values[description.id]='Old description';
  title.includeInDataExport=false;
  original.overrides[description.id]={fontSize:25};
  original.extraElements.push(model.makeElement('shape',{name:'Unique marker'}));
  original.printQuantity=3;
  const different={id:'other-id',name:'Shield',setId:secondSet.id,values:{saved:'untouched'},overrides:{},extraElements:[]};
  state.cards.push(different);
  const {heads,rows}=sheetTable(firstSet.id);
  assert.equal(rows.length,1);
  assert.ok(!heads.some(h=>h.includes('Card Title')));
  const revised=rows[0].slice();
  revised[heads.indexOf('Description')]='Updated details';
  const added=rows[0].slice();
  added[0]='Mage';
  added[heads.indexOf('Description')]='New card details';
  // Card Set labels are verified before any state is modified.
  const incorrect=revised.slice();
  incorrect[heads.indexOf('Card Set')]='Equipment';
  assert.throws(()=>applyTable([heads,incorrect],firstSet.id),/Spreadsheet belongs to/);
  assert.strictEqual(state.cards[1],different);
  applyTable([heads,revised,added],firstSet.id);
  assert.equal(state.cards.length,3);
  assert.strictEqual(state.cards[2],different,'A different set is not replaced or modified');
  assert.equal(state.cards[0].id,original.id,'Matching card retains stable ID');
  assert.equal(state.cards[0].values[title.id],'Keep this non-exported value');
  assert.equal(state.cards[0].values[description.id],'Updated details');
  assert.equal(state.cards[0].overrides[description.id].fontSize,25);
  assert.equal(state.cards[0].extraElements.length,1);
  assert.equal(state.cards[0].printQuantity,3);
  assert.equal(state.cards[1].setId,firstSet.id);
  assert.equal(state.cards[1].name,'Mage');
  assert.equal(state.cards[1].values[description.id],'New card details');
  assert.equal(state.cardIndex,0);
  assert.equal(state.mode,'cards');
 }finally{
  if(previousDoc===undefined)delete global.document;else global.document=previousDoc;
  if(previousAlert===undefined)delete global.alert;else global.alert=previousAlert;
 }
});

test('the existing all-cards spreadsheet import still replaces staged cards',()=>{
 const previousDoc=global.document,previousAlert=global.alert;
 fakeDOM();
 try{
  const state=model.initial();
  model.replaceState(state);
  const headers=sheetTable().heads;
  const title=state.template.elements.find(e=>e.name==='Card Title');
  const row=Array.from({length:headers.length},()=>'');
  row[0]='New from spreadsheet';
  row[headers.indexOf('Card Title')]='Spreadsheet title';
  applyTable([headers,row]);
  assert.equal(state.cards.length,1);
  assert.equal(state.cards[0].name,'New from spreadsheet');
  assert.equal(state.cards[0].values[title.id],'Spreadsheet title');
 }finally{
  if(previousDoc===undefined)delete global.document;else global.document=previousDoc;
  if(previousAlert===undefined)delete global.alert;else global.alert=previousAlert;
 }
});
