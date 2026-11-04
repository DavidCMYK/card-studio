/** Card trim and safe-area geometry. The canvas edge is the outer artwork boundary. */
import type {CardTemplate, StagedCard, Units, CardElement} from './types';
export type Edge='top'|'right'|'bottom'|'left';
export type Edges={top:number;right:number;bottom:number;left:number};
export type BleedMode='trim'|'bleed';
export interface CardGuides {
  bleedMode:BleedMode;
  unit:Units;
  bleed:Edges; safe:Edges;
  bleedLinked:boolean;safeLinked:boolean;modeChange?:'preserve'|'reinterpret';
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
/**
 * Existing artwork MUST remain unchanged when bleed interpretation changes.
 * The canvas is an existing physical document, not a request to rescale it.
 * Explicit canvas size edits belong to the existing dimension controls.
 */
export function changeBleedMode(t:CardTemplate,_cards:StagedCard[],mode:BleedMode):void {
  const before=guidesFor(t);
  if(before.bleedMode===mode)return;
  if(mode!=='trim'&&mode!=='bleed')throw Error('Unknown canvas sizing mode');
  const next={...before,bleedMode:mode};
  validateGuides({...t,guides:next});
  t.guides=next;
}

/**
 * Distances are metadata measured from the current canvas/trim edge.
 * Changing them must never move, stretch or otherwise alter user artwork.
 */
export function setGuideDistance(t:CardTemplate,_cards:StagedCard[],kind:'bleed'|'safe',edge:Edge,valueMm:number):void {
  if(!Number.isFinite(valueMm)||valueMm<0)throw Error('Distance must be zero or greater');
  const g=guidesFor(t),after={...g[kind]};
  if(g[kind+'Linked' as 'bleedLinked'|'safeLinked']){
    for(const e of ['top','right','bottom','left'] as Edge[])after[e]=valueMm;
  }else after[edge]=valueMm;
  const next={...g,[kind]:after};
  validateGuides({...t,guides:next});
  t.guides=next;
}
export function setGuideUnit(t:CardTemplate,unit:Units){t.guides={...guidesFor(t),unit};}