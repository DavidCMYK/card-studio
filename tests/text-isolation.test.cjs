const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {elementGeometry}=require('../.build/anchor-layout.js');
const {patchElement}=require('../.build/interface.js');
const {enterTextIsolation,isolatedTextId,stopTextIsolation,patchTextIndependently}=require('../.build/text-isolation.js');

const rect=e=>({x:e.x,y:e.y,w:e.w,h:e.h});
const approx=(a,b,message)=>{
 for(const key of ['x','y','w','h'])assert.ok(Math.abs(a[key]-b[key])<.001,message+': '+key+' '+a[key]+' vs '+b[key]);
};
const card=(id,name,values={})=>({id,name,values,overrides:{},extraElements:[]});
function scenario(){
 const state=model.initial();model.replaceState(state);
 const text=state.template.elements.find(e=>e.kind==='text');
 Object.assign(text,{x:32,y:27,w:150,h:70,text:'Short',autoWidth:false,autoHeight:false});
 const panel=model.makeElement('shape',{name:'Linked panel',x:20,y:15,w:192,h:130});
 const image=model.makeElement('image',{name:'Linked image',x:11,y:80,w:94,h:62});
 state.template.elements.push(panel,image);
 patchElement(panel.id,{linkedTextId:text.id});
 patchElement(image.id,{linkedTextId:text.id});
 for(const edge of ['Left','Right','Top','Bottom'])patchElement(panel.id,{['anchor'+edge]:true});
 for(const edge of ['Right','Bottom'])patchElement(image.id,{['anchor'+edge]:true});
 state.cards=[card('a','First',{[text.id]:'Brief'}),card('b','Second',{[text.id]:'A much longer text value\nwith two lines'})];
 state.mode='template';state.selected=text.id;
 return {state,text,panel,image};
}
function capture(state,items){
 return ['template',...state.cards.map((_,i)=>i)].map(mode=>{
  const template=mode==='template',ci=template?0:mode;
  return items.map(e=>rect(elementGeometry(e,ci,template?'template':'cards')));
 });
}
function check(state,items,before){
 const after=capture(state,items);
 for(let i=0;i<after.length;i++)for(let j=0;j<items.length;j++)approx(after[i][j],before[i][j],'context '+i+', element '+items[j].name);
}

test('independent mode begins only for unlocked selected text and is transient',()=>{
 const {state,text,image}=scenario();
 state.selected=image.id;assert.equal(enterTextIsolation(text.id),false);
 state.selected=text.id;assert.equal(enterTextIsolation(text.id),true);
 assert.equal(isolatedTextId(),text.id);
 text.locked=true;assert.equal(isolatedTextId(),null);assert.equal(enterTextIsolation(text.id),false);
 text.locked=false;assert.equal(enterTextIsolation(text.id),true);
 state.mode='cards';assert.equal(isolatedTextId(),null);
 state.mode='template';assert.equal(enterTextIsolation(text.id),true);
 state.selected=null;assert.equal(isolatedTextId(),null);
 state.selected=text.id;assert.equal(enterTextIsolation(text.id),true);
 model.replaceState(model.initial());assert.equal(isolatedTextId(),null);
 stopTextIsolation();
});

test('independent text movement keeps linked shapes and images fixed in template and every card',()=>{
 const {state,text,panel,image}=scenario();
 const before=capture(state,[panel,image]);
 assert.equal(enterTextIsolation(text.id),true);
 patchTextIndependently(text.id,{x:text.x+27,y:text.y+18},patchElement);
 assert.equal(text.x,59);assert.equal(text.y,45);
 check(state,[panel,image],before);
 assert.equal(panel.linkedTextId,text.id);assert.equal(image.linkedTextId,text.id);
 assert.equal(panel.anchorLeft,true);assert.equal(panel.anchorRight,true);
 stopTextIsolation();
 const old=elementGeometry(panel,0,'template');
 patchElement(text.id,{x:text.x+13});
 assert.ok(elementGeometry(panel,0,'template').x>old.x+12,'ordinary text movement still moves attached elements');
});

test('independent resize preserves four-edge stretches and per-card auto-sized values',()=>{
 const {state,text,panel,image}=scenario();
 text.autoWidth=true;text.autoHeight=true;
 const cardOnly=model.makeElement('shape',{name:'Card-only follower',x:12,y:14,w:111,h:66,
  linkedTextId:text.id,anchorLeft:true,anchorRight:true,anchorTop:true,anchorBottom:true});
 state.cards[1].extraElements.push(cardOnly);
 const before=capture(state,[panel,image]);
 const extraBefore=rect(elementGeometry(cardOnly,1,'cards'));
 assert.ok(elementGeometry(text,0,'cards').w!==elementGeometry(text,1,'cards').w);
 assert.equal(enterTextIsolation(text.id),true);
 patchTextIndependently(text.id,{x:70,y:52,w:165,h:92,autoWidth:false,autoHeight:false},patchElement);
 check(state,[panel,image],before);
 approx(elementGeometry(cardOnly,1,'cards'),extraBefore,'card-only anchored follower');
 assert.equal(panel.linkedTextId,text.id);
 assert.ok(Object.keys(state.cards[1].overrides[panel.id]||{}).some(x=>x.startsWith('anchorOffset')),
  'different card text dimensions have persistent compensation');
});

test('independent editing in Cards mode never changes the shared template or other cards',()=>{
 const {state,text,panel,image}=scenario();
 const before=capture(state,[panel,image]),source=rect(elementGeometry(text,0,'template'));
 state.mode='cards';state.cardIndex=0;state.selected=text.id;
 assert.equal(enterTextIsolation(text.id),true);
 const start=elementGeometry(text);
 patchTextIndependently(text.id,{x:start.x+16,y:start.y+9,w:start.w+41,h:start.h+15},patchElement);
 approx(elementGeometry(text,0,'template'),source,'template text');
 check(state,[panel,image],before);
 assert.ok(state.cards[0].overrides[text.id]);
 assert.equal(state.cards[1].overrides[text.id],undefined);
 stopTextIsolation();
});

test('without isolation, normal edits retain existing linked layout',()=>{
 const {text,panel}=scenario();
 const start=elementGeometry(panel,0,'template');
 patchTextIndependently(text.id,{x:text.x+14},patchElement);
 assert.equal(elementGeometry(panel,0,'template').x,start.x+14);
});

test('independent movement also compensates text elements anchored to text',()=>{
 const {state,text}=scenario();
 const follower=model.makeElement('text',{name:'Anchored description',x:42,y:115,w:120,h:31,text:'Second text'});
 state.template.elements.push(follower);
 patchElement(follower.id,{anchorTargetId:text.id});
 patchElement(follower.id,{anchorBottom:true});
 patchElement(follower.id,{anchorTargetBottom:'Top'});
 const before=capture(state,[follower]);
 assert.equal(enterTextIsolation(text.id),true);
 patchTextIndependently(text.id,{y:text.y+19},patchElement);
 check(state,[follower],before);
 assert.equal(follower.anchorTargetId,text.id);
 stopTextIsolation();
});
