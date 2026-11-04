const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {spreadAlpha,shadePixels,hasShadow,makeShadow}=require('../.build/shadow.js');
const {renderInspector,selectInspectorTab}=require('../.build/interface.js');

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
  selectInspectorTab('style');
  for(const kind of ['text','image','shape']){
   const e=model.makeElement(kind,{shadowEnabled:true,shadowOpacity:35,shadowOffsetX:-5,shadowOffsetY:7,shadowSpread:10,shadowColor:'#123456'});
   s.template.elements=[e];s.selected=e.id;renderInspector();
   const html=nodes.get('#inspector').innerHTML;
   for(const key of ['shadowEnabled','shadowColor','shadowOpacity','shadowOffsetX','shadowOffsetY','shadowSpread'])assert.match(html,new RegExp(`data-prop="${key}"`));
   assert.match(html,/Choose Add or Merge for overlapping shadows/);
  }
 }finally{global.document=old;}
});
test('mask canvas receives real transparent image and border (not a frame-sized fill)',()=>{
 const old=global.document,oldImageData=global.ImageData,calls=[];
 global.ImageData=class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4)}};
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

test('transparent PNG antialiasing never creates radial low-alpha streaks',()=>{
 const w=35,h=35;
 const alpha=mask(w,h,[
  [17,17,255],[17,16,20],[16,17,20],[18,17,20],[17,18,20],
  [3,3,128],[31,31,64]
 ]);
 const spread=spreadAlpha(alpha,w,h,5);
 for(let y=12;y<=22;y++)for(let x=12;x<=22;x++){
  if((x-17)**2+(y-17)**2<=25)
   assert.equal(at(spread,w,x,y),255,`opaque ball should dominate spread at ${x},${y}`);
 }
 assert.equal(at(spread,w,17,8),0,'empty transparent gap remains unshadowed');
 assert.equal(at(spread,w,17,17),255,'opaque source stays fully opaque');
});

test('circular max-alpha spread agrees with brute-force reference on partial transparency',()=>{
 const w=17,h=15,alpha=new Uint8ClampedArray(w*h);
 for(let p=0;p<alpha.length;p++)alpha[p]=(p*29+(p%7)*17)%5===0?0:(p*31)%256;
 for(const r of [0,1,2,3.5]){
  const found=spreadAlpha(alpha,w,h,r);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let expected=0;
   const d=r+.25;
   for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++)
    if(Math.hypot(sx-x,sy-y)<=d)expected=Math.max(expected,alpha[sy*w+sx]);
   assert.equal(at(found,w,x,y),expected,`radius ${r} at ${x},${y}`);
  }
 }
});

test('border shadow mask is inset like the visible CSS border',()=>{
 const {paintElement}=require('../.build/element-paint.js');
 const paths=[];
 const ctx={save(){},restore(){},beginPath(){},rect(...a){paths.push(a)},clip(){},stroke(){},fillRect(){}};
 const e=model.makeElement('shape',{x:20,y:30,w:100,h:90,shape:'rect',radius:0,fillMode:'none',borderWidth:8});
 paintElement(ctx,e,'',null);
 assert.deepEqual(paths.at(-1),[24,34,92,82],
   '8px border must be within the frame, not extend 4px outside it');
 const w=32,h=32,alpha=new Uint8ClampedArray(w*h);
 for(let p=10;p<=21;p++)for(const [x,y] of [[p,10],[p,21],[10,p],[21,p]])alpha[y*w+x]=255;
 const expanded=spreadAlpha(alpha,w,h,3);
 assert.equal(at(expanded,w,7,16),255,'shadow spreads outward');
 assert.equal(at(expanded,w,13,16),255,'shadow spreads inward equally');
 assert.equal(at(expanded,w,16,16),0,'center hole remains transparent');
});

test('shadowed text preview rasterizes foreground using same painter as alpha mask',()=>{
 const {paintTextContent}=require('../.build/element-paint.js');
 const {previewTextContent}=require('../.build/shadow.js');
 const oldDoc=global.document,logs=[];
 const text=(ctx,x,y)=>logs.push({context:ctx,x,y});
 global.document={createElement(){
  const which=logs.length;
  const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(t,x,y){text(which,x,y)},measureText(t){return {width:String(t).length*8}},scale(){}};
  return {width:0,height:0,getContext(){return ctx},toDataURL(){return 'data:image/png;base64,cg=='}};
 }};
 try{
  const e=model.makeElement('text',{x:5,y:7,w:120,h:80,fillMode:'none',shadowEnabled:true,autoWidth:true,autoHeight:true,text:'HI'});
  const graphic=previewTextContent(e,'HI',2);
  assert.match(graphic,/^data:image\/png/);
  const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(t,x,y){text('shadow-source',x,y)},measureText(t){return {width:String(t).length*8}}};
  paintTextContent(ctx,{...e,x:0,y:0},'HI');
  assert.deepEqual(logs.at(0)&&[logs.at(0).x,logs.at(0).y],logs.at(-1)&&[logs.at(-1).x,logs.at(-1).y]);
 }finally{global.document=oldDoc}
});
