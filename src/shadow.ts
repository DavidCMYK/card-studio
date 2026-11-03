/** Alpha-mask shadows. Spread is circular morphological dilation, not blur or box-shadow. */
import type { CardElement } from './types';
import { clamp } from './model';
import { paintElement } from './element-paint';

export interface ShadowGraphic { canvas:HTMLCanvasElement; pad:number; ratio:number; }
export const hasShadow=(e:CardElement)=>e.shadowEnabled===true&&Number(e.shadowOpacity??65)>0;
const nonnegative=(n:unknown)=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
/**
 * Nearest nontransparent pixel for each point, using exact 2D squared Euclidean
 * distance transform. The source alpha is retained (unlike binary silhouettes).
 * This preserves transparent holes, alpha edges, and independently shaped parts.
 */
export function spreadAlpha(alpha:Uint8ClampedArray,width:number,height:number,radius:number):Uint8ClampedArray{
 const length=width*height;
 if(length!==alpha.length)throw Error('Invalid shadow alpha mask dimensions');
 if(radius<=0)return new Uint8ClampedArray(alpha);
 const out=new Uint8ClampedArray(length),nearestY=new Int32Array(length).fill(-1);
 let hasPixels=false;
 for(let x=0;x<width;x++){
  let previous=-1;
  for(let y=0;y<height;y++){
   const idx=y*width+x;
   if(alpha[idx]>0){previous=y;hasPixels=true;}
   nearestY[idx]=previous;
  }
  previous=-1;
  for(let y=height-1;y>=0;y--){
   const idx=y*width+x;
   if(alpha[idx]>0)previous=y;
   if(previous>=0&&(nearestY[idx]<0||previous-y<y-nearestY[idx]))nearestY[idx]=previous;
  }
 }
 if(!hasPixels)return out;
 // For each row, find the lower envelope of distance parabolas along x.
 // The vertical pass above has already found each column's nearest source y.
 const v=new Int32Array(width),z=new Float64Array(width+1);
 const f=new Float64Array(width),sourceY=new Int32Array(width);
 const r2=(radius+.25)*(radius+.25);
 for(let y=0;y<height;y++){
  let k=-1;
  for(let x=0;x<width;x++){
   const sy=nearestY[y*width+x];sourceY[x]=sy;
   f[x]=sy<0?Infinity:(y-sy)*(y-sy);
   if(!Number.isFinite(f[x]))continue;
   let point=0;
   while(k>=0){
    const q=v[k];point=((f[x]+x*x)-(f[q]+q*q))/(2*(x-q));
    if(point>z[k])break;
    k--;
   }
   k++;v[k]=x;z[k]=k===0?-Infinity:point;z[k+1]=Infinity;
  }
  if(k<0)continue;
  let which=0;
  for(let x=0;x<width;x++){
   while(which<k&&z[which+1]<x)which++;
   const q=v[which],distance=f[q]+(x-q)*(x-q);
   if(distance<=r2)out[y*width+x]=alpha[sourceY[q]*width+q];
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
