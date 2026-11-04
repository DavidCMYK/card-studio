const {test}=require('node:test'),assert=require('node:assert/strict');
const g=require('../.build/card-guides.js');
const px=x=>x*96/25.4;
function fixture(){return {t:{unit:'mm',dpi:300,width:63,height:88,
 elements:[{id:'bg',x:0,y:0,w:px(63),h:px(88)},{id:'txt',x:px(12),y:px(16),w:px(25),h:px(10)}]},
 cards:[{extraElements:[{id:'extra',x:px(2),y:px(3),w:px(1),h:px(1)}],overrides:{txt:{x:px(18)}}}]}}
test('default existing projects use edge as trim and safe guide',()=>{const {t}=fixture(),r=g.guideRects(t);assert.equal(r.settings.bleedMode,'trim');assert.equal(r.trim.w,63);assert.equal(r.safe.x,4)});
test('switch to canvas-includes bleed preserves trim size and moves content but expands full-canvas background',()=>{const {t,cards}=fixture();g.changeBleedMode(t,cards,'bleed');assert.equal(t.width,69);assert.equal(t.height,94);assert.deepEqual(g.trimDimensionsMm(t),{width:63,height:88});assert.equal(t.elements[0].x,0);assert.equal(t.elements[0].w,px(69));assert.equal(t.elements[1].x,px(15));assert.equal(cards[0].overrides.txt.x,px(21));assert.equal(cards[0].extraElements[0].x,px(5));});
test('reversing bleed mode returns original geometry',()=>{const {t,cards}=fixture();g.changeBleedMode(t,cards,'bleed');g.changeBleedMode(t,cards,'trim');assert.ok(Math.abs(t.width-63)<1e-9);assert.ok(Math.abs(t.elements[1].x-px(12))<1e-9);});
test('keep canvas mode reinterprets dimensions without moving objects',()=>{const {t,cards}=fixture();g.changeBleedMode(t,cards,'bleed',false);assert.equal(t.width,63);assert.equal(g.trimDimensionsMm(t).width,57);assert.equal(t.elements[1].x,px(12));});
test('bleed adjustments expand canvas around fixed trim',()=>{const {t,cards}=fixture();g.changeBleedMode(t,cards,'bleed');t.guides.bleedLinked=false;g.setGuideDistance(t,cards,'bleed','left',5);assert.equal(t.width,71);assert.equal(g.trimDimensionsMm(t).width,63);assert.equal(t.elements[1].x,px(17));});
test('units use exact physical size at DPI',()=>{assert.ok(Math.abs(g.distanceInUnit(3,'px',300)-300*3/25.4)<1e-7);assert.equal(g.distanceMm(1,'in',300),25.4)});
test('invalid insets fail without mutating document',()=>{const {t,cards}=fixture();assert.throws(()=>g.setGuideDistance(t,cards,'safe','top',88),/safe-area/i);assert.equal(g.guidesFor(t).safe.top,4);assert.equal(t.width,63)});