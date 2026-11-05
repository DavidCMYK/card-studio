const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_PRINT_OPTIONS,sheetLayout,cardDimensionsMm,expandPrintCards,backSlot,printSlot}=require('../.build/print-layout.js');
const {buildPrintPdf}=require('../.build/print-pdf.js');
test('A4 portrait lays out standard cards with correct physical coordinates',()=>{
 const l=sheetLayout(DEFAULT_PRINT_OPTIONS,63,88);
 assert.equal(l.columns,3);assert.equal(l.rows,3);
 assert.equal(l.perPage,9);
 assert.ok(l.slots[0].x>=4);assert.ok(l.slots[0].y>=4);
 assert.ok(l.slots.at(-1).x+63<=206);
});
test('quantities and selection create separate print entries, not duplicate card records',()=>{
 assert.deepEqual(expandPrintCards([{printQuantity:3},{printEnabled:false,printQuantity:9},{printQuantity:1}]),[0,0,0,2]);
});
test('landscape long-edge and portrait long-edge backs mirror the correct axis',()=>{
 const portrait=sheetLayout(DEFAULT_PRINT_OPTIONS,63,88),p=portrait.slots[0];
 const b=backSlot(portrait,p,'long');
 assert.ok(Math.abs(b.x-(portrait.width-p.x-63))<1e-8);
 assert.equal(b.y,p.y);
 const landscape=sheetLayout({...DEFAULT_PRINT_OPTIONS,landscape:true},63,88),p2=landscape.slots[0];
 const b2=backSlot(landscape,p2,'long');
 assert.equal(b2.x,p2.x);
 assert.ok(Math.abs(b2.y-(landscape.height-p2.y-88))<1e-8);
});

test('duplex calibration moves only the back PDF page after flip mirroring',()=>{
 for(const landscape of [false,true]){
  for(const duplex of ['long','short']){
   const opts={...DEFAULT_PRINT_OPTIONS,landscape,duplex,backOffsetX:1.25,backOffsetY:-0.75};
   const layout=sheetLayout(opts,63,88),slot=layout.slots[0];
   const mirrored=backSlot(layout,slot,duplex);
   const front=printSlot(layout,slot,'front',opts);
   const back=printSlot(layout,slot,'back',opts);
   assert.deepEqual(front,slot);
   assert.notStrictEqual(front,slot,'The original slot object must not be mutated');
   assert.equal(back.x,mirrored.x+1.25);
   assert.equal(back.y,mirrored.y-.75);
   assert.equal(back.col,slot.col);
   assert.equal(back.row,slot.row);
   assert.deepEqual(slot,layout.slots[0],'Calibration must not modify the imposition grid');
  }
 }
});

test('missing calibration settings in older projects are treated as zero, with bounded inputs',()=>{
 const opts={...DEFAULT_PRINT_OPTIONS,duplex:'long'};
 delete opts.backOffsetX;delete opts.backOffsetY;
 const l=sheetLayout(opts,63,88),first=l.slots[0];
 assert.deepEqual(printSlot(l,first,'back',opts),backSlot(l,first,'long'));
 for(const [x,y] of [[Number.NaN,0],[0,Infinity],[20.001,0],[0,-20.001]])
  assert.throws(()=>printSlot(l,first,'back',{...opts,backOffsetX:x,backOffsetY:y}),/offsets must be between/);
 assert.deepEqual(printSlot(l,first,'front',{...opts,backOffsetX:Infinity}),first,
  'A bad back offset must not interfere with front-only printing');
 assert.equal(DEFAULT_PRINT_OPTIONS.backOffsetX,0);
 assert.equal(DEFAULT_PRINT_OPTIONS.backOffsetY,0);
});
test('no-fit page rejects rather than emitting an empty PDF',()=>{
 assert.throws(()=>sheetLayout({...DEFAULT_PRINT_OPTIONS,margin:40},180,250),/No cards fit/);
});
test('pixel units honor template DPI',()=>{
 const s=cardDimensionsMm({unit:'px',dpi:300,width:750,height:1050});
 assert.equal(s.width,63.5); assert.ok(Math.abs(s.height-88.9)<1e-8);
});
test('PDF writer produces valid page tree, offsets and image stream',async()=>{
 const b=buildPrintPdf([{jpeg:Uint8Array.from([255,216,255,217]),pixelWidth:2,pixelHeight:2,widthMm:210,heightMm:297}]);
 const s=new TextDecoder('latin1').decode(await b.arrayBuffer());
 assert.match(s,/^%PDF-1\.4/);
 assert.match(s,/\/Count 1/);
 assert.match(s,/\/MediaBox \[0 0 595\.27559 841\.88976\]/);
 assert.match(s,/\/DCTDecode/);
 assert.match(s,/startxref\n\d+\n%%EOF/);
});
test('PDF module works in a browser-like sandbox where TextEncoder is absent',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const source=fs.readFileSync(path.resolve(__dirname,'../.build/print-pdf.js'),'utf8');
 const scope={exports:{},Uint8Array,ArrayBuffer,Blob};
 vm.runInNewContext(source,scope);
 const pdf=scope.exports.buildPrintPdf([{
  jpeg:Uint8Array.from([255,216,255,217]),pixelWidth:2,pixelHeight:2,widthMm:210,heightMm:297
 }]);
 assert.equal(pdf.type,'application/pdf');
 assert.ok(Buffer.from(await pdf.arrayBuffer()).toString('latin1').startsWith('%PDF-1.4'));
});
