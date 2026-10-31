import { S, initial, replaceState, card, templateEl, layerEls, isExtra, effective, uniqName, px, perUnit, sizePx, clamp, uid } from './model';
import { $ , toast } from './dom';
import { renderStage } from './preview';
import { repaint, renderInspector, renderLeft, chooseCard, patchElement, addElement, setKnownFonts, baseFonts } from './interface';
import { imageCache, setImageUpdateHandler } from './image-sets';
import { exportPNG, exportAll } from './png-export';
import { exportXLSX, readSheet } from './spreadsheet';
import { saveProject, saveTemplate, openJSON } from './project-storage';
import { importImages, setTargetImageSet } from './assets';
setImageUpdateHandler(renderStage);

function newCard(copy=null){const c=copy?{id:uid(),name:copy.name+' copy',values:{...copy.values},overrides:structuredClone(copy.overrides||{}),extraElements:structuredClone(copy.extraElements||[])}:{id:uid(),name:'Card '+String(S.cards.length+1).padStart(3,'0'),values:{},overrides:{},extraElements:[]};S.cards.push(c);S.mode='cards';S.cardIndex=S.cards.length-1;S.selected=null;repaint();return c}
function mutateAction(action,el: any = null){switch(action){case 'new-project':if(confirm('Start a new project? Unsaved changes will be lost.')){replaceState(initial());imageCache.clear();repaint()}break;
case 'open-project':$('#openProjectFile').click();break;case 'save-project':saveProject();break;case 'save-template':saveTemplate();break;case 'load-template':$('#openTemplateFile').click();break;
case 'mode-template':S.mode='template';S.selected=null;repaint();break;case 'mode-cards':S.mode='cards';S.selected=null;repaint();break;
case 'add-text':case 'add-image':case 'add-shape':addElement(action.slice(4));break;
case 'delete-element':if(!S.selected)return;if(S.mode==='cards'){if(isExtra(S.selected)){card().extraElements=card().extraElements.filter(x=>x.id!==S.selected)}else patchElement(S.selected,{hidden:true});S.selected=null;repaint();toast('Removed from this card only')}else if(confirm('Delete this element from the template and all cards?')){S.template.elements=S.template.elements.filter(x=>x.id!==S.selected);S.selected=null;repaint()}break;
case 'layer-up':case 'layer-down':{if(S.mode==='cards'&&!isExtra(S.selected)){toast('Shared layer order is changed in Template mode');return}const a=S.mode==='cards'?card().extraElements:S.template.elements;let ix=a.findIndex(e=>e.id===S.selected),delta=action==='layer-up'?1:-1;if(ix<0||ix+delta<0||ix+delta>=a.length)return;[a[ix],a[ix+delta]]=[a[ix+delta],a[ix]];repaint();break}
case 'zoom-in':S.zoom=clamp(Math.round((S.zoom+.1)*100)/100,.3,3);renderStage();break;
case 'zoom-out':S.zoom=clamp(Math.round((S.zoom-.1)*100)/100,.3,3);renderStage();break;
case 'add-set':{const name=prompt('Name this image set (e.g. Creature Artwork):');if(!name?.trim())return;const set={id:uid(),name:name.trim(),images:[]};S.sets.push(set);setTargetImageSet(set.id);$('#assetFiles').click();repaint();break}
case 'add-to-set':setTargetImageSet(el.dataset.set);$('#assetFiles').click();break;
case 'remove-set':{const id=el.dataset.set,set=S.sets.find(x=>x.id===id);if(set&&confirm(`Remove image set "${set.name}" and its ${set.images.length} images?`)){S.sets=S.sets.filter(x=>x.id!==id);imageCache.clear();repaint()}break}
case 'add-card':newCard();break;case 'duplicate-card':newCard(S.cards[Number(el.dataset.cardindex)]);break;
case 'delete-card':if(S.cards.length<=1){toast('At least one card must remain');return}if(confirm('Delete the selected card?')){S.cards.splice(S.cardIndex,1);chooseCard(Math.min(S.cardIndex,S.cards.length-1))}break;
case 'reset-card':if(card()&&confirm('Reset all element positions and styles for this card?')){card().overrides={};card().extraElements=[];repaint()}break;
case 'reset-element':if(card()){if(isExtra(S.selected)){card().extraElements=card().extraElements.filter(e=>e.id!==S.selected);S.selected=null}else delete card().overrides[S.selected];repaint()}break;
case 'prev-card':chooseCard(S.cardIndex-1);break;case 'next-card':chooseCard(S.cardIndex+1);break;
case 'export-sheet':exportXLSX().catch(err=>alert(err.message));break;case 'import-sheet':$('#openSheetFile').click();break;
case 'export-current':exportPNG();break;case 'export-all':exportAll();break;
case 'scan-fonts':scanFonts();break;
}}
async function scanFonts(){if(!('queryLocalFonts' in window)){alert('This browser does not provide installed-font listing. You can still type the name of any installed font in the Font family field. Chrome or Edge on desktop may support font listing.');return}try{const fonts=await window.queryLocalFonts(),names=[...new Set(fonts.map(f=>f.family))].sort();setKnownFonts([...new Set([...baseFonts(),...names])]);renderInspector();toast(`Found ${names.length} installed font families`)}catch(err){alert('Font access was not granted. You can type an installed font name manually.')} }
function handleProp(input){const key=input.dataset.prop;if(!key)return;let v=input.type==='checkbox'?input.checked:input.value;
 if(key.startsWith('template.')){const p=key.split('.')[1];if(p==='unit'){const old=S.template.unit;S.template.width=Number((S.template.width*perUnit[old]/perUnit[v]).toFixed(4));S.template.height=Number((S.template.height*perUnit[old]/perUnit[v]).toFixed(4))}else if(['width','height','dpi'].includes(p))v=Number(v);if(p==='width'||p==='height')v=Math.max(.5,v||.5);S.template[p]=v;return}
 if(key==='projectName'){S.projectName=String(v);return}
 if(key==='card.name'){if(card())card().name=String(v)||'Untitled card';return}
 if(key==='name'){const e=templateEl(S.selected);if(e)e.name=uniqName(v,e.id);return}
 if(['x','y','w','h'].includes(key)){v=px(Number(v),S.template.unit);if(key==='w'||key==='h')v=Math.max(1,v)}
 else if(['fontSize','fontWeight','lineHeight','letterSpacing','borderWidth','radius','opacity','gradientAngle','imgScale','imgOffsetX','imgOffsetY'].includes(key)){v=Number(v);if(key==='opacity')v=clamp(v,0,100);if(key==='fontSize')v=Math.max(1,v);if(key==='imgScale')v=Math.max(.01,v);if(key==='borderWidth')v=Math.max(0,v)}
 if(S.selected)patchElement(S.selected,{[key]:v});
}
$('#inspector').addEventListener('input',event=>{const inp=event.target;if(inp.dataset.cardvalue){const c=card();if(c){c.values??={};c.values[inp.dataset.cardvalue]=inp.value;renderStage()}return}if(inp.dataset.prop){handleProp(inp);renderStage();$('#projectTitle').textContent=S.projectName}});
$('#inspector').addEventListener('change',event=>{const inp=event.target;if(inp.dataset.cardvalue){renderLeft();return}if(inp.dataset.prop){handleProp(inp);repaint()}});
function listenClick(e){const actionEl=e.target.closest('[data-action]');if(actionEl){e.stopPropagation();mutateAction(actionEl.dataset.action,actionEl);return}const listRow=e.target.closest('[data-layer]');if(listRow){S.selected=listRow.dataset.layer;repaint();return}const cardRow=e.target.closest('[data-cardindex]');if(cardRow){chooseCard(Number(cardRow.dataset.cardindex));return}}
document.addEventListener('click',listenClick);
$('#cardControl').addEventListener('change',e=>{if(e.target.id==='cardSelector')chooseCard(Number(e.target.value))});
$('#openProjectFile').addEventListener('change',async e=>{if(e.target.files[0])await openJSON(e.target.files[0]);e.target.value=''});
$('#openTemplateFile').addEventListener('change',async e=>{if(e.target.files[0])await openJSON(e.target.files[0],true);e.target.value=''});
$('#openSheetFile').addEventListener('change',async e=>{if(e.target.files[0])await readSheet(e.target.files[0]);e.target.value=''});
$('#assetFiles').addEventListener('change',async e=>{if(e.target.files.length)await importImages(e.target.files);e.target.value=''});
let drag: any = null;
const stage=$('#stage');
stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;const node=e.target.closest('.element');if(!node){S.selected=null;renderInspector();renderLeft();renderStage();return}const id=node.dataset.id;S.selected=id;renderInspector();renderLeft();const el=effective(templateEl(id));const resizing=!!e.target.closest('[data-handle="resize"]');renderStage();if(el.locked)return;drag={id,type:resizing?'resize':'move',initialX:e.clientX,initialY:e.clientY,x:el.x,y:el.y,w:el.w,h:el.h};e.preventDefault()});
document.addEventListener('pointermove',e=>{if(!drag)return;const {w,h}=sizePx(),dx=(e.clientX-drag.initialX)/S.zoom,dy=(e.clientY-drag.initialY)/S.zoom;let patch;if(drag.type==='resize')patch={w:clamp(Math.round(drag.w+dx),5,w*3),h:clamp(Math.round(drag.h+dy),5,h*3)};else patch={x:Math.round(clamp(drag.x+dx,-drag.w+4,w-4)),y:Math.round(clamp(drag.y+dy,-drag.h+4,h-4))};patchElement(drag.id,patch);renderStage()});
document.addEventListener('pointerup',()=>{if(drag){drag=null;renderInspector();renderLeft();renderStage()}});
document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag)||e.ctrlKey||e.altKey||e.metaKey)return;if(!S.selected)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();mutateAction('delete-element');return}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){const el=effective(templateEl(S.selected));if(el.locked)return;e.preventDefault();const step=e.shiftKey?10:1;patchElement(S.selected,{x:el.x+delta[0]*step,y:el.y+delta[1]*step});renderStage();renderInspector()}});
window.addEventListener('resize',()=>{});

repaint();

