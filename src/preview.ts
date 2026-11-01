import { S, sizePx, layerEls, effective, actualValue, clamp, escapeHTML, templateExportSize, isExported, opacityFor } from './model';
import { $ } from './dom';
import { getImageData, cacheImage, imgBox } from './image-sets';
const gradientCSS=e=>e.fillMode==='solid'?e.fill1:e.fillMode==='gradient'?`linear-gradient(${e.gradientAngle}deg,${e.fill1},${e.fill2})`:'transparent';
export function renderStage(){const st=$('#stage'),{w,h}=sizePx(),z=S.zoom;st.style.width=(w*z)+'px';st.style.height=(h*z)+'px';st.style.background=S.template.background;
 let html='';const eList=layerEls();for(const raw of eList){const e=effective(raw);if(e.hidden||(S.mode==='cards'&&(!isExported(raw)||!isExported(e))))continue;const selected=S.selected===raw.id,src=getImageData(raw,S.cardIndex,S.mode);let content='';
 if(e.kind==='text'){
 const style=`font-family:${escapeHTML(e.font)},serif;font-size:${e.fontSize*(96/72)*z}px;font-weight:${e.fontWeight};font-style:${e.italic?'italic':'normal'};text-decoration:${e.underline?'underline':'none'};color:${e.color};text-align:${e.align};line-height:${e.lineHeight};letter-spacing:${e.letterSpacing*z}px;align-items:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};`;
 content=`<div class="txt-inner" style="${style}"><div class="txt-content">${escapeHTML(actualValue(raw))}</div></div>`;
 }else if(e.kind==='image'){
 const im=cacheImage(src);if(src&&im?.loaded){const box=imgBox(e,im.im);content=`<div class="image-content"><img alt="" draggable="false" src="${src}" style="left:${box.x*z}px;top:${box.y*z}px;width:${box.w*z}px;height:${box.h*z}px"></div>`}
 else content=`<div class="missing">${src?'Loading image…':`IMAGE FRAME<br>${escapeHTML(raw.name)}`}</div>`;
 }
 const border=e.borderWidth>0?`${e.borderWidth*z}px solid ${e.borderColor}`:'none';
 const base=`left:${e.x*z}px;top:${e.y*z}px;width:${e.w*z}px;height:${e.h*z}px;border-radius:${e.shape==='ellipse'?'50%':`${(e.radius||0)*z}px`};`;
 const fill=`<div class="element-fill" style="background:${gradientCSS(e)};opacity:${opacityFor(e,'fillOpacity')}"></div>`;
 const borderLayer=e.borderWidth>0?`<div class="element-border" style="border:${border};opacity:${opacityFor(e,'borderOpacity')}"></div>`:'';
 if(e.kind==='text')content=`<div class="text-layer" style="opacity:${opacityFor(e,'textOpacity')}">${content}</div>`;
 if(e.kind==='image')content=`<div class="image-layer" style="opacity:${opacityFor(e,'fillOpacity')}">${content}</div>`;
 const handles=!e.locked?['nw','n','ne','e','se','s','sw','w'].map(h=>`<span class="resize-handle resize-${h}" data-handle="${h}"></span>`).join(''):'';
 const label=selected?`<span class="selection-label">${escapeHTML(raw.name)}</span>${handles}`:'';
 html+=`<div class="element ${selected?'selected':''} ${e.locked?'locked':''}" data-id="${raw.id}" style="${base}">${fill}${content}${borderLayer}${label}</div>`;
 }
 st.innerHTML=html;$('#statusLeft').textContent=`${S.template.width} × ${S.template.height} ${S.template.unit} · ${templateExportSize().w} × ${templateExportSize().h} export px · ${S.template.dpi} DPI`;
 $('#zoomLabel').textContent=Math.round(S.zoom*100)+'%';
}

