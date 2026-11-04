const {test}=require('node:test'),assert=require('node:assert/strict');
const g=require('../.build/card-guides.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} should equal ${b}`);
function doc(mode='bleed'){
 const t={unit:'mm',dpi:300,width:69,height:94,
  elements:[{id:'a',x:2,y:8,w:20,h:18}],
  guides:{...structuredClone(g.DEFAULT_GUIDES),bleedMode:mode}};
 if(mode==='trim'){t.width=63;t.height=88;}
 const cards=[{extraElements:[{id:'b',x:4,y:4,w:30,h:30}],overrides:{a:{x:11,y:16}}}];
 return {t,cards};
}
const art=(t,cards)=>structuredClone({els:t.elements,cards});
const sizes=t=>[g.canvasDimensionsMm(t),g.trimDimensionsMm(t),g.safeDimensionsMm(t)];
test('new and legacy canvas meanings',()=>{
 const {t}=doc();assert.deepEqual(sizes(t),[{width:69,height:94},{width:63,height:88},{width:55,height:80}]);
 const l={unit:'mm',dpi:300,width:63,height:88};assert.equal(g.trimDimensionsMm(l).width,63);
});
test('editing cut size changes canvas, preserves bleed and safe buffers',()=>{
 const {t,cards}=doc(),before=art(t,cards);
 g.setCutDimension(t,'width',66);g.setCutDimension(t,'height',90);
 assert.deepEqual(sizes(t),[{width:72,height:96},{width:66,height:90},{width:58,height:82}]);
 assert.deepEqual(art(t,cards),before);
});
test('editing canvas changes bleed but not cut, safe or artwork',()=>{
 const {t,cards}=doc(),before=art(t,cards);
 g.setCanvasDimension(t,'width',75);
 const [canvas,trim,safe]=sizes(t);
 near(canvas.width,75);near(trim.width,63);near(safe.width,55);
 near(t.guides.bleed.left,6);near(t.guides.bleed.right,6);
 near(t.guides.bleed.top,3);near(t.guides.bleed.bottom,3);
 assert.equal(t.guides.bleedLinked,false);
 assert.deepEqual(art(t,cards),before);
});
test('editing canvas cannot shrink below cut, with no mutation',()=>{
 const {t,cards}=doc(); const before=structuredClone({t,cards});
 assert.throws(()=>g.setCanvasDimension(t,'width',62.999),/smaller/);
 assert.deepEqual({t,cards},before);
});
test('changing linked bleed changes canvas, not trim',()=>{
 const {t,cards}=doc(),before=art(t,cards);
 g.setGuideDistance(t,cards,'bleed','top',5);
 assert.deepEqual(sizes(t),[{width:73,height:98},{width:63,height:88},{width:55,height:80}]);
 assert.deepEqual(art(t,cards),before);
});
test('changing a single bleed edge only changes corresponding canvas axis',()=>{
 const {t,cards}=doc();g.setGuideLinked(t,'bleed',false);
 g.setGuideDistance(t,cards,'bleed','right',8);
 assert.deepEqual(sizes(t),[{width:74,height:94},{width:63,height:88},{width:55,height:80}]);
 assert.equal(t.guides.bleed.right,8);assert.equal(t.guides.bleed.left,3);
});
test('trim mode + bleed entry activates bleed without moving artwork',()=>{
 const {t,cards}=doc('trim'),before=art(t,cards);
 g.setGuideDistance(t,cards,'bleed','top',5);
 assert.equal(t.guides.bleedMode,'bleed');
 assert.deepEqual(sizes(t),[{width:73,height:98},{width:63,height:88},{width:55,height:80}]);
 assert.deepEqual(art(t,cards),before);
});
test('changing mode preserves cut but changes canvas',()=>{
 const {t,cards}=doc('trim'),before=art(t,cards);
 g.changeBleedMode(t,cards,'bleed');assert.deepEqual(sizes(t),[{width:69,height:94},{width:63,height:88},{width:55,height:80}]);
 g.changeBleedMode(t,cards,'trim');assert.deepEqual(sizes(t),[{width:63,height:88},{width:63,height:88},{width:55,height:80}]);
 assert.deepEqual(art(t,cards),before);
});
test('editing safety buffer modifies safe zone but no other dimension',()=>{
 const {t,cards}=doc(),before=art(t,cards);
 g.setGuideDistance(t,cards,'safe','top',6);
 assert.deepEqual(sizes(t),[{width:69,height:94},{width:63,height:88},{width:51,height:76}]);
 assert.deepEqual(art(t,cards),before);
});
test('editing safe zone dims changes buffers, cut/canvas remain',()=>{
 const {t,cards}=doc(),before=art(t,cards);
 g.setSafeZoneDimension(t,'width',57);g.setSafeZoneDimension(t,'height',78);
 assert.deepEqual(sizes(t),[{width:69,height:94},{width:63,height:88},{width:57,height:78}]);
 near(t.guides.safe.left,3);near(t.guides.safe.right,3);
 near(t.guides.safe.top,5);near(t.guides.safe.bottom,5);
 assert.equal(t.guides.safeLinked,false);assert.deepEqual(art(t,cards),before);
});
test('safe zone cannot exceed trim and cannot be negative',()=>{
 const {t,cards}=doc(),before=structuredClone({t,cards});
 assert.throws(()=>g.setSafeZoneDimension(t,'width',64),/cannot exceed/);
 assert.throws(()=>g.setSafeZoneDimension(t,'height',0),/greater/);
 assert.deepEqual({t,cards},before);
});
test('pixel / inch conversions preserve physical dimensions and invariants',()=>{
 const {t}=doc();g.setGuideUnit(t,'px');t.unit='px';t.width=69*300/25.4;t.height=94*300/25.4;
 g.setCutDimension(t,'width',65*300/25.4);near(g.canvasDimensionsMm(t).width,71);near(g.trimDimensionsMm(t).width,65);
 g.setCanvasDimension(t,'width',75*300/25.4);near(g.trimDimensionsMm(t).width,65);
 g.setSafeZoneDimension(t,'width',60*300/25.4);near(g.safeDimensionsMm(t).width,60);
 near(g.distanceInUnit(3,'in',300),3/25.4);
});
test('unlinked asymmetric margins remain nonnegative and target dimensions match',()=>{
 const {t,cards}=doc();g.setGuideLinked(t,'bleed',false);
 g.setGuideDistance(t,cards,'bleed','left',1);g.setGuideDistance(t,cards,'bleed','right',5);
 g.setCanvasDimension(t,'width',65);near(g.trimDimensionsMm(t).width,63);
 assert.ok(t.guides.bleed.left>=0&&t.guides.bleed.right>=0);
 near(t.guides.bleed.left+t.guides.bleed.right,2);
 g.setGuideLinked(t,'safe',false);
 g.setGuideDistance(t,cards,'safe','left',1);g.setGuideDistance(t,cards,'safe','right',6);
 g.setSafeZoneDimension(t,'width',62);near(g.safeDimensionsMm(t).width,62);
 assert.ok(t.guides.safe.left>=0&&t.guides.safe.right>=0);
});
test('cut and safe guides have independent radii; canvas edge is never a rounded guide',()=>{
 const {t,cards}=doc(),before=structuredClone({t,cards});
 assert.deepEqual(g.guidesFor(t).radii,{cut:0,safe:0});
 g.setGuideCornerRadius(t,'cut',3);
 g.setGuideCornerRadius(t,'safe',2);
 assert.deepEqual(g.guideRects(t).radii,{cut:3,safe:2});
 assert.equal(t.width,before.t.width);assert.equal(t.height,before.t.height);
 assert.deepEqual(art(t,cards),art(before.t,before.cards));
 assert.equal('canvas' in g.guidesFor(t).radii,false);
 assert.throws(()=>g.setGuideCornerRadius(t,'canvas',4),/Unknown corner-radius guide/);
});

test('radii are physical millimetres, independent of selected units and DPI',()=>{
 const {t}=doc();
 g.setGuideCornerRadius(t,'cut',6.35);
 g.setGuideCornerRadius(t,'safe',2.54);
 g.setGuideUnit(t,'in');
 near(g.distanceInUnit(g.guidesFor(t).radii.cut,'in',300),.25);
 g.setGuideUnit(t,'px');
 near(g.distanceInUnit(g.guidesFor(t).radii.safe,'px',300),30);
 assert.deepEqual(g.guideRects(t).radii,{cut:6.35,safe:2.54});
});

test('radius edits reject negatives, oversized and invalid values without modifying geometry',()=>{
 const {t,cards}=doc(),before=structuredClone({t,cards});
 for(const radius of [-1,Infinity,NaN,32]){
  assert.throws(()=>g.setGuideCornerRadius(t,'cut',radius),/radius/i);
 }
 assert.throws(()=>g.setGuideCornerRadius(t,'safe',28),/radius/i);
 assert.deepEqual({t,cards},before);
});

test('cut and safe radii clamp to smaller limits when corresponding guide shrinks',()=>{
 const {t,cards}=doc();
 g.setGuideCornerRadius(t,'cut',25);
 g.setGuideCornerRadius(t,'safe',20);
 g.setSafeZoneDimension(t,'width',30);
 near(g.guidesFor(t).radii.cut,25);
 near(g.guidesFor(t).radii.safe,15);
 g.setCutDimension(t,'width',40);
 near(g.guidesFor(t).radii.cut,20);
 assert.deepEqual(g.trimDimensionsMm(t),{width:40,height:88});
 near(g.guidesFor(t).radii.safe,3.5);
 assert.equal(cards[0].extraElements[0].x,4);
});

test('legacy canvas corner radius is ignored and removed when guide metadata is edited',()=>{
 const {t}=doc();
 t.guides.radii={canvas:12,cut:2,safe:1};
 assert.deepEqual(g.guidesFor(t).radii,{cut:2,safe:1});
 g.setGuideCornerRadius(t,'safe',3);
 assert.deepEqual(t.guides.radii,{cut:2,safe:3});
});

test('editor overlay rounds cut and safe guides only, including no-bleed cut line',()=>{
 const {guideOverlay}=require('../.build/guide-overlay.js');
 const {t}=doc();
 g.setGuideCornerRadius(t,'cut',3);
 g.setGuideCornerRadius(t,'safe',2);
 let html=guideOverlay(t,'template',1);
 assert.match(html,/guide-trim[^>]*border-radius:11\.33858[0-9]*px/);
 assert.match(html,/guide-safe[^>]*border-radius:7\.55905[0-9]*px/);
 assert.doesNotMatch(html,/guide-canvas/);
 g.changeBleedMode(t,[],'trim');
 html=guideOverlay(t,'template',1);
 assert.match(html,/guide-trim/,'cut line still has rounded corners at the canvas edge');
 assert.doesNotMatch(html,/guide-canvas/);
 t.guides.dimUnsafe=true;
 html=guideOverlay(t,'template',1);
 assert.match(html,/guide-dim-rounded/,'unsafe mask follows safe-zone rounding');
});

test('guide borders do not draw a solid highlight underneath the dashed line',()=>{
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../styles.css'),'utf8');
 assert.match(css,/\.card-guide-overlay \.guide-trim,\.card-guide-overlay \.guide-safe\{[^}]*border:2px dashed/);
 for(const guide of ['trim','safe']){
  const rule=css.split('\n').find(line=>line.startsWith('.card-guide-overlay .guide-'+guide+'{'));
  assert.ok(rule,'Missing '+guide+' guide CSS');
  assert.doesNotMatch(rule,/box-shadow:(?!none)/,'Solid shadow overlays the dashed '+guide+' guide');
 }
});

test('pixel measurements display and parse only nearest whole export pixels',()=>{
 const dpi=300,mmPerPx=25.4/dpi;
 assert.equal(g.displayedDistance(3,'px',dpi),'35');
 assert.equal(g.displayedDistance(2,'px',dpi),'24');
 assert.equal(g.displayedDistance(40.49*mmPerPx,'px',dpi),'40');
 assert.equal(g.displayedDistance(40.5*mmPerPx,'px',dpi),'41');
 near(g.distanceMm(35.49,'px',dpi),35*mmPerPx);
 near(g.distanceMm(35.5,'px',dpi),36*mmPerPx);
 near(g.distanceMm(2.75,'mm',dpi),2.75);
 near(g.distanceMm(0.5,'in',dpi),12.7);
 assert.equal(g.displayedDistance(2.75,'mm',dpi),'2.75');
});

test('editing guides in pixels snaps physical distances, without rounding when units are merely switched',()=>{
 const {t,cards}=doc(),original=structuredClone(sizes(t));
 g.setGuideUnit(t,'px');
 assert.deepEqual(sizes(t),original,'display unit alone cannot move the guides');
 assert.equal(g.displayedDistance(t.guides.bleed.top,'px',300),'35');
 const value=g.distanceMm(35.7,'px',300);
 g.setGuideDistance(t,cards,'safe','top',value);
 near(g.guideRects(t).settings.safe.top,36*25.4/300);
 g.setGuideCornerRadius(t,'cut',g.distanceMm(12.5,'px',300));
 near(g.guidesFor(t).radii.cut,13*25.4/300);
 assert.equal(g.displayedDistance(g.guidesFor(t).radii.cut,'px',300),'13');
 assert.equal(g.displayedDistance(g.guideRects(t).trim.w,'px',300),'744');
});
