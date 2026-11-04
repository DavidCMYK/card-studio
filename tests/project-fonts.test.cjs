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
