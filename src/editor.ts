import { S, initial, replaceState, card, templateEl, layerEls, isExtra, effective, actualValue, uniqName, px, unitFactor, sizePx, clamp, uid } from './model';
import { $ , toast } from './dom';
import { renderStage } from './preview';
import { repaint, renderInspector, renderLeft, renderCardControl, chooseCard, patchElement, addElement, updateDimensionReadouts, setKnownFonts, baseFonts, refreshHistoryButtons, selectInspectorTab, filterCardData, showDiscoveredFonts, toggleFontBrowser, closeFontBrowser, filterFontBrowser } from './interface';
import { imageCache, cacheImage, getImageData, setImageUpdateHandler, imageScreenOffset, imageOffsetPatch } from './image-sets';
import { exportPNG, exportAll } from './png-export';
import { exportXLSX, readSheet } from './spreadsheet';
import { saveProject, saveProjectAs, saveTemplate, saveTemplateAs, openFromDisk, openJSON, resetFileHandles } from './project-storage';
import { importImages, setTargetImageSet } from './assets';
import { openImageManager, closeImageManager, renderImageManager, imageManagerAction } from './image-manager';
import { layoutTextBox } from './text-layout';
import { resizedRect, locksImageCornerAspect } from './resize';
import { elementGeometry } from './anchor-layout';
import {enterImageReposition,stopImageReposition,repositionImageId,imageDragPatch,imageScalePatch} from './image-reposition';
import {checkpoint,undo,redo,resetHistory} from './history';
import {showRecovery,recordProjectReplaced,noteLiveEdit} from './recovery';
import {importFontFiles,embedInstalledUsedFonts,activateProjectFonts,onFontsReady,bundledFontFamilies} from './project-fonts';
setImageUpdateHandler(()=>{renderStage();if(S.selected&&templateEl(S.selected)?.kind==='image')renderInspector()});
onFontsReady(()=>{setKnownFonts([...new Set([...baseFonts(),...bundledFontFamilies()])]);repaint()});


type ElementClipboard = { element: any; cut: boolean; project: any; pasteCount: number };
let elementClipboard: ElementClipboard | null = null;
// This is an internal element clipboard, independent of the system text clipboard.
function copyElement(cut = false): boolean {
  if (S.mode !== 'template') { toast('Switch to Template to copy or cut elements'); return false; }
  const el = templateEl(S.selected);
  if (!el) { toast('Select an element first'); return false; }
  elementClipboard = {element: structuredClone(el), cut, project: S, pasteCount: 0};
  if (cut) {
    // Retain the original ID in the clipboard so card-specific spreadsheet values
    // and overrides still refer to this element when it is pasted back.
    S.template.elements = S.template.elements.filter(x => x.id !== el.id);
    S.selected = null;
    repaint();
  }
  toast(cut ? 'Element cut — paste to move it' : 'Element copied');
  return true;
}
function pasteElement(): boolean {
  if (S.mode !== 'template') { toast('Switch to Template to paste elements'); return false; }
  if (!elementClipboard) { toast('Copy or cut an element first'); return false; }
  const from = elementClipboard;
  const pasted = structuredClone(from.element);
  const isMove = from.cut && from.project === S &&
    !S.template.elements.some(e => e.id === pasted.id);
  if (!isMove) {
    pasted.id = uid();
    pasted.name = uniqName(pasted.name + ' copy');
  } else {
    pasted.name = uniqName(pasted.name);
  }
  const offset = 12 * (isMove ? 1 : ++from.pasteCount);
  pasted.x += offset;
  pasted.y += offset;
  S.template.elements.push(pasted);
  S.selected = pasted.id;
  if (isMove) {
    // Further pastes duplicate the moved element rather than reusing its ID.
    from.cut = false;
    from.element = structuredClone(pasted);
    from.pasteCount = 0;
  }
  repaint();
  toast(isMove ? 'Element moved' : 'Element pasted');
  return true;
}

// Keep the same point of the card under the viewport centre when zooming.
// The stage may be centred when small or left-aligned when larger than the
// viewport; getBoundingClientRect handles either layout without guessing offsets.
function changeZoom(delta: number) {
 const outer=$('#canvasOuter'),stage=$('#stage');
 const next=clamp(Math.round((S.zoom+delta)*100)/100,.3,3);
 if(next===S.zoom)return;
 const view=outer.getBoundingClientRect(),before=stage.getBoundingClientRect();
 const cx=view.left+outer.clientWidth/2,cy=view.top+outer.clientHeight/2;
 const focalX=(cx-before.left)/S.zoom,focalY=(cy-before.top)/S.zoom;
 S.zoom=next;renderStage();
 const after=stage.getBoundingClientRect();
 outer.scrollLeft+=after.left+focalX*next-cx;
 outer.scrollTop+=after.top+focalY*next-cy;
}

function newCard(copy=null){const c=copy?{id:uid(),name:copy.name+' copy',values:{...copy.values},overrides:structuredClone(copy.overrides||{}),extraElements:structuredClone(copy.extraElements||[])}:{id:uid(),name:'Card '+String(S.cards.length+1).padStart(3,'0'),values:{},overrides:{},extraElements:[]};S.cards.push(c);S.mode='cards';S.cardIndex=S.cards.length-1;S.selected=null;repaint();return c}
function mutateAction(action,el: any = null){switch(action){case 'new-project':if(confirm('Start a new project? Unsaved changes will be lost.')){replaceState(initial());resetFileHandles();imageCache.clear();resetHistory();recordProjectReplaced();void activateProjectFonts();repaint()}break;
case 'undo':if(undo()){imageCache.clear();void activateProjectFonts();repaint()}break;
 case 'redo':if(redo()){imageCache.clear();void activateProjectFonts();repaint()}break;
 case 'embed-fonts':$('#fontFiles').click();break;
 case 'embed-used-fonts':void embedInstalledUsedFonts().then(({added,missing})=>{repaint();toast(added?`Embedded ${added} font file(s)${missing.length?' · missing '+missing.join(', '):''}`:'No installed project fonts were embedded')}).catch(err=>alert((err as Error).message));break;
 case 'show-recovery':void showRecovery();break;
 case 'open-project':void openFromDisk('project');break;case 'save-project':void saveProject();break;case 'save-project-as':void saveProjectAs();break;case 'save-template':void saveTemplate();break;case 'save-template-as':void saveTemplateAs();break;case 'load-template':void openFromDisk('template');break;
case 'mode-template':case 'card-setup':S.mode='template';S.selected=null;repaint();break;case 'mode-cards':S.mode='cards';S.selected=null;repaint();break;
case 'add-text':case 'add-image':case 'add-shape':addElement(action.slice(4));break;
case 'copy-element':copyElement();break;case 'cut-element':copyElement(true);break;case 'paste-element':pasteElement();break;
case 'delete-element':if(!S.selected)return;if(S.mode==='cards'){if(isExtra(S.selected)){card().extraElements=card().extraElements.filter(x=>x.id!==S.selected)}else patchElement(S.selected,{hidden:true});S.selected=null;repaint();toast('Removed from this card only')}else if(confirm('Delete this element from the template and all cards?')){S.template.elements=S.template.elements.filter(x=>x.id!==S.selected);S.selected=null;repaint()}break;
case 'layer-up':case 'layer-down':{if(S.mode==='cards'&&!isExtra(S.selected)){toast('Shared layer order is changed in Template mode');return}const a=S.mode==='cards'?card().extraElements:S.template.elements;let ix=a.findIndex(e=>e.id===S.selected),delta=action==='layer-up'?1:-1;if(ix<0||ix+delta<0||ix+delta>=a.length)return;[a[ix],a[ix+delta]]=[a[ix+delta],a[ix]];repaint();break}
case 'zoom-in':changeZoom(.1);break;
case 'zoom-out':changeZoom(-.1);break;
case 'add-set':{const name=prompt('Name this image set (e.g. Creature Artwork):');if(!name?.trim())return;const set={id:uid(),name:name.trim(),images:[]};S.sets.push(set);setTargetImageSet(set.id);$('#assetFiles').click();repaint();break}
case 'manage-images':openImageManager(el.dataset.set);break;
case 'manage-close':closeImageManager();break;
case 'manage-add':imageManagerAction('manage-add',-1);break;
case 'manage-rename':case 'manage-remove':imageManagerAction(action,Number(el.dataset.index));break;
case 'remove-set':{const id=el.dataset.set,set=S.sets.find(x=>x.id===id);if(set&&confirm(`Remove image set "${set.name}" and its ${set.images.length} images?`)){S.sets=S.sets.filter(x=>x.id!==id);imageCache.clear();repaint()}break}
case 'add-card':newCard();break;case 'duplicate-card':newCard(S.cards[Number(el.dataset.cardindex)]);break;
case 'delete-card':if(S.cards.length<=1){toast('At least one card must remain');return}if(confirm('Delete the selected card?')){S.cards.splice(S.cardIndex,1);chooseCard(Math.min(S.cardIndex,S.cards.length-1))}break;
case 'reset-card':if(card()&&confirm('Reset all element positions and styles for this card?')){card().overrides={};card().extraElements=[];repaint()}break;
case 'reset-element':if(card()){if(isExtra(S.selected)){card().extraElements=card().extraElements.filter(e=>e.id!==S.selected);S.selected=null}else delete card().overrides[S.selected];repaint()}break;
case 'prev-card':chooseCard(S.cardIndex-1);break;case 'next-card':chooseCard(S.cardIndex+1);break;
case 'export-sheet':exportXLSX().catch(err=>alert(err.message));break;case 'import-sheet':$('#openSheetFile').click();break;
case 'export-current':exportPNG();break;case 'export-all':exportAll();break;
case 'reposition-image':{
 const raw=templateEl(S.selected);if(raw?.kind==='image'&&enterImageReposition(raw.id))repaint();
 break;
}
case 'finish-reposition-image':stopImageReposition();repaint();break;
case 'image-rotate-left':case 'image-rotate-right':{
 const raw=templateEl(S.selected);if(!raw||raw.kind!=='image')break;
 const current=effective(raw),step=action==='image-rotate-left'?-90:90;
 const angle=((Number(current.imgRotation||0)+step)%360+360)%360;
 patchElement(raw.id,{imgRotation:angle});repaint();break;
}
case 'scan-fonts':void scanFonts();break;
case 'browse-fonts':toggleFontBrowser();break;
case 'choose-font':{
 const raw=templateEl(S.selected),family=String(el?.dataset.fontFamily||'').trim();
 if(raw?.kind==='text'&&family){patchElement(raw.id,{font:family});closeFontBrowser();repaint()}
 break;
}
}}
async function scanFonts(){
 if(typeof window.queryLocalFonts!=='function'){
  alert('Automatic font discovery requires desktop Chrome or Edge over HTTPS. You can still type a font family name or use Embed font files.');
  return;
 }
 try{
  // The API must run directly from the click to retain Chromium user activation.
  const fonts=await window.queryLocalFonts();
  const names=[...new Set(fonts.map(f=>String(f.family||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  showDiscoveredFonts(names);
  if(names.length)toast('Found '+names.length+' installed font families. Select one from the list.');
  else toast('No installed fonts returned. Check site permission or use Embed font files.');
 }catch(err){
  const name=(err as Error)?.name||'';
  alert(name==='NotAllowedError'?
   'Font access was denied. Allow local-font access in this site’s browser permissions, then try again.':
   'Could not list installed fonts ('+(name||'browser error')+'). You can type a font name or use Embed font files.');
 }
}
function handleProp(input){const key=input.dataset.prop;if(!key)return;let v=input.type==='checkbox'?input.checked:input.value;
 if(key.startsWith('template.')){
  const p=key.split('.')[1],template=S.template;
  if(p==='unit'){
    const oldFactor=unitFactor(template.unit,template.dpi),newFactor=unitFactor(v,template.dpi);
    template.width=Number((template.width*oldFactor/newFactor).toFixed(6));
    template.height=Number((template.height*oldFactor/newFactor).toFixed(6));
  }else if(p==='dpi'){
    const newDpi=Number(v);
    if(!Number.isFinite(newDpi)||newDpi<=0)return;
    // Keep the physical card size unchanged. With px selected the editable
    // pixel count must grow or shrink when the resolution changes.
    if(template.unit==='px'){
      template.width=Number((template.width*newDpi/template.dpi).toFixed(6));
      template.height=Number((template.height*newDpi/template.dpi).toFixed(6));
    }
    v=newDpi;
  }else if(['width','height'].includes(p)){
    v=Number(v);
    if(!Number.isFinite(v)||v<=0)return;
  }
  template[p]=v;
  return;
 }
 if(key==='projectName'){S.projectName=String(v);return}
 if(key==='card.name'){if(card())card().name=String(v)||'Untitled card';return}
 if(key==='name'){const e=templateEl(S.selected);if(e)e.name=uniqName(v,e.id);return}
 if(['shadowOffsetX','shadowOffsetY','shadowSpread'].includes(key)){v=Number(v)*96/S.template.dpi;if(key==='shadowSpread')v=Math.max(0,v)}
 else if(['x','y','w','h','gutterLeft','gutterRight','gutterTop','gutterBottom'].includes(key)){v=px(Number(v),S.template.unit,S.template.dpi);if(key==='w'||key==='h')v=Math.max(1,v);if(key.startsWith('gutter'))v=Math.max(0,v)}
 else if(['fontSize','fontWeight','lineHeight','letterSpacing','borderWidth','radius','opacity','fillOpacity','borderOpacity','textOpacity','gradientAngle','imgScale','imgOffsetX','imgOffsetY','imgRotation','shadowOpacity'].includes(key)){v=Number(v);if(['opacity','fillOpacity','borderOpacity','textOpacity','shadowOpacity'].includes(key))v=clamp(v,0,100);if(key==='fontSize')v=Math.max(1,v);if(key==='imgScale')v=Math.max(.01,v);if(key==='borderWidth')v=Math.max(0,v)}
 if(S.selected){
  // Changing sets invalidates the previous fixed-image choice, even when
  // both sets happen to contain identically named files.
  if(key==='autoSet'&&S.mode==='template'){
   const image=templateEl(S.selected);
   if(image?.kind==='image'&&image.autoSet!==v)image.singleImage='';
  }
  if(key==='imgOffsetX'||key==='imgOffsetY'){
   const raw=templateEl(S.selected);
   if(raw?.kind==='image'){
    const el={...effective(raw),...elementGeometry(raw)};
    const src=getImageData(raw,S.cardIndex,S.mode),cached=src?cacheImage(src):null;
    const img=cached?.loaded?cached.im:null,previous=imageScreenOffset(el,img);
    patchElement(S.selected,imageOffsetPatch(el,key==='imgOffsetX'?v:previous.x,key==='imgOffsetY'?v:previous.y,img));
    return;
   }
  }
  patchElement(S.selected,{[key]:v});
 }
}
// The event target may be from the previous inspector after a pointerdown has
// selected a different element. Never apply a stale input/change to that new
// selection (or to another card). The input event already committed live edits.
function activeInspectorInput(inp){
 const d=inp.dataset;
 if(!d)return false;
 if(d.editOwner===undefined)return true; // Programmatic/legacy inputs.
 return d.editOwner===(S.selected||'')&&d.editMode===S.mode&&Number(d.editCard)===S.cardIndex;
}
$('#inspector').addEventListener('input',event=>{const inp=event.target;if(inp.dataset.cardFilter!==undefined){filterCardData(inp.value);return}if(inp.dataset.fontFilter!==undefined){filterFontBrowser(inp.value);return}if(!activeInspectorInput(inp))return;noteLiveEdit();if(inp.dataset.cardvalue){const c=card();if(c){c.values??={};c.values[inp.dataset.cardvalue]=inp.value;renderStage();updateDimensionReadouts()}return}if(inp.dataset.prop){handleProp(inp);renderStage();updateDimensionReadouts();$('#projectTitle').textContent=S.projectName}});
$('#inspector').addEventListener('focusout',()=>{checkpoint();refreshHistoryButtons()});
// A synchronous inspector rebuild during change removes the focused input before
// the browser finishes Tab/Shift+Tab navigation. Update the document immediately,
// then rebuild the controls after focus has moved and restore that new focus.
 $('#inspector').addEventListener('change',event=>{
  const inp=event.target;
  if(inp.dataset.cardFilter!==undefined||!activeInspectorInput(inp))return;
  if(inp.dataset.cardvalue){checkpoint();refreshHistoryButtons();renderLeft();return}
  if(inp.dataset.prop){
   handleProp(inp);
   repaint(false);
   renderLeft();renderCardControl();
   setTimeout(()=>renderInspector(),0);
  }
 });
$('#inspector').addEventListener('click',event=>{
 const control=(event.target as HTMLElement).closest?.('[data-inspector-tab]') as HTMLElement|null;
 if(!control)return;
 selectInspectorTab(control.dataset.inspectorTab as any);
 event.preventDefault();
});
$('#inspector').addEventListener('keydown',event=>{
 const tab=(event.target as HTMLElement).closest?.('[data-inspector-tab]') as HTMLElement|null;
 if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const tabs=['layout','content','style','rules'];
 const i=tabs.indexOf(tab.dataset.inspectorTab||'layout');
 const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
  (i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 selectInspectorTab(tabs[next] as any);
 event.preventDefault();
});
function listenClick(e){const menu=$('#fileMenu');const actionEl=e.target.closest('[data-action]');if(actionEl){menu.open=false;e.stopPropagation();mutateAction(actionEl.dataset.action,actionEl);return}if(menu.open&&!e.target.closest('#fileMenu'))menu.open=false;const listRow=e.target.closest('[data-layer]');if(listRow){S.selected=listRow.dataset.layer;repaint();return}const cardRow=e.target.closest('[data-cardindex]');if(cardRow){chooseCard(Number(cardRow.dataset.cardindex));return}}
document.addEventListener('click',listenClick);
$('#cardControl').addEventListener('change',e=>{if(e.target.id==='cardSelector')chooseCard(Number(e.target.value))});
$('#openProjectFile').addEventListener('change',async e=>{if(e.target.files[0])await openJSON(e.target.files[0]);e.target.value=''});
$('#openTemplateFile').addEventListener('change',async e=>{if(e.target.files[0])await openJSON(e.target.files[0],true);e.target.value=''});
$('#openSheetFile').addEventListener('change',async e=>{if(e.target.files[0])await readSheet(e.target.files[0]);e.target.value=''});
$('#assetFiles').addEventListener('change',async e=>{if(e.target.files.length){await importImages(e.target.files);renderImageManager()}e.target.value=''});
 $('#fontFiles').addEventListener('change',async e=>{try{if(e.target.files?.length){const {added,skipped}=await importFontFiles(e.target.files);repaint();toast(`Embedded ${added} font file(s) in this project${skipped?' · '+skipped+' skipped':''}. Save the project to take them to other devices.`)}}catch(err){alert('Could not embed fonts: '+(err as Error).message)}finally{e.target.value=''}});
$('#dialogHolder').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-manager-name]')){e.preventDefault();imageManagerAction('manage-rename',Number(e.target.dataset.managerName))}});
let drag: any = null;
function clearSelection(){if(S.selected===null&&!repositionImageId())return;stopImageReposition();S.selected=null;renderInspector();renderLeft();renderStage()}
const stage=$('#stage');
let lastImagePointer:{id:string;x:number;y:number;at:number}|null=null;
// The card may be entirely covered by elements. Click the workspace to clear selection.
// Use the event's original propagation path: renderStage() can replace the clicked
// element before the event bubbles here, so target.closest('#stage') becomes false.
$('#canvasOuter').addEventListener('pointerdown',e=>{if(!(e.pointerType==='touch'&&document.documentElement?.dataset.layout==='mobile')&&e.button===0&&!e.composedPath().includes(stage))clearSelection()});
stage.addEventListener('pointerdown',e=>{
 if(e.button!==0||(e.pointerType==='touch'&&document.documentElement?.dataset.layout==='mobile'))return;
 const now=Date.now(),previous=lastImagePointer;
 const rapid=!!previous&&now-previous.at<490&&Math.hypot(previous.x-e.clientX,previous.y-e.clientY)<24;
 const node=e.target.closest('.element');
 const id=node?.dataset.id||(rapid?previous!.id:null);
 if(!id){lastImagePointer=null;clearSelection();return}
 const raw=templateEl(id);
 if(rapid&&previous!.id===id&&raw?.kind==='image'){
  // Recognize the second pointerdown before redraw removes the click target.
  S.selected=id;drag=null;lastImagePointer=null;
  if(enterImageReposition(id)){renderInspector();renderLeft();renderStage()}
  e.preventDefault();return;
 }
 lastImagePointer=raw?.kind==='image'?{id,x:e.clientX,y:e.clientY,at:now}:null;
 if(repositionImageId()&&repositionImageId()!==id)stopImageReposition();
 S.selected=id;renderInspector();renderLeft();
 const el=effective(templateEl(id)),rect=elementGeometry(templateEl(id));
 const isImageDrag=repositionImageId()===id&&el.kind==='image';
 const handle=isImageDrag?null:e.target.closest('[data-handle]')?.dataset.handle||null;
 renderStage();
 if(el.locked&&!isImageDrag)return;
 drag={id,type:isImageDrag?'image':handle?'resize':'move',handle,initialX:e.clientX,initialY:e.clientY,
  x:rect.x,y:rect.y,w:rect.w,h:rect.h,visual:{...rect},
  imageStart:{...el,...rect},lockAspect:locksImageCornerAspect(el.kind,el.imageFit,handle)};
 e.preventDefault();
});
document.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.initialX,e.clientY-drag.initialY)>9)lastImagePointer=null;const {w,h}=sizePx(),dx=(e.clientX-drag.initialX)/S.zoom,dy=(e.clientY-drag.initialY)/S.zoom;let patch;if(drag.type==='image'){const raw=templateEl(drag.id),src=raw?getImageData(raw,S.cardIndex,S.mode):null,cached=src?cacheImage(src):null;patch=imageDragPatch(drag.imageStart,dx,dy,cached?.loaded?cached.im:null)}else if(drag.type==='resize'){const rect=resizedRect(drag.visual,drag.handle||'se',dx,dy,{w,h},drag.lockAspect);const handle=drag.handle||'se';patch={};if(handle.includes('w')||handle.includes('e'))Object.assign(patch,{x:rect.x,w:rect.w,autoWidth:false});if(handle.includes('n')||handle.includes('s'))Object.assign(patch,{y:rect.y,h:rect.h,autoHeight:false})}else patch={x:Math.round(clamp(drag.x+dx,-drag.w+4,w-4)),y:Math.round(clamp(drag.y+dy,-drag.h+4,h-4))};patchElement(drag.id,patch);renderStage();renderInspector()});
document.addEventListener('pointerup',()=>{if(drag){drag=null;checkpoint();refreshHistoryButtons();renderInspector();renderLeft();renderStage()}});
function onImageDoubleClick(e:MouseEvent){
 if(document.documentElement?.dataset.layout==='mobile')return;
 // The first pointerdown redraws the selected element. On some browsers the
 // second click (and dblclick) therefore targets the unchanged stage instead.
 const hit=(e.target as HTMLElement).closest?.('.element') as HTMLElement|null;
 const recent=lastImagePointer&&Date.now()-lastImagePointer.at<900&&
  Math.hypot(lastImagePointer.x-e.clientX,lastImagePointer.y-e.clientY)<25?lastImagePointer.id:null;
 const id=hit?.dataset.id||recent||S.selected;
 const raw=templateEl(id);if(raw?.kind!=='image')return;
 const rect=elementGeometry(raw),stageRect=stage.getBoundingClientRect();
 const x=(e.clientX-stageRect.left)/S.zoom,y=(e.clientY-stageRect.top)/S.zoom;
 if(x<rect.x||y<rect.y||x>rect.x+rect.w||y>rect.y+rect.h)return;
 S.selected=raw.id;
 if(enterImageReposition(raw.id)){renderInspector();renderLeft();renderStage();e.preventDefault()}
}
stage.addEventListener('click',e=>{if(e.detail>=2)onImageDoubleClick(e)});
stage.addEventListener('dblclick',onImageDoubleClick);
let imageWheelTimer:ReturnType<typeof setTimeout>|null=null;
$('#canvasOuter').addEventListener('wheel',(e:WheelEvent)=>{
 const id=repositionImageId();if(!id)return;
 const raw=templateEl(id);if(!raw||effective(raw).imageFit!=='free')return;
 const rect=elementGeometry(raw),stageRect=stage.getBoundingClientRect();
 const point={x:(e.clientX-stageRect.left)/S.zoom-rect.x,y:(e.clientY-stageRect.top)/S.zoom-rect.y};
 if(point.x<0||point.y<0||point.x>rect.w||point.y>rect.h)return;
 e.preventDefault();
 const el={...effective(raw),...rect};
 const src=getImageData(raw,S.cardIndex,S.mode),cached=cacheImage(src);
 const img=cached?.loaded?cached.im:null;
 const factor=Math.exp(-Math.max(-300,Math.min(300,e.deltaY))*.0015);
 patchElement(id,imageScalePatch(el,img,(Number(el.imgScale)||1)*factor,point));
 renderStage();renderInspector();
 if(imageWheelTimer!==null)clearTimeout(imageWheelTimer);
 imageWheelTimer=setTimeout(()=>{imageWheelTimer=null;checkpoint();refreshHistoryButtons()},220);
},{passive:false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.image-manager')){closeImageManager();e.preventDefault();return}if(e.key==='Escape'&&repositionImageId()){stopImageReposition();renderStage();renderInspector();e.preventDefault();return}const active=document.activeElement,tag=active?.tagName;
if(['INPUT','TEXTAREA','SELECT'].includes(tag)||(active as HTMLElement)?.isContentEditable)return;
 if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();mutateAction(key==='y'||e.shiftKey?'redo':'undo');return}}
if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&S.mode==='template'){
 const action={c:'copy-element',x:'cut-element',v:'paste-element'}[e.key.toLowerCase()];
 if(action&&((action==='paste-element'&&elementClipboard)||(action!=='paste-element'&&S.selected))){
   e.preventDefault();mutateAction(action);return;
 }
}
if(e.ctrlKey||e.altKey||e.metaKey)return;if(!S.selected)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();mutateAction('delete-element');return}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){const el=effective(templateEl(S.selected)),rect=elementGeometry(templateEl(S.selected));if(el.locked&&repositionImageId()!==S.selected)return;e.preventDefault();const step=e.shiftKey?10:1;
 const raw=templateEl(S.selected),src=raw?getImageData(raw,S.cardIndex,S.mode):null,cached=src?cacheImage(src):null;
 const patch=repositionImageId()===S.selected?imageDragPatch({...el,...rect},delta[0]*step,delta[1]*step,cached?.loaded?cached.im:null):{x:rect.x+delta[0]*step,y:rect.y+delta[1]*step};
 patchElement(S.selected,patch);renderStage();renderInspector();checkpoint();refreshHistoryButtons()}});
window.addEventListener('resize',()=>{});

repaint();

