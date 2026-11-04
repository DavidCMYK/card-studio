/** Card trim and safe-area geometry. The canvas edge is the outer artwork boundary. */
import type {CardTemplate, StagedCard, Units, CardElement} from './types';
export type Edge='top'|'right'|'bottom'|'left';
export type Edges={top:number;right:number;bottom:number;left:number};
export type BleedMode='trim'|'bleed';
export interface CardGuides {
  bleedMode:BleedMode;
  unit:Units;
  bleed:Edges; safe:Edges;
  bleedLinked:boolean;safeLinked:boolean;
  showTemplate:boolean;showCards:boolean;dimUnsafe:boolean;
}
export const DEFAULT_BLEED_MM=3, DEFAULT_SAFE_MM=4;
export const DEFAULT_GUIDES:CardGuides={
  bleedMode:'trim',unit:'mm',
  bleed:{top:3,right:3,bottom:3,left:3},
  safe:{top:4,right:4,bottom:4,left:4},
  bleedLinked:true,safeLinked:true,
  showTemplate:true,showCards:false,dimUnsafe:false
};
const mmPerUnit=(unit:Units,dpi:number):number=>unit==='in'?25.4:unit==='px'?25.4/dpi:1;
export function distanceMm(value:number,unit:Units,dpi:number):number {return value*mmPerUnit(unit,dpi);}
export function distanceInUnit(valueMm:number,unit:Units,dpi:number):number {return valueMm/mmPerUnit(unit,dpi);}
export function displayedDistance(valueMm:number,unit:Units,dpi:number):string {
  return String(Number(distanceInUnit(valueMm,unit,dpi).toFixed(6)));
}
export function guidesFor(t:CardTemplate):CardGuides {
  const g=t.guides;
  return {
    ...DEFAULT_GUIDES,...g,unit:g?.unit||t.unit,
    bleed:{...DEFAULT_GUIDES.bleed,...g?.bleed},safe:{...DEFAULT_GUIDES.safe,...g?.safe}
  };
}
export function canvasDimensionsMm(t:CardTemplate):{width:number;height:number} {
  const k=mmPerUnit(t.unit,t.dpi);
  return {width:t.width*k,height:t.height*k};
}
export function trimDimensionsMm(t:CardTemplate):{width:number;height:number} {
  const c=canvasDimensionsMm(t),g=guidesFor(t);
  if(g.bleedMode!=='bleed')return c;
  return {width:c.width-g.bleed.left-g.bleed.right,
    height:c.height-g.bleed.top-g.bleed.bottom};
}
export function guideRects(t:CardTemplate){
  const c=canvasDimensionsMm(t),g=guidesFor(t);
  const b=g.bleedMode==='bleed'?g.bleed:{top:0,bottom:0,left:0,right:0};
  const trim={x:b.left,y:b.top,w:c.width-b.left-b.right,h:c.height-b.top-b.bottom};
  const safe={x:trim.x+g.safe.left,y:trim.y+g.safe.top,
    w:trim.w-g.safe.left-g.safe.right,h:trim.h-g.safe.top-g.safe.bottom};
  return {canvas:c,trim,safe,bleed:b,settings:g};
}
export function validateGuides(t:CardTemplate):void{
  const {canvas,trim,safe,settings}=guideRects(t);
  const all=[canvas.width,canvas.height,...Object.values(settings.bleed),...Object.values(settings.safe)];
  if(!all.every(Number.isFinite)||Object.values(settings.bleed).some(x=>x<0)||Object.values(settings.safe).some(x=>x<0))throw Error('Guide distances must be non-negative numbers');
  if(canvas.width<=0||canvas.height<=0||trim.w<=0||trim.h<=0)throw Error('Bleed must leave a positive finished-card size');
  if(safe.w<=0||safe.h<=0)throw Error('Safe-area insets must leave a visible interior');
}
function scaleMm(t:CardTemplate,mm:number):number{return mm/mmPerUnit(t.unit,t.dpi);}
/** Shift artwork so its position relative to trim stays fixed, while full-canvas
 * backgrounds still cover the outer canvas. Applies to template, card overrides
 * and card-only objects. Values/anchors are unchanged. */
function resizeCanvasAroundTrim(t:CardTemplate,cards:StagedCard[],oldEdges:Edges,newEdges:Edges){
  const dx=distanceMm(newEdges.left-oldEdges.left,'mm',t.dpi)*96/25.4;
  const dy=distanceMm(newEdges.top-oldEdges.top,'mm',t.dpi)*96/25.4;
  const dw=distanceMm(newEdges.left+newEdges.right-oldEdges.left-oldEdges.right,'mm',t.dpi)*96/25.4;
  const dh=distanceMm(newEdges.top+newEdges.bottom-oldEdges.top-oldEdges.bottom,'mm',t.dpi)*96/25.4;
  const c=canvasDimensionsMm(t),oldW=c.width*96/25.4,oldH=c.height*96/25.4;
  const background=(e:Partial<CardElement>)=>Math.abs((e.x??NaN))<.01&&Math.abs((e.y??NaN))<.01&&Math.abs((e.w??NaN)-oldW)<.01&&Math.abs((e.h??NaN)-oldH)<.01;
  const edit=(e:Partial<CardElement>,full:boolean)=>{
    if(full){if(e.x!==undefined)e.x=0;if(e.y!==undefined)e.y=0;
      if(e.w!==undefined)e.w+=dw;if(e.h!==undefined)e.h+=dh;
    }else{if(e.x!==undefined)e.x+=dx;if(e.y!==undefined)e.y+=dy;}
  };
  const fullIds=new Set(t.elements.filter(background).map(e=>e.id));
  for(const e of t.elements)edit(e,fullIds.has(e.id));
  for(const card of cards){
    for(const e of card.extraElements||[])edit(e,background(e));
    for(const [id,o] of Object.entries(card.overrides||{})){
      // A partial override inherits shifted coordinates from the template.
      // Explicit position overrides must follow that shift too.
      if(fullIds.has(id)){if(o.x!==undefined)o.x=0;if(o.y!==undefined)o.y=0;
        if(o.w!==undefined)o.w+=dw;if(o.h!==undefined)o.h+=dh;
      }else{if(o.x!==undefined)o.x+=dx;if(o.y!==undefined)o.y+=dy;}
    }
  }
  t.width+=scaleMm(t,newEdges.left+newEdges.right-oldEdges.left-oldEdges.right);
  t.height+=scaleMm(t,newEdges.top+newEdges.bottom-oldEdges.top-oldEdges.bottom);
}
const zero:Edges={top:0,right:0,bottom:0,left:0};
/** Mode change, with either size-preserving expansion or explicit reinterpretation. */
export function changeBleedMode(t:CardTemplate,cards:StagedCard[],mode:BleedMode,preserveTrim=true){
  const before=guidesFor(t);if(before.bleedMode===mode)return;
  const oldEdges=before.bleedMode==='bleed'?before.bleed:zero;
  const newEdges=mode==='bleed'?before.bleed:zero;
  if(preserveTrim)resizeCanvasAroundTrim(t,cards,oldEdges,newEdges);
  t.guides={...before,bleedMode:mode};
  validateGuides(t);
}
export function setGuideDistance(t:CardTemplate,cards:StagedCard[],kind:'bleed'|'safe',edge:Edge,valueMm:number){
  if(!Number.isFinite(valueMm)||valueMm<0)throw Error('Distance must be zero or greater');
  const g=guidesFor(t),before={...g[kind]},after={...before};
  if(g[kind+'Linked' as 'bleedLinked'|'safeLinked'])for(const e of ['top','right','bottom','left'] as Edge[])after[e]=valueMm;
  else after[edge]=valueMm;
  if(kind==='bleed'&&g.bleedMode==='bleed')resizeCanvasAroundTrim(t,cards,before,after);
  t.guides={...g,[kind]:after};validateGuides(t);
}
export function setGuideUnit(t:CardTemplate,unit:Units){t.guides={...guidesFor(t),unit};}