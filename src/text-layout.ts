/** Text measurement and auto-fit geometry shared by preview, inspector and PNG export. */
import type { CardElement } from './types';
export interface TextLayout {
 x:number;y:number;w:number;h:number;
 left:number;right:number;top:number;bottom:number;
 innerW:number;innerH:number;fontPx:number;linePx:number;lines:string[];textHeight:number;
}
const margin=(n:number|undefined)=>Math.max(0,Number(n)||0);
function fontCSS(e:CardElement,size:number){
 const name=String(e.font||'Georgia').replace(/["\\]/g,'');
 return `${e.italic?'italic ':''}${e.fontWeight||400} ${size}px "${name}"`;
}
const canvasCache=new WeakMap<object,CanvasRenderingContext2D>();
function measureContext():CanvasRenderingContext2D|null{
 if(typeof document==='undefined')return null;
 let ctx=canvasCache.get(document);
 if(!ctx){ctx=document.createElement('canvas')?.getContext?.('2d')||null;if(ctx)canvasCache.set(document,ctx);}
 return ctx||null;
}
function widthOf(text:string,ctx:CanvasRenderingContext2D|null,size:number,spacing:number){
 const base=ctx?.measureText?.(text)?.width??[...text].length*size*.53;
 const extra=ctx&&'letterSpacing' in ctx?0:Math.max(0,[...text].length-1)*spacing;
 return Math.max(0,base+extra);
}
function lineWrap(value:string,maxWidth:number,width:(text:string)=>number):string[]{
 const result:string[]=[];
 for(const para of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
  if(!para){result.push('');continue;}
  let line='';
  for(const word of para.split(/\s+/)){
   if(width(word)>maxWidth){
    if(line){result.push(line);line='';}
    let part='';
    for(const ch of [...word]){if(part&&width(part+ch)>maxWidth){result.push(part);part=ch;}else part+=ch;}
    line=part;
   }else if(line&&width(line+' '+word)>maxWidth){result.push(line);line=word;}
   else line+=(line?' ':'')+word;
  }
  result.push(line);
 }
 return result;
}
/** Stored x/y/w/h define the anchor rectangle; computed geometry is per-card and temporary. */
export function layoutTextBox(e:CardElement,value:string):TextLayout{
 const fontPx=Math.max(1,Number(e.fontSize)||16)*96/72;
 const linePx=fontPx*(Number.isFinite(Number(e.lineHeight))&&Number(e.lineHeight)>0?Number(e.lineHeight):1.2);
 const left=margin(e.gutterLeft),right=margin(e.gutterRight),top=margin(e.gutterTop),bottom=margin(e.gutterBottom);
 const ctx=measureContext(),spacing=Number(e.letterSpacing)||0;
 if(ctx){ctx.font=fontCSS(e,fontPx);if('letterSpacing' in ctx)ctx.letterSpacing=spacing+'px';}
 const measure=(t:string)=>widthOf(t,ctx,fontPx,spacing);
 const str=String(value??'').replace(/\r\n?/g,'\n');
 const empty=str.trim()==='';
 const autoW=e.autoWidth===true,autoH=e.autoHeight===true;
 const naturalLines=empty?[]:str.split('\n');
 const maxLine=Math.max(0,...naturalLines.map(measure));
 const w=autoW?(empty?0:Math.max(1,Math.ceil(maxLine+left+right+2))):Math.max(1,e.w);
 const innerW=w===0?0:Math.max(1,w-left-right);
 const lines=empty?[]:autoW?naturalLines:lineWrap(str,innerW,measure);
 const textHeight=lines.length*linePx;
 const h=autoH?(empty?0:Math.max(1,Math.ceil(textHeight+top+bottom))):Math.max(1,e.h);
 const x=e.x+(autoW?(e.align==='right'?e.w-w:e.align==='center'?(e.w-w)/2:0):0);
 const y=e.y+(autoH?(e.valign==='bottom'?e.h-h:e.valign==='middle'?(e.h-h)/2:0):0);
 return {x,y,w,h,left,right,top,bottom,innerW,innerH:h===0?0:Math.max(1,h-top-bottom),fontPx,linePx,lines,textHeight};
}
