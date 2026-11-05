const test = require('node:test');
const assert = require('node:assert/strict');
const { S, makeElement, px, initial, replaceState, effective, templateEl } = require('../.build/model.js');
const { patchElement } = require('../.build/interface.js');
const { parseCSV, sheetTable } = require('../.build/spreadsheet.js');
const { getImageRef } = require('../.build/image-sets.js');

test('card overrides do not mutate the shared template', () => {
  const model = require('../.build/model.js');
  const state = initial();
  state.mode = 'cards';
  model.replaceState(state);
  const title = state.template.elements.find(e => e.name === 'Card Title');
  const original = title.x;
  patchElement(title.id, {x: 81, fontSize: 29});
  assert.equal(title.x, original);
  assert.equal(model.effective(title).x, 81);
  assert.equal(model.effective(title).fontSize, 29);
  state.mode = 'template';
  assert.equal(model.effective(title).x, original);
});

test('data headers match named text and image elements', () => {
  const model = require('../.build/model.js');
  model.replaceState(initial());
  const {heads, rows} = sheetTable();
  assert.deepEqual(heads, ['Card Name', 'Description', 'Card Title', 'Artwork']);
  assert.equal(rows.length, 1);
});

test('CSV parser respects quoted commas and embedded newlines', () => {
  const rows = parseCSV('Card Name,Description\n"Dragon, red","Fire\nand fury"\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], 'Dragon, red');
  assert.equal(rows[1][1], 'Fire\nand fury');
});

test('image sets resolve by filename and cycle per card', () => {
  const model = require('../.build/model.js');
  const state = initial();
  state.mode = 'cards';
  state.sets = [{id: 'set1',name:'Art',images:[{name:'alpha.png',data:'data:a'},{name:'beta.png',data:'data:b'}]}];
  state.cards.push({id:'card2',name:'Card 002',values:{},overrides:{},extraElements:[]});
  const image = state.template.elements.find(e=>e.kind==='image');
  image.autoSet = 'set1';
  model.replaceState(state);
  assert.equal(getImageRef(image,0,'cards').name,'alpha.png');
  assert.equal(getImageRef(image,1,'cards').name,'beta.png');
  state.cards[1].values[image.id] = 'Art/alpha.png';
  assert.equal(getImageRef(image,1,'cards').name,'alpha.png');
});
