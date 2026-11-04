import type {CardTemplate} from './types';
import {guideRects} from './card-guides';
const d=96/25.4;
/** Editor-only overlay. Never participates in PNG or print rendering. */
export function guideOverlay(template:CardTemplate,mode:'template'|'cards',zoom:number):string {
 const {canvas,trim,safe,bleed,settings,radii}=guideRects(template);
 if(!(mode==='template'?settings.showTemplate:settings.showCards))return '';
 if(trim.w<=0||trim.h<=0||safe.w<=0||safe.h<=0)return '';
 const rect=(x:number,y:number,w:number,h:number)=>`left:${x*d*zoom}px;top:${y*d*zoom}px;width:${w*d*zoom}px;height:${h*d*zoom}px;`;
 const radius=(r:number)=>`border-radius:${Math.max(0,r)*d*zoom}px;`;
 const safeStyle=rect(safe.x,safe.y,safe.w,safe.h)+radius(radii.safe);
 const trimStyle=rect(trim.x,trim.y,trim.w,trim.h)+radius(radii.cut);
 // A shadow around the exact rounded safe-zone contour dims *all* the
 // unsafe area, including the wedges outside its rounded corners.
 const shaded=settings.dimUnsafe?`<div class="guide-dim-rounded" style="${safeStyle}"></div>`:'';
 const bleedIsVisible=settings.bleedMode==='bleed'&&Object.values(bleed).some(value=>value>0);
 const cutLine=bleedIsVisible||radii.cut>0;
 return `<div class="card-guide-overlay" aria-hidden="true">${shaded}
 ${cutLine?`<div class="guide-trim" style="${trimStyle}"><span>TRIM</span></div>`:''}
 <div class="guide-safe" style="${safeStyle}"><span>SAFE</span></div></div>`;
}
