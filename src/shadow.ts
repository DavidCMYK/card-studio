/** Alpha-mask shadows. Spread is circular morphological dilation, not blur or box-shadow. */
import type { CardElement } from './types';
import { clamp } from './model';
import { paintElement, paintTextContent } from './element-paint';

export interface ShadowGraphic { canvas:HTMLCanvasElement; pad:number; ratio:number; }
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
/** Image-space rasterization works for all elements, including images with alpha. */
export function makeShadow(e:CardElement,value:string,img:CanvasImageSource|null,ratio:number):ShadowGraphic|null{
 if(!hasShadow(e)||!Number.isFinite(ratio)||ratio<=0)return null;
 const spread=nonnegative(e.shadowSpread),ox=Math.abs(Number(e.shadowOffsetX)||0),oy=Math.abs(Number(e.shadowOffsetY)||0);
 const pad=Math.ceil(Math.max(spread,0)+Math.max(ox,oy)+Math.max(0,e.borderWidth||0)/2+3);
 const width=Math.ceil((e.w+pad*2)*ratio),height=Math.ceil((e.h+pad*2)*ratio);
 if(width<1||height<1||width*height>16000000)return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context?.getImageData||!context.putImageData)return null;
 context.setTransform?.(ratio,0,0,ratio,(pad-e.x)*ratio,(pad-e.y)*ratio);
 paintElement(context,e,value,img);
 const mask=context.getImageData(0,0,width,height);
 const colored=shadePixels(mask,width,height,e,ratio);
 // putImageData ignores the active transform, which is intentional here.
 context.putImageData(colored,0,0);
 return {canvas,pad,ratio};
}

// Preview shadows are keyed by content, not the frame position, so dragging
// does not re-rasterize a large alpha mask on every pointermove.
const previewCache=new Map<string,{src:string;width:number;height:number;pad:number}>();
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
 const graphic={src:result.canvas.toDataURL('image/png'),width:result.canvas.width/ratio,height:result.canvas.height/ratio,pad:result.pad};
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
