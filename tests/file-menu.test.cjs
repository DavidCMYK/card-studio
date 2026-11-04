const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../.build/model.js');
const storage = require('../.build/project-storage.js');

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
}

test('File menu exposes project and template Save / Save As',()=>{
 const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/<details id="fileMenu"/);
 for (const name of ['new-project','open-project','load-template','save-project','save-project-as','save-template','save-template-as'])
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
 assert.equal(originalState.template.name,'After Save As','Original template remains unchanged');
 assert.equal(model.S.template.name,'Loaded template','Imported template is selected');
 model.S.template.name='Modified loaded template';
 assert.equal(await storage.saveTemplate(),true);
 assert.equal(loaded.writes,1);
 assert.equal(JSON.parse(loaded.content).template.name,'Modified loaded template');
 assert.equal(two.writes,2,'Import does not overwrite another template file');
 model.selectProjectTemplate(originalState.template.id);
 originalState.template.name='Modified first template';
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
