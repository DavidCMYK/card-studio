const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../.build/model.js');
const {sheetTable} = require('../.build/spreadsheet.js');
const {renderInspector} = require('../.build/interface.js');

test('XLSX columns omit only explicitly excluded text and image elements', () => {
  const state = model.initial();
  model.replaceState(state);
  const shape = state.template.elements.find(e => e.kind === 'shape');
  const image = state.template.elements.find(e => e.kind === 'image');
  const title = state.template.elements.find(e => e.name === 'Card Title');
  const description = state.template.elements.find(e => e.name === 'Description');
  assert.equal(shape.includeInDataExport, true);
  assert.equal(image.includeInDataExport, true);
  assert.equal(title.includeInDataExport, true);
  state.cards[0].values[title.id] = 'Unique title data';
  state.cards[0].values[description.id] = 'Keep this description';
  assert.deepEqual(sheetTable().heads, ['Card Name','Artwork','Card Title','Description']);

  image.includeInDataExport = false;
  title.includeInDataExport = false;
  const filtered = sheetTable();
  assert.deepEqual(filtered.heads, ['Card Name','Description']);
  assert.deepEqual(filtered.rows[0], ['Card 001','Keep this description']);
  assert.equal(model.visibleOnCard(title,0,'cards'),true,'data exclusion must not hide cards');
  assert.equal(model.visibleOnCard(title,0,'template'),true,'data exclusion must not hide template');
  assert.equal(JSON.parse(JSON.stringify(state)).template.elements.find(e=>e.id===title.id).includeInDataExport,false,
    'the setting must survive saving the project');

  delete title.includeInDataExport;
  delete image.includeInDataExport;
  assert.deepEqual(sheetTable().heads, ['Card Name','Artwork','Card Title','Description'],
    'legacy elements without the setting default to included');

  // Shapes have no spreadsheet-driven values or columns, but retain the
  // property so every element offers the same settings in the editor.
  shape.includeInDataExport = false;
  assert.deepEqual(sheetTable().heads, ['Card Name','Artwork','Card Title','Description']);
});

test('desktop and mobile share the data-export toggle in element properties', () => {
  const state = model.initial();
  model.replaceState(state);
  const nodes = new Map();
  global.document = {querySelector(selector) {
    if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:''});
    return nodes.get(selector);
  },createElement(tag) {
    assert.equal(tag,'canvas');
    return {getContext(){return {measureText(value){return {width:value.length*9}}}}};
  }};
  for(const kind of ['text','image','shape']) {
    const element=state.template.elements.find(e=>e.kind===kind);
    state.mode='template';
    state.selected=element.id;
    renderInspector();
    const html=nodes.get('#inspector').innerHTML;
    assert.match(html,/Include in data export/);
    assert.match(html,/data-prop="includeInDataExport"[^>]*checked/);
    element.includeInDataExport=false;
    renderInspector();
    assert.doesNotMatch(nodes.get('#inspector').innerHTML,/data-prop="includeInDataExport"[^>]*checked/);
  }
});
