const {test}=require('node:test'),assert=require('node:assert/strict');
const g=require('../.build/card-guides.js');
const px=x=>x*96/25.4;
function fixture(){
 return {
  t:{unit:'mm',dpi:300,width:63,height:88,elements:[
   {id:'bg',x:0,y:0,w:px(63),h:px(88)},
   {id:'txt',x:px(12),y:px(16),w:px(25),h:px(10)}
  ]},
  cards:[{extraElements:[{id:'extra',x:px(2),y:px(3),w:px(1),h:px(1)}],
   overrides:{txt:{x:px(18)}}}]
 };
}
function artwork(t,cards){return structuredClone({width:t.width,height:t.height,elements:t.elements,cards});}

test('old projects retain canvas edge as trim',()=>{
 const {t}=fixture(),r=g.guideRects(t);
 assert.equal(r.settings.bleedMode,'trim');
 assert.equal(r.trim.w,63);
 assert.equal(r.safe.x,4);
});

test('switching an existing template to includes bleed never moves artwork or resizes canvas',()=>{
 const {t,cards}=fixture(),before=artwork(t,cards);
 g.changeBleedMode(t,cards,'bleed');
 assert.deepEqual(artwork(t,cards),before);
 assert.deepEqual(g.trimDimensionsMm(t),{width:57,height:82});
 assert.equal(g.guideRects(t).trim.x,3);
});

test('reversing mode after manual canvas edits does not touch element positions',()=>{
 const {t,cards}=fixture(),before=structuredClone({elements:t.elements,cards});
 g.changeBleedMode(t,cards,'bleed');
 t.width=69;t.height=94; // User explicitly chose to change canvas dimensions.
 g.changeBleedMode(t,cards,'trim');
 assert.equal(t.width,69);
 assert.equal(t.height,94);
 assert.deepEqual({elements:t.elements,cards},before);
});

test('legacy preserve flag or modeChange property cannot trigger automatic resizing',()=>{
 const {t,cards}=fixture(),before=artwork(t,cards);
 t.guides={...g.guidesFor(t),modeChange:'preserve'};
 g.changeBleedMode(t,cards,'bleed',true);
 assert.deepEqual(artwork(t,cards),before);
});

test('editing bleed distances changes trim guides, not canvas or card objects',()=>{
 const {t,cards}=fixture();
 g.changeBleedMode(t,cards,'bleed');
 t.guides.bleedLinked=false;
 const before=artwork(t,cards);
 g.setGuideDistance(t,cards,'bleed','left',5);
 assert.deepEqual(artwork(t,cards),before);
 assert.equal(g.guideRects(t).trim.x,5);
 assert.equal(g.trimDimensionsMm(t).width,55);
});

test('editing linked safe margins changes guide geometry but never user art',()=>{
 const {t,cards}=fixture(),before=artwork(t,cards);
 g.setGuideDistance(t,cards,'safe','top',6);
 assert.deepEqual(artwork(t,cards),before);
 assert.deepEqual(g.guideRects(t).settings.safe,{top:6,right:6,bottom:6,left:6});
});

test('mm, inch and pixel conversions use template DPI without changing physical dimensions',()=>{
 assert.ok(Math.abs(g.distanceInUnit(3,'px',300)-300*3/25.4)<1e-7);
 assert.equal(g.distanceMm(1,'in',300),25.4);
 const {t,cards}=fixture();const before=artwork(t,cards);
 g.setGuideUnit(t,'px');
 assert.deepEqual(artwork(t,cards),before);
 assert.ok(Math.abs(g.distanceInUnit(g.guidesFor(t).bleed.left,'px',300)-35.43307)<.001);
});

test('invalid mode and impossible bleed insets fail without modifying existing data',()=>{
 const {t,cards}=fixture(),before=artwork(t,cards);
 assert.throws(()=>g.changeBleedMode(t,cards,'broken'),/mode/);
 assert.throws(()=>g.setGuideDistance(t,cards,'safe','top',88),/safe-area/i);
 assert.equal(g.guidesFor(t).safe.top,4);
 assert.deepEqual(artwork(t,cards),before);
 g.changeBleedMode(t,cards,'bleed');
 const afterMode=artwork(t,cards);
 assert.throws(()=>g.setGuideDistance(t,cards,'bleed','top',100),/finished-card size/i);
 assert.deepEqual(artwork(t,cards),afterMode);
 assert.equal(g.guidesFor(t).bleed.top,3);
});
