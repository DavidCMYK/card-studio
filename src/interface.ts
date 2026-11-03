import { S, card, templateEl, layerEls, isExtra, effective, actualValue, uniqName, clamp, px, fmt, sizePx, makeElement, textKinds, escapeHTML, unitFactor, exportPixels, templateExportSize, isExported, visibleOnCard, opacityFor } from './model';
import { $ } from './dom';
import { renderStage } from './preview';
import { layoutTextBox } from './text-layout';
import { elementGeometry, offsetsForRect, anchorEdges } from './anchor-layout';
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
  <div class="sidebar-panel-scroll" id="cardsScroll"><div class="card-list">${S.cards.map((c,i)=>`<div class="card-row ${S.mode==='cards'&&i===S.cardIndex?'active':''}" data-cardindex="${i}"><span class="mini-art">${String(i+1).padStart(2,'0')}</span><span class="name">${escapeHTML(c.name)}<span class="sub">${Object.keys(c.overrides||{}).length?'Custom layout':'Template layout'}</span></span><button class="small-btn" data-action="duplicate-card" data-cardindex="${i}" title="Duplicate card">⧉</button></div>`).join('')}</div></div>
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
}
// Record the selection and card to which a control belongs when it is created.
// A blur/change event from an old input may arrive AFTER the user selects a new
// element. Without this context it can incorrectly update the new element.
function editorScope(){return `data-edit-owner="${escapeHTML(S.selected||'')}" data-edit-mode="${S.mode}" data-edit-card="${S.cardIndex}"`}
function field(label,key,value,type='text',extra=''){return`<div class="field"><label>${escapeHTML(label)}</label><input ${editorScope()} data-prop="${key}" type="${type}" value="${escapeHTML(value)}" ${extra}></div>`}
function selectionField(label,key,items,value){return `<div class="field"><label>${escapeHTML(label)}</label><select ${editorScope()} data-prop="${key}">${items.map(([v,l])=>`<option value="${escapeHTML(v)}" ${String(v)===String(value)?'selected':''}>${escapeHTML(l)}</option>`).join('')}</select></div>`}
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
export function renderInspector(){const box=$('#inspector');if(!S.selected&&S.mode==='cards'){
 $('#rightTitle').textContent='Card data';
 let out=`<div class="inspector-heading">${escapeHTML(card()?.name)}</div><div class="inspector-sub">Card ${S.cardIndex+1} of ${S.cards.length} · Spreadsheet values</div>${field('Card name','card.name',card()?.name||'')}`;
 const entries=S.template.elements.filter(e=>textKinds.includes(e.kind));
 out+=`<div class="section-title">Element values</div><div class="small" style="padding:0 0 14px">These fields change only this card. Select a layer to adjust its position or formatting.</div>`;
 for(const e of entries){if(e.kind==='text')out+=`<div class="field"><label>${escapeHTML(e.name)}</label><textarea ${editorScope()} data-cardvalue="${e.id}" style="min-height:62px">${escapeHTML(actualValue(e))}</textarea></div>`;
 else if(e.autoMode==='single')out+=`<div class="field"><label>${escapeHTML(e.name)} — fixed image</label><div class="small" style="padding:0">${escapeHTML(e.singleImage||'(no image selected)')} · Set in Template mode; identical on every card.</div></div>`;
 else out+=`<div class="field"><label>${escapeHTML(e.name)} — image filename</label><input ${editorScope()} data-cardvalue="${e.id}" value="${escapeHTML(card()?.values?.[e.id]||'')}" placeholder="Blank = automatic" list="allImageFiles"></div>`}
 out+=`<datalist id="allImageFiles">${S.sets.flatMap(set=>set.images.map(im=>`<option value="${escapeHTML(set.name+'/'+im.name)}"></option>`)).join('')}</datalist>`;
 box.innerHTML=out;return}
 if(!S.selected){$('#rightTitle').textContent='Card setup';box.innerHTML=`<div class="inspector-heading">${escapeHTML(S.template.name)}</div><div class="inspector-sub">Card dimensions & export options</div>
 ${field('Template name','template.name',S.template.name)}
 <div class="fields-two">${field('Width ('+S.template.unit+')','template.width',S.template.width,'number','min="0.01" step="any"')}${field('Height ('+S.template.unit+')','template.height',S.template.height,'number','min="0.01" step="any"')}</div>
 ${selectionField('Units','template.unit',[['mm','Millimetres (mm)'],['in','Inches (in)'],['px','Pixels (px)']],S.template.unit)}
 ${selectionField('PNG resolution','template.dpi',[[150,'150 DPI'],[300,'300 DPI'],[450,'450 DPI'],[600,'600 DPI']],S.template.dpi)}
 <div class="small" style="padding:4px 0 12px" id="templatePixelReadout">${sizeReadout()}</div>
 ${field('Background colour','template.background',S.template.background,'color')}
 <div class="section-title">Shadows</div>
 ${selectionField('Shadow overlap','template.shadowOverlapMode',[['add','Add (stack opacity)'],['merge','Merge (highest opacity only)']],S.template.shadowOverlapMode||'add')}
 <div class="small" style="padding:0 0 10px">Merge combines shadows into one layer beneath all visible elements, retaining the strongest opacity wherever shadows overlap. Add preserves the original per-element stacking.</div>
 <div class="rule"></div><div class="section-title">Project</div>${field('Project name','projectName',S.projectName)}
 <div class="small" style="padding:0">Select a layer or click an element on the card to change its properties. Use the Cards tab to edit a single card independently.</div>`;return}
 const raw=templateEl(S.selected);if(!raw){S.selected=null;return renderInspector()};const e=effective(raw),geometry=elementGeometry(raw);$('#rightTitle').textContent='Element properties';
 let html=`<div class="inspector-heading">${escapeHTML(raw.name)}</div><div class="inspector-sub">${escapeHTML(raw.kind.toUpperCase())} ${S.mode==='cards'?'· Card-only changes':'· Template-wide changes'}</div>`;
 if(S.mode==='template')html+=field('Element name (spreadsheet column)','name',raw.name);
 else html+=`<div class="warn">Changes here affect only <b>${escapeHTML(card()?.name)}</b>. Switch to Template to edit every card.</div>`;
 if(S.mode==='cards'&&textKinds.includes(raw.kind)){
 if(raw.kind==='text')html+=`<div class="field"><label>Card text</label><textarea ${editorScope()} data-cardvalue="${raw.id}">${escapeHTML(actualValue(raw))}</textarea></div>`;
 if(raw.kind==='image'&&raw.autoMode==='single')html+=`<div class="small" style="padding:0 0 10px">Fixed image: <b>${escapeHTML(raw.singleImage||'(none selected)')}</b>. Change it in Template mode; card-specific image values are ignored.</div>`;
 else if(raw.kind==='image')html+=`<div class="field"><label>Image filename (blank = automatic)</label><input ${editorScope()} data-cardvalue="${raw.id}" value="${escapeHTML(card()?.values?.[raw.id]||'')}" list="imageFiles" placeholder="Set name/image.png"><datalist id="imageFiles">${S.sets.flatMap(s=>s.images.map(im=>`<option value="${escapeHTML(s.name+'/'+im.name)}"></option>`)).join('')}</datalist></div><div class="small" style="padding:0 0 10px">Enter <b>none</b> to leave this frame empty.</div>`;
 }
 const f=unitFactor(S.template.unit,S.template.dpi);
 html+=`<div class="section-title">Position and size (${S.template.unit})</div><div class="fields-two">${field('X ('+S.template.unit+')','x',fmt(geometry.x/f),'number','step="any"')}${field('Y ('+S.template.unit+')','y',fmt(geometry.y/f),'number','step="any"')}${field('Width ('+S.template.unit+')','w',fmt(geometry.w/f),'number','min="0.01" step="any"')}${field('Height ('+S.template.unit+')','h',fmt(geometry.h/f),'number','min="0.01" step="any"')}</div><div class="small" style="padding:4px 0 12px" id="elementPixelReadout">${elementReadout()}</div>`;
 html+=checkbox('Hide element','hidden',e.hidden)+checkbox('Lock position','locked',e.locked);
 if(S.mode==='template')html+=checkbox('Include in exported images','includeInExport',isExported(e))+
 `<div class="small" style="padding:0 0 12px">Turn this off for non-printing guides, such as cut lines and bleed markers. These elements appear only in the Template editor, not in Cards previews or PNG exports.</div>`;
 if(raw.kind==='text'){
 if(S.mode==='template')html+=`<div class="field"><label>Default text</label><textarea ${editorScope()} data-prop="text">${escapeHTML(e.text)}</textarea></div>`;
 html+=`<div class="section-title">Visibility</div>`+checkbox('Invisible if empty','invisibleIfEmpty',e.invisibleIfEmpty!==false)+
 `<div class="small" style="padding:0 0 10px">Hide this entire text box on cards where its spreadsheet or card text is blank (including its fill and border). Empty text remains editable in Template mode.</div>`;
 html+=`<div class="section-title">Automatic text box sizing</div>`+
 checkbox('Auto width (expand horizontally)','autoWidth',e.autoWidth===true)+
 checkbox('Auto height (expand vertically)','autoHeight',e.autoHeight===true)+
 `<div class="small" style="padding:0 0 12px">The box grows from the selected text alignment: left/right/centre and top/bottom/middle. Width and Height above are the anchor dimensions when auto-sizing is active.</div>`;
 const unit=S.template.unit, factor=unitFactor(unit,S.template.dpi);
 html+=`<div class="section-title">Text gutters (${unit})</div><div class="fields-two">`+
 field('Left ('+unit+')','gutterLeft',fmt((e.gutterLeft||0)/factor),'number','min="0" step="any"')+
 field('Right ('+unit+')','gutterRight',fmt((e.gutterRight||0)/factor),'number','min="0" step="any"')+
 field('Top ('+unit+')','gutterTop',fmt((e.gutterTop||0)/factor),'number','min="0" step="any"')+
 field('Bottom ('+unit+')','gutterBottom',fmt((e.gutterBottom||0)/factor),'number','min="0" step="any"')+
 `</div><div class="small" style="padding:0 0 12px">Background and border cover the full box; the text stays inside these four clearances.</div>`;
 html+=`<div class="section-title">Typography</div>`;
 html+=`<div class="field"><label>Font family</label><input ${editorScope()} data-prop="font" list="fontOptions" value="${escapeHTML(e.font)}"><datalist id="fontOptions">${knownFonts.map(x=>`<option value="${escapeHTML(x)}"></option>`).join('')}</datalist></div><button class="secondary" style="margin:-4px 0 12px" data-action="scan-fonts">Find installed fonts</button>`;
 html+=`<div class="fields-two">${field('Font size (pt)','fontSize',e.fontSize,'number','min="1" step="0.5"')}${selectionField('Weight','fontWeight',[[100,'Thin'],[300,'Light'],[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra bold'],[900,'Black']],e.fontWeight)}</div>`;
 html+=checkbox('Italic','italic',e.italic)+checkbox('Underline','underline',e.underline);
 html+=`<div class="fields-two">${selectionField('Horizontal','align',[['left','Left'],['center','Center'],['right','Right']],e.align)}${selectionField('Vertical','valign',[['top','Top'],['middle','Middle'],['bottom','Bottom']],e.valign)}${field('Line height','lineHeight',e.lineHeight,'number','min="0.5" max="4" step="0.05"')}${field('Letter spacing (px)','letterSpacing',e.letterSpacing,'number','step="0.2"')}</div>${field('Text colour','color',e.color,'color')}`;
 }
 if(raw.kind==='image'){
 html+=`<div class="section-title">Image options</div>`;
 html+=selectionField('Fit inside frame','imageFit', [['cover','Cover frame (crop)'],['contain','Fit whole image'],['width','Fit to frame width'],['height','Fit to frame height'],['stretch','Stretch to frame'],['free','Free / original size']],e.imageFit);
 html+=`<div class="fields-two">${field('Free resize scale','imgScale',e.imgScale,'number','min="0.01" step="0.1"')}${field('Offset X (px)','imgOffsetX',e.imgOffsetX,'number','step="1"')}${field('Offset Y (px)','imgOffsetY',e.imgOffsetY,'number','step="1"')}</div>`;
 html+=`<div class="section-title">Image transform</div>`+
  checkbox('Flip horizontally','imgFlipX',e.imgFlipX===true)+
  checkbox('Flip vertically','imgFlipY',e.imgFlipY===true)+
  field('Rotation (degrees, clockwise)','imgRotation',e.imgRotation??0,'number','step="1"')+
  `<div class="asset-actions" style="margin:0 0 12px"><button class="secondary" data-action="image-rotate-left">Rotate 90° left</button><button class="secondary" data-action="image-rotate-right">Rotate 90° right</button></div>`;
 html+=`<div class="small" style="padding:0 0 12px">Transforms the image inside its frame. The frame, crop boundary, and border remain unchanged.</div>`;
 if(S.mode==='template'){
  html+=`${selectionField('Automatically use image set','autoSet',[['','None'],...S.sets.map(x=>[x.id,x.name])],e.autoSet)}${selectionField('Image assignment','autoMode',[['sequence','Sequential (no repeat)'],['cycle','Cycle through set'],['random','Deterministic random'],['single','Single Image (same on all cards)']],e.autoMode)}`;
  if(e.autoMode==='single'){
   const set=S.sets.find(s=>s.id===e.autoSet||s.name===e.autoSet);
   if(set?.images.length){
    html+=selectionField('Single image','singleImage',[['','Choose an image…'],...set.images.map(im=>[im.name,im.name])],e.singleImage||'');
   }else html+=`<div class="small" style="padding:0 0 10px">${set?'Add images to this set before choosing a fixed image.':'Choose an image set first.'}</div>`;
  }
 }
 }
 if(raw.kind==='shape')html+=`<div class="section-title">Shape</div>${selectionField('Shape','shape',[['rect','Rectangle'],['ellipse','Ellipse']],e.shape)}`;
 if(raw.kind==='shape'||raw.kind==='image'){
  const texts=[...S.template.elements,...(S.mode==='cards'?(card()?.extraElements||[]):[])].filter(item=>item.kind==='text');
  html+=`<div class="section-title">Visibility link</div>`+
   selectionField('Follow text visibility','linkedTextId',[['','None (always independent)'],...texts.map(item=>[item.id,item.name])],e.linkedTextId||'')+
   `<div class="small" style="padding:0 0 10px">Hide this entire ${raw.kind==='image'?'image frame':'shape'} when the chosen text box is invisible on this card.</div>`;
  if(e.linkedTextId)html+=`<div class="section-title">Anchor edges to text</div>`+
   `<div class="small" style="padding:0 0 8px">Anchor the selected edges to the text box, keeping their current distances. Opposite edges make the element stretch as the text box changes size.</div>`+
   `<div class="fields-two">${anchorEdges.map(side=>checkbox(`Lock ${side.toLowerCase()} edge`,`anchor${side}`,!!e[`anchor${side}`])).join('')}</div>`;

 }
 html+=`<div class="section-title">Appearance</div>${selectionField('Fill','fillMode',[['none','Transparent'],['solid','Solid colour'],['gradient','Linear gradient']],e.fillMode)}`;
 if(e.fillMode!=='none')html+=`<div class="fields-two">${field('Fill colour 1','fill1',e.fill1,'color')}${e.fillMode==='gradient'?field('Fill colour 2','fill2',e.fill2,'color'):''}</div>${e.fillMode==='gradient'?field('Gradient angle (degrees)','gradientAngle',e.gradientAngle,'number','step="5"'):''}`;
 html+=`<div class="fields-two">${field('Border thickness (px)','borderWidth',e.borderWidth,'number','min="0" step="0.5"')}${field('Border colour','borderColor',e.borderColor,'color')}</div>`;
 if(e.shape!=='ellipse')html+=field('Corner radius (px)','radius',e.radius,'number','min="0" step="1"');
 const opacityField=(label,key)=>field(label,key,Math.round(opacityFor(e,key)*100),'number','min="0" max="100" step="1"');
 html+=opacityField(raw.kind==='image'?'Image opacity (%)':'Background opacity (%)','fillOpacity');
 html+=opacityField('Border opacity (%)','borderOpacity');
 if(raw.kind==='text')html+=opacityField('Text opacity (%)','textOpacity');
 html+=`<div class="section-title">Shadow</div>`+
  checkbox('Enable shadow','shadowEnabled',e.shadowEnabled===true);
 if(e.shadowEnabled){
  html+=`<div class="fields-two">${field('Shadow colour','shadowColor',e.shadowColor||'#000000','color')}${field('Opacity (%)','shadowOpacity',e.shadowOpacity??65,'number','min="0" max="100" step="1"')}</div>`;
  const spx=(v:number|undefined)=>fmt((Number(v)||0)*S.template.dpi/96);
  html+=`<div class="fields-two">${field('Offset X (export px)','shadowOffsetX',spx(e.shadowOffsetX),'number','step="1"')}${field('Offset Y (export px)','shadowOffsetY',spx(e.shadowOffsetY),'number','step="1"')}</div>`+
   field('Spread (export px)','shadowSpread',spx(e.shadowSpread),'number','min="0" step="1"')+
   `<div class="small" style="padding:0 0 10px">Shadows follow visible text, fills, borders and image alpha, including transparent gaps. Overlapping shadows stack (additive mode).</div>`;
 }
 if(S.mode==='cards')html+=`<div class="inspector-action"><button class="secondary" data-action="reset-element">${isExtra(raw.id)?'Remove card-only element':'Reset this element to template'}</button></div>`;
 box.innerHTML=html;
}
export function repaint(all=true){if(all){renderLeft();renderCardControl();renderInspector()}renderStage();$('#projectTitle').textContent=S.projectName}
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
