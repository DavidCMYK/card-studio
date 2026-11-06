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

test('mobile selection shows an explicit artwork mode toggle only for movable image frames',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const src=fs.readFileSync(path.join(root,'src/mobile-interface.ts'),'utf8');
 const styles=fs.readFileSync(path.join(root,'mobile.css'),'utf8');
 assert.match(src,/id="mobileArtworkModeButton"/);
 assert.match(src,/selected\?\.kind==='image'&&canRepositionImage\(effective\(selected\)\)/);
 assert.match(src,/artworkButton\.dataset\.action=active\?'finish-reposition-image':'reposition-image'/);
 assert.match(src,/artworkButton\.hidden=!eligible/);
 assert.match(src,/artworkButton\.setAttribute\('aria-pressed',String\(!!active\)\)/);
 assert.match(styles,/#mobileArtworkModeButton\[hidden\]\{display:none\}/);
});
