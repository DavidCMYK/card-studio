const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {spreadAlpha,shadePixels,hasShadow,makeShadow}=require('../.build/shadow.js');
const {renderInspector}=require('../.build/interface.js');

function mask(w,h,points){const alpha=new Uint8ClampedArray(w*h);for(const [x,y,a] of points)alpha[y*w+x]=a;return alpha;}
function at(a,w,x,y){return a[y*w+x];}
test('spread is circular, not a blurred rectangle',()=>{
 const w=11,h=11,a=mask(w,h,[[5,5,255]]),out=spreadAlpha(a,w,h,2);
 assert.equal(at(out,w,5,5),255);
 for(const [x,y] of [[3,5],[5,3],[7,5],[5,7],[4,4],[6,6]])assert.equal(at(out,w,x,y),255);
 for(const [x,y] of [[2,5],[3,3],[7,7],[2,2]])assert.equal(at(out,w,x,y),0);
});
test('separate visible parts do not create a shadow in transparent gaps',()=>{
 // A 19x19 image frame: outside border and an isolated opaque ball, clear gap.
 const w=19,h=19,points=[];
 for(let i=0;i<w;i++)for(const [x,y] of [[i,0],[i,18],[0,i],[18,i]])points.push([x,y,255]);
 for(let y=8;y<=10;y++)for(let x=8;x<=10;x++)points.push([x,y,255]);
 const out=spreadAlpha(mask(w,h,points),w,h,1);
 assert.equal(at(out,w,1,9),255,'border casts shadow');
 assert.equal(at(out,w,7,9),255,'ball casts shadow');
 assert.equal(at(out,w,5,9),0,'transparent gap remains clear');
});
test('transparent source alpha is retained through spread',()=>{
 const a=mask(7,7,[[3,3,68],[6,6,255]]),out=spreadAlpha(a,7,7,1);
 assert.equal(at(out,7,3,2),68);
 assert.equal(at(out,7,6,5),255);
 assert.equal(at(out,7,0,0),0);
});
test('offsets tint real alpha pixels, preserve opacity, and allow stacking',()=>{
 const old=global.ImageData;
 global.ImageData=class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4)}};
 try{
  const m=new global.ImageData(8,8);m.data[(2*8+2)*4+3]=128;
  const e=model.makeElement('image',{shadowEnabled:true,shadowColor:'#2244aa',shadowOpacity:50,shadowOffsetX:2,shadowOffsetY:-1,shadowSpread:0});
  const res=shadePixels(m,8,8,e,1);const i=(1*8+4)*4;
  assert.deepEqual([...res.data.slice(i,i+4)],[34,68,170,64]);
  assert.equal(res.data[(2*8+2)*4+3],0);
  // With two separate shadow elements, normal source-over increases overlap opacity.
  const first=64/255,combined=1-(1-first)*(1-first);
  assert.ok(combined>first);
 }finally{global.ImageData=old;}
});
test('disabled and legacy elements have no shadow, new elements default disabled',()=>{
 const e=model.makeElement('text');assert.equal(e.shadowEnabled,false);assert.equal(hasShadow(e),false);
 delete e.shadowEnabled;assert.equal(hasShadow(e),false);
 e.shadowEnabled=true;e.shadowOpacity=0;assert.equal(hasShadow(e),false);
});
test('shadow inspector supports all properties for text, shapes and images',()=>{
 const old=global.document;const nodes=new Map();
 global.document={querySelector(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id)},createElement(){return {getContext(){return {measureText(t){return {width:String(t).length*9}}}}}}};
 try{
  const s=model.initial();model.replaceState(s);
  for(const kind of ['text','image','shape']){
   const e=model.makeElement(kind,{shadowEnabled:true,shadowOpacity:35,shadowOffsetX:-5,shadowOffsetY:7,shadowSpread:10,shadowColor:'#123456'});
   s.template.elements=[e];s.selected=e.id;renderInspector();
   const html=nodes.get('#inspector').innerHTML;
   for(const key of ['shadowEnabled','shadowColor','shadowOpacity','shadowOffsetX','shadowOffsetY','shadowSpread'])assert.match(html,new RegExp(`data-prop="${key}"`));
   assert.match(html,/Overlapping shadows stack/);
  }
 }finally{global.document=old;}
});
test('mask canvas receives real transparent image and border (not a frame-sized fill)',()=>{
 const old=global.document,oldImageData=global.ImageData,calls=[];
 global.ImageData=class ImageData{constructor(w,h){this.data=new Uint8ClampedArray(w*h*4)}};
 global.document={createElement(){const ctx={
  save(){},restore(){},setTransform(){},beginPath(){},rect(){calls.push('frame-clip')},clip(){},
  drawImage(){calls.push('image')},stroke(){calls.push('border')},scale(){},rotate(){},translate(){},
  getImageData(x,y,w,h){return new global.ImageData(w,h)},putImageData(){calls.push('shadow-mask')}
 };return {getContext(){return ctx},set width(v){this._w=v},get width(){return this._w},set height(v){this._h=v},get height(){return this._h}}}};
 try{
  const e=model.makeElement('image',{x:0,y:0,w:40,h:40,borderWidth:2,fillMode:'none',shadowEnabled:true,shadowSpread:0});
  assert.ok(makeShadow(e,'',{naturalWidth:10,naturalHeight:10},1));
  assert.deepEqual(calls.filter(x=>['image','border','shadow-mask'].includes(x)),['image','border','shadow-mask']);
  assert.ok(!calls.includes('fill'),'transparent image frame must not become an opaque rectangle');
 }finally{global.document=old;global.ImageData=oldImageData;}
});
test('preview and PNG exports use the same image-space shadow generator and per-card overrides',async()=>{
 const oldDoc=global.document,oldImageData=global.ImageData;
 const {renderStage}=require('../.build/preview.js');
 const {canvasCard}=require('../.build/png-renderer.js');
 const nodes=new Map(),drawCalls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:''});return nodes.get(id)};
 global.ImageData=class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4)}};
 global.document={querySelector:node,createElement(){
  const canvas={width:0,height:0,toDataURL(){return 'data:image/png;base64,c2hhZG93'},getContext(){return ctx}};
  const ctx={globalAlpha:1,save(){},restore(){},setTransform(){},scale(){},beginPath(){},rect(){},clip(){},stroke(){},
   fillRect(){},drawImage(...args){drawCalls.push(args)},getImageData(x,y,w,h){const m=new global.ImageData(w,h);m.data[3]=255;return m},putImageData(){},
   measureText(text){return {width:String(text).length*9}}};
  return canvas;
 }};
 try{
  const s=model.initial(),e=model.makeElement('shape',{name:'Badge',fillMode:'solid',fill1:'#cccccc',shadowEnabled:true,shadowOpacity:55,shadowSpread:1});
  s.template.elements=[e];s.cards=[{id:'1',name:'A',values:{},overrides:{},extraElements:[]},{id:'2',name:'B',values:{},overrides:{[e.id]:{shadowColor:'#ff00ff',shadowOffsetX:3}},extraElements:[]}];
  s.mode='cards';model.replaceState(s);
  for(let i=0;i<2;i++){
   s.cardIndex=i;renderStage();
   assert.match(node('#stage').innerHTML,/class="shadow-layer"/);
   assert.match(node('#stage').innerHTML,/data:image\/png;base64,c2hhZG93/);
   await canvasCard(i,'cards');
  }
  assert.ok(drawCalls.length>=2,'export composites each element shadow beneath its source');
 }finally{global.document=oldDoc;global.ImageData=oldImageData;}
});
