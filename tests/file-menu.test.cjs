const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../.build/model.js');
const storage = require('../.build/project-storage.js');
const collection = require('../.build/project-collections.js');
const {getImageData} = require('../.build/image-sets.js');

function makeHandle(name, content = '') {
 let value = content, writes = 0;
 return {
  name,
  get content() { return value; },
  get writes() { return writes; },
  async getFile() { return {name, text: async()=>value}; },
  async createWritable() {
   let buffer = '';
   return {async write(text) { buffer = text; },async close() { value=buffer; writes++; },async abort() {}};
  },
 };
}
function fakeDOM() {
 const nodes = new Map();
 global.document = {
  querySelector(selector) {
   if (!nodes.has(selector)) nodes.set(selector,{
    classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',textContent:'',value:'',
    click() { this.clicked=(this.clicked||0)+1; },
   });
   return nodes.get(selector);
  },
  createElement() { return {click(){},remove(){}}; },
  body:{append(){}},
 };
 global.URL = {createObjectURL:()=> 'blob:fake', revokeObjectURL(){}};
 // Browser APIs used while repainting an imported project with real artwork.
 global.Image = class { set src(value) { this.source=value; } };
 // Preserve the underlying browser error instead of masking it with
 // ReferenceError: alert is not defined in Node's test environment.
 global.alert = message => { throw new Error('Unexpected browser alert: '+message); };
}

test('File menu exposes project and template Save / Save As',()=>{
 const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/<details id="fileMenu"/);
 for (const name of ['new-project','open-project','load-template','save-project','save-project-as','save-template','save-template-as','save-all-templates'])
  assert.match(html,new RegExp(`data-action="${name}"`));
});

test('Save overwrites opened/saved handle, Save As switches target, projects remain separate',async()=>{
 fakeDOM();
 const one=makeHandle('first.template.json');
 const two=makeHandle('second.template.json');
 const project=makeHandle('deck.cardstudio.json');
 let picks = 0;
 const queue=[one,two,project];
 global.window = {
  showSaveFilePicker:async()=>{ picks++; return queue.shift(); },
  showOpenFilePicker:async()=>[one],
 };
 const originalState=model.initial();
 const originalTemplate=originalState.template;
 model.replaceState(originalState);
 storage.resetFileHandles();

 assert.equal(await storage.saveTemplate(),true);
 assert.equal(picks,1);
 assert.equal(one.writes,1);
 assert.equal(JSON.parse(one.content).template.name,'Standard game card');
 originalState.template.name='Edited version';
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(picks,1,'Save should not open another picker');
 assert.equal(one.writes,2);
 assert.equal(JSON.parse(one.content).template.name,'Edited version');

 assert.equal(await storage.saveTemplateAs(),true);
 assert.equal(picks,2);
 assert.equal(two.writes,1);
 originalState.template.name='After Save As';
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(picks,2);
 assert.equal(two.writes,2);
 assert.equal(one.writes,2,'Old Save As target must not be overwritten');

 assert.equal(await storage.saveProject(),true);
 assert.equal(picks,3);
 assert.equal(project.writes,1);
 assert.equal(JSON.parse(project.content).type,'cardstudio-project');
 originalState.projectName='New deck title';
 assert.equal(await storage.saveProject(),true);
 assert.equal(picks,3);
 assert.equal(project.writes,2);
 assert.equal(two.writes,2,'Project Save must not overwrite template');

 // Opening an existing template binds its original handle for subsequent Save.
 const loaded=makeHandle('loaded.template.json',JSON.stringify({type:'cardstudio-template',version:2,template:{...originalState.template,name:'Loaded template'}}));
 window.showOpenFilePicker=async()=>[loaded];
 await storage.openFromDisk('template');
 assert.equal(model.S.templates.length,2,'Import adds an independent template');
 assert.strictEqual(model.S.templates[0],originalTemplate,'Original template object remains in the project');
 assert.equal(originalTemplate.name,'After Save As','Original template remains unchanged');
 assert.equal(model.S.template.name,'Loaded template','Imported template is selected');
 model.S.template.name='Modified loaded template';
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(loaded.writes,1);
 assert.equal(JSON.parse(loaded.content).template.name,'Modified loaded template');
 assert.equal(two.writes,2,'Import does not overwrite another template file');
 model.selectProjectTemplate(originalTemplate.id);
 originalTemplate.name='Modified first template';
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(two.writes,3,'Returning to the first template reuses its own Save As handle');
 assert.equal(JSON.parse(two.content).template.name,'Modified first template');
 model.selectProjectTemplate(model.S.templates[1].id);

 // Resetting for New clears file handle associations.
 storage.resetFileHandles();
 const fresh=makeHandle('fresh.template.json');
 window.showSaveFilePicker=async()=>{picks++; return fresh;};
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(fresh.writes,1);
 assert.equal(loaded.writes,1);
});

test('Save All preserves saved template files and adds new ones to the selected folder',async()=>{
 fakeDOM();
 model.replaceState(model.initial());
 storage.resetFileHandles();
 const existing=makeHandle('first.template.json');
 const newlyCreated=makeHandle('second.template.json');
 let savePickers=0,folderPickers=0,openedNames=[];
 global.window={
  showSaveFilePicker:async()=>{savePickers++;return existing;},
  showDirectoryPicker:async()=>{
   folderPickers++;
   return {getFileHandle:async(name,{create})=>{
    openedNames.push(name);
    assert.equal(create,true);
    return newlyCreated;
   }};
  }
 };
 assert.equal(await storage.saveTemplate(),true);
 const first=model.S.template;
 const second=collection.createTemplate(first);
 second.name='Second layout';
 await storage.saveAllTemplates();
 assert.equal(existing.writes,2,'Save All updates the first template directly');
 assert.equal(newlyCreated.writes,1,'Only the new template needs a folder destination');
 assert.equal(folderPickers,1);
 assert.deepEqual(openedNames,['Second layout.template.json']);
 assert.equal(JSON.parse(existing.content).template.id,first.id);
 assert.equal(JSON.parse(newlyCreated.content).template.id,second.id);
 second.name='Edited second layout';
 await storage.saveAllTemplates();
 assert.equal(existing.writes,3,'Both existing files update on repeated Save All');
 assert.equal(newlyCreated.writes,2);
 assert.equal(folderPickers,1,'Known files do not require selecting another folder');
 assert.equal(savePickers,1);
 storage.resetFileHandles();
});

test('whole-project save and open retain shared front/back template assignments and card data',async()=>{
 fakeDOM();
 model.replaceState(model.initial());
 storage.resetFileHandles();
 const project=model.S,front=project.templates[0],back=collection.createTemplate(front);
 back.name='Shared backs';
 const alternate=collection.createTemplate(front);
 alternate.name='Alternate fronts';
 collection.assignSetTemplate(project.cardSets[0].id,'back',back.id);
 const other=collection.newCardSet('Alternate set',alternate.id);
 collection.assignSetTemplate(other.id,'back',back.id);
 const field=front.elements.find(e=>e.kind==='text');
 project.cards[0].values[field.id]='Retained card title';
 project.cards[0].overrides[field.id]={fontSize:27};
 project.cards.push({id:'other-card',name:'Other card',setId:other.id,values:{},overrides:{},extraElements:[]});
 const saved=makeHandle('saved-deck.cardstudio.json');
 global.window={showSaveFilePicker:async()=>saved};
 assert.equal(await storage.saveProject(),true);
 const json=JSON.parse(saved.content);
 assert.equal(json.templates.length,3);
 assert.equal(json.cardSets.length,2);
 model.replaceState(model.initial());
 assert.equal(await storage.openJSON({text:async()=>saved.content}),true);
 const loaded=model.S;
 assert.equal(loaded.cardSets[0].backTemplateId,back.id);
 assert.equal(loaded.cardSets[1].frontTemplateId,alternate.id);
 assert.equal(loaded.cardSets[1].backTemplateId,back.id);
 assert.equal(model.assignedTemplate(0,'front').id,front.id);
 assert.equal(model.assignedTemplate(0,'back').id,back.id);
 assert.equal(model.assignedTemplate(1,'front').id,alternate.id);
 assert.equal(model.assignedTemplate(1,'back').id,back.id);
 assert.equal(loaded.cards[0].values[field.id],'Retained card title');
 assert.equal(loaded.cards[0].overrides[field.id].fontSize,27);
 assert.strictEqual(loaded.template,loaded.templates.find(t=>t.id===loaded.selectedTemplateId));
 storage.resetFileHandles();
});

test('legacy project file imports its real template, embedded images and card overrides, then round-trips',async()=>{
 fakeDOM();
 model.replaceState(model.initial());
 storage.resetFileHandles();
 const legacy=model.initial();
 legacy.version=1;
 legacy.projectName='Original deck';
 legacy.template.name='Original design';
 legacy.template.elements[0].fill1='#123456';
 const picture=legacy.template.elements.find(e=>e.kind==='image');
 picture.autoSet='legacy-art';
 picture.autoMode='single';
 picture.singleImage='hero.png';
 const imageData='data:image/png;base64,aGVybw==';
 legacy.sets=[{id:'legacy-art',name:'Original artwork',images:[{name:'hero.png',data:imageData}]}];
 const title=legacy.template.elements.find(e=>e.kind==='text');
 legacy.cards[0].values[title.id]='Saved character name';
 legacy.cards[0].overrides[title.id]={fontSize:31};
 delete legacy.templates;
 delete legacy.cardSets;
 delete legacy.selectedTemplateId;
 delete legacy.side;
 delete legacy.cards[0].setId;
 global.window={};
 assert.equal(await storage.openJSON({text:async()=>JSON.stringify(legacy)}),true);
 assert.equal(model.S.projectName,'Original deck');
 assert.equal(model.S.templates.length,1);
 assert.equal(model.S.template.name,'Original design');
 assert.strictEqual(model.S.template,model.S.templates[0]);
 assert.deepEqual(model.S.template.elements,legacy.template.elements,'Saved artwork layers survive migration');
 assert.equal(model.S.cardSets.length,1);
 assert.equal(model.S.cardSets[0].frontTemplateId,model.S.template.id);
 assert.equal(model.S.cards[0].setId,model.S.cardSets[0].id);
 assert.equal(model.S.cards[0].values[title.id],'Saved character name');
 assert.equal(model.S.cards[0].overrides[title.id].fontSize,31);
 assert.equal(model.S.sets[0].images[0].data,imageData);
 assert.equal(getImageData(model.S.template.elements.find(e=>e.id===picture.id),0,'cards'),imageData);

 // The migrated deck must also remain intact after saving in the new format.
 const saved=makeHandle('migrated.cardstudio.json');
 window.showSaveFilePicker=async()=>saved;
 assert.equal(await storage.saveProject(),true);
 assert.equal(JSON.parse(saved.content).templates[0].name,'Original design');
 model.replaceState(model.initial());
 assert.equal(await storage.openJSON({text:async()=>saved.content}),true);
 assert.equal(model.S.template.name,'Original design');
 assert.equal(model.S.cards[0].values[title.id],'Saved character name');
 assert.equal(getImageData(model.S.template.elements.find(e=>e.id===picture.id),0,'cards'),imageData);
 storage.resetFileHandles();
});

test('Unsupported native file API downloads, without pretending it overwrote',async()=>{
 const realTimeout=global.setTimeout;
 global.setTimeout=(...args)=>{const timer=realTimeout(...args);timer.unref?.();return timer;};
 fakeDOM();
 global.window={};
 model.replaceState(model.initial());
 storage.resetFileHandles();
 assert.equal(await storage.saveTemplate(),false);
 assert.match(document.querySelector('#toast').textContent,/Downloaded a copy/);
 await storage.openFromDisk('template');
 assert.equal(document.querySelector('#openTemplateFile').clicked,1);
 global.setTimeout=realTimeout;
});
