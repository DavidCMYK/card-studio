const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {getImageRef,imageCache}=require('../.build/image-sets.js');
const {renderInspector}=require('../.build/interface.js');
const {renderStage}=require('../.build/preview.js');
const {canvasCard}=require('../.build/png-renderer.js');

function setup(){
 const state=model.initial();
 const frame=state.template.elements.find(el=>el.kind==='image');
 state.template.elements=[frame];
 state.sets=[{id:'art',name:'Art',images:[
  {name:'a.png',data:'data:image/png;base64,YQ=='},
  {name:'b.png',data:'data:image/png;base64,Yg=='}
 ]},{id:'other',name:'Other',images:[{name:'c.png',data:'data:image/png;base64,Yw=='}]}];
 state.cards.push({id:'next',name:'Next',values:{},overrides:{},extraElements:[]});
 state.cards[0].values[frame.id]='none';
 state.cards[1].values[frame.id]='Other/c.png';
 frame.autoSet='art';frame.autoMode='single';frame.singleImage='b.png';
 model.replaceState(state);
 return {state,frame};
}
function dom(){
 const nodes=new Map();
 const get=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',textContent:'',style:{},classList:{toggle(){}}});return nodes.get(k)};
 const draws=[],previous=global.document;
 global.document={querySelector:get,createElement(){
  const ctx=new Proxy({drawImage(im){draws.push(im)}},{get(o,key){if(key in o)return o[key];return ()=>{}}});
  return {width:0,height:0,getContext(){return ctx}};
 }};
 return {get,draws,restore(){global.document=previous}};
}
test('fixed image takes priority over all card values and stays fixed in template',()=>{
 const {state,frame}=setup();
 for(const ci of [0,1])assert.equal(getImageRef(frame,ci,'cards'),state.sets[0].images[1]);
 assert.equal(getImageRef(frame,0,'template'),state.sets[0].images[1]);
 assert.equal(JSON.parse(JSON.stringify(state)).template.elements[0].singleImage,'b.png');
});
test('missing fixed image does not silently fall back, and old assignment modes still work',()=>{
 const {state,frame}=setup();
 frame.singleImage='missing.png';assert.equal(getImageRef(frame,1,'cards'),null);
 frame.singleImage='b.png';frame.autoSet='other';assert.equal(getImageRef(frame,1,'cards'),null);
 frame.singleImage='c.png';assert.equal(getImageRef(frame,1,'cards'),state.sets[1].images[0]);
 frame.autoSet='art';frame.autoMode='cycle';assert.equal(getImageRef(frame,0,'cards'),null);
 state.cards[0].values={};state.cards[1].values={};
 assert.equal(getImageRef(frame,0,'cards').name,'a.png');
 assert.equal(getImageRef(frame,1,'cards').name,'b.png');
});
test('template inspector lets user select one file, card inspector shows a fixed assignment',()=>{
 const {state,frame}=setup(),ui=dom();
 try{
  state.selected=frame.id;renderInspector();
  let html=ui.get('#inspector').innerHTML;
  assert.match(html,/Single Image \(same on all cards\)/);
  assert.match(html,/data-prop="singleImage"/);
  assert.match(html,/b\.png/);
  assert.doesNotMatch(html,/c\.png/);
  state.mode='cards';renderInspector();
  assert.match(ui.get('#inspector').innerHTML,/Fixed image/);
  assert.doesNotMatch(ui.get('#inspector').innerHTML,/data-cardvalue=/);
 }finally{ui.restore()}
});
test('card preview and PNG export use the same selected image',async()=>{
 const {state}=setup(),ui=dom();
 const data=state.sets[0].images[1].data,im={naturalWidth:100,naturalHeight:100};
 imageCache.set(data,{im,loaded:true,error:false});
 try{
  state.mode='cards';
  for(let i=0;i<2;i++){
   state.cardIndex=i;renderStage();assert.ok(ui.get('#stage').innerHTML.includes(data));
   await canvasCard(i,'cards');
  }
  assert.deepEqual(ui.draws,[im,im]);
 }finally{imageCache.clear();ui.restore()}
});
