const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {imgBox,imageCache}=require('../.build/image-sets.js');
const {imageDragPatch,imageZoomPatch,screenToImageDelta,enterImageReposition,stopImageReposition,repositionImageId}=require('../.build/image-reposition.js');
const {renderInspector,selectInspectorTab}=require('../.build/interface.js');
const {renderStage}=require('../.build/preview.js');

function approx(a,b,msg){assert.ok(Math.abs(a-b)<1e-7,msg||`${a} != ${b}`)}
test('zoom preserves legacy framing at factor 1, and changes every fitting mode',()=>{
 const image={naturalWidth:400,naturalHeight:200};
 for(const fit of ['cover','contain','width','height','stretch','free']){
  const el=model.makeElement('image',{w:200,h:140,imageFit:fit,imgScale:.8,imgOffsetX:13,imgOffsetY:-17});
  delete el.imgZoom;const old=imgBox(el,image);
  el.imgZoom=1;assert.deepEqual(imgBox(el,image),old);
  el.imgZoom=2;const zoomed=imgBox(el,image);
  approx(zoomed.w,old.w*2,fit+' width');
  approx(zoomed.h,old.h*2,fit+' height');
  approx(zoomed.x,(el.w-zoomed.w)/2+13,fit+' x');
  approx(zoomed.y,(el.h-zoomed.h)/2-17,fit+' y');
 }
});
test('pan follows pointer direction even with rotated/flipped images',()=>{
 const e=model.makeElement('image',{imgRotation:90});
 const d=screenToImageDelta(e,15,0);
 approx(d.x,0);approx(d.y,-15);
 const patch=imageDragPatch(e,15,0);
 approx(patch.imgOffsetX,0);approx(patch.imgOffsetY,-15);
 e.imgFlipY=true;
 const flipped=imageDragPatch(e,15,0);
 approx(flipped.imgOffsetY,15);
});
test('wheel or pinch zoom anchors the chosen image pixel without moving its frame',()=>{
 const img={naturalWidth:350,naturalHeight:220};
 for(const angle of [0,90,180,270]){
  const e=model.makeElement('image',{w:220,h:140,imageFit:'cover',imgRotation:angle,imgFlipX:true,imgOffsetX:11,imgOffsetY:-4});
  const point={x:42,y:91},frame={x:e.x,y:e.y,w:e.w,h:e.h};
  const old=imgBox(e,img);
  const relative=screenToImageDelta(e,point.x-e.w/2,point.y-e.h/2);
  const local={x:e.w/2+relative.x,y:e.h/2+relative.y};
  const ratioX=(local.x-old.x)/old.w,ratioY=(local.y-old.y)/old.h;
  const patch=imageZoomPatch(e,img,2.2,point);
  const after=imgBox({...e,...patch},img);
  approx(after.x+ratioX*after.w,local.x);
  approx(after.y+ratioY*after.h,local.y);
  assert.deepEqual({x:e.x,y:e.y,w:e.w,h:e.h},frame);
 }
});
test('reposition mode is transient and scoped to selection, card and project',()=>{
 const state=model.initial();model.replaceState(state);
 const image=state.template.elements.find(e=>e.kind==='image');
 const shape=state.template.elements.find(e=>e.kind==='shape');
 state.selected=shape.id;
 assert.equal(enterImageReposition(shape.id),false);
 state.selected=image.id;
 assert.equal(enterImageReposition(image.id),true);
 assert.equal(repositionImageId(),image.id);
 state.selected=null;assert.equal(repositionImageId(),null);
 state.selected=image.id;assert.equal(enterImageReposition(image.id),true);
 state.mode='cards';assert.equal(repositionImageId(),null);
 state.mode='template';assert.equal(enterImageReposition(image.id),true);
 model.replaceState(model.initial());assert.equal(repositionImageId(),null);
 stopImageReposition();
});
test('both layouts share the image reposition UI, with a ghost preview and Done control',()=>{
 const state=model.initial();model.replaceState(state);state.mode='template';
 const image=state.template.elements.find(e=>e.kind==='image');
 image.autoMode='single';image.autoSet='set';image.singleImage='asset.png';
 const data='data:image/png;base64,AA==';
 state.sets=[{id:'set',name:'Art',images:[{name:'asset.png',data}]}];
 imageCache.set(data,{loaded:true,im:{naturalWidth:400,naturalHeight:240}});
 const nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',style:{},hidden:false});return nodes.get(key)};
 global.document={querySelector:node,createElement(tag){
  assert.equal(tag,'canvas');return {getContext(){return {measureText(text){return {width:text.length*9}}}}};
 }};
 state.selected=image.id;
 selectInspectorTab('content');renderInspector();assert.match(node('#inspector').innerHTML,/Reposition image/);
 assert.match(node('#inspector').innerHTML,/data-prop="imgZoom"/);
 renderStage();assert.equal(node('#imageRepositionBar').hidden,true);
 assert.equal(enterImageReposition(image.id),true);
 renderInspector();assert.match(node('#inspector').innerHTML,/Done repositioning/);
 renderStage();assert.equal(node('#imageRepositionBar').hidden,false);
 assert.match(node('#stage').innerHTML,/image-reposition-ghost/);
 assert.match(node('#stage').innerHTML,/repositioning/);
 assert.doesNotMatch(node('#stage').innerHTML,/resize-handle/);
 stopImageReposition();renderStage();assert.equal(node('#imageRepositionBar').hidden,true);
 imageCache.delete(data);
});
