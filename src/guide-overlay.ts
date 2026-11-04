import type {CardTemplate} from './types';
import {guideRects} from './card-guides';
const d=96/25.4;
/** Editor-only overlay. Never participates in PNG or print rendering. */
export function guideOverlay(template:CardTemplate,mode:'template'|'cards',zoom:number):string {
 const {canvas,trim,safe,settings}=guideRects(template);
 if(!(mode==='template'?settings.showTemplate:settings.showCards))return '';
 if(trim.w<=0||trim.h<=0||safe.w<=0||safe.h<=0)return '';
 const rect=(x:number,y:number,w:number,h:number)=>`left:${x*d*zoom}px;top:${y*d*zoom}px;width:${w*d*zoom}px;height:${h*d*zoom}px;`;
 const safeStyle=rect(safe.x,safe.y,safe.w,safe.h);
 const trimStyle=rect(trim.x,trim.y,trim.w,trim.h);
 const shaded=settings.dimUnsafe?`<div class="guide-dim" style="${rect(0,0,canvas.width,safe.y)}"></div>
 <div class="guide-dim" style="${rect(0,safe.y,safe.x,safe.h)}"></div>
 <div class="guide-dim" style="${rect(safe.x+safe.w,safe.y,canvas.width-safe.x-safe.w,safe.h)}"></div>
 <div class="guide-dim" style="${rect(0,safe.y+safe.h,canvas.width,canvas.height-safe.y-safe.h)}"></div>`:'';
 return `<div class="card-guide-overlay" aria-hidden="true">${shaded}
 ${settings.bleedMode==='bleed'&&Object.values(settings.bleed).some(value=>value>0)?`<div class="guide-trim" style="${trimStyle}"><span>TRIM</span></div>`:''}
 <div class="guide-safe" style="${safeStyle}"><span>SAFE</span></div></div>`;
}