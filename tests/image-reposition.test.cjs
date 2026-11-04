const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {imgBox,imageCache,imageFitAxes,imageScreenOffset}=require('../.build/image-sets.js');
const {imageDragPatch,imageScalePatch,screenToImageDelta,enterImageReposition,stopImageReposition,repositionImageId}=require('../.build/image-reposition.js');
const {renderInspector,selectInspectorTab}=require('../.build/interface.js');
const {renderStage}=require('../.build/preview.js');

function approx(a,b,msg){assert.ok(Math.abs(a-b)<1e-7,msg||`${a} != ${b}`)}
test('only Free uses the existing scale; all other fit modes ignore scale',()=>{
 const img={naturalWidth:400,naturalHeight:200};
 for(const fit of ['cover','contain','width','height','stretch']){
  const e=model.makeElement('image',{w:200,h:140,imageFit:fit,imgScale:1});
  const base=imgBox(e,img);
  e.imgScale=4;
  assert.deepEqual(imgBox(e,img),base,fit+' changed size when Free scale changed');
  assert.deepEqual(imageScalePatch(e,img,4.5,{x:50,y:70}),{},fit+' should not scale');
 }
 const free=model.makeElement('image',{w:200,h:140,imageFit:'free',imgScale:.75});
 approx(imgBox(free,img).w,300);
 free.imgScale=1.5;approx(imgBox(free,img).w,600);
 assert.equal(Object.hasOwn(free,'imgZoom'),false,'redundant zoom no longer saved');
});
test('fit modes strictly restrict movement, including old stored offsets',()=>{
 const img={naturalWidth:400,naturalHeight:200};
 const allowed={
  free:{x:true,y:true},width:{x:false,y:true},height:{x:true,y:false},
  contain:{x:false,y:false},stretch:{x:false,y:false},cover:{x:true,y:false}
 };
 for(const [fit,axes] of Object.entries(allowed)){
  const e=model.makeElement('image',{w:200,h:140,imageFit:fit,imgOffsetX:0,imgOffsetY:0});
  assert.deepEqual(imageFitAxes(e,img),axes,fit+' allowed axes');
  const moved={...e,...imageDragPatch(e,12,9,img)};
  const screen=imageScreenOffset(moved,img);
  if(fit==='cover'){approx(screen.x,12);approx(screen.y,0)}
  else{approx(screen.x,axes.x?12:0,fit+' x');approx(screen.y,axes.y?9:0,fit+' y')}
  const legacy={...e,imgOffsetX:32,imgOffsetY:25};
  const rect=imgBox(legacy,img),baseline=imgBox(e,img);
  if(!axes.x)approx(rect.x,baseline.x,fit+' forbidden horizontal offset');
  if(!axes.y)approx(rect.y,baseline.y,fit+' forbidden vertical offset');
 }
 // Cover must never expose an edge by letting the cropped image travel too far.
 const cover=model.makeElement('image',{w:200,h:140,imageFit:'cover'});
 const drag=imageDragPatch(cover,1000,200,img);
 const rect=imgBox({...cover,...drag},img);
 assert.ok(rect.x<=0&&rect.x+rect.w>=cover.w-1e-6,'cover preserves horizontal coverage');
 approx(rect.y,0,'cover never allows movement along the fitted height');
});
test('fit restrictions use visible axes even when an image is flipped and rotated',()=>{
 const img={naturalWidth:400,naturalHeight:200};
 const e=model.makeElement('image',{w:200,h:140,imageFit:'free',imgRotation:90});
 const d=screenToImageDelta(e,15,0);
 approx(d.x,0);approx(d.y,-15);
 const moved=imageDragPatch(e,15,0,img);
 approx(moved.imgOffsetX,0);approx(moved.imgOffsetY,-15);
 approx(imageScreenOffset({...e,...moved},img).x,15);
 e.imgFlipY=true;
 approx(imageDragPatch(e,15,0,img).imgOffsetY,15);
 // A width fit forbids horizontal image movement even at 90 degrees.
 e.imageFit='width';
 const patch=imageDragPatch(e,15,17,img),screen=imageScreenOffset({...e,...patch},img);
 approx(screen.x,0);approx(screen.y,17);
});
test('Free scale keeps the chosen image pixel fixed without moving its frame',()=>{
 const img={naturalWidth:350,naturalHeight:220};
 for(const angle of [0,90,180,270]){
  const e=model.makeElement('image',{w:220,h:140,imageFit:'free',imgScale:.8,imgRotation:angle,imgFlipX:true,imgOffsetX:11,imgOffsetY:-4});
  const point={x:42,y:91},frame={x:e.x,y:e.y,w:e.w,h:e.h};
  const old=imgBox(e,img);
  const relative=screenToImageDelta(e,point.x-e.w/2,point.y-e.h/2);
  const local={x:e.w/2+relative.x,y:e.h/2+relative.y};
  const ratioX=(local.x-old.x)/old.w,ratioY=(local.y-old.y)/old.h;
  const patch=imageScalePatch(e,img,2.2,point);
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
 image.imageFit='stretch';assert.equal(repositionImageId(),null);assert.equal(enterImageReposition(image.id),false);
 image.imageFit='contain';assert.equal(enterImageReposition(image.id),false);
 image.imageFit='free';assert.equal(enterImageReposition(image.id),true);
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
 image.imageFit='free';
 selectInspectorTab('content');renderInspector();assert.match(node('#inspector').innerHTML,/Reposition image/);
 assert.match(node('#inspector').innerHTML,/data-prop="imgScale"/);
 assert.doesNotMatch(node('#inspector').innerHTML,/data-prop="imgZoom"/);
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

test('inspector exposes only the scale and offset fields allowed by each fit mode',()=>{
 const state=model.initial();model.replaceState(state);state.mode='template';
 const frame=state.template.elements.find(e=>e.kind==='image');state.selected=frame.id;
 const nodes=new Map();const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',style:{},hidden:false});return nodes.get(key)};
 global.document={querySelector:node,createElement(){return {getContext(){return {measureText(text){return {width:text.length*9}}}}}}};
 selectInspectorTab('content');
 for(const fit of ['free','width','height','contain','stretch']){
  frame.imageFit=fit;renderInspector();const html=node('#inspector').innerHTML;
  assert.equal(html.includes('data-prop="imgScale"'),fit==='free',fit+' scale');
  assert.equal(html.includes('data-prop="imgOffsetX"'),fit==='free'||fit==='height',fit+' X');
  assert.equal(html.includes('data-prop="imgOffsetY"'),fit==='free'||fit==='width',fit+' Y');
  assert.equal(html.includes('data-action="reposition-image"'),!['contain','stretch'].includes(fit),fit+' reposition');
  assert.doesNotMatch(html,/data-prop="imgZoom"/);
 }
});
