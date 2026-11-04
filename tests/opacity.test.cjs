const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {renderStage}=require('../.build/preview.js');
const {renderInspector,patchElement,selectInspectorTab}=require('../.build/interface.js');
const {canvasCard}=require('../.build/png-renderer.js');
const {imageCache}=require('../.build/image-sets.js');
const {migrateComponentOpacities}=require('../.build/project-storage.js');
function setup(){
  const nodes=new Map(),events=[];
  const node=k=>{if(!nodes.has(k))nodes.set(k,{style:{},innerHTML:'',textContent:''});return nodes.get(k)};
  global.document={querySelector:node,createElement(){
    const ctx={globalAlpha:1,fillStyle:'',stack:[],
      save(){this.stack.push(this.globalAlpha)},restore(){this.globalAlpha=this.stack.pop()},
      scale(){},beginPath(){},rect(){},roundRect(){},clip(){},ellipse(){},
      fillRect(){events.push({kind:'fill',alpha:this.globalAlpha,color:this.fillStyle})},
      stroke(){events.push({kind:'border',alpha:this.globalAlpha})},
      fillText(){events.push({kind:'text',alpha:this.globalAlpha})},
      drawImage(){events.push({kind:'image',alpha:this.globalAlpha})},
      measureText(s){return {width:String(s).length*5}},createLinearGradient(){return {addColorStop(){}}}
    };
    return {width:0,height:0,getContext(){return ctx}};
  }};
  return {node,events};
}
test('component opacity inputs are independently available for each relevant element',()=>{
  const {node}=setup(),s=model.initial();model.replaceState(s);
  selectInspectorTab('style');
  for(const kind of ['text','image','shape']){
    const e=model.makeElement(kind);s.template.elements=[e];s.selected=e.id;renderInspector();
    const html=node('#inspector').innerHTML;
    assert.match(html,/data-prop="fillOpacity"/);assert.match(html,/data-prop="borderOpacity"/);
    assert.equal(html.includes('data-prop="textOpacity"'),kind==='text');
    assert.doesNotMatch(html,/data-prop="opacity"/);
  }
});
test('editor preview uses component layers without fading selection handles',()=>{
  const {node}=setup(),s=model.initial();
  const e=model.makeElement('text',{fillMode:'solid',borderWidth:2,fillOpacity:25,borderOpacity:75,textOpacity:40});
  s.template.elements=[e];s.selected=e.id;model.replaceState(s);renderStage();
  const html=node('#stage').innerHTML;
  assert.match(html,/class="element-fill"[^>]*opacity:0\.25/);
  assert.match(html,/class="element-border"[^>]*opacity:0\.75/);
  assert.match(html,/class="text-layer"[^>]*opacity:0\.4/);
  assert.match(html,/resize-handle resize-nw/);
});
test('PNG exports use separate fill, text, border and image opacity',async()=>{
  const {events}=setup(),s=model.initial();
  const e=model.makeElement('text',{text:'Word',fillMode:'solid',fill1:'#112233',borderWidth:3,fillOpacity:20,borderOpacity:90,textOpacity:60});
  s.template.elements=[e];model.replaceState(s);await canvasCard(0,'template');
  assert.ok(events.some(x=>x.kind==='fill'&&x.color==='#112233'&&x.alpha===.2));
  assert.ok(events.some(x=>x.kind==='border'&&x.alpha===.9));
  assert.ok(events.some(x=>x.kind==='text'&&x.alpha===.6));
  const im=model.makeElement('image',{fillOpacity:15,borderOpacity:100,borderWidth:2,autoSet:'s'});
  s.template.elements=[im];s.sets=[{id:'s',name:'s',images:[{name:'a.png',data:'data:image/png;base64,AAAA'}]}];
  imageCache.set(s.sets[0].images[0].data,{im:{naturalWidth:10,naturalHeight:10},loaded:true,error:false});
  await canvasCard(0,'template');
  assert.ok(events.some(x=>x.kind==='image'&&x.alpha===.15));
  assert.ok(events.some(x=>x.kind==='border'&&x.alpha===1));
  imageCache.clear();
});
test('legacy overall opacity and card-only overrides retain original appearance',()=>{
  setup();const s=model.initial(),e=model.makeElement('text');
  delete e.fillOpacity;delete e.borderOpacity;delete e.textOpacity;e.opacity=35;
  s.template.elements=[e];s.cards[0].overrides[e.id]={opacity:65};model.replaceState(s);
  assert.equal(model.opacityFor(e,'textOpacity'),.35);
  migrateComponentOpacities(s);
  s.mode='cards';patchElement(e.id,{fillOpacity:10});
  const merged=model.effective(e);
  assert.equal(model.opacityFor(merged,'fillOpacity'),.1);
  assert.equal(model.opacityFor(merged,'textOpacity'),.65);
  assert.equal(model.opacityFor(merged,'borderOpacity'),.65);
});
