const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../.build/model.js');
const { canvasCard } = require('../.build/png-renderer.js');
const { renderInspector } = require('../.build/interface.js');
const { migrateProjectUnits } = require('../.build/project-storage.js');

function mockCanvas(){
  global.document = {
    querySelector(){return {innerHTML:'',textContent:''};},
    createElement(){return {width:0,height:0,getContext(){return {save(){},restore(){},scale(){},fillRect(){}};}};},
  };
}

test('physical template sizes and exported image pixels reflect selected DPI', async () => {
  mockCanvas();
  const s = model.initial();
  s.template.elements = [];
  model.replaceState(s);
  assert.deepEqual(model.templateExportSize(), {w:744,h:1039});
  let output = await canvasCard(0,'template');
  assert.deepEqual([output.width,output.height],[744,1039]);
  s.template.dpi=600;
  assert.deepEqual(model.templateExportSize(), {w:1488,h:2079});
  output = await canvasCard(0,'template');
  assert.deepEqual([output.width,output.height],[1488,2079]);
  s.template.unit='in';
  s.template.width=2.5;
  s.template.height=3.5;
  s.template.dpi=300;
  assert.deepEqual(model.templateExportSize(), {w:750,h:1050});
});

test('pixel units refer to export pixels at DPI, not display CSS pixels', async () => {
  mockCanvas();
  const s=model.initial();
  s.template.unit='px';
  s.template.width=750;
  s.template.height=1050;
  s.template.dpi=300;
  s.template.elements=[];
  model.replaceState(s);
  assert.equal(model.sizePx().w,240);
  assert.equal(model.sizePx().h,336);
  assert.deepEqual(model.templateExportSize(),{w:750,h:1050});
  const output=await canvasCard(0,'template');
  assert.deepEqual([output.width,output.height],[750,1050]);
  assert.equal(model.exportPixels(model.px(150,'px',300),300),150);
});

test('inspector always shows selected units AND export pixels', () => {
  let inspector={innerHTML:''};
  global.document={querySelector(){return inspector;}};
  const s=model.initial();model.replaceState(s);
  renderInspector();
  assert.match(inspector.innerHTML,/Canvas width \(mm\)/);
  assert.match(inspector.innerHTML,/744 × 1,039 px at 300 DPI/);
  s.selected=s.template.elements[0].id;
  renderInspector();
  assert.match(inspector.innerHTML,/Position and size \(mm\)/);
  assert.match(inspector.innerHTML,/Width \(mm\)/);
  assert.match(inspector.innerHTML,/Export pixels at 300 DPI/);
  assert.match(inspector.innerHTML,/Width 744 px/);
  s.template.unit='in';s.template.width=2.5;s.template.height=3.5;
  renderInspector();
  assert.match(inspector.innerHTML,/Width \(in\)/);
});

test('legacy pixel templates migrate design geometry while preserving old PNG dimensions', async () => {
  mockCanvas();
  const s=model.initial();
  s.version=1;
  s.template.unit='px';
  s.template.width=750;
  s.template.height=1050;
  s.template.dpi=300;
  const e=s.template.elements[0];
  e.x=150; e.y=100; e.w=750; e.h=1050; e.fontSize=16;
  s.cards[0].overrides[e.id]={x:180};
  const migrated=migrateProjectUnits(s);
  assert.equal(migrated.version,2);
  assert.equal(e.x,48);
  assert.equal(e.w,240);
  assert.equal(s.cards[0].overrides[e.id].x,57.6);
  model.replaceState(s);
  assert.equal(migrateProjectUnits(s).template.elements[0].x,48,'migration must be idempotent');
  s.template.elements=[]; // Use a minimal canvas mock when checking export dimensions.
  const output=await canvasCard(0,'template');
  assert.deepEqual([output.width,output.height],[750,1050]);
});

test('pixel dimension inspector fields are whole integers with step 1',()=>{
 let inspector={innerHTML:''};
 global.document={querySelector(){return inspector;}};
 const s=model.initial();
 s.template.unit='px';
 s.template.width=744.35;
 s.template.height=1039.72;
 s.template.guides.unit='px';
 model.replaceState(s);
 renderInspector();
 assert.match(inspector.innerHTML,/data-prop="template.width"[^>]*value="744"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="template.height"[^>]*value="1040"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="guide.cut.width"[^>]*value="744"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="guide.safeZone.width"[^>]*value="[0-9]+"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="guide.bleed.top"[^>]*value="35"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="guide.radius.cut"[^>]*value="0"[^>]*step="1"/);
 const element=s.template.elements[0];
 element.x=200.24;element.y=20.5;element.w=50.55;element.h=80.05;
 s.selected=element.id;
 renderInspector();
 assert.match(inspector.innerHTML,/data-prop="x"[^>]*value="626"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="y"[^>]*value="64"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="w"[^>]*value="158"[^>]*step="1"/);
 assert.match(inspector.innerHTML,/data-prop="h"[^>]*value="250"[^>]*step="1"/);
});
