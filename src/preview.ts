import {guidesFor} from './card-guides';
import { S, sizePx, layerEls, effective, actualValue, escapeHTML, templateExportSize, visibleOnCard, opacityFor } from './model';
import {guideOverlay} from './guide-overlay';
import { $ } from './dom';
import { getImageData, cacheImage, imgBox } from './image-sets';
import { layoutTextBox } from './text-layout';
import { elementGeometry } from './anchor-layout';
import {repositionImageId} from './image-reposition';
import {isolatedTextId} from './text-isolation';
import { previewShadow, previewTextContent, hasShadow, makeElementAlpha, depthMergedShadowPasses, ElementAlpha, ShadowGraphic } from './shadow';
const gradientCSS=e=>e.fillMode==='solid'?e.fill1:e.fillMode==='gradient'?`linear-gradient(${e.gradientAngle}deg,${e.fill1},${e.fill2})`:'transparent';
export function renderStage(){const st=$('#stage'),{w,h}=sizePx(),z=S.zoom;
 const guideButton=document.querySelector('[data-action="toggle-guides"]');
 if(guideButton?.classList?.toggle){const g=guidesFor(S.template);guideButton.classList.toggle('selected',S.mode==='template'?g.showTemplate:g.showCards);}st.style.width=(w*z)+'px';st.style.height=(h*z)+'px';st.style.background=S.template.background;
 const activeImage=repositionImageId(),activeText=isolatedTextId();
 const bar=document.querySelector('#imageRepositionBar') as HTMLElement|null;
 if(bar){
  bar.hidden=!activeImage&&!activeText;
  const title=bar.querySelector?.('strong'),button=bar.querySelector?.('button');
  if(title)title.textContent=activeText?'Edit text independently':'Reposition image';
  if(button)button.dataset.action=activeText?'finish-text-isolation':'finish-reposition-image';
  if(activeText){
   const hint=bar.querySelector?.('#imageRepositionHint');
   if(hint)hint.textContent='Move or resize text · Linked shapes and images stay in place';
  }
 }
 const mergeMode=S.template.shadowOverlapMode==='merge';
 const visibleElements:{html:string;shadow:ShadowGraphic|null;alpha:ElementAlpha|null;x:number;y:number}[]=[];
 for(const raw of layerEls()){
  const e=effective(raw);if(S.mode==='template'?e.hidden:!visibleOnCard(raw,S.cardIndex,'cards'))continue;
  const selected=S.selected===raw.id,repositioning=activeImage===raw.id,independent=activeText===raw.id,src=getImageData(raw,S.cardIndex,S.mode);const geom=elementGeometry(raw,S.cardIndex,S.mode);let content='',ghost='';
  if(repositioning){
   const hint=document.querySelector('#imageRepositionHint');
   if(hint)hint.textContent=e.imageFit==='free'?'Drag to move · Wheel or pinch to resize':
    e.imageFit==='width'?'Drag vertically · Width remains fitted':
    e.imageFit==='height'?'Drag horizontally · Height remains fitted':
    'Drag along cropped axes only · Scale stays automatic';
  }
  const value=e.kind==='text'?actualValue(raw):'';
  if(e.kind==='text'){
   const layout=layoutTextBox(e,actualValue(raw));
   const style=`font-family:${escapeHTML(e.font)},serif;font-size:${layout.fontPx*z}px;font-weight:${e.fontWeight};font-style:${e.italic?'italic':'normal'};text-decoration:${e.underline?'underline':'none'};color:${e.color};text-align:${e.align};line-height:${layout.linePx*z}px;letter-spacing:${e.letterSpacing*z}px;align-items:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};left:${layout.left*z}px;right:${layout.right*z}px;top:${layout.top*z}px;bottom:${layout.bottom*z}px;`;
   content=`<div class="txt-inner" style="${style}"><div class="txt-content">${layout.lines.map(line=>`<span class="txt-line">${line?escapeHTML(line):'&nbsp;'}</span>`).join('')}</div></div>`;
  }else if(e.kind==='image'){
   const im=cacheImage(src);if(src&&im?.loaded){const box=imgBox({...e,...geom},im.im);
   const angle=Number(e.imgRotation)||0,sx=e.imgFlipX===true?-1:1,sy=e.imgFlipY===true?-1:1;
   const transform=angle||sx<0||sy<0?`transform-origin:${(geom.w/2-box.x)*z}px ${(geom.h/2-box.y)*z}px;transform:rotate(${angle}deg) scale(${sx},${sy});`:'';
   const imageHTML=`<img alt="" draggable="false" src="${im.displayUrl||src}" style="left:${box.x*z}px;top:${box.y*z}px;width:${box.w*z}px;height:${box.h*z}px;${transform}>`;
   content=`<div class="image-content">${imageHTML}</div>`;
   if(repositioning)ghost=`<div class="image-reposition-ghost">${imageHTML}</div>`;}
   else content=`<div class="missing">${src?'Loading image…':`IMAGE FRAME<br>${escapeHTML(raw.name)}`}</div>`;
  }
  const border=e.borderWidth>0?`${e.borderWidth*z}px solid ${e.borderColor}`:'none';
  const base=`left:${geom.x*z}px;top:${geom.y*z}px;width:${geom.w*z}px;height:${geom.h*z}px;border-radius:${e.shape==='ellipse'?'50%':`${(e.radius||0)*z}px`};`;
  const fill=`<div class="element-fill" style="background:${gradientCSS(e)};opacity:${opacityFor(e,'fillOpacity')}"></div>`;
  const borderLayer=e.borderWidth>0?`<div class="element-border" style="border:${border};opacity:${opacityFor(e,'borderOpacity')}"></div>`:'';
  if(e.kind==='text'){
   const raster=hasShadow(e)?previewTextContent({...e,...geom},actualValue(raw),z):null;
   if(raster)content=`<div class="text-layer"><img alt="" draggable="false" src="${raster}" style="width:100%;height:100%;display:block;pointer-events:none"></div>`;
   else content=`<div class="text-layer" style="opacity:${opacityFor(e,'textOpacity')}">${content}</div>`;
  }
  if(e.kind==='image')content=`<div class="image-layer" style="opacity:${opacityFor(e,'fillOpacity')}">${content}</div>`;
  const image=src&&cacheImage(src)?.loaded?cacheImage(src)?.im:null;
  const painted={...e,...geom};
  const shadow=previewShadow(painted,value,image,z);
  const alpha=mergeMode?(shadow?{pixels:shadow.pixels,pad:shadow.pad,ratio:shadow.ratio}:makeElementAlpha(painted,value,image,z)):null;
  const shadowLayer=!mergeMode&&shadow?`<img class="shadow-layer" alt="" draggable="false" src="${shadow.src}" style="left:${-shadow.pad*z}px;top:${-shadow.pad*z}px;width:${shadow.width*z}px;height:${shadow.height*z}px">`:'';
  const handles=!e.locked&&!repositioning?['nw','n','ne','e','se','s','sw','w'].map(h=>`<span class="resize-handle resize-${h}" data-handle="${h}"></span>`).join(''):'';
  const label=selected?`<span class="selection-label">${repositioning?'Reposition image · drag to pan':independent?'Text only · '+escapeHTML(raw.name):escapeHTML(raw.name)}</span>${handles}`:'';
  visibleElements.push({
   shadow:mergeMode&&shadow?{canvas:shadow.canvas,pixels:shadow.pixels,pad:shadow.pad,ratio:shadow.ratio}:null,
   alpha,x:geom.x,y:geom.y,
   html:`<div class="element ${selected?'selected':''} ${repositioning?'repositioning':''} ${independent?'text-isolated':''} ${e.locked?'locked':''}" data-id="${raw.id}" style="${base}">${shadowLayer}${ghost}${fill}${content}${borderLayer}${label}</div>`
  });
 }
 let html='';
 if(mergeMode){
  const passes=depthMergedShadowPasses(Math.ceil(w*z),Math.ceil(h*z),z,visibleElements);
  for(let i=0;i<visibleElements.length;i++){
   const pass=passes[i];
   if(pass){
    const src=pass.canvas.toDataURL('image/png');
    html+=`<img class="merged-shadow-layer" alt="" draggable="false" src="${src}" style="position:absolute;left:${(pass.x-pass.pad)*z}px;top:${(pass.y-pass.pad)*z}px;width:${pass.canvas.width}px;height:${pass.canvas.height}px;pointer-events:none">`;
   }
   html+=visibleElements[i].html;
  }
 }else html=visibleElements.map(v=>v.html).join('');
 st.innerHTML=html+guideOverlay(S.template,S.mode,S.zoom);$('#statusLeft').textContent=`${S.template.width} × ${S.template.height} ${S.template.unit} · ${templateExportSize().w} × ${templateExportSize().h} export px · ${S.template.dpi} DPI`;
 $('#zoomLabel').textContent=Math.round(S.zoom*100)+'%';
}
