import { S, card, templateEl, layerEls, isExtra, effective, actualValue, uniqName, clamp, px, fmt, sizePx, makeElement, textKinds, escapeHTML, unitFactor, exportPixels, templateExportSize, isExported, isDataExported, visibleOnCard, opacityFor } from './model';
import { $ } from './dom';
import { renderStage } from './preview';
import { layoutTextBox } from './text-layout';
import { elementGeometry, offsetsForRect, anchorEdges } from './anchor-layout';
import {checkpoint,historyState} from './history';
import {bundledFontFamilies} from './project-fonts';
import {renderCardThumbnails} from './card-thumbnails';
import {repositionImageId,canRepositionImage} from './image-reposition';
import {imageFitAxes,imageScreenOffset,imageCache,getImageData} from './image-sets';
export function renderCardControl(){const cc=$('#cardControl');cc.style.display=S.mode==='cards'?'flex':'none';if(S.mode!=='cards')return;cc.innerHTML=`<span style="font-weight:700;color:#62778f">CARD</span><button data-action="prev-card" title="Previous card">‹</button><select id="cardSelector">${S.cards.map((c,i)=>`<option value="${i}" ${i===S.cardIndex?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select><button data-action="next-card" title="Next card">›</button><span style="color:#8a98a9;margin-left:auto">${S.cardIndex+1} / ${S.cards.length}</span>`}
export function renderLeft(){
 const v=$('#leftBody');
 const templateButton=$('#btnTemplate'),cardsButton=$('#btnCards');
 templateButton.classList.toggle('active',S.mode==='template');
 cardsButton.classList.toggle('active',S.mode==='cards');
 templateButton.setAttribute?.('aria-pressed',String(S.mode==='template'));
 cardsButton.setAttribute?.('aria-pressed',String(S.mode==='cards'));
 // Repaint on selection changes should never jump a toolbox back to its top.
 const previousScroll=Object.fromEntries(['layersScroll','cardsScroll','setsScroll'].map(id=>[id,document.querySelector('#'+id)?.scrollTop||0]));
 const layers=[...layerEls()].filter(e=>S.mode==='template'||visibleOnCard(e,S.cardIndex,'cards')).reverse();
 let out=`<section class="sidebar-panel sidebar-layers" aria-label="Layers toolbox">
  <div class="side-head"><h2>LAYERS</h2><span class="pill">${layers.length}</span></div>
  <div class="sidebar-panel-scroll" id="layersScroll"><div class="small">Topmost layers are shown first. Select an element to edit it.</div>
  <div class="layer-list">${layers.map(e=>`<div class="layer-row ${e.id===S.selected?'active':''}" data-layer="${e.id}"><span style="font-size:15px;color:#7b91ad">${e.kind==='text'?'T':e.kind==='image'?'▧':'◇'}</span><span class="name">${escapeHTML(e.name)}<span class="sub">${e.kind}${e.locked?' · locked':''}${!isExported(e)?' · editor only':''}</span></span></div>`).join('')}</div></div>
 </section>`;
 out+=`<section class="sidebar-panel sidebar-cards" aria-label="Staged cards toolbox">
  <div class="side-head"><h2>STAGED CARDS</h2><button data-action="add-card">＋ Add card</button></div>
  <div class="sidebar-panel-scroll" id="cardsScroll"><div class="card-list">${S.cards.map((c,i)=>`<div class="card-row ${S.mode==='cards'&&i===S.cardIndex?'active':''}" data-cardindex="${i}"><span class="mini-art"><img data-card-thumb="${i}" alt="Preview of ${escapeHTML(c.name)}" loading="lazy"><span class="thumb-number">${String(i+1).padStart(2,'0')}</span></span><span class="name">${escapeHTML(c.name)}<span class="sub">${Object.keys(c.overrides||{}).length?'Custom layout':'Template layout'}</span></span><button class="small-btn" data-action="duplicate-card" data-cardindex="${i}" title="Duplicate card">⧉</button></div>`).join('')}</div></div>
  ${S.mode==='cards'?'<div class="sidebar-panel-footer actionbar"><button class="secondary" data-action="delete-card">Delete card</button><button class="secondary" data-action="reset-card">Reset layout edits</button></div>':''}
 </section>`;
 out+=`<section class="sidebar-panel sidebar-sets" aria-label="Image sets toolbox">
  <div class="side-head"><h2>IMAGE SETS</h2><button data-action="add-set">＋ Load set</button></div>
  <div class="sidebar-panel-scroll" id="setsScroll"><div class="small">Load images into sets. Assign a set or a single image to an image frame.</div>
  <div class="set-list">${S.sets.map(set=>`<div class="asset-row"><div class="asset-title"><span>▧</span><span style="overflow:hidden;text-overflow:ellipsis">${escapeHTML(set.name)}</span><span class="count">${set.images.length} files</span></div><div class="asset-thumbs">${set.images.slice(0,6).map(x=>`<img alt="${escapeHTML(x.name)}" title="${escapeHTML(x.name)}" src="${x.data}">`).join('')}</div><div class="asset-actions"><button data-action="manage-images" data-set="${set.id}">Manage images</button><button data-action="remove-set" data-set="${set.id}">Delete set</button></div></div>`).join('')}</div></div>
 </section>`;
 v.innerHTML=out;
 for(const [id,offset] of Object.entries(previousScroll)){
  const panel=document.querySelector('#'+id);if(panel)panel.scrollTop=offset;
 }
 renderCardThumbnails();
}
// Record the selection and card to which a control belongs when it is created.
// A blur/change event from an old input may arrive AFTER the user selects a new
// element. Without this context it can incorrectly update the new element.
function editorScope(){return `data-edit-owner="${escapeHTML(S.selected||'')}" data-edit-mode="${S.mode}" data-edit-card="${S.cardIndex}"`}
function field(label,key,value,type='text',extra=''){return`<div class="field"><label for="inspector-${key}">${escapeHTML(label)}</label><input id="inspector-${key}" ${editorScope()} data-prop="${key}" type="${type}" value="${escapeHTML(value)}" ${extra}></div>`}
function selectionField(label,key,items,value){return `<div class="field"><label for="inspector-${key}">${escapeHTML(label)}</label><select id="inspector-${key}" ${editorScope()} data-prop="${key}">${items.map(([v,l])=>`<option value="${escapeHTML(v)}" ${String(v)===String(value)?'selected':''}>${escapeHTML(l)}</option>`).join('')}</select></div>`}
function checkbox(label,key,value){return `<label class="toggle-line"><input ${editorScope()} type="checkbox" data-prop="${key}" ${value?'checked':''}>${escapeHTML(label)}</label>`}
// All pixel labels are export-image pixels at the selected resolution.
const sizeReadout=()=>{const {w,h}=templateExportSize();return `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px at ${S.template.dpi} DPI`};
const elementReadout=()=>{
 const raw=templateEl(S.selected);
 if(!raw)return '';
 const e=effective(raw),dpi=S.template.dpi;
 const visual=elementGeometry(raw);
 return `${e.kind==='text'&&(e.autoWidth||e.autoHeight)?'Auto-sized ':''}Export pixels at ${dpi} DPI: X ${exportPixels(visual.x,dpi)} · Y ${exportPixels(visual.y,dpi)} · Width ${exportPixels(visual.w,dpi)} px · Height ${exportPixels(visual.h,dpi)} px`;
};
export function updateDimensionReadouts(){
 const templateNode=document.querySelector('#templatePixelReadout');
 if(templateNode)templateNode.textContent=sizeReadout();
 const elementNode=document.querySelector('#elementPixelReadout');
 if(elementNode)elementNode.textContent=elementReadout();
}
const fontOptions=['Arial','Arial Black','Calibri','Cambria','Comic Sans MS','Courier New','Garamond','Georgia','Helvetica','Impact','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana'];let knownFonts=[...fontOptions];

type InspectorTab='layout'|'content'|'style'|'rules';
const inspectorTabs:InspectorTab[]=['layout','content','style','rules'];
let inspectorTab:InspectorTab='layout';
let cardDataSearch='';
let lastInspectorOwner='';
const inspectorFolds=new Map<string,boolean>();
function rememberFolds(box:HTMLElement){
 box.querySelectorAll?.('details[data-inspector-fold]').forEach((node:HTMLDetailsElement)=>{
  inspectorFolds.set(node.dataset.inspectorFold||'',node.open);
 });
}
function fold(id:string,label:string,body:string,defaultOpen=false){
 const isOpen=inspectorFolds.has(id)?inspectorFolds.get(id):defaultOpen;
 return `<details class="inspector-fold" data-inspector-fold="${id}" ${isOpen?'open':''}><summary>${escapeHTML(label)}</summary><div class="inspector-fold-body">${body}</div></details>`;
}
function inspectorHeader(title:string,subtitle:string,tabs=false){
 return `<div class="inspector-sticky"><div class="inspector-heading">${escapeHTML(title)}</div><div class="inspector-sub">${escapeHTML(subtitle)}</div>${tabs?`<div class="inspector-tabs" role="tablist" aria-label="Element property categories">${inspectorTabs.map(tab=>`<button type="button" role="tab" id="inspector-tab-${tab}" aria-controls="inspector-tab-panel" aria-selected="${inspectorTab===tab}" tabindex="${inspectorTab===tab?0:-1}" data-inspector-tab="${tab}" class="${inspectorTab===tab?'active':''}">${tab.charAt(0).toUpperCase()+tab.slice(1)}</button>`).join('')}</div>`:''}</div>`;
}
function fieldIdentifier(node:HTMLElement|null){
 if(!node?.dataset)return null;
 for(const key of ['prop','cardvalue','cardFilter','inspectorTab','action']){
  if(node.dataset[key]!==undefined)return {key,value:node.dataset[key]};
 }
 if(node.tagName==='SUMMARY'&&node.parentElement?.dataset.inspectorFold)return {key:'fold',value:node.parentElement.dataset.inspectorFold};
 return null;
}
function writeInspector(box:HTMLElement,html:string){
 // Repaint must not steal focus, reset the caret or jump a long panel to top.
 // A different element/card, however, starts at the beginning of its panel.
 const owner=`${S.mode}:${S.cardIndex}:${S.selected||''}`;
 const resetScroll=owner!==lastInspectorOwner;
 lastInspectorOwner=owner;
 const prior=document.activeElement as HTMLElement|null;
 const within=!!prior&&!!box.contains?.(prior);
 const identity=within?fieldIdentifier(prior):null;
 const start=within&&typeof (prior as HTMLInputElement).selectionStart==='number'?
  (prior as HTMLInputElement).selectionStart:null;
 const end=within&&typeof (prior as HTMLInputElement).selectionEnd==='number'?
  (prior as HTMLInputElement).selectionEnd:null;
 const inspectorScroll=resetScroll?0:box.scrollTop;
 const right=box.closest?.('.side-right') as HTMLElement|null;
 const outerScroll=resetScroll?0:right?.scrollTop||0;
 box.innerHTML=html;
 if(identity){
  const next=identity.key==='fold'?box.querySelector?.<HTMLElement>(`details[data-inspector-fold="${identity.value}"] > summary`):
   Array.from(box.querySelectorAll?.<HTMLElement>('[data-prop],[data-cardvalue],[data-card-filter],[data-inspector-tab],[data-action]')||[])
   .find(node=>node.dataset[identity.key]===identity.value);
  if(next){
   next.focus?.({preventScroll:true});
   if(start!==null&&end!==null&&'setSelectionRange' in next){
    try{(next as HTMLInputElement).setSelectionRange(start,end)}catch{}
   }
  }
 }
 box.scrollTop=inspectorScroll;
 if(right)right.scrollTop=outerScroll;
}
export function selectInspectorTab(tab:InspectorTab){
 if(!inspectorTabs.includes(tab))return;
 inspectorTab=tab;
 renderInspector();
 const box=$('#inspector') as HTMLElement;
 const scroller=document.documentElement?.dataset?.layout==='mobile'?box:(box.closest?.('.side-right') as HTMLElement|null);
 if(scroller)scroller.scrollTop=0;
 box.querySelector?.<HTMLButtonElement>(`[data-inspector-tab="${tab}"]`)?.focus?.({preventScroll:true});
}
export function filterCardData(query:string){
 cardDataSearch=query;
 const box=$('#inspector') as HTMLElement;
 box.querySelectorAll?.<HTMLElement>('[data-card-row]').forEach(row=>{
  row.hidden=!(row.dataset.cardLabel||'').toLowerCase().includes(query.trim().toLowerCase());
 });
}
export function renderInspector(){
 const box=$('#inspector') as HTMLElement;
 rememberFolds(box);
 if(!S.selected&&S.mode==='cards'){
  $('#rightTitle').textContent='Card data';
  let out=inspectorHeader(card()?.name||'Card',`Card ${S.cardIndex+1} of ${S.cards.length} · Spreadsheet values`);
  out+=field('Card name','card.name',card()?.name||'');
  out+=`<div class="section-title">Element values</div><div class="field"><label for="cardDataFilter">Find a field</label><input id="cardDataFilter" data-card-filter="search" type="search" placeholder="Filter element values…" value="${escapeHTML(cardDataSearch)}" autocomplete="off"></div>`;
  out+=`<div class="small" style="padding:0 0 12px">Only this card changes. Select a layer to edit its layout or appearance.</div>`;
  const entries=S.template.elements.filter(e=>textKinds.includes(e.kind));
  for(const e of entries){
   let body='';
   if(e.kind==='text')body=`<div class="field"><label for="cardValue-${escapeHTML(e.id)}">${escapeHTML(e.name)}</label><textarea id="cardValue-${escapeHTML(e.id)}" ${editorScope()} data-cardvalue="${e.id}" style="min-height:62px">${escapeHTML(actualValue(e))}</textarea></div>`;
   else if(e.autoMode==='single')body=`<div class="field"><label>${escapeHTML(e.name)} — fixed image</label><div class="small" style="padding:0">${escapeHTML(e.singleImage||'(no image selected)')} · Set in Template mode; identical on every card.</div></div>`;
   else body=`<div class="field"><label for="cardValue-${escapeHTML(e.id)}">${escapeHTML(e.name)} — image filename</label><input id="cardValue-${escapeHTML(e.id)}" ${editorScope()} data-cardvalue="${e.id}" value="${escapeHTML(card()?.values?.[e.id]||'')}" placeholder="Blank = automatic" list="allImageFiles"></div>`;
   out+=`<div data-card-row data-card-label="${escapeHTML(e.name.toLowerCase())}" ${!e.name.toLowerCase().includes(cardDataSearch.trim().toLowerCase())?'hidden':''}>${body}</div>`;
  }
  out+=`<datalist id="allImageFiles">${S.sets.flatMap(set=>set.images.map(im=>`<option value="${escapeHTML(set.name+'/'+im.name)}"></option>`)).join('')}</datalist>`;
  writeInspector(box,out);return;
 }
 if(!S.selected){
  $('#rightTitle').textContent='Card setup';
  const out=inspectorHeader(S.template.name,'Card dimensions and project settings')+
   fold('setup-dimensions','Dimensions',
    field('Template name','template.name',S.template.name)+
    `<div class="fields-two">${field('Width ('+S.template.unit+')','template.width',S.template.width,'number','min="0.01" step="any"')}${field('Height ('+S.template.unit+')','template.height',S.template.height,'number','min="0.01" step="any"')}</div>`+
    selectionField('Units','template.unit',[['mm','Millimetres (mm)'],['in','Inches (in)'],['px','Pixels (px)']],S.template.unit)+
    `<div class="small" style="padding:4px 0 12px" id="templatePixelReadout">${sizeReadout()}</div>`,true)+
   fold('setup-background','Background',field('Background colour','template.background',S.template.background,'color'),true)+
   fold('setup-rendering','Rendering',
    selectionField('PNG resolution','template.dpi',[[150,'150 DPI'],[300,'300 DPI'],[450,'450 DPI'],[600,'600 DPI']],S.template.dpi)+
    selectionField('Shadow overlap','template.shadowOverlapMode',[['add','Add (stack opacity)'],['merge','Merge (highest opacity only)']],S.template.shadowOverlapMode||'add')+
    `<div class="small" style="padding:0 0 10px">Merge retains the strongest shadow opacity where shadows overlap; Add stacks them separately.</div>`)+
   fold('setup-project','Project',field('Project name','projectName',S.projectName)+
    `<div class="small" style="padding:0">Select a layer to edit its properties. Switch to Cards to customise individual cards.</div>`);
  writeInspector(box,out);return;
 }
 const raw=templateEl(S.selected);
 if(!raw){S.selected=null;return renderInspector()}
 const e=effective(raw),geometry=elementGeometry(raw);
 $('#rightTitle').textContent='Element properties';
 const panes:Record<InspectorTab,string>={layout:'',content:'',style:'',rules:''};
 const f=unitFactor(S.template.unit,S.template.dpi),unit=S.template.unit;
 panes.layout+=`<div class="section-title">Position and size (${unit})</div><div class="fields-two">${field('X ('+unit+')','x',fmt(geometry.x/f),'number','step="any"')}${field('Y ('+unit+')','y',fmt(geometry.y/f),'number','step="any"')}${field('Width ('+unit+')','w',fmt(geometry.w/f),'number','min="0.01" step="any"')}${field('Height ('+unit+')','h',fmt(geometry.h/f),'number','min="0.01" step="any"')}</div><div class="small" style="padding:4px 0 12px" id="elementPixelReadout">${elementReadout()}</div>`;
 panes.layout+=checkbox('Lock position','locked',e.locked);
 if(raw.kind==='text'){
  panes.layout+=fold('text-autosize','Automatic text box sizing',
   checkbox('Auto width (expand horizontally)','autoWidth',e.autoWidth===true)+
   checkbox('Auto height (expand vertically)','autoHeight',e.autoHeight===true)+
   `<div class="small" style="padding:0 0 12px">The box grows from its text alignment. Width and Height above are the anchor dimensions.</div>`);
  const factor=unitFactor(unit,S.template.dpi);
  panes.layout+=fold('text-gutters',`Text gutters (${unit})`,
   `<div class="fields-two">`+
   field('Left ('+unit+')','gutterLeft',fmt((e.gutterLeft||0)/factor),'number','min="0" step="any"')+
   field('Right ('+unit+')','gutterRight',fmt((e.gutterRight||0)/factor),'number','min="0" step="any"')+
   field('Top ('+unit+')','gutterTop',fmt((e.gutterTop||0)/factor),'number','min="0" step="any"')+
   field('Bottom ('+unit+')','gutterBottom',fmt((e.gutterBottom||0)/factor),'number','min="0" step="any"')+
   `</div><div class="small" style="padding:0 0 10px">Text remains inside these clearances; the border and fill still cover the full box.</div>`);
 }else if(e.linkedTextId){
  panes.layout+=fold('anchor-edges','Anchor edges to text',
   `<div class="small" style="padding:0 0 8px">Lock selected edges to the linked text box. Opposite edges stretch the element when the text changes size.</div><div class="fields-two">${anchorEdges.map(side=>checkbox('Lock '+side.toLowerCase()+' edge','anchor'+side,!!e['anchor'+side])).join('')}</div>`);
 }
 if(S.mode==='template')panes.content+=field('Element name (spreadsheet column)','name',raw.name);
 else panes.content+=`<div class="warn">Changes here affect only <b>${escapeHTML(card()?.name)}</b>. Switch to Template to edit every card.</div>`;
 if(raw.kind==='text'){
  if(S.mode==='template')panes.content+=`<div class="field"><label for="defaultCardText">Default text</label><textarea id="defaultCardText" ${editorScope()} data-prop="text">${escapeHTML(e.text)}</textarea></div>`;
  else panes.content+=`<div class="field"><label for="selectedCardText">Card text</label><textarea id="selectedCardText" ${editorScope()} data-cardvalue="${raw.id}">${escapeHTML(actualValue(raw))}</textarea></div>`;
  panes.content+=`<div class="section-title">Typography</div>`+
   `<div class="field"><label for="inspectorFont">Font family</label><input id="inspectorFont" ${editorScope()} data-prop="font" list="fontOptions" value="${escapeHTML(e.font)}"><datalist id="fontOptions">${[...new Set([...knownFonts,...bundledFontFamilies()])].map(x=>`<option value="${escapeHTML(x)}"></option>`).join('')}</datalist></div>`+
   `<div class="inspector-action"><button class="secondary" data-action="scan-fonts">Find installed fonts</button><button class="secondary" data-action="embed-fonts">Embed font files…</button></div><div class="inspector-action"><button class="secondary" data-action="embed-used-fonts">Embed installed fonts used in project…</button></div>`+
   `<div class="small" style="padding:0 0 8px">${(S.fonts||[]).some(f=>f.family.toLowerCase()===String(e.font).toLowerCase())?'Embedded font travels with this project.':'Font not included in this project. Embed it to avoid substitutions on other devices.'}</div>`+
   `<div class="fields-two">${field('Font size (pt)','fontSize',e.fontSize,'number','min="1" step="0.5"')}${selectionField('Weight','fontWeight',[[100,'Thin'],[300,'Light'],[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra bold'],[900,'Black']],e.fontWeight)}</div>`+
   checkbox('Italic','italic',e.italic)+checkbox('Underline','underline',e.underline)+
   `<div class="fields-two">${selectionField('Horizontal','align',[['left','Left'],['center','Center'],['right','Right']],e.align)}${selectionField('Vertical','valign',[['top','Top'],['middle','Middle'],['bottom','Bottom']],e.valign)}${field('Line height','lineHeight',e.lineHeight,'number','min="0.5" max="4" step="0.05"')}${field('Letter spacing (px)','letterSpacing',e.letterSpacing,'number','step="0.2"')}</div>`;
 }else if(raw.kind==='image'){
  if(S.mode==='cards'){
   if(raw.autoMode==='single')panes.content+=`<div class="small" style="padding:0 0 10px">Fixed image: <b>${escapeHTML(raw.singleImage||'(none selected)')}</b>. Change it in Template mode.</div>`;
   else panes.content+=`<div class="field"><label for="selectedImageFile">Image filename (blank = automatic)</label><input id="selectedImageFile" ${editorScope()} data-cardvalue="${raw.id}" value="${escapeHTML(card()?.values?.[raw.id]||'')}" list="imageFiles" placeholder="Set name/image.png"><datalist id="imageFiles">${S.sets.flatMap(s=>s.images.map(im=>`<option value="${escapeHTML(s.name+'/'+im.name)}"></option>`)).join('')}</datalist></div><div class="small" style="padding:0 0 10px">Enter <b>none</b> to leave this frame empty.</div>`;
  }else{
   panes.content+=`<div class="section-title">Image assignment</div>`+
    selectionField('Automatically use image set','autoSet',[['','None'],...S.sets.map(x=>[x.id,x.name])],e.autoSet)+
    selectionField('Image assignment','autoMode',[['sequence','Sequential (no repeat)'],['cycle','Cycle through set'],['random','Deterministic random'],['single','Single Image (same on all cards)']],e.autoMode);
   if(e.autoMode==='single'){
    const set=S.sets.find(s=>s.id===e.autoSet||s.name===e.autoSet);
    panes.content+=set?.images.length?selectionField('Single image','singleImage',[['','Choose an image…'],...set.images.map(im=>[im.name,im.name])],e.singleImage||''):
     `<div class="small" style="padding:0 0 10px">${set?'Add images to this set first.':'Choose an image set first.'}</div>`;
   }
  }
  const frame={...e,...geometry};
  const source=getImageData(raw,S.cardIndex,S.mode),cached=source?imageCache.get(source):null;
  const image=cached?.loaded?cached.im:null;
  const axes=imageFitAxes(frame,image),offset=imageScreenOffset(frame,image);
  panes.content+=`<div class="section-title">Image framing</div>`+
   selectionField('Fit inside frame','imageFit',[['cover','Cover frame (crop)'],['contain','Fit whole image'],['width','Fit to frame width'],['height','Fit to frame height'],['stretch','Stretch to frame'],['free','Free / original size']],e.imageFit);
  if(e.imageFit==='free')panes.content+=field('Image scale (×)','imgScale',e.imgScale,'number','min="0.01" step="0.1"');
  if(axes.x||axes.y){
   panes.content+=`<div class="fields-two">`+
    (axes.x?field('Offset X (px)','imgOffsetX',Number(offset.x.toFixed(4)),'number','step="1"'):'')+
    (axes.y?field('Offset Y (px)','imgOffsetY',Number(offset.y.toFixed(4)),'number','step="1"'):'')+
    `</div>`;
  }
  if(canRepositionImage(e)){
   const hint=e.imageFit==='free'?'Drag to pan. Wheel or pinch adjusts the Free image scale.':
    e.imageFit==='width'?'Fit width locks horizontal movement. Drag vertically only.':
    e.imageFit==='height'?'Fit height locks vertical movement. Drag horizontally only.':
    'Cover permits panning only along cropped axes; image scale stays automatic.';
   panes.content+=`<div class="inspector-action"><button class="secondary" data-action="${repositionImageId()===raw.id?'finish-reposition-image':'reposition-image'}">${repositionImageId()===raw.id?'Done repositioning':'Reposition image'}</button></div><div class="small" style="padding:0 0 12px">${hint} Double-click (double-tap on mobile) to reposition, Escape or Done to finish.</div>`;
  }else panes.content+=`<div class="small" style="padding:0 0 12px">This fit mode fixes the image inside its frame; repositioning and scaling are disabled.</div>`;
  panes.content+=fold('image-transforms','Image transforms',
   checkbox('Flip horizontally','imgFlipX',e.imgFlipX===true)+
   checkbox('Flip vertically','imgFlipY',e.imgFlipY===true)+
   field('Rotation (degrees, clockwise)','imgRotation',e.imgRotation??0,'number','step="1"')+
   `<div class="asset-actions" style="margin:0 0 10px"><button class="secondary" data-action="image-rotate-left">Rotate 90° left</button><button class="secondary" data-action="image-rotate-right">Rotate 90° right</button></div><div class="small">Transforms the image inside its frame without changing the crop boundary.</div>`);
 }else{
  panes.content+=`<div class="section-title">Shape</div>`+
   selectionField('Shape','shape',[['rect','Rectangle'],['ellipse','Ellipse']],e.shape);
 }
 panes.style+=`<div class="section-title">Appearance</div>`+
  selectionField('Fill','fillMode',[['none','Transparent'],['solid','Solid colour'],['gradient','Linear gradient']],e.fillMode);
 if(e.fillMode!=='none'){
  panes.style+=`<div class="fields-two">${field('Fill colour 1','fill1',e.fill1,'color')}${e.fillMode==='gradient'?field('Fill colour 2','fill2',e.fill2,'color'):''}</div>`+
   (e.fillMode==='gradient'?field('Gradient angle (degrees)','gradientAngle',e.gradientAngle,'number','step="5"'):'');
 }
 panes.style+=`<div class="fields-two">${field('Border thickness (px)','borderWidth',e.borderWidth,'number','min="0" step="0.5"')}${field('Border colour','borderColor',e.borderColor,'color')}</div>`;
 if(e.shape!=='ellipse')panes.style+=field('Corner radius (px)','radius',e.radius,'number','min="0" step="1"');
 const opacityField=(label:string,key:'fillOpacity'|'borderOpacity'|'textOpacity')=>field(label,key,Math.round(opacityFor(e,key)*100),'number','min="0" max="100" step="1"');
 panes.style+=`<div class="section-title">Opacity</div>`+
  opacityField(raw.kind==='image'?'Image opacity (%)':'Background opacity (%)','fillOpacity')+
  opacityField('Border opacity (%)','borderOpacity')+
  (raw.kind==='text'?opacityField('Text opacity (%)','textOpacity'):'');
 if(raw.kind==='text')panes.style+=field('Text colour','color',e.color,'color');
 panes.style+=`<div class="section-title">Shadow</div>`+
  checkbox('Enable shadow','shadowEnabled',e.shadowEnabled===true);
 if(e.shadowEnabled){
  const spx=(v:number|undefined)=>fmt((Number(v)||0)*S.template.dpi/96);
  panes.style+=fold('shadow-advanced','Shadow controls',
   `<div class="fields-two">${field('Shadow colour','shadowColor',e.shadowColor||'#000000','color')}${field('Opacity (%)','shadowOpacity',e.shadowOpacity??65,'number','min="0" max="100" step="1"')}</div>`+
   `<div class="fields-two">${field('Offset X (export px)','shadowOffsetX',spx(e.shadowOffsetX),'number','step="1"')}${field('Offset Y (export px)','shadowOffsetY',spx(e.shadowOffsetY),'number','step="1"')}</div>`+
   field('Spread (export px)','shadowSpread',spx(e.shadowSpread),'number','min="0" step="1"')+
   `<div class="small" style="padding:0 0 10px">Shadows follow visible text, fills, borders and image transparency. Choose Add or Merge for overlapping shadows in Card setup.</div>`,true);
 }
 panes.rules+=`<div class="section-title">Visibility</div>`+checkbox('Hide element','hidden',e.hidden);
 if(raw.kind==='text')panes.rules+=checkbox('Invisible if empty','invisibleIfEmpty',e.invisibleIfEmpty!==false)+
  `<div class="small" style="padding:0 0 12px">Hides the whole text box on cards where its value is empty.</div>`;
 if(raw.kind==='image'||raw.kind==='shape'){
  const texts=[...S.template.elements,...(S.mode==='cards'?(card()?.extraElements||[]):[])].filter(item=>item.kind==='text');
  panes.rules+=`<div class="section-title">Conditional visibility</div>`+
   selectionField('Follow text visibility','linkedTextId',[['','None (always independent)'],...texts.map(item=>[item.id,item.name])],e.linkedTextId||'')+
   `<div class="small" style="padding:0 0 12px">Hide this ${raw.kind==='image'?'image frame':'shape'} when the linked text box is hidden. Anchor edges can be configured in Layout.</div>`;
 }
 if(S.mode==='template'){
  panes.rules+=`<div class="section-title">Export</div>`+
   checkbox('Include in exported images','includeInExport',isExported(e))+
   `<div class="small" style="padding:0 0 12px">When off, the element appears only in the Template editor.</div>`+
   checkbox('Include in data export','includeInDataExport',isDataExported(raw))+
   `<div class="small" style="padding:0 0 12px">Text and image elements are included as XLSX columns unless excluded here.</div>`;
 }else panes.rules+=`<div class="inspector-action"><button class="secondary" data-action="reset-element">${isExtra(raw.id)?'Remove card-only element':'Reset this element to template'}</button></div>`;
 const header=inspectorHeader(raw.name,`${raw.kind.toUpperCase()} ${S.mode==='cards'?'· This card only':'· All cards'}`,true);
 writeInspector(box,header+`<section id="inspector-tab-panel" role="tabpanel" aria-labelledby="inspector-tab-${inspectorTab}" class="inspector-pane">${panes[inspectorTab]}</section>`);
}
export function refreshHistoryButtons(){
 const state=historyState();
 if(typeof document==='undefined'||!document.querySelectorAll)return;
 for(const button of document.querySelectorAll('[data-action="undo"]') as NodeListOf<HTMLButtonElement>)button.disabled=!state.canUndo;
 for(const button of document.querySelectorAll('[data-action="redo"]') as NodeListOf<HTMLButtonElement>)button.disabled=!state.canRedo;
}
export function repaint(all=true){checkpoint();if(all){renderLeft();renderCardControl();renderInspector()}renderStage();$('#projectTitle').textContent=S.projectName;refreshHistoryButtons();if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('cardstudio:repaint'))}
export function patchElement(id,patch){
 const raw=templateEl(id);if(!raw)return;
 const before=effective(raw),visual=elementGeometry(raw);
 const p={...patch};
 if(raw.kind!=='text'){
  const linkChanged=Object.prototype.hasOwnProperty.call(p,'linkedTextId')&&p.linkedTextId!==before.linkedTextId;
  if(linkChanged){
   // The previous position is the starting position for a new link.
   Object.assign(p,visual,{anchorLeft:false,anchorRight:false,anchorTop:false,anchorBottom:false,
    anchorOffsetLeft:undefined,anchorOffsetRight:undefined,anchorOffsetTop:undefined,anchorOffsetBottom:undefined});
  }
  const after={...before,...p};
  const geometryChanged=['x','y','w','h'].some(k=>Object.prototype.hasOwnProperty.call(p,k));
  const anchorsChanged=anchorEdges.some(side=>Object.prototype.hasOwnProperty.call(p,`anchor${side}`));
  if(geometryChanged||anchorsChanged){
   const desired={...visual};
   for(const k of ['x','y','w','h'])if(Object.prototype.hasOwnProperty.call(p,k))desired[k]=p[k];
   // Removing an anchor must not cause the element to snap to its former saved coordinates.
   if(anchorsChanged){Object.assign(p,{x:desired.x,y:desired.y,w:desired.w,h:desired.h});}
   const offsets=offsetsForRect(after,desired);
   for(const side of anchorEdges){
    const key=`anchorOffset${side}`;
    if(!after[`anchor${side}`]){if(anchorsChanged)p[key]=undefined;continue;}
    const axis=side==='Left'||side==='Right'?['x','w']:['y','h'];
    if(Object.prototype.hasOwnProperty.call(p,`anchor${side}`)||axis.some(k=>Object.prototype.hasOwnProperty.call(p,k)))p[key]=offsets[key];
   }
  }
 }
 if(S.mode==='cards'){
  const c=card();if(!c)return;
  if(isExtra(id))Object.assign(c.extraElements.find(e=>e.id===id),p);
  else{c.overrides??={};c.overrides[id]={...(c.overrides[id]||{}),...p}}
 }else Object.assign(raw,p);
}
export function chooseCard(i){S.mode='cards';S.cardIndex=clamp(i,0,S.cards.length-1);S.selected=null;repaint()}
export function addElement(kind){const {w,h}=sizePx(),n=S.template.elements.filter(e=>e.kind===kind).length+1;const e=makeElement(kind,{name:uniqName(kind==='text'?`Text ${n}`:kind==='image'?`Image ${n}`:`Shape ${n}`),x:Math.round(w*.15),y:Math.round(h*.15),w:Math.round(w*.7),h:kind==='image'?Math.round(h*.38):kind==='shape'?Math.round(h*.17):65,text:'New text',fontSize:18});if(S.mode==='cards'){card().extraElements??=[];card().extraElements.push(e)}else S.template.elements.push(e);S.selected=e.id;repaint()}


export function setKnownFonts(fonts: string[]) { knownFonts = fonts; }
export function baseFonts() { return fontOptions; }
