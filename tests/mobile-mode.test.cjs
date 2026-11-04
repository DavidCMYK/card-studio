const test = require('node:test');
const assert = require('node:assert/strict');
const {chooseEditorLayout,fitCardZoom} = require('../.build/mobile-mode.js');
test('phone and touch tablet choose mobile while large desktop keeps desktop',()=>{
 assert.equal(chooseEditorLayout(390,true),'mobile');
 assert.equal(chooseEditorLayout(1024,true),'mobile');
 assert.equal(chooseEditorLayout(1440,true),'desktop');
 assert.equal(chooseEditorLayout(1200,false),'desktop');
 assert.equal(chooseEditorLayout(390,false),'mobile');
});
test('manual layout selection overrides automatic detection',()=>{
 assert.equal(chooseEditorLayout(390,true,'desktop'),'desktop');
 assert.equal(chooseEditorLayout(1900,false,'mobile'),'mobile');
});
test('canvas fits available space without changing document geometry',()=>{
 const fit=fitCardZoom(390,600,238,333);
 assert.ok(fit>1&&fit<2);
 assert.equal(fitCardZoom(0,0,238,333),.3);
 assert.equal(fitCardZoom(1200,1600,238,333),3);
 assert.equal(fitCardZoom(390,600,0,333),1);
});
