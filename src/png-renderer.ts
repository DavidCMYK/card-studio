import { S, sizePx, templateExportSize, visibleOnCard } from './model';
import { getImageData, loadedImage } from './image-sets';
import { elementGeometry } from './anchor-layout';
import { paintElement } from './element-paint';
import { makeShadow, mergedShadowCanvas, PlacedShadow } from './shadow';

/** Paint each shadow immediately before its source. Stacking is normal source-over (additive). */
export async function canvasCard(ci:number,mode:'template'|'cards'='cards'){
 const {w,h}=sizePx(),{w:W,h:H}=templateExportSize();
 if(W>12000||H>12000||W*H>75000000)throw Error('Export dimensions are too large. Lower the DPI or card size.');
 const cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;
 const ctx=cvs.getContext('2d',{alpha:false})!;
 ctx.scale(W/w,H/h);ctx.fillStyle=S.template.background;ctx.fillRect(0,0,w,h);
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
  const shadows:PlacedShadow[]=[];
  for(const {e,value,img} of elements){
   const graphic=makeShadow(e,value,img,W/w);
   if(graphic)shadows.push({graphic,x:e.x,y:e.y});
  }
  const merged=mergedShadowCanvas(W,H,W/w,shadows);
  if(merged)ctx.drawImage(merged,0,0,w,h);
  for(const {e,value,img} of elements)paintElement(ctx,e,value,img);
 }else{
  // Existing behavior is unchanged for old projects and Add mode.
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
