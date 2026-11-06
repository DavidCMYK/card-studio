const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const history=require('../.build/history.js');
const collections=require('../.build/project-collections.js');
const spreadsheet=require('../.build/spreadsheet.js');
const grid=require('../.build/card-data-grid.js');

function project(){
 const state=model.initial();
 model.replaceState(state);
 history.resetHistory();
 return state;
}
test('grid columns and values are identical to each card set XLSX worksheet',()=>{
 const state=project(),first=state.cardSets[0];
 const front=state.template;
 front.name='Front';
 const back=collections.createTemplate(front);back.name='Back';
 collections.assignSetTemplate(first.id,'back',back.id);
 const other=collections.createTemplate(front);other.name='Gear';
 other.elements.find(e=>e.name==='Card Title').name='Item Title';
 const second=collections.newCardSet('Items',other.id);
 state.cards.push({id:'item-card',setId:second.id,name:'Shield',values:{},overrides:{},extraElements:[]});
 state.cards[0].name='Knight';
 for(const set of [first,second]){
  const expected=spreadsheet.sheetTable(set.id);
  const columns=grid.gridColumns(set.id),rows=grid.gridRows(set.id);
  assert.deepEqual(columns.map(c=>c.label),expected.heads);
  assert.deepEqual(rows.map(r=>r.values),expected.rows);
  assert.deepEqual(rows.map(r=>r.cardId),state.cards.filter(c=>c.setId===set.id).map(c=>c.id));
 }
 const title=front.elements.find(e=>e.name==='Card Title');
 title.includeInDataExport=false;
 assert.ok(!grid.gridColumns(first.id).some(c=>c.id===title.id));
 assert.ok(!spreadsheet.sheetTable(first.id).heads.includes('Front / Card Title'));
});

test('cell edits are set-scoped, preserve overrides, support blank fields and update XLSX',()=>{
 const state=project(),set=state.cardSets[0],card=state.cards[0];
 const columns=grid.gridColumns(set.id);
 const textCol=columns.findIndex(col=>col.label==='Card Title');
 const artCol=columns.findIndex(col=>col.label==='Artwork');
 const title=columns[textCol].element;
 card.overrides[title.id]={fontSize:25};
 const original=card.id;
 assert.equal(grid.editGridCell(set.id,card.id,textCol,'Unique title'),true);
 assert.equal(grid.editGridCell(set.id,card.id,textCol,'Unique title'),false);
 assert.equal(grid.editGridCell(set.id,card.id,artCol,'Art/pic.png'),true);
 assert.equal(grid.editGridCell(set.id,card.id,0,'  Dragon  '),true);
 assert.equal(card.name,'Dragon');
 assert.equal(card.values[title.id],'Unique title');
 assert.equal(card.overrides[title.id].fontSize,25);
 assert.equal(grid.gridRows(set.id)[0].cardId,original);
 const sheet=spreadsheet.sheetTable(set.id);
 assert.equal(sheet.rows[0][textCol],'Unique title');
 assert.equal(sheet.rows[0][artCol],'Art/pic.png');
 assert.equal(grid.editGridCell(set.id,card.id,textCol,''),true);
 assert.equal(card.values[title.id],'','Empty string must override template text');
 assert.throws(()=>grid.editGridCell('not-a-set',card.id,textCol,'bad'),/Card set/);
 assert.throws(()=>grid.editGridCell(set.id,card.id,100,'bad'),/Unknown card-data field/);
});

test('filter and numeric sort affect the view only, not staged-card or image sequence order',()=>{
 const state=project(),set=state.cardSets[0];
 const ids=['one','two','three'];
 state.cards=[
  ...ids.map((id,i)=>({id,setId:set.id,name:['Card 12','Card 2','Sword'][i],
   values:{},overrides:{},extraElements:[]}))
 ];
 const original=state.cards.map(c=>c.id);
 assert.deepEqual(grid.gridRows(set.id,'',0,'asc').map(c=>c.cardId),['two','one','three']);
 assert.deepEqual(grid.gridRows(set.id,'',0,'desc').map(c=>c.cardId),['three','one','two']);
 assert.deepEqual(grid.gridRows(set.id,'CARD').map(c=>c.cardId),['one','two']);
 assert.deepEqual(state.cards.map(c=>c.id),original);
});

test('Excel clipboard supports multiline quoted fields, tabs and trailing newlines',()=>{
 assert.deepEqual(grid.parseGridPaste('One\t"two\nlines"\r\nThree\t"say ""hi"""\r\n'),
  [['One','two\nlines'],['Three','say "hi"']]);
 assert.deepEqual(grid.parseGridPaste('A\t\tB\n'),[['A','','B']]);
 assert.deepEqual(grid.parseGridPaste(''),[]);
 assert.throws(()=>grid.parseGridPaste('"unclosed'),/Unterminated quoted cell/);
});

test('pasting a rectangle changes the correct fields and adds rows only without sort/filter',()=>{
 const state=project(),first=state.cardSets[0];
 const other=collections.newCardSet('Items');
 state.cards.push({id:'item',setId:other.id,name:'Other set card',
  values:{},overrides:{},extraElements:[]});
 const firstCard=state.cards[0],fields=grid.gridColumns(first.id);
 const titleCol=fields.findIndex(c=>c.label==='Card Title');
 const titleId=fields[titleCol].id;
 firstCard.name='First';
 firstCard.overrides[titleId]={fontSize:37};
 const ids=[firstCard.id];
 const pasted=grid.pasteGridCells(first.id,firstCard.id,titleCol,
  [['Title 1'],['Title 2'],['Title 3']],ids,true);
 assert.deepEqual(pasted,{changed:3,added:2});
 assert.equal(state.cards.length,4);
 assert.equal(state.cards[0].id,firstCard.id);
 assert.equal(state.cards[0].overrides[titleId].fontSize,37);
 assert.equal(state.cards[1].values[titleId],'Title 2');
 assert.equal(state.cards[2].values[titleId],'Title 3');
 assert.equal(state.cards[3].id,'item');
 assert.deepEqual(state.cards.map(c=>c.setId),[first.id,first.id,first.id,other.id]);
});

test('invalid paste rejects the whole range without modifying any card or creating rows',()=>{
 const state=project(),set=state.cardSets[0],card=state.cards[0];
 const before=JSON.stringify(state.cards);
 assert.throws(()=>grid.pasteGridCells(set.id,card.id,2,
  [['Some title','extra1','extra2']], [card.id],true),/more columns/);
 assert.equal(JSON.stringify(state.cards),before);
 assert.throws(()=>grid.pasteGridCells(set.id,card.id,0,
  [['Updated'],['New row']], [card.id],false),/Clear sorting and filtering/);
 assert.equal(JSON.stringify(state.cards),before);
 assert.throws(()=>grid.pasteGridCells(set.id,'invalid',0,
  [['Bad']], [card.id],true),/visible card/);
 assert.equal(JSON.stringify(state.cards),before);
});

test('paste uses visible sorted row order, not underlying project order',()=>{
 const state=project(),set=state.cardSets[0],a=state.cards[0];
 a.name='Zulu';
 const b={id:'beta',setId:set.id,name:'Alpha',values:{},overrides:{},extraElements:[]};
 state.cards.push(b);
 const sorted=grid.gridRows(set.id,'',0,'asc');
 assert.deepEqual(sorted.map(r=>r.cardId),[b.id,a.id]);
 const result=grid.pasteGridCells(set.id,b.id,0,[['First'],['Second']],
  sorted.map(r=>r.cardId),false);
 assert.deepEqual(result,{changed:2,added:0});
 assert.deepEqual(state.cards.map(c=>c.name),['Second','First']);
 assert.deepEqual(state.cards.map(c=>c.id),[a.id,b.id],'No actual reordering');
});

test('bulk duplication preserves card-specific details; deletion keeps other sets and project minimum',()=>{
 const state=project(),set=state.cardSets[0],card=state.cards[0];
 const other=collections.newCardSet('Other');
 card.name='Knight';card.printQuantity=4;card.printEnabled=false;
 card.extraElements=[model.makeElement('shape',{name:'Special'})];
 card.backExtraElements=[model.makeElement('shape',{name:'Back Special'})];
 card.printBack='data:image/png;base64,QQ==';
 const otherCard={id:'other',setId:other.id,name:'Shield',values:{},overrides:{},extraElements:[]};
 state.cards.push(otherCard);
 const clones=grid.duplicateGridCards(set.id,[card.id]);
 assert.equal(clones.length,1);
 assert.notEqual(clones[0].id,card.id);
 assert.equal(clones[0].name,'Knight copy');
 assert.equal(clones[0].printQuantity,4);
 assert.equal(clones[0].printEnabled,false);
 assert.equal(clones[0].printBack,card.printBack);
 assert.equal(clones[0].extraElements.length,1);
 assert.equal(clones[0].backExtraElements.length,1);
 assert.notStrictEqual(clones[0].extraElements[0],card.extraElements[0]);
 assert.equal(state.cards[2],otherCard);
 assert.equal(grid.deleteGridCards(set.id,[card.id,clones[0].id]),2);
 assert.equal(state.cards.length,1);
 assert.equal(state.cards[0],otherCard);
 assert.throws(()=>grid.deleteGridCards(other.id,[otherCard.id]),/at least one card/);
});

test('new cards in empty sets and a multi-cell paste each use one undo/redo checkpoint',()=>{
 project();
 const state=model.S,first=state.cardSets[0];
 const second=collections.newCardSet('New set');
 const cards=grid.addGridCards(second.id,2);
 assert.equal(cards.length,2);
 assert.deepEqual(grid.gridRows(second.id).map(r=>r.cardId),cards.map(c=>c.id));
 history.checkpoint();
 const cols=grid.gridColumns(second.id);
 const titleCol=cols.findIndex(c=>c.label==='Card Title');
 const result=grid.pasteGridCells(second.id,cards[0].id,titleCol,
  [['FIRST'],['SECOND']],cards.map(c=>c.id),false);
 assert.equal(result.changed,2);
 history.checkpoint();
 assert.equal(history.historyState().undoCount,2);
 assert.equal(history.undo(),true);
 assert.equal(model.S.cards.find(c=>c.id===cards[0].id).values[cols[titleCol].id],undefined);
 assert.equal(history.undo(),true);
 assert.equal(model.S.cards.filter(c=>c.setId===second.id).length,0);
 assert.equal(history.redo(),true);
 assert.equal(model.S.cards.filter(c=>c.setId===second.id).length,2);
 assert.equal(history.redo(),true);
 assert.equal(model.S.cards.find(c=>c.id===cards[1].id).values[cols[titleCol].id],'SECOND');
});

test('bulk editor is accessible from desktop header, card set toolbox and mobile Export menu',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const editor=fs.readFileSync(path.join(root,'src/editor.ts'),'utf8');
 const sidebar=fs.readFileSync(path.join(root,'src/interface.ts'),'utf8');
 const mobile=fs.readFileSync(path.join(root,'src/mobile-interface.ts'),'utf8');
 assert.match(html,/data-action="edit-card-data"/);
 assert.match(editor,/case 'edit-card-data':openCardDataGrid/);
 assert.match(sidebar,/data-action="edit-card-data" data-set-id=/);
 assert.match(mobile,/\['edit-card-data','Edit card data'\]/);
 const ui=fs.readFileSync(path.join(root,'src/card-data-grid-ui.ts'),'utf8');
 assert.match(ui,/columns\[index\]\.kind==='text'/,'Text fields need multiline editing');
 assert.match(ui,/<textarea spellcheck=/);
 assert.match(ui,/data-dg="select-filtered"/);
 assert.match(ui,/data-dg="undo"/);
 assert.match(ui,/data-dg="redo"/);
 assert.match(ui,/!query&&sortColumn===null/,'Filtered paste must not create hidden rows');
 assert.match(ui,/input instanceof HTMLInputElement && input\.dataset\.dgSelect!==undefined/,
  'Checkbox state must be read only after narrowing the event target to an input');
});
