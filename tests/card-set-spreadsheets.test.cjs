const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const collections=require('../.build/project-collections.js');
const {sheetTable,workbookTables,applyTable,applyWorkbookTables,exportXLSX}=require('../.build/spreadsheet.js');

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
 otherTemplate.elements.find(e=>e.name==='Description').name='Durability';
 otherTemplate.elements.find(e=>e.name==='Card Title').name='Item Name';
 otherTemplate.elements.find(e=>e.name==='Artwork').name='Item Picture';
 const setOne=state.cardSets[0];
 setOne.name='Characters';
 collections.assignSetTemplate(setOne.id,'back',back.id);
 const setTwo=collections.newCardSet('Equipment',otherTemplate.id);
 state.cards[0].name='Knight';
 const first=state.cards[0];
 state.cards.push({id:'equipment-card',name:'Shield',setId:setTwo.id,values:{},overrides:{},extraElements:[]});
 const {heads,rows}=sheetTable(setOne.id);
 assert.deepEqual(heads,[
  'Card Name',
  'Front / Description','Front / Card Title','Front / Artwork',
  'Back / Description','Back / Card Title','Back / Artwork'
 ]);
 assert.equal(rows.length,1);
 assert.equal(rows[0][0],'Knight');
 assert.ok(!heads.includes('Card Set'));
 assert.deepEqual(workbookTables(setOne.id)[0].heads,heads);
 assert.equal(rows[0][heads.indexOf('Front / Description')],front.elements.find(e=>e.name==='Description').text);
 assert.equal(rows[0][heads.indexOf('Back / Description')],back.elements.find(e=>e.name==='Description').text);
 assert.deepEqual(sheetTable(setTwo.id).heads,['Card Name','Durability','Item Name','Item Picture']);
 assert.deepEqual(sheetTable(setTwo.id).rows.map(r=>r[0]),['Shield']);
 const all=workbookTables();
 assert.deepEqual(all.map(t=>t.name),['Characters','Equipment']);
 assert.deepEqual(all.map(t=>t.rows.length),[1,1]);
 assert.deepEqual(all[0].heads,workbookTables(setOne.id)[0].heads);
 assert.deepEqual(all[1].heads,workbookTables(setTwo.id)[0].heads);
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
  original.printEnabled=false;
  original.printBack='back-art.png';
  original.backExtraElements=[model.makeElement('shape',{name:'Back-only marker'})];
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
  // A named tab from a different set cannot be silently imported here.
  assert.throws(()=>applyWorkbookTables([{name:'Equipment',rows:[heads,revised]}],firstSet.id),/different card set/);
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
  assert.equal(state.cards[0].printEnabled,false);
  assert.equal(state.cards[0].printBack,'back-art.png');
  assert.equal(state.cards[0].backExtraElements.length,1);
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

test('single-set table import uses the same per-set data replacement rules',()=>{
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


test('workbook export uses named per-set tabs, and the one-set export is the same format',async()=>{
 const before={document:global.document,URL:global.URL,JSZip:global.JSZip,setTimeout:global.setTimeout};
 // Browser download cleanup uses a 30-second timer; don't hold the Node
 // test process open when testing ZIP contents.
 global.setTimeout=(fn,ms,...args)=>{const timer=before.setTimeout(fn,ms,...args);timer.unref?.();return timer};
 let blob=null,downloadName='';
 const ZIP=require('../vendor/jszip.min.js');
 const nodes=new Map();
 global.JSZip=ZIP;
 global.URL={createObjectURL(value){blob=value;return 'blob:local'},revokeObjectURL(){}};
 global.document={
  querySelector(id){
   if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{add(){},remove(){}}});
   return nodes.get(id);
  },
  createElement(){return {set download(v){downloadName=v},click(){},remove(){}}},
  body:{append(){}}
 };
 try{
  const state=model.initial();
  model.replaceState(state);
  const second=collections.newCardSet('Items');
  const third=collections.newCardSet('Wands');
  state.cards.push({id:'new',name:'Wand',setId:third.id,values:{},overrides:{},extraElements:[]});
  const read=async()=>{
   const zip=await ZIP.loadAsync(await blob.arrayBuffer());
   return {
    zip,workbook:await zip.file('xl/workbook.xml').async('string'),
    rels:await zip.file('xl/_rels/workbook.xml.rels').async('string'),
    files:Object.keys(zip.files).filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort()
   };
  };
  await exportXLSX();
  const all=await read();
  assert.equal(all.files.length,3);
  assert.match(all.workbook,/name="Default set"/);
  assert.match(all.workbook,/name="Items"/);
  assert.match(all.workbook,/name="Wands"/);
  for(let i=0;i<3;i++){
   const xml=await all.zip.file('xl/worksheets/sheet'+(i+1)+'.xml').async('string');
   assert.doesNotMatch(xml,/>Card Set</);
   assert.match(xml,/>Card Name</);
   assert.match(all.rels,new RegExp('Id="rId'+(i+1)+'"'));
  }
  assert.ok(downloadName.endsWith('_card_data.xlsx'));
  await exportXLSX(third.id);
  const single=await read();
  assert.equal(single.files.length,1);
  assert.match(single.workbook,/name="Wands"/);
  assert.doesNotMatch(single.workbook,/name="Items"/);
  assert.equal(await single.zip.file('xl/worksheets/sheet1.xml').async('string'),
   await all.zip.file('xl/worksheets/sheet3.xml').async('string'),
   'The set worksheet is identical in whole-workbook and single-set exports');
 }finally{
  for(const key of Object.keys(before)){
   if(before[key]===undefined)delete global[key];else global[key]=before[key];
  }
 }
});

test('all-card workbook import matches tabs by name and updates both sets transactionally',()=>{
 const previousDoc=global.document,previousAlert=global.alert;
 fakeDOM();
 try{
  const state=model.initial();
  model.replaceState(state);
  state.cardSets[0].name='Characters';
  const other=collections.createTemplate(state.template);
  other.name='Gear';
  const second=collections.newCardSet('Equipment',other.id);
  const title=state.template.elements.find(e=>e.name==='Card Title');
  const secondTitle=other.elements.find(e=>e.name==='Card Title');
  state.cards[0].name='Knight';
  const gear={id:'gear-id',setId:second.id,name:'Shield',values:{},overrides:{},extraElements:[]};
  state.cards.push(gear);
  const tabs=workbookTables().map(table=>({name:table.name,rows:[table.heads,...table.rows.map(row=>row.slice())]}));
  tabs[0].rows[1][tabs[0].rows[0].indexOf('Card Title')]='Paladin';
  tabs[1].rows[1][tabs[1].rows[0].indexOf('Card Title')]='Aegis';
  const before=JSON.stringify(state.cards);
  assert.throws(()=>applyWorkbookTables([tabs[0],{name:'Unknown set',rows:tabs[1].rows}]),/Unknown card set worksheet/);
  assert.equal(JSON.stringify(state.cards),before,'A bad later sheet must not half-import the first');
  applyWorkbookTables(tabs);
  assert.equal(state.cards.length,2);
  assert.equal(state.cards[0].name,'Knight');
  assert.equal(state.cards[0].values[title.id],'Paladin');
  assert.equal(state.cards[1].values[secondTitle.id],'Aegis');
  assert.equal(state.cards[1].id,gear.id);
  // Import just the Equipment tab from a multi-sheet file, with the same replacement rules.
  const revised=tabs[1].rows.map(row=>row.slice());
  revised[1][revised[0].indexOf('Card Title')]='Tower shield';
  applyWorkbookTables([{name:tabs[0].name,rows:tabs[0].rows},{name:tabs[1].name,rows:revised}],second.id);
  assert.equal(state.cards[0].values[title.id],'Paladin');
  assert.equal(state.cards[1].values[secondTitle.id],'Tower shield');
 }finally{
  if(previousDoc===undefined)delete global.document;else global.document=previousDoc;
  if(previousAlert===undefined)delete global.alert;else global.alert=previousAlert;
 }
});

test('Excel tab names are safe, unique, and limited to 31 characters',()=>{
 const state=model.initial();model.replaceState(state);
 state.cardSets[0].name='Very long invalid [set/name]:*? 00000000000000';
 const second=collections.newCardSet('Very long invalid [set/name]:*? 00000000000000');
 const names=workbookTables().map(t=>t.name);
 assert.equal(names.length,2);
 assert.ok(names.every(name=>name.length<=31&&!/[\[\]:*?/\\]/.test(name)));
 assert.notEqual(names[0].toLowerCase(),names[1].toLowerCase());
 assert.equal(workbookTables(second.id).length,1);
});


test('a template element literally named Card Set is treated as data, not an old metadata column',()=>{
 const previousDoc=global.document,previousAlert=global.alert;
 fakeDOM();
 try{
  const state=model.initial();model.replaceState(state);
  state.cardSets[0].name='Characters';
  const el=model.makeElement('text',{name:'Card Set',text:'Example'});
  state.template.elements.push(el);
  const otherTemplate=collections.createTemplate(state.template);
  otherTemplate.elements=otherTemplate.elements.filter(item=>item.name!=='Card Set');
  const other=collections.newCardSet('Equipment',otherTemplate.id);
  state.cards[0].values[el.id]='Different kind of card';
  const table=workbookTables()[0];
  assert.equal(table.name,'Characters');
  assert.ok(table.heads.includes('Card Set'));
  const row=table.rows[0].slice();
  row[table.heads.indexOf('Card Set')]='Updated value';
  applyWorkbookTables([{name:table.name,rows:[table.heads,row]}]);
  assert.equal(state.cards[0].values[el.id],'Updated value');
  assert.equal(state.cards[0].setId,state.cardSets[0].id);
  assert.ok(!workbookTables(other.id)[0].heads.includes('Card Set'));
 }finally{
  if(previousDoc===undefined)delete global.document;else global.document=previousDoc;
  if(previousAlert===undefined)delete global.alert;else global.alert=previousAlert;
 }
});

test('older all-cards files with a Card Set column still import into their respective sets',()=>{
 const previousDoc=global.document,previousAlert=global.alert;
 fakeDOM();
 try{
  const state=model.initial();model.replaceState(state);
  state.cardSets[0].name='Characters';
  const second=collections.newCardSet('Equipment');
  const title=state.template.elements.find(el=>el.name==='Card Title');
  applyWorkbookTables([{name:'Cards',rows:[
   ['Card Name','Card Set','Card Title'],
   ['Knight','Characters','Sir Rael'],
   ['Shield','Equipment','Wall shield']
  ]}]);
  assert.equal(state.cards.length,2);
  assert.equal(state.cards[0].setId,state.cardSets[0].id);
  assert.equal(state.cards[0].values[title.id],'Sir Rael');
  assert.equal(state.cards[1].setId,second.id);
  assert.equal(state.cards[1].values[title.id],'Wall shield');
 }finally{
  if(previousDoc===undefined)delete global.document;else global.document=previousDoc;
  if(previousAlert===undefined)delete global.alert;else global.alert=previousAlert;
 }
});
