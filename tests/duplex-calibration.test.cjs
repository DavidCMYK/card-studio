const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../.build/model.js');
const {DEFAULT_PRINT_OPTIONS,sheetLayout,printSlot}=require('../.build/print-layout.js');
const {buildDuplexCalibrationPdf}=require('../.build/print-studio.js');

test('duplex calibration PDF contains two pages with matching front/back physical targets',async()=>{
 const previousDocument=global.document;
 const rectangles=[];
 global.document={createElement(tag){
  assert.equal(tag,'canvas');
  const sheet=[];
  rectangles.push(sheet);
  const ctx={
   fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},arc(){},stroke(){},
   strokeRect(x,y,w,h){sheet.push({x,y,w,h})}
  };
  return {
   width:0,height:0,getContext(type){assert.equal(type,'2d');return ctx},
   toDataURL(type){assert.equal(type,'image/jpeg');return 'data:image/jpeg;base64,/9j/2Q=='}
  };
 }};
 try{
  const state=model.initial();
  const opts={...DEFAULT_PRINT_OPTIONS,duplex:'long',dpi:150,backOffsetX:1.7,backOffsetY:-0.9};
  state.printSetup=opts;model.replaceState(state);
  const layout=sheetLayout(opts,63,88);
  const pdf=buildDuplexCalibrationPdf(layout,150);
  const content=Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  assert.equal(pdf.type,'application/pdf');
  assert.match(content,/^%PDF-1\.4/);
  assert.match(content,/\/Count 2\b/);
  assert.equal((content.match(/\/DCTDecode/g)||[]).length,2);
  assert.equal(rectangles.length,2);
  assert.equal(rectangles[0].length,layout.slots.length);
  assert.equal(rectangles[1].length,layout.slots.length);
  const scale=150/25.4;
  for(const [index,original] of layout.slots.entries()){
   const front=printSlot(layout,original,'front',opts);
   const back=printSlot(layout,original,'back',opts);
   assert.ok(Math.abs(rectangles[0][index].x-front.x*scale)<1e-8);
   assert.ok(Math.abs(rectangles[0][index].y-front.y*scale)<1e-8);
   assert.ok(Math.abs(rectangles[1][index].x-back.x*scale)<1e-8);
   assert.ok(Math.abs(rectangles[1][index].y-back.y*scale)<1e-8);
  }
  const restored=model.loadedProject(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.printSetup.backOffsetX,1.7);
  assert.equal(restored.printSetup.backOffsetY,-.9);
 }finally{
  if(previousDocument===undefined)delete global.document;else global.document=previousDocument;
 }
});

test('duplex calibration settings and export are connected to normal print controls',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/print-studio.ts'),'utf8');
 assert.match(source,/name="backOffsetX"/);
 assert.match(source,/name="backOffsetY"/);
 assert.match(source,/data-print="calibration"/);
 assert.match(source,/data-print="reset-calibration"/);
 assert.match(source,/const position=printSlot\(l,original,side,options\(\)\)/);
 assert.match(source,/download\(buildDuplexCalibrationPdf\(layout\(\),options\(\)\.dpi\)/);
 assert.match(source,/printSlot\(l,slot,side,options\(\)\)/);
});
