const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const fonts=require('../.build/project-fonts.js');

test('portable fonts can be attached to projects and tracked against used families',()=>{
 model.replaceState(model.initial());
 model.S.template.elements.find(x=>x.kind==='text').font='Test Script';
 assert.ok(fonts.unbundledFontFamilies().includes('Test Script'));
 fonts.upsertFont({family:'Test Script',filename:'script.ttf',data:'data:font/ttf;base64,QUJD',weight:400,style:'normal'});
 assert.ok(fonts.bundledFontFamilies().includes('Test Script'));
 assert.ok(!fonts.unbundledFontFamilies().includes('Test Script'));
 assert.equal(model.S.fonts.length,1);
 fonts.upsertFont({family:'Test Script',filename:'new.ttf',data:'data:font/ttf;base64,QkNE',weight:400,style:'normal'});
 assert.equal(model.S.fonts.length,1,'same family and weight replaces existing font');
});
test('font faces are loaded through browser font API',async()=>{
 model.replaceState(model.initial());
 const loaded=[],deleted=[];
 class FakeFace{
  constructor(family,source,metadata){this.family=family;this.source=source;this.metadata=metadata}
  async load(){loaded.push(this);return this}
 }
 global.FontFace=FakeFace;
 global.document={fonts:{add(face){},delete(face){deleted.push(face)}}};
 model.S.fonts=[{family:'Test Script',filename:'script.ttf',data:'data:font/ttf;base64,QUJD',weight:700,style:'italic'}];
 await fonts.activateProjectFonts();
 await fonts.waitForProjectFonts();
 assert.equal(loaded.length,1);
 assert.equal(loaded[0].family,'Test Script');
 assert.equal(loaded[0].metadata.weight,'700');
 model.S.fonts=[];
 await fonts.activateProjectFonts();
 assert.equal(deleted.length,1);
 delete global.FontFace;delete global.document;
});

test('importing font files stores bytes inside the project',async()=>{
 model.replaceState(model.initial());
 class FileReaderStub{
  readAsDataURL(blob){this.result='data:font/ttf;base64,QUJDRA==';queueMicrotask(()=>this.onload?.())}
 }
 global.FileReader=FileReaderStub;
 const {added,skipped}=await fonts.importFontFiles([{name:'Custom-Lab-Regular.ttf',size:4,type:'font/ttf'}],()=> 'Custom Lab');
 assert.equal(added,1);assert.equal(skipped,0);
 assert.equal(model.S.fonts[0].family,'Custom Lab');
 assert.equal(model.S.fonts[0].data,'data:font/ttf;base64,QUJDRA==');
 delete global.FileReader;
});

// The Local Font Access API requires a direct user gesture. A confirmation
// dialog before queryLocalFonts can consume that gesture in Chromium.
test('installed font request happens before licensing confirmation',async()=>{
 model.replaceState(model.initial());
 const order=[];
 const oldWindow=global.window,oldConfirm=global.confirm;
 global.window={queryLocalFonts(){order.push('query');return Promise.resolve([])}};
 global.confirm=()=>{order.push('confirm');return false};
 try{
  const result=await fonts.embedInstalledUsedFonts();
  assert.deepEqual(order,['query','confirm']);
  assert.equal(result.added,0);
  assert.ok(result.missing.length>0);
 }finally{
  if(oldWindow===undefined)delete global.window;else global.window=oldWindow;
  if(oldConfirm===undefined)delete global.confirm;else global.confirm=oldConfirm;
 }
});

test('default system fonts are not considered portable without embedding',()=>{
 model.replaceState(model.initial());
 assert.ok(fonts.unbundledFontFamilies().includes('Georgia'));
});
