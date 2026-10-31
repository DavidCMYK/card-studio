// @ts-nocheck
import { S, sizePx, clamp } from './model';
import { getImageData, loadedImage, imgBox } from './image-sets';
function fillCanvas(ctx,e,x,y,w,h){if(e.fillMode==='none')return;ctx.save();if(e.fillMode==='solid')ctx.fillStyle=e.fill1;else{const a=(Number(e.gradientAngle)-90)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),extent=(Math.abs(w*dx)+Math.abs(h*dy))/2;const g=ctx.createLinearGradient(x+w/2-dx*extent,y+h/2-dy*extent,x+w/2+dx*extent,y+h/2+dy*extent);g.addColorStop(0,e.fill1);g.addColorStop(1,e.fill2);ctx.fillStyle=g}ctx.fillRect(x,y,w,h);ctx.restore()}
function makeShapePath(ctx,e){ctx.beginPath();if(e.shape==='ellipse')ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,2*Math.PI);else if(e.radius>0&&ctx.roundRect)ctx.roundRect(e.x,e.y,e.w,e.h,Math.min(e.radius,e.w/2,e.h/2));else ctx.rect(e.x,e.y,e.w,e.h)}
function canvasFillShape(ctx,e){ctx.save();makeShapePath(ctx,e);ctx.clip();fillCanvas(ctx,e,e.x,e.y,e.w,e.h);ctx.restore()}
function wrapText(ctx,value,maxWidth){let lines=[];for(const para of String(value??'').split('\n')){if(!para){lines.push('');continue}let line='';for(const word of para.split(/\s+/)){if(ctx.measureText(word).width>maxWidth){if(line){lines.push(line);line=''}let part='';for(const ch of [...word]){if(ctx.measureText(part+ch).width>maxWidth&&part){lines.push(part);part=ch}else part+=ch}line=part;continue}if(ctx.measureText((line?line+' ':'')+word).width>maxWidth&&line){lines.push(line);line=word}else line+=(line?' ':'')+word}lines.push(line)}return lines}
function canvasDrawText(ctx,e,value){const size=(Number(e.fontSize)||16)*(96/72),lh=size*(Number(e.lineHeight)||1.2);ctx.save();ctx.beginPath();ctx.rect(e.x,e.y,e.w,e.h);ctx.clip();ctx.font=`${e.italic?'italic ':''}${e.fontWeight||400} ${size}px "${String(e.font||'Georgia').replace(/"/g,'')}"`;ctx.fillStyle=e.color;ctx.textBaseline='top';if('letterSpacing' in ctx)ctx.letterSpacing=(e.letterSpacing||0)+'px';const lines=wrapText(ctx,value,e.w);let y=e.y+(e.valign==='bottom'?e.h-lines.length*lh:e.valign==='middle'?(e.h-lines.length*lh)/2:0);let x=e.x;ctx.textAlign=e.align==='center'?'center':e.align==='right'?'right':'left';if(e.align==='center')x+=e.w/2;else if(e.align==='right')x+=e.w;for(const line of lines){if(y+lh>e.y&&y<e.y+e.h){ctx.fillText(line,x,y);if(e.underline){const tw=ctx.measureText(line).width;const ux=e.align==='center'?x-tw/2:e.align==='right'?x-tw:x;ctx.beginPath();ctx.moveTo(ux,y+size*1.02);ctx.lineTo(ux+tw,y+size*1.02);ctx.lineWidth=Math.max(.6,size/18);ctx.strokeStyle=e.color;ctx.stroke()}}y+=lh}ctx.restore()}
export async function canvasCard(ci,mode='cards'){
 const {w,h}=sizePx(),dpi=Number(S.template.dpi)||300,mult=S.template.unit==='px'?1:dpi/96,W=Math.round(w*mult),H=Math.round(h*mult);
 if(W>12000||H>12000||W*H>75000000)throw Error('Export dimensions are too large. Lower the DPI or card size.');
 const cvs=document.createElement('canvas');cvs.width=W;cvs.height=H;const ctx=cvs.getContext('2d',{alpha:false});ctx.scale(W/w,H/h);ctx.fillStyle=S.template.background;ctx.fillRect(0,0,w,h);
 for(const raw of [...S.template.elements,...(mode==='cards'?(S.cards[ci]?.extraElements||[]):[])]){const e=mode==='cards'?{...raw,...(S.cards[ci]?.overrides?.[raw.id]||{})}:raw;if(e.hidden)continue;ctx.save();ctx.globalAlpha=clamp((e.opacity??100)/100,0,1);
 canvasFillShape(ctx,e);
 if(raw.kind==='image'){const src=getImageData(raw,ci,mode),img=await loadedImage(src);if(img){ctx.save();makeShapePath(ctx,e);ctx.clip();const bb=imgBox(e,img);ctx.drawImage(img,e.x+bb.x,e.y+bb.y,bb.w,bb.h);ctx.restore()}}
 if(raw.kind==='text'){const value=mode==='cards'&&Object.prototype.hasOwnProperty.call(S.cards[ci]?.values||{},raw.id)?S.cards[ci].values[raw.id]:raw.text;canvasDrawText(ctx,e,value)}
 if(e.borderWidth>0){makeShapePath(ctx,e);ctx.lineWidth=e.borderWidth;ctx.strokeStyle=e.borderColor;ctx.stroke()}
 ctx.restore()}
 return cvs;
}

