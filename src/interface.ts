import { S, card, templateEl, layerEls, isExtra, effective, actualValue, uniqName, clamp, px, fmt, sizePx, makeElement, textKinds, escapeHTML, unitFactor, exportPixels, templateExportSize, isExported, visibleOnCard, opacityFor } from './model';
import { $ } from './dom';
import { renderStage } from './preview';
export function renderCardControl(){const cc=$('#cardControl');cc.style.display=S.mode==='cards'?'flex':'none';if(S.mode!=='cards')return;cc.innerHTML=`<span style="font-weight:700;color:#62778f">CARD</span><button data-action="prev-card" title="Previous card">‹</button><select id="cardSelector">${S.cards.map((c,i)=>`<option value="${i}" ${i===S.cardIndex?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select><button data-action="next-card" title="Next card">›</button><span style="color:#8a98a9;margin-left:auto">${S.cardIndex+1} / ${S.cards.length}</span>`}
export function renderLeft(){const v=$('#leftBody');$('#btnTemplate').classList.toggle('active',S.mode==='template');$('#btnCards').classList.toggle('active',S.mode==='cards');let out='';
 if(S.mode==='cards'){
 out+=`<div class="side-head"><h2>STAGED CARDS</h2><button data-action="add-card">＋ Add card</button></div>`;
 out+='<div class="card-list">'+S.cards.map((c,i)=>`<div class="card-row ${i===S.cardIndex?'active':''}" data-cardindex="${i}"><span class="mini-art">${String(i+1).padStart(2,'0')}</span><span class="name">${escapeHTML(c.name)}<span class="sub">${Object.keys(c.overrides||{}).length?'Custom layout':'Template layout'}</span></span><button class="small-btn" data-action="duplicate-card" data-cardindex="${i}" title="Duplicate card">⧉</button></div>`).join('')+'</div>';
 out+=`<div class="actionbar"><button class="secondary" data-action="delete-card">Delete card</button><button class="secondary" data-action="reset-card">Reset layout edits</button></div><div class="rule"></div>`;
 }
 out+=`<div class="side-head"><h2>LAYERS</h2><span class="pill">${layerEls().filter(e=>S.mode==='template'||visibleOnCard(e,S.cardIndex,'cards')).length}</span></div><div class="small">Topmost layers are shown first. Select an element to edit it.</div>`;
 out+='<div class="layer-list">'+[...layerEls()].filter(e=>S.mode==='template'||visibleOnCard(e,S.cardIndex,'cards')).reverse().map(e=>`<div class="layer-row ${e.id===S.selected?'active':''}" data-layer="${e.id}"><span style="font-size:15px;color:#7b91ad">${e.kind==='text'?'T':e.kind==='image'?'▧':'◇'}</span><span class="name">${escapeHTML(e.name)}<span class="sub">${e.kind}${e.locked?' · locked':''}${!isExported(e)?' · editor only':''}</span></span></div>`).join('')+'</div>';
 out+=`<div class="rule"></div><div class="side-head"><h2>IMAGE SETS</h2><button data-action="add-set">＋ Load set</button></div><div class="small">Load multiple images as one set. Assign the set to an image frame, then choose sequential, cycling or random assignment.</div>`;
 out+='<div class="set-list">'+S.sets.map(set=>`<div class="asset-row"><div class="asset-title"><span>▧</span><span style="overflow:hidden;text-overflow:ellipsis">${escapeHTML(set.name)}</span><span class="count">${set.images.length} files</span></div><div class="asset-thumbs">${set.images.slice(0,6).map(x=>`<img alt="${escapeHTML(x.name)}" title="${escapeHTML(x.name)}" src="${x.data}">`).join('')}</div><div class="asset-actions"><button data-action="add-to-set" data-set="${set.id}">＋ Images</button><button data-action="remove-set" data-set="${set.id}">Remove</button></div></div>`).join('')+'</div>';
 v.innerHTML=out;
}
function field(label,key,value,type='text',extra=''){return`<div class="field"><label>${escapeHTML(label)}</label><input data-prop="${key}" type="${type}" value="${escapeHTML(value)}" ${extra}></div>`}
function selectionField(label,key,items,value){return `<div class="field"><label>${escapeHTML(label)}</label><select data-prop="${key}">${items.map(([v,l])=>`<option value="${escapeHTML(v)}" ${String(v)===String(value)?'selected':''}>${escapeHTML(l)}</option>`).join('')}</select></div>`}
function checkbox(label,key,value){return `<label class="toggle-line"><input type="checkbox" data-prop="${key}" ${value?'checked':''}>${escapeHTML(label)}</label>`}
// All pixel labels are export-image pixels at the selected resolution.
const sizeReadout=()=>{const {w,h}=templateExportSize();return `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px at ${S.template.dpi} DPI`};
const elementReadout=()=>{
 const raw=templateEl(S.selected);
 if(!raw)return '';
 const e=effective(raw),dpi=S.template.dpi;
 return `Export pixels at ${dpi} DPI: X ${exportPixels(e.x,dpi)} · Y ${exportPixels(e.y,dpi)} · Width ${exportPixels(e.w,dpi)} px · Height ${exportPixels(e.h,dpi)} px`;
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
 for(const e of entries){if(e.kind==='text')out+=`<div class="field"><label>${escapeHTML(e.name)}</label><textarea data-cardvalue="${e.id}" style="min-height:62px">${escapeHTML(actualValue(e))}</textarea></div>`;
 else out+=`<div class="field"><label>${escapeHTML(e.name)} — image filename</label><input data-cardvalue="${e.id}" value="${escapeHTML(card()?.values?.[e.id]||'')}" placeholder="Blank = automatic" list="allImageFiles"></div>`}
 out+=`<datalist id="allImageFiles">${S.sets.flatMap(set=>set.images.map(im=>`<option value="${escapeHTML(set.name+'/'+im.name)}"></option>`)).join('')}</datalist>`;
 box.innerHTML=out;return}
 if(!S.selected){$('#rightTitle').textContent='Card setup';box.innerHTML=`<div class="inspector-heading">${escapeHTML(S.template.name)}</div><div class="inspector-sub">Card dimensions & export options</div>
 ${field('Template name','template.name',S.template.name)}
 <div class="fields-two">${field('Width ('+S.template.unit+')','template.width',S.template.width,'number','min="0.01" step="any"')}${field('Height ('+S.template.unit+')','template.height',S.template.height,'number','min="0.01" step="any"')}</div>
 ${selectionField('Units','template.unit',[['mm','Millimetres (mm)'],['in','Inches (in)'],['px','Pixels (px)']],S.template.unit)}
 ${selectionField('PNG resolution','template.dpi',[[150,'150 DPI'],[300,'300 DPI'],[450,'450 DPI'],[600,'600 DPI']],S.template.dpi)}
 <div class="small" style="padding:4px 0 12px" id="templatePixelReadout">${sizeReadout()}</div>
 ${field('Background colour','template.background',S.template.background,'color')}
 <div class="rule"></div><div class="section-title">Project</div>${field('Project name','projectName',S.projectName)}
 <div class="small" style="padding:0">Select a layer or click an element on the card to change its properties. Use the Cards tab to edit a single card independently.</div>`;return}
 const raw=templateEl(S.selected);if(!raw){S.selected=null;return renderInspector()};const e=effective(raw);$('#rightTitle').textContent='Element properties';
 let html=`<div class="inspector-heading">${escapeHTML(raw.name)}</div><div class="inspector-sub">${escapeHTML(raw.kind.toUpperCase())} ${S.mode==='cards'?'· Card-only changes':'· Template-wide changes'}</div>`;
 if(S.mode==='template')html+=field('Element name (spreadsheet column)','name',raw.name);
 else html+=`<div class="warn">Changes here affect only <b>${escapeHTML(card()?.name)}</b>. Switch to Template to edit every card.</div>`;
 if(S.mode==='cards'&&textKinds.includes(raw.kind)){
 if(raw.kind==='text')html+=`<div class="field"><label>Card text</label><textarea data-cardvalue="${raw.id}">${escapeHTML(actualValue(raw))}</textarea></div>`;
 if(raw.kind==='image')html+=`<div class="field"><label>Image filename (blank = automatic)</label><input data-cardvalue="${raw.id}" value="${escapeHTML(card()?.values?.[raw.id]||'')}" list="imageFiles" placeholder="Set name/image.png"><datalist id="imageFiles">${S.sets.flatMap(s=>s.images.map(im=>`<option value="${escapeHTML(s.name+'/'+im.name)}"></option>`)).join('')}</datalist></div><div class="small" style="padding:0 0 10px">Enter <b>none</b> to leave this frame empty.</div>`;
 }
 const f=unitFactor(S.template.unit,S.template.dpi);
 html+=`<div class="section-title">Position and size (${S.template.unit})</div><div class="fields-two">${field('X ('+S.template.unit+')','x',fmt(e.x/f),'number','step="any"')}${field('Y ('+S.template.unit+')','y',fmt(e.y/f),'number','step="any"')}${field('Width ('+S.template.unit+')','w',fmt(e.w/f),'number','min="0.01" step="any"')}${field('Height ('+S.template.unit+')','h',fmt(e.h/f),'number','min="0.01" step="any"')}</div><div class="small" style="padding:4px 0 12px" id="elementPixelReadout">${elementReadout()}</div>`;
 html+=checkbox('Hide element','hidden',e.hidden)+checkbox('Lock position','locked',e.locked);
 if(S.mode==='template')html+=checkbox('Include in exported images','includeInExport',isExported(e))+
 `<div class="small" style="padding:0 0 12px">Turn this off for non-printing guides, such as cut lines and bleed markers. These elements appear only in the Template editor, not in Cards previews or PNG exports.</div>`;
 if(raw.kind==='text'){
 if(S.mode==='template')html+=`<div class="field"><label>Default text</label><textarea data-prop="text">${escapeHTML(e.text)}</textarea></div>`;
 html+=`<div class="section-title">Visibility</div>`+checkbox('Invisible if empty','invisibleIfEmpty',e.invisibleIfEmpty!==false)+
 `<div class="small" style="padding:0 0 10px">Hide this entire text box on cards where its spreadsheet or card text is blank (including its fill and border). Empty text remains editable in Template mode.</div>`;
 html+=`<div class="section-title">Typography</div>`;
 html+=`<div class="field"><label>Font family</label><input data-prop="font" list="fontOptions" value="${escapeHTML(e.font)}"><datalist id="fontOptions">${knownFonts.map(x=>`<option value="${escapeHTML(x)}"></option>`).join('')}</datalist></div><button class="secondary" style="margin:-4px 0 12px" data-action="scan-fonts">Find installed fonts</button>`;
 html+=`<div class="fields-two">${field('Font size (pt)','fontSize',e.fontSize,'number','min="1" step="0.5"')}${selectionField('Weight','fontWeight',[[100,'Thin'],[300,'Light'],[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra bold'],[900,'Black']],e.fontWeight)}</div>`;
 html+=checkbox('Italic','italic',e.italic)+checkbox('Underline','underline',e.underline);
 html+=`<div class="fields-two">${selectionField('Horizontal','align',[['left','Left'],['center','Center'],['right','Right']],e.align)}${selectionField('Vertical','valign',[['top','Top'],['middle','Middle'],['bottom','Bottom']],e.valign)}${field('Line height','lineHeight',e.lineHeight,'number','min="0.5" max="4" step="0.05"')}${field('Letter spacing (px)','letterSpacing',e.letterSpacing,'number','step="0.2"')}</div>${field('Text colour','color',e.color,'color')}`;
 }
 if(raw.kind==='image'){
 html+=`<div class="section-title">Image options</div>`;
 html+=selectionField('Fit inside frame','imageFit', [['cover','Cover frame (crop)'],['contain','Fit whole image'],['width','Fit to frame width'],['height','Fit to frame height'],['stretch','Stretch to frame'],['free','Free / original size']],e.imageFit);
 html+=`<div class="fields-two">${field('Free resize scale','imgScale',e.imgScale,'number','min="0.01" step="0.1"')}${field('Offset X (px)','imgOffsetX',e.imgOffsetX,'number','step="1"')}${field('Offset Y (px)','imgOffsetY',e.imgOffsetY,'number','step="1"')}</div>`;
 if(S.mode==='template')html+=`${selectionField('Automatically use image set','autoSet',[['','None'],...S.sets.map(x=>[x.id,x.name])],e.autoSet)}${selectionField('Image assignment','autoMode',[['sequence','Sequential (no repeat)'],['cycle','Cycle through set'],['random','Deterministic random']],e.autoMode)}`;
 }
 if(raw.kind==='shape')html+=`<div class="section-title">Shape</div>${selectionField('Shape','shape',[['rect','Rectangle'],['ellipse','Ellipse']],e.shape)}`;
 if(raw.kind==='shape'||raw.kind==='image'){
  const texts=[...S.template.elements,...(S.mode==='cards'?(card()?.extraElements||[]):[])].filter(item=>item.kind==='text');
  html+=`<div class="section-title">Visibility link</div>`+
   selectionField('Follow text visibility','linkedTextId',[['','None (always independent)'],...texts.map(item=>[item.id,item.name])],e.linkedTextId||'')+
   `<div class="small" style="padding:0 0 10px">Hide this entire ${raw.kind==='image'?'image frame':'shape'} when the chosen text box is invisible on this card.</div>`;
 }
 html+=`<div class="section-title">Appearance</div>${selectionField('Fill','fillMode',[['none','Transparent'],['solid','Solid colour'],['gradient','Linear gradient']],e.fillMode)}`;
 if(e.fillMode!=='none')html+=`<div class="fields-two">${field('Fill colour 1','fill1',e.fill1,'color')}${e.fillMode==='gradient'?field('Fill colour 2','fill2',e.fill2,'color'):''}</div>${e.fillMode==='gradient'?field('Gradient angle (degrees)','gradientAngle',e.gradientAngle,'number','step="5"'):''}`;
 html+=`<div class="fields-two">${field('Border thickness (px)','borderWidth',e.borderWidth,'number','min="0" step="0.5"')}${field('Border colour','borderColor',e.borderColor,'color')}</div>`;
 if(e.shape!=='ellipse')html+=field('Corner radius (px)','radius',e.radius,'number','min="0" step="1"');
 const opacityField=(label,key)=>field(label,key,Math.round(opacityFor(e,key)*100),'number','min="0" max="100" step="1"');
 html+=opacityField(raw.kind==='image'?'Image opacity (%)':'Background opacity (%)','fillOpacity');
 html+=opacityField('Border opacity (%)','borderOpacity');
 if(raw.kind==='text')html+=opacityField('Text opacity (%)','textOpacity');
 if(S.mode==='cards')html+=`<div class="inspector-action"><button class="secondary" data-action="reset-element">${isExtra(raw.id)?'Remove card-only element':'Reset this element to template'}</button></div>`;
 box.innerHTML=html;
}
export function repaint(all=true){if(all){renderLeft();renderCardControl();renderInspector()}renderStage();$('#projectTitle').textContent=S.projectName}
export function patchElement(id,patch){if(S.mode==='cards'){const c=card();if(!c)return;if(isExtra(id))Object.assign(c.extraElements.find(e=>e.id===id),patch);else{c.overrides??={};c.overrides[id]={...(c.overrides[id]||{}),...patch}}}else Object.assign(templateEl(id),patch)}
export function chooseCard(i){S.cardIndex=clamp(i,0,S.cards.length-1);S.selected=null;repaint()}
export function addElement(kind){const {w,h}=sizePx(),n=S.template.elements.filter(e=>e.kind===kind).length+1;const e=makeElement(kind,{name:uniqName(kind==='text'?`Text ${n}`:kind==='image'?`Image ${n}`:`Shape ${n}`),x:Math.round(w*.15),y:Math.round(h*.15),w:Math.round(w*.7),h:kind==='image'?Math.round(h*.38):kind==='shape'?Math.round(h*.17):65,text:'New text',fontSize:18});if(S.mode==='cards'){card().extraElements??=[];card().extraElements.push(e)}else S.template.elements.push(e);S.selected=e.id;repaint()}


export function setKnownFonts(fonts: string[]) { knownFonts = fonts; }
export function baseFonts() { return fontOptions; }
