const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const history=require('../.build/history.js');

function start(){model.replaceState(model.initial());history.resetHistory();}
test('undo and redo are shared by card and template changes',()=>{
 start();
 const id=model.S.template.elements[0].id,original=model.S.template.elements[0].x;
 model.S.template.elements[0].x+=23;history.checkpoint();
 model.S.cards[0].values[id]='changed';history.checkpoint();
 assert.equal(history.historyState().undoCount,2);
 assert.equal(history.undo(),true);
 assert.equal(model.S.cards[0].values[id],undefined);
 assert.equal(model.S.template.elements[0].x,original+23);
 assert.equal(history.undo(),true);
 assert.equal(model.S.template.elements[0].x,original);
 assert.equal(history.redo(),true);
 assert.equal(model.S.template.elements[0].x,original+23);
 assert.equal(history.redo(),true);
 assert.equal(model.S.cards[0].values[id],'changed');
});
test('many preview updates are one undo step if checkpointed once',()=>{
 start();
 const first=model.S.template.elements[0],initialX=first.x;
 for(let n=0;n<70;n++)first.x=initialX+n+1;
 history.checkpoint();
 assert.equal(history.historyState().undoCount,1);
 history.undo();
 assert.equal(model.S.template.elements[0].x,initialX);
});
test('undo after uncommitted edit works and fresh edit invalidates redo',()=>{
 start();const first=model.S.template.elements[0];
 first.y+=10;
 assert.equal(history.undo(),true);
 assert.equal(history.historyState().canRedo,true);
 model.S.template.elements[0].y+=17;
 history.checkpoint();
 assert.equal(history.historyState().canRedo,false);
});
test('undo restores deleted artwork metadata and bundled font data',()=>{
 start();
 const src='data:font/ttf;base64,'+'A'.repeat(10000);
 model.S.fonts=[{family:'Portable Test',filename:'portable.ttf',data:src}];
 model.S.sets=[{id:'set1',name:'Art',images:[{name:'a.png',data:'data:image/png;base64,QUJD'}]}];
 history.checkpoint();
 model.S.sets[0].images=[];model.S.fonts=[];
 history.checkpoint();
 history.undo();
 assert.equal(model.S.fonts[0].data,src);
 assert.equal(model.S.sets[0].images[0].data,'data:image/png;base64,QUJD');
 history.redo();assert.equal(model.S.sets[0].images.length,0);
});
test('bounded document history discards the oldest steps',()=>{
 start();for(let i=0;i<75;i++){model.S.projectName='Project '+i;history.checkpoint();}
 assert.equal(history.historyState().undoCount,60);
});
