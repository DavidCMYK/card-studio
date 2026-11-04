import { S, sizePx, templateExportSize, visibleOnCard } from './model';
import { getImageData, loadedImage } from './image-sets';
import { elementGeometry } from './anchor-layout';
import {waitForProjectFonts} from './project-fonts';
import { paintElement } from './element-paint';
import { makeShadow, makeElementAlpha, depthMergedShadowPasses } from './shadow';

/** Paint each shadow immediately before its source. Stacking is normal source-over (additive). */
export async function canvasCard(ci:number,mode:'template'|'cards'='cards'){
 await waitForProjectFonts();
 const {w,h}=sizePx(),{w:W,h:H}=templateExportSize();
 if(W>12000||H>12000||W*H>75000000)throw Error('Export dimensions are too large. Lower the DPI or card size.');
 const cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;
 const ctx=cvs.getContext('2d')!;
 ctx.scale(W/w,H/h);
 const elements=[] as {e:typeof S.template.elements[number];value:string;img:CanvasImageSource|null}[];
 for(const raw of [...S.template.elements,...(mode==='cards'?(S.cards[ci]?.extraElements||[]):[])]){
  if(!visibleOnCard(raw,ci,mode))continue;
  const effective=mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;
  const value=raw.kind==='text'?(mode==='cards'&&Object.prototype.hasOwnProperty.call(S.cards[ci]?.values||{},raw.id)?S.cards[ci].values[raw.id]:raw.text):'';
  const e={...effective,...elementGeometry(raw,ci,mode)};
  const src=raw.kind==='image'?getImageData(raw,ci,mode):null;
  const img=src?await loadedImage(src):null;
  elements.push({e,value,img});
 }
 if(S.template.shadowOverlapMode==='merge'){
  const ratio=W/w;
  const passes=depthMergedShadowPasses(W,H,ratio,elements.map(({e,value,img})=>{
   const shadow=makeShadow(e,value,img,ratio);
   const alpha=shadow?{pixels:shadow.pixels,pad:shadow.pad,ratio}:makeElementAlpha(e,value,img,ratio);
   return {x:e.x,y:e.y,shadow,alpha};
  }));
  ctx.fillStyle=S.template.background;ctx.fillRect(0,0,w,h);
  for(let i=0;i<elements.length;i++){
   const pass=passes[i];
   if(pass){
    ctx.save();ctx.globalAlpha=1;
    ctx.drawImage(pass.canvas,pass.x-pass.pad,pass.y-pass.pad,pass.canvas.width/pass.ratio,pass.canvas.height/pass.ratio);
    ctx.restore();
   }
   const {e,value,img}=elements[i];paintElement(ctx,e,value,img);
  }
 }else{
  ctx.fillStyle=S.template.background;ctx.fillRect(0,0,w,h);
  for(const {e,value,img} of elements){
   const shadow=makeShadow(e,value,img,W/w);
   if(shadow){
    ctx.save();ctx.globalAlpha=1;
    ctx.drawImage(shadow.canvas,e.x-shadow.pad,e.y-shadow.pad,shadow.canvas.width/shadow.ratio,shadow.canvas.height/shadow.ratio);
    ctx.restore();
   }
   paintElement(ctx,e,value,img);
  }
 }
 return cvs;
}
