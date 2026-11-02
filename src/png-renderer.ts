import { S, sizePx, templateExportSize, clamp, visibleOnCard, opacityFor } from './model';
import { getImageData, loadedImage, imgBox } from './image-sets';
import { layoutTextBox, TextLayout } from './text-layout';
import { elementGeometry } from './anchor-layout';
function fillCanvas(ctx,e,x,y,w,h){if(e.fillMode==='none')return;ctx.save();if(e.fillMode==='solid')ctx.fillStyle=e.fill1;else{const a=(Number(e.gradientAngle)-90)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),extent=(Math.abs(w*dx)+Math.abs(h*dy))/2;const g=ctx.createLinearGradient(x+w/2-dx*extent,y+h/2-dy*extent,x+w/2+dx*extent,y+h/2+dy*extent);g.addColorStop(0,e.fill1);g.addColorStop(1,e.fill2);ctx.fillStyle=g}ctx.fillRect(x,y,w,h);ctx.restore()}
function makeShapePath(ctx,e){ctx.beginPath();if(e.shape==='ellipse')ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,2*Math.PI);else if(e.radius>0&&ctx.roundRect)ctx.roundRect(e.x,e.y,e.w,e.h,Math.min(e.radius,e.w/2,e.h/2));else ctx.rect(e.x,e.y,e.w,e.h)}
function canvasFillShape(ctx,e){ctx.save();makeShapePath(ctx,e);ctx.clip();fillCanvas(ctx,e,e.x,e.y,e.w,e.h);ctx.restore()}
function canvasDrawText(ctx,e,value,layout:TextLayout){
 ctx.save();ctx.beginPath();ctx.rect(e.x+layout.left,e.y+layout.top,layout.innerW,layout.innerH);ctx.clip();
 ctx.font=`${e.italic?'italic ':''}${e.fontWeight||400} ${layout.fontPx}px "${String(e.font||'Georgia').replace(/"/g,'')}"`;
 ctx.fillStyle=e.color;ctx.textBaseline='top';
 if('letterSpacing' in ctx)ctx.letterSpacing=(e.letterSpacing||0)+'px';
 const {lines,linePx,fontPx}=layout;
 let y=e.y+layout.top+(e.valign==='bottom'?layout.innerH-layout.textHeight:e.valign==='middle'?(layout.innerH-layout.textHeight)/2:0);
 let x=e.x+layout.left;
 ctx.textAlign=e.align==='center'?'center':e.align==='right'?'right':'left';
 if(e.align==='center')x+=layout.innerW/2;else if(e.align==='right')x+=layout.innerW;
 for(const line of lines){if(y+linePx>e.y+layout.top&&y<e.y+e.h-layout.bottom){
  ctx.fillText(line,x,y);
  if(e.underline){const tw=ctx.measureText(line).width;const ux=e.align==='center'?x-tw/2:e.align==='right'?x-tw:x;ctx.beginPath();ctx.moveTo(ux,y+fontPx*1.02);ctx.lineTo(ux+tw,y+fontPx*1.02);ctx.lineWidth=Math.max(.6,fontPx/18);ctx.strokeStyle=e.color;ctx.stroke()}
 }y+=linePx}
 ctx.restore();
}
export async function canvasCard(ci,mode: 'template'|'cards'='cards'){
 const {w,h}=sizePx(),{w:W,h:H}=templateExportSize();
 if(W>12000||H>12000||W*H>75000000)throw Error('Export dimensions are too large. Lower the DPI or card size.');
 const cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;const ctx=cvs.getContext('2d',{alpha:false});ctx.scale(W/w,H/h);ctx.fillStyle=S.template.background;ctx.fillRect(0,0,w,h);
 for(const raw of [...S.template.elements,...(mode==='cards'?(S.cards[ci]?.extraElements||[]):[])]){const effective=mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;if(!visibleOnCard(raw,ci,mode))continue;
 const value=raw.kind==='text'?(mode==='cards'&&Object.prototype.hasOwnProperty.call(S.cards[ci]?.values||{},raw.id)?S.cards[ci].values[raw.id]:raw.text):'';
 const layout=raw.kind==='text'?layoutTextBox(effective,value):null;
 const e={...effective,...elementGeometry(raw,ci,mode)};
 ctx.save();
 ctx.globalAlpha=opacityFor(e,'fillOpacity');
 canvasFillShape(ctx,e);
 if(raw.kind==='image'){const src=getImageData(raw,ci,mode),img=await loadedImage(src);if(img){ctx.save();makeShapePath(ctx,e);ctx.clip();const bb=imgBox(e,img);
  // Mirror and rotate only the image pixels, about the frame centre. Its
  // background, crop shape and border stay in their original positions.
  const angle=Number(e.imgRotation)||0,sx=e.imgFlipX===true?-1:1,sy=e.imgFlipY===true?-1:1;
  if(angle||sx<0||sy<0){
   ctx.translate(e.x+e.w/2,e.y+e.h/2);ctx.rotate(angle*Math.PI/180);ctx.scale(sx,sy);
   ctx.drawImage(img,bb.x-e.w/2,bb.y-e.h/2,bb.w,bb.h);
  }else ctx.drawImage(img,e.x+bb.x,e.y+bb.y,bb.w,bb.h);
  ctx.restore()}}
 if(raw.kind==='text'){
   ctx.globalAlpha=opacityFor(e,'textOpacity');
   canvasDrawText(ctx,e,value,layout!);
 }
 if(e.borderWidth>0){ctx.globalAlpha=opacityFor(e,'borderOpacity');makeShapePath(ctx,e);ctx.lineWidth=e.borderWidth;ctx.strokeStyle=e.borderColor;ctx.stroke()}
 ctx.restore()}
 return cvs;
}

