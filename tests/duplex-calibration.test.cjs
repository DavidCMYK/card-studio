const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const {DEFAULT_PRINT_OPTIONS,sheetLayout,paperDimensions,calibrationScale}=require('../.build/print-layout.js');
const {buildDuplexCalibrationPdf}=require('../.build/print-studio.js');

const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-8,msg||('Expected '+a+' to equal '+b));

test('two-page duplex calibration PDF has only two numbered axes and two back reference lines',async()=>{
 const previousDocument=global.document;
 const pages=[];
 global.document={createElement(tag){
  assert.equal(tag,'canvas');
  const page={texts:[],segments:[],lines:0,rectangles:0};
  pages.push(page);
  let lastMove=null;
  const ctx={
   fillRect(){},fillText(value,x,y){page.texts.push({value,x,y})},
   beginPath(){lastMove=null},
   moveTo(x,y){lastMove={x,y}},
   lineTo(x,y){page.segments.push({from:lastMove,to:{x,y}});lastMove={x,y}},
   stroke(){page.lines++},
   strokeRect(){page.rectangles++}
  };
  return {
   width:0,height:0,getContext(type){assert.equal(type,'2d');return ctx},
   toDataURL(type){assert.equal(type,'image/jpeg');return 'data:image/jpeg;base64,/9j/2Q=='}
  };
 }};
 try{
  const state=model.initial(),opts={...DEFAULT_PRINT_OPTIONS,duplex:'long',dpi:150,backOffsetX:1.7,backOffsetY:-0.9};
  state.printSetup=opts;model.replaceState(state);
  const paper=paperDimensions(opts);
  const pdf=buildDuplexCalibrationPdf(paper,150);
  const content=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  assert.equal(pdf.type,'application/pdf');
  assert.match(content,/^%PDF-1\.4/);
  assert.match(content,/\/Count 2\b/);
  assert.equal((content.match(/\/DCTDecode/g)||[]).length,2);
  assert.equal(pages.length,2);
  assert.deepEqual(pages.map(p=>p.rectangles),[0,0],'Do not print card outlines');
  assert.ok(pages[0].texts.some(t=>t.value==='X offset (mm)'));
  assert.ok(pages[0].texts.some(t=>t.value==='Y offset (mm)'));
  assert.equal(pages[0].texts.filter(t=>t.value==='+2').length,2,'Both axes must mark +2');
  assert.equal(pages[0].texts.filter(t=>t.value==='-2').length,2,'Both axes must mark -2');
  assert.equal(pages[0].texts.filter(t=>t.value==='0').length,2);
  assert.equal(pages[0].texts.filter(t=>/^[+-]?\d+$/.test(t.value)).length,42,
    'Every 2 mm from -20 to +20 should be numbered on each axis');
  assert.equal(pages[1].texts.filter(t=>/^[+-]?\d+$/.test(t.value)).length,0,
    'The reverse side has reference bars but no competing numbers');
  assert.equal(pages[1].segments.length,2,'One back marker for X, one for Y');
  assert.ok(pages[0].segments.length>82,'Half-millimetre ticks should be drawn on both axes');
  const restored=model.loadedProject(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.printSetup.backOffsetX,1.7);
  assert.equal(restored.printSetup.backOffsetY,-.9);
 }finally{
  if(previousDocument===undefined)delete global.document;else global.document=previousDocument;
 }
});

test('reading the back reference directly yields the absolute correction, even with existing offsets',()=>{
 const wanted={x:2,y:-3};
 for(const landscape of [false,true]){
  for(const duplex of ['long','short']){
   for(const saved of [{x:0,y:0},{x:-1.5,y:4.5},{x:2,y:-3}]){
    const opts={...DEFAULT_PRINT_OPTIONS,landscape,duplex,
      backOffsetX:saved.x,backOffsetY:saved.y};
    const paper=paperDimensions(opts);
    const rulerX=calibrationScale(paper,opts,'x');
    const rulerY=calibrationScale(paper,opts,'y');
    const mirrorX=(duplex==='long')!==landscape;
    const signX=mirrorX?-1:1,signY=mirrorX?1:-1;
    // Simulate a printer whose physical duplex drift requires the values
    // +2 mm horizontally and -3 mm vertically on the BACK PDF page.
    const driftX=-signX*wanted.x,driftY=-signY*wanted.y;
    const physicalX=(mirrorX?paper.width-rulerX.backReference.x:rulerX.backReference.x)+driftX;
    const physicalY=(mirrorX?rulerY.backReference.y:paper.height-rulerY.backReference.y)+driftY;
    const tickX=rulerX.ticks.find(t=>t.value===wanted.x);
    const tickY=rulerY.ticks.find(t=>t.value===wanted.y);
    close(physicalX,tickX.x,'X must read the direct correction for '+duplex+' '+landscape);
    close(physicalY,tickY.y,'Y must read the direct correction for '+duplex+' '+landscape);
    assert.equal(rulerX.ticks.length,81);
    assert.equal(rulerY.ticks.length,81);
    assert.ok(rulerX.ticks.every(t=>t.y===rulerX.origin.y));
    assert.ok(rulerY.ticks.every(t=>t.x===rulerY.origin.x));
   }
  }
 }
});

test('calibration does not require the project card size to fit on paper',async()=>{
 const paper=paperDimensions(DEFAULT_PRINT_OPTIONS);
 assert.equal(paper.width,210);assert.equal(paper.height,297);
 assert.throws(()=>sheetLayout({...DEFAULT_PRINT_OPTIONS,margin:40},180,250),/No cards fit/);
 assert.deepEqual(paperDimensions({...DEFAULT_PRINT_OPTIONS,landscape:true}),{width:297,height:210});
 assert.throws(()=>calibrationScale(paper,DEFAULT_PRINT_OPTIONS,'x'),/Select duplex/);
});

test('numbered calibration print action and direct offset fields are wired into the print dialog',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/print-studio.ts'),'utf8');
 assert.match(source,/name="backOffsetX"/);
 assert.match(source,/name="backOffsetY"/);
 assert.match(source,/data-print="calibration"/);
 assert.match(source,/data-print="reset-calibration"/);
 assert.match(source,/const position=printSlot\(l,original,side,options\(\)\)/,
  'Card backs must use the same saved offsets as the calibration test');
 assert.match(source,/download\(buildDuplexCalibrationPdf\(paperDimensions\(options\(\)\),options\(\)\.dpi\)/);
 assert.match(source,/calibrationScale\(l,options\(\),'x'\)/);
 assert.match(source,/calibrationScale\(l,options\(\),'y'\)/);
 assert.match(source,/Enter those numbers <b>directly<\/b>/);
});
