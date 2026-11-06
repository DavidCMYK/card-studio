const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {layoutTextBox}=require('../.build/text-layout.js');
const {renderStage}=require('../.build/preview.js');
const {canvasCard}=require('../.build/png-renderer.js');

function dom(){
 const nodes=new Map(),draws=[];
 global.document={querySelector(id){if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:''});return nodes.get(id)},createElement(){
  const ctx={save(){},restore(){},scale(){},beginPath(){},clip(){},rect(){},roundRect(){},ellipse(){},
   fillRect(x,y,w,h){draws.push({type:'fill',x,y,w,h})},
   stroke(){},drawImage(){},fillText(text,x,y){draws.push({type:'text',text,x,y})},
   measureText(text){return {width:[...String(text)].length*10}}};
  return {width:0,height:0,getContext(){return ctx}};
 }};
 return {nodes,draws};
}
function setup(options={}){
 const state=model.initial();
 const e=model.makeElement('text',{name:'Auto label',x:100,y:200,w:100,h:80,
  text:'A',fontSize:12,lineHeight:1.25,valign:'top',fillMode:'solid',
  autoWidth:true,autoHeight:true,gutterLeft:5,gutterRight:7,gutterTop:4,gutterBottom:6,...options});
 state.template.elements=[e];model.replaceState(state);return {state,e};
}
test('independent horizontal and vertical auto fit with four gutters',()=>{
 dom();const {e}=setup();
 let result=layoutTextBox(e,'ABCDEFG\nX');
 assert.deepEqual([result.x,result.y,result.w,result.h],[100,200,84,50]);
 e.autoWidth=false;
 result=layoutTextBox(e,'ABCDEFG');
 assert.equal(result.w,100);assert.equal(result.h,30);
 e.autoWidth=true;e.autoHeight=false;
 result=layoutTextBox(e,'ABCDEFG\nX');
 assert.equal(result.w,84);assert.equal(result.h,80);
});
test('centred/bottom text grows symmetrically horizontally and upwards',()=>{
 dom();const {e}=setup({align:'center',valign:'bottom'});
 let result=layoutTextBox(e,'AB');
 assert.deepEqual([result.x,result.y,result.w,result.h],[133,250,34,30]);
 result=layoutTextBox(e,'ABCDEFGHIJK\nABC');
 assert.deepEqual([result.x,result.y,result.w,result.h],[88,230,124,50]);
});
test('different cards auto fit independently in preview and PNG',async()=>{
 const {nodes,draws}=dom();const {state,e}=setup();
 state.cards=[
 {id:'1',name:'A',values:{[e.id]:'A'},overrides:{},extraElements:[]},
 {id:'2',name:'B',values:{[e.id]:'ABCDEFG\nX'},overrides:{},extraElements:[]}];
 state.mode='cards';
 for(let i=0;i<2;i++){
  state.cardIndex=i;
  renderStage();
  const layout=layoutTextBox(e,state.cards[i].values[e.id]);
  assert.ok(nodes.get('#stage').innerHTML.includes('width:'+layout.w*state.zoom+'px'));
  draws.length=0;await canvasCard(i,'cards');
  assert.ok(draws.some(x=>x.type==='fill'&&x.w===layout.w&&x.h===layout.h));
 }
});
test('legacy text geometry does not change without auto-sizing',()=>{
 dom();const {e}=setup({autoWidth:undefined,autoHeight:undefined});
 const layout=layoutTextBox(e,'A longer text');
 assert.deepEqual([layout.x,layout.y,layout.w,layout.h],[100,200,100,80]);
});

test('empty text collapses only auto-sized axes, independent of visibility and gutters',()=>{
 dom();const {e}=setup({invisibleIfEmpty:false,align:'center',valign:'bottom'});
 for(const value of ['', '   ', '\n \t']){
  const layout=layoutTextBox(e,value);
  assert.deepEqual([layout.x,layout.y,layout.w,layout.h],[150,280,0,0]);
  assert.deepEqual([layout.innerW,layout.innerH,layout.textHeight,layout.lines.length],[0,0,0,0]);
 }
 e.autoWidth=false;
 assert.deepEqual([layoutTextBox(e,'').w,layoutTextBox(e,'').h],[100,0]);
 e.autoWidth=true;e.autoHeight=false;
 assert.deepEqual([layoutTextBox(e,'').w,layoutTextBox(e,'').h],[0,80]);
 e.autoWidth=false;
 assert.deepEqual([layoutTextBox(e,'').w,layoutTextBox(e,'').h],[100,80]);
 assert.deepEqual([e.w,e.h],[100,80],'saved anchor dimensions must not change');
});
test('empty and populated cards have their own auto-sized geometry in preview and PNG',async()=>{
 const {nodes,draws}=dom();const {state,e}=setup({invisibleIfEmpty:false});
 state.mode='cards';
 state.cards=[
  {id:'empty',name:'Empty',values:{[e.id]:''},overrides:{},extraElements:[]},
  {id:'populated',name:'Populated',values:{[e.id]:'AB'},overrides:{},extraElements:[]}
 ];
 for(let i=0;i<2;i++){
  state.cardIndex=i;
  const layout=layoutTextBox(e,state.cards[i].values[e.id]);
  if(i===0)assert.deepEqual([layout.w,layout.h],[0,0]);
  else assert.ok(layout.w>0&&layout.h>0);
  renderStage();
  assert.ok(nodes.get('#stage').innerHTML.includes('width:'+layout.w*state.zoom+'px;height:'+layout.h*state.zoom+'px'));
  draws.length=0;await canvasCard(i,'cards');
  assert.ok(draws.some(x=>x.type==='fill'&&x.w===layout.w&&x.h===layout.h),
   'PNG element geometry should match the preview');
 }
});
