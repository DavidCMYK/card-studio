const {test}=require('node:test'), assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {elementGeometry,textGeometry}=require('../.build/anchor-layout.js');
const {patchElement,renderInspector}=require('../.build/interface.js');
const {renderStage}=require('../.build/preview.js');
const {canvasCard}=require('../.build/png-renderer.js');

function setup(){
 const state=model.initial();model.replaceState(state);
 const text=state.template.elements.find(x=>x.name==='Description');
 const shape=state.template.elements.find(x=>x.name==='Text panel');
 const image=state.template.elements.find(x=>x.name==='Artwork');
 text.text='Hello';text.autoWidth=true;text.autoHeight=true;text.align='left';text.valign='top';
 shape.x=20;shape.y=14;shape.w=160;shape.h=45;
 image.x=15;image.y=17;image.w=75;image.h=25;
 return {state,text,shape,image};
}
const near=(actual,expected,msg)=>assert.ok(Math.abs(actual-expected)<0.001,`${msg||'mismatch'}: ${actual} vs ${expected}`);
function attach(el,text){patchElement(el.id,{linkedTextId:text.id});}

test('four edge anchors capture current distances and respond to text moves',()=>{
 const {state,text,shape}=setup();attach(shape,text);
 const before=elementGeometry(shape);const source=textGeometry(text,0,'template');
 for(const edge of ['Left','Top'])patchElement(shape.id,{[`anchor${edge}`]:true});
 const offsets=[before.x-source.x,before.y-source.y];
 patchElement(text.id,{x:text.x+27,y:text.y+14});
 const next=elementGeometry(shape);
 near(next.x, before.x+27);near(next.y,before.y+14);near(next.w,before.w);near(next.h,before.h);
 near(shape.anchorOffsetLeft,offsets[0]);near(shape.anchorOffsetTop,offsets[1]);
});

test('left/right anchors stretch from both sides while top/bottom separately stretch vertically',()=>{
 const {text,shape}=setup();attach(shape,text);
 const original=elementGeometry(shape);
 for(const edge of ['Left','Right','Top','Bottom'])patchElement(shape.id,{[`anchor${edge}`]:true});
 const base=textGeometry(text,0,'template');
 patchElement(text.id,{text:'Hello\nMuch longer text than before'});
 const larger=textGeometry(text,0,'template');const actual=elementGeometry(shape);
 near(actual.x,original.x+larger.x-base.x);near(actual.y,original.y+larger.y-base.y);
 near(actual.w,original.w+(larger.w-base.w));near(actual.h,original.h+(larger.h-base.h));
});

test('right-only/bottom-only anchors follow their respective edges without resizing',()=>{
 const {text,image}=setup();attach(image,text);
 const before=elementGeometry(image),source=textGeometry(text,0,'template');
 patchElement(image.id,{anchorRight:true,anchorBottom:true});
 patchElement(text.id,{text:'A longer phrase\nSecond line'});
 const after=elementGeometry(image),last=textGeometry(text,0,'template');
 near(after.w,before.w);near(after.h,before.h);
 near(after.x,before.x+last.x+last.w-source.x-source.w);
 near(after.y,before.y+last.y+last.h-source.y-source.h);
});

test('different spreadsheet card strings produce independent attached geometry',()=>{
 const {state,text,shape}=setup();attach(shape,text);
 patchElement(shape.id,{anchorLeft:true});patchElement(shape.id,{anchorRight:true});
 const templateRect=elementGeometry(shape);
 state.cards[0].values[text.id]='A';
 state.cards.push({...structuredClone(state.cards[0]),id:'second',name:'Second',values:{[text.id]:'A much longer string'}});
 state.mode='cards';
 const first=elementGeometry(shape,0,'cards'),second=elementGeometry(shape,1,'cards');
 assert.ok(second.w>first.w);
 state.cards[1].overrides[text.id]={x:text.x+8};
 const moved=elementGeometry(shape,1,'cards');near(moved.x,second.x+8);
 state.mode='template';near(elementGeometry(shape).w,templateRect.w);
});

test('direct drag edits recapture offsets and unlinking preserves the visible rectangle',()=>{
 const {text,shape}=setup();attach(shape,text);patchElement(shape.id,{anchorLeft:true});patchElement(shape.id,{anchorRight:true});
 let original=elementGeometry(shape);
 patchElement(shape.id,{x:original.x+19,w:original.w+11});
 let moved=elementGeometry(shape);near(moved.x,original.x+19);near(moved.w,original.w+11);
 patchElement(shape.id,{anchorLeft:false,anchorRight:false});
 const unlinked=elementGeometry(shape);near(unlinked.x,moved.x);near(unlinked.w,moved.w);
 patchElement(shape.id,{linkedTextId:''});near(elementGeometry(shape).x,moved.x);
});

test('missing text references leave attached element at its saved position',()=>{
 const {shape}=setup();shape.linkedTextId='missing';shape.anchorLeft=true;shape.anchorOffsetLeft=2;
 near(elementGeometry(shape).x,shape.x);
});

test('inspector exposes independent edge locks and preview uses same geometry as exports',async()=>{
 const {state,text,image}=setup();attach(image,text);patchElement(image.id,{anchorLeft:true,anchorRight:true,anchorTop:true});
 state.selected=image.id;
 const nodes=new Map();const get=(key)=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',style:{},classList:{toggle(){}}});return nodes.get(key)};
 const prev=global.document;
 global.document={querySelector:get,createElement(name){if(name==='canvas')return {width:0,height:0,getContext(){return context}};return get(name)}};
 const calls=[];const context=new Proxy({},{get(o,key){if(key==='canvas')return {};if(key==='globalAlpha')return 1;if(key==='width'||key==='height')return 1;if(key==='createLinearGradient')return ()=>({addColorStop(){}});return (...args)=>{calls.push([key,...args])}} ,set(){return true}});
 try{
   renderInspector();assert.match(get('#inspector').innerHTML,/Lock left edge/);assert.match(get('#inspector').innerHTML,/Lock right edge/);
   const g=elementGeometry(image);
   // Preview contains the computed x/y/w/h, not the stale base rectangle.
   renderStage();assert.ok(get('#stage').innerHTML.includes(`left:${g.x*state.zoom}px`));
   // PNG renderer also resolves the same anchor geometry without changing state.
   const cvs=await canvasCard(0,'template');assert.ok(cvs.width>0);assert.ok(calls.some(c=>c[0]==='rect'&&Math.abs(c[1]-g.x)<.001&&Math.abs(c[3]-g.w)<.001),'PNG should draw the anchored frame rectangle'); 
 }finally{global.document=prev}
});

test('edge anchors track the zero-sized geometry of an empty auto-sized text source',()=>{
 const {state,text,shape}=setup();
 text.align='right';text.valign='bottom';
 attach(shape,text);
 shape.anchorRight=true;shape.anchorTop=true;
 shape.anchorOffsetRight=5;shape.anchorOffsetTop=-8;
 state.cards[0].values[text.id]='';
 state.cards.push({...structuredClone(state.cards[0]),id:'filled',name:'Filled',values:{[text.id]:'Full text'}});
 state.mode='cards';
 const empty=textGeometry(text,0,'cards'),filled=textGeometry(text,1,'cards');
 assert.deepEqual([empty.w,empty.h],[0,0]);
 assert.ok(filled.w>0&&filled.h>0);
 const emptyFollower=elementGeometry(shape,0,'cards'),filledFollower=elementGeometry(shape,1,'cards');
 near(emptyFollower.x+emptyFollower.w,empty.x+empty.w+5);
 near(filledFollower.x+filledFollower.w,filled.x+filled.w+5);
 near(emptyFollower.y,empty.y-8);
 near(filledFollower.y,filled.y-8);
 assert.notEqual(emptyFollower.y,filledFollower.y);
 assert.equal(text.h,83,'the source element keeps its saved height');
});
