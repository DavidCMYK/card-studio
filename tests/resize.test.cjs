const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resizedRect,locksImageCornerAspect} = require('../.build/resize.js');
const stage={w:1000,h:1400};
const start={x:70,y:120,w:200,h:100};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.002,`${actual} != ${expected}`);

test('side handles track mouse delta exactly at any zoom and retain opposite edge',()=>{
  const z=2.4;
  const right=resizedRect(start,'e',48/z,0,stage);
  close(right.x,start.x);close(right.w,220);
  const left=resizedRect(start,'w',-48/z,0,stage);
  close(left.x,50);close(left.x+left.w,270);
  const top=resizedRect(start,'n',0,-36/z,stage);
  close(top.y,105);close(top.y+top.h,220);
  const bottom=resizedRect(start,'s',0,36/z,stage);
  close(bottom.h,115);close(bottom.y,120);
});

test('shrink then expand (and vice versa) in one drag is reversible',()=>{
  const before=resizedRect(start,'se',-40,-30,stage);
  const after=resizedRect(start,'se',50,30,stage);
  assert.ok(before.w<start.w&&before.h<start.h);
  assert.ok(after.w>start.w&&after.h>start.h);
  assert.deepEqual(resizedRect(start,'se',0,0,stage),start);
  const big=resizedRect(start,'w',-75,0,stage);
  const small=resizedRect(start,'w',40,0,stage);
  assert.ok(big.w>start.w&&small.w<start.w);
});

test('image fit modes lock corner handle aspect to original frame with no initial jump',()=>{
  for(const mode of ['contain','cover','width','height']){
    assert.equal(locksImageCornerAspect('image',mode,'nw'),true);
    assert.equal(locksImageCornerAspect('image',mode,'se'),true);
    const zero=resizedRect(start,'nw',0,0,stage,true);
    assert.deepEqual(zero,start);
    const bigger=resizedRect(start,'nw',-50,-25,stage,true);
    close(bigger.x+bigger.w,start.x+start.w);
    close(bigger.y+bigger.h,start.y+start.h);
    close(bigger.w/bigger.h,2);
    const smaller=resizedRect(start,'nw',35,18,stage,true);
    assert.ok(smaller.w<start.w&&smaller.h<start.h);
    close(smaller.w/smaller.h,2);
  }
});

test('free/stretch images and edge handles do not force aspect ratio',()=>{
  for(const fit of ['stretch','free'])assert.equal(locksImageCornerAspect('image',fit,'se'),false);
  assert.equal(locksImageCornerAspect('image','contain','e'),false);
  const rect=resizedRect(start,'e',50,0,stage,false);
  close(rect.w,250);close(rect.h,100);
});

test('minimal dimensions clamp without drag hysteresis on reversing',()=>{
  const tiny=resizedRect(start,'se',-500,-500,stage,true);
  assert.ok(tiny.w>=5&&tiny.h>=5);
  const reverse=resizedRect(start,'se',30,15,stage,true);
  assert.ok(reverse.w>start.w&&reverse.h>start.h);
});
