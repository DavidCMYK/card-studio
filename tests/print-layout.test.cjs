const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_PRINT_OPTIONS,sheetLayout,cardDimensionsMm,expandPrintCards,backSlot}=require('../.build/print-layout.js');
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