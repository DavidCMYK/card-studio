const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const collections=require('../.build/project-collections.js');
const {sheetTable,workbookTables}=require('../.build/spreadsheet.js');
const {gridColumns}=require('../.build/card-data-grid.js');
const history=require('../.build/history.js');

test('deleting from a duplicated template updates the live template, XLSX and bulk editor only for the assigned set',()=>{
 const state=model.initial();
 model.replaceState(state);
 history.resetHistory();
 const original=state.template;
 const originalElements=original.elements.map(e=>e.id);
 const copy=collections.createTemplate(original);
 const copiedSet=collections.newCardSet('Different cards',copy.id);
 state.cards.push({id:'copied-card',setId:copiedSet.id,name:'Different card',values:{},overrides:{},extraElements:[]});
 const removed=['Artwork','Description','Card Title'];
 const ids=copy.elements.filter(e=>removed.includes(e.name)).map(e=>e.id);
 assert.equal(ids.length,3);
 assert.strictEqual(model.S.template,copy,'copied template is active');
 for(const id of ids){
  assert.equal(collections.removeTemplateElement(id),true);
  history.checkpoint();
 }
 assert.strictEqual(model.S.templates.find(t=>t.id===copy.id),copy,'same authoritative template object');
 assert.deepEqual(copy.elements.filter(e=>removed.includes(e.name)),[]);
 assert.deepEqual(sheetTable(copiedSet.id).heads,['Card Name']);
 assert.deepEqual(gridColumns(copiedSet.id).map(c=>c.label),['Card Name']);
 assert.deepEqual(workbookTables().find(t=>t.setId===copiedSet.id).heads,['Card Name']);
 assert.deepEqual(original.elements.map(e=>e.id),originalElements,'source template untouched');
 assert.deepEqual(sheetTable(state.cardSets[0].id).heads,['Card Name','Description','Card Title','Artwork']);

 model.selectProjectTemplate(original.id);
 model.selectProjectTemplate(copy.id);
 assert.deepEqual(model.S.template.elements.map(e=>e.id),copy.elements.map(e=>e.id),
  'deleted elements do not return on template switching');
 model.S.mode='cards';model.syncEditorTemplate();
 assert.deepEqual(sheetTable(copiedSet.id).heads,['Card Name'],'switching card views preserves changes');

 // Saving/reopening the normalized project retains the same template structure.
 const serialized=JSON.parse(JSON.stringify(model.S));
 model.replaceState(model.loadedProject(serialized));
 assert.deepEqual(sheetTable(copiedSet.id).heads,['Card Name']);
 assert.deepEqual(gridColumns(copiedSet.id).map(c=>c.label),['Card Name']);
});

test('cut and delete share one template mutation path and undo restores removed fields',()=>{
 model.replaceState(model.initial());
 history.resetHistory();
 const original=model.S.template;
 const id=original.elements.find(e=>e.name==='Card Title').id;
 const removed=collections.removeTemplateElement(id);
 assert.equal(removed,true);
 history.checkpoint();
 assert.equal(model.S.templates[0].elements.some(e=>e.id===id),false);
 assert.ok(!sheetTable().heads.includes('Card Title'));
 assert.equal(history.undo(),true);
 assert.ok(sheetTable().heads.includes('Card Title'));
 assert.equal(history.redo(),true);
 assert.ok(!sheetTable().heads.includes('Card Title'));
 assert.equal(collections.removeTemplateElement('missing-element'),false);
 assert.deepEqual(sheetTable().heads,['Card Name','Description','Artwork']);

 const source=fs.readFileSync(path.join(__dirname,'../src/editor.ts'),'utf8');
 assert.match(source,/removeTemplateElement\(el.id\)/,'cut must use shared removal');
 assert.match(source,/removeTemplateElement\(S.selected\)/,'delete must use shared removal');
 assert.doesNotMatch(source,/S\.template\.elements\s*=\s*S\.template\.elements\.filter/,
  'never replace the active alias with a detached element array');
});

test('desktop pointer gesture code is restored and mobile toggle remains available',()=>{
 const root=path.resolve(__dirname,'..');
 const editor=fs.readFileSync(path.join(root,'src/editor.ts'),'utf8');
 const mobile=fs.readFileSync(path.join(root,'src/mobile-touch.ts'),'utf8');
 const controls=fs.readFileSync(path.join(root,'src/mobile-interface.ts'),'utf8');
 assert.doesNotMatch(editor,/tap-gesture/);
 assert.doesNotMatch(mobile,/tap-gesture/);
 assert.match(editor,/now-previous\.at<490/);
 assert.match(mobile,/now-lastTap\.time<380/);
 assert.match(controls,/id="mobileArtworkModeButton"/);
 assert.match(controls,/finish-reposition-image/);
});
