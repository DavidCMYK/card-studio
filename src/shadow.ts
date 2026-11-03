/** Alpha-mask shadows. Spread is circular morphological dilation, not blur or box-shadow. */
import type { CardElement } from './types';
import { clamp } from './model';
import { paintElement, paintTextContent } from './element-paint';

export interface ElementAlpha { pixels:ImageData; pad:number; ratio:number; }
export interface ShadowGraphic extends ElementAlpha { canvas:HTMLCanvasElement; }
export const hasShadow=(e:CardElement)=>e.shadowEnabled===true&&Number(e.shadowOpacity??65)>0;
const nonnegative=(n:unknown)=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
/**
 * Circular grayscale dilation: each output alpha is the MAXIMUM source alpha
 * within the spread radius. Using only the nearest nontransparent source pixel
 * caused semi-transparent PNG antialiasing to form radial streaks and holes.
 * Each horizontal disk span uses a monotonic deque, so this stays efficient
 * even at print DPI and preserves real transparency between separate parts.
 */
export function spreadAlpha(alpha:Uint8ClampedArray,width:number,height:number,radius:number):Uint8ClampedArray{
 const length=width*height;
 if(length!==alpha.length)throw Error('Invalid shadow alpha mask dimensions');
 if(radius<=0)return new Uint8ClampedArray(alpha);
 const out=new Uint8ClampedArray(length);
 const limit=Math.max(0,radius+.25),maxDy=Math.floor(limit);
 const deque=new Int32Array(width);
 for(let dy=-maxDy;dy<=maxDy;dy++){
  const span=Math.floor(Math.sqrt(Math.max(0,limit*limit-dy*dy)));
  for(let y=0;y<height;y++){
   const sy=y+dy;
   if(sy<0||sy>=height)continue;
   const source=sy*width,dest=y*width;
   let head=0,tail=0,next=0;
   for(let x=0;x<width;x++){
    const last=Math.min(width-1,x+span);
    while(next<=last){
     const val=alpha[source+next];
     while(tail>head&&alpha[source+deque[tail-1]]<=val)tail--;
     deque[tail++]=next++;
    }
    while(head<tail&&deque[head]<x-span)head++;
    if(head<tail){
     const val=alpha[source+deque[head]];
     if(val>out[dest+x])out[dest+x]=val;
    }
   }
  }
 }
 return out;
}
function parseColour(colour:string):[number,number,number]{
 const hex=/^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(colour||'');
 if(!hex)return [0,0,0];
 let h=hex[1];if(h.length===3)h=[...h].map(c=>c+c).join('');
 return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
export function shadePixels(mask:ImageData,width:number,height:number,e:CardElement,ratio:number):ImageData{
 const pixels=width*height,alpha=new Uint8ClampedArray(pixels);
 for(let p=0;p<pixels;p++)alpha[p]=mask.data[p*4+3];
 const spread=spreadAlpha(alpha,width,height,Math.max(0,Number(e.shadowSpread)||0)*ratio);
 const [red,green,blue]=parseColour(e.shadowColor||'#000000');
 const opacity=clamp(Number(e.shadowOpacity??65)||0,0,100)/100;
 const dx=Math.round((Number(e.shadowOffsetX)||0)*ratio),dy=Math.round((Number(e.shadowOffsetY)||0)*ratio);
 const output=new ImageData(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const sx=x-dx,sy=y-dy;if(sx<0||sy<0||sx>=width||sy>=height)continue;
  const a=spread[sy*width+sx];if(!a)continue;
  const i=(y*width+x)*4;output.data[i]=red;output.data[i+1]=green;output.data[i+2]=blue;
  output.data[i+3]=Math.round(a*opacity);
 }
 return output;
}
/** The element's actual visible pixels (fill, glyphs, image alpha and border). */
export function makeElementAlpha(e:CardElement,value:string,img:CanvasImageSource|null,ratio:number,pad?:number):ElementAlpha|null{
 if(!Number.isFinite(ratio)||ratio<=0)return null;
 const padding=pad??Math.ceil(Math.max(0,e.borderWidth||0)/2+3);
 const width=Math.ceil((e.w+padding*2)*ratio),height=Math.ceil((e.h+padding*2)*ratio);
 if(width<1||height<1||width*height>16000000)return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context?.getImageData)return null;
 context.setTransform?.(ratio,0,0,ratio,(padding-e.x)*ratio,(padding-e.y)*ratio);
 paintElement(context,e,value,img);
 return {pixels:context.getImageData(0,0,width,height),pad:padding,ratio};
}
/** Image-space rasterization works for all elements, including transparent images. */
export function makeShadow(e:CardElement,value:string,img:CanvasImageSource|null,ratio:number):ShadowGraphic|null{
 if(!hasShadow(e)||!Number.isFinite(ratio)||ratio<=0)return null;
 const spread=nonnegative(e.shadowSpread),ox=Math.abs(Number(e.shadowOffsetX)||0),oy=Math.abs(Number(e.shadowOffsetY)||0);
 const pad=Math.ceil(Math.max(spread,0)+Math.max(ox,oy)+Math.max(0,e.borderWidth||0)/2+3);
 const mask=makeElementAlpha(e,value,img,ratio,pad);
 if(!mask)return null;
 const width=mask.pixels.width,height=mask.pixels.height;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context?.putImageData)return null;
 context.putImageData(shadePixels(mask.pixels,width,height,e,ratio),0,0);
 return {canvas,pad,ratio,pixels:mask.pixels};
}

/** A shadow placement in the card's native (96-dpi) coordinate system. */
export interface PlacedShadow { graphic:ShadowGraphic; x:number; y:number; }
/** Max-alpha compositing retained for direct testing / standalone uses. */
export function mergeShadowPixels(target:ImageData,source:ImageData,left:number,top:number):void{
 const tw=target.width,th=target.height,sw=source.width,sh=source.height;
 const x0=Math.max(0,left),x1=Math.min(tw,left+sw);
 const y0=Math.max(0,top),y1=Math.min(th,top+sh);
 if(x0>=x1||y0>=y1)return;
 const dest=target.data,src=source.data;
 for(let y=y0;y<y1;y++){
  let di=(y*tw+x0)*4,si=((y-top)*sw+x0-left)*4;
  for(let x=x0;x<x1;x++,di+=4,si+=4){
   const alpha=src[si+3];
   if(alpha>0&&alpha>=dest[di+3]){
    dest[di]=src[si];dest[di+1]=src[si+1];dest[di+2]=src[si+2];dest[di+3]=alpha;
   }
  }
 }
}
export function mergedShadowCanvas(width:number,height:number,ratio:number,shadows:PlacedShadow[]):HTMLCanvasElement|null{
 if(!shadows.length||width<1||height<1||width*height>75000000)return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx?.putImageData)return null;
 const result=new ImageData(width,height);
 for(const {graphic,x,y} of shadows){
  const src=graphic.canvas.getContext('2d',{willReadFrequently:true});
  if(!src?.getImageData)continue;
  const pixels=src.getImageData(0,0,graphic.canvas.width,graphic.canvas.height);
  mergeShadowPixels(result,pixels,Math.round((x-graphic.pad)*ratio),Math.round((y-graphic.pad)*ratio));
 }
 ctx.putImageData(result,0,0);
 return canvas;
}

/** A visible element and its optional shadow. Ordered from back to front. */
export interface ShadowStackItem { x:number; y:number; alpha:ElementAlpha|null; shadow:ShadowGraphic|null; }
export interface ShadowPass { canvas:HTMLCanvasElement; pad:number; ratio:number; x:number; y:number; }
/**
 * Produce only the NEW opacity contributed by each element's shadow.
 * The pixel coverage accumulator is the opacity of previously visible shadows.
 * At every pixel, adding shadow opacity a to previous m requires source-over
 * opacity (max(m,a)-m)/(1-m), rather than a or a cumulative layer.
 * Visible artwork between shadows attenuates previous shadow coverage by its
 * actual alpha, so an upper shadow can fall onto lower artwork normally.
 */
export function depthMergedShadowPasses(width:number,height:number,ratio:number,items:ShadowStackItem[]):(ShadowPass|null)[]{
 const out=new Array<ShadowPass|null>(items.length).fill(null);
 if(width<1||height<1||width*height>75000000)return out;
 const visibleCoverage=new Float32Array(width*height);
 for(let layer=0;layer<items.length;layer++){
  const {x,y,shadow,alpha}=items[layer];
  if(shadow){
   const srcCtx=shadow.canvas.getContext('2d',{willReadFrequently:true});
   const src=srcCtx?.getImageData?.(0,0,shadow.canvas.width,shadow.canvas.height);
   if(src){
    const sw=src.width,sh=src.height;
    const left=Math.round((x-shadow.pad)*ratio),top=Math.round((y-shadow.pad)*ratio);
    const x0=Math.max(0,-left),x1=Math.min(sw,width-left);
    const y0=Math.max(0,-top),y1=Math.min(sh,height-top);
    const corrected=new ImageData(sw,sh);
    let any=false;
    for(let sy=y0;sy<y1;sy++){
     const row=(top+sy)*width,leftIndex=sy*sw;
     for(let sx=x0;sx<x1;sx++){
      const source=(leftIndex+sx)*4, a=src.data[source+3]/255;
      if(a<=0)continue;
      const index=row+left+sx,old=visibleCoverage[index];
      if(a<=old)continue;
      const extra=(a-old)/(1-old);
      corrected.data[source]=src.data[source];
      corrected.data[source+1]=src.data[source+1];
      corrected.data[source+2]=src.data[source+2];
      corrected.data[source+3]=Math.round(Math.min(1,extra)*255);
      visibleCoverage[index]=a;
      any=true;
     }
    }
    if(any){
     const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
     const context=canvas.getContext('2d',{willReadFrequently:true});
     if(context?.putImageData){
      context.putImageData(corrected,0,0);
      out[layer]={canvas,pad:shadow.pad,ratio,x,y};
     }
    }
   }
  }
  if(alpha){
   const pixels=alpha.pixels, aw=pixels.width,ah=pixels.height;
   const left=Math.round((x-alpha.pad)*ratio),top=Math.round((y-alpha.pad)*ratio);
   const x0=Math.max(0,-left),x1=Math.min(aw,width-left);
   const y0=Math.max(0,-top),y1=Math.min(ah,height-top);
   for(let sy=y0;sy<y1;sy++){
    const row=(top+sy)*width,sourceRow=sy*aw;
    for(let sx=x0;sx<x1;sx++){
     const opacity=pixels.data[(sourceRow+sx)*4+3]/255;
     if(opacity>0){
      const index=row+left+sx;
      visibleCoverage[index]*=1-opacity;
     }
    }
   }
  }
 }
 return out;
}

// Preview shadows are keyed by content, not the frame position, so dragging
// does not re-rasterize a large alpha mask on every pointermove.
const previewCache=new Map<string,{src:string;width:number;height:number;pad:number;canvas:HTMLCanvasElement;ratio:number;pixels:ImageData}>();
const imageIds=new WeakMap<object,number>();let nextImageId=1;
export function previewShadow(e:CardElement,value:string,img:CanvasImageSource|null,ratio:number){
 if(!hasShadow(e))return null;
 const local={...e,x:0,y:0};
 // Cache on the decoded image identity; never copy multi-megabyte image data URLs
 // into the cache key (or re-hash them on every drag).
 let imageId=0;
 if(img){imageId=imageIds.get(img as object)||nextImageId++;imageIds.set(img as object,imageId)}
 const cacheKey=JSON.stringify([local,value,ratio,imageId]);
 const previous=previewCache.get(cacheKey);if(previous)return previous;
 const result=makeShadow(local,value,img,ratio);
 if(!result||typeof result.canvas.toDataURL!=='function')return null;
 const graphic={src:result.canvas.toDataURL('image/png'),width:result.canvas.width/ratio,height:result.canvas.height/ratio,pad:result.pad,canvas:result.canvas,ratio,pixels:result.pixels};
 previewCache.set(cacheKey,graphic);
 if(previewCache.size>24)previewCache.delete(previewCache.keys().next().value!);
 return graphic;
}

// Text with a shadow must be drawn by the same glyph painter as its alpha
// mask. CSS text has different baseline/line-box metrics than canvas text.
const textCache=new Map<string,string>();
export function previewTextContent(e:CardElement,value:string,ratio:number):string|null{
 if(!Number.isFinite(ratio)||ratio<=0)return null;
 const local={...e,x:0,y:0};
 const key=JSON.stringify([local,value,ratio]);
 const existing=textCache.get(key);if(existing)return existing;
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.ceil(e.w*ratio));
 canvas.height=Math.max(1,Math.ceil(e.h*ratio));
 const ctx=canvas.getContext('2d');
 if(!ctx||typeof canvas.toDataURL!=='function')return null;
 ctx.scale(ratio,ratio);
 paintTextContent(ctx,local,value);
 const graphic=canvas.toDataURL('image/png');
 textCache.set(key,graphic);
 if(textCache.size>32)textCache.delete(textCache.keys().next().value!);
 return graphic;
}
