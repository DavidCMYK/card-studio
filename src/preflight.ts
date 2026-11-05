/** Non-destructive print-service preflight, using the same visible elements,
 * geometry, image assignment and text wrapping as the card PNG renderer. */
import {S,assignedTemplate,cardSetFor,cardExtras,visibleOnCard} from './model';
import {guideRects,validateGuides} from './card-guides';
import {elementGeometry} from './anchor-layout';
import {getImageRef,imgBox,loadedImage} from './image-sets';
import {layoutTextBox} from './text-layout';
import type {CardElement,CardSide} from './types';

export type PreflightSeverity='error'|'warning';
export type PreflightCode='missing-artwork'|'unreadable-artwork'|'low-resolution'|'text-overflow'|
 'unsafe-text'|'unbundled-font'|'font-variant'|'invalid-guides'|'no-bleed'|
 'empty-visible-text'|'duplicate-card-name'|'unnamed-card';
export interface PreflightFinding {
 severity:PreflightSeverity;
 code:PreflightCode;
 cardIndex:number|null;
 cardName:string;
 setName:string;
 side:CardSide|null;
 elementName:string;
 message:string;
}
export interface PreflightReport {
 checkedCards:number;
 checkedSides:number;
 checkedImages:number;
 findings:PreflightFinding[];
}
export type ImageDimensions={naturalWidth:number;naturalHeight:number};
export type ImageMeasure=(src:string)=>Promise<ImageDimensions|null>;
const defaultMeasure:ImageMeasure=async src=>{
 const img=await loadedImage(src);
 return img&&img.naturalWidth>0&&img.naturalHeight>0?img:null;
};
const round=(n:number)=>Math.round(n);
const keyFor=(font:string,weight:number,style:string)=>
 font.trim().toLowerCase()+'|'+weight+'|'+style;
/** Scans all cards and their assigned sides, without modifying the project.
 * Image size reads are cached once per unique artwork source. */
export async function scanDeck(measure:ImageMeasure=defaultMeasure):Promise<PreflightReport>{
 const findings:PreflightFinding[]=[];
 const add=(severity:PreflightSeverity,code:PreflightCode,ci:number|null,
  side:CardSide|null,elementName:string,message:string,setName?:string)=>{
  const card=ci===null?null:S.cards[ci];
  findings.push({severity,code,cardIndex:ci,cardName:card?.name||'',
   setName:setName||cardSetFor(card)?.name||'',side,elementName,message});
 };
 const checkedTemplates=new Set<string>();
 const checkedFonts=new Set<string>();
 const images=new Map<string,Promise<ImageDimensions|null>>();
 const seenNames=new Map<string,number>();
 let checkedSides=0;
 for(let ci=0;ci<S.cards.length;ci++){
  const card=S.cards[ci],set=cardSetFor(card);
  const cardName=String(card.name||'').trim(),nameKey=cardName.toLowerCase();
  if(!cardName)add('error','unnamed-card',ci,null,'Card name',
   'This card has no name; it needs an identifiable export filename.');
  else if(seenNames.has(nameKey)){
   add('warning','duplicate-card-name',ci,null,'Card name',
    'This name is also used by card '+(seenNames.get(nameKey)!+1)+
    '. Batch export will append a suffix to one of the files.');
  }else seenNames.set(nameKey,ci);
  for(const side of ['front','back'] as CardSide[]){
   const template=assignedTemplate(ci,side);
   if(!template)continue;
   checkedSides++;
   const templateId=template.id||template.name;
   if(!checkedTemplates.has(templateId)){
    checkedTemplates.add(templateId);
    try{validateGuides(template);}
    catch(error){add('error','invalid-guides',ci,side,'Template',
      'Invalid trim, safe or bleed guides: '+(error as Error).message);}
    const guides=guideRects(template);
    if(guides.settings.bleedMode!=='bleed'){
     add('warning','no-bleed',ci,side,'Template',
      'Template canvas has no included bleed. Confirm the print service accepts trim-only artwork.');
    }
   }
   const guides=guideRects(template);
   const mmToDesign=96/25.4,safe={
    left:guides.safe.x*mmToDesign,top:guides.safe.y*mmToDesign,
    right:(guides.safe.x+guides.safe.w)*mmToDesign,
    bottom:(guides.safe.y+guides.safe.h)*mmToDesign
   };
   for(const raw of [...template.elements,...cardExtras(card,side)]){
    if(!visibleOnCard(raw,ci,'cards',template,side))continue;
    const e:CardElement={...raw,...(card.overrides?.[raw.id]||{}),
     ...elementGeometry(raw,ci,'cards',template,side)};
    if(e.kind==='image'){
     const asset=getImageRef(raw,ci,'cards');
     if(!asset?.data){
      add('error','missing-artwork',ci,side,raw.name,
       'No image resolves for this card. Assign artwork or hide this frame.');
      continue;
     }
     if(!images.has(asset.data))images.set(asset.data,Promise.resolve()
      .then(()=>measure(asset.data)).catch(()=>null));
     const size=await images.get(asset.data)!;
     if(!size||size.naturalWidth<=0||size.naturalHeight<=0){
      add('error','unreadable-artwork',ci,side,raw.name,
       'The assigned artwork could not be decoded.');
      continue;
     }
     const box=imgBox(e,size);
     if(box.w>0&&box.h>0){
      const dpi=Math.min(size.naturalWidth*96/box.w,size.naturalHeight*96/box.h);
      if(Number.isFinite(dpi)&&dpi<template.dpi-.5){
       add(dpi<150?'error':'warning','low-resolution',ci,side,raw.name,
        'Effective resolution is approximately '+round(dpi)+' DPI, below the template target of '+
        template.dpi+' DPI'+(dpi<150?' (very low)':'')+'.');
      }
     }
    }else if(e.kind==='text'){
     const value=Object.prototype.hasOwnProperty.call(card.values||{},raw.id)?
      String(card.values[raw.id]??''):String(raw.text??'');
     if(!value.trim()){
      if(e.invisibleIfEmpty===false)
       add('warning','empty-visible-text',ci,side,raw.name,
        'This field is blank, but the element is configured to stay visible when empty.');
      continue;
     }
     const textBox=layoutTextBox({...e,autoWidth:false,autoHeight:false},value);
     if(textBox.textHeight>textBox.innerH+.75){
      add('error','text-overflow',ci,side,raw.name,
       'Text is taller than its visible box and will be clipped on export.');
     }
     if(e.x<safe.left-.5||e.y<safe.top-.5||
      e.x+e.w>safe.right+.5||e.y+e.h>safe.bottom+.5){
      add('warning','unsafe-text',ci,side,raw.name,
       'Text box extends outside the template safe area.');
     }
     const font=String(e.font||'Georgia').trim();
     const weight=Number(e.fontWeight)||400,style=e.italic?'italic':'normal';
     const fontKey=templateId+'|'+keyFor(font,weight,style);
     if(!checkedFonts.has(fontKey)){
      checkedFonts.add(fontKey);
      const assets=(S.fonts||[]).filter(f=>f.family.toLowerCase()===font.toLowerCase());
      if(!assets.length){
       add('warning','unbundled-font',ci,side,raw.name,
        'Font "'+font+'" is not embedded in this project and may be substituted on another device.');
      }else if(!assets.some(f=>(f.weight||400)===weight&&(f.style||'normal')===style)){
       add('warning','font-variant',ci,side,raw.name,
        'The embedded font "'+font+'" lacks this weight/style ('+weight+', '+style+
        '); the browser may synthesize it.');
      }
     }
    }
   }
  }
 }
 return {checkedCards:S.cards.length,checkedSides,checkedImages:images.size,findings};
}
