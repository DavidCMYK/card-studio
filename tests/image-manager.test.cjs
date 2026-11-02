const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../.build/model.js');
const {renameImage,removeImage}=require('../.build/image-set-edit.js');
const {openImageManager,closeImageManager}=require('../.build/image-manager.js');
const {getImageRef}=require('../.build/image-sets.js');

function setup(){
 const state=model.initial(),frame=state.template.elements.find(e=>e.kind==='image');
 frame.autoSet='one';frame.autoMode='single';frame.singleImage='alpha.png';
 state.sets=[{id:'one',name:'Art',images:[
  {name:'alpha.png',data:'data:a'},{name:'beta.png',data:'data:b'}]},
  {id:'two',name:'Other',images:[{name:'alpha.png',data:'data:c'}]}];
 state.cards[0].values[frame.id]='Art/alpha.png';
 model.replaceState(state);
 return {state,frame};
}
test('Manage images opens a per-set dialog with add, rename and remove controls',()=>{
 const {state}=setup(),oldDoc=global.document;
 const nodes=new Map(),get=q=>{if(!nodes.has(q))nodes.set(q,{innerHTML:''});return nodes.get(q)};
 global.document={querySelector:get};
 try{
  openImageManager('one');
  const html=get('#dialogHolder').innerHTML;
  assert.match(html,/Manage images/);
  assert.match(html,/data-action="manage-add"/);
  assert.match(html,/data-action="manage-rename"/);
  assert.match(html,/data-action="manage-remove"/);
  assert.match(html,/alpha\.png/);
  assert.equal(state.sets.length,2);
 }finally{closeImageManager();global.document=oldDoc}
});
test('Renaming preserves the image data and updates Single Image and card references',()=>{
 const {state,frame}=setup();
 const data=state.sets[0].images[0].data;
 renameImage('one','alpha.png','hero.png');
 assert.equal(frame.singleImage,'hero.png');
 assert.equal(state.sets[0].images[0].data,data);
 assert.equal(state.cards[0].values[frame.id],'Art/hero.png');
 assert.equal(getImageRef(frame,0,'cards'),state.sets[0].images[0]);
 assert.equal(state.sets[1].images[0].name,'alpha.png');
});
test('Removing one image retains the set and clears only its references',()=>{
 const {state,frame}=setup();
 removeImage('one','alpha.png');
 assert.deepEqual(state.sets[0].images.map(x=>x.name),['beta.png']);
 assert.equal(state.sets.length,2);
 assert.equal(frame.singleImage,'');
 assert.equal(state.cards[0].values[frame.id],'none');
});
test('Invalid or duplicate filenames cannot replace existing files',()=>{
 const {state}=setup();
 for(const newName of ['', 'beta.png', 'folder/new.png'])
  assert.throws(()=>renameImage('one','alpha.png',newName));
 assert.equal(state.sets[0].images.length,2);
});
test('Image rename does not modify text card values',()=>{
 const {state}=setup(),text=state.template.elements.find(e=>e.kind==='text');
 state.cards[0].values[text.id]='Art/alpha.png';
 renameImage('one','alpha.png','new.png');
 assert.equal(state.cards[0].values[text.id],'Art/alpha.png');
});
