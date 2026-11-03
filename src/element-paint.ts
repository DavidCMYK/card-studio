/** Shared element paint operations for PNG export and alpha-accurate shadows. */
import type { CardElement } from './types';
import { opacityFor } from './model';
import { imgBox } from './image-sets';
import { layoutTextBox, TextLayout } from './text-layout';

export function shapePath(ctx:CanvasRenderingContext2D,e:CardElement){
 ctx.beginPath();
 if(e.shape==='ellipse')ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,2*Math.PI);
 else if(e.radius>0&&ctx.roundRect)ctx.roundRect(e.x,e.y,e.w,e.h,Math.min(e.radius,e.w/2,e.h/2));
 else ctx.rect(e.x,e.y,e.w,e.h);
}
function fillCanvas(ctx:CanvasRenderingContext2D,e:CardElement){
 if(e.fillMode==='none')return;
 ctx.save();
 if(e.fillMode==='solid')ctx.fillStyle=e.fill1;
 else{
  const a=(Number(e.gradientAngle)-90)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);
  const extent=(Math.abs(e.w*dx)+Math.abs(e.h*dy))/2;
  const g=ctx.createLinearGradient(e.x+e.w/2-dx*extent,e.y+e.h/2-dy*extent,e.x+e.w/2+dx*extent,e.y+e.h/2+dy*extent);
  g.addColorStop(0,e.fill1);g.addColorStop(1,e.fill2);ctx.fillStyle=g;
 }
 ctx.fillRect(e.x,e.y,e.w,e.h);ctx.restore();
}
function drawText(ctx:CanvasRenderingContext2D,e:CardElement,value:string,layout:TextLayout){
 ctx.save();ctx.beginPath();ctx.rect(e.x+layout.left,e.y+layout.top,layout.innerW,layout.innerH);ctx.clip();
 ctx.font=`${e.italic?'italic ':''}${e.fontWeight||400} ${layout.fontPx}px "${String(e.font||'Georgia').replace(/"/g,'')}"`;
 ctx.fillStyle=e.color;ctx.textBaseline='top';
 if('letterSpacing' in ctx)ctx.letterSpacing=(e.letterSpacing||0)+'px';
 const {lines,linePx,fontPx}=layout;
 let y=e.y+layout.top+(e.valign==='bottom'?layout.innerH-layout.textHeight:e.valign==='middle'?(layout.innerH-layout.textHeight)/2:0);
 let x=e.x+layout.left;
 ctx.textAlign=e.align==='center'?'center':e.align==='right'?'right':'left';
 if(e.align==='center')x+=layout.innerW/2;else if(e.align==='right')x+=layout.innerW;
 for(const line of lines){
  if(y+linePx>e.y+layout.top&&y<e.y+e.h-layout.bottom){
   ctx.fillText(line,x,y);
   if(e.underline){
    const tw=ctx.measureText(line).width,ux=e.align==='center'?x-tw/2:e.align==='right'?x-tw:x;
    ctx.beginPath();ctx.moveTo(ux,y+fontPx*1.02);ctx.lineTo(ux+tw,y+fontPx*1.02);
    ctx.lineWidth=Math.max(.6,fontPx/18);ctx.strokeStyle=e.color;ctx.stroke();
   }
  }
  y+=linePx;
 }
 ctx.restore();
}
/** Render the real visible composite. Transparent pixels contribute no shadow mask. */
export function paintElement(ctx:CanvasRenderingContext2D,e:CardElement,value:string,img:CanvasImageSource|null,layout?:TextLayout|null){
 ctx.save();
 ctx.globalAlpha=opacityFor(e,'fillOpacity');
 ctx.save();shapePath(ctx,e);ctx.clip();fillCanvas(ctx,e);ctx.restore();
 if(e.kind==='image'&&img){
  ctx.save();shapePath(ctx,e);ctx.clip();const bb=imgBox(e,img);
  const angle=Number(e.imgRotation)||0,sx=e.imgFlipX===true?-1:1,sy=e.imgFlipY===true?-1:1;
  if(angle||sx<0||sy<0){
   ctx.translate(e.x+e.w/2,e.y+e.h/2);ctx.rotate(angle*Math.PI/180);ctx.scale(sx,sy);
   ctx.drawImage(img,bb.x-e.w/2,bb.y-e.h/2,bb.w,bb.h);
  }else ctx.drawImage(img,e.x+bb.x,e.y+bb.y,bb.w,bb.h);
  ctx.restore();
 }
 if(e.kind==='text'){
  ctx.globalAlpha=opacityFor(e,'textOpacity');
  drawText(ctx,e,value,layout||layoutTextBox(e,value));
 }
 if(e.borderWidth>0){
  ctx.globalAlpha=opacityFor(e,'borderOpacity');shapePath(ctx,e);
  ctx.lineWidth=e.borderWidth;ctx.strokeStyle=e.borderColor;ctx.stroke();
 }
 ctx.restore();
}
