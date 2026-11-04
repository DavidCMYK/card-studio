const vm=require('vm'),fs=require('fs'),path=require('path');const JSZip=require('../vendor/jszip.min.js');
let lastBlob=null,downloads=[];class MockEl{constructor(id){this.id=id;this.style={};this.dataset={};this.attrs={};this.children=[];this.files=[];this.classList={add(){},remove(){},toggle(){}};this.innerHTML='';this.textContent='';this.value='';this.disabled=false;this.listeners={};}addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)}emit(type,event){for(const fn of this.listeners[type]??[])fn(event)}click(){}append(){}remove(){}setAttribute(k,v){this.attrs[k]=v}closest(){return null}}
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,new MockEl(s));return nodes.get(s)};
const document={querySelector:get,querySelectorAll(){return[]},createElement(tag){return new MockEl(tag)},listeners:{},addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)},body:{append(){}},activeElement:{tagName:'BODY'}};
const window={addEventListener(){},queryLocalFonts:null};
const URL={createObjectURL(blob){lastBlob=blob;return 'blob:local'},revokeObjectURL(){}};
const sandbox={document,window,URL,Blob,JSZip,console,Image:class{},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t},clearTimeout,confirm(){return true},alert:console.log,prompt(){return 'Set'},structuredClone,Math,Date};
const source=fs.readFileSync(path.join(__dirname,'..','dist','app.js'),'utf8').replace("load('main');", "const m=load('model'),ui=load('interface'),sheet=load('spreadsheet'),png=load('png-export');window.__test={state:()=>m.S,exportXLSX:sheet.exportXLSX,applyTable:sheet.applyTable,patchElement:ui.patchElement,effective:m.effective,templateEl:m.templateEl,parseCSV:sheet.parseCSV,exportAll:png.exportAll,selectInspectorTab:ui.selectInspectorTab};load('main');");
vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:15000});
const t=window.__test;if(!t)throw Error('No test API');let state=t.state();if(state.template.elements.length!==6)throw Error('Bad default elements');if(!get('#stage').innerHTML.includes('THE HOLLOW GATE'))throw Error('Stage not rendered');
// Full-card background elements can cover every pixel of the stage: clicking the workspace must still deselect.
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
// Resize handles exist on every edge/corner, and top-left resize adjusts position and size.
state.selected=bg.id;
const bgW=bg.w,bgH=bg.h;
get('#stage').emit('pointerdown',{button:0,target:{closest(selector){if(selector==='.element')return {dataset:{id:bg.id}};if(selector==='[data-handle]')return {dataset:{handle:'nw'}};return null}},clientX:100,clientY:100,preventDefault(){}});
const moveX=100-(10*state.zoom),moveY=100-(12*state.zoom);
document.listeners.pointermove[0]({clientX:moveX,clientY:moveY});
if(Math.abs(bg.x+10)>.002||Math.abs(bg.y+12)>.002||Math.abs(bg.w-bgW-10)>.002||Math.abs(bg.h-bgH-12)>.002)throw Error('Top-left resize handle did not adjust x/y/w/h');
document.listeners.pointerup[0]({});

// Regression: fit image resize must not accumulate deltas from mutated geometry;
// reversing mouse movement in one gesture must instantly reverse the size.
const artwork = state.template.elements.find(e => e.name === 'Artwork');
Object.assign(artwork,{imageFit:'contain',x:50,y:50,w:160,h:120});
state.selected=artwork.id;
const startResize=(handle)=>get('#stage').emit('pointerdown',{
  button:0,target:{closest(sel){return sel==='.element'?{dataset:{id:artwork.id}}:sel==='[data-handle]'?{dataset:{handle}}:null}},
  clientX:300,clientY:300,preventDefault(){}
});
const moveResize=(dx,dy)=>document.listeners.pointermove[0]({clientX:300+dx*state.zoom,clientY:300+dy*state.zoom});
startResize('se');
moveResize(-40,-30);
if(!(artwork.w<160&&artwork.h<120))throw Error('First fit resize did not shrink');
moveResize(32,24);
if(!(artwork.w>160&&artwork.h>120))throw Error('Reversing fit resize did not enlarge');
moveResize(0,0);
if(Math.abs(artwork.w-160)>.002||Math.abs(artwork.h-120)>.002)throw Error('Fit resize did not return to its original size');
document.listeners.pointerup[0]({});
startResize('se');
moveResize(32,24);
moveResize(-40,-30);
if(!(artwork.w<160&&artwork.h<120))throw Error('Enlarge then shrink did not reverse');
document.listeners.pointerup[0]({});
Object.assign(artwork,{imageFit:'stretch',w:160,h:120});
startResize('e');
moveResize(25,0);
if(Math.abs(artwork.w-185)>.002||Math.abs(artwork.h-120)>.002)throw Error('Free width handle did not follow pointer');
moveResize(-25,0);
if(Math.abs(artwork.w-135)>.002)throw Error('Side handle reversed with incorrect rate');
document.listeners.pointerup[0]({});

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

// Regression: editing element A and selecting B must never replay a delayed
// blur/change from A onto B. All property controls remember their owner.
state.mode='template';
const editA=state.template.elements.find(x=>x.name==='Card Title');
const editB=state.template.elements.find(x=>x.name==='Description');
const selectEdit=(el)=>{
 get('#stage').emit('pointerdown',{button:0,target:{closest(selector){return selector==='.element'?{dataset:{id:el.id}}:null}},clientX:0,clientY:0,preventDefault(){}});
 document.listeners.pointerup[0]({});
};
selectEdit(editA);
if(!get('#inspector').innerHTML.includes(`data-edit-owner="${editA.id}" data-edit-mode="template" data-edit-card="0" data-prop="x"`))throw Error('Inspector does not bind fields to their original element');
t.selectInspectorTab('content');
if(!get('#inspector').innerHTML.includes(`data-edit-owner="${editA.id}" data-edit-mode="template" data-edit-card="0" data-prop="text"`))throw Error('Default text field not bound to selected element');
t.selectInspectorTab('layout');
const staleX={dataset:{prop:'x',editOwner:editA.id,editMode:'template',editCard:'0'},type:'number',value:'17.5'};
get('#inspector').emit('input',{target:staleX});
const savedA=editA.x;
selectEdit(editB);
const savedBx=editB.x,savedBw=editB.w;
staleX.value='500';
get('#inspector').emit('input',{target:staleX});
get('#inspector').emit('change',{target:staleX});
const staleWidth={dataset:{prop:'w',editOwner:editA.id,editMode:'template',editCard:'0'},type:'number',value:'999'};
get('#inspector').emit('change',{target:staleWidth});
if(editA.x!==savedA||editB.x!==savedBx||editB.w!==savedBw)throw Error('Stale inspector field edited a different element');
const currentX={dataset:{prop:'x',editOwner:editB.id,editMode:'template',editCard:'0'},type:'number',value:'25'};
get('#inspector').emit('input',{target:currentX});
if(Math.abs(editB.x-25*96/25.4)>.001)throw Error('Current selected element field no longer works');
editA.x=13;editB.x=18;
state.mode='cards';state.cardIndex=0;state.selected=editB.id;
const staleCard={dataset:{prop:'w',editOwner:editB.id,editMode:'cards',editCard:'0'},type:'number',value:'300'};
state.cards.push({id:'event-regression',name:'Other',values:{},overrides:{},extraElements:[]});
state.cardIndex=1;
get('#inspector').emit('change',{target:staleCard});
if(state.cards[1].overrides[editB.id])throw Error('Stale inspector field edited a different card');
state.cards.pop();state.cardIndex=0;state.mode='template';state.selected=null;

// Exercise real inspector change handlers, including DPI with pixel units.
state.mode='template';
state.selected=null;
const prop=(key,value,kind='input')=>{
 const target={dataset:{prop:key},type:'number',value:String(value)};
 get('#inspector').emit(kind,{target});
};
prop('template.unit','px');
const oldPhysicalWidth=state.template.width*96/state.template.dpi;
const firstPixels=state.template.width;
prop('template.dpi','600');
if(Math.abs(state.template.width-firstPixels*2)>.01||Math.abs(state.template.width*96/state.template.dpi-oldPhysicalWidth)>.001)throw Error('DPI change altered physical card width in pixel mode');
if(!get('#statusLeft').textContent.includes('export px'))throw Error('Status does not show export pixel dimensions');
prop('template.unit','mm');
if(Math.abs(state.template.width-63)>.01)throw Error('Unit switch did not preserve physical width');
prop('template.width','50');
if(!get('#statusLeft').textContent.includes('50 ×'))throw Error('Canvas resize not reflected in status');
state.selected=state.template.elements.find(x=>x.name==='Artwork').id;
// A 100-pixel-wide image frame at 600 DPI corresponds to 16 design pixels.
prop('w','16.9333333333'); // mm -> approx 400 export pixels
const selectedElement=state.template.elements.find(x=>x.id===state.selected);
if(Math.abs(selectedElement.w-64)>.01)throw Error('Element width not converted from mm');
state.selected=null;
state.template.width=63;
state.template.height=88;
state.template.dpi=300;
state.template.unit='mm';
let title=state.template.elements.find(x=>x.name==='Card Title');t.applyTable([['Card Name','Card Title','Artwork','Description'],['A card','My sample','', 'Lorem ipsum'],['B card','Second', 'frog.png', 'Second text']]);
state=t.state();if(state.cards.length!==2||state.cards[1].values[title.id]!=='Second')throw Error('Import failed');
const old=title.x;t.patchElement(title.id,{x:55});if(t.effective(title).x!==55||title.x!==old)throw Error('Card override did not work');
(async()=>{await t.exportXLSX();if(!lastBlob)throw Error('No export blob');const z=await JSZip.loadAsync(await lastBlob.arrayBuffer());const files=Object.keys(z.files);if(!files.includes('xl/worksheets/sheet1.xml'))throw Error('Missing sheet');const sheet=await z.file('xl/worksheets/sheet1.xml').async('string');if(!sheet.includes('My sample')||!sheet.includes('Card Title')||!sheet.includes('Second'))throw Error('Missing cell data');
 title.includeInDataExport=false;
 await t.exportXLSX();
 const filteredZip=await JSZip.loadAsync(await lastBlob.arrayBuffer());
 const filteredSheet=await filteredZip.file('xl/worksheets/sheet1.xml').async('string');
 if(filteredSheet.includes('My sample')||!filteredSheet.includes('Description')||!filteredSheet.includes('Artwork'))throw Error('XLSX export did not filter excluded element columns');
 delete title.includeInDataExport;
 console.log('PASS: initial stage; spreadsheet import; card-only overrides; .xlsx generation and data-column filtering.');})();
