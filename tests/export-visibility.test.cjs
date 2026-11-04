const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../.build/model.js');
const {renderStage} = require('../.build/preview.js');
const {renderInspector, renderLeft, selectInspectorTab} = require('../.build/interface.js');
const {canvasCard} = require('../.build/png-renderer.js');

function initDOM(){
  const nodes = new Map();
  const node = key => { if(!nodes.has(key)) nodes.set(key,{
    style:{},innerHTML:'',textContent:'',classList:{toggle(){}},
  });return nodes.get(key); };
  let paints=[];
  global.document = {
    querySelector: node,
    createElement(tag){
      assert.equal(tag,'canvas');
      const ctx={
        fillStyle:'',globalAlpha:1,
        save(){},restore(){},scale(){},beginPath(){},rect(){},clip(){},
        fillRect(x,y,w,h){paints.push({fill:this.fillStyle,x,y,w,h});},
      };
      return {width:0,height:0,getContext(){return ctx;}};
    },
  };
  return {node, paints:()=>paints,clearPaints:()=>{paints=[];}};
}

test('editor-only elements show in template but never in cards preview or PNGs', async()=>{
  const {node,paints,clearPaints}=initDOM();
  const s=model.initial();
  const normal=model.makeElement('shape',{name:'Printable',fillMode:'solid',fill1:'#00ff00',x:10,y:10,w:40,h:30});
  const guide=model.makeElement('shape',{name:'Cut line',fillMode:'solid',fill1:'#ff0000',includeInExport:false,x:5,y:5,w:50,h:40});
  s.template.elements=[normal,guide];
  model.replaceState(s);

  s.mode='template';
  s.selected=guide.id;
  renderStage();
  assert.match(node('#stage').innerHTML,new RegExp(`data-id="${guide.id}"`));
  selectInspectorTab('rules');renderInspector();
  assert.match(node('#inspector').innerHTML,/Include in exported images/);
  assert.match(node('#inspector').innerHTML,/data-prop="includeInExport"/);
  assert.doesNotMatch(node('#inspector').innerHTML,/data-prop="includeInExport"[^>]*checked/);
  renderLeft();
  assert.match(node('#leftBody').innerHTML,/editor only/);

  s.mode='cards';
  s.selected=null;
  renderStage();
  assert.doesNotMatch(node('#stage').innerHTML,new RegExp(`data-id="${guide.id}"`));
  assert.match(node('#stage').innerHTML,new RegExp(`data-id="${normal.id}"`));
  renderLeft();
  assert.doesNotMatch(node('#leftBody').innerHTML,/Cut line/);
  s.cards[0].overrides[guide.id]={includeInExport:true}; // template exclusion must win

  for(const mode of ['cards','template']){
    clearPaints();
    await canvasCard(0,mode);
    assert.ok(paints().some(x=>x.fill==='#00ff00'),`Printable shape missing from ${mode} export`);
    assert.ok(!paints().some(x=>x.fill==='#ff0000'),`Cut-line guide appeared in ${mode} export`);
  }

  // Old project files lack the property. Their elements should still export.
  delete guide.includeInExport;
  delete s.cards[0].overrides[guide.id];
  clearPaints();
  await canvasCard(0,'cards');
  assert.ok(paints().some(x=>x.fill==='#ff0000'),'Old element was unexpectedly excluded');
  assert.equal(JSON.parse(JSON.stringify(s)).template.elements[0].includeInExport,true);
});
