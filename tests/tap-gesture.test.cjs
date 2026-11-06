const {test}=require('node:test');
const assert=require('node:assert/strict');
const gesture=require('../.build/tap-gesture.js');

test('tablet double-taps accept normal touch timing and finger drift',()=>{
 const first={id:'artwork',point:{x:100,y:120},time:1000};
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'artwork',point:{x:132,y:132},time:1500
 }),true,'500ms and ~34px are valid on a tablet');
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'artwork',point:{x:101,y:120},time:1600
 }),true,'boundary at 600ms is accepted');
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'artwork',point:{x:101,y:120},time:1601
 }),false,'separate taps do not merge outside time window');
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'artwork',point:{x:170,y:120},time:1300
 }),false,'distant taps cannot be mistaken for a double-tap');
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'other',point:{x:100,y:120},time:1300
 }),false,'different card elements are not a double-tap');
 assert.equal(gesture.matchesDoubleTap(first,{
  id:'artwork',point:{x:100,y:120},time:900
 }),false,'negative timestamp differences are invalid');
 assert.equal(gesture.matchesDoubleTap(null,first),false);
});
test('stylus and finger use the same direct gesture path; mouse remains desktop-only',()=>{
 assert.equal(gesture.isDirectTouchPointer('touch'),true);
 assert.equal(gesture.isDirectTouchPointer('pen'),true);
 assert.equal(gesture.isDirectTouchPointer('mouse'),false);
 assert.equal(gesture.wasTapMoved({x:0,y:0},{x:3,y:9}),false);
 assert.equal(gesture.wasTapMoved({x:0,y:0},{x:25,y:1}),true,
  'scrolling or dragging must invalidate tap candidates');
});
