const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const press=require('../.build/image-double-press.js');
test('double press is recognized by time, distance and stable element ID',()=>{
 const first={id:'art',x:100,y:200,at:1000};
 assert.equal(press.isImageDoublePress(first,{id:'art',x:111,y:209,at:1420}),true);
 assert.equal(press.isImageDoublePress(first,{id:'art',x:132,y:200,at:1600}),true);
 assert.equal(press.isImageDoublePress(first,{id:'art',x:132.1,y:200,at:1600}),false);
 assert.equal(press.isImageDoublePress(first,{id:'art',x:100,y:200,at:1601}),false);
 assert.equal(press.isImageDoublePress(first,{id:'other',x:100,y:200,at:1200}),false);
 assert.equal(press.isImageDoublePress(first,{id:'art',x:100,y:200,at:900}),false);
 assert.equal(press.isImageDoublePress(null,first),false);
});
test('desktop image handler uses stable capture phase before stage selection redraw',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'../src/editor.ts'),'utf8');
 assert.match(editor,/#canvasOuter'\)\.addEventListener\('pointerdown',[\s\S]*?e\.stopImmediatePropagation\(\);return;/);
 const original=editor.indexOf("document.addEventListener('pointermove',e=>{if(!drag)");
 const stable=editor.indexOf("document.addEventListener('pointermove',(e:PointerEvent)=>{");
 assert.ok(original>=0&&stable>original,
  'original drag listener must remain first for normal dragging and smoke tests');
 assert.match(editor,/isImageDoublePress\(previous,candidate\)/);
 assert.match(editor,/if\(enterImageReposition\(possibleId!\)\)/);
 assert.match(editor,/document\.documentElement\?\.dataset\.layout==='mobile'/);
});
