const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {mergeShadowPixels,mergedShadowCanvas}=require('../.build/shadow.js');
const {canvasCard}=require('../.build/png-renderer.js');
const {renderStage}=require('../.build/preview.js');
const {renderInspector}=require('../.build/interface.js');
const pixel=(img,x,y)=>Array.from(img.data.slice((y*img.width+x)*4,(y*img.width+x)*4+4));
const make=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
const set=(img,x,y,rgba)=>img.data.set(rgba,(y*img.width+x)*4);

test('merge keeps the maximum alpha at overlap; additive source-over would darken it',()=>{
 const result=make(4,3),s1=make(3,3),s2=make(3,3);
 set(s1,1,1,[120,0,0,102]);set(s1,2,1,[120,0,0,200]);
 set(s2,0,1,[0,20,140,90]);set(s2,1,1,[0,20,140,220]);
 mergeShadowPixels(result,s1,0,0);mergeShadowPixels(result,s2,1,0);
 assert.deepEqual(pixel(result,1,1),[120,0,0,102]);
 assert.deepEqual(pixel(result,2,1),[0,20,140,220]);
 assert.deepEqual(pixel(result,0,0),[0,0,0,0]);
 const cumulative=Math.round(255*(1-(1-102/255)*(1-90/255)));
 assert.ok(cumulative>102,'additive mode has higher combined opacity');
});

test('merge clips each shadow at the stage edge and breaks equal-alpha ties by layer order',()=>{
 const dest=make(3,3),a=make(3,3),b=make(3,3);
 set(a,2,2,[255,0,0,125]);set(b,0,0,[0,255,0,125]);
 mergeShadowPixels(dest,a,-1,-1);
 assert.deepEqual(pixel(dest,1,1),[255,0,0,125]);
 mergeShadowPixels(dest,b,1,1);
 assert.deepEqual(pixel(dest,1,1),[0,255,0,125]);
});

test('merge is project-wide, saved in JSON, and editable in Card setup',()=>{
 const original=global.document,ui=new Map();
 global.document={querySelector(s){if(!ui.has(s))ui.set(s,{innerHTML:'',textContent:''});return ui.get(s)}};
 try{
  const state=model.initial();model.replaceState(state);
  assert.equal(state.template.shadowOverlapMode,'add');
  state.selected=null;state.mode='template';renderInspector();
  assert.match(ui.get('#inspector').innerHTML,/data-prop="template.shadowOverlapMode"/);
  assert.match(ui.get('#inspector').innerHTML,/Merge \(highest opacity only\)/);
  state.template.shadowOverlapMode='merge';
  assert.equal(JSON.parse(JSON.stringify(state)).template.shadowOverlapMode,'merge');
 }finally{global.document=original}
});

function browser(){
 const origDoc=global.document,origImageData=global.ImageData,draws=[],nodes=new Map(),canvases=[];
 global.ImageData=class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4)}};
 const get=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:''});return nodes.get(id)};
 global.document={querySelector:get,createElement(){
  const canvas={width:0,height:0};let pixels=null;
  const ctx={globalAlpha:1,save(){},restore(){},scale(){},setTransform(){},translate(){},rotate(){},beginPath(){},rect(){},clip(){},stroke(){},fillRect(){},
   measureText(s){return{width:String(s).length*8}},drawImage(...args){draws.push({canvas,args})},
   getImageData(x,y,w,h){if(pixels)return pixels;const data=new global.ImageData(w,h);data.data[3]=255;return data},
   putImageData(img){pixels=img}};
  canvas.getContext=()=>ctx;canvas.toDataURL=()=>`data:image/png;base64,bWVya2U=`;
  canvases.push({canvas,ctx,get pixels(){return pixels}});return canvas;
 }};
 return {draws,nodes,canvases,get,restore(){global.document=origDoc;global.ImageData=origImageData}};
}

test('Merge previews one backdrop; Add previews individual shadows',async()=>{
 const b=browser();
 try{
  const state=model.initial();state.template.width=100;state.template.height=100;state.template.unit='px';state.template.dpi=96;state.zoom=1;
  const first=model.makeElement('shape',{name:'A',x:5,y:7,w:15,h:15,fillMode:'none',shadowEnabled:true,shadowSpread:0});
  const second=model.makeElement('shape',{name:'B',x:10,y:12,w:15,h:15,fillMode:'none',shadowEnabled:true,shadowSpread:0});
  state.template.elements=[first,second];model.replaceState(state);
  state.template.shadowOverlapMode='merge';renderStage();
  const html=b.get('#stage').innerHTML;
  assert.equal((html.match(/class="merged-shadow-layer"/g)||[]).length,1);
  assert.doesNotMatch(html,/class="shadow-layer"/);
  assert.ok(html.indexOf('merged-shadow-layer')<html.indexOf('data-id="'+first.id+'"'));
  const offset=b.draws.length;await canvasCard(0,'template');
  const newDraws=b.draws.slice(offset);
  assert.equal(newDraws.length,1,'one merged shadow canvas in PNG');
  assert.equal(newDraws[0].args.length,5,'shadow drawn over entire card');
  state.template.shadowOverlapMode='add';renderStage();
  assert.equal((b.get('#stage').innerHTML.match(/class="shadow-layer"/g)||[]).length,2);
  assert.doesNotMatch(b.get('#stage').innerHTML,/class="merged-shadow-layer"/);
  const addOffset=b.draws.length;await canvasCard(0,'template');
  assert.equal(b.draws.length-addOffset,2,'add draws each shadow independently');
 }finally{b.restore()}
});

test('merged canvas respects placements, offsets and winner RGB',()=>{
 const b=browser();
 try{
  const c=global.document.createElement('canvas');c.width=2;c.height=2;
  const m=new global.ImageData(2,2);set(m,1,1,[5,6,7,123]);c.getContext().putImageData(m);
  const out=mergedShadowCanvas(5,5,1,[{graphic:{canvas:c,pad:1,ratio:1},x:3,y:3}]);
  assert.ok(out);
  const output=out.getContext().getImageData(0,0,5,5);
  assert.deepEqual(pixel(output,3,3),[5,6,7,123]);
  assert.deepEqual(pixel(output,4,4),[0,0,0,0]);
 }finally{b.restore()}
});
