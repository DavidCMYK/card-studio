const vm=require('vm'),fs=require('fs'),path=require('path');const JSZip=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/pptxgenjs/node_modules/jszip');
let lastBlob=null,downloads=[];class MockEl{constructor(id){this.id=id;this.style={};this.dataset={};this.attrs={};this.children=[];this.files=[];this.classList={add(){},remove(){},toggle(){}};this.innerHTML='';this.textContent='';this.value='';this.disabled=false;this.listeners={};}addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)}emit(type,event){for(const fn of this.listeners[type]??[])fn(event)}click(){}append(){}remove(){}setAttribute(k,v){this.attrs[k]=v}closest(){return null}}
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,new MockEl(s));return nodes.get(s)};
const document={querySelector:get,querySelectorAll(){return[]},createElement(tag){return new MockEl(tag)},listeners:{},addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)},body:{append(){}},activeElement:{tagName:'BODY'}};
const window={addEventListener(){},queryLocalFonts:null};
const URL={createObjectURL(blob){lastBlob=blob;return 'blob:local'},revokeObjectURL(){}};
const sandbox={document,window,URL,Blob,JSZip,console,Image:class{},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t},clearTimeout,confirm(){return true},alert:console.log,prompt(){return 'Set'},structuredClone,Math,Date};
const source=fs.readFileSync(path.join(__dirname,'..','dist','app.js'),'utf8').replace("load('main');", "const m=load('model'),ui=load('interface'),sheet=load('spreadsheet'),png=load('png-export');window.__test={state:()=>m.S,exportXLSX:sheet.exportXLSX,applyTable:sheet.applyTable,patchElement:ui.patchElement,effective:m.effective,templateEl:m.templateEl,parseCSV:sheet.parseCSV,exportAll:png.exportAll};load('main');");
vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:15000});
const t=window.__test;if(!t)throw Error('No test API');let state=t.state();if(state.template.elements.length!==6)throw Error('Bad default elements');if(!get('#stage').innerHTML.includes('THE HOLLOW GATE'))throw Error('Stage not rendered');
const bg=state.template.elements[0];
state.selected=bg.id;
get('#canvasOuter').emit('pointerdown',{button:0,target:{closest(){return null}},composedPath(){return [get('#canvasOuter')]}});
if(state.selected!==null||!get('#inspector').innerHTML.includes('Card dimensions'))throw Error('Workspace click did not open Card setup');
// Simulate an actual stage selection followed by a bubble event. renderStage()
// replaces the clicked element, so target.closest('#stage') no longer finds it.
const clickedNode={dataset:{id:bg.id}};
const detachedTarget={closest(selector){return selector==='.element'?clickedNode:null}};
get('#stage').emit('pointerdown',{button:0,target:detachedTarget,clientX:0,clientY:0,preventDefault(){}});
if(state.selected!==bg.id||!get('#inspector').innerHTML.includes('Card background'))throw Error('Stage pointerdown did not select element');
get('#canvasOuter').emit('pointerdown',{button:0,target:detachedTarget,composedPath(){return [detachedTarget,get('#stage'),get('#canvasOuter')]}});
if(state.selected!==bg.id)throw Error('Stage click deselected on bubble after DOM was replaced');
state.mode='cards';
document.listeners.click[0]({target:{closest(selector){return selector==='[data-action]'?{dataset:{action:'card-setup'}}:null}},stopPropagation(){}});
if(state.mode!=='template'||state.selected!==null||!get('#inspector').innerHTML.includes('Card dimensions'))throw Error('Card setup toolbar button failed');

// Copy creates an independent template layer with all element properties intact.
state.mode='template';
const keyboard=(key,extra={})=>{let prevented=false;document.listeners.keydown[0]({key,ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,preventDefault(){prevented=true},...extra});return prevented};
const selectedTitle=state.template.elements.find(e=>e.name==='Card Title');
state.selected=selectedTitle.id;
if(!keyboard('c'))throw Error('Ctrl+C not handled');
if(!keyboard('v'))throw Error('Ctrl+V not handled');
const firstPaste=state.template.elements.at(-1);
if(firstPaste.id===selectedTitle.id||firstPaste.name===selectedTitle.name||firstPaste.fontSize!==selectedTitle.fontSize||firstPaste.x!==selectedTitle.x+12)throw Error('Template copy did not preserve properties and offset');
if(!keyboard('v')||state.template.elements.at(-1).id===firstPaste.id||state.template.elements.at(-1).name===firstPaste.name)throw Error('Repeated paste not unique');
const originalCount=state.template.elements.length;
document.activeElement={tagName:'INPUT'};
if(keyboard('v')||state.template.elements.length!==originalCount)throw Error('Paste intercepted text field');
document.activeElement={tagName:'BODY'};
state.selected=selectedTitle.id;
state.cards[0].values[selectedTitle.id]='Keep card data';
if(!keyboard('x')||state.template.elements.some(e=>e.id===selectedTitle.id))throw Error('Ctrl+X failed');
if(!keyboard('v')||!state.template.elements.some(e=>e.id===selectedTitle.id)||state.cards[0].values[selectedTitle.id]!=='Keep card data')throw Error('Cut/paste failed to preserve card values');
state.mode='cards';
state.selected=selectedTitle.id;
const countBefore=state.template.elements.length;
keyboard('c');
keyboard('v');
if(state.template.elements.length!==countBefore)throw Error('Card mode shortcuts changed template');
state.mode='template';
let title=state.template.elements.find(x=>x.name==='Card Title');t.applyTable([['Card Name','Card Title','Artwork','Description'],['A card','My sample','', 'Lorem ipsum'],['B card','Second', 'frog.png', 'Second text']]);
state=t.state();if(state.cards.length!==2||state.cards[1].values[title.id]!=='Second')throw Error('Import failed');
const old=title.x;t.patchElement(title.id,{x:55});if(t.effective(title).x!==55||title.x!==old)throw Error('Card override did not work');
(async()=>{await t.exportXLSX();if(!lastBlob)throw Error('No export blob');const z=await JSZip.loadAsync(await lastBlob.arrayBuffer());const files=Object.keys(z.files);if(!files.includes('xl/worksheets/sheet1.xml'))throw Error('Missing sheet');const sheet=await z.file('xl/worksheets/sheet1.xml').async('string');if(!sheet.includes('My sample')||!sheet.includes('Card Title')||!sheet.includes('Second'))throw Error('Missing cell data'); console.log('PASS: initial stage; spreadsheet import; card-only overrides; .xlsx generation.');})();
