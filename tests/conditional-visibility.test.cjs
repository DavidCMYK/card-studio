const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../.build/model.js');
const {renderStage} = require('../.build/preview.js');
const {renderInspector, renderLeft, patchElement, selectInspectorTab} = require('../.build/interface.js');
const {canvasCard} = require('../.build/png-renderer.js');
const {applyTable} = require('../.build/spreadsheet.js');
const {imageCache} = require('../.build/image-sets.js');

function dom(){
 const nodes=new Map(); const paints=[];
 const get=key=>{if(!nodes.has(key))nodes.set(key,{style:{},innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}}});return nodes.get(key)};
 global.Image=class {addEventListener(){} };
 global.setTimeout=global.setTimeout||(()=>{});
 global.document={querySelector:get,createElement(){
  const ctx={fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,
   stack:[],save(){this.stack.push(this.globalAlpha)},restore(){this.globalAlpha=this.stack.pop()},
   scale(){},beginPath(){},rect(){},ellipse(){},roundRect(){},clip(){},
   fillRect(){paints.push({type:'fill',color:this.fillStyle})},
   stroke(){paints.push({type:'border',color:this.strokeStyle})},
   drawImage(){paints.push({type:'image'})},fillText(){paints.push({type:'text'})},
   measureText(t){return {width:String(t).length*5}}};
  return {width:0,height:0,getContext(){return ctx}};
 }};
 return {get,paints,clear(){paints.length=0}};
}

function setup(){
 const s=model.initial();
 const text=model.makeElement('text',{name:'Flavor text',text:'Default flavor',fillMode:'solid',fill1:'#ffaa00',borderWidth:2,borderColor:'#ff0000'});
 const shape=model.makeElement('shape',{name:'Flavor panel',fillMode:'solid',fill1:'#00ff00',linkedTextId:text.id});
 const image=model.makeElement('image',{name:'Flavor illustration',fillMode:'solid',fill1:'#0000ff',linkedTextId:text.id,autoSet:'art'});
 const independent=model.makeElement('shape',{name:'Independent panel',fillMode:'solid',fill1:'#ffffff'});
 s.template.elements=[text,shape,image,independent];
 s.sets=[{id:'art',name:'Art',images:[{name:'art.png',data:'data:image/png;base64,AAAA'}]}];
 s.cards=[
  {id:'a',name:'Blank',values:{[text.id]:''},overrides:{},extraElements:[]},
  {id:'b',name:'Populated',values:{[text.id]:'Details'},overrides:{},extraElements:[]},
  {id:'c',name:'Whitespace',values:{[text.id]:'   \n '},overrides:{},extraElements:[]}
 ];
 model.replaceState(s);
 return {s,text,shape,image,independent};
}

function has(html,id){return html.includes(`data-id="${id}"`)}
test('default is invisible when blank; links hide shapes/images in cards but not template',async()=>{
 const {get,paints,clear}=dom(); const {s,text,shape,image,independent}=setup();
 assert.equal(text.invisibleIfEmpty,true);
 assert.equal(model.visibleOnCard(text,0,'cards'),false);
 assert.equal(model.visibleOnCard(shape,0,'cards'),false);
 assert.equal(model.visibleOnCard(image,0,'cards'),false);
 assert.equal(model.visibleOnCard(independent,0,'cards'),true);
 assert.equal(model.visibleOnCard(text,1,'cards'),true);
 assert.equal(model.visibleOnCard(shape,1,'cards'),true);
 assert.equal(model.visibleOnCard(image,1,'cards'),true);
 assert.equal(model.visibleOnCard(text,2,'cards'),false);
 s.mode='template';renderStage();
 assert.ok([text,shape,image,independent].every(e=>has(get('#stage').innerHTML,e.id)));
 s.mode='cards';s.cardIndex=0;renderStage();renderLeft();
 assert.ok(![text,shape,image].some(e=>has(get('#stage').innerHTML,e.id)));
 assert.ok(has(get('#stage').innerHTML,independent.id));
 assert.doesNotMatch(get('#leftBody').innerHTML,/Flavor panel|Flavor illustration|Flavor text/);
 clear();await canvasCard(0,'cards');
 assert.ok(paints.some(e=>e.type==='fill'&&e.color==='#ffffff'));
 for(const color of ['#ffaa00','#00ff00','#0000ff']) assert.ok(!paints.some(e=>e.type==='fill'&&e.color===color),`${color} leaked from a hidden element`);
 // Verify correct card index is used for batch exports, not the current card.
 imageCache.set(s.sets[0].images[0].data,{loaded:true,im:{naturalWidth:100,naturalHeight:100}});
 clear();await canvasCard(1,'cards');
 for(const color of ['#ffaa00','#00ff00','#0000ff']) assert.ok(paints.some(e=>e.type==='fill'&&e.color===color),`${color} missing from populated card`);
 assert.ok(paints.some(e=>e.type==='image'));
 imageCache.clear();
});

test('visibility settings can be overridden independently on a card',()=>{
 dom();const {s,text,shape,image}=setup();
 s.mode='cards';s.cardIndex=0;
 s.cards[0].overrides[text.id]={invisibleIfEmpty:false};
 assert.equal(model.visibleOnCard(text,0,'cards'),true);
 assert.equal(model.visibleOnCard(shape,0,'cards'),true);
 s.cards[0].overrides[text.id]={hidden:true,invisibleIfEmpty:false};
 assert.equal(model.visibleOnCard(shape,0,'cards'),false);
 s.cards[0].overrides[text.id]={invisibleIfEmpty:true};
 patchElement(shape.id,{linkedTextId:''});
 assert.equal(model.visibleOnCard(shape,0,'cards'),true);
 assert.equal(model.visibleOnCard(image,0,'cards'),false);
 // Missing references do not silently hide an element.
 patchElement(shape.id,{linkedTextId:'deleted-text-id'});
 assert.equal(model.visibleOnCard(shape,0,'cards'),true);
 // Legacy projects without a setting should default to enabled.
 delete text.invisibleIfEmpty;
 assert.equal(model.visibleOnCard(text,0,'cards'),false);
});

test('inspector exposes a default-on text toggle and link dropdown for frames and shapes',()=>{
 const {get}=dom();const {s,text,shape,image}=setup();
 s.selected=text.id;s.mode='template';selectInspectorTab('rules');renderInspector();
 assert.match(get('#inspector').innerHTML,/Invisible if empty/);
 assert.match(get('#inspector').innerHTML,/data-prop="invisibleIfEmpty"[^>]+checked/);
 s.selected=shape.id;renderInspector();
 assert.match(get('#inspector').innerHTML,/Follow text visibility/);
 assert.match(get('#inspector').innerHTML,new RegExp(`value="${text.id}"`));
 s.selected=image.id;renderInspector();
 assert.match(get('#inspector').innerHTML,/Follow text visibility/);
});

test('imported blank spreadsheet cells hide linked objects without affecting another card',()=>{
 dom();const {s,text,shape,image}=setup();
 applyTable([['Card Name','Flavor text'],['Empty',''],['Filled','Visible text']]);
 assert.equal(s.cards[0].values[text.id],'');
 assert.equal(s.cards[1].values[text.id],'Visible text');
 assert.equal(model.visibleOnCard(text,0,'cards'),false);
 assert.equal(model.visibleOnCard(shape,0,'cards'),false);
 assert.equal(model.visibleOnCard(image,1,'cards'),true);
});

test('a top/bottom anchored image follows blank template text visibility, not its remaining geometry',async()=>{
 const {get,paints,clear}=dom();
 const {s,text,image}=setup();
 text.autoHeight=true;
 text.valign='bottom';
 patchElement(image.id,{anchorTargetId:text.id});
 patchElement(image.id,{anchorTop:true});
 patchElement(image.id,{anchorBottom:true});
 s.mode='template';
 renderStage();
 assert.ok(has(get('#stage').innerHTML,text.id));
 assert.ok(has(get('#stage').innerHTML,image.id));
 text.text='';
 const {elementGeometry}=require('../.build/anchor-layout.js');
 assert.equal(elementGeometry(text).h,0);
 assert.equal(model.visibleOnCard(image,0,'template'),false);
 renderStage();renderLeft();
 assert.ok(has(get('#stage').innerHTML,text.id),'empty text remains selectable in Template mode');
 assert.ok(!has(get('#stage').innerHTML,image.id),'anchored image disappears, not merely shrinks');
 assert.match(get('#leftBody').innerHTML,new RegExp(image.name),'image remains available in Layers for editing');
 clear();await canvasCard(0,'template');
 assert.ok(!paints.some(p=>p.color==='#0000ff'),'template PNG must also omit the linked image');
 text.text='Restored description';
 assert.equal(model.visibleOnCard(image,0,'template'),true);
 renderStage();
 assert.ok(has(get('#stage').innerHTML,image.id));
 clear();await canvasCard(0,'template');
 assert.ok(paints.some(p=>p.color==='#0000ff'),'the linked image returns in template export');
});
test('visibility follows its explicit text link in Cards mode regardless of separate anchoring',()=>{
 dom();
 const {s,text,image}=setup();
 const unrelated=model.makeElement('text',{name:'Other text',text:'Always visible'});
 s.template.elements.push(unrelated);
 patchElement(image.id,{anchorTargetId:unrelated.id,anchorTop:true,anchorBottom:true});
 assert.equal(image.linkedTextId,text.id);
 s.mode='cards';
 s.cardIndex=0;
 assert.equal(model.visibleOnCard(image,0,'cards'),false);
 s.cardIndex=1;
 assert.equal(model.visibleOnCard(image,1,'cards'),true);
 // An anchor alone does not implicitly make the target a visibility source.
 patchElement(image.id,{linkedTextId:''});
 s.cardIndex=0;
 assert.equal(model.visibleOnCard(image,0,'cards'),true);
});
test('an empty template text box can deliberately keep its linked image visible',()=>{
 const {get}=dom(),{text,image}=setup();
 text.text='';text.invisibleIfEmpty=false;
 renderStage();
 assert.ok(has(get('#stage').innerHTML,image.id));
});
