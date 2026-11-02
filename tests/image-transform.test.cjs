const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {renderStage}=require('../.build/preview.js');
const {renderInspector,patchElement}=require('../.build/interface.js');
const {canvasCard}=require('../.build/png-renderer.js');
const {imageCache}=require('../.build/image-sets.js');

function scenario(opts={}){
 const state=model.initial();
 const frame=model.makeElement('image',{x:32,y:45,w:120,h:90,fillMode:'solid',fill1:'#112233',
  borderWidth:5,fillOpacity:70,borderOpacity:80,autoSet:'art',imageFit:'contain',imgOffsetX:9,imgOffsetY:-3,...opts});
 state.template.elements=[frame];state.sets=[{id:'art',name:'Artwork',images:[{name:'example.png',data:'data:image/png;base64,QUJD'}]}];
 state.selected=frame.id;
 model.replaceState(state);
 const image={naturalWidth:200,naturalHeight:100};
 const key=state.sets[0].images[0].data;
 imageCache.set(key,{im:image,loaded:true,error:false});
 const nodes=new Map();
 const get=key=>{if(!nodes.has(key))nodes.set(key,{style:{},innerHTML:'',textContent:'',classList:{toggle(){}}});return nodes.get(key)};
 const events=[],ctx=new Proxy({
  save(){events.push(['save'])},restore(){events.push(['restore'])},
  clip(){events.push(['clip'])},
  translate(...args){events.push(['translate',...args])},
  rotate(...args){events.push(['rotate',...args])},
  scale(...args){events.push(['scale',...args])},
  drawImage(...args){events.push(['drawImage',...args])},
  stroke(){events.push(['stroke'])},
 },{get(o,key){if(key in o)return o[key];return()=>{}}});
 const oldDocument=global.document;
 global.document={querySelector:get,createElement(){return {getContext(){return ctx},width:0,height:0}}};
 return {state,frame,image,events,get,done(){imageCache.clear();global.document=oldDocument}};
}

const by=(events,name)=>events.filter(x=>x[0]===name);
test('new image transform controls are offered with neutral defaults and saved in model',()=>{
 const t=scenario();try{
  assert.equal(t.frame.imgFlipX,false);assert.equal(t.frame.imgFlipY,false);assert.equal(t.frame.imgRotation,0);
  renderInspector();const html=t.get('#inspector').innerHTML;
  for(const key of ['imgFlipX','imgFlipY','imgRotation'])assert.match(html,new RegExp(`data-prop="${key}"`));
  assert.match(html,/image-rotate-left/);assert.match(html,/image-rotate-right/);
  assert.equal(JSON.parse(JSON.stringify(t.state)).template.elements[0].imgRotation,0);
 }finally{t.done()}
});

test('flips and rotation affect image only, around frame centre, in preview and PNG',async()=>{
 const t=scenario({imgFlipX:true,imgFlipY:true,imgRotation:90});try{
  renderStage();const html=t.get('#stage').innerHTML;
  assert.match(html,/transform:rotate\(90deg\) scale\(-1,-1\)/);
  assert.match(html,/transform-origin:[^;]+px [^;]+px/);
  assert.match(html,/class="element-border"/);
  assert.doesNotMatch(html,/class="element-border"[^>]*transform:/);
  assert.doesNotMatch(html,/class="element-fill"[^>]*transform:/);
  await canvasCard(0,'template');
  assert.deepEqual(by(t.events,'translate'),[['translate',t.frame.x+t.frame.w/2,t.frame.y+t.frame.h/2]]);
  assert.ok(Math.abs(by(t.events,'rotate')[0][1]-Math.PI/2)<1e-12);
  assert.deepEqual(by(t.events,'scale').slice(1),[['scale',-1,-1]]); // First scale is export DPI
  const bb=require('../.build/image-sets.js').imgBox(t.frame,t.image);
  assert.deepEqual(by(t.events,'drawImage')[0],['drawImage',t.image,bb.x-t.frame.w/2,bb.y-t.frame.h/2,bb.w,bb.h]);
  assert.ok(t.events.indexOf(by(t.events,'stroke')[0])>t.events.indexOf(by(t.events,'drawImage')[0]));
 }finally{t.done()}
});

test('untransformed images keep the original rendering geometry',async()=>{
 const t=scenario();try{
  renderStage();assert.doesNotMatch(t.get('#stage').innerHTML,/transform:rotate/);
  await canvasCard(0,'template');
  assert.equal(by(t.events,'translate').length,0);assert.equal(by(t.events,'rotate').length,0);
  assert.equal(by(t.events,'scale').length,1);
  const bb=require('../.build/image-sets.js').imgBox(t.frame,t.image);
  assert.deepEqual(by(t.events,'drawImage')[0],['drawImage',t.image,t.frame.x+bb.x,t.frame.y+bb.y,bb.w,bb.h]);
 }finally{t.done()}
});

test('card-only transform override changes that card, without changing shared template',async()=>{
 const t=scenario();try{
  t.state.mode='cards';
  patchElement(t.frame.id,{imgFlipX:true,imgRotation:-30});
  assert.equal(t.frame.imgFlipX,false);assert.equal(t.frame.imgRotation,0);
  assert.deepEqual(t.state.cards[0].overrides[t.frame.id],{imgFlipX:true,imgRotation:-30});
  renderStage();assert.match(t.get('#stage').innerHTML,/transform:rotate\(-30deg\) scale\(-1,1\)/);
  await canvasCard(0,'cards');assert.ok(Math.abs(by(t.events,'rotate')[0][1]+Math.PI/6)<1e-12);
  t.state.mode='template';renderStage();assert.doesNotMatch(t.get('#stage').innerHTML,/transform:rotate/);
 }finally{t.done()}
});

test('image background and frame border still render outside image transformation',async()=>{
 const t=scenario({imgRotation:180,imgFlipY:true});try{
  await canvasCard(0,'template');
  const clipIdx=t.events.findIndex(x=>x[0]==='clip');
  const translateIdx=t.events.findIndex(x=>x[0]==='translate');
  const strokeIdx=t.events.findIndex(x=>x[0]==='stroke');
  assert.ok(clipIdx>=0&&translateIdx>clipIdx&&strokeIdx>translateIdx);
 }finally{t.done()}
});