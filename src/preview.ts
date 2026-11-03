import { S, sizePx, layerEls, effective, actualValue, clamp, escapeHTML, templateExportSize, visibleOnCard, opacityFor } from './model';
import { $ } from './dom';
import { getImageData, cacheImage, imgBox } from './image-sets';
import { layoutTextBox } from './text-layout';
import { elementGeometry } from './anchor-layout';
import { previewShadow } from './shadow';
const gradientCSS=e=>e.fillMode==='solid'?e.fill1:e.fillMode==='gradient'?`linear-gradient(${e.gradientAngle}deg,${e.fill1},${e.fill2})`:'transparent';
export function renderStage(){const st=$('#stage'),{w,h}=sizePx(),z=S.zoom;st.style.width=(w*z)+'px';st.style.height=(h*z)+'px';st.style.background=S.template.background;
 let html='';const eList=layerEls();for(const raw of eList){const e=effective(raw);if(S.mode==='template'?e.hidden:!visibleOnCard(raw,S.cardIndex,'cards'))continue;const selected=S.selected===raw.id,src=getImageData(raw,S.cardIndex,S.mode);const geom=elementGeometry(raw,S.cardIndex,S.mode);let content='';
 if(e.kind==='text'){
 const layout=layoutTextBox(e,actualValue(raw));
 const style=`font-family:${escapeHTML(e.font)},serif;font-size:${layout.fontPx*z}px;font-weight:${e.fontWeight};font-style:${e.italic?'italic':'normal'};text-decoration:${e.underline?'underline':'none'};color:${e.color};text-align:${e.align};line-height:${layout.linePx*z}px;letter-spacing:${e.letterSpacing*z}px;align-items:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};left:${layout.left*z}px;right:${layout.right*z}px;top:${layout.top*z}px;bottom:${layout.bottom*z}px;`;
 content=`<div class="txt-inner" style="${style}"><div class="txt-content">${layout.lines.map(line=>`<span class="txt-line">${line?escapeHTML(line):'&nbsp;'}</span>`).join('')}</div></div>`;
 }else if(e.kind==='image'){
 const im=cacheImage(src);if(src&&im?.loaded){const box=imgBox({...e,...geom},im.im);
 // The image is transformed around the FRAME centre, not its cropped bounds.
 // Pixel transform-origin allows this to work with offsets and all fit modes.
 const angle=Number(e.imgRotation)||0,sx=e.imgFlipX===true?-1:1,sy=e.imgFlipY===true?-1:1;
 const transform=angle||sx<0||sy<0?`transform-origin:${(geom.w/2-box.x)*z}px ${(geom.h/2-box.y)*z}px;transform:rotate(${angle}deg) scale(${sx},${sy});`:'';
 content=`<div class="image-content"><img alt="" draggable="false" src="${src}" style="left:${box.x*z}px;top:${box.y*z}px;width:${box.w*z}px;height:${box.h*z}px;${transform}"></div>`}
 else content=`<div class="missing">${src?'Loading image…':`IMAGE FRAME<br>${escapeHTML(raw.name)}`}</div>`;
 }
 const border=e.borderWidth>0?`${e.borderWidth*z}px solid ${e.borderColor}`:'none';
 const base=`left:${geom.x*z}px;top:${geom.y*z}px;width:${geom.w*z}px;height:${geom.h*z}px;border-radius:${e.shape==='ellipse'?'50%':`${(e.radius||0)*z}px`};`;
 const fill=`<div class="element-fill" style="background:${gradientCSS(e)};opacity:${opacityFor(e,'fillOpacity')}"></div>`;
 const borderLayer=e.borderWidth>0?`<div class="element-border" style="border:${border};opacity:${opacityFor(e,'borderOpacity')}"></div>`:'';
 if(e.kind==='text')content=`<div class="text-layer" style="opacity:${opacityFor(e,'textOpacity')}">${content}</div>`;
 if(e.kind==='image')content=`<div class="image-layer" style="opacity:${opacityFor(e,'fillOpacity')}">${content}</div>`;
 const shadow=previewShadow({...e,...geom},e.kind==='text'?actualValue(raw):'',src&&cacheImage(src)?.loaded?cacheImage(src)?.im:null,z);
 const shadowLayer=shadow?`<img class="shadow-layer" alt="" draggable="false" src="${shadow.src}" style="left:${-shadow.pad*z}px;top:${-shadow.pad*z}px;width:${shadow.width*z}px;height:${shadow.height*z}px">`:'';
 const handles=!e.locked?['nw','n','ne','e','se','s','sw','w'].map(h=>`<span class="resize-handle resize-${h}" data-handle="${h}"></span>`).join(''):'';
 const label=selected?`<span class="selection-label">${escapeHTML(raw.name)}</span>${handles}`:'';
 html+=`<div class="element ${selected?'selected':''} ${e.locked?'locked':''}" data-id="${raw.id}" style="${base}">${shadowLayer}${fill}${content}${borderLayer}${label}</div>`;
 }
 st.innerHTML=html;$('#statusLeft').textContent=`${S.template.width} × ${S.template.height} ${S.template.unit} · ${templateExportSize().w} × ${templateExportSize().h} export px · ${S.template.dpi} DPI`;
 $('#zoomLabel').textContent=Math.round(S.zoom*100)+'%';
}

