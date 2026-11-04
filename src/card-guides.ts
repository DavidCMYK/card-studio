/** Card geometry: finished cut size is locked when editing canvas/bleed; cut
 * size changes drive canvas size; safe zones are always inside the cut area.
 * All calculations are in physical millimetres, independent of display units.
 * Changing dimensions NEVER changes a card element's saved coordinates. */
import type {CardTemplate, StagedCard, Units} from './types';
export type Edge='top'|'right'|'bottom'|'left';
export type Axis='width'|'height';
export type Edges={top:number;right:number;bottom:number;left:number};
export type BleedMode='trim'|'bleed';
export type GuideBoundary='cut'|'safe';
export type GuideRadii=Record<GuideBoundary,number>;
export interface CardGuides {
  bleedMode:BleedMode;
  unit:Units;
  bleed:Edges; safe:Edges;
  /** Rounded guide corners in mm; these never clip the rendered artwork. */
  radii?:GuideRadii;
  bleedLinked:boolean;safeLinked:boolean;
  /** Kept to read older project files; conversion is never automatic. */
  modeChange?:'preserve'|'reinterpret';
  showTemplate:boolean;showCards:boolean;dimUnsafe:boolean;
}
export const DEFAULT_BLEED_MM=3, DEFAULT_SAFE_MM=4;
export const DEFAULT_GUIDES:CardGuides={
  bleedMode:'trim',unit:'mm',
  bleed:{top:3,right:3,bottom:3,left:3},
  safe:{top:4,right:4,bottom:4,left:4},
  bleedLinked:true,safeLinked:true,
  radii:{cut:0,safe:0},
  showTemplate:true,showCards:false,dimUnsafe:false
};
const mmPerUnit=(unit:Units,dpi:number):number=>unit==='in'?25.4:unit==='px'?25.4/dpi:1;
export function distanceMm(value:number,unit:Units,dpi:number):number{return value*mmPerUnit(unit,dpi);}
export function distanceInUnit(valueMm:number,unit:Units,dpi:number):number{return valueMm/mmPerUnit(unit,dpi);}
export function displayedDistance(valueMm:number,unit:Units,dpi:number):string {
  return String(Number(distanceInUnit(valueMm,unit,dpi).toFixed(6)));
}
export function guidesFor(t:CardTemplate):CardGuides {
 const g=t.guides;
 return {...DEFAULT_GUIDES,...g,unit:g?.unit||t.unit,
  bleed:{...DEFAULT_GUIDES.bleed,...g?.bleed},safe:{...DEFAULT_GUIDES.safe,...g?.safe},
  radii:{cut:g?.radii?.cut??0,safe:g?.radii?.safe??0}};
}
export function canvasDimensionsMm(t:CardTemplate):{width:number;height:number}{
 const k=mmPerUnit(t.unit,t.dpi);return {width:t.width*k,height:t.height*k};
}
export function trimDimensionsMm(t:CardTemplate):{width:number;height:number}{
 const c=canvasDimensionsMm(t),g=guidesFor(t);
 if(g.bleedMode!=='bleed')return c;
 return {width:c.width-g.bleed.left-g.bleed.right,height:c.height-g.bleed.top-g.bleed.bottom};
}
export function safeDimensionsMm(t:CardTemplate):{width:number;height:number}{
 const c=trimDimensionsMm(t),g=guidesFor(t);
 return {width:c.width-g.safe.left-g.safe.right,height:c.height-g.safe.top-g.safe.bottom};
}
export function guideRects(t:CardTemplate){
 const c=canvasDimensionsMm(t),g=guidesFor(t);
 const b=g.bleedMode==='bleed'?g.bleed:{top:0,bottom:0,left:0,right:0};
 const trim={x:b.left,y:b.top,w:c.width-b.left-b.right,h:c.height-b.top-b.bottom};
 const safe={x:trim.x+g.safe.left,y:trim.y+g.safe.top,
  w:trim.w-g.safe.left-g.safe.right,h:trim.h-g.safe.top-g.safe.bottom};
 const radii={cut:Math.min(g.radii!.cut,Math.min(trim.w,trim.h)/2),
  safe:Math.min(g.radii!.safe,Math.min(safe.w,safe.h)/2)};
 return {canvas:c,trim,safe,bleed:b,settings:g,radii};
}
export function validateGuides(t:CardTemplate):void{
 const {canvas,trim,safe,settings}=guideRects(t);
 const all=[canvas.width,canvas.height,...Object.values(settings.bleed),...Object.values(settings.safe),...Object.values(settings.radii!)];
 if(!all.every(Number.isFinite)||Object.values(settings.bleed).some(x=>x<0)||Object.values(settings.safe).some(x=>x<0)||Object.values(settings.radii!).some(x=>x<0))throw Error('Guide distances and corner radii must be non-negative numbers');
 if(canvas.width<=0||canvas.height<=0||trim.w<=0||trim.h<=0)throw Error('Bleed must leave a positive finished-card size');
 if(safe.w<=0||safe.h<=0)throw Error('Safe-area insets must leave a visible interior');
}
function positive(value:number,name:string){if(!Number.isFinite(value)||value<=0)throw Error(name+' must be greater than zero');}
const total=(edges:Edges,axis:Axis)=>axis==='width'?edges.left+edges.right:edges.top+edges.bottom;
function setCanvasMm(t:CardTemplate,canvas:{width:number;height:number},g:CardGuides){
 const mmToUnits=mmPerUnit(t.unit,t.dpi);
 const trial:CardTemplate={...t,width:canvas.width/mmToUnits,height:canvas.height/mmToUnits,guides:g};
 validateGuides(trial); // Commit atomically; errors do not mutate document or artwork.
 t.width=trial.width;t.height=trial.height;t.guides=g;
 clampStoredRadii(t);
}
const sameEdges=(e:Edges)=>Math.abs(e.top-e.bottom)<1e-8&&Math.abs(e.top-e.left)<1e-8&&Math.abs(e.top-e.right)<1e-8;
/** Preserve the difference between opposite margins; distribute added space
 * symmetrically. When one side reaches zero, allocate the rest to the other. */
function fitOpposite(first:number,second:number,requiredTotal:number):[number,number]{
 const a=Math.min(requiredTotal,Math.max(0,first+(requiredTotal-first-second)/2));
 return [a,requiredTotal-a];
}
function adjustPair(edges:Edges,axis:Axis,newTotal:number):Edges{
 const result={...edges};
 const [a,b]=axis==='width'?['left','right'] as const:['top','bottom'] as const;
 [result[a],result[b]]=fitOpposite(edges[a],edges[b],newTotal);
 return result;
}
/** Width/height directly edit the finished card size. Bleed stays fixed;
 * canvas follows; safe buffers stay fixed, changing the resulting safe zone. */
export function setCutDimension(t:CardTemplate,axis:Axis,value:number):void{
 positive(value,'Finished cut size');
 const mm=distanceMm(value,t.unit,t.dpi);
 const cut=trimDimensionsMm(t),g=guidesFor(t);
 cut[axis]=mm;
 const bleed=g.bleedMode==='bleed'?g.bleed:{top:0,right:0,bottom:0,left:0};
 setCanvasMm(t,{width:cut.width+total(bleed,'width'),height:cut.height+total(bleed,'height')},g);
}
/** Width/height edit the canvas without changing cut size. The difference is
 * stored as bleed, distributed across both opposite sides. Enlarging a
 * no-bleed canvas activates bleed mode; shrinking below cut is rejected. */
export function setCanvasDimension(t:CardTemplate,axis:Axis,value:number):void{
 positive(value,'Canvas size');
 const targetMm=distanceMm(value,t.unit,t.dpi);
 const cut=trimDimensionsMm(t),canvas=canvasDimensionsMm(t),g=guidesFor(t);
 if(Math.abs(targetMm-canvas[axis])<1e-8)return;
 const needed=targetMm-cut[axis];
 if(needed < -1e-8)throw Error('Canvas size cannot be smaller than the finished cut size');
 const active=g.bleedMode==='bleed'?g.bleed:{top:0,right:0,bottom:0,left:0};
 const bleed=adjustPair(active,axis,Math.max(0,needed));
 const next:CardGuides={...g,bleedMode:'bleed',bleed,
  bleedLinked:g.bleedLinked&&sameEdges(bleed)};
 canvas[axis]=targetMm;
 setCanvasMm(t,canvas,next);
}
/** Bleed changes canvas dimensions, never the finished cut size or elements.
 * Entering bleed in a no-bleed project enables bleed using the saved default. */
export function setGuideDistance(t:CardTemplate,_cards:StagedCard[],kind:'bleed'|'safe',edge:Edge,valueMm:number):void{
 if(!Number.isFinite(valueMm)||valueMm<0)throw Error('Distance must be zero or greater');
 const g=guidesFor(t),after={...g[kind]};
 if(g[kind+'Linked' as 'bleedLinked'|'safeLinked']){
  for(const e of ['top','right','bottom','left'] as Edge[])after[e]=valueMm;
 }else after[edge]=valueMm;
 const next={...g,[kind]:after};
 if(kind==='bleed'){
  next.bleedMode='bleed';
  const cut=trimDimensionsMm(t);
  setCanvasMm(t,{width:cut.width+total(after,'width'),height:cut.height+total(after,'height')},next);
 }else validateThenSet(t,next);
}
function validateThenSet(t:CardTemplate,g:CardGuides){validateGuides({...t,guides:g});t.guides=g;clampStoredRadii(t);}
/** Enabling/disabling bleed keeps cut size constant; it only grows/shrinks
 * the canvas. Existing element and card override coordinates are untouched. */
export function changeBleedMode(t:CardTemplate,_cards:StagedCard[],mode:BleedMode):void{
 const g=guidesFor(t);
 if(mode!=='trim'&&mode!=='bleed')throw Error('Unknown canvas sizing mode');
 if(g.bleedMode===mode)return;
 const cut=trimDimensionsMm(t),b=mode==='bleed'?g.bleed:{top:0,right:0,bottom:0,left:0};
 setCanvasMm(t,{width:cut.width+total(b,'width'),height:cut.height+total(b,'height')},{...g,bleedMode:mode});
}
/** Entering a safe zone size adjusts the associated safety buffers, never the
 * cut area. If no longer equal, the four-side linking automatically unlocks. */
export function setSafeZoneDimension(t:CardTemplate,axis:Axis,value:number):void{
 positive(value,'Safe-zone size');
 const mm=distanceMm(value,t.unit,t.dpi),cut=trimDimensionsMm(t),g=guidesFor(t);
 if(mm>cut[axis]+1e-8)throw Error('Safe-zone size cannot exceed the finished cut size');
 const safe=adjustPair(g.safe,axis,Math.max(0,cut[axis]-mm));
 const next={...g,safe,safeLinked:g.safeLinked&&sameEdges(safe)};
 validateThenSet(t,next);
}
/** Toggle four-side linking atomically. Re-enabling uses top as the common
 * distance, leaving the cut size fixed and updating canvas/safe dimensions. */
export function setGuideLinked(t:CardTemplate,kind:'bleed'|'safe',linked:boolean):void{
 const g=guidesFor(t),key=kind+'Linked' as 'bleedLinked'|'safeLinked';
 if(!linked){t.guides={...g,[key]:false};return;}
 const common=g[kind].top,edges={top:common,right:common,bottom:common,left:common};
 const next={...g,[key]:true,[kind]:edges};
 if(kind==='bleed'&&g.bleedMode==='bleed'){
  const cut=trimDimensionsMm(t);
  setCanvasMm(t,{width:cut.width+total(edges,'width'),height:cut.height+total(edges,'height')},next);
 }else validateThenSet(t,next);
}
export function setGuideUnit(t:CardTemplate,unit:Units){
 if(!['mm','in','px'].includes(unit))throw Error('Unsupported guide unit');
 t.guides={...guidesFor(t),unit};
}
/** Keep stored radii within the new guide bounds after dimension changes.
 * Never moves artwork or changes cut/canvas/safe dimensions. */
function clampStoredRadii(t:CardTemplate):void{
 const r=guideRects(t),g=guidesFor(t);
 t.guides={...g,radii:{...r.radii}};
}
export function setGuideCornerRadius(t:CardTemplate,boundary:GuideBoundary,valueMm:number):void{
 if(!['cut','safe'].includes(boundary))throw Error('Unknown corner-radius guide');
 if(!Number.isFinite(valueMm)||valueMm<0)throw Error('Corner radius must be zero or greater');
 const {trim,safe}=guideRects(t);
 const width=boundary==='cut'?trim.w:safe.w;
 const height=boundary==='cut'?trim.h:safe.h;
 const max=Math.min(width,height)/2;
 if(valueMm>max+1e-8)throw Error('Corner radius cannot exceed half the guide’s smaller dimension');
 const g=guidesFor(t);
 const next={...g,radii:{...g.radii!,[boundary]:Math.min(valueMm,max)}};
 validateGuides({...t,guides:next});
 t.guides=next;
}
